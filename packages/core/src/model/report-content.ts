/**
 * Report content registry (phase 14.11).
 *
 * `Report.generateIntermediateFormat` dispatches on `typeSpec` to the matching
 * content class (AccountListRE, TaskListRE, …). To keep the model
 * (`src/model/`) free of imports from `src/reports/` — which would be a cycle —
 * the dispatch goes through a factory registered per type. Content classes
 * register themselves here when they are implemented.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.11)
 * @see docs/taskjuggler/lib/taskjuggler/reports/Report.rb (generateIntermediateFormat)
 */
import type { XMLElementLike, } from "../xml/xml-element-like.ts";

/**
 * Structural interface of a report content object.
 *
 * `generateIntermediateFormat` is mandatory: it builds the intermediate
 * representation every other converter reads. The `to_*` converters are
 * optional and detected at runtime, the equivalent of Ruby's `respond_to?`, so
 * a content class only declares the output formats it can actually produce.
 */
export interface ReportContent {
  /** Builds the intermediate format the converters below consume. */
  generateIntermediateFormat(): void;

  /** HTML output, as XML elements or as a raw string. */
  to_html?(): XMLElementLike[] | XMLElementLike | string;
  /** CSV output, as a matrix of cells. */
  to_csv?(): unknown[][] | null;
  /** Markdown rendering of the intermediate format (SyntaxMesh extension). */
  to_markdown?(): string | null;
  /** JSON rendering of the intermediate format (extension 14C.0.1). */
  toJSON?(): string;
  /** TaskJuggler project syntax output. */
  to_tjp?(): string;
  /** Microsoft Project XML output. */
  to_mspxml?(): string;
  /** Niku report output. */
  to_niku?(): string;
  /** iCalendar output. */
  to_iCal?(): string;
  /** Ctags output. */
  to_ctags?(): string;
}

/** Factory that builds the content object for the report hosting it. */
export type ReportContentFactory = (report: unknown,) => ReportContent;

/**
 * Registry keyed by lower-cased `typeSpec` (`accountreport`, `breakdownreport`,
 * `export`, `ical`, `materialreport`, `niku`, `rdoreport`, `resourcereport`,
 * `tagfile`, `textreport`, `taskreport`, `tracereport`, `statussheet`,
 * `timesheet`). Content classes register here when they are implemented
 * (14.12–14.20; extensions 14C.1–14C.3).
 */
export const contentFactories = new Map<string, ReportContentFactory>();

/**
 * Registers the factory of one `typeSpec`, or removes it when `factory` is
 * `null`.
 *
 * @param typeSpec Report type, matched case-insensitively.
 * @param factory Factory to register, or `null` to unregister.
 */
export function registerContentFactory(
  typeSpec: string,
  factory: ReportContentFactory | null,
): void {
  const key = typeSpec.toLowerCase();
  if (factory) {
    contentFactories.set(key, factory,);
  } else {
    contentFactories.delete(key,);
  }
}
