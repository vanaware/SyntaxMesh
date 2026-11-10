/**
 * Query — retrieves any property attribute after scheduling (phase
 * 11.6–11.10).
 *
 * Faithful port of `Query.rb`. A `Query` uniquely identifies an attribute
 * (project + property + scenario + attributeId + time window) and resolves its
 * value through the `process()` pipeline: `customData` →
 * `property.query_X` → `property.data[scIdx].query_X` → base attribute. The
 * outcome is exposed by `to_s`/`to_num`/`to_sort`/`to_rti`/`result`.
 *
 * Ruby→TS pitfalls handled (cheat-sheet §8/falsy):
 *  - `scenarioIdx` 0 is truthy in Ruby but falsy in TS, so comparisons are
 *    always explicit against `undefined`, never `!scenarioIdx`.
 *  - `@start`/`@end` are kept in sync with `@startIdx`/`@endIdx` through the
 *    setters.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Query.rb
 */
import { TjTime, } from "../time/tj-time.ts";
import { RealFormat, } from "../format/real-format.ts";
import { DateAttribute, } from "../attributes/scalar/date-attribute.ts";
import { ReferenceAttribute, } from "../attributes/reference/reference-attribute.ts";
import { RichTextAttribute, } from "../attributes/rich/rich-text-attribute.ts";
import { AttributeBase, } from "../attributes/attribute-base.ts";
import { RichText, } from "../richtext/rich-text.ts";
import { TjRuntimeError, } from "../model/errors.ts";
import type { Project, } from "../model/project.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { CustomData, } from "./custom-data.ts";

/** Optional parameters of the `Query` constructor (11.6.3.2). */
export interface QueryParams {
  /** Project the query runs against. */
  project?: Project | null;
  /** Property type used to resolve `propertyId` (`Task`, `Resource`, …). */
  propertyType?: string | null;
  /** Id of the property to query; `!` prefixes walk up the hierarchy. */
  propertyId?: string | null;
  /** Already resolved property. */
  property?: PropertyTreeNode | null;
  /** Property type used to resolve `scopePropertyId`. */
  scopePropertyType?: string | null;
  /** Id of the scope property. */
  scopePropertyId?: string | null;
  /** Already resolved scope property. */
  scopeProperty?: PropertyTreeNode | null;
  /** Attribute to read (`start`, `effort`, `cost`, …). */
  attributeId?: string | null;
  /** Scenario name; resolved to `scenarioIdx` during `process()`. */
  scenario?: string | null;
  /** Scenario index, when already known. */
  scenarioIdx?: number | undefined;
  /** Window start. */
  start?: TjTime | null;
  /** Window end. */
  end?: TjTime | null;
  /** Window start as a scheduling slot index. */
  startIdx?: number | null;
  /** Window end as a scheduling slot index. */
  endIdx?: number | null;
  /** Output unit used by `scaleDuration`/`scaleLoad`. */
  loadUnit?: string | null;
  /** Number format for numeric output. */
  numberFormat?: RealFormat | null;
  /** Number format for monetary output. */
  currencyFormat?: RealFormat | null;
  /** `strftime` format for dates. */
  timeFormat?: string | null;
  /** Per-item prefix used by `assignList`. */
  listItem?: string | null;
  /** List separator style: `comma`, `bullets` or `numbered`. */
  listType?: string | null;
  /** Hides journal entries from `query_journalmessages`. */
  hideJournalEntry?: unknown;
  // SyntaxMesh extension (14C.6.5): hiding of materials/pictures and material
  // consolidation, companions of `hideJournalEntry`.
  /** Hides material lines in reports. */
  hideMaterial?: unknown;
  /** Rolls material values up to the owning task. */
  rollupMaterial?: unknown;
  /** Hides picture lines in reports. */
  hidePicture?: unknown;
  /** Journal rendering mode (`journal` or `status`). */
  journalMode?: string | null;
  /** Journal attributes to include in the output. */
  journalAttributes?: string[] | null;
  /** Sorts the journal entries before rendering. */
  sortJournalEntries?: unknown;
  /** Cost account filter. */
  costAccount?: string | null;
  /** Revenue account filter. */
  revenueAccount?: string | null;
  /** Renders HTML as a standalone document. */
  selfContained?: boolean;
}

