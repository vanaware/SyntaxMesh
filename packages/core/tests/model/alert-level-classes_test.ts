/**
 * 16.1 — `AlertLevelDefinition` + `AlertLevelDefinitions`.
 *
 * Port de `AlertLevelDefinitions.rb`. Os casos espelham o arquivo Ruby
 * inteiro: defaults com `modified = false`, unicidade de id/nome em `add`,
 * busca por id/nome/cor devolvendo `null` quando não acha (Ruby `nil`) e o
 * `to_tjp` que serializa cada nível via `to_s` da `Struct`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AlertLevelDefinitions.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.1)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import {
  AlertLevelDefinition,
  AlertLevelDefinitions,
} from "../../src/model/alert-levels.ts";

/** Nível arbitrário (fora dos defaults) para os casos de `add`. */
function azul(): AlertLevelDefinition {
  return new AlertLevelDefinition("blue", "Blue", "#0000FF",);
}

describe("AlertLevelDefinition", () => {
  it("guarda id, nome e cor", () => {
    const level = new AlertLevelDefinition("red", "Red", "#C00000",);
    assertEquals(level.id, "red",);
    assertEquals(level.name, "Red",);
    assertEquals(level.color, "#C00000",);
  });

  it("to_s usa aspas simples, como a Struct do Ruby", () => {
    const level = new AlertLevelDefinition("red", "Red", "#C00000",);
    assertEquals(level.to_s(), "red 'Red' '#C00000'",);
  });

  it("toString delega a to_s (join/template string)", () => {
    const level = new AlertLevelDefinition("green", "Green", "#008000",);
    assertEquals(`${level}`, "green 'Green' '#008000'",);
  });
});

describe("AlertLevelDefinitions (defaults)", () => {
  it("nasce com green/yellow/red em severidade ascendente", () => {
    const defs = new AlertLevelDefinitions();
    assertEquals(defs.length, 3,);
    assertEquals(
      defs.toArray().map((l,) => l.id),
      ["green", "yellow", "red",],
    );
    assertEquals(
      defs.toArray().map((l,) => l.color),
      ["#008000", "#BEA800", "#C00000",],
    );
  });

  it("modified é false enquanto a paleta é a default", () => {
    assertEquals(new AlertLevelDefinitions().modified, false,);
  });

  it("get() devolve o nível e null fora de faixa", () => {
    const defs = new AlertLevelDefinitions();
    assertEquals(defs.get(1,)!.id, "yellow",);
    assertEquals(defs.get(9,), null,);
    assertEquals(defs.get(-1,), null,);
  });

  it("itera na ordem de severidade", () => {
    const ids = [...new AlertLevelDefinitions(),].map((l,) => l.id);
    assertEquals(ids, ["green", "yellow", "red",],);
  });
});

describe("AlertLevelDefinitions (add / clear / modified)", () => {
  it("add de nível novo marca modified", () => {
    const defs = new AlertLevelDefinitions();
    defs.add(azul(),);
    assertEquals(defs.length, 4,);
    assertEquals(defs.modified, true,);
    assertEquals(defs.indexById("blue",), 3,);
  });

  it("add rejeita id duplicado", () => {
    const defs = new AlertLevelDefinitions();
    const err = assertThrows(
      () => defs.add(new AlertLevelDefinition("green", "Verde", "#00FF00",),),
      Error,
    );
    assertEquals(err.message, "ID and name must be unique",);
    assertEquals(defs.length, 3,);
  });

  it("add rejeita nome duplicado", () => {
    const defs = new AlertLevelDefinitions();
    assertThrows(
      () => defs.add(new AlertLevelDefinition("verde", "Green", "#00FF00",),),
      Error,
    );
    assertEquals(defs.length, 3,);
  });

  it("add rejeita valor que não é AlertLevelDefinition", () => {
    const defs = new AlertLevelDefinitions();
    assertThrows(
      () =>
        defs.add(
          {
            id: "x",
            name: "X",
            color: "#000",
          } as unknown as AlertLevelDefinition,
        ),
      Error,
    );
  });

  it("duplicata do PRIMEIRO nível também é rejeitada (índice 0)", () => {
    // Regressão do quirk Ruby: `if indexById(...)` é truthy para 0, então o
    // primeiro nível da lista também bloqueia duplicatas (diferente de uma
    // tradução ingênua que testaria `> 0`).
    const defs = new AlertLevelDefinitions();
    assertThrows(
      () => defs.add(new AlertLevelDefinition("green", "Verde", "#0F0",),),
      Error,
    );
  });

  it("clear esvazia a lista e marca modified", () => {
    const defs = new AlertLevelDefinitions();
    defs.clear();
    assertEquals(defs.length, 0,);
    assertEquals(defs.modified, true,);
    assertEquals(defs.get(0,), null,);
    // Depois do clear a lista aceita qualquer id/nome de novo.
    defs.add(azul(),);
    assertEquals(defs.indexById("blue",), 0,);
  });
});

describe("AlertLevelDefinitions (buscas)", () => {
  it("indexById devolve o índice e null quando não acha", () => {
    const defs = new AlertLevelDefinitions();
    assertEquals(defs.indexById("red",), 2,);
    assertEquals(defs.indexById("azul",), null,);
  });

  it("indexByName devolve o índice e null quando não acha", () => {
    const defs = new AlertLevelDefinitions();
    assertEquals(defs.indexByName("Yellow",), 1,);
    assertEquals(defs.indexByName("Amarelo",), null,);
  });

  it("indexByColor devolve o índice e null quando não acha", () => {
    const defs = new AlertLevelDefinitions();
    assertEquals(defs.indexByColor("#C00000",), 2,);
    assertEquals(defs.indexByColor("#123456",), null,);
  });

  it("map aplica a função na ordem da lista", () => {
    const defs = new AlertLevelDefinitions();
    assertEquals(
      defs.map((l,) => l.name.toUpperCase()),
      ["GREEN", "YELLOW", "RED",],
    );
  });
});

describe("AlertLevelDefinitions#to_tjp", () => {
  it("serializa os defaults com o to_s da Struct", () => {
    assertEquals(
      new AlertLevelDefinitions().to_tjp(),
      "alertlevels green 'Green' '#008000',\n" +
        "yellow 'Yellow' '#BEA800',\n" +
        "red 'Red' '#C00000'",
    );
  });

  it("reflete uma paleta customizada (2 níveis)", () => {
    const defs = new AlertLevelDefinitions();
    defs.clear();
    defs.add(new AlertLevelDefinition("ok", "OK", "#00FF00",),);
    defs.add(new AlertLevelDefinition("nok", "NOK", "#FF0000",),);
    assertEquals(
      defs.to_tjp(),
      "alertlevels ok 'OK' '#00FF00',\nnok 'NOK' '#FF0000'",
    );
  });

  it("lista vazia produz só a palavra-chave", () => {
    const defs = new AlertLevelDefinitions();
    defs.clear();
    assertEquals(defs.to_tjp(), "alertlevels ",);
    assert(defs.modified,);
  });
});
