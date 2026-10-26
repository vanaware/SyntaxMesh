/**
 * TableColumnDefinition / CellSettingPattern (Fase 10).
 *
 * Estruturas de dados que o parser preenche para as colunas de relatórios de
 * tabela (`columns` / `columnDef` / `columnOptions`). A renderização real
 * (avaliação das expressões lógicas dos padrões de célula) pertence à
 * Fase 14; aqui mantemos apenas os valores capturados pelo parser.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TableColumnDefinition.rb
 */
import type { TjTime, } from "../time/tj-time.ts";
import type { LogicalExpression, } from "../logical/logical-expression.ts";

/** Um padrão de configuração de célula: valor + expressão seletora. */
export class CellSettingPattern {
  readonly setting: unknown;
  readonly logExpr: LogicalExpression;

  constructor(setting: unknown, logExpr: LogicalExpression,) {
    this.setting = setting;
    this.logExpr = logExpr;
  }
}

/** Lista de padrões de célula; o primeiro cuja expressão casa é usado. */
export class CellSettingPatternList {
  readonly patterns: CellSettingPattern[] = [];

  addPattern(pattern: CellSettingPattern,): void {
    this.patterns.push(pattern,);
  }
}

/** Definição de coluna de um relatório de tabela. */
export class TableColumnDefinition {
  readonly id: string;
  title: string | undefined;
  start: TjTime | null = null;
  end: TjTime | null = null;
  readonly cellText = new CellSettingPatternList();
  content = "load";
  readonly hAlign = new CellSettingPatternList();
  readonly tooltip = new CellSettingPatternList();
  readonly cellColor = new CellSettingPatternList();
  readonly fontColor = new CellSettingPatternList();
  listItem: unknown = null;
  listType: string | null = null;
  scale = "week";
  width: number | null = null;
  timeformat1: string | null = null;
  timeformat2: string | null = null;
  column: unknown = null;

  constructor(id: string, title: string | undefined,) {
    this.id = id;
    this.title = title;
  }
}
