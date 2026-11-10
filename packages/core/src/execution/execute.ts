/**
 * `execute` — the single entry point for command-line calls (phase 24 —
 * ADR 034, appendix v2.1 §3.1/§3.4).
 *
 * Ports the flow of `apps/Tj3.rb#appMain` (l.171-228) **without** argv, without a
 * filesystem and without `exit`: it takes the file contents inline, resolves
 * `include` by in-memory *lookup*, runs parse → gates → schedule → reports and
 * returns the envelope with the `exitCode` as **data**.
 *
 * Per-call isolation (a requirement for server use — appendix §3.6):
 * `MessageHandlerInstance` is a process singleton, so every `execute` resets the
 * handler and uses its own `TaskJuggler` instance; the `DataCache` is flushed at
 * the end. Concurrent calls in the same process share neither project nor
 * messages.
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
 * Builds the content provider that does the *lookup* into the request list.
 *
 * No disk and no external provider: a missing `include` becomes a file error
 * (`bad_include`, faithful to `tj3`), never a filesystem exception.
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
 * Executes the request and returns the envelope.
 *
 * Order faithful to `tj3`: `--version`/`--help` answer on their own (without a
 * project), `--check-syntax` and `--list-reports` stop before scheduling,
 * `--no-reports` schedules and stops, and the error gate can be waived by
 * `forceReports`.
 *
 * **Per-process serialization:** concurrent calls enter a queue — the
 * `MessageHandler`/`DataCache` are process singletons, so running two at once
 * would mix messages. Appendix §3.6 sanctions exactly this ("concurrent servers
 * serialize calls per instance"); real parallelism needs one instance/worker per
 * request.
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

/** Process execution queue (see `execute`). */
let executeQueue: Promise<unknown> = Promise.resolve();

/**
 * Project loaded by the latest {@link execute} call.
 *
 * An **in-process** convenience (plan §5.5 item 9), never a contract: the
 * envelope is the official result. The CLI uses it only for the project summary
 * (24.4.5) and the PWA may reuse it; remote consumers (worker/HTTP) have no
 * access.
 */
let lastProject: Project | null = null;

/** Project of the last completed `execute` (or `null`). */
export function lastExecutedProject(): Project | null {
  return lastProject;
}

/** Body of `execute`, always called with a free queue. */
async function executeRequest(
  request: ExecutionRequest,
): Promise<ExecutionResult> {
  const handler = MessageHandlerInstance.instance;
  // Per-call isolation: the handler is a process singleton.
  handler.reset();
  handler.abortOnWarning = request.abortOnWarnings === true;
  lastProject = null;

  const options = echoOptions(request,);
  const results: ExecutionResults = {};

  // `--version` / `--help` do not open a project: in Ruby the `on_tail` of
  // `Tj3AppBase` prints and **exits**, even with files on the command line.
  if (options.version) results.version = versionSection();
  if (options.help) results.help = helpSection();
  if (options.version || options.help) {
    return buildEnvelope(options, handler, results, EXIT_OK,);
  }

  // `syntaxmesh man` (24.9.1–24.9.3): `doc-core` syntax documentation (phase
  // 22). It opens no project and writes nothing — it returns text and, in the
  // `html` format, the manual's file map. Writing is the CLI's job (24.5).
  if (options.man !== null) {
    const output = generateMan({
      format: options.man.format,
      keywords: options.man.keywords ?? [],
      color: options.man.color ?? false,
      ignoreOld: options.man.ignoreOld ?? false,
    },);
    // The documentation query is not a project: `--abort-on-warnings` and the
    // parse `trapSetup` do not apply here (Ruby handles them in `tj3man`, a
    // separate program). `critical` records without raising.
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

  // In-process convenience for the CLI summary (24.4.5).
  lastProject = tj.project;

  // `--check-syntax`: only the parse counts; no schedule (Ruby l.190).
  if (options.checkSyntax) {
    results.check = checkSection(true,);
    return buildEnvelope(options, handler, results, EXIT_OK,);
  }

  // `--list-reports` reads the parsed tree and needs no schedule (plan §5.2).
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

  // Schedule first (Ruby l.192-194): the operations below depend on it.
  let scheduled = false;
  try {
    scheduled = tj.schedule();
  } catch (_error) {
    scheduled = false;
  }
  // A scheduling failure is only fatal without `--force-reports`.
  if (!scheduled && !options.forceReports) {
    return buildEnvelope(options, handler, results, EXIT_ERROR,);
  }

  // Sheet check against the project (Ruby l.196-203) — before the freeze, as in
  // `tj3`: `check-ts` only re-reads the project and never produces an artifact.
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

  // `--freeze` (Ruby l.205-209): produces header + bookings as **data**;
  // writing the two files is the CLI's job (24.9.5). The report pipeline
  // continues afterwards, as in Ruby.
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

  // Phase 18 email apps (24.10.1–24.10.4). In Ruby they are separate programs
  // (`tj3ts_sender`, `tj3ss_receiver`, …); here they run over the
  // `MemoryFileStore` seeded with the request data and the call ends there
  // (ADR 036/037). The `request` is the source: the echo only carries paths.
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

  // Plan §5.5.3 gate: with earlier errors nothing is rendered, unless
  // `--force-reports` (which the Ruby matrix uses against the schedule failure).
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

  // The data cache is flushed at the end of every execution (Ruby
  // `generateReports`).
  DataCache.instance.flush();

  const failed = !section.ok || handler.errors > 0;
  return buildEnvelope(
    options,
    handler,
    results,
    failed ? EXIT_ERROR : EXIT_OK,
  );
}
