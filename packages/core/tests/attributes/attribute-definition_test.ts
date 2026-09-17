import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, assert, } from "@std/assert";
import { AttributeDefinition } from "../../src/attributes/attribute-definition.ts";
import { AttributeType } from "../../src/attributes/attribute-type.ts";

describe("AttributeDefinition", () => {
  it("cria definição com todos os campos", () => {
    const def = new AttributeDefinition(
      "effort",
      "Effort",
      AttributeType.Integer,
      0,
    );
    assertEquals(def.id, "effort");
    assertEquals(def.name, "Effort");
    assertEquals(def.type, AttributeType.Integer);
    assertEquals(def.defaultValue, 0);
    assertEquals(def.userDefined, false);
    assertEquals(def.isList, false);
    assertEquals(def.isSingleton, false);
    assertEquals(def.isScenarioAttribute, false);
  });

  it("aceita userDefined=true", () => {
    const def = new AttributeDefinition(
      "myAttr",
      "My Attr",
      AttributeType.String,
      "",
      true,
    );
    assertEquals(def.userDefined, true);
  });

  it("aceita isList=true", () => {
    const def = new AttributeDefinition(
      "flags",
      "Flags",
      AttributeType.FlagList,
      [],
      false,
      true,
    );
    assertEquals(def.isList, true);
  });

  it("lança TjArgumentError com id vazio", () => {
    assertThrows(
      () =>
        new AttributeDefinition(
          "",
          "Name",
          AttributeType.String,
          "",
        ),
      Error,
      "não pode ser vazio",
    );
  });

  it("lança TjArgumentError com name vazio", () => {
    assertThrows(
      () =>
        new AttributeDefinition(
          "id",
          "",
          AttributeType.String,
          "",
        ),
      Error,
      "não pode ser vazio",
    );
  });

  it("freeze no constructor", () => {
    const def = new AttributeDefinition(
      "id",
      "name",
      AttributeType.String,
      "",
    );
    assert(Object.isFrozen(def));
  });

  it("mutar campo lança TypeError (strict mode)", () => {
    const def = new AttributeDefinition(
      "id",
      "name",
      AttributeType.String,
      "",
    );
    assertThrows(
      () => {
        (def as any).id = "other";
      },
      TypeError,
    );
  });

  it("attributeTypeClass retorna construtor para cada tipo", () => {
    assertEquals(
      AttributeDefinition.attributeTypeClass(AttributeType.String),
      "StringAttribute",
    );
    assertEquals(
      AttributeDefinition.attributeTypeClass(AttributeType.Integer),
      "IntegerAttribute",
    );
    assertEquals(
      AttributeDefinition.attributeTypeClass(AttributeType.Boolean),
      "BooleanAttribute",
    );
  });

  it("attributeTypeClass lança para tipo desconhecido", () => {
    assertThrows(
      () => AttributeDefinition.attributeTypeClass(-1 as any),
      Error,
    );
  });
});