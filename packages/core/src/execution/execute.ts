/**
 * `execute` — ponto único de entrada das chamadas de linha de comando
 * (Fase 24 — ADR 034, adendo v2.1 §3.1/§3.4).
 *
 * Porta o fluxo de `apps/Tj3.rb#appMain` (l.171-228) **sem** argv, sem FS, sem
 * `exit`: recebe o conteúdo dos arquivos inline, resolve `include` por *lookup*
 * em memória, roda parse → gates → schedule → relatórios e devolve o envelope
 * com `exitCode` como **dado**.
 *
 * Isolamento por chamada (requisito do uso em servidor — adendo §3.6):
 * `MessageHandlerInstance` é singleton de processo, então cada `execute` repõe
 * o handler (`reset`) e usa uma instância `TaskJuggler` própria; o `DataCache`
 * é limpo ao final. Chamadas concorrentes no mesmo processo não compartilham
 * projeto nem mensagens.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3.rb
 * @see docs/syntaxmesh/fases/fase-24-cli.md §5.2/§5.3/§5.5
 */
import { DataCache, } from "../scheduling/data-cache.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { TaskJuggler, } from "../taskjuggler.ts";
import {
  buildEnvelope,
  echoOptions,
  EXIT_ERROR,
  EXIT_OK,
  fileKey,
} from "./envelope.ts";
import { normalizeInputPath, } from "./paths.ts";
import {
  anchoredSheetSection,
  checkSection,
  checkSheetSection,
  freezeSection,
  helpSection,
  listReportsSection,
  manSection,
  reportsSection,
  versionSection,
} from "./sections.ts";
import type {
  ExecutionRequest,
  ExecutionResult,
  ExecutionResults,
} from "./types.ts";
import type { Project, } from "../model/project.ts";

/**
 * Monta o provedor de conteúdo que faz *lookup* da lista do request.
 *
 * Sem disco e sem provedor externo: um `include` ausente vira erro de arquivo
 * (`bad_include`, fiel ao `tj3`), nunca exceção de FS.
 */
function lookupProvider(files: ExecutionRequest["files"],) {
  const byPath = new Map<string, string>();
  for (const file of files ?? []) {
    byPath.set(fileKey(file.path,), file.content,);
  }
  return (path: string,): string => {
    const content = byPath.get(normalizeInputPath(path,),);
    if (content === undefined) {
      throw new Error(`Cannot open file ${path}`,);
    }
    return content;
  };
}

/**
 * Executa o request e devolve o envelope.
 *
 * Ordem fiel ao `tj3`: `--version`/`--help` respondem sozinhos (sem projeto),
 * `--check-syntax` e `--list-reports` param antes da agenda, `--no-reports`
 * agenda e para, e o gate de erros pode ser dispensado por `forceReports`.
 *
 * **Serialização por processo:** chamadas concorrentes entram numa fila — o
 * `MessageHandler`/`DataCache` são singletons de processo, então executar duas
 * ao mesmo tempo misturaria mensagens. O adendo §3.6 sanciona exatamente isso
 * ("servidores concorrentes serializam chamadas por instância"); quem precisa
 * de paralelismo real usa uma instância/worker por requisição.
 */
export function execute(
  request: ExecutionRequest,
): Promise<ExecutionResult> {
  const result = executeQueue.then(
    () => executeRequest(request,),
    () => executeRequest(request,),
  );
  executeQueue = result.then(() => undefined, () => undefined,);
  return result;
}

/** Fila de execução do processo (ver `execute`). */
let executeQueue: Promise<unknown> = Promise.resolve();

/**
 * Projeto carregado pela última chamada de {@link execute}.
 *
 * Conveniência **in-process** (plano §5.5 ponto 9), nunca contrato: o envelope
 * é o resultado oficial. A CLI usa isto só para o resumo do projeto (24.4.5) e
 * a PWA pode reaproveitar; consumidores remotos (worker/HTTP) não têm acesso.
 */
let lastProject: Project | null = null;

/** Projeto da última `execute` concluída (ou `null`). */
export function lastExecutedProject(): Project | null {
  return lastProject;
}

