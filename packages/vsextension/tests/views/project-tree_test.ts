/**
 * Unit tests of the pure project-tree projection (22.7.2). BDD + `@std/assert`,
 * no `vscode` runtime — a plain {@link ProjectModel} with cached file content
 * stands in for the daemon, and the projection reuses the pure LSP symbols.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import type { ProjectModel, } from "../../src/daemon/types.ts";
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

/** Builds a cached model whose closure is a single master file. */
function model(text: string,): ProjectModel {
  return {
    uri: "file:///prj/master.tjp",
    entry: "master.tjp",
    files: [{ path: "master.tjp", content: text, },],
    envelope: null,
    status: "ok",
    addedAt: 0,
    reloadedAt: 0,
  };
}

/** Finds a root category by id (throws when absent). */
function category(nodes: TreeNode[], id: string,): TreeNode {
  const found = nodes.find((n,) => n.id === id);
  if (found === undefined) throw new Error(`missing category: ${id}`,);
  return found;
}

describe("project-tree (22.7.2)", () => {
  it("projects the five root categories in display order", () => {
    const nodes = treeChildren(model(TEXT,),);
    assertEquals(
      nodes.map((n,) => n.id),
      ["tasks", "resources", "accounts", "shifts", "reports",],
    );
    assertEquals(
      nodes.map((n,) => n.label),
      ["Tasks", "Resources", "Accounts", "Shifts", "Reports",],
    );
  });

  it("populates category children with the entity hierarchy", () => {
    const nodes = treeChildren(model(TEXT,),);
    const tasks = category(nodes, "tasks",);
    assertEquals(tasks.children.length, 1,);
    const outer = tasks.children[0]!;
    assertEquals(outer.id, "outer",);
    assertEquals(outer.description, "Outer",);
    assertEquals(outer.children.length, 1,);
    assertEquals(outer.children[0]!.id, "outer.inner",);
    const resources = category(nodes, "resources",);
    assertEquals(resources.children.map((n,) => n.id), ["dev",],);
  });

  it("emits icons and expansion state as data via treeItem", () => {
    const nodes = treeChildren(model(TEXT,),);
    assertEquals(category(nodes, "tasks",).icon, "list-tree",);
    assertEquals(category(nodes, "resources",).icon, "person",);
    assertEquals(category(nodes, "reports",).icon, "graph",);
    const outer = category(nodes, "tasks",).children[0]!;
    assertEquals(outer.collapsibleState, "collapsed",);
    assertEquals(outer.children[0]!.collapsibleState, "none",);
    assertEquals(treeItem(outer,), {
      label: "outer",
      description: "Outer",
      icon: "list-tree",
      collapsibleState: "collapsed",
    },);
  });

  it("returns an empty tree when the model has no parsed project", () => {
    assertEquals(treeChildren(model("task",),), [],);
    assertEquals(
      treeChildren({ ...model(TEXT,), files: [], },),
      [],
    );
  });
});
