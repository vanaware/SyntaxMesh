/**
 * Testes de TableColumnSorter (Fase 14.5).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.5)
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { TableColumnSorter, } from "../../src/reports/table-column-sorter.ts";

describe("TableColumnSorter (14.5)", () => {
  it("constructor inicia discontinuedColumns como null", () => {
    const s = new TableColumnSorter([["A",],],);
    assertEquals(s.discontinuedColumns, null,);
  });

  it("não modifica a tabela antiga", () => {
    const table = [["A", "B",], [1, 2,],];
    new TableColumnSorter(table,).sort(["B", "A",],);
    assertEquals(table, [["A", "B",], [1, 2,],],);
  });

  it("reordena colunas conforme novos cabeçalhos", () => {
    const s = new TableColumnSorter([["A", "B", "C",], [1, 2, 3,],],);
    const out = s.sort(["C", "A", "B",],);
    assertEquals(out[0], ["C", "A", "B",],);
    assertEquals(out[1], [3, 1, 2,],);
    assertEquals(s.discontinuedColumns, 0,);
  });

  it("preserva várias linhas de dados", () => {
    const s = new TableColumnSorter([
      ["A", "B",],
      [1, 2,],
      [3, 4,],
    ],);
    const out = s.sort(["B", "A",],);
    assertEquals(out, [
      ["B", "A",],
      [2, 1,],
      [4, 3,],
    ],);
  });

  it("mantém a ordem quando cabeçalhos são idênticos", () => {
    const s = new TableColumnSorter([["A", "B",], [1, 2,],],);
    assertEquals(s.sort(["A", "B",],), [["A", "B",], [1, 2,],],);
  });

  it("coluna descontinuada vai para o fim", () => {
    const s = new TableColumnSorter([["A", "B", "C",], [1, 2, 3,],],);
    const out = s.sort(["C", "A",],);
    assertEquals(out[0], ["C", "A", "B",],);
    assertEquals(out[1], [3, 1, 2,],);
    assertEquals(s.discontinuedColumns, 1,);
  });

  it("múltiplas descontinuadas preservam ordem de aparição", () => {
    const s = new TableColumnSorter([
      ["A", "B", "C", "D",],
      [1, 2, 3, 4,],
    ],);
    const out = s.sort(["C", "A",],);
    assertEquals(out[0], ["C", "A", "B", "D",],);
    assertEquals(s.discontinuedColumns, 2,);
  });

  it("coluna nova é preenchida com null", () => {
    const s = new TableColumnSorter([["A", "B",], [1, 2,],],);
    const out = s.sort(["B", "A", "C",],);
    assertEquals(out[0], ["B", "A", "C",],);
    assertEquals(out[1], [2, 1, null,],);
    assertEquals(s.discontinuedColumns, 0,);
  });

  it("coluna nova em tabela de múltiplas linhas fica null em todas", () => {
    const s = new TableColumnSorter([
      ["A",],
      [10,],
      [20,],
    ],);
    const out = s.sort(["A", "Z",],);
    assertEquals(out, [["A", "Z",], [10, null,], [20, null,],],);
  });
});
