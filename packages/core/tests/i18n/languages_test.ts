import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { CANONICAL_KEYWORDS, } from "../../src/i18n/canonical.ts";
import { en, } from "../../src/i18n/en.ts";
import { ptBR, } from "../../src/i18n/pt-BR.ts";
import { es, } from "../../src/i18n/es.ts";
import { globalRegistry, } from "../../src/i18n/mod.ts";
import type { LanguageDefinition, } from "../../src/i18n/types.ts";

const LANGS = [en, ptBR, es,];

describe("Idiomas (10.16)", () => {
  it("10.16.2 en cobre todos os canônicos com identidade", () => {
    assertEquals(Object.keys(en.keywords,).length, CANONICAL_KEYWORDS.length,);
    for (const k of CANONICAL_KEYWORDS) {
      assertEquals(en.keywords[k], [k,],);
    }
  });

  it("10.16.3 en.units tem as 6 unidades do spec (+quarter)", () => {
    assertEquals(en.units.day, ["d", "day", "days",],);
    assertEquals(en.units.hour, ["h", "hour", "hours",],);
    assertEquals(en.units.week, ["w", "week", "weeks",],);
    assertEquals(en.units.month?.includes("mo",), true,);
    assertEquals(en.units.year?.includes("y",), true,);
    assertEquals(en.units.minute?.includes("min",), true,);
    assertEquals(en.units.quarter?.includes("q",), true,);
  });

  it("10.16.4 pt-BR cobre todos os ~200 canônicos", () => {
    assertEquals(
      Object.keys(ptBR.keywords,).length,
      CANONICAL_KEYWORDS.length,
    );
    assertEquals(ptBR.keywords.project, ["projeto",],);
    assertEquals(ptBR.keywords.task, ["tarefa",],);
    assertEquals(ptBR.keywords.effort, ["esforço",],);
    assertEquals(ptBR.keywords.depends, ["depende",],);
  });

  it("10.16.5 pt-BR units traduzidas", () => {
    assertEquals(ptBR.units.day, ["d", "dia", "dias",],);
    assertEquals(ptBR.units.hour?.includes("horas",), true,);
    assertEquals(ptBR.units.week?.includes("semana",), true,);
    assertEquals(ptBR.units.month?.includes("mês",), true,);
    assertEquals(ptBR.units.year?.includes("ano",), true,);
    assertEquals(ptBR.units.minute?.includes("minuto",), true,);
  });

  it("10.16.6 es cobre todos os ~200 canônicos", () => {
    assertEquals(Object.keys(es.keywords,).length, CANONICAL_KEYWORDS.length,);
    assertEquals(es.keywords.project, ["proyecto",],);
    assertEquals(es.keywords.task, ["tarea",],);
    assertEquals(es.keywords.workinghours, ["horaslaborales",],);
  });

  it("10.16.7 es units traduzidas", () => {
    assertEquals(es.units.day?.includes("día",), true,);
    assertEquals(es.units.hour?.includes("horas",), true,);
    assertEquals(es.units.week?.includes("semana",), true,);
    assertEquals(es.units.month?.includes("meses",), true,);
    assertEquals(es.units.year?.includes("año",), true,);
    assertEquals(es.units.minute?.includes("minutos",), true,);
  });

  it("10.16.8 os 3 idiomas cobrem os mesmos canônicos", () => {
    const canonical: Set<string> = new Set(CANONICAL_KEYWORDS,);
    for (const lang of LANGS) {
      const keys = new Set(Object.keys(lang.keywords,),);
      assertEquals(keys.size, canonical.size, lang.id,);
      for (const k of keys) {
        assertEquals(
          canonical.has(k,),
          true,
          `${lang.id}: ${k} não é canônico`,
        );
      }
    }
  });

  it("10.16.9 nenhum sinônimo colide dentro do mesmo idioma", () => {
    for (const lang of LANGS) {
      assertNoCollision(lang,);
    }
  });

  it("10.16.10 aggregate: globalRegistry resolve nas 3 línguas", () => {
    assertEquals(globalRegistry.resolve("tarefa", "pt-BR",), "task",);
    assertEquals(globalRegistry.resolve("tarea", "es",), "task",);
    assertEquals(globalRegistry.resolve("task", "es",), "task",);
    assertEquals(globalRegistry.resolve("effort", "pt-BR",), "effort",);
    assertEquals(globalRegistry.resolve("recurso", "pt-BR",), "resource",);
    assertEquals(globalRegistry.resolve("informe", "es",), "report",);
    assertEquals(globalRegistry.resolve("banana", "pt-BR",), null,);
  });
});

function assertNoCollision(lang: LanguageDefinition,) {
  const seen = new Map<string, string>();
  const add = (from: string, to: string,) => {
    const prev = seen.get(from,);
    assertEquals(
      prev === undefined || prev === to,
      true,
      `${lang.id}: sinônimo '${from}' colide (${prev} vs ${to})`,
    );
    seen.set(from, to,);
  };
  for (const [canonical, synonyms,] of Object.entries(lang.keywords,)) {
    add(canonical, canonical,);
    for (const s of synonyms) add(s, canonical,);
  }
  const seenUnits = new Map<string, string>();
  const addU = (from: string, to: string,) => {
    const prev = seenUnits.get(from,);
    assertEquals(
      prev === undefined || prev === to,
      true,
      `${lang.id}: unidade '${from}' colide (${prev} vs ${to})`,
    );
    seenUnits.set(from, to,);
  };
  for (const [canonical, synonyms,] of Object.entries(lang.units,)) {
    addU(canonical, canonical,);
    for (const s of synonyms) addU(s, canonical,);
  }
}
