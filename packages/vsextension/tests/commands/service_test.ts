/**
 * Project command service tests (22.12.3). A small port double isolates external
 * daemon I/O; assertions exercise the real service's returned data and failures.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import type {
  ExecutionMessage,
  ExecutionOptionsEcho,
  ExecutionResult,
} from "@vanaware/syntaxmesh";
import type { ExecutionCommandPort, } from "../../src/commands/contracts.ts";
import type { ProjectModel, ProjectSummary, } from "../../src/daemon/types.ts";
import { ProjectService, } from "../../src/commands/service.ts";

const warning: ExecutionMessage = {
  severity: "warning",
  id: "loaded-with-warning",
  text: "loaded with warning",
  file: "master.smx",
  line: 2,
};

const echo: ExecutionOptionsEcho = {
  entry: "master.smx",
  files: ["master.smx",],
  configContent: null,
  checkSyntax: false,
  listReports: "",
  listReportsIsRegex: true,
  report: null,
  reportsIsRegex: false,
  dynamicAttributes: null,
  outputDir: null,
  noReports: false,
  forceReports: false,
  abortOnWarnings: false,
  warnTsDeltas: false,
  addTrace: false,
  freeze: null,
  help: false,
  version: false,
  man: null,
  app: null,
  appOptions: null,
};

function model(
  uri: string,
  messages: ExecutionMessage[] = [warning,],
): ProjectModel {
  const envelope: ExecutionResult = {
    ok: true,
    exitCode: 0,
    options: echo,
    messages,
    results: {},
  };
  return {
    uri,
    entry: "master.smx",
    files: [{ path: "master.smx", content: "project p {}", },],
    envelope,
    status: "ok",
    addedAt: 10,
    reloadedAt: 20,
  };
}

const first = model("file:///first.smx",);
const second = model("file:///second.tjp", [],);
const summaries: ProjectSummary[] = [{
  uri: first.uri,
  entry: first.entry,
  status: first.status,
  reportCount: 0,
  addedAt: first.addedAt,
  reloadedAt: first.reloadedAt,
  active: true,
  lastIntent: "inventory",
},];

function fakePort(
  overrides: Partial<ExecutionCommandPort> = {},
): ExecutionCommandPort {
  return {
    addProject: () => Promise.resolve(first,),
    refreshProject: () => Promise.resolve(second,),
    removeProject: () => Promise.resolve(true,),
    listProjects: () => summaries,
    setActiveProject: () => second,
    activeProject: () => first,
    listReports: () => [],
    executeProject: () => Promise.reject(new Error("unused",),),
    ...overrides,
  };
}

describe("ProjectService", () => {
  it("adds a project and returns its envelope messages", async () => {
    const result = await new ProjectService(fakePort(),).addProject(first.uri,);

    assertEquals(result, { ok: true, value: first, messages: [warning,], },);
  });

  it("refreshes through the refresh port and returns envelope messages", async () => {
    let requested = "";
    const port = fakePort({
      refreshProject: (uri,) => {
        requested = uri;
        return Promise.resolve(second,);
      },
    },);
    const result = await new ProjectService(port,).refreshProject(second.uri,);

    assertEquals(requested, second.uri,);
    assertEquals(result, { ok: true, value: second, messages: [], },);
  });

  it("keeps a cached error-status model as a successful service operation", async () => {
    const failed = model(first.uri, [warning,],);
    failed.status = "error";
    failed.envelope = { ...failed.envelope!, ok: false, exitCode: 1, };
    const result = await new ProjectService(
      fakePort({ addProject: () => Promise.resolve(failed,), },),
    ).addProject(first.uri,);

    assertEquals(result, { ok: true, value: failed, messages: [warning,], },);
  });

  it("rejects an invalid master before invoking the port", async () => {
    let called = false;
    const port = fakePort({
      addProject: () => {
        called = true;
        return Promise.resolve(first,);
      },
    },);
    const result = await new ProjectService(port,).addProject(
      "file:///fragment.tji",
    );

    assertEquals(called, false,);
    assertEquals(result.ok, false,);
  });

  it("turns an add exception into a structured failure", async () => {
    const port = fakePort({
      addProject: () => Promise.reject(new Error("read failed",),),
    },);
    const result = await new ProjectService(port,).addProject(first.uri,);

    assertEquals(result, {
      ok: false,
      error: "read failed",
      messages: [],
    },);
  });

  it("removes an existing project and returns null", async () => {
    const result = await new ProjectService(fakePort(),).removeProject(
      first.uri,
    );

    assertEquals(result, { ok: true, value: null, messages: [], },);
  });

  it("reports a missing removal as a structured failure", async () => {
    const result = await new ProjectService(
      fakePort({ removeProject: () => Promise.resolve(false,), },),
    ).removeProject(first.uri,);

    assertEquals(result.ok, false,);
  });

  it("turns a removal exception into a structured failure", async () => {
    const result = await new ProjectService(
      fakePort({
        removeProject: () => Promise.reject(new Error("persist failed",),),
      },),
    ).removeProject(first.uri,);

    assertEquals(result, {
      ok: false,
      error: "persist failed",
      messages: [],
    },);
  });

  it("lists project summaries", async () => {
    const result = await new ProjectService(fakePort(),).listProjects();

    assertEquals(result, { ok: true, value: summaries, messages: [], },);
  });

  it("turns a synchronous list exception into a structured failure", async () => {
    const result = await new ProjectService(
      fakePort({
        listProjects: () => {
          throw new Error("cache failed",);
        },
      },),
    ).listProjects();

    assertEquals(result, { ok: false, error: "cache failed", messages: [], },);
  });

  it("selects an active project and returns its envelope messages", async () => {
    const result = await new ProjectService(fakePort(),).setActiveProject(
      second.uri,
    );

    assertEquals(result, { ok: true, value: second, messages: [], },);
  });

  it("awaits asynchronous active selection before returning its model", async () => {
    let resolve!: (model: ProjectModel | undefined,) => void;
    const pending = new Promise<ProjectModel | undefined>((done,) => {
      resolve = done;
    },);
    const result = new ProjectService(fakePort({
      setActiveProject: () => pending,
    },),).setActiveProject(second.uri,);
    let settled = false;
    void result.then(() => {
      settled = true;
    },);

    await Promise.resolve();
    assertEquals(settled, false,);
    resolve(second,);
    assertEquals(await result, { ok: true, value: second, messages: [], },);
  });

  it("reports an unknown active project as a structured failure", async () => {
    const result = await new ProjectService(
      fakePort({ setActiveProject: () => undefined, },),
    ).setActiveProject("file:///missing.smx",);

    assertEquals(result.ok, false,);
  });

  it("turns a synchronous selection exception into a structured failure", async () => {
    const result = await new ProjectService(
      fakePort({
        setActiveProject: () => {
          throw new Error("selection failed",);
        },
      },),
    ).setActiveProject(second.uri,);

    assertEquals(result, {
      ok: false,
      error: "selection failed",
      messages: [],
    },);
  });
});

describe("ProjectService project resolution", () => {
  it("prefers an explicit master over active and ambiguous registry state", () => {
    const service = new ProjectService(fakePort({
      listProjects:
        () => [...summaries, { ...summaries[0]!, uri: second.uri, },],
    },),);

    assertEquals(service.resolveProject(second.uri,), {
      ok: true,
      value: second.uri,
      messages: [],
    },);
  });

  it("does not consult lower-priority registry state for an explicit master", () => {
    const service = new ProjectService(fakePort({
      activeProject: () => {
        throw new Error("active registry failed",);
      },
      listProjects: () => {
        throw new Error("project list failed",);
      },
    },),);

    assertEquals(service.resolveProject(second.uri,), {
      ok: true,
      value: second.uri,
      messages: [],
    },);
  });

  it("uses the active registry project when no explicit master is supplied", () => {
    const service = new ProjectService(fakePort({
      listProjects:
        () => [...summaries, { ...summaries[0]!, uri: second.uri, },],
    },),);

    assertEquals(service.resolveProject(), {
      ok: true,
      value: first.uri,
      messages: [],
    },);
  });

  it("does not consult the project list when an active master is available", () => {
    const service = new ProjectService(fakePort({
      listProjects: () => {
        throw new Error("project list failed",);
      },
    },),);

    assertEquals(service.resolveProject(), {
      ok: true,
      value: first.uri,
      messages: [],
    },);
  });

  it("uses the only loaded project when there is no active selection", () => {
    const service = new ProjectService(fakePort({
      activeProject: () => undefined,
      listProjects: () => [{ ...summaries[0]!, uri: second.uri, },],
    },),);

    assertEquals(service.resolveProject(), {
      ok: true,
      value: second.uri,
      messages: [],
    },);
  });

  it("rejects ambiguous loaded projects without an explicit selection", () => {
    const service = new ProjectService(fakePort({
      activeProject: () => undefined,
      listProjects:
        () => [...summaries, { ...summaries[0]!, uri: second.uri, },],
    },),);

    assertEquals(service.resolveProject(), {
      ok: false,
      error: "multiple projects loaded; select a project explicitly",
      messages: [],
    },);
  });

  it("rejects an empty project registry", () => {
    const service = new ProjectService(fakePort({
      activeProject: () => undefined,
      listProjects: () => [],
    },),);

    assertEquals(service.resolveProject(), {
      ok: false,
      error: "no project master selected",
      messages: [],
    },);
  });

  it("does not fall through when an explicit master is invalid", () => {
    const service = new ProjectService(fakePort(),);

    assertEquals(service.resolveProject("file:///fragment.tji",), {
      ok: false,
      error: "invalid project master URI: file:///fragment.tji",
      messages: [],
    },);
  });

  it("turns synchronous registry failures into structured resolution failures", () => {
    const service = new ProjectService(fakePort({
      activeProject: () => {
        throw new Error("registry failed",);
      },
    },),);

    assertEquals(service.resolveProject(), {
      ok: false,
      error: "registry failed",
      messages: [],
    },);
  });
});
