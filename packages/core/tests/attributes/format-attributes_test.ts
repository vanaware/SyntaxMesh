import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { MockContainer, } from "./mock-container.ts";
import { RealFormatAttribute, } from "../../src/attributes/format/real-format-attribute.ts";
import { ColumnListAttribute, } from "../../src/attributes/format/column-list-attribute.ts";
import { FormatListAttribute, } from "../../src/attributes/format/format-list-attribute.ts";
import { SortListAttribute, } from "../../src/attributes/format/sort-list-attribute.ts";
import { JournalSortListAttribute, } from "../../src/attributes/format/journal-sort-list-attribute.ts";

class TestRealFormatAttribute extends RealFormatAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<unknown>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestColumnListAttribute extends ColumnListAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<string[]>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestFormatListAttribute extends FormatListAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<string[]>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestSortListAttribute extends SortListAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<unknown[]>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestJournalSortListAttribute extends JournalSortListAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<unknown[]>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

describe("FormatAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string };

  beforeEach(() => {
    AttributeBase.setMode(0,);
    container = new MockContainer();
    property = { id: "test.attr", name: "Test Attr", };
  },);

  describe("RealFormatAttribute", () => {
    let type: AttributeDefinition<unknown>;
    let attr: TestRealFormatAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "realformat",
        "Real Format",
        AttributeType.RealFormat,
        null,
      );
      attr = new TestRealFormatAttribute(property, type, container,);
    },);

    it("tjpId é 'realformat'", () => {
      assertEquals(RealFormatAttribute.tjpId, "realformat",);
    });
  });

  describe("ColumnListAttribute", () => {
    let type: AttributeDefinition<string[]>;
    let attr: TestColumnListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "columns",
        "Columns",
        AttributeType.ColumnList,
        [],
      );
      attr = new TestColumnListAttribute(property, type, container,);
    },);

    it("to_s retorna 'TODO'", () => {
      attr.set(["col1", "col2",],);
      assertEquals(attr.to_s(), "TODO",);
    });

    it("tjpId é 'columns'", () => {
      assertEquals(ColumnListAttribute.tjpId, "columns",);
    });
  });

  describe("FormatListAttribute", () => {
    let type: AttributeDefinition<string[]>;
    let attr: TestFormatListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "formatlist",
        "Format List",
        AttributeType.FormatList,
        [],
      );
      attr = new TestFormatListAttribute(property, type, container,);
    },);

    it("to_s com formatos", () => {
      attr.set(["pdf", "html", "txt",],);
      assertEquals(attr.to_s(), "pdf, html, txt",);
    });

    it("to_s vazio", () => {
      attr.set([],);
      assertEquals(attr.to_s(), "",);
    });

    it("tjpId é 'formatlist'", () => {
      assertEquals(FormatListAttribute.tjpId, "formatlist",);
    });
  });

  describe("SortListAttribute", () => {
    let type: AttributeDefinition<unknown[]>;
    let attr: TestSortListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "sorting",
        "Sorting",
        AttributeType.SortList,
        [],
      );
      attr = new TestSortListAttribute(property, type, container,);
    },);

    it("tjpId é 'sorting'", () => {
      assertEquals(SortListAttribute.tjpId, "sorting",);
    });
  });

  describe("JournalSortListAttribute", () => {
    let type: AttributeDefinition<unknown[]>;
    let attr: TestJournalSortListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "journalsorting",
        "Journal Sorting",
        AttributeType.JournalSortList,
        [],
      );
      attr = new TestJournalSortListAttribute(property, type, container,);
    },);

    it("tjpId é 'journalsorting'", () => {
      assertEquals(JournalSortListAttribute.tjpId, "journalsorting",);
    });
  });
});