/** Long unit names used by `scaleValue` when the unit is `longauto`. */
const LONG_UNITS_SINGULAR = [
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "quarter",
  "year",
];
const LONG_UNITS_PLURAL = [
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
  "quarters",
  "years",
];
const SHORT_UNITS = ["min", "h", "d", "w", "m", "q", "y",];
const FIXED_UNITS = [
  "minutes",
  "hours",
  "days",
  "weeks",
  "months",
  "quarters",
  "years",
];

/** Project attributes supported by step b of `process` (11.7.1.4). */
const PROJECT_ATTRS = [
  "copyright",
  "currency",
  "end",
  "journal",
  "name",
  "now",
  "projectid",
  "start",
  "version",
];

/** Reads an object member as a function (the equivalent of `respond_to?`). */
function asMethod(
  obj: unknown,
  key: string,
): ((...args: unknown[]) => unknown) | undefined {
  const m = (obj as Record<string, unknown> | null | undefined)?.[key];
  return typeof m === "function"
    ? (m as (...args: unknown[]) => unknown)
    : undefined;
}

/**
 * A single attribute lookup after scheduling.
 *
 * Instances are cheap and meant to be reused: `process()` fills the result
 * fields, the accessors read them, and `reset()` (called at the start of every
 * `process()`) clears them.
 */
export class Query {
  // Project/property fields (11.6.1.2)
  /** Project the query runs against; filled in lazily from `property`. */
  project: Project | null;
  /** Property type used to resolve `propertyId`. */
  propertyType: string | null;
  /** Id of the property to query. */
  propertyId: string | null;
  /** Resolved property the attribute is read from. */
  property: PropertyTreeNode | null;
  /** Property type used to resolve `scopePropertyId`. */
  scopePropertyType: string | null;
  /** Id of the scope property. */
  scopePropertyId: string | null;
  /** Resolved scope property. */
  scopeProperty: PropertyTreeNode | null;
  // Attribute/scenario fields (11.6.1.3)
  /** Attribute being read. */
  attributeId: string | null;
  /** Scenario name as declared. */
  scenario: string | null;
  /** Scenario index; `undefined` until resolved. */
  scenarioIdx: number | undefined;
  // Private time fields kept in sync (11.6.1.4 / 11.6.2)
  private _start: TjTime | null = null;
  private _end: TjTime | null = null;
  private _startIdx: number | null = null;
  private _endIdx: number | null = null;
  // Formatting fields (11.6.1.5)
  /** Output unit used by `scaleDuration`/`scaleLoad`. */
  loadUnit: string | null;
  /** Number format for numeric output. */
  numberFormat: RealFormat | null;
  /** Number format for monetary output. */
  currencyFormat: RealFormat | null;
  /** `strftime` format for dates. */
  timeFormat: string | null;
  // List fields (11.6.1.6)
  /** Per-item prefix used by `assignList`. */
  listItem: string | null;
  /** List separator style. */
  listType: string | null;
  // Journal fields (11.6.1.7)
  /** Hides journal entries from the journal queries. */
  hideJournalEntry: unknown;
  // SyntaxMesh extension (14C.6.5)
  /** Hides material lines in reports. */
  hideMaterial: unknown;
  /** Rolls material values up to the owning task. */
  rollupMaterial: unknown;
  /** Hides picture lines in reports. */
  hidePicture: unknown;
  /** Journal rendering mode. */
  journalMode: string | null;
  /** Journal attributes included in the output. */
  journalAttributes: string[] | null;
  /** Sorts journal entries before rendering. */
  sortJournalEntries: unknown;
  // Account fields (11.6.1.8)
  /** Cost account filter. */
  costAccount: string | null;
  /** Revenue account filter. */
  revenueAccount: string | null;
  // Miscellaneous fields (11.6.1.9)
  /** Renders HTML as a standalone document. */
  selfContained: boolean;
  // Result fields (11.6.1.10)
  /** Whether the last `process()` succeeded. */
  ok: boolean = true;
  /** Message describing the last failure, or `null`. */
  errorMessage: string | null = null;
  /** Base attribute resolved by the last `process()`, when the fallback ran. */
  attr: AttributeBase<unknown> | null = null;
  /** Numeric result produced by a `query_*` handler. */
  numerical: unknown = null;
  /** Sort key produced by a `query_*` handler. */
  sortable: unknown = null;
  /** String result produced by a `query_*` handler. */
  string: string | null = null;
  /** Rich-text result produced by a `query_*` handler. */
  rti: unknown = null;
  // customData (11.6.1.11)
  /** Pseudo-attributes injected by the caller, keyed by attribute id. */
  customData: Map<string, CustomData>;

