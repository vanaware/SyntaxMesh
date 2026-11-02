/**
 * 14C.6.2/14C.6.3 — parser de `hidematerial`, `rollupmaterial` e `hidepicture`
 * (extensões SyntaxMesh do Fase 14 Complemento).
 *
 * As três diretivas são análogas a `hideResource`/`hideJournalEntry` e
 * `rollupResource`: aceitam uma expressão lógica e a guardam na propriedade
 * do relatório. A avaliação nos relatórios entra em 14C.6.6–6.9.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { globalRegistry, } from "../../src/i18n/mod.ts";
import type { Report, } from "../../src/model/report.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** Expressão lógica de um atributo do relatório, como texto. */
function exprOf(r: Report, attr: string,): string | null {
  const expr = r.get(attr,) as { toString: () => string } | null;
  return expr === null || expr === undefined ? null : expr.toString();
}

describe("14C.6.2 hidematerial/rollupmaterial", () => {
  it("aceita hidematerial e rollupmaterial no corpo de taskreport", () => {
    const out = parseProject(
      PROJECT_HEADER +
        'taskreport tr "T" {\n  columns name\n' +
        "  hidematerial isleaf()\n" +
        "  rollupmaterial treelevel() > 1\n}\n",
    );
    assertEquals(
      out.messageIds,
      [],
      `msgs=${out.messageIds.join(",",)}: ${
        out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)
      }`,
    );
    const r = out.result === false
      ? null
      : (out.result as { report(id: string,): Report | null }).report("tr",);
    assert(r !== null, "taskreport não registrado",);
    assertEquals(exprOf(r, "hideMaterial",), "isleaf()",);
    assertEquals(exprOf(r, "rollupMaterial",), "treelevel() > 1",);
  });

  it("aceita as duas diretivas em materialreport (corpo compartilhado)", () => {
    const out = parseProject(
      PROJECT_HEADER +
        'materialreport mr "Materiais" {\n' +
        "  hidematerial isleaf()\n" +
        "  rollupmaterial treelevel() > 1\n}\n",
    );
    assertEquals(
      out.messageIds,
      [],
      `msgs=${out.messageIds.join(",",)}: ${
        out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)
      }`,
    );
    const r = out.result === false
      ? null
      : (out.result as { report(id: string,): Report | null }).report("mr",);
    assert(r !== null, "materialreport não registrado",);
    assertEquals(exprOf(r, "hideMaterial",), "isleaf()",);
    assertEquals(exprOf(r, "rollupMaterial",), "treelevel() > 1",);
  });
});

describe("14C.6.3 hidepicture", () => {
  it("aceita hidepicture e attacha o LogicalExpression", () => {
    const out = parseProject(
      PROJECT_HEADER +
        'rdoreport rdo "RDO" {\n' +
        "  period 2026-01-01 - 2026-01-31\n" +
        "  hidepicture isleaf()\n}\n",
    );
    assertEquals(
      out.messageIds,
      [],
      `msgs=${out.messageIds.join(",",)}: ${
        out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)
      }`,
    );
    const r = out.result === false
      ? null
      : (out.result as { report(id: string,): Report | null }).report("rdo",);
    assert(r !== null, "rdoreport não registrado",);
    assertEquals(exprOf(r, "hidePicture",), "isleaf()",);
  });
});

describe("14C.6.4 i18n hidematerial/rollupmaterial/hidepicture", () => {
  it("sinônimos resolvem para as canônicas em pt-BR e es", () => {
    assertEquals(
      globalRegistry.resolve("ocultarmaterial", "pt-BR",),
      "hidematerial",
    );
    assertEquals(
      globalRegistry.resolve("consolidarmaterial", "pt-BR",),
      "rollupmaterial",
    );
    assertEquals(
      globalRegistry.resolve("ocultarimagem", "pt-BR",),
      "hidepicture",
    );
    assertEquals(
      globalRegistry.resolve("ocultarmaterial", "es",),
      "hidematerial",
    );
    assertEquals(
      globalRegistry.resolve("agruparmaterial", "es",),
      "rollupmaterial",
    );
    assertEquals(
      globalRegistry.resolve("ocultarimagen", "es",),
      "hidepicture",
    );
  });

  it("AST equivalente em en, pt-BR e es", () => {
    const body = (kw: ReportKeywords,): string =>
      `${kw.taskreport} tr "T" {\n` +
      `  ${kw.hidematerial} isleaf()\n` +
      `  ${kw.rollupmaterial} isleaf()\n` +
      `  ${kw.hidepicture} isleaf()\n}\n`;
    const parse = (header: string, kw: ReportKeywords,): Report => {
      const out = parseProject(header + body(kw,),);
      assertEquals(
        out.messageIds,
        [],
        `msgs=${out.messageIds.join(",",)}`,
      );
      assert(out.result !== false, "parse falhou",);
      const r = (out.result as { report(id: string,): Report | null })
        .report("tr",);
      assert(r !== null, "taskreport não registrado",);
      return r;
    };
    const enr = parse(PROJECT_HEADER, {
      taskreport: "taskreport",
      hidematerial: "hidematerial",
      rollupmaterial: "rollupmaterial",
      hidepicture: "hidepicture",
    },);
    const pt = parse(
      'language "pt-BR"\nprojeto prj "Teste" "1.0" 2026-01-01 - 2026-12-31\n',
      {
        taskreport: "relatoriotarefa",
        hidematerial: "ocultarmaterial",
        rollupmaterial: "consolidarmaterial",
        hidepicture: "ocultarimagem",
      },
    );
    const esp = parse(
      'language "es"\nproyecto prj "Test" "1.0" 2026-01-01 - 2026-12-31\n',
      {
        taskreport: "infotarea",
        hidematerial: "ocultarmaterial",
        rollupmaterial: "agruparmaterial",
        hidepicture: "ocultarimagen",
      },
    );
    for (const r of [pt, esp,]) {
      assertEquals(exprOf(r, "hideMaterial",), exprOf(enr, "hideMaterial",),);
      assertEquals(
        exprOf(r, "rollupMaterial",),
        exprOf(enr, "rollupMaterial",),
      );
      assertEquals(exprOf(r, "hidePicture",), exprOf(enr, "hidePicture",),);
    }
  });
});

interface ReportKeywords {
  taskreport: string;
  hidematerial: string;
  rollupmaterial: string;
  hidepicture: string;
}
