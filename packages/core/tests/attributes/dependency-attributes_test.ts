import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { MockContainer, } from "./mock-container.ts";
import { DependencyListAttribute, } from "../../src/attributes/dependency/dependency-list-attribute.ts";
import { TaskDepListAttribute, } from "../../src/attributes/dependency/task-dep-list-attribute.ts";

class TestDependencyListAttribute extends DependencyListAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<{ task: { fullId: string } }[]>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestTaskDepListAttribute extends TaskDepListAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<{ task: { fullId: string }; onEnd: boolean }[]>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

describe("DependencyAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string };

  beforeEach(() => {
    AttributeBase.setMode(0,);
    container = new MockContainer();
    property = { id: "test.attr", name: "Test Attr", };
  },);

  describe("DependencyListAttribute", () => {
    let type: AttributeDefinition<{ task: { fullId: string } }[]>;
    let attr: TestDependencyListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "dependencylist",
        "Dependency List",
        AttributeType.DependencyList,
        [],
      );
      attr = new TestDependencyListAttribute(property, type, container,);
    },);

    it("to_s com dependências", () => {
      attr.set([
        { task: { fullId: "task1", }, },
        { task: { fullId: "task2", }, },
      ],);
      assertEquals(attr.to_s(), "task1, task2",);
    });

    it("to_s filtra null", () => {
      attr.set([
        { task: { fullId: "task1", }, },
        { task: null as unknown as { fullId: string }, },
      ],);
      assertEquals(attr.to_s(), "task1",);
    });

    it("to_tjp com dependências", () => {
      attr.set([
        { task: { fullId: "task1", }, },
        { task: { fullId: "task2", }, },
      ],);
      assertEquals(attr.to_tjp(), "dependencylist task1, task2",);
    });

    it("tjpId é 'dependencylist'", () => {
      assertEquals(DependencyListAttribute.tjpId, "dependencylist",);
    });
  });

  describe("TaskDepListAttribute", () => {
    let type: AttributeDefinition<
      { task: { fullId: string }; onEnd: boolean }[]
    >;
    let attr: TestTaskDepListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "taskdeplist",
        "Task Dep List",
        AttributeType.TaskDepList,
        [],
      );
      attr = new TestTaskDepListAttribute(property, type, container,);
    },);

    it("to_s com dependências", () => {
      attr.set([
        { task: { fullId: "task1", }, onEnd: true, },
        { task: { fullId: "task2", }, onEnd: false, },
      ],);
      assertEquals(attr.to_s(), "task1, task2",);
    });

    it("to_tjp com dependências", () => {
      attr.set([
        { task: { fullId: "task1", }, onEnd: true, },
        { task: { fullId: "task2", }, onEnd: false, },
      ],);
      assertEquals(attr.to_tjp(), "taskdeplist task1, task2",);
    });

    it("tjpId é 'taskdeplist'", () => {
      assertEquals(TaskDepListAttribute.tjpId, "taskdeplist",);
    });
  });
});