  /**
   * Creates a query from a bag of optional parameters.
   *
   * `start`/`end`/`startIdx`/`endIdx` go through the setters so both
   * representations stay in sync, in Ruby's order: end, endIdx, start,
   * startIdx.
   *
   * @param params Field values to initialize; everything else defaults to
   *   `null` (or `false` for `selfContained`).
   */
  constructor(params: QueryParams = {},) {
    this.project = params.project ?? null;
    this.propertyType = params.propertyType ?? null;
    this.propertyId = params.propertyId ?? null;
    this.property = params.property ?? null;
    this.scopePropertyType = params.scopePropertyType ?? null;
    this.scopePropertyId = params.scopePropertyId ?? null;
    this.scopeProperty = params.scopeProperty ?? null;
    this.attributeId = params.attributeId ?? null;
    this.scenario = params.scenario ?? null;
    this.scenarioIdx = params.scenarioIdx;
    this.loadUnit = params.loadUnit ?? null;
    this.numberFormat = params.numberFormat ?? null;
    this.currencyFormat = params.currencyFormat ?? null;
    this.timeFormat = params.timeFormat ?? null;
    this.listItem = params.listItem ?? null;
    this.listType = params.listType ?? null;
    this.hideJournalEntry = params.hideJournalEntry ?? null;
    this.hideMaterial = params.hideMaterial ?? null;
    this.rollupMaterial = params.rollupMaterial ?? null;
    this.hidePicture = params.hidePicture ?? null;
    this.journalMode = params.journalMode ?? null;
    this.journalAttributes = params.journalAttributes ?? null;
    this.sortJournalEntries = params.sortJournalEntries ?? null;
    this.costAccount = params.costAccount ?? null;
    this.revenueAccount = params.revenueAccount ?? null;
    this.selfContained = params.selfContained ?? false;
    this.customData = new Map();

    // start/end/startIdx/endIdx go through the setters to stay in sync.
    // Ruby order: end, endIdx, start, startIdx.
    if (params.end) this.end = params.end;
    if (params.endIdx !== null && params.endIdx !== undefined) {
      this.endIdx = params.endIdx;
    }
    if (params.start) this.start = params.start;
    if (params.startIdx !== null && params.startIdx !== undefined) {
      this.startIdx = params.startIdx;
    }

    this.reset();
  }

  // --------------------------------------------------
  // Synchronized getters/setters (11.6.2)
  // --------------------------------------------------
  /**
   * Window start; assigning it also recomputes `startIdx` from the project.
   */
  get start(): TjTime | null {
    return this._start;
  }
  set start(date: TjTime | null,) {
    if (!(date instanceof TjTime)) {
      throw new Error(`Unsupported type ${typeof date}`,);
    }
    this._start = date;
    this._startIdx = this.project ? this.project.dateToIdx(date,) : null;
  }

