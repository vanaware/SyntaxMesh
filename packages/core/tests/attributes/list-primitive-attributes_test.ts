import { describe, it, beforeEach, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition } from "../../src/attributes/attribute-definition.ts";
import { AttributeType } from "../../src/attributes/attribute-type.ts";
import { MockContainer } from "./mock-container.ts";
import { FlagListAttribute } from "../../src/attributes/list/flag-list-attribute.ts";
import { SymbolListAttribute } from "../../src/attributes/list/symbol-list-attribute.ts";
import { ScenarioListAttribute } from "../../src/attributes/list/scenario-list-attribute.ts";
import { NodeListAttribute } from "../../src/attributes/list/node-list-attribute.ts";
import { ResourceListAttribute } from "../../src/attributes/list/resource-list-attribute.ts";
import { TaskListAttribute } from "../../src/attributes/list/task-list-attribute.ts";
import { NotYetImplementedError } from "../../src/attributes/errors.ts";

class TestFlagListAttribute extends FlagListAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<string[]>, container: MockContainer) {
    super(property, type, container);
  }
}

class TestSymbolListAttribute extends SymbolListAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<string[]>, container: MockContainer) {
    super(property, type, container);
  }
}

class TestScenarioListAttribute extends ScenarioListAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<string[]>, container: MockContainer) {
    super(property, type, container);
  }
}

class TestNodeListAttribute extends NodeListAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<{ id: string; name: string; }[]>, container: MockContainer) {
    super(property, type, container);
  }
}

class TestResourceListAttribute extends ResourceListAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<{ id: string; name: string; project: unknown }[]>, container: MockContainer) {
    super(property, type, container);
  }
}

class TestTaskListAttribute extends TaskListAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<{ id: string; name: string; }[]>, container: MockContainer) {
    super(property, type, container);
  }
}

describe("ListPrimitiveAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string; };

  beforeEach(() => {
    AttributeBase.setMode(0);
    container = new MockContainer();
    property = { id: "test.attr", name: "Test Attr" };
  });

  describe("FlagListAttribute", () => {
    let type: AttributeDefinition<string[]>;
    let attr: TestFlagListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "flaglist",
        "Flag List",
        AttributeType.FlagList,
        [],
      );
      attr = new TestFlagListAttribute(property, type, container);
    });

    it("to_s", () => {
      attr.set(["a", "b", "c"]);
      assertEquals(attr.to_s(), "a, b, c");
    });

    it("to_tjp", () => {
      attr.set(["a", "b", "c"]);
      assertEquals(attr.to_tjp(), "flags a, b, c");
    });

    it("tjpId é 'flaglist'", () => {
      assertEquals(FlagListAttribute.tjpId, "flaglist");
    });
  });

  describe("SymbolListAttribute", () => {
    let type: AttributeDefinition<string[]>;
    let attr: TestSymbolListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "symbollist",
        "Symbol List",
        AttributeType.SymbolList,
        [],
      );
      attr = new TestSymbolListAttribute(property, type, container);
    });

    it("tjpId é 'symbollist'", () => {
      assertEquals(SymbolListAttribute.tjpId, "symbollist");
    });
  });

  describe("ScenarioListAttribute", () => {
    let type: AttributeDefinition<string[]>;
    let attr: TestScenarioListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "scenarios",
        "Scenarios",
        AttributeType.ScenarioList,
        [],
      );
      attr = new TestScenarioListAttribute(property, type, container);
    });

    it("to_s", () => {
      attr.set(["s1", "s2"]);
      assertEquals(attr.to_s(), "s1, s2");
    });

    it("tjpId é 'scenarios'", () => {
      assertEquals(ScenarioListAttribute.tjpId, "scenarios");
    });
  });

  describe("NodeListAttribute", () => {
    let type: AttributeDefinition<{ id: string; name: string; }[]>;
    let attr: TestNodeListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "node",
        "Node",
        AttributeType.NodeList,
        [],
      );
      attr = new TestNodeListAttribute(property, type, container);
    });

    it("to_s", () => {
      attr.set([{ id: "n1", name: "Node 1" }, { id: "n2", name: "Node 2" }]);
      assertEquals(attr.to_s(), "n1, n2");
    });
  });

  describe("ResourceListAttribute", () => {
    let type: AttributeDefinition<{ id: string; name: string; project: unknown }[]>;
    let attr: TestResourceListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "resourcelist",
        "Resource List",
        AttributeType.ResourceList,
        [],
      );
      attr = new TestResourceListAttribute(property, type, container);
    });

    it("to_s", () => {
      attr.set([{ id: "r1", name: "Resource 1", project: null }, { id: "r2", name: "Resource 2", project: null }]);
      assertEquals(attr.to_s(), "r1, r2");
    });

    it("tjpId é 'resourcelist'", () => {
      assertEquals(ResourceListAttribute.tjpId, "resourcelist");
    });

    it("to_rti lança NotYetImplementedError", () => {
      assertThrows(() => attr.to_rti(), NotYetImplementedError);
    });
  });

  describe("TaskListAttribute", () => {
    let type: AttributeDefinition<{ id: string; name: string; }[]>;
    let attr: TestTaskListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "tasklist",
        "Task List",
        AttributeType.TaskList,
        [],
      );
      attr = new TestTaskListAttribute(property, type, container);
    });

    it("to_s", () => {
      attr.set([{ id: "t1", name: "Task 1" }, { id: "t2", name: "Task 2" }]);
      assertEquals(attr.to_s(), "t1, t2");
    });

    it("to_tjp", () => {
      attr.set([{ id: "t1", name: "Task 1" }, { id: "t2", name: "Task 2" }]);
      assertEquals(attr.to_tjp(), "tasklist t1, t2");
    });

    it("tjpId é 'tasklist'", () => {
      assertEquals(TaskListAttribute.tjpId, "tasklist");
    });
  });
});