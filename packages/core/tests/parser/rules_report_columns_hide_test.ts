/**
 * C3.7 — colunas novas + `hidejournalentry` no parser de reports.
 *
 * C3.7.1: `materials`/`charges`/`pictures`/`timebasis` (e as já existentes
 * `note`/`journal`/`resources`) são nomes de coluna válidos em `columns`.
 * C3.7.2: `hidejournalentry <expr>` é aceito na gramática (a avaliação da
 * expressão é Fase 11; aqui validamos apenas o attach do LogicalExpression).
 *
 * A execução dos relatórios é Fase 14 — o parser só aceita/registra.
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

describe("C3.7.1 colunas novas em report", () => {
  it("aceita materials, charges, pictures, timebasis em breakdownreport", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'breakdownreport br "B" {\n  columns materials, charges, pictures, timebasis\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const r = parser.project!.report("br",) as Report;
    assert(r !== null, "breakdownreport não registrado",);
    assertEquals(
      colIds(r,),
      ["materials", "charges", "pictures", "timebasis",],
    );
  });

  it("aceita note, journal, resources (nomes já existentes)", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'taskreport tr "T" {\n  columns bsi, note, journal, resources\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const r = parser.project!.report("tr",) as Report;
    assert(r !== null, "taskreport não registrado",);
    assertEquals(
      colIds(r,),
      ["bsi", "note", "journal", "resources",],
    );
  });
});

describe("C3.7.2 hidejournalentry", () => {
  it("aceita hidejournalentry <expr> e attacha LogicalExpression", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'breakdownreport br "B" {\n  columns name\n  hidejournalentry isleaf()\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const r = parser.project!.report("br",) as Report;
    const expr = r.get("hideJournalEntry",) as
      | { toString: () => string }
      | null;
    assert(expr !== null, "hideJournalEntry não definido",);
    assertEquals(expr.toString(), "isleaf()",);
  });
});
