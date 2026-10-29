/**
 * RTFQuery — handler da função `[[query:…]]` (Fase 12.14).
 *
 * Resolve o valor de um atributo de projeto/propriedade montando um {@link Query}
 * a partir do modelo registrado pelo contexto (`setQuery`) e dos argumentos
 * passados no markup. É o único handler "real" da Fase 12; `RTFReport`,
 * `RTFReportLink` e `RTFNavigator` ficam stubs para a Fase 14.
 *
 * Port fiel de `RichText/RTFQuery.rb` (arquivo inteiro). Divergência controlada:
 * no Ruby `query.numberFormat = <string>` atribui a String bruta (upstream usa
 * duck-typing); aqui o campo é tipado como `RealFormat`, então convertemos o
 * spec em 5 campos separados por espaço (formato da diretiva TJP) e ignoramos
 * specs malformados em vez de corromper a query.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFQuery.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RTFWithQuerySupport, } from "./rtf-with-query-support.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import type { XMLElementLike, } from "../xml-like.ts";
import { SimpleXMLElement, } from "../xml-like.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { Query, } from "../../query/query.ts";
import { SimpleQueryExpander, } from "../../query/simple-query-expander.ts";
import type { Project, } from "../../model/project.ts";
import { TjTime, } from "../../time/tj-time.ts";
import { RealFormat, } from "../../format/real-format.ts";
import type { RichTextIntermediate, } from "../rich-text-intermediate.ts";

/** Parâmetros aceitos por `[[query:…]]` (RTFQuery.rb:76-78). */
const VALID_ARGS = [
  "attribute",
  "currencyformat",
  "end",
  "family",
  "journalattributes",
  "journalmode",
  "loadunit",
  "numberformat",
  "property",
  "scenario",
  "scopeproperty",
  "start",
  "timeformat",
];

const PROPERTY_TYPES: Record<string, string> = {
  account: "Account",
  task: "Task",
  resource: "Resource",
};

const LOAD_UNITS = [
  "days",
  "hours",
  "longauto",
  "minutes",
  "months",
  "quarters",
  "shortauto",
  "weeks",
  "years",
];

const VALID_JOURNAL_MODES = [
  "journal",
  "journal_sub",
  "status_up",
  "status_down",
  "alerts_down",
];

const VALID_JOURNAL_ATTRS = [
  "author",
  "date",
  "details",
  "flags",
  "headline",
  "property",
  "propertyid",
  "summary",
  "timesheet",
];

/** Cast controlado de `unknown` (RTI) para um objeto com `to_html`. */
function hasToHtml(value: unknown,): value is RichTextIntermediate & {
  to_html(): XMLElementLike | null;
} {
  return typeof value === "object" && value !== null &&
    typeof (value as { to_html?: unknown }).to_html === "function";
}

export class RTFQuery extends RTFWithQuerySupport {
  private readonly project: Project | null;

  constructor(
    project: Project | null,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    super("query", sourceFileInfo,);
    this.project = project;
    this.blockFunction = false;
  }

  /** Resultado da consulta em texto puro. */
  override to_s(args: RichTextFunctionArgs,): string {
    const query = this.prepareQuery(args,);
    if (!query) return "";
    if (query.ok) {
      return query.to_s();
    }
    this.error(
      "query_error",
      query.errorMessage! + this.recreateQuerySyntax(args,),
    );
    return "Query Error: " + query.errorMessage;
  }

  /** Árvore HTML do resultado (ou `<span>` com o texto, ou erro em vermelho). */
  override to_html(args: RichTextFunctionArgs,): XMLElementLike | null {
    const query = this.prepareQuery(args,);
    if (!query) return null;
    if (query.ok) {
      const rti = query.to_rti();
      if (hasToHtml(rti,)) return rti.to_html();
      const str = query.to_s();
      if (str) {
        const span = new SimpleXMLElement("span",);
        span.append(str,);
        return span;
      }
      return null;
    }
    this.error(
      "query_error",
      query.errorMessage! + this.recreateQuerySyntax(args,),
    );
    const font = new SimpleXMLElement("font", { color: "#FF0000", },);
    font.append("Query Error: " + query.errorMessage,);
    return font;
  }

  /** Não suportado para esta função. */
  override to_tagged(_args: RichTextFunctionArgs,): string | null {
    return null;
  }

