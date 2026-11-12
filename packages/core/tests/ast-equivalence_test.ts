/**
 * 10.18 — Equivalência de AST entre idiomas (ADR 023).
 *
 * Cada MWE de `docs/Learning/mweNNN/tutorial.tjp` tem traduções mecânicas
 * pt-BR/es em `tests/fixtures/i18n/` (apenas keywords traduzidos; strings
 * e IDs preservados). O teste parseia as três versões, extrai um snapshot
 * estrutural determinístico do modelo (a "AST") e compara após normalizar
 * `name` de tasks/resources (10.18.4).
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { type ParseOutcome, parseProject, } from "./parser/parse-helper.ts";
import {
  type AstSnap,
  type NodeSnap,
  normalizeAST,
  serializeValue,
  snapshotAST,
} from "./helpers/ast-snapshot.ts";
import type { Project, } from "../src/model/project.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MWE_IDS = [
  "mwe001",
  "mwe002",
  "mwe003",
  "mwe004",
  "mwe005",
  "mwe006",
  "mwe007",
  "mwe008",
  "mwe009",
];

function readFixture(mwe: string, lang: string,): string {
  const path = lang === "en"
    ? `../../../docs/Learning/${mwe}/tutorial.tjp`
    : `./fixtures/i18n/${mwe}.${lang}.tjp`;
  return Deno.readTextFileSync(new URL(path, import.meta.url,),);
}

function parseText(text: string,): ParseOutcome & { snap: AstSnap } {
  const out = parseProject(text,);
  assert(
    out.threw === null,
    `parse lançou: ${out.threw?.message ?? ""} (${out.messageIds.join(",",)})`,
  );
  assert(
    out.result instanceof Object && out.result !== null,
    `resultado não-Project: ${String(out.result,)} msgs=${
      out.messageIds.join(",",)
    }`,
  );
  return { ...out, snap: snapshotAST(out.result as Project,), };
}

describe("normalizeAST (10.18.4)", () => {
  const base = (kind: string, name: string,): NodeSnap => ({
    kind,
    fullId: "x",
    name,
    attrs: {},
    scenarioAttrs: [],
    children: [],
  });
  const snap: AstSnap = {
    project: { name: "P", attrs: {}, scenarioCount: 1, },
    sets: {
      tasks: [base("Task", "Design",),],
      resources: [base("Resource", "Alice",),],
      reports: [base("Report", "Plan",),],
    },
  };

  it("substitui name de Task por __TASK__ preservando estrutura", () => {
    const n = normalizeAST(snap,);
    assertEquals(n.sets.tasks![0]!.name, "__TASK__",);
    assertEquals(n.sets.tasks![0]!.kind, "Task",);
    assertEquals(n.sets.tasks![0]!.fullId, "x",);
  });

  it("substitui name de Resource por __RESOURCE__", () => {
    const n = normalizeAST(snap,);
    assertEquals(n.sets.resources![0]!.name, "__RESOURCE__",);
  });

  it("preserva name de outras entidades (Report)", () => {
    const n = normalizeAST(snap,);
    assertEquals(n.sets.reports![0]!.name, "Plan",);
  });
});

describe("serializeValue", () => {
  it("valores primitivos e coleções são determinísticos", () => {
    assertEquals(serializeValue(3,), "n:3",);
    assertEquals(serializeValue("d",), "s:d",);
    assertEquals(serializeValue([1, "a",],), "[n:1,s:a,]",);
    const m = new Map([["b", 2,], ["a", 1,],],);
    assertEquals(serializeValue(m,), "map{s:a=>n:1|s:b=>n:2,}",);
  });

  it("ordem de chaves de objetos não importa (sort)", () => {
    const a = serializeValue({ x: 1, y: 2, },);
    const b = serializeValue({ y: 2, x: 1, },);
    assertEquals(a, b,);
  });

  it("lineNo/columnNo são ignorados (offsets de tradução)", () => {
    const a = serializeValue({ fileName: "", lineNo: 10, },);
    const b = serializeValue({ fileName: "", lineNo: 12, },);
    assertEquals(a, b,);
  });
});

for (const mwe of MWE_IDS) {
  describe(`${mwe}: AST equivalente entre en/pt-BR/es (10.18.5-8)`, () => {
    it("todas as três versões parseiam sem mensagens", () => {
      for (const lang of ["en", "pt-BR", "es",]) {
        const out = parseText(readFixture(mwe, lang,),);
        assertEquals(out.messageIds, [], `${mwe}.${lang} mensagens`,);
      }
    });

    it("pt-BR produz AST equivalente ao en", () => {
      const en = normalizeAST(parseText(readFixture(mwe, "en",),).snap,);
      const pt = normalizeAST(
        parseText(readFixture(mwe, "pt-BR",),).snap,
      );
      assertEquals(pt, en, `${mwe} pt-BR ≠ en`,);
    });

    it("es produz AST equivalente ao en", () => {
      const en = normalizeAST(parseText(readFixture(mwe, "en",),).snap,);
      const es = normalizeAST(parseText(readFixture(mwe, "es",),).snap,);
      assertEquals(es, en, `${mwe} es ≠ en`,);
    });
  });
}

// ---------------------------------------------------------------------------
// 23.7.8 — `template` nos três idiomas (extensão SyntaxMesh, ADR 033).
//
// O keyword é traduzido como qualquer outro de extensão (`modelo`/`plantilla`).
// O corpo do template fica em keywords canônicos de propósito: o inglês é
// sempre aceito como fallback pelo i18n (ver `project-file-scanner_test`), e
// assim o caso mede só a tradução do declarador. A equivalência é do modelo
// **já expandido** — é isso que o template produz.
// ---------------------------------------------------------------------------

// 23.9 — `template`/`modelo`/`plantilla` ficam **fora** do bloco `{ }` do
// projeto, na mesma condição da macro (prolog ou nível de propriedades).
const TEMPLATE_PROJECT: Record<string, string> = {
  en: 'project tpl "Template i18n" "1.0" 2026-01-01 - 2026-12-31 {\n' +
    '  timezone "UTC"\n' +
    "  now 2026-01-01\n" +
    "}\n" +
    "template PHASE [\n" +
    '  task {{ id }} "{{ id }}" {\n' +
    "    effort {{ esforco }}\n" +
    "    allocate tux\n" +
    "  }\n" +
    "] (id, esforco)\n" +
    'resource tux "Tux"\n' +
    '${PHASE id="t1" esforco="5d"}\n' +
    '${PHASE id="t2" esforco="3d"}\n',
  "pt-BR": 'project tpl "Template i18n" "1.0" 2026-01-01 - 2026-12-31 {\n' +
    '  timezone "UTC"\n' +
    "  now 2026-01-01\n" +
    "}\n" +
    "modelo PHASE [\n" +
    '  task {{ id }} "{{ id }}" {\n' +
    "    effort {{ esforco }}\n" +
    "    allocate tux\n" +
    "  }\n" +
    "] (id, esforco)\n" +
    'recurso tux "Tux"\n' +
    '${PHASE id="t1" esforco="5d"}\n' +
    '${PHASE id="t2" esforco="3d"}\n',
  es: 'project tpl "Template i18n" "1.0" 2026-01-01 - 2026-12-31 {\n' +
    '  timezone "UTC"\n' +
    "  now 2026-01-01\n" +
    "}\n" +
    "plantilla PHASE [\n" +
    '  task {{ id }} "{{ id }}" {\n' +
    "    effort {{ esforco }}\n" +
    "    allocate tux\n" +
    "  }\n" +
    "] (id, esforco)\n" +
    'recurso tux "Tux"\n' +
    '${PHASE id="t1" esforco="5d"}\n' +
    '${PHASE id="t2" esforco="3d"}\n',
};

function parseTemplate(lang: string,) {
  // O `language` rege o scanner (como nos fixtures de i18n da Fase 10).
  return parseText(`language "${lang}"\n` + TEMPLATE_PROJECT[lang]!,);
}

describe("template: AST equivalente entre en/pt-BR/es (23.7.8)", () => {
  it("as três versões parseiam sem mensagens e produzem as tasks", () => {
    for (const lang of Object.keys(TEMPLATE_PROJECT,)) {
      const out = parseTemplate(lang,);
      assertEquals(out.messageIds, [], `${lang} mensagens`,);
      assertEquals(
        out.snap.sets.tasks!.map((t,) => t.fullId),
        ["t1", "t2",],
        `${lang} tasks`,
      );
    }
  });

  it("pt-BR (`modelo`) produz AST equivalente ao en (`template`)", () => {
    const en = normalizeAST(parseTemplate("en",).snap,);
    const pt = normalizeAST(parseTemplate("pt-BR",).snap,);
    assertEquals(pt, en, "pt-BR ≠ en",);
  });

  it("es (`plantilla`) produz AST equivalente ao en (`template`)", () => {
    const en = normalizeAST(parseTemplate("en",).snap,);
    const es = normalizeAST(parseTemplate("es",).snap,);
    assertEquals(es, en, "es ≠ en",);
  });
});
