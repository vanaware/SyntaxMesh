import { describe, it, beforeEach, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition } from "../../src/attributes/attribute-definition.ts";
import { AttributeType } from "../../src/attributes/attribute-type.ts";
import { MockContainer } from "./mock-container.ts";
import { ChargeListAttribute } from "../../src/attributes/financial/charge-list-attribute.ts";
import { ChargeSetListAttribute } from "../../src/attributes/financial/charge-set-list-attribute.ts";
import { AccountCreditListAttribute } from "../../src/attributes/financial/account-credit-list-attribute.ts";

class TestChargeListAttribute extends ChargeListAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<string[]>, container: MockContainer) {
    super(property, type, container);
  }
}

class TestChargeSetListAttribute extends ChargeSetListAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<{ to_s(): string }[]>, container: MockContainer) {
    super(property, type, container);
  }
}

class TestAccountCreditListAttribute extends AccountCreditListAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<unknown[]>, container: MockContainer) {
    super(property, type, container);
  }
}

describe("FinancialAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string; };

  beforeEach(() => {
    AttributeBase.setMode(0);
    container = new MockContainer();
    property = { id: "test.attr", name: "Test Attr" };
  });

  describe("ChargeListAttribute", () => {
    let type: AttributeDefinition<string[]>;
    let attr: TestChargeListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "charge",
        "Charge",
        AttributeType.ChargeList,
        [],
      );
      attr = new TestChargeListAttribute(property, type, container);
    });

    it("to_s", () => {
      attr.set(["c1", "c2", "c3"]);
      assertEquals(attr.to_s(), "c1, c2, c3");
    });

    it("tjpId é 'charge'", () => {
      assertEquals(ChargeListAttribute.tjpId, "charge");
    });
  });

  describe("ChargeSetListAttribute", () => {
    let type: AttributeDefinition<{ to_s(): string }[]>;
    let attr: TestChargeSetListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "chargeset",
        "Charge Set",
        AttributeType.ChargeSetList,
        [],
      );
      attr = new TestChargeSetListAttribute(property, type, container);
    });

    it("to_s", () => {
      attr.set([
        { to_s() { return "cs1"; } },
        { to_s() { return "cs2"; } },
      ]);
      assertEquals(attr.to_s(), "cs1, cs2");
    });

    it("to_tjp", () => {
      attr.set([
        { to_s() { return "cs1"; } },
        { to_s() { return "cs2"; } },
      ]);
      assertEquals(attr.to_tjp(), "chargeset cs1, cs2");
    });

    it("tjpId é 'chargeset'", () => {
      assertEquals(ChargeSetListAttribute.tjpId, "chargeset");
    });
  });

  describe("AccountCreditListAttribute", () => {
    let type: AttributeDefinition<unknown[]>;
    let attr: TestAccountCreditListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "credits",
        "Credits",
        AttributeType.AccountCreditList,
        [],
      );
      attr = new TestAccountCreditListAttribute(property, type, container);
    });

    it("tjpId é 'credits'", () => {
      assertEquals(AccountCreditListAttribute.tjpId, "credits");
    });
  });
});