  /**
   * Monta e processa a query a partir do modelo + argumentos. Retorna `null`
   * quando um argumento é inválido (RTFQuery.rb:68-133).
   */
  private prepareQuery(args: RichTextFunctionArgs,): Query | null {
    if (!this.query) {
      throw new Error("No Query has been registered for this RichText yet!",);
    }
    const query = this.query.dup();

    // Valida e expande cada argumento.
    const expandedArgs: Record<string, string> = {};
    for (const [arg, value,] of Object.entries(args,)) {
      if (!VALID_ARGS.includes(arg,)) {
        this.error(
          "bad_query_parameter",
          `Unknown query parameter '${arg}'. Use one of ${
            VALID_ARGS.join(", ",)
          }!`,
        );
        return null;
      }
      expandedArgs[arg] = new SimpleQueryExpander(
        value,
        this.query,
        this.sourceFileInfo,
      ).expand();
    }

    if (
      ((expandedArgs["property"] && expandedArgs["property"]![0] != "!") ||
        expandedArgs["scopeproperty"]) &&
      !(expandedArgs["family"] || this.query.propertyType)
    ) {
      this.error(
        "missing_family",
        "If you provide a property or scope property you need to provide a " +
          "family type as well.",
      );
    }

    if (expandedArgs["property"]) {
      query.propertyId = expandedArgs["property"];
      if (query.propertyId![0] != "!") query.property = null;
    }
    if (expandedArgs["scopeproperty"]) {
      query.scopePropertyId = expandedArgs["scopeproperty"];
      query.scopeProperty = null;
    }
    if (expandedArgs["attribute"]) {
      query.attributeId = expandedArgs["attribute"];
    }
    if (expandedArgs["start"]) {
      query.start = TjTime.fromString(expandedArgs["start"],);
    }
    if (expandedArgs["end"]) {
      query.end = TjTime.fromString(expandedArgs["end"],);
    }
    if (expandedArgs["numberformat"]) {
      const fmt = RTFQuery.parseFormat(expandedArgs["numberformat"],);
      if (fmt) query.numberFormat = fmt;
    }
    if (expandedArgs["timeformat"]) {
      query.timeFormat = expandedArgs["timeformat"];
    }
    if (expandedArgs["currencyformat"]) {
      const fmt = RTFQuery.parseFormat(expandedArgs["currencyformat"],);
      if (fmt) query.currencyFormat = fmt;
    }
    query.project = this.project;

    // Os mais elaborados.
    this.setScenarioIdx(query, expandedArgs,);
    this.setPropertyType(query, expandedArgs,);
    this.setLoadUnit(query, expandedArgs,);
    this.setJournalMode(query, expandedArgs,);
    this.setJournalAttributes(query, expandedArgs,);

    query.process();
    return query;
  }

  /** Regenera o texto original da query a partir dos argumentos. */
  private recreateQuerySyntax(args: RichTextFunctionArgs,): string {
    let queryText = "\n<-query";
    for (const [a, v,] of Object.entries(args,)) {
      queryText += ` ${a}="${v}"`;
    }
    return queryText + "->";
  }

  private setPropertyType(query: Query, args: Record<string, string>,): void {
    if (args["family"]) {
      const mapped = PROPERTY_TYPES[args["family"]];
      if (!mapped) {
        this.error(
          "rtfq_bad_query_family",
          `Unknown query family type '${args["family"]}'. Use one of ${
            Object.keys(PROPERTY_TYPES,).join(", ",)
          }!`,
        );
      }
      query.propertyType = mapped ?? null;
      if (query.propertyType === "Task") {
        query.scopePropertyType = "Resource";
      } else if (query.propertyType === "Resource") {
        query.scopePropertyType = "Task";
      }
    }
  }

  private setLoadUnit(query: Query, args: Record<string, string>,): void {
    if (args["loadunit"] && LOAD_UNITS.includes(args["loadunit"],)) {
      query.loadUnit = args["loadunit"];
    }
  }

  private setScenarioIdx(query: Query, args: Record<string, string>,): void {
    if (args["scenario"]) {
      const scenarioIdx = this.project
        ? this.project.scenarioIdx(args["scenario"],)
        : undefined;
      if (scenarioIdx === undefined) {
        this.error(
          "rtfq_bad_scenario",
          `Unknown scenario ${args["scenario"]}`,
        );
      }
      query.scenarioIdx = scenarioIdx ?? 0;
    }
    // Default para 0 caso nenhum cenário seja fornecido.
    if (query.scenarioIdx === undefined) query.scenarioIdx = 0;
  }

  private setJournalMode(query: Query, args: Record<string, string>,): void {
    const mode = args["journalmode"];
    if (mode) {
      if (!VALID_JOURNAL_MODES.includes(mode,)) {
        this.error(
          "rtfq_bad_journalmode",
          `Unknown journalmode ${mode}. Must be one of ${
            VALID_JOURNAL_MODES.join(", ",)
          }.`,
        );
      }
      query.journalMode = mode;
    } else if (!query.journalMode) {
      query.journalMode = "journal";
    }
  }

  private setJournalAttributes(
    query: Query,
    args: Record<string, string>,
  ): void {
    const attrListStr = args["journalattributes"];
    if (attrListStr) {
      const attrs = attrListStr.split(", ",).map((a,) =>
        a.replaceAll(" ", "",)
      );
      query.journalAttributes = [];
      for (const attr of attrs) {
        if (VALID_JOURNAL_ATTRS.includes(attr,)) {
          query.journalAttributes.push(attr,);
        } else {
          this.error(
            "rtfq_bad_journalattr",
            `Unknown journalattribute ${attr}. Must be one of ${
              VALID_JOURNAL_ATTRS.join(", ",)
            }.`,
          );
        }
      }
    } else if (!query.journalAttributes) {
      query.journalAttributes = ["date", "summary", "details",];
    }
  }

  /**
   * Converte um spec de formato (5 campos separados por espaço — o mesmo
   * padrão da diretiva TJP `numberformat`) em {@link RealFormat}. Spec
   * malformado é ignorado (retorna `null`) em vez de corromper a query.
   */
  private static parseFormat(spec: string,): RealFormat | null {
    const parts = spec.split(/\s+/,).filter((p,) => p.length > 0);
    if (parts.length !== 5) return null;
    const digits = Number(parts[4],);
    if (!Number.isInteger(digits,)) return null;
    return new RealFormat([
      parts[0]!,
      parts[1]!,
      parts[2]!,
      parts[3]!,
      digits,
    ],);
  }
}
