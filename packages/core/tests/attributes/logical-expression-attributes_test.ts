import { describe, it, beforeEach, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition } from "../../src/attributes/attribute-definition.ts";
import { AttributeType } from "../../src/attributes/attribute-type.ts";
import { MockContainer } from "./mock-container.ts";
import { LogicalExpressionAttribute } from "../../src/attributes/logical/logical-expression-attribute.ts";
import { LogicalExpressionListAttribute } from "../../src/attributes/logical/logical-expression-list-attribute.ts";

class TestLogicalExpressionAttribute extends LogicalExpressionAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<unknown>, container: MockContainer) {
    super(property, type, container);
  }
}

class TestLogicalExpressionListAttribute extends LogicalExpressionListAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<unknown[]>, container: MockContainer) {
    super(property, type, container);
  }
}

describe("LogicalExpressionAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string; };

  beforeEach(() => {
    AttributeBase.setMode(0);
    container = new MockContainer();
    property = { id: "test.attr", name: "Test Attr" };
  });

  describe("LogicalExpressionAttribute", () => {
    let type: AttributeDefinition<unknown>;
    let attr: TestLogicalExpressionAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "logicalexpressions",
        "Logical Expression",
        AttributeType.LogicalExpression,
        null,
      );
      attr = new TestLogicalExpressionAttribute(property, type, container);
    });

    it("tjpId é 'logicalexpressions'", () => {
      assertEquals(LogicalExpressionAttribute.tjpId, "logicalexpressions");
    });
  });

  describe("LogicalExpressionListAttribute", () => {
    let type: AttributeDefinition<unknown[]>;
    let attr: TestLogicalExpressionListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "logicalexpressions",
        "Logical Expression List",
        AttributeType.LogicalExpressionList,
        [],
      );
      attr = new TestLogicalExpressionListAttribute(property, type, container);
    });

    it("isList é true", () => {
      assertEquals(attr.isList(), true);
    });

    it("tjpId é 'logicalexpressions'", () => {
      assertEquals(LogicalExpressionListAttribute.tjpId, "logicalexpressions");
    });
  });
});