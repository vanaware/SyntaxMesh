/**
 * Unit tests of the pure multi-project tree projection (22.12.17). BDD +
 * `@std/assert`, no `vscode` runtime — plain {@link ProjectModel} fixtures stand
 * in for the daemon cache and its report inventory.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import type {
  ExecutionOptionsEcho,
  ExecutionResult,
  ListReportsEntry,
} from "@vanaware/syntaxmesh";
import type { ProjectIntent, ProjectModel, } from "../../src/daemon/types.ts";
import {
  treeChildren,
  treeItem,
  type TreeNode,
} from "../../src/views/project-tree.ts";

/** A project with a nested task, a resource, an account, a shift and a report. */
const TEXT = `project prj "Probe" "1.0" 2026-01-01 - 2026-12-31 {
}
resource dev "Dev" {
}
account acc "Account" {
}
shift work "Work" {
}
task outer "Outer" {
  task inner "Inner" {
  }
}
taskreport rep "Report" {
}
`;

/** Complete option echo used by cached inventory envelopes. */
const ECHO: ExecutionOptionsEcho = {
  entry: "master.tjp",
  files: ["master.tjp",],
  configContent: null,
  checkSyntax: false,
  listReports: ".",
  listReportsIsRegex: false,
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

/** Builds a cached inventory envelope without involving the execution engine. */
function envelope(reports: ListReportsEntry[],): ExecutionResult {
  return {
    ok: true,
    exitCode: 0,
    options: ECHO,
    messages: [],
    results: { listReports: reports, },
  };
}

interface ModelOptions {
  text?: string;
  reports?: ListReportsEntry[];
  status?: ProjectModel["status"];
  intent?: ProjectIntent;
}

/** Builds a cached model whose closure is a single master file. */
function model(uri: string, options: ModelOptions = {},): ProjectModel {
  const lastExecution = options.intent === undefined ? undefined : {
    intent: options.intent,
    startedAt: 1,
    finishedAt: 2,
    errorCount: 0,
  };
  return {
    uri,
    entry: "master.tjp",
    files: [{ path: "master.tjp", content: options.text ?? TEXT, },],
    envelope: envelope(options.reports ?? [],),
    status: options.status ?? "ok",
    addedAt: 0,
    reloadedAt: 0,
    ...(lastExecution === undefined ? {} : { lastExecution, }),
  };
}

/** Finds a project's root category by id (throws when absent). */
function category(root: TreeNode, id: string,): TreeNode {
  const found = root.children.find((node,) => node.id === `${root.id}/${id}`);
  if (found === undefined) throw new Error(`missing category: ${id}`,);
  return found;
}

/** Flattens a projected tree in display order. */
function flatten(nodes: TreeNode[],): TreeNode[] {
  return nodes.flatMap((node,) => [node, ...flatten(node.children,),]);
}

describe("project-tree (22.12.17)", () => {
  it("projects one root per loaded project with the five categories", () => {
    const first = model("file:///first/master.tjp",);
    const second = model("file:///second/master.tjp",);
    const roots = treeChildren([first, second,], null,);

    assertEquals(roots.map((node,) => node.id), [
      `project:${first.uri}`,
      `project:${second.uri}`,
    ],);
    for (const root of roots) {
      assertEquals(root.kind, "project",);
      assertEquals(root.contextValue, "project",);
      assertEquals(root.children.map((node,) => node.id), [
        `${root.id}/tasks`,
        `${root.id}/resources`,
        `${root.id}/accounts`,
        `${root.id}/shifts`,
        `${root.id}/reports`,
      ],);
      assertEquals(root.children.map((node,) => node.label), [
        "Tasks",
        "Resources",
        "Accounts",
        "Shifts",
        "Reports",
      ],);
    }
  });

  it("prefixes every descendant id and keeps duplicate entity names unique", () => {
    const first = model("file:///first/master.tjp", {
      reports: [{ name: "overview", type: "taskreport", },],
    },);
    const second = model("file:///second/master.tjp", {
      reports: [{ name: "overview", type: "taskreport", },],
    },);
    const nodes = flatten(treeChildren([first, second,], null,),);
    const ids = nodes.map((node,) => node.id);

    assertEquals(new Set(ids,).size, ids.length,);
    assertEquals(
      [...new Set(nodes.map((node,) => node.kind),),].sort(),
      ["category", "entity", "project", "report",],
    );
    for (const node of nodes) {
      const rootId = `project:${node.projectUri}`;
      assertEquals(
        node.id === rootId || node.id.startsWith(`${rootId}/`,),
        true,
      );
      assertEquals(node.contextValue, node.kind,);
    }
  });

  it("marks the explicit active root and projects status and last intent", () => {
    const loading = model("file:///loading/master.tjp", {
      status: "loading",
    },);
    const active = model("file:///active/master.tjp", {
      status: "error",
      intent: "compile",
    },);
    const ready = model("file:///ready/master.tjp", {
      status: "ok",
      intent: "report",
    },);
    const roots = treeChildren([loading, active, ready,], active.uri,);

    assertEquals(roots.map((node,) => node.icon), [
      "loading~spin",
      "error",
      "check",
    ],);
    assertEquals(roots.map((node,) => node.description), [
      "inventory",
      "Active · compile",
      "report",
    ],);
  });

  it("populates category children with the prefixed entity hierarchy", () => {
    const project = model("file:///prj/master.tjp",);
    const root = treeChildren([project,], null,)[0]!;
    const tasks = category(root, "tasks",);

    assertEquals(tasks.kind, "category",);
    assertEquals(tasks.projectUri, project.uri,);
    assertEquals(tasks.children.length, 1,);
    const outer = tasks.children[0]!;
    assertEquals(outer.kind, "entity",);
    assertEquals(outer.contextValue, "entity",);
    assertEquals(outer.id, `${root.id}/tasks/outer`,);
    assertEquals(outer.description, "Outer",);
    assertEquals(outer.children.length, 1,);
    assertEquals(outer.children[0]!.id, `${root.id}/tasks/outer.inner`,);
    const resources = category(root, "resources",);
    assertEquals(resources.children.map((node,) => node.id), [
      `${root.id}/resources/dev`,
    ],);
    assertEquals(treeItem(outer,), {
      label: "outer",
      description: "Outer",
      icon: "list-tree",
      collapsibleState: "collapsed",
    },);
  });

  it("sources report leaves from cached inventory with open commands", () => {
    const uri = "file:///prj/master.tjp";
    const project = model(uri, {
      reports: [
        { name: "overview", type: "taskreport", },
        { name: "resourceOverview", type: "resourcereport", },
      ],
    },);
    const root = treeChildren([project,], null,)[0]!;
    const reports = category(root, "reports",);

    assertEquals(reports.children, [
      {
        id: `${root.id}/reports/overview`,
        label: "overview",
        description: "taskreport",
        icon: "graph",
        collapsibleState: "none",
        children: [],
        kind: "report",
        projectUri: uri,
        reportId: "overview",
        contextValue: "report",
        command: "syntaxmesh.report.open",
        commandArgs: [uri, "overview",],
      },
      {
        id: `${root.id}/reports/resourceOverview`,
        label: "resourceOverview",
        description: "resourcereport",
        icon: "graph",
        collapsibleState: "none",
        children: [],
        kind: "report",
        projectUri: uri,
        reportId: "resourceOverview",
        contextValue: "report",
        command: "syntaxmesh.report.open",
        commandArgs: [uri, "resourceOverview",],
      },
    ],);
  });

  it("uses canonical report ids for commands while displaying report names", () => {
    const uri = "file:///prj/master.tjp";
    const reports: Array<ListReportsEntry & { id: string }> = [
      { id: "full", name: "Project TJP", type: "export", },
    ];
    const project = model(uri, { reports, },);
    const root = treeChildren([project,], null,)[0]!;
    const report = category(root, "reports",).children[0]!;

    assertEquals(report.label, "Project TJP",);
    assertEquals(report.reportId, "full",);
    assertEquals(report.commandArgs, [uri, "full",],);
  });

  it("assigns project commands only to project roots", () => {
    const project = model("file:///prj/master.tjp", {
      reports: [{ name: "overview", type: "taskreport", },],
    },);
    const root = treeChildren([project,], null,)[0]!;

    assertEquals(root.kind, "project",);
    assertEquals(root.contextValue, "project",);
    assertEquals(root.command, "syntaxmesh.project.setActive",);
    assertEquals(root.commandArgs, [project.uri,],);
    for (const node of flatten(root.children,)) {
      if (node.kind === "report") continue;
      assertEquals(node.command, undefined,);
      assertEquals(node.commandArgs, undefined,);
    }
  });

  it("keeps loaded project roots navigable when no entities parse", () => {
    const project = model("file:///broken/master.tjp", { text: "task", },);
    const roots = treeChildren([project,], null,);

    assertEquals(roots.length, 1,);
    assertEquals(roots[0]!.children.length, 5,);
    assertEquals(
      roots[0]!.children.every((node,) => node.children.length === 0),
      true,
    );
    assertEquals(
      treeChildren([{ ...project, files: [], },], null,)[0]!.children.length,
      5,
    );
    assertEquals(treeChildren([], null,), [],);
  });
});
