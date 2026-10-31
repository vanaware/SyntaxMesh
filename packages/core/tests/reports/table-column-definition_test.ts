/**
 * Testes de TableColumnDefinition + CellSettingPattern (Fase 14.4).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.4)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  CellSettingPattern,
  CellSettingPatternList,
  TableColumnDefinition,
} from "../../src/reports/table-column-definition.ts";
import { type LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { type Query, } from "../../src/query/query.ts";

function expr(match: boolean,): LogicalExpression {
  return { eval: () => match, } as unknown as LogicalExpression;
}

const anyQuery = {} as Query;

describe("CellSettingPattern (14.4)", () => {
  it("guarda setting e logExpr", () => {
    const e = expr(true,);
    const p = new CellSettingPattern("red", e,);
    assertEquals(p.setting, "red",);
    assertEquals(p.logExpr, e,);
  });

  it("aceita setting não-string", () => {
    const p = new CellSettingPattern(42, expr(false,),);
    assertEquals(p.setting, 42,);
  });
});

describe("CellSettingPatternList (14.4)", () => {
  it("addPattern acumula padrões", () => {
    const list = new CellSettingPatternList();
    list.addPattern(new CellSettingPattern("a", expr(false,),),);
    list.addPattern(new CellSettingPattern("b", expr(false,),),);
    // Sem match, getPattern retorna null mas os padrões existem.
    assertEquals(list.getPattern(anyQuery,), null,);
  });

  it("getPattern retorna o primeiro que casa", () => {
    const list = new CellSettingPatternList();
    list.addPattern(new CellSettingPattern("primeiro", expr(true,),),);
    list.addPattern(new CellSettingPattern("segundo", expr(true,),),);
    assertEquals(list.getPattern(anyQuery,), "primeiro",);
  });

  it("getPattern pula não-candidatos e casa o próximo", () => {
    const list = new CellSettingPatternList();
    list.addPattern(new CellSettingPattern("nao", expr(false,),),);
    list.addPattern(new CellSettingPattern("sim", expr(true,),),);
    list.addPattern(new CellSettingPattern("depois", expr(true,),),);
    assertEquals(list.getPattern(anyQuery,), "sim",);
  });

  it("getPattern retorna null quando ninguém casa", () => {
    const list = new CellSettingPatternList();
    list.addPattern(new CellSettingPattern("x", expr(false,),),);
    assertEquals(list.getPattern(anyQuery,), null,);
  });

  it("getPattern em lista vazia retorna null", () => {
    const list = new CellSettingPatternList();
    assertEquals(list.getPattern(anyQuery,), null,);
  });
});

describe("TableColumnDefinition (14.4)", () => {
  it("constructor guarda id e title", () => {
    const col = new TableColumnDefinition("c1", "Coluna 1",);
    assertEquals(col.id, "c1",);
    assertEquals(col.title, "Coluna 1",);
  });

  it("defaults fiéis ao Ruby", () => {
    const col = new TableColumnDefinition("c1", undefined,);
    assertEquals(col.start, null,);
    assertEquals(col.end, null,);
    assertEquals(col.content, "load",);
    assertEquals(col.scale, "week",);
    assertEquals(col.width, null,);
    assertEquals(col.listType, null,);
    assertEquals(col.timeformat1, null,);
    assertEquals(col.timeformat2, null,);
    assertEquals(col.column, null,);
    assert(col.cellText instanceof CellSettingPatternList,);
    assert(col.cellColor instanceof CellSettingPatternList,);
    assert(col.fontColor instanceof CellSettingPatternList,);
    assert(col.hAlign instanceof CellSettingPatternList,);
    assert(col.tooltip instanceof CellSettingPatternList,);
  });

  it("campos mutáveis podem ser atribuídos", () => {
    const col = new TableColumnDefinition("c1", "T",);
    col.title = "Novo";
    col.content = "cost";
    col.scale = "day";
    col.width = 120;
    assertEquals(col.title, "Novo",);
    assertEquals(col.content, "cost",);
    assertEquals(col.scale, "day",);
    assertEquals(col.width, 120,);
  });
});
