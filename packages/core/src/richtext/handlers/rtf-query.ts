/**
 * RTFQuery — handler of the `[[query:…]]` function (phase 12.14).
 *
 * Resolves the value of a project/property attribute by building a {@link Query}
 * from the model registered by the context (`setQuery`) and from the arguments
 * passed in the markup. It is the only "real" handler of phase 12; `RTFReport`,
 * `RTFReportLink` and `RTFNavigator` stay stubs until phase 14.
 *
 * Faithful port of `RichText/RTFQuery.rb` (whole file). Controlled divergence:
 * in Ruby `query.numberFormat = <string>` assigns the raw String (upstream uses
 * duck typing); here the field is typed as `RealFormat`, so the spec is
 * converted into 5 space-separated fields (the TJP directive format) and
 * malformed specs are ignored instead of corrupting the query.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFQuery.rb
 * @see ADR 025 (RichText and function handlers)
 */

import { RTFWithQuerySupport, } from "./rtf-with-query-support.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import type { XMLElementLike, } from "../../xml/xml-element-like.ts";
import { XMLElement, } from "../../xml/xml-element.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { Query, } from "../../query/query.ts";
import { SimpleQueryExpander, } from "../../query/simple-query-expander.ts";
import type { Project, } from "../../model/project.ts";
import { TjTime, } from "../../time/tj-time.ts";
import { RealFormat, } from "../../format/real-format.ts";
import type { RichTextIntermediate, } from "../rich-text-intermediate.ts";

/** Parameters accepted by `[[query:…]]` (RTFQuery.rb:76-78). */
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

/** Controlled cast of `unknown` (RTI) to an object with `to_html`. */
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

  /** Result of the query as plain text. */
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

  /** HTML tree of the result (either a `<span>` with the text, or a red error). */
  override to_html(args: RichTextFunctionArgs,): XMLElementLike | null {
    const query = this.prepareQuery(args,);
    if (!query) return null;
    if (query.ok) {
      const rti = query.to_rti();
      if (hasToHtml(rti,)) return rti.to_html();
      const str = query.to_s();
      if (str) {
        const span = new XMLElement("span",);
        span.append(str,);
        return span;
      }
      return null;
    }
    this.error(
      "query_error",
      query.errorMessage! + this.recreateQuerySyntax(args,),
    );
    const font = new XMLElement("font", { color: "#FF0000", },);
    font.append("Query Error: " + query.errorMessage,);
    return font;
  }

  /** Not supported for this function. */
  override to_tagged(_args: RichTextFunctionArgs,): string | null {
    return null;
  }

  /**
   * Builds and runs the query from the model + arguments. Returns `null`
   * when an argument is invalid (RTFQuery.rb:68-133).
   */
  private prepareQuery(args: RichTextFunctionArgs,): Query | null {
    if (!this.query) {
      throw new Error("No Query has been registered for this RichText yet!",);
    }
    const query = this.query.dup();

    // Validates and expands each argument.
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

  /** Regenerates the original query text from the arguments. */
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
    // Defaults to 0 when no scenario is supplied.
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
   * Converts a format spec (5 space-separated fields — the same pattern as
   * the TJP `numberformat` directive) into {@link RealFormat}. A malformed spec
   * is ignored (returns `null`) instead of corrupting the query.
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
