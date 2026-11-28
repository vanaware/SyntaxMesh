/**
 * Project-free manual command regressions (22.12.12). Text/SMX stay in memory
 * unless given a file target; HTML dispatches its complete file map through the
 * shared confirmed output host.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertStrictEquals, } from "@std/assert";
import type {
  ExecutionOptionsEcho,
  ExecutionRequest,
  ExecutionResult,
  ExecutionResults,
} from "@vanaware/syntaxmesh";
import { OutputHost, type Tj3HostIo, } from "../../src/cli/output-host.ts";
import { PUBLIC_COMMAND_IDS, } from "../../src/commands/contracts.ts";
import { executeMan, type ManCommandPort, } from "../../src/commands/manual.ts";

const ROOT = "file:///workspace/";
const MANUAL_TARGET = "file:///workspace/manual/";

/** Resolves a relative path under a directory URI. */
function under(root: string, path: string,): string {
  return new URL(path, `${root.replace(/\/$/, "",)}/`,).toString();
}

/** Complete options echo for a project-free manual request. */
function manualOptions(request: ExecutionRequest,): ExecutionOptionsEcho {
  return {
    entry: "",
    files: [],
    configContent: null,
    checkSyntax: false,
    listReports: null,
    listReportsIsRegex: true,
    report: null,
    reportsIsRegex: false,
    dynamicAttributes: null,
    outputDir: request.outputDir ?? null,
    noReports: false,
    forceReports: false,
    abortOnWarnings: false,
    warnTsDeltas: false,
    addTrace: false,
    freeze: null,
    help: false,
    version: false,
    man: request.man ?? null,
    app: null,
    appOptions: null,
  };
}

/** Successful manual envelope with no project files. */
function manualEnvelope(
  request: ExecutionRequest,
  results: ExecutionResults,
): ExecutionResult {
  return {
    ok: true,
    exitCode: 0,
    options: manualOptions(request,),
    messages: [],
    results,
  };
}

/** Records requests and returns one predetermined envelope. */
function recordingExecute(result: ExecutionResult,): {
  execute: ManCommandPort["execute"];
  requests: ExecutionRequest[];
} {
  const requests: ExecutionRequest[] = [];
  const execute: ManCommandPort["execute"] = (request: ExecutionRequest,) => {
    requests.push(request,);
    return Promise.resolve(result,);
  };
  return { execute, requests, };
}

interface FakeOutputOptions {
  existing?: string[];
  confirm?: boolean;
  failWriteAt?: number;
}

/** In-memory output host exercising real preflight and write behavior. */
function fakeOutput(options: FakeOutputOptions = {},) {
  const writes: Array<{ path: string; content: string }> = [];
  const confirmations: string[][] = [];
  const files = new Map<string, string>();
  for (const path of options.existing ?? []) files.set(path, "old",);

  const io: Tj3HostIo = {
    resolve(path: string, root?: string,): string {
      if (path === "") return root ?? ROOT;
      if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(path,)) {
        return new URL(path,).toString();
      }
      return under(root ?? ROOT, path,);
    },
    print(_text: string,): void {},
    write(path: string, content: string,): Promise<void> {
      writes.push({ path, content, },);
      if (options.failWriteAt === writes.length) {
        throw new Error("write denied",);
      }
      files.set(path, content,);
      return Promise.resolve();
    },
    mkpath(_dir: string,): Promise<void> {
      return Promise.resolve();
    },
    copy(_from: string, _to: string,): Promise<void> {
      throw new Error("manual output must not copy assets",);
    },
    listDir(_path: string,): Promise<string[]> {
      return Promise.resolve([],);
    },
    isDir(_path: string,): Promise<boolean> {
      return Promise.resolve(false,);
    },
    exists(path: string,): Promise<boolean> {
      return Promise.resolve(files.has(path,),);
    },
  };
  const output = new OutputHost(io, {
    cwd: ROOT,
    confirmOverwrite: (paths,) => {
      confirmations.push([...paths,],);
      return Promise.resolve(options.confirm ?? true,);
    },
  },);
  return { output, writes, confirmations, files, };
}

