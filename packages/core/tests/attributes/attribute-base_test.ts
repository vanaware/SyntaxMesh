import { describe, it, beforeEach, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase, AttributeMode, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition } from "../../src/attributes/attribute-definition.ts";
import { AttributeType } from "../../src/attributes/attribute-type.ts";
import { MockContainer } from "./mock-container.ts";
import { NotYetImplementedError } from "../../src/attributes/errors.ts";

class TestAttribute extends AttributeBase<string> {
  constructor(
    property: { id: string; name: string; },
    type: AttributeDefinition<string>,
    container: MockContainer,
  ) {
    super(property, type, container);
  }
}

describe("AttributeBase", () => {
  let container: MockContainer;
  let attr: TestAttribute;
  let property: { id: string; name: string; };
  let type: AttributeDefinition<string>;

  beforeEach(() => {
    AttributeBase.setMode(0);
    container = new MockContainer();
    property = { id: "test.attr", name: "Test Attr" };
    type = new AttributeDefinition(
      "test.attr",
      "Test Attr",
      AttributeType.String,
      "default",
    );
    attr = new TestAttribute(property, type, container);
  });

  it("mode padrão é 0", () => {
    assertEquals(AttributeBase.mode, 0);
  });

  it("setMode altera o modo global", () => {
    AttributeBase.setMode(1);
    assertEquals(AttributeBase.mode, 1);
    AttributeBase.setMode(2);
    assertEquals(AttributeBase.mode, 2);
    AttributeBase.setMode(0);
    assertEquals(AttributeBase.mode, 0);
  });

  it("setMode aceita apenas 0, 1 ou 2", () => {
    assertThrows(() => AttributeBase.setMode(3 as AttributeMode));
  });

  it("reset define provided=false e inherited=false", () => {
    attr.set("value");
    attr.reset();
    assertEquals(attr.provided, false);
    assertEquals(attr.inherited, false);
  });

  it("reset armazena default no container", () => {
    attr.reset();
    assertEquals(container.getStoredValue("test.attr"), "default");
  });

  it("inherit define inherited=true e armazena valor clonado", () => {
    attr.inherit("inheritedValue");
    assertEquals(attr.inherited, true);
    assertEquals(container.getStoredValue("test.attr"), "inheritedValue");
  });

  it("set com mode=0 define provided=true", () => {
    attr.set("value");
    assertEquals(attr.provided, true);
    assertEquals(attr.inherited, false);
  });

  it("set com mode=1 define inherited=true", () => {
    AttributeBase.setMode(1);
    attr.set("value");
    assertEquals(attr.inherited, true);
    assertEquals(attr.provided, false);
  });

  it("set com mode=2 não define nenhuma flag", () => {
    AttributeBase.setMode(2);
    attr.set("value");
    assertEquals(attr.provided, false);
    assertEquals(attr.inherited, false);
  });

  it("set armazena valor no container", () => {
    attr.set("myValue");
    assertEquals(container.getStoredValue("test.attr"), "myValue");
  });

  it("get retorna valor do container", () => {
    container.setStoredValue("test.attr", "myValue");
    assertEquals(attr.get(), "myValue");
  });

  it("get retorna null se não definido", () => {
    assertEquals(attr.get(), null);
  });

  it("value retorna valor do container", () => {
    container.setStoredValue("test.attr", "myValue");
    assertEquals(attr.value, "myValue");
  });

  it("id retorna type.id", () => {
    assertEquals(attr.id, "test.attr");
  });

  it("name retorna type.name", () => {
    assertEquals(attr.name, "Test Attr");
  });

  it("isNil retorna true para null", () => {
    container.setStoredValue("test.attr", null);
    assertEquals(attr.isNil(), true);
  });

  it("isNil retorna true para undefined", () => {
    container.setStoredValue("test.attr", undefined);
    assertEquals(attr.isNil(), true);
  });

  it("isNil retorna true para array vazio", () => {
    container.setStoredValue("test.attr", []);
    assertEquals(attr.isNil(), true);
  });

  it("isNil retorna false para valor definido", () => {
    container.setStoredValue("test.attr", "value");
    assertEquals(attr.isNil(), false);
  });

  it("isList retorna false na base", () => {
    assertEquals(attr.isList(), false);
  });

  it("to_s retorna string do valor", () => {
    container.setStoredValue("test.attr", "hello");
    assertEquals(attr.to_s(), "hello");
  });

  it("to_s retorna vazio para null", () => {
    assertEquals(attr.to_s(), "");
  });

  it("to_num retorna número do valor", () => {
    container.setStoredValue("test.attr", 42);
    assertEquals(attr.to_num(), 42);
  });

  it("to_num retorna 0 para null", () => {
    assertEquals(attr.to_num(), 0);
  });

  it("to_sort retorna string do valor", () => {
    container.setStoredValue("test.attr", "sortMe");
    assertEquals(attr.to_sort(), "sortMe");
  });

  it("to_sort retorna vazio para null", () => {
    assertEquals(attr.to_sort(), "");
  });

  it("to_rti lança NotYetImplementedError", () => {
    assertThrows(
      () => attr.to_rti(),
      NotYetImplementedError,
    );
  });

  it("to_tjp lança NotYetImplementedError", () => {
    assertThrows(
      () => attr.to_tjp(),
      NotYetImplementedError,
    );
  });

  it("quotedString com string simples", () => {
    container.setStoredValue("test.attr", "hello");
    assertEquals(attr.quotedString(), '"hello"');
  });

  it("quotedString escapa aspas", () => {
    container.setStoredValue("test.attr", 'he"llo');
    assertEquals(attr.quotedString(), '"he\\"llo"');
  });

  it("quotedString com newline usa -8<-...->8-", () => {
    container.setStoredValue("test.attr", "line1\nline2");
    assertEquals(attr.quotedString(), "-8<-\nline1\nline2\n->8-");
  });

  it("teste vaza estado se esquecer beforeEach", () => {
    // Este teste documenta que esquecer setMode(0) no beforeEach
    // faz o próximo teste herdar o modo anterior.
    AttributeBase.setMode(1);
    const attr2 = new TestAttribute(property, type, container);
    attr2.set("value");
    assertEquals(attr2.inherited, true);
  });
});