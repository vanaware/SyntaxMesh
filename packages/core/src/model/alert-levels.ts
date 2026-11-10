/**
 * AlertLevelDefinition + AlertLevelDefinitions.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/AlertLevelDefinitions.rb`. The
 * default palette is the TJ one (green → yellow → red, in ascending severity)
 * and the alert level of a `JournalEntry` is the **index** in the project list
 * (Ruby `rule_alertLevel` returns `indexById`), exactly as `Journal.rb` and the
 * `alerts_*` report filters expect.
 *
 * Configuration through the `alertlevels` directive lives in the parser
 * (`parser/rules/project.ts`), which validates uniqueness and reports a syntax
 * error with `SourceFileInfo`; this class is the model
 * (add/clear/modified/to_tjp) that `Project` keeps in `project['alertLevels']`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AlertLevelDefinitions.rb
 * @see docs/syntaxmesh/decisoes/029-journal-alertlevel.md
 */

import { TjError, } from "./errors.ts";

/**
 * One alert level: a unique id, a unique name and an HTML color
 * (#RGB/#RRGGBB).
 *
 * Ruby: `class AlertLevelDefinition < Struct.new(:id, :name, :color)` with its
 * own `to_s`.
 */
export class AlertLevelDefinition {
  /**
   * Creates an alert level.
   *
   * @param id Unique machine id.
   * @param name Unique human-readable name.
   * @param color HTML color used by the reports.
   */
  constructor(
    readonly id: string,
    readonly name: string,
    readonly color: string,
  ) {}

  /** Representation used by `AlertLevelDefinitions#to_tjp` (Ruby l.23-25). */
  to_s(): string {
    return `${this.id} '${this.name}' '${this.color}'`;
  }

  /** Idiomatic alias of {@link to_s} (used by `join` and template strings). */
  toString(): string {
    return this.to_s();
  }

  /**
   * An alert level is immutable (`readonly`): the copy returns `this` (16.13.2),
   * preserving the identity used by `indexById`/`indexByName`.
   */
  deepClone(): this {
    return this;
  }
}

/**
 * Ruby defaults (`AlertLevelDefinitions#initialize`), in ascending severity.
 */
export const DEFAULT_ALERT_LEVELS: AlertLevelDefinition[] = [
  new AlertLevelDefinition("green", "Green", "#008000",),
  new AlertLevelDefinition("yellow", "Yellow", "#BEA800",),
  new AlertLevelDefinition("red", "Red", "#C00000",),
];

/**
 * Ordered list of alert levels (Ruby `AlertLevelDefinitions`).
 *
 * It starts with the three defaults; `modified` tells whether the `alertlevels`
 * directive has already replaced the default palette.
 */
export class AlertLevelDefinitions {
  private levels: AlertLevelDefinition[] = [];
  private _modified = false;

  /** Creates the list pre-filled with the default palette. */
  constructor() {
    // Ruby l.34-43: adds the defaults and resets the `modified` flag.
    for (const level of DEFAULT_ALERT_LEVELS) {
      this.add(new AlertLevelDefinition(level.id, level.name, level.color,),);
    }
    this._modified = false;
  }

  /** Removes every level and marks the list as modified (Ruby l.46). */
  clear(): void {
    this.levels = [];
    this._modified = true;
  }

  /**
   * Adds a level; both the id **and** the name must be unique (Ruby l.52-60).
   *
   * Ruby raises `ArgumentError`; here it is a `TjError` so the parser treats it
   * as a recoverable directive error.
   *
   * @param level Level to append.
   * @throws {TjError} When `level` is not an `AlertLevelDefinition`, or when its
   *   id or name is already taken.
   */
  add(level: AlertLevelDefinition,): void {
    if (!(level instanceof AlertLevelDefinition)) {
      throw new TjError("AlertLevelDefinition expected",);
    }
    // Ruby: `if indexById(level.id) || indexByName(level.name)` — index 0 is
    // truthy in Ruby (nil means "not found"), hence the `!== null` comparison.
    if (
      this.indexById(level.id,) !== null ||
      this.indexByName(level.name,) !== null
    ) {
      throw new TjError("ID and name must be unique",);
    }
    this.levels.push(level,);
    this._modified = true;
  }

  /** `true` when the list is no longer the default one (Ruby `modified?`). */
  get modified(): boolean {
    return this._modified;
  }

  /**
   * Index of the level with `id`; `null` when unknown (Ruby `indexById`).
   *
   * @param id Machine id to look for.
   */
  indexById(id: string,): number | null {
    const i = this.levels.findIndex((l,) => l.id === id);
    return i < 0 ? null : i;
  }

  /**
   * Index of the level with `name`; `null` when unknown.
   *
   * @param name Name to look for.
   */
  indexByName(name: string,): number | null {
    const i = this.levels.findIndex((l,) => l.name === name);
    return i < 0 ? null : i;
  }

  /**
   * Index of the level with `color`; `null` when unknown.
   *
   * @param color HTML color to look for.
   */
  indexByColor(color: string,): number | null {
    const i = this.levels.findIndex((l,) => l.color === color);
    return i < 0 ? null : i;
  }

  /**
   * Level at `index`; `null` when out of range (Ruby `[]`).
   *
   * @param index Position in severity order.
   */
  get(index: number,): AlertLevelDefinition | null {
    return this.levels[index] ?? null;
  }

  /**
   * Maps the levels (Ruby `map`).
   *
   * @param fn Callback applied to each level.
   */
  map<T,>(fn: (level: AlertLevelDefinition, index: number,) => T,): T[] {
    return this.levels.map(fn,);
  }

  /**
   * Definition in TJP syntax (Ruby l.98-100):
   * `alertlevels green 'Green' '#008000',
   * yellow 'Yellow' '#BEA800',
   * red 'Red' '#C00000'`.
   */
  to_tjp(): string {
    return `alertlevels ${this.levels.join(",\n",)}`;
  }

  /** Shallow copy of the internal list (without exposing the mutable array). */
  toArray(): AlertLevelDefinition[] {
    return this.levels.slice();
  }

  /** Number of defined levels. */
  get length(): number {
    return this.levels.length;
  }

  /** Iterator over the levels (in ascending severity order). */
  [Symbol.iterator](): IterableIterator<AlertLevelDefinition> {
    return this.levels[Symbol.iterator]();
  }
}

/** Copy of the defaults (the `Project` keeps its own mutable list). */
export function defaultAlertLevels(): AlertLevelDefinition[] {
  return DEFAULT_ALERT_LEVELS.map((l,) =>
    new AlertLevelDefinition(l.id, l.name, l.color,)
  );
}

/**
 * Index of the level with `id` (Ruby `indexById`); `null` when unknown.
 *
 * @param levels Levels to search.
 * @param id Machine id to look for.
 */
export function alertLevelIndexById(
  levels: AlertLevelDefinition[],
  id: string,
): number | null {
  const i = levels.findIndex((l,) => l.id === id);
  return i < 0 ? null : i;
}

/**
 * Index of the level with `name` (Ruby `indexByName`); `null` when unknown.
 *
 * @param levels Levels to search.
 * @param name Name to look for.
 */
export function alertLevelIndexByName(
  levels: AlertLevelDefinition[],
  name: string,
): number | null {
  const i = levels.findIndex((l,) => l.name === name);
  return i < 0 ? null : i;
}

/**
 * List of ids for error messages (`Must be one of ...`, Ruby l.203).
 *
 * @param levels Levels to list.
 */
export function alertLevelIds(levels: AlertLevelDefinition[],): string[] {
  return levels.map((l,) => l.id);
}