/** Corpo do `execute`, sempre chamado com a fila livre. */
async function executeRequest(
  request: ExecutionRequest,
): Promise<ExecutionResult> {
  const handler = MessageHandlerInstance.instance;
  // Isolamento por chamada: o handler é singleton de processo.
  handler.reset();
  handler.abortOnWarning = request.abortOnWarnings === true;
  lastProject = null;

  const options = echoOptions(request,);
  const results: ExecutionResults = {};

  // `--version` / `--help` não abrem projeto (Ruby Tj3AppBase sai antes).
  if (options.version) results.version = versionSection();
  if (options.help) results.help = helpSection();
  if (options.version || options.help) {
    if (options.files.length === 0) {
      return buildEnvelope(options, handler, results, EXIT_OK,);
    }
  }

  if (options.files.length === 0) {
    handler.error(
      "tj3_tjp_file_missing",
      "You must provide at least one .tjp file",
    );
    return buildEnvelope(options, handler, results, EXIT_ERROR,);
  }

  const tj = new TaskJuggler();
  tj.warnTsDeltas = options.warnTsDeltas;
  tj.generateTraces = options.addTrace;

  let parsed = false;
  try {
    parsed = await tj.parse([options.entry,], lookupProvider(request.files,),);
  } catch (_error) {
    parsed = false;
  }

  if (!parsed) {
    if (options.checkSyntax) results.check = checkSection(false,);
    return buildEnvelope(options, handler, results, EXIT_ERROR,);
  }

  // Conveniência in-process para o resumo da CLI (24.4.5).
  lastProject = tj.project;

  // `--check-syntax`: só o parse conta; sem agenda (Ruby l.190).
  if (options.checkSyntax) {
    results.check = checkSection(true,);
    return buildEnvelope(options, handler, results, EXIT_OK,);
  }

  // `--list-reports` lê a árvore parseada e não precisa de agenda (plano §5.2).
  if (options.listReports !== null) {
    const project = tj.project!;
    results.listReports = listReportsSection(
      project,
      options.listReports,
      options.listReportsIsRegex,
    );
    return buildEnvelope(
      options,
      handler,
      results,
      handler.errors > 0 ? EXIT_ERROR : EXIT_OK,
    );
  }

  // Operações pontuais ainda ancoradas (24.2.26) param antes de agendar.
  if (options.freeze !== null) {
    handler.error(
      "freeze_not_available",
      "Freeze is not available yet (Phase 24 — task 24.9).",
    );
    // Forma do envelope preservada: a seção existe, mas o conteúdo é do 24.9.
    results.freeze = freezeSection(options.entry, "",);
    return buildEnvelope(options, handler, results, EXIT_ERROR,);
  }
  if (options.man !== null) {
    handler.error(
      "man_not_available",
      "Man pages are not available yet (Phase 22 doc-core — task 24.9).",
    );
    results.man = manSection(options.man, "",);
    return buildEnvelope(options, handler, results, EXIT_ERROR,);
  }

  let scheduled = false;
  try {
    scheduled = tj.schedule();
  } catch (_error) {
    scheduled = false;
  }
  // Ruby l.192-194: falha de agenda só é fatal sem `--force-reports`.
  if (!scheduled && !options.forceReports) {
    return buildEnvelope(options, handler, results, EXIT_ERROR,);
  }

  // Checagens de folha e apps da F18 (Ruby l.196-209). `check-ts`/`check-ss`
  // já rodam sobre o conteúdo do request (24.2.33); os demais apps seguem
  // ancorados em 24.10.
  if (options.app !== null) {
    const outcome = options.app === "check-ts" || options.app === "check-ss"
      ? checkSheetSection(tj, options.app, options.appOptions,)
      : anchoredSheetSection(options.app,);
    results.sheet = outcome.section;
    const failed = outcome.exitCode !== EXIT_OK || handler.errors > 0;
    return buildEnvelope(
      options,
      handler,
      results,
      failed ? EXIT_ERROR : EXIT_OK,
    );
  }

  if (options.noReports) {
    return buildEnvelope(
      options,
      handler,
      results,
      handler.errors > 0 ? EXIT_ERROR : EXIT_OK,
    );
  }

  // Gate do plano §5.5.3: com erros anteriores não se renderiza, a menos de
  // `--force-reports` (que a matriz do Ruby usa contra a falha de agenda).
  if (handler.errors > 0 && !options.forceReports) {
    return buildEnvelope(options, handler, results, EXIT_ERROR,);
  }

  const project = tj.project!;
  project.checkReports();

  const section = reportsSection(project, {
    report: options.report,
    reportsIsRegex: options.reportsIsRegex,
    outputDir: options.outputDir,
    dynamicAttributes: options.dynamicAttributes,
  },);
  results.reports = section;

  // Cache de dados é limpo ao final de cada execução (Ruby `generateReports`).
  DataCache.instance.flush();

  const failed = !section.ok || handler.errors > 0;
  return buildEnvelope(
    options,
    handler,
    results,
    failed ? EXIT_ERROR : EXIT_OK,
  );
}
