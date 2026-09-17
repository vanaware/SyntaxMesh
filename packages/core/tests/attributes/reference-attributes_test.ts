import { describe, it, beforeEach, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition } from "../../src/attributes/attribute-definition.ts";
import { AttributeType } from "../../src/attributes/attribute-type.ts";
import { MockContainer } from "./mock-container.ts";
import { PropertyAttribute } from "../../src/attributes/reference/property-attribute.ts";
import { AccountAttribute } from "../../src/attributes/reference/account-attribute.ts";
import { ReferenceAttribute } from "../../src/attributes/reference/reference-attribute.ts";
import { NotYetImplementedError } from "../../src/attributes/errors.ts";

class TestPropertyAttribute extends PropertyAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<{ id: string; name: string; }>, container: MockContainer) {
    super(property, type, container);
  }
}

class TestAccountAttribute extends AccountAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<{ id: string; }>, container: MockContainer) {
    super(property, type, container);
  }
}

class TestReferenceAttribute extends ReferenceAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<{ url: string; label?: string; }>, container: MockContainer) {
    super(property, type, container);
  }
}

describe("ReferenceAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string; };

  beforeEach(() => {
    AttributeBase.setMode(0);
    container = new MockContainer();
    property = { id: "test.attr", name: "Test Attr" };
  });

  describe("PropertyAttribute", () => {
    let type: AttributeDefinition<{ id: string; name: string; }>;
    let attr: TestPropertyAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "property",
        "Property",
        AttributeType.Property,
        { id: "test", name: "Test Property" },
      );
      attr = new TestPropertyAttribute(property, type, container);
    });

    it("tjpId é 'property'", () => {
      assertEquals(PropertyAttribute.tjpId, "property");
    });
  });

  describe("AccountAttribute", () => {
    let type: AttributeDefinition<{ id: string; }>;
    let attr: TestAccountAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "account",
        "Account",
        AttributeType.Account,
        { id: "acc123" },
      );
      attr = new TestAccountAttribute(property, type, container);
    });

    it("to_s com valor", () => {
      attr.set({ id: "acc456" });
      assertEquals(attr.to_s(), "acc456");
    });

    it("to_s sem valor retorna ''", () => {
      assertEquals(attr.to_s(), "");
    });

    it("to_tjp com valor", () => {
      attr.set({ id: "acc789" });
      assertEquals(attr.to_tjp(), "acc789");
    });

    it("to_tjp sem valor retorna ''", () => {
      assertEquals(attr.to_tjp(), "");
    });

    it("tjpId é 'account'", () => {
      assertEquals(AccountAttribute.tjpId, "account");
    });
  });

  describe("ReferenceAttribute", () => {
    let type: AttributeDefinition<{ url: string; label?: string; }>;
    let attr: TestReferenceAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "reference",
        "Reference",
        AttributeType.Reference,
        { url: "https://example.com", label: "Example" },
      );
      attr = new TestReferenceAttribute(property, type, container);
    });

    it("to_s com valor", () => {
      attr.set({ url: "https://test.com" });
      assertEquals(attr.to_s(), "https://test.com");
    });

    it("to_s sem valor retorna ''", () => {
      assertEquals(attr.to_s(), "");
    });

    it("to_tjp com url e label", () => {
      attr.set({ url: "https://example.com", label: "Example Label" });
      assertEquals(attr.to_tjp(), 'reference "https://example.com" { label "Example Label" }');
    });

    it("to_tjp com url apenas", () => {
      attr.set({ url: "https://example.com" });
      assertEquals(attr.to_tjp(), 'reference "https://example.com"');
    });

    it("to_tjp sem valor retorna ''", () => {
      assertEquals(attr.to_tjp(), "");
    });

    it("url() com valor", () => {
      attr.set({ url: "https://url.com", label: "Label" });
      assertEquals(attr.url(), "https://url.com");
    });

    it("url() sem valor retorna null", () => {
      assertEquals(attr.url(), null);
    });

    it("label() com valor", () => {
      attr.set({ url: "https://example.com", label: "My Label" });
      assertEquals(attr.label(), "My Label");
    });

    it("label() sem label retorna null", () => {
      attr.set({ url: "https://example.com" });
      assertEquals(attr.label(), null);
    });

    it("label() sem valor retorna null", () => {
      assertEquals(attr.label(), null);
    });

    it("tjpId é 'reference'", () => {
      assertEquals(ReferenceAttribute.tjpId, "reference");
    });

    it("to_rti lança NotYetImplementedError", () => {
      assertThrows(() => attr.to_rti(), NotYetImplementedError);
    });
  });
});