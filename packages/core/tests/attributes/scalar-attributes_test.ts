import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { MockContainer, } from "./mock-container.ts";
import { StringAttribute, } from "../../src/attributes/scalar/string-attribute.ts";
import { IntegerAttribute, } from "../../src/attributes/scalar/integer-attribute.ts";
import { FloatAttribute, } from "../../src/attributes/scalar/float-attribute.ts";
import { BooleanAttribute, } from "../../src/attributes/scalar/boolean-attribute.ts";
import { SymbolAttribute, } from "../../src/attributes/scalar/symbol-attribute.ts";
import { DateAttribute, } from "../../src/attributes/scalar/date-attribute.ts";
import { DurationAttribute, } from "../../src/attributes/scalar/duration-attribute.ts";

class TestStringAttribute extends StringAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<string>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestIntegerAttribute extends IntegerAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<number>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestFloatAttribute extends FloatAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<number>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestBooleanAttribute extends BooleanAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<boolean>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestSymbolAttribute extends SymbolAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<string>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestDateAttribute extends DateAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<string>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestDurationAttribute extends DurationAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<number>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

describe("ScalarAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string };

  beforeEach(() => {
    AttributeBase.setMode(0,);
    container = new MockContainer();
    property = { id: "test.attr", name: "Test Attr", };
  },);

  describe("StringAttribute", () => {
    let type: AttributeDefinition<string>;
    let attr: TestStringAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "text",
        "Text",
        AttributeType.String,
        "",
      );
      attr = new TestStringAttribute(property, type, container,);
    },);

    it("to_tjp com string simples", () => {
      attr.set("hello",);
      assertEquals(attr.to_tjp(), 'text "hello"',);
    });

    it("to_tjp com string com aspas", () => {
      attr.set('he"llo',);
      assertEquals(attr.to_tjp(), 'text "he\\"llo"',);
    });

    it("to_tjp com newline usa -8<-...->8-", () => {
      attr.set("line1\nline2",);
      assertEquals(attr.to_tjp(), "text -8<-\nline1\nline2\n->8-",);
    });

    it("tjpId é 'text'", () => {
      assertEquals(StringAttribute.tjpId, "text",);
    });
  });

  describe("IntegerAttribute", () => {
    let type: AttributeDefinition<number>;
    let attr: TestIntegerAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "integer",
        "Integer",
        AttributeType.Integer,
        0,
      );
      attr = new TestIntegerAttribute(property, type, container,);
    },);

    it("to_tjp com número", () => {
      attr.set(42,);
      assertEquals(attr.to_tjp(), "integer 42",);
    });

    it("tjpId é 'integer'", () => {
      assertEquals(IntegerAttribute.tjpId, "integer",);
    });
  });

  describe("FloatAttribute", () => {
    let type: AttributeDefinition<number>;
    let attr: TestFloatAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "number",
        "Number",
        AttributeType.Float,
        0.0,
      );
      attr = new TestFloatAttribute(property, type, container,);
    },);

    it("to_tjp com float", () => {
      attr.set(3.14,);
      assertEquals(attr.to_tjp(), "number 3.14",);
    });

    it("tjpId é 'number'", () => {
      assertEquals(FloatAttribute.tjpId, "number",);
    });
  });

  describe("BooleanAttribute", () => {
    let type: AttributeDefinition<boolean>;
    let attr: TestBooleanAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "active",
        "Active",
        AttributeType.Boolean,
        false,
      );
      attr = new TestBooleanAttribute(property, type, container,);
    },);

    it("to_s com true", () => {
      attr.set(true,);
      assertEquals(attr.to_s(), "true",);
    });

    it("to_s com false", () => {
      attr.set(false,);
      assertEquals(attr.to_s(), "false",);
    });

    it("to_tjp com true", () => {
      attr.set(true,);
      assertEquals(attr.to_tjp(), "active yes",);
    });

    it("to_tjp com false", () => {
      attr.set(false,);
      assertEquals(attr.to_tjp(), "active no",);
    });

    it("tjpId é 'boolean'", () => {
      assertEquals(BooleanAttribute.tjpId, "boolean",);
    });
  });

  describe("SymbolAttribute", () => {
    let type: AttributeDefinition<string>;
    let attr: TestSymbolAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "symbol",
        "Symbol",
        AttributeType.Symbol,
        "",
      );
      attr = new TestSymbolAttribute(property, type, container,);
    },);

    it("tjpId é 'symbol'", () => {
      assertEquals(SymbolAttribute.tjpId, "symbol",);
    });
  });

  describe("DateAttribute", () => {
    let type: AttributeDefinition<string>;
    let attr: TestDateAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "date",
        "Date",
        AttributeType.Date,
        "",
      );
      attr = new TestDateAttribute(property, type, container,);
    },);

    it("to_s com valor", () => {
      attr.set("2026-01-01",);
      assertEquals(attr.to_s(), "2026-01-01",);
    });

    it("to_s sem valor retorna 'Error'", () => {
      assertEquals(attr.to_s(), "Error",);
    });

    it("tjpId é 'date'", () => {
      assertEquals(DateAttribute.tjpId, "date",);
    });
  });

  describe("DurationAttribute", () => {
    let type: AttributeDefinition<number>;
    let attr: TestDurationAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "duration",
        "Duration",
        AttributeType.Duration,
        0,
      );
      attr = new TestDurationAttribute(property, type, container,);
    },);

    it("to_s sem query", () => {
      attr.set(8,);
      assertEquals(attr.to_s(), "8",);
    });

    it("to_tjp", () => {
      attr.set(8,);
      assertEquals(attr.to_tjp(), "duration 8h",);
    });

    it("tjpId é 'duration'", () => {
      assertEquals(DurationAttribute.tjpId, "duration",);
    });
  });
});
