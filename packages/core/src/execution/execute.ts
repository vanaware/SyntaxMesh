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
import { generateMan, } from "../docgen/man.ts";
import {
  buildEnvelope,
  echoOptions,
  EXIT_ERROR,
  EXIT_OK,
  fileKey,
} from "./envelope.ts";
import { normalizeInputPath, } from "./paths.ts";
import {
  checkSection,
  checkSheetSection,
  freezeSection,
  helpSection,
  listReportsSection,
  manSection,
  reportsSection,
  runSheetSection,
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

  // `--version` / `--help` não abrem projeto: no Ruby o `on_tail` do
  // `Tj3AppBase` imprime e **sai**, mesmo com arquivos na linha de comando.
  if (options.version) results.version = versionSection();
  if (options.help) results.help = helpSection();
  if (options.version || options.help) {
    return buildEnvelope(options, handler, results, EXIT_OK,);
  }

  // `syntaxmesh man` (24.9.1–24.9.3): documentação de sintaxe do `doc-core`
  // (Fase 22). Não abre projeto, não grava nada — devolve texto e, no formato
  // `html`, o mapa de arquivos do manual. A escrita é da CLI (24.5).
  if (options.man !== null) {
    const output = generateMan({
      format: options.man.format,
      keywords: options.man.keywords ?? [],
      color: options.man.color ?? false,
      ignoreOld: options.man.ignoreOld ?? false,
    },);
    // A consulta de documentação não é um projeto: `--abort-on-warnings` e o
    // `trapSetup` do parse não valem aqui (o Ruby os trata em `tj3man`, um
    // programa separado). `critical` registra sem levantar.
    const abortOnWarning = handler.abortOnWarning;
    handler.abortOnWarning = false;
    try {
      for (const message of output.messages) {
        if (message.level === "error") {
          handler.critical(message.id, message.text,);
        } else {
          handler.warning(message.id, message.text,);
        }
      }
    } finally {
      handler.abortOnWarning = abortOnWarning;
    }
    results.man = manSection(options.man, output,);
    return buildEnvelope(
      options,
      handler,
      results,
      handler.errors > 0 ? EXIT_ERROR : EXIT_OK,
    );
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

  // Agenda primeiro (Ruby l.192-194): as operações abaixo dependem dela.
  let scheduled = false;
  try {
    scheduled = tj.schedule();
  } catch (_error) {
    scheduled = false;
  }
  // Falha de agenda só é fatal sem `--force-reports`.
  if (!scheduled && !options.forceReports) {
    return buildEnvelope(options, handler, results, EXIT_ERROR,);
  }

  // Verificação de folha contra o projeto (Ruby l.196-203) — antes do freeze,
  // como no `tj3`: o `check-ts` só relê o projeto, nunca gera artefato.
  if (options.app === "check-ts" || options.app === "check-ss") {
    const outcome = checkSheetSection(tj, options.app, request.appOptions,);
    results.sheet = outcome.section;
    const failed = outcome.exitCode !== EXIT_OK || handler.errors > 0;
    return buildEnvelope(
      options,
      handler,
      results,
      failed ? EXIT_ERROR : EXIT_OK,
    );
  }

  // `--freeze` (Ruby l.205-209): gera header + bookings como **dado**; a
  // escrita dos dois arquivos é da CLI (24.9.5). O pipeline de relatórios
  // continua depois, como no Ruby.
  if (options.freeze !== null) {
    const frozen = tj.freeze(
      options.freeze.date ?? null,
      options.freeze.byTask === true,
    );
    if (frozen !== null) results.freeze = freezeSection(frozen.files,);
    if (frozen === null || handler.errors > 0) {
      return buildEnvelope(options, handler, results, EXIT_ERROR,);
    }
  }

  // Apps de email da F18 (24.10.1–24.10.4). No Ruby são programas próprios
  // (`tj3ts_sender`, `tj3ss_receiver`, …); aqui rodam sobre o
  // `MemoryFileStore` semeado com os dados do request e a chamada termina ali
  // (ADR 036/037). O `request` é a fonte: o eco só carrega caminhos.
  if (options.app !== null) {
    const outcome = await runSheetSection(
      tj.project!,
      options.app,
      request.appOptions ?? null,
    );
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
