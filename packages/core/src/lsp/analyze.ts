/**
 * `analyze.ts` — document analysis of the LSP (22.1.7).
 *
 * Wraps `TaskJuggler.parseContent` with the per-call isolation of the
 * `execute` pattern: `MessageHandlerInstance` is a process singleton, so every
 * call resets it and snapshots the messages afterwards. No scheduling and no
 * reports — the language services work on the parsed tree alone.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (analyzeDocument)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { MessageHandlerInstance, } from "../message-handler.ts";
import { TaskJuggler, } from "../taskjuggler.ts";
import type { FileContentProvider, } from "../taskjuggler.ts";
import type { Message, } from "../message.ts";
import type { Project, } from "../model/project.ts";
import { resolveLocale, } from "./locale.ts";
import type { Locale, } from "./locale.ts";

/** The immutable outcome of analyzing one document version. */
export interface AnalysisResult {
  /** Document URI (also the file name reported in diagnostics). */
  uri: string;
  /** Exact text that was analyzed (kept for the incremental-reuse hook). */
  text: string;
  /** Client version of the analyzed text. */
  version: number;
  /** Locale resolved from the `language "..."` directive. */
  locale: Locale;
  /** Parsed project, or `null` when the parse failed. */
  project: Project | null;
  /** Snapshot of the handler messages produced by this call. */
  messages: Message[];
  /** `true` when the project was built without errors. */
  ok: boolean;
}

/** Options of {@link analyzeDocument}. */
export interface AnalyzeOptions {
  /** Client version to stamp on the result (default `0`). */
  version?: number;
  /**
   * Previous analysis of the same URI: when the text is unchanged the result
   * is reused (only the version is stamped), skipping the parse.
   */
  previous?: AnalysisResult | null;
  /** Resolver for `include`s; `null` keeps the document self-contained. */
  provider?: FileContentProvider | null;
}

/**
 * Parses a document and returns its analysis as data.
 *
 * Isolation (same contract as `execute`): the singleton handler is reset
 * before the parse and the messages are copied out, so concurrent consumers
 * never share state. Calls are synchronous; hosts that need serialization
 * queue them like the CLI does.
 *
 * @param uri document URI, used as the diagnostic file name.
 * @param text full document text.
 * @param opts version, incremental-reuse hook and include provider.
 * @returns the analysis of this text/version.
 */
export function analyzeDocument(
  uri: string,
  text: string,
  opts: AnalyzeOptions = {},
): AnalysisResult {
  const version = opts.version ?? 0;
  const previous = opts.previous ?? null;
  if (previous !== null && previous.uri === uri && previous.text === text) {
    return { ...previous, version, };
  }
  const handler = MessageHandlerInstance.instance;
  handler.reset();
  const tj = new TaskJuggler();
  let ok = false;
  try {
    ok = tj.parseContent(text, uri, opts.provider ?? null,);
  } catch (_error) {
    ok = false;
  }
  return {
    uri,
    text,
    version,
    locale: resolveLocale(uri, text,),
    project: tj.project,
    messages: [...handler.messages,],
    ok,
  };
}
