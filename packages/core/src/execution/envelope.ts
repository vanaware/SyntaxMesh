/**
 * Assembly of the execution envelope (phase 24 — addendum v2.1 §3.3/§3.4).
 *
 * The envelope is **pure data**: structured messages (no ANSI), echo of the
 * options with defaults (paths only, never contents) and the `exitCode`
 * computed by the matrix faithful to `apps/Tj3.rb` — the core does **not** call
 * `exit`.
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

/** Success exit code. */
export const EXIT_OK = 0;
/** Error exit code (parse, report, warnings with `--abort-on-warnings`). */
export const EXIT_ERROR = 1;

/** Structured snapshot of the handler messages (addendum §3.3). */
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
 * `appOptions` of the echo: the read closure becomes a list of paths.
 *
 * The contract echoes **paths only** (addendum §3.4); the contents of the
 * seeded files stay in the request, from where `execute` consumes them — the
 * envelope never returns them.
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
 * Echo of the request with the defaults applied (`options` of the envelope).
 *
 * From the files only the **paths** come out; `configContent` is the YAML the
 * consumer already holds (it is not a project file) and is echoed as received.
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
    // `--list-reports` is a regex by definition in tj3 (default `*`).
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

/** Canonical path key for the in-memory lookup of the request list. */
export function fileKey(path: string,): string {
  return normalizeInputPath(path,);
}

/** Builds the final envelope from the parts already computed. */
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
