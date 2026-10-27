/**
 * Query — recupera qualquer atributo de propriedade após o scheduling
 * (Fase 11.6–11.10).
 *
 * Port fiel de `Query.rb`. Uma `Query` identifica de forma única um atributo
 * (projeto + propriedade + cenário + attributeId + janela temporal) e resolve o
 * seu valor via pipeline `process()`: `customData` → `property.query_X` →
 * `property.data[scIdx].query_X` → atributo base. O resultado é exposto por
 * `to_s`/`to_num`/`to_sort`/`to_rti`/`result`.
 *
 * Pitfalls Ruby→TS tratados (cheat-sheet §8/falsy):
 *  - `scenarioIdx` 0 é truthy em Ruby mas falsy em TS → comparações explícitas
 *    com `undefined`, nunca `!scenarioIdx`.
 *  - `@start`/`@end` sincronizados com `@startIdx`/`@endIdx` via setters.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Query.rb
 */
import { TjTime, } from "../time/tj-time.ts";
import { RealFormat, } from "../format/real-format.ts";
import { DateAttribute, } from "../attributes/scalar/date-attribute.ts";
import { ReferenceAttribute, } from "../attributes/reference/reference-attribute.ts";
import { RichTextAttribute, } from "../attributes/rich/rich-text-attribute.ts";
import { AttributeBase, } from "../attributes/attribute-base.ts";
import { TjRuntimeError, } from "../model/errors.ts";
import type { Project, } from "../model/project.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { CustomData, } from "./custom-data.ts";

/** Parâmetros opcionais do constructor de `Query` (11.6.3.2). */
export interface QueryParams {
  project?: Project | null;
  propertyType?: string | null;
  propertyId?: string | null;
  property?: PropertyTreeNode | null;
  scopePropertyType?: string | null;
  scopePropertyId?: string | null;
  scopeProperty?: PropertyTreeNode | null;
  attributeId?: string | null;
  scenario?: string | null;
  scenarioIdx?: number | undefined;
  start?: TjTime | null;
  end?: TjTime | null;
  startIdx?: number | null;
  endIdx?: number | null;
  loadUnit?: string | null;
  numberFormat?: RealFormat | null;
  currencyFormat?: RealFormat | null;
  timeFormat?: string | null;
  listItem?: string | null;
  listType?: string | null;
  hideJournalEntry?: unknown;
  journalMode?: string | null;
  journalAttributes?: string[] | null;
  sortJournalEntries?: unknown;
  costAccount?: string | null;
  revenueAccount?: string | null;
  selfContained?: boolean;
}

/** Lista de unidades longas para `scaleValue` (longauto). */
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

/** Atributos de projeto suportados no passo b de `process` (11.7.1.4). */
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

/** Recupera um membro de objeto como função (equivalente a `respond_to?`). */
function asMethod(
  obj: unknown,
  key: string,
): ((...args: unknown[]) => unknown) | undefined {
  const m = (obj as Record<string, unknown> | null | undefined)?.[key];
  return typeof m === "function"
    ? (m as (...args: unknown[]) => unknown)
    : undefined;
}

/** Compara dois índices de unidade pelo comprimento da string (scaleValue). */
export class Query {
  // Campos de projeto/propriedade (11.6.1.2)
  project: Project | null;
  propertyType: string | null;
  propertyId: string | null;
  property: PropertyTreeNode | null;
  scopePropertyType: string | null;
  scopePropertyId: string | null;
  scopeProperty: PropertyTreeNode | null;
  // Campos de atributo/cenário (11.6.1.3)
  attributeId: string | null;
  scenario: string | null;
  scenarioIdx: number | undefined;
  // Campos privados de tempo sincronizados (11.6.1.4 / 11.6.2)
  private _start: TjTime | null = null;
  private _end: TjTime | null = null;
  private _startIdx: number | null = null;
  private _endIdx: number | null = null;
  // Campos de formatação (11.6.1.5)
  loadUnit: string | null;
  numberFormat: RealFormat | null;
  currencyFormat: RealFormat | null;
  timeFormat: string | null;
  // Campos de lista (11.6.1.6)
  listItem: string | null;
  listType: string | null;
  // Campos de journal (11.6.1.7)
  hideJournalEntry: unknown;
  journalMode: string | null;
  journalAttributes: string[] | null;
  sortJournalEntries: unknown;
  // Campos de contas (11.6.1.8)
  costAccount: string | null;
  revenueAccount: string | null;
  // Campos diversos (11.6.1.9)
  selfContained: boolean;
  // Campos de resultado (11.6.1.10)
  ok: boolean = true;
  errorMessage: string | null = null;
  attr: AttributeBase<unknown> | null = null;
  numerical: unknown = null;
  sortable: unknown = null;
  string: string | null = null;
  rti: unknown = null;
  // customData (11.6.1.11)
  customData: Map<string, CustomData>;

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
    this.journalMode = params.journalMode ?? null;
    this.journalAttributes = params.journalAttributes ?? null;
    this.sortJournalEntries = params.sortJournalEntries ?? null;
    this.costAccount = params.costAccount ?? null;
    this.revenueAccount = params.revenueAccount ?? null;
    this.selfContained = params.selfContained ?? false;
    this.customData = new Map();

