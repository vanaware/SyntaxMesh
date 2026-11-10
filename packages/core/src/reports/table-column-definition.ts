/**
 * TableColumnDefinition / CellSettingPattern (phase 10, completed in 14.4).
 *
 * Data structures the parser fills in for the columns of table reports
 * (`columns` / `columnDef` / `columnOptions`). Evaluating the logical
 * expressions of the cell patterns (`getPattern`) belongs to phase 14.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TableColumnDefinition.rb
 */
import type { TjTime, } from "../time/tj-time.ts";
import type { LogicalExpression, } from "../logical/logical-expression.ts";
import type { Query, } from "../query/query.ts";

/** One cell configuration pattern: a value plus the expression selecting it. */
export class CellSettingPattern {
  /** Value applied to the cell when `logExpr` evaluates to true. */
  readonly setting: unknown;
  /** Selector that decides whether `setting` applies to the current cell. */
  readonly logExpr: LogicalExpression;

  /**
   * Creates a cell setting pattern.
   *
   * @param setting Value applied to the cell.
   * @param logExpr Selector deciding when the value applies.
   */
  constructor(setting: unknown, logExpr: LogicalExpression,) {
    this.setting = setting;
    this.logExpr = logExpr;
  }
}

/** List of cell patterns; the first one whose expression matches wins. */
export class CellSettingPatternList {
  /** Registered patterns, in declaration order. */
  private patterns: CellSettingPattern[] = [];

  /**
   * Appends a pattern to the end of the list.
   *
   * @param pattern Pattern to register.
   */
  addPattern(pattern: CellSettingPattern,): void {
    this.patterns.push(pattern,);
  }

  /**
   * Returns the `setting` of the first pattern whose `logExpr` matches `query`,
   * or `null` when none matches. Faithful to
   * `CellSettingPatternList#getPattern`.
   *
   * @param query Query the selectors are evaluated against.
   * @returns The matching setting, or `null` when no pattern applies.
   */
  getPattern(query: Query,): unknown | null {
    for (const pattern of this.patterns) {
      if (pattern.logExpr.eval(query,)) {
        return pattern.setting;
      }
    }
    return null;
  }
}

/** Column definition of a table report. */
export class TableColumnDefinition {
  /** Column id (`name`, `start`, `cost`, …), also used as the attribute name. */
  readonly id: string;
  /** Header title, or `undefined` to fall back to the default title. */
  title: string | undefined;
  /** First date of the column window (for the time columns). */
  start: TjTime | null = null;
  /** Last date of the column window (for the time columns). */
  end: TjTime | null = null;
  /** Patterns producing the text of the cell. */
  readonly cellText = new CellSettingPatternList();
  /** Value kind computed by the column (`load`, `effort`, `cost`, …). */
  content = "load";
  /** Patterns producing the horizontal alignment of the cell. */
  readonly hAlign = new CellSettingPatternList();
  /** Patterns producing the tooltip of the cell. */
  readonly tooltip = new CellSettingPatternList();
  /** Patterns producing the background color of the cell. */
  readonly cellColor = new CellSettingPatternList();
  /** Patterns producing the font color of the cell. */
  readonly fontColor = new CellSettingPatternList();
  /** Per-item prefix for list values (`listtype`). */
  listItem: unknown = null;
  /** List separator style: `comma`, `bullets` or `numbered`. */
  listType: string | null = null;
  /** Time scale used by the column (`week`, `month`, `quarter`, `year`). */
  scale = "week";
  /** Fixed column width in pixels, or `null` for auto sizing. */
  width: number | null = null;
  /** `strftime` format applied to the start of the cell window. */
  timeformat1: string | null = null;
  /** `strftime` format applied to the end of the cell window. */
  timeformat2: string | null = null;
  /** Resolved column descriptor for custom columns (nested columns). */
  column: unknown = null;

  /**
   * Creates a column definition.
   *
   * @param id Column id.
   * @param title Header title, or `undefined` to use the default one.
   */
  constructor(id: string, title: string | undefined,) {
    this.id = id;
    this.title = title;
  }
}