  /**
   * Window end; assigning it also recomputes `endIdx` from the project.
   */
  get end(): TjTime | null {
    return this._end;
  }
  set end(date: TjTime | null,) {
    if (!(date instanceof TjTime)) {
      throw new Error(`Unsupported type ${typeof date}`,);
    }
    this._end = date;
    this._endIdx = this.project ? this.project.dateToIdx(date,) : null;
  }

  /**
   * Window start as a slot index; assigning it also recomputes `start`.
   */
  get startIdx(): number | null {
    return this._startIdx;
  }
  set startIdx(idx: number | null,) {
    if (typeof idx !== "number") {
      throw new Error(`Unsupported type ${typeof idx}`,);
    }
    this._startIdx = idx;
    this._start = this.project ? this.project.idxToDate(idx,) : null;
  }

  /**
   * Window end as a slot index; assigning it also recomputes `end`.
   */
  get endIdx(): number | null {
    return this._endIdx;
  }
  set endIdx(idx: number | null,) {
    if (typeof idx !== "number") {
      throw new Error(`Unsupported type ${typeof idx}`,);
    }
    this._endIdx = idx;
    this._end = this.project ? this.project.idxToDate(idx,) : null;
  }

  // --------------------------------------------------
  // dup + reset (11.6.3)
  // --------------------------------------------------
  /** Copy with a fresh `customData` map and reset results (11.6.3.3). */
  dup(): Query {
    const q = new Query();
    q.project = this.project;
    q.propertyType = this.propertyType;
    q.propertyId = this.propertyId;
    q.property = this.property;
    q.scopePropertyType = this.scopePropertyType;
    q.scopePropertyId = this.scopePropertyId;
    q.scopeProperty = this.scopeProperty;
    q.attributeId = this.attributeId;
    q.scenario = this.scenario;
    q.scenarioIdx = this.scenarioIdx;
    q._start = this._start;
    q._end = this._end;
    q._startIdx = this._startIdx;
    q._endIdx = this._endIdx;
    q.loadUnit = this.loadUnit;
    q.numberFormat = this.numberFormat;
    q.currencyFormat = this.currencyFormat;
    q.timeFormat = this.timeFormat;
    q.listItem = this.listItem;
    q.listType = this.listType;
    q.hideJournalEntry = this.hideJournalEntry;
    q.hideMaterial = this.hideMaterial;
    q.rollupMaterial = this.rollupMaterial;
    q.hidePicture = this.hidePicture;
    q.journalMode = this.journalMode;
    q.journalAttributes = this.journalAttributes;
    q.sortJournalEntries = this.sortJournalEntries;
    q.costAccount = this.costAccount;
    q.revenueAccount = this.revenueAccount;
    q.selfContained = this.selfContained;
    // customData is copied by value reference (a new Map).
    q.customData = new Map(this.customData,);
    return q;
  }

  /** Clears the result fields so the query can be reused (11.6.3.4). */
  private reset(): void {
    this.attr = null;
    this.numerical = null;
    this.sortable = null;
    this.string = null;
    this.rti = null;
    this.ok = true;
    this.errorMessage = null;
  }

  /**
   * Injects a pseudo-attribute result (11.10.9).
   *
   * @param name Attribute id the data answers for.
   * @param data Pre-computed result.
   */
  setCustomData(name: string, data: CustomData,): void {
    this.customData.set(name, data,);
  }

