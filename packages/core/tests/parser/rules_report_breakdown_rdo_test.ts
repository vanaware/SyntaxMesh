/**
 * C3.5/C3.6 — parser aceita `breakdownreport` e `rdoreport`.
 *
 * Cobre C3.5.1/C3.5.2 (breakdownreport + dispatch + groupby) e
 * C3.6.1/C3.6.2/C3.6.3 (rdoreport + period obrigatório + dispatch).
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import type { Report, } from "../../src/model/report.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** IDs das colunas de um relatório. */
function colIds(r: Report,): string[] {
  const cols = (r.get("columns",) as unknown as Array<{ id: string }>) ?? [];
  return cols.map((c,) => c.id);
}

describe("C3.5 breakdownreport", () => {
  it("breakdownreport registra tipo + groupby + colunas", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'breakdownreport br "B" {\n' +
        "  groupby task\n" +
        "  period 2026-01-01 - 2026-03-31\n" +
        "  formats html\n" +
        "  columns name, effort\n" +
        "}\n",
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const r = parser.project!.report("br",) as Report;
    assert(r !== null, "breakdownreport não registrado",);
    assertEquals(r.typeSpec, "breakdownreport",);
    assertEquals(r.get("groupby",), "task",);
    assertEquals(colIds(r,), ["name", "effort",],);
  });

  it("breakdownreport default groupby = account", () => {
    const { parser, threw, messageIds, } = parseProject(
      PROJECT_HEADER + 'breakdownreport br "B" {\ncolumns name\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    const r = parser.project!.report("br",) as Report;
    assertEquals(r.get("groupby",), "account",);
  });
});

describe("C3.6 rdoreport", () => {
  it("rdoreport com period aceita groupby/maxpictures", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'rdoreport rdo "R" {\n' +
        "  period 2026-01-01 - 2026-01-31\n" +
        "  groupby date\n" +
        "  maxpictures 5\n" +
        "  columns name\n" +
        "}\n",
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const r = parser.project!.report("rdo",) as Report;
    assert(r !== null, "rdoreport não registrado",);
    assertEquals(r.typeSpec, "rdoreport",);
    assertEquals(r.get("groupby",), "date",);
    assertEquals(r.get("maxpictures",), 5,);
  });

  it("rdoreport sem period dispara rdo_period_required", () => {
    const { messageIds, threw, } = parseProject(
      PROJECT_HEADER + 'rdoreport rdo "R" {\ncolumns name\n}\n',
    );
    assertEquals(threw, null,);
    assert(
      messageIds.includes("rdo_period_required",),
      `esperado rdo_period_required, obtido ${messageIds.join(",",)}`,
    );
  });
});
