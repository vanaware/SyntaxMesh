import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";
import { PropertySet, } from "../../src/model/property-set.ts";
import { MockProject, } from "../model/mock-project.ts";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { type PropertyLike, } from "../../src/model/property-like.ts";
import { type AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { type AttributeContainer, } from "../../src/attributes/attribute-container.ts";

function makeMockAttrClass(defaultValue: unknown,) {
  return class MockAttribute extends AttributeBase<unknown> {
    constructor(
      property: PropertyLike,
      type: AttributeDefinition<unknown>,
      container: AttributeContainer,
    ) {
      super(property, type, container,);
    }
    override set(value: unknown,) {
      super.set(value as never,);
    }
    override get() {
      return this._value;
    }
  };
}

function makeMockScenarioAttrClass(defaultValue: unknown,) {
  return class MockScenarioAttribute extends AttributeBase<unknown> {
    constructor(
      property: PropertyLike,
      type: AttributeDefinition<unknown>,
      container: AttributeContainer,
    ) {
      super(property, type, container,);
    }
    override set(value: unknown,) {
      super.set(value as never,);
    }
    override get() {
      return this._value;
    }
  };
}

interface GoldenCase {
  description: string;
  method: string;
  type: string;
  input: {
    value: unknown;
    mode?: 0 | 1 | 2;
    inherit?: boolean;
    withoutSelf?: boolean;
    scenarioIdx?: number;
  } | null;
  expected: unknown;
  mode?: 0 | 1 | 2;
  inherit?: boolean;
  withoutSelf?: boolean;
  scenarioIdx?: number;
  node?: string;
  target?: string;
  adopter?: string;
  attr?: string;
}

interface GoldenFile {
  version: string;
  description: string;
  generated_at: string;
  cases: GoldenCase[];
}

function loadGoldenFile(): GoldenFile {
  const path = new URL("./property-tree.golden.json", import.meta.url,);
  const content = Deno.readTextFileSync(path,);
  const data = JSON.parse(content,) as GoldenFile;
  return data;
}

function getGroup(c: GoldenCase,): string {
  if (c.description.includes("namespace plano",)) return "flat";
  if (c.description.includes("cenario",)) return "scenario";
  if (c.description.includes("adoção",)) return "adoption";
  if (
    c.description.includes("status após",) ||
    c.description.includes("priority após",) ||
    c.description.includes("modificação no backup",)
  ) return "backup";
  if (
    c.description.includes("herança",) || c.description.includes("provided",) ||
    c.description.includes("inherited",) ||
    c.description.includes("modified",) ||
    c.description.includes("sobrescreve",)
  ) return "inheritance";
  return "structure";
}

function getNode(
  nodes: Map<string, PropertyTreeNode>,
  c: GoldenCase,
): PropertyTreeNode {
  const nodeName = c.node || "gc";
  const node = nodes.get(nodeName,);
  if (!node) {
    throw new Error(
      `Node "${nodeName}" not found for case "${c.description}"`,
    );
  }
  return node;
}

// Shared state for sequential groups
let inheritanceState: {
  root: PropertyTreeNode;
  child: PropertyTreeNode;
  gc: PropertyTreeNode;
  phase: 0 | 1;
} | null = null;
let backupState: {
  root: PropertyTreeNode;
  backup: [
    Map<string, AttributeBase<unknown>>,
    Array<Map<string, AttributeBase<unknown>>>,
  ];
  phase: number;
} | null = null;

function setupInheritance(phase: 0 | 1,) {
  if (inheritanceState && inheritanceState.phase >= phase) return;
  const project = new MockProject(1,);
  const propertySet = new PropertySet(project, false,);
  propertySet.addAttributeType({
    id: "priority",
    name: "Priority",
    objClass: makeMockAttrClass(500,),
    inheritedFromParent: true,
    inheritedFromProject: false,
    defaultValue: 500,
    type: AttributeType.Integer,
    userDefined: false,
    isList: false,
    isSingleton: false,
    isScenarioAttribute: false,
  },);
  const root = new PropertyTreeNode(propertySet, "root", "Root", null,);
  const child = new PropertyTreeNode(propertySet, "child", "Child", root,);
  const gc = new PropertyTreeNode(propertySet, "gc", "Grandchild", child,);
  root.set("priority", 100,);
  child.inheritAttributes();
  gc.inheritAttributes();
  if (phase === 1) {
    child.set("priority", 200,);
    gc.inheritAttributes();
  }
  inheritanceState = { root, child, gc, phase, };
}

function setupBackup(phase: 0 | 1 | 2,) {
  if (backupState && backupState.phase >= phase) return;
  if (!backupState) {
    const project = new MockProject(1,);
    const propertySet = new PropertySet(project, false,);
    // Add both attribute types before root creation (TS auto-adds to PropertySet,
    // unlike Ruby which requires addProperty to be called manually).
    propertySet.addAttributeType({
      id: "status",
      name: "Status",
      objClass: makeMockAttrClass("active",),
      inheritedFromParent: false,
      inheritedFromProject: false,
      defaultValue: "active",
      type: AttributeType.String,
      userDefined: false,
      isList: false,
      isSingleton: false,
      isScenarioAttribute: false,
    },);
    propertySet.addAttributeType({
      id: "priority",
      name: "Priority",
      objClass: makeMockAttrClass(500,),
      inheritedFromParent: false,
      inheritedFromProject: false,
      defaultValue: 500,
      type: AttributeType.Integer,
      userDefined: false,
      isList: false,
      isSingleton: false,
      isScenarioAttribute: false,
    },);
    const root = new PropertyTreeNode(propertySet, "root", "Root", null,);
    root.set("status", "in_progress",);
    const backup = root.backupAttributes();
    // Set priority AFTER backup, matching Ruby script behavior
    root.set("priority", 100,);
    backupState = { root, backup, phase: 0, };
  }
  if (phase >= 1 && backupState.phase < 1) {
    backupState.root.restoreAttributes(backupState.backup,);
    backupState.phase = 1;
  }
  if (phase >= 2 && backupState.phase < 2) {
    backupState.backup[0].get("status",)!.set("modified",);
    backupState.phase = 2;
  }
}

function runCase(c: GoldenCase,): void {
  const group = getGroup(c,);
  const nodeName = c.node || "gc";

  let project: MockProject;
  let propertySet: PropertySet;
  const nodes: Map<string, PropertyTreeNode> = new Map();

  switch (group) {
    case "structure": {
      project = new MockProject(1,);
      propertySet = new PropertySet(project, false,);
      const root = new PropertyTreeNode(propertySet, "root", "Root", null,);
      const child = new PropertyTreeNode(propertySet, "child", "Child", root,);
      const gc = new PropertyTreeNode(propertySet, "gc", "Grandchild", child,);
      nodes.set("root", root,);
      nodes.set("child", child,);
      nodes.set("gc", gc,);
      break;
    }
    case "inheritance": {
      const phase = c.description.includes("herança do root para",) ? 0 : 1;
      setupInheritance(phase,);
      const s = inheritanceState!;
      nodes.set("root", s.root,);
      nodes.set("child", s.child,);
      nodes.set("gc", s.gc,);
      break;
    }
    case "scenario": {
      project = new MockProject(2,);
      propertySet = new PropertySet(project, false,);
      propertySet.addAttributeType({
        id: "effort",
        name: "Effort",
        objClass: makeMockScenarioAttrClass(0,),
        inheritedFromParent: false,
        inheritedFromProject: false,
        defaultValue: 0,
        type: AttributeType.Integer,
        userDefined: false,
        isList: false,
        isSingleton: false,
        isScenarioAttribute: true,
      },);
      const root = new PropertyTreeNode(propertySet, "root", "Root", null,);
      root.setForScenario("effort", 3600, 0,);
      root.setForScenario("effort", 7200, 1,);
      nodes.set("root", root,);
      break;
    }
    case "adoption": {
      project = new MockProject(1,);
      propertySet = new PropertySet(project, false,);
      const root1 = new PropertyTreeNode(propertySet, "root1", "Root 1", null,);
      const root2 = new PropertyTreeNode(propertySet, "root2", "Root 2", null,);
      const task = new PropertyTreeNode(propertySet, "task", "Task", root1,);
      root2.adopt(task,);
      nodes.set("root1", root1,);
      nodes.set("root2", root2,);
      nodes.set("task", task,);
      break;
    }
    case "backup": {
      const phase = c.description.includes("modificação no backup",) ?
        2 :
        c.description.includes("restore",)
        ? 1
        : 0;
      setupBackup(phase,);
      const s = backupState!;
      nodes.set("root", s.root,);
      (s.root as any).backup = s.backup;
      break;
    }
    case "flat": {
      project = new MockProject(1,);
      propertySet = new PropertySet(project, true,);
      const root = new PropertyTreeNode(propertySet, "root", "Root", null,);
      const child = new PropertyTreeNode(propertySet, "child", "Child", root,);
      nodes.set("root", root,);
      nodes.set("child", child,);
      break;
    }
    default:
      throw new Error(`Unknown group: ${group}`,);
  }

  const node = getNode(nodes, c,);

  switch (c.method) {
    case "fullId": {
      const actual = node.fullId;
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "level": {
      const actual = node.level;
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "getBSIndicies": {
      const actual = node.getBSIndicies();
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "all": {
      const actual = node.all();
      assertEquals(
        actual.map((p,) => p.fullId),
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "allLeaves": {
      const actual = node.allLeaves(c.input?.withoutSelf || false,);
      assertEquals(
        actual.map((p,) => p.fullId),
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "isChildOf": {
      const target = nodes.get(c.target || "child",)!;
      const actual = node.isChildOf(target,);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "leaf": {
      const actual = node.leaf();
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "container": {
      const actual = node.container();
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "kids": {
      const actual = node.kids();
      assertEquals(
        actual.map((p,) => p.fullId),
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "parents": {
      const actual = node.parents();
      assertEquals(
        actual.map((p,) => p.fullId),
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "root": {
      const actual = node.root();
      assertEquals(
        actual.fullId,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "ancestors": {
      const actual = node.ancestors();
      assertEquals(
        actual.map((p,) => p.fullId),
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "logicalId": {
      const actual = node.logicalId();
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "provided": {
      const actual = node.provided(c.attr || "priority", c.input?.scenarioIdx,);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "inherited": {
      const actual = node.inherited(
        c.attr || "priority",
        c.input?.scenarioIdx,
      );
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "modified": {
      const actual = node.modified("priority",);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "get": {
      const attrId = c.attr || "priority";
      const actual = node.get(attrId,);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "getForScenario": {
      assertEquals(
        node.getForScenario("effort", c.input?.scenarioIdx || 0,),
        c.expected,
        `Golden case "${c.description}" failed`,
      );
      break;
    }
    case "stepParents": {
      const actual = node.stepParents;
      assertEquals(
        actual.map((p,) => p.fullId),
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "adoptees": {
      const actual = node.adoptees;
      assertEquals(
        actual.map((p,) => p.fullId),
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "status": {
      const actual = node.get("status",);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "priority": {
      const actual = node.get("priority",);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "adopt": {
      const adopter = nodes.get(c.adopter || node.id,);
      assertThrows(() => {
        adopter!.adopt(node,);
      },);
      break;
    }
    default:
      throw new Error(`Unknown method in golden file: ${c.method}`,);
  }
}

describe("PropertyTreeNode golden tests", () => {
  const golden = loadGoldenFile();

  for (const c of golden.cases) {
    it(`${c.method}: ${c.description}`, () => {
      runCase(c,);
    });
  }
});
