import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { MockContainer, } from "./mock-container.ts";
import { RichTextAttribute, } from "../../src/attributes/rich/rich-text-attribute.ts";
import { DefinitionListAttribute, } from "../../src/attributes/rich/definition-list-attribute.ts";

class TestRichTextAttribute extends RichTextAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<unknown>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestDefinitionListAttribute extends DefinitionListAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<unknown[]>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

describe("RichAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string };

  beforeEach(() => {
    AttributeBase.setMode(0,);
    container = new MockContainer();
    property = { id: "test.attr", name: "Test Attr", };
  },);

  describe("RichTextAttribute", () => {
    let type: AttributeDefinition<unknown>;
    let attr: TestRichTextAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "richtext",
        "Rich Text",
        AttributeType.RichText,
        null,
      );
      attr = new TestRichTextAttribute(property, type, container,);
    },);

    it("tjpId é 'richtext'", () => {
      assertEquals(RichTextAttribute.tjpId, "richtext",);
    });
  });

  describe("DefinitionListAttribute", () => {
    let type: AttributeDefinition<unknown[]>;
    let attr: TestDefinitionListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "definitionlist",
        "Definition List",
        AttributeType.DefinitionList,
        [],
      );
      attr = new TestDefinitionListAttribute(property, type, container,);
    },);

    it("tjpId é 'definitionlist'", () => {
      assertEquals(DefinitionListAttribute.tjpId, "definitionlist",);
    });
  });
});