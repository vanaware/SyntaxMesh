/**
 * Workloads compartilhados dos benchmarks (F21¹, 26.11).
 *
 * Geram projetos TJP sintéticos de tamanho controlado e expõem os pontos
 * de entrada do motor (parse, schedule, reports, gantt, RichText, Query).
 * Determinísticos: `timezone "UTC"` + `now` fixado (o default do Project é
 * o relógio real). Vivem fora de `*_bench.ts` para serem reutilizados pelo
 * script de medição/compare sem re-registrar benches.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.11)
 */
import { ProjectFileParser, } from "../packages/core/src/parser/mod.ts";
import { MessageHandlerInstance, } from "../packages/core/src/message-handler.ts";
import type { Project, } from "../packages/core/src/model/project.ts";

export interface SourceOptions {
  /** Número de taskreports HTML a declarar (report_bench). */
  reports?: number;
  /** Incluir um taskreport com coluna `chart` (gantt_bench). */
  gantt?: boolean;
  /**
   * Usar `effort 1d allocate dev` sem `start` fixo (auto-scheduling com
   * booking de recurso). Caso contrário `start` fixo + effort (sem alocação):
   * o booking tem custo O(n²) no nº de tarefas (hotspot p/ 26.14), então os
   * benches de volume usam start fixo para serem limitados.
   */
  allocate?: boolean;
}

/**
 * Projeto com `nTasks` tarefas sob uma tarefa-raiz. Por padrão cada tarefa
 * tem `start` fixo + `effort 1d` (sem alocação) — scheduling limitado. Com
 * `allocate: true` usa `effort 1d allocate dev` (booking, O(n²)). Intervalo
 * largo para acomodar o booking em série. Opcionalmente declara reports/gantt.
 */
export function buildSource(nTasks: number, opts: SourceOptions = {},): string {
  const lines: string[] = [];
  lines.push(
    'project bench "Bench" "1.0" 2026-01-01 - 2030-12-31 {',
    '  timezone "UTC"',
    "  now 2026-01-15",
    "}",
    'resource dev "Dev"',
    'task root "Root" {',
  );
  const body = opts.allocate
    ? "effort 1d allocate dev"
    : "start 2026-01-05 effort 1d";
  for (let i = 0; i < nTasks; i++) {
    lines.push(`  task t${i} "T${i}" { ${body} }`,);
  }
  lines.push("}",);
  const reports = opts.reports ?? 0;
  for (let r = 0; r < reports; r++) {
    lines.push(
      `taskreport rep${r} "Report ${r}" {`,
      "  formats html",
      "  columns bsi, name, start, end",
      "}",
    );
  }
  if (opts.gantt) {
    lines.push(
      'taskreport gantt "Gantt" {',
      "  formats html",
      "  columns bsi, name, start, end, chart",
      "}",
    );
  }
  return lines.join("\n",) + "\n";
}

/** Parse de um source TJP → Project (lança se o parse falhar). */
export function parseSource(src: string,): Project {
  MessageHandlerInstance.instance.reset();
  const parser = new ProjectFileParser();
  parser.open(src, true, true,);
  const result: unknown = parser.parse("project",);
  if (result === null || result === false) {
    throw new Error("parse não retornou Project",);
  }
  return result as Project;
}

/** Parse + schedule de um source com `nTasks` tarefas. */
export function scheduledProject(
  nTasks: number,
  opts: SourceOptions = {},
): Project {
  const project = parseSource(buildSource(nTasks, opts,),);
  project.schedule();
  return project;
}

/** Amostra de markup MediaWiki representativa para o rich_text_bench. */
export const RICH_TEXT_SAMPLE = `= Heading =
'''bold''' and ''italic'' and '''''both'''''

* item 1
* item 2
** nested
# ordered

[[Internal]] and [http://example.com external] and [[Page|label]]

{|
! H1 !! H2
|-
| a || b
|}

<nowiki>'''not bold'''</nowiki>
----
line one<br>line two
`;