describe("manual command service (22.12.12)", () => {
  it("defaults to project-free text stdout", async () => {
    const request: ExecutionRequest = { man: { format: "text", }, };
    const execution = manualEnvelope(request, {
      man: {
        format: "text",
        keywords: [],
        content: "SyntaxMesh manual\n",
        files: [],
      },
    },);
    const { execute, requests, } = recordingExecute(execution,);
    const { output, writes, } = fakeOutput();

    const result = await executeMan({}, { execute, output, },);

    assert(result.ok,);
    assertStrictEquals(result.value.execution, execution,);
    assertEquals(result.value.stdout, "SyntaxMesh manual\n",);
    assertEquals(result.value.artifacts, [],);
    assertEquals(requests, [request,],);
    assertEquals(writes, [],);
  });

  it("forwards SMX, keywords and color without opening a project", async () => {
    const request: ExecutionRequest = {
      man: { format: "smx", keywords: ["task", "resource",], color: true, },
    };
    const execution = manualEnvelope(request, {
      man: {
        format: "smx",
        keywords: ["task", "resource",],
        content: "task example\n",
        files: [],
      },
    },);
    const { execute, requests, } = recordingExecute(execution,);
    const { output, } = fakeOutput();

    const result = await executeMan({
      format: "smx",
      keywords: ["task", "resource",],
      color: true,
    }, { execute, output, },);

    assert(result.ok,);
    assertEquals(result.value.stdout, "task example\n",);
    assertEquals(requests, [request,],);
  });

  it("writes explicit text output as one confirmed manual artifact", async () => {
    const request: ExecutionRequest = { man: { format: "text", }, };
    const execution = manualEnvelope(request, {
      man: { format: "text", keywords: [], content: "manual text", files: [], },
    },);
    const { execute, } = recordingExecute(execution,);
    const { output, writes, } = fakeOutput();
    const target = "file:///workspace/manual.txt";

    const result = await executeMan({ targetUri: target, }, {
      execute,
      output,
    },);

    assert(result.ok,);
    assertEquals(writes, [{ path: target, content: "manual text", },],);
    assertEquals(result.value.stdout, "",);
    assertEquals(result.value.artifacts, [{
      uri: target,
      fileName: "manual.txt",
      kind: "manual",
    },],);
  });

  it("denies an existing text destination before any real write", async () => {
    const request: ExecutionRequest = { man: { format: "text", }, };
    const execution = manualEnvelope(request, {
      man: { format: "text", keywords: [], content: "new", files: [], },
    },);
    const { execute, } = recordingExecute(execution,);
    const target = "file:///workspace/manual.txt";
    const { output, writes, confirmations, } = fakeOutput({
      existing: [target,],
      confirm: false,
    },);

    const result = await executeMan({ targetUri: target, }, {
      execute,
      output,
    },);

    assertEquals(result.ok, false,);
    assertEquals(writes, [],);
    assertEquals(confirmations, [[target,],],);
  });

  it("dispatches HTML files under the explicit directory and returns manual artifacts", async () => {
    const request: ExecutionRequest = {
      man: { format: "html", },
      outputDir: MANUAL_TARGET,
    };
    const execution = manualEnvelope(request, {
      man: {
        format: "html",
        keywords: [],
        content: "",
        files: [
          { name: "index.html", contents: "<html>manual</html>", },
          { name: "css/tjmanual.css", contents: "body {}", },
        ],
      },
    },);
    const { execute, requests, } = recordingExecute(execution,);
    const { output, writes, } = fakeOutput();

    const result = await executeMan({
      format: "html",
      targetUri: MANUAL_TARGET,
    }, { execute, output, },);

    assert(result.ok,);
    assertEquals(requests, [request,],);
    assertEquals(writes, [
      {
        path: under(MANUAL_TARGET, "index.html",),
        content: "<html>manual</html>",
      },
      { path: under(MANUAL_TARGET, "css/tjmanual.css",), content: "body {}", },
    ],);
    assertEquals(result.value.stdout, "",);
    assertEquals(result.value.artifacts, [
      {
        uri: under(MANUAL_TARGET, "index.html",),
        fileName: "index.html",
        kind: "manual",
      },
      {
        uri: under(MANUAL_TARGET, "css/tjmanual.css",),
        fileName: "tjmanual.css",
        kind: "manual",
      },
    ],);
  });

  it("rejects the stale tjp format before execution", async () => {
    const execution = manualEnvelope({ man: { format: "text", }, }, {
      man: { format: "text", keywords: [], content: "unused", files: [], },
    },);
    const { execute, requests, } = recordingExecute(execution,);
    const { output, writes, } = fakeOutput();

    const result = await executeMan({
      format: "tjp" as "text",
    }, { execute, output, },);

    assertEquals(result.ok, false,);
    if (result.ok) return;
    assert(result.error.includes("tjp",),);
    assertEquals(requests, [],);
    assertEquals(writes, [],);
  });

  it("requires an explicit HTML directory from the pure service", async () => {
    const execution = manualEnvelope({ man: { format: "html", }, }, {
      man: { format: "html", keywords: [], content: "", files: [], },
    },);
    const { execute, requests, } = recordingExecute(execution,);
    const { output, } = fakeOutput();

    const result = await executeMan({ format: "html", }, { execute, output, },);

    assertEquals(result.ok, false,);
    assertEquals(requests, [],);
  });

  it("returns failed execution messages without writing output", async () => {
    const request: ExecutionRequest = { man: { format: "text", }, };
    const execution: ExecutionResult = {
      ...manualEnvelope(request, {},),
      ok: false,
      exitCode: 1,
      messages: [{
        severity: "error",
        id: "manual_failed",
        text: "manual failed",
        file: null,
        line: null,
      },],
    };
    const { execute, } = recordingExecute(execution,);
    const { output, writes, } = fakeOutput();

    const result = await executeMan({
      targetUri: "file:///workspace/manual.txt",
    }, { execute, output, },);

    assertEquals(result.ok, false,);
    assertEquals(result.messages, execution.messages,);
    assertEquals(writes, [],);
  });

  it("contributes the semantic manual command", () => {
    const manifest = JSON.parse(
      Deno.readTextFileSync(new URL("../../package.json", import.meta.url,),),
    ) as { contributes: { commands: { command: string }[] } };
    const declared = new Set(
      manifest.contributes.commands.map((command,) => command.command),
    );

    assert(
      (PUBLIC_COMMAND_IDS as readonly string[]).includes("syntaxmesh.man",),
    );
    assert(declared.has("syntaxmesh.man",),);
  });
});
