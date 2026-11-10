/**
 * ExportRE (phase 14.18.1) — facade of the export report.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/ExportRE.rb`. It does nothing on its
 * own: it delegates `to_tjp()` to `TjpExportRE` and `to_mspxml()` to `MspXmlRE`,
 * both built from the same `Report`.
 *
 * The content is registered in the content factory (14.11) under `export`.
 *
 * ⚠️ Browser (ADR 027): the converters return strings; nothing is written to
 * disk.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.18.1)
 */
import type { Report, } from "../model/report.ts";
import { ReportBase, } from "./report-base.ts";
import { TjpExportRE, } from "./tjp-export-re.ts";
import { MspXmlRE, } from "./msp-xml-re.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/** Facade of the `export` report, delegating to the TJP and MSPXML exporters. */
export class ExportRE extends ReportBase {
  /**
   * Creates the export facade of a report.
   *
   * @param report Report node the facade renders.
   */
  constructor(report: Report,) {
    super(report,);
  }

  /** There is no intermediate format for the export. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
  }

  /** Returns the project data as TJP syntax. */
  to_tjp(): string {
    return new TjpExportRE(this.report,).to_tjp();
  }

  /** Returns the project data as Microsoft Project XML. */
  to_mspxml(): string {
    return new MspXmlRE(this.report,).to_mspxml();
  }
}

// Registers the `export` content in the factory (14.11).
registerContentFactory(
  "export",
  (report: unknown,): ExportRE => new ExportRE(report as Report,),
);
