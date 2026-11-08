/**
 * Seção `results.reports` do envelope de execução (Fase 24 — ADR 034).
 *
 * Constrói o contrato `ReportsJson` a partir do `Project` **em memória**, sem
 * tocar em disco/teminal: cada relatório vira uma entrada com o nome exibido,
 * a intenção `stdout` da DSL, o conteúdo já renderizado de cada formato
 * declarado e os erros que ele produziu. Um relatório com erro **não** impede
 * a geração dos demais; o `ok` global reflete se houve qualquer erro.
 *
 * A política de destino (imprimir no terminal, gravar `{name}.{ext}`) é
 * exclusiva do consumidor (`output-policy.ts` da CLI).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.2/§3.3
 */
import type { Project, } from "../model/project.ts";
import type { Report, } from "../model/report.ts";
import { ReportContext, } from "./report-context.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";

/** Conteúdo de um formato de relatório, já renderizado como texto. */
export interface FormatContent {
  /** Id do formato declarado no `.tjp` (`csv`, `html`, `markdown`, ...). */
  format: string;
  /** Conteúdo integral do relatório naquele formato. */
  content: string;
}

/** Uma entrada de `results.reports`. */
export interface ReportJsonEntry {
  /** Nome exibido do relatório (`reportName` na DSL; único no projeto). */
  name: string;
  /** Intenção `stdout` declarada no relatório (`false` quando ausente). */
  stdout: boolean;
  /**
   * Atributo `selfcontained` do relatório (default `false`).
   *
   * Dado de **intenção de renderização**, como `stdout`: quando `false`, o
   * HTML referencia `css/`, `scripts/` e `icons/` e o consumidor precisa
   * copiar esses assets para o diretório de saída (política da CLI, 24.5.16).
   */
  selfcontained: boolean;
  /** Formatos na ordem declarada, cada um com o conteúdo renderizado. */
  formats: FormatContent[];
  /** Mensagens de erro/fatal produzidas por este relatório. */
  errors: string[];
}

/** Seção `results.reports` do envelope. */
export interface ReportsJson {
  /** `false` quando algum relatório pedido falhou. */
  ok: boolean;
  /** Diretório de saída — presente **apenas** quando o request o passou. */
  outputDir?: string;
  /** Relatórios na ordem de declaração (filtrados pela seleção, se houver). */
  reports: ReportJsonEntry[];
}

/** Opções de `renderReports` (espelham `report`/`reportsIsRegex` do request). */
export interface RenderReportsOptions {
  /** Id exato ou regex do relatório a gerar; ausente gera todos. */
  report?: string | null;
  /** Interpretar `report` como expressão regular. */
  reportsIsRegex?: boolean;
  /** Diretório de saída ecoado na seção (só entra quando definido). */
  outputDir?: string | null;
  /**
   * Snippet cru de atributos dinâmicos (`--report -A "<attrs>"`).
   *
   * Quando presente, a geração passa por `Project#generateReport` — que aplica
   * o pipeline 18.19 (parse dos atributos, `interactive`, backup/restore) — em
   * vez de chamar `Report#generate()` direto. O consumidor **não** reexamina a
   * opção: a seção já sai processada.
   */
  dynamicAttributes?: string | null;
}

/**
 * Gera um relatório e devolve a entrada da seção. Erros **não** escapam: as
 * exceções (formato desconhecido, âncora de sheet) e as mensagens
 * `error`/`fatal` do `MessageHandler` viram `errors[]` da própria entrada.
 */
function renderEntry(
  project: Project,
  report: Report,
  dynamicAttributes?: string | null,
): ReportJsonEntry {
  const handler = MessageHandlerInstance.instance;
  const messageMark = handler.messages.length;
  const errorCountMark = handler.errors;
  const errors: string[] = [];
  // Profundidade inicial: uma exceção não pode deixar contexto pendurado nem
  // remover o contexto de quem chamou `renderReports`.
  const contextMark = project.reportContexts.length;

  try {
    if (dynamicAttributes !== undefined && dynamicAttributes !== null) {
      // Caminho com atributos dinâmicos: `Project#generateReport` já faz o
      // push/pop do `ReportContext` e o backup/restore dos atributos.
      project.generateReport(report.id, false, null, dynamicAttributes,);
    } else {
      project.reportContexts.push(new ReportContext(project, report,),);
      try {
        report.generate();
      } finally {
        project.reportContexts.pop();
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error,),);
  } finally {
    if (project.reportContexts.length > contextMark) {
      project.reportContexts.length = contextMark;
    }
  }

  // Mensagens de erro/fatal produzidas durante a geração deste relatório.
  for (const message of handler.messages.slice(messageMark,)) {
    if (message.type === "error" || message.type === "fatal") {
      const text = message.message || message.id;
      if (!errors.includes(text,)) errors.push(text,);
    }
  }
  // Erros contados sem mensagem associada não podem desaparecer.
  if (errors.length === 0 && handler.errors > errorCountMark) {
    errors.push(`Report ${report.fullId} failed.`,);
  }

  const formats: FormatContent[] = [];
  if (errors.length === 0) {
    // `outputs` é preenchido no dispatch de `generate()` — a ordem das chaves é
    // a ordem em que os formatos foram renderizados (declarada na DSL ou
    // reescrita por `dynamicAttributes`), que é exatamente o que o relatório
    // **produziu**.  Lê-lo depois da geração evita divergir do snippet `-A`.
    for (const [format, content,] of report.outputs) {
      formats.push({ format, content, },);
    }
  }

  return {
    name: report.name,
    stdout: report.get("stdout",) === true,
    selfcontained: report.get("selfcontained",) === true,
    formats,
    errors,
  };
}

/**
 * Monta a seção `results.reports` a partir do projeto em memória.
 *
 * @param project Projeto já parseado (e, quando necessário, agendado).
 * @param options Seleção de relatórios e `outputDir` a ecoar.
 */
export function renderReports(
  project: Project,
  options: RenderReportsOptions = {},
): ReportsJson {
  const selection = options.report ?? null;
  let selectedIds: Set<string> | null = null;
  if (selection !== null && selection !== "") {
    selectedIds = new Set(
      options.reportsIsRegex
        ? project.matchingReports(selection,)
        : (project.report(selection,) ? [selection,] : []),
    );
  }

  const reports: ReportJsonEntry[] = [];
  let ok = true;
  for (const item of project.reports.toArray()) {
    const report = item as Report;
    if (selectedIds !== null && !selectedIds.has(report.id,)) continue;
    const entry = renderEntry(project, report, options.dynamicAttributes,);
    if (entry.errors.length > 0) ok = false;
    reports.push(entry,);
  }

  const json: ReportsJson = { ok, reports, };
  if (options.outputDir !== undefined && options.outputDir !== null) {
    json.outputDir = options.outputDir;
  }
  return json;
}