  // --------------------------------------------------
  // process (11.7)
  // --------------------------------------------------
  /**
   * Resolves the queried attribute into the result fields.
   *
   * The pipeline mirrors Ruby's `Query#process`: resolve the property (step a),
   * handle project attributes (step b), resolve the scope property (step c),
   * adopt the property's project (step d), resolve `scenario` to `scenarioIdx`
   * (step e), then take the value from `customData` (step g),
   * `property.query_X` (step h), `ScenarioData.query_X` (step i) or the base
   * attribute (step j).
   *
   * @returns `true` when a value was resolved; `false` when `ok` is `false` and
   *   `errorMessage` explains why.
   */
  process(): boolean {
    this.reset();
    try {
      // Step a: resolve the property reference from the property id.
      if (
        this.propertyId && (this.property === null ||
          this.propertyId[0] === "!")
      ) {
        this.property = this.resolvePropertyId(
          this.propertyType,
          this.propertyId,
        );
        if (!this.property) {
          this.errorMessage = `Unknown property '${this.propertyId}' queried`;
          this.ok = false;
          return false;
        }
      }

      if (!this.property) {
        // Without a property: project attribute.
        if (!this.attributeId || !PROJECT_ATTRS.includes(this.attributeId,)) {
          this.errorMessage =
            `Unsupported project attribute '${this.attributeId}'`;
          this.ok = false;
          return false;
        }
        let attr: unknown = null;
        const method = this.project ?
          asMethod(this.project, this.attributeId,) :
          undefined;
        if (method && this.project) {
          method.call(this.project, this,);
        } else if (this.project) {
          attr = this.project.get(this.attributeId,);
        }
        if (attr instanceof TjTime) {
          this.sortable = attr;
          this.numerical = attr;
          this.string = attr.to_s(this.timeFormat ?? undefined,);
        } else {
          this.sortable = attr;
          this.string = attr === null || attr === undefined
            ? null
            : String(attr,);
        }
        this.ok = true;
        return true;
      }

      // Step c: resolve the scope property.
      if (!this.scopeProperty && this.scopePropertyId) {
        this.scopeProperty = this.resolvePropertyId(
          this.scopePropertyType,
          this.scopePropertyId,
        );
        if (!this.scopeProperty) {
          this.errorMessage =
            `Unknown scope property ${this.scopePropertyId} queried`;
          this.ok = false;
          return false;
        }
      }

      // Step d: make sure there is a project reference.
      if (!this.project) this.project = this.property.project as Project;

      // Step e: resolve scenarioIdx from scenario.
      if (this.scenario && this.scenarioIdx === undefined) {
        const idx = this.project.scenarioIdx(this.scenario,);
        if (idx === undefined) {
          throw new Error(`Query cannot resolve scenario '${this.scenario}'`,);
        }
        this.scenarioIdx = idx;
      }

      const attributeId = this.attributeId ?? "";
      const queryMethodName = "query_" + attributeId;
      const data = this.customData.get(attributeId,);
      if (data) {
        // Step g: customData has priority.
        this.sortable = data.sortable ?? null;
        this.numerical = data.numerical ?? null;
        this.string = data.string ?? null;
        this.rti = data.rti ?? null;
      } else {
        const propMethod = asMethod(this.property, queryMethodName,);
        if (propMethod) {
          // Step h: query_X on the property.
          propMethod.call(this.property, this,);
        } else {
          const scenarioData = this.scenarioIdx !== undefined
            ? this.property.data[this.scenarioIdx] :
            undefined;
          const dataMethod = scenarioData
            ? asMethod(scenarioData, queryMethodName,) :
            undefined;
          if (this.scenarioIdx !== undefined && dataMethod) {
            // Step i: query_X on the ScenarioData (scenario-specific).
            dataMethod.call(scenarioData, this,);
          } else {
            // Step j: base attribute.
            this.processBaseAttribute(attributeId,);
            if (!this.ok) return false;
          }
        }
      }
    } catch (e) {
      if (e instanceof TjRuntimeError) {
        this.errorMessage = e.message;
        this.ok = false;
        return false;
      }
      throw e;
    }
    this.ok = true;
    return true;
  }

