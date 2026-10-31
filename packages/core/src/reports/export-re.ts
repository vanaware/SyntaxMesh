/**
 * ExportRE (Fase 14.18.1) — fachada do relatório de exportação.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/ExportRE.rb`. Não faz
 * nada por si: delega `to_tjp()` para `TjpExportRE` e `to_mspxml()` para
 * `MspXmlRE`, ambos construídos a partir do mesmo `Report`.
 *
 * O conteúdo é registrado na fábrica de conteúdo (14.11) sob `export`.
 *
 * ⚠️ Browser (ADR 027): os conversores retornam strings; nenhuma escrita a disco.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.18.1)
 */
import type { Report, } from "../model/report.ts";
import { ReportBase, } from "./report-base.ts";
import { TjpExportRE, } from "./tjp-export-re.ts";
import { MspXmlRE, } from "./msp-xml-re.ts";
import { registerContentFactory, } from "../model/report-content.ts";

export class ExportRE extends ReportBase {
  constructor(report: Report,) {
    super(report,);
  }

  /** Não há formato intermediário para a exportação. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
  }

  /** Retorna os dados do projeto em sintaxe TJP. */
  to_tjp(): string {
    return new TjpExportRE(this.report,).to_tjp();
  }

  /** Retorna os dados do projeto em Microsoft Project XML. */
  to_mspxml(): string {
    return new MspXmlRE(this.report,).to_mspxml();
  }
}

// Registra o conteúdo de `export` na fábrica (14.11).
registerContentFactory(
  "export",
  (report: unknown,): ExportRE => new ExportRE(report as Report,),
);