    // start/end/startIdx/endIdx passam pelos setters para sincronizar.
    // Ordem do Ruby: end, endIdx, start, startIdx.
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
  // Getters/setters sincronizados (11.6.2)
  // --------------------------------------------------
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
  /** Cópia (customData novo; resultados resetados). 11.6.3.3. */
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
    q.journalMode = this.journalMode;
    q.journalAttributes = this.journalAttributes;
    q.sortJournalEntries = this.sortJournalEntries;
    q.costAccount = this.costAccount;
    q.revenueAccount = this.revenueAccount;
    q.selfContained = this.selfContained;
    // customData é copiado por referência de valor (novo Map).
    q.customData = new Map(this.customData,);
    return q;
  }

  /** Limpa os campos de resultado para reuso da Query (11.6.3.4). */
  private reset(): void {
    this.attr = null;
    this.numerical = null;
    this.sortable = null;
    this.string = null;
    this.rti = null;
    this.ok = true;
    this.errorMessage = null;
  }

  /** Injeta um pseudo-atributo de resultado (11.10.9). */
  setCustomData(name: string, data: CustomData,): void {
    this.customData.set(name, data,);
  }

  // --------------------------------------------------
  // process (11.7)
  // --------------------------------------------------
  process(): boolean {
    this.reset();
    try {
      // Passo a: resolve property reference from property ID.
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
        // Sem property: atributo de projeto.
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

      // Passo c: resolve scope property.
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

      // Passo d: garante referência ao projeto.
      if (!this.project) this.project = this.property.project as Project;

      // Passo e: resolve scenarioIdx a partir de scenario.
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
        // Passo g: customData tem prioridade.
        this.sortable = data.sortable ?? null;
        this.numerical = data.numerical ?? null;
        this.string = data.string ?? null;
        this.rti = data.rti ?? null;
      } else {
        const propMethod = asMethod(this.property, queryMethodName,);
        if (propMethod) {
          // Passo h: query_X na propriedade.
          propMethod.call(this.property, this,);
        } else {
          const scenarioData = this.scenarioIdx !== undefined
            ? this.property.data[this.scenarioIdx] :
            undefined;
          const dataMethod = scenarioData
            ? asMethod(scenarioData, queryMethodName,) :
            undefined;
          if (this.scenarioIdx !== undefined && dataMethod) {
            // Passo i: query_X no ScenarioData (scenario-specific).
            dataMethod.call(scenarioData, this,);
          } else {
            // Passo j: atributo base.
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

  /** Fallback de atributo base do `process` (11.7.2.5–9). */
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
  to_s(): string {
    if (this.attr) return this.attr.to_s();
    if (this.rti) {
      const r = this.rti as { to_s?(): string };
      return typeof r.to_s === "function" ? r.to_s() : String(this.rti,);
    }
    return this.string ?? "";
  }

  to_num(): number | null {
    if (this.attr) return this.attr.to_num();
    return typeof this.numerical === "number" ? this.numerical : null;
  }

  to_sort(): unknown {
    return this.attr ? this.attr.to_sort() : this.sortable;
  }

  to_rti(): unknown {
    if (this.attr instanceof RichTextAttribute) return this.attr.get();
    return this.attr ? this.attr.to_rti() : this.rti;
  }

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

  /** Algoritmo de escala de valor com unidades auto/fixas (11.9.1). */
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

  /** Monta uma lista a partir de itens (11.9.3). Sem RichText nesta fase. */
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
    // TODO Fase 12: gerar RichTextIntermediate via RichTextFactory.
    this.rti = null;
  }

  // --------------------------------------------------
  // resolvePropertyId (11.10)
  // --------------------------------------------------
  resolvePropertyId(
    pType: string | null,
    pId: string | null,
  ): PropertyTreeNode | null {
    if (!this.project) {
      throw new Error("Need Project reference to process the query",);
    }
    if (!pId) return this.property;
    if (pId[0] === "!") {
      // Cada '!' sobe um nível a partir da propriedade corrente.
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
      default:
        throw new Error(`Unknown property type ${pType}`,);
    }
  }
}