  /** Fallback to the base attribute inside `process` (11.7.2.5–9). */
  private processBaseAttribute(attributeId: string,): void {
    const property = this.property!;
    const aType = property.attributeDefinition(attributeId,);
    if (!aType) {
      this.errorMessage = `Unknown attribute '${attributeId}' queried`;
      this.ok = false;
      return;
    }
    const scIdx = aType.isScenarioAttribute ? this.scenarioIdx : undefined;
    this.attr = property.getAttribute(attributeId, scIdx,);
    if (this.attr instanceof DateAttribute && !this.attr.get()) {
      this.errorMessage =
        `Attribute '${attributeId}' of property '${property.fullId}' ` +
        "has undefined value.";
      this.ok = false;
    }
  }

  // --------------------------------------------------
  // accessors (11.8)
  // --------------------------------------------------
  /** String representation of the result. */
  to_s(): string {
    if (this.attr) return this.attr.to_s();
    if (this.rti) {
      const r = this.rti as { to_s?(): string };
      return typeof r.to_s === "function" ? r.to_s() : String(this.rti,);
    }
    return this.string ?? "";
  }

  /** Numeric representation of the result, or `null` when it has none. */
  to_num(): number | null {
    if (this.attr) return this.attr.to_num();
    return typeof this.numerical === "number" ? this.numerical : null;
  }

  /** Sort key of the result. */
  to_sort(): unknown {
    return this.attr ? this.attr.to_sort() : this.sortable;
  }

  /** Rich-text intermediate of the result. */
  to_rti(): unknown {
    if (this.attr instanceof RichTextAttribute) return this.attr.get();
    // Ruby passes the query itself (`attr.to_rti(self)`): lists use
    // `listItem`/`assignList` and keep the per-item re-evaluated query (14C.9).
    return this.attr ? this.attr.to_rti(this,) : this.rti;
  }

  /**
   * Raw result: the attribute value first, then `numerical`, `rti` and
   * `string`.
   *
   * A reference attribute returns only its first element, so callers do not
   * have to unwrap the list themselves.
   */
  result(): unknown {
    if (this.attr) {
      const v = this.attr.get();
      if (this.attr instanceof ReferenceAttribute && Array.isArray(v,)) {
        return v[0];
      }
      return v;
    } else if (this.numerical !== null && this.numerical !== undefined) {
      return this.numerical;
    } else if (this.rti) {
      return this.rti;
    }
    return this.string;
  }

  // --------------------------------------------------
  // scale + assignList (11.9)
  // --------------------------------------------------
  /**
   * Scales a duration (in slots) to `loadUnit` using time factors.
   *
   * @param value Duration in slots.
   */
  scaleDuration(value: number,): string {
    return this.scaleValue(value, [
      24 * 60,
      24,
      1,
      1.0 / 7,
      1.0 / 30.42,
      1.0 / 91.25,
      1.0 / 365,
    ],);
  }

  /**
   * Scales a load to `loadUnit` using the project working-day factors.
   *
   * @param value Load in slots.
   */
  scaleLoad(value: number,): string {
    const project = this.project!;
    return this.scaleValue(value, [
      project.dailyWorkingHours() * 60,
      project.dailyWorkingHours(),
      1.0,
      1.0 / project.weeklyWorkingDays(),
      1.0 / project.monthlyWorkingDays(),
      1.0 / (project.yearlyWorkingDays() / 4),
      1.0 / project.yearlyWorkingDays(),
    ],);
  }

