/**
 * Registro de conteúdo de relatórios (Fase 14.11).
 *
 * `Report.generateIntermediateFormat` despacha por `typeSpec` para a classe de
 * conteúdo correspondente (AccountListRE, TaskListRE, …). Para não contaminar o
 * modelo (`src/model/`) com imports de `src/reports/` — que ainda nem existem
 * para as subfases 14.12–14.20 — o dispatch usa uma fábrica registrada por tipo.
 * As classes de conteúdo se registram aqui ao serem implementadas.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.11)
 * @see docs/taskjuggler/lib/taskjuggler/reports/Report.rb (generateIntermediateFormat)
 */
import type { XMLElementLike, } from "../richtext/xml-like.ts";

/**
 * Interface estrutural do conteúdo de um relatório. `generateIntermediateFormat`
 * é obrigatória; os conversores `to_*` são detectados em tempo de execução
 * (equivalente ao `respond_to?` do Ruby).
 */
export interface ReportContent {
  generateIntermediateFormat(): void;

  to_html?(): XMLElementLike[] | XMLElementLike | string;
  to_csv?(): unknown[][] | null;
  to_tjp?(): string;
  to_mspxml?(): string;
  to_niku?(): string;
  to_iCal?(): string;
  to_ctags?(): string;
}

/** Fábrica de conteúdo a partir do relatório que o hospeda. */
export type ReportContentFactory = (report: unknown,) => ReportContent;

/**
 * Registro por `typeSpec` normalizado em minúsculas (`accountreport`,
 * `export`, `ical`, `niku`, `resourcereport`, `tagfile`, `textreport`,
 * `taskreport`, `tracereport`, `statussheet`, `timesheet`). As classes de
 * conteúdo se registram aqui ao serem implementadas (14.12–14.20).
 */
export const contentFactories = new Map<string, ReportContentFactory>();

/** Registra (ou remove, com `null`) a fábrica de um `typeSpec`. */
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
