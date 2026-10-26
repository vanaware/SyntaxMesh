import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { LanguageRegistry, } from "../../src/i18n/registry.ts";
import { CANONICAL_KEYWORDS, } from "../../src/i18n/canonical.ts";
import { en, } from "../../src/i18n/en.ts";
import type { LanguageDefinition, } from "../../src/i18n/types.ts";

const ptTest: LanguageDefinition = {
  id: "pt-BR",
  name: "Português (Brasil)",
  keywords: { project: ["projeto",], task: ["tarefa",], },
  units: { day: ["dia", "dias",], },
};

describe("LanguageRegistry", () => {
  it("10.15.5 register + get retorna a definição", () => {
    const reg = new LanguageRegistry();
    reg.register(en,);
    reg.register(ptTest,);
    assertEquals(reg.get("pt-BR",)?.name, "Português (Brasil)",);
    assertEquals(reg.get("en",)?.id, "en",);
  });

  it("10.15.5 re-registrar o mesmo id substitui", () => {
    const reg = new LanguageRegistry();
    reg.register(ptTest,);
    reg.register({ ...ptTest, name: "PT-BR v2", },);
    assertEquals(reg.get("pt-BR",)?.name, "PT-BR v2",);
  });

  it("10.15.6 get de idioma inexistente retorna null", () => {
    const reg = new LanguageRegistry();
    reg.register(en,);
    assertEquals(reg.get("de",), null,);
    assertEquals(reg.get("",), null,);
    // após registrar, passa a encontrar
    reg.register(ptTest,);
    assertEquals(reg.get("pt-BR",)?.id, "pt-BR",);
  });

  it("10.15.7 all lista idiomas na ordem de registro", () => {
    const reg = new LanguageRegistry();
    reg.register(en,);
    reg.register(ptTest,);
    assertEquals(reg.all().map((l,) => l.id), ["en", "pt-BR",],);
  });

  it("10.15.8 resolve traduz sinônimo para o canônico", () => {
    const reg = new LanguageRegistry();
    reg.register(en,);
    reg.register(ptTest,);
    assertEquals(reg.resolve("projeto", "pt-BR",), "project",);
    assertEquals(reg.resolve("tarefa", "pt-BR",), "task",);
  });

  it("10.15.8 resolve tem fallback inglês para canônicos", () => {
    const reg = new LanguageRegistry();
    reg.register(en,);
    reg.register(ptTest,);
    assertEquals(reg.resolve("task", "pt-BR",), "task",);
    assertEquals(reg.resolve("effort", "en",), "effort",);
  });

  it("10.15.8 resolve case-sensitive não traduz variações", () => {
    const reg = new LanguageRegistry();
    reg.register(en,);
    reg.register(ptTest,);
    assertEquals(reg.resolve("Tarefa", "pt-BR",), null,);
    assertEquals(reg.resolve("projeto", "en",), null,);
  });

  it("10.15.8 resolve de palavra desconhecida retorna null", () => {
    const reg = new LanguageRegistry();
    reg.register(en,);
    assertEquals(reg.resolve("banana", "en",), null,);
    assertEquals(reg.resolve("qualquer", "xx",), null,);
  });

  it("10.15.8 register lança em sinônimo duplicado (colisão)", () => {
    const reg = new LanguageRegistry();
    const bad: LanguageDefinition = {
      id: "bad",
      name: "Bad",
      keywords: { task: ["x",], project: ["x",], },
      units: {},
    };
    let threw = false;
    try {
      reg.register(bad,);
    } catch {
      threw = true;
    }
    assertEquals(threw, true,);
  });

  it("10.15.9 resolveUnit traduz unidades locais", () => {
    const reg = new LanguageRegistry();
    reg.register(en,);
    reg.register(ptTest,);
    assertEquals(reg.resolveUnit("dias", "pt-BR",), "day",);
    assertEquals(reg.resolveUnit("d", "pt-BR",), "day",); // fallback en
    assertEquals(reg.resolveUnit("h", "en",), "hour",);
    assertEquals(reg.resolveUnit("xyz", "en",), null,);
  });

  it("hasUnitInLanguage só vê sinônimos próprios (sem fallback en)", () => {
    // O scanner usa este gate para não corromper literais ingleses do
    // FSM (ex.: `loadunit days` em arquivo pt-BR não pode virar 'd').
    const reg = new LanguageRegistry();
    reg.register(en,);
    reg.register(ptTest,);
    assertEquals(reg.hasUnitInLanguage("dias", "pt-BR",), true,);
    assertEquals(reg.hasUnitInLanguage("days", "pt-BR",), false,);
    assertEquals(reg.hasUnitInLanguage("day", "en",), true,);
    assertEquals(reg.hasUnitInLanguage("xyz", "pt-BR",), false,);
  });

  it("10.15.10 canonicalizeKeywords mescla idioma + fallback en", () => {
    const reg = new LanguageRegistry();
    reg.register(en,);
    reg.register(ptTest,);
    const map = reg.canonicalizeKeywords("pt-BR",);
    assertEquals(map.get("projeto",), "project",);
    assertEquals(map.get("effort",), "effort",); // via en
    // idioma tem prioridade sobre sobreposição do en
    const overlapped = reg.canonicalizeKeywords("xx",);
    assertEquals(overlapped.get("projeto",), undefined,);
  });

  it("10.15.12 dois idiomas resolvem o mesmo canônico", () => {
    const reg = new LanguageRegistry();
    const esTest: LanguageDefinition = {
      id: "es",
      name: "Español",
      keywords: { project: ["proyecto",], task: ["tarea",], },
      units: { day: ["día",], },
    };
    reg.register(en,);
    reg.register(ptTest,);
    reg.register(esTest,);
    assertEquals(reg.resolve("projeto", "pt-BR",), "project",);
    assertEquals(reg.resolve("proyecto", "es",), "project",);
    assertEquals(reg.resolve("tarea", "es",), "task",);
    assertEquals(reg.resolve("tarefa", "pt-BR",), "task",);
    // "tarea" não é sinônimo em pt-BR (pt usa "tarefa")
    assertEquals(reg.resolve("tarea", "pt-BR",), null,);
  });

  it("10.15.2 CANONICAL_KEYWORDS tem >= 200 keywords e sem duplicatas", () => {
    assertEquals(CANONICAL_KEYWORDS.length >= 200, true,);
    assertEquals(new Set(CANONICAL_KEYWORDS,).size, CANONICAL_KEYWORDS.length,);
  });
});