  /** Value-scaling algorithm with auto/fixed units (11.9.1).
   *
   * @param value Value to scale.
   * @param factors Per-unit multipliers, from smallest to largest unit.
   */
  scaleValue(value: number, factors: number[],): string {
    const numberFormat = this.numberFormat ??
      new RealFormat(["-", "", "", ".", 2,],);
    if (this.loadUnit === "shortauto" || this.loadUnit === "longauto") {
      const options: (string | null)[] = [];
      const delta: number[] = [];
      const max: (number | null)[] = [60, 48, null, 8, 24, 0, null,];
      const stdFormat = new RealFormat([
        "-",
        "",
        "",
        ".",
        numberFormat.fractionDigits,
      ],);
      const fSep = numberFormat.fractionSeparator;
      let i = 0;
      for (const factor of factors) {
        const scaledValue = value * factor;
        const str = numberFormat.format(scaledValue,);
        const stdStr = stdFormat.format(scaledValue,);
        delta[i] = Math.abs(scaledValue - parseFloat(stdStr,),);
        if (
          (factor !== 1.0 && /^[0.]*$/.test(stdStr,)) ||
          (max[i] !== null && scaledValue > max[i]!)
        ) {
          options.push(null,);
        } else {
          options.push(str,);
        }
        i++;
      }

      let shortest = 2;
      for (let j = 0; j < delta.length; j++) {
        const dj = delta[j];
        const dmin = delta[shortest];
        if (
          options[j] != null && dj !== undefined && dmin !== undefined &&
          dj < dmin
        ) {
          shortest = j;
        }
      }
      for (let j = 0; j < 6; j++) {
        const o = options[j];
        const cur = options[shortest];
        if (
          o && cur && o.slice(0, 2,) !== "0" + fSep && o.length < cur.length
        ) {
          shortest = j;
        }
      }

      let str = options[shortest] ?? "";
      if (this.loadUnit === "longauto") {
        const units = str === "1" ? LONG_UNITS_SINGULAR : LONG_UNITS_PLURAL;
        str += " " + units[shortest];
      } else {
        str += " " + SHORT_UNITS[shortest];
      }
      return str;
    }
    const idx = FIXED_UNITS.indexOf(this.loadUnit ?? "days",);
    return numberFormat.format(value * (factors[idx] ?? 1),);
  }

  /** Builds a list out of items (11.9.3).
   *
   * @param listItems Items to join according to `listType`.
   */
  assignList(listItems: string[],): void {
    let list = "";
    for (const item of listItems) {
      switch (this.listType) {
        case null:
        case undefined:
        case "comma": {
          if (list.length > 0) list += ", ";
          list += item;
          break;
        }
        case "bullets": {
          list += `* ${item}\n`;
          break;
        }
        case "numbered": {
          list += `# ${item}\n`;
          break;
        }
        default: {
          if (list.length > 0) list += ", ";
          list += item;
        }
      }
    }
    this.sortable = list;
    this.string = list;
    // Ruby (`Query#assignList`): the assembled text becomes an RTI of its own.
    // That is what the reports consume when rendering a list column.
    this.rti = new RichText(list,).generateIntermediateFormat();
  }

  // --------------------------------------------------
  // resolvePropertyId (11.10)
  // --------------------------------------------------
  /**
   * Resolves a property reference into a node.
   *
   * `!` prefixes walk up the hierarchy from the current property; otherwise
   * `pType` selects the property set to search.
   *
   * @param pType Property set to search (`Task`, `Resource`, `Account`, …).
   * @param pId Id to resolve, or `null` to keep the current property.
   * @returns The resolved node, or `null` when it does not exist.
   * @throws {Error} When there is no project, or when `pType` is unknown.
   */
  resolvePropertyId(
    pType: string | null,
    pId: string | null,
  ): PropertyTreeNode | null {
    if (!this.project) {
      throw new Error("Need Project reference to process the query",);
    }
    if (!pId) return this.property;
    if (pId[0] === "!") {
      // Each '!' climbs one level from the current property.
      let property = this.property;
      for (const c of pId) {
        if (c === "!") property = property?.parent ?? null;
        if (!property) break;
      }
      return property;
    }
    switch (pType) {
      case "Account":
        return this.project.account(pId,);
      case "Task":
        return this.project.task(pId,);
      case "Resource":
        return this.project.resource(pId,);
      case "Material":
        // SyntaxMesh extension (14C.1.20): materials are query "points"
        // like tasks/resources, with attributes of their own (`unit`, `cost`, …).
        return this.project.material(pId,);
      default:
        throw new Error(`Unknown property type ${pType}`,);
    }
  }
}
