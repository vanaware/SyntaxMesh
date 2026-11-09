/**
 * Montagem do envelope de execução (Fase 24 — adendo v2.1 §3.3/§3.4).
 *
 * O envelope é **dado puro**: mensagens estruturadas (sem ANSI), eco das
 * opções com defaults (só caminhos, nunca conteúdos) e `exitCode` calculado
 * pela matriz fiel a `apps/Tj3.rb` — o core **não** chama `exit`.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.3
 * @see docs/syntaxmesh/fases/fase-24-cli.md §5.3
 */
import type { MessageHandlerInstance, } from "../message-handler.ts";
import { normalizeInputPath, } from "./paths.ts";
import type {
  ExecutionMessage,
  ExecutionOptionsEcho,
  ExecutionRequest,
  ExecutionResult,
  ExecutionResults,
  ExecutionSheetAppOptions,
  ExecutionSheetAppOptionsEcho,
} from "./types.ts";

/** Exit code de sucesso. */
export const EXIT_OK = 0;
/** Exit code de erro (parse, relatório, warnings com `--abort-on-warnings`). */
export const EXIT_ERROR = 1;

/** Snapshot estruturado das mensagens do handler (adendo §3.3). */
export function snapshotMessages(
  handler: MessageHandlerInstance,
): ExecutionMessage[] {
  return handler.messages.map((message,) => ({
    severity: message.type,
    id: message.id,
    text: message.message,
    file: message.sourceFileInfo?.fileName ?? null,
    line: message.sourceFileInfo?.lineNo ?? null,
  }));
}

/**
 * `appOptions` do eco: o fechamento de leitura vira lista de caminhos.
 *
 * O contrato ecoa **só caminhos** (adendo §3.4); os conteúdos dos arquivos
 * semeados ficam no request, de onde o `execute` os consome — o envelope nunca
 * os devolve.
 */
function echoAppOptions(
  options: ExecutionSheetAppOptions | undefined,
): ExecutionSheetAppOptionsEcho | null {
  if (options === undefined) return null;
  const { files, ...rest } = options;
  return files === undefined
    ? { ...rest, }
    : { ...rest, files: files.map((file,) => file.path), };
}

/**
 * Eco do request com defaults aplicados (`options` do envelope).
 *
 * Dos arquivos saem **apenas os caminhos**; `configContent` é o YAML que o
 * consumidor já possui (não é arquivo de projeto) e é ecoado como recebido.
 */
export function echoOptions(request: ExecutionRequest,): ExecutionOptionsEcho {
  const files = request.files ?? [];
  const paths = files.map((file,) => file.path);
  const entry = request.entry ?? paths[0] ?? "";
  return {
    entry,
    files: paths,
    configContent: request.configContent ?? null,
    checkSyntax: request.checkSyntax === true,
    listReports: request.listReports ?? null,
    // `--list-reports` é regex por definição no tj3 (default `*`).
    listReportsIsRegex: request.listReportsIsRegex !== false,
    report: request.report ?? null,
    reportsIsRegex: request.reportsIsRegex === true,
    dynamicAttributes: request.dynamicAttributes ?? null,
    outputDir: request.outputDir ?? null,
    noReports: request.noReports === true,
    forceReports: request.forceReports === true,
    abortOnWarnings: request.abortOnWarnings === true,
    warnTsDeltas: request.warnTsDeltas === true,
    addTrace: request.addTrace === true,
    freeze: request.freeze ?? null,
    help: request.help === true,
    version: request.version === true,
    man: request.man ?? null,
    app: request.app ?? null,
    appOptions: echoAppOptions(request.appOptions,),
  };
}

/** Chave canônica de path para o *lookup* em memória da lista do request. */
export function fileKey(path: string,): string {
  return normalizeInputPath(path,);
}

/** Monta o envelope final a partir das partes já calculadas. */
export function buildEnvelope(
  options: ExecutionOptionsEcho,
  handler: MessageHandlerInstance,
  results: ExecutionResults,
  exitCode: number,
): ExecutionResult {
  return {
    ok: exitCode === EXIT_OK,
    exitCode,
    options,
    messages: snapshotMessages(handler,),
    results,
  };
}
