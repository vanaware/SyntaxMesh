/**
 * `man.ts` — facade of the `doc-core` `man` command (22.1b.7 / 24.9.1–24.9.3).
 *
 * Reproduces the behaviour of `apps/Tj3Man.rb` without touching the disk, the
 * terminal or the browser: the result is **data** — textual content and, in the
 * HTML format, the manual's file map. The CLI is what prints or writes it.
 *
 * Three formats:
 *
 * - `text` — terminal documentation (`KeywordDocumentation#to_s`); without a
 *   keyword, the list of every documented keyword (`Tj3Man.rb:110-120`).
 * - `html` — the complete manual (`UserManual#generate`) or a single page; the
 *   result arrives in `files`, ready for the CLI `--output-dir`.
 * - `smx` — a pasteable source excerpt: the annotated example of the keyword
 *   (`Pattern#exampleFile`) or, without an example, the syntax skeleton.
 *   Without a keyword, a reference sheet with every keyword in comments.
 *
 * Keyword resolution uses the {@link TernarySearchTree} with prefix matching
 * (`TernarySearchTree#find(prefix, true)`), like `tj3man`; ambiguity becomes a
 * **warning** listing the candidates, not an error.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3Man.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco G
 */

import { TernarySearchTree, } from "../utils/ternary-search-tree.ts";
import { SyntaxReference, syntaxReference, } from "./syntax-reference.ts";
import type { KeywordDocumentation, } from "./keyword-documentation.ts";
import { UserManual, } from "./user-manual.ts";
import { ExampleSnippet, } from "./example-snippet.ts";
import { EXAMPLE_CORPUS, } from "./manual/example-corpus.ts";
import {
  MANUAL_STYLESHEET,
  MANUAL_STYLESHEET_NAME,
} from "./manual/manual-css.ts";

/** Output formats accepted by the `man` section. */
export type ManFormat = "text" | "html" | "smx";

/** A file produced in the `html` format (the CLI writes it to `--output-dir`). */
export interface ManFile {
  /** Path relative to the output directory. */
  name: string;
  /** Full content of the file. */
  contents: string;
}

/** Warning produced by the keyword resolution. */
export interface ManMessage {
  /** `error` interrupts the output of that keyword; `warning` does not. */
  level: "error" | "warning";
  /** Stable identifier (`man_no_matches`, …). */
  id: string;
  /** Text in English, ready for the CLI to print. */
  text: string;
}

/** Request of the `man` section. */
export interface ManRequest {
  /** Desired format (default `text`). */
  format?: ManFormat;
  /** Requested keywords; empty = the complete document. */
  keywords?: readonly string[];
  /** Colors the textual output with ANSI (`--no-color` turns it off). */
  color?: boolean;
  /** Omits `deprecated`/`removed` keywords. */
  ignoreOld?: boolean;
}

/** Result of the `man` section. */
export interface ManOutput {
  /** Format actually used. */
  format: ManFormat;
  /** Textual content (empty in the `html` format, which uses `files`). */
  content: string;
  /** Manual files (only in the `html` format). */
  files: ManFile[];
  /** Messages of the keyword resolution. */
  messages: ManMessage[];
}

/**
 * Generates the requested documentation.
 *
 * It does not throw for an unknown keyword: the failure comes back in
 * `messages` so the consumer decides the `exitCode` (the CLI uses `1`, like
 * `tj3man`).
 */
export function generateMan(request: ManRequest = {},): ManOutput {
  const format = request.format ?? "text";
  const keywords = [...(request.keywords ?? []),];
  const messages: ManMessage[] = [];

  switch (format) {
    case "html":
      return generateHtml(keywords, request, messages,);
    case "smx":
      return generateSmx(keywords, request, messages,);
    default:
      return generateText(keywords, request, messages,);
  }
}

// --- Formatos ---------------------------------------------------------------

/** `text` format: the `to_s` of every keyword, or the complete list. */
function generateText(
  keywords: string[],
  request: ManRequest,
  messages: ManMessage[],
): ManOutput {
  const reference = syntaxReference(null, request.ignoreOld ?? false,);

  if (keywords.length === 0) {
    return {
      format: "text",
      content: `${reference.all().join("\n",)}\n`,
      files: [],
      messages,
    };
  }

  const parts: string[] = [];
  for (const resolved of resolveKeywords(reference, keywords, messages,)) {
    parts.push(reference.toText(resolved, request.color ?? false,),);
  }
  return {
    format: "text",
    content: parts.map((part,) => part.endsWith("\n",) ? part : `${part}\n`)
      .join("",),
    files: [],
    messages,
  };
}

/**
 * `smx` format: the annotated example or the syntax skeleton.
 *
 * The text is meant to be pasted into a project — hence the dialect's own
 * comment (`# …`) instead of the manual markup.
 */
function generateSmx(
  keywords: string[],
  request: ManRequest,
  messages: ManMessage[],
): ManOutput {
  const reference = syntaxReference(null, request.ignoreOld ?? false,);

  if (keywords.length === 0) {
    const blocks = ["# SyntaxMesh keyword cheat sheet",];
    for (const keyword of reference.all()) {
      const documentation = reference.keywords.get(keyword,);
      if (documentation === undefined) continue;
      blocks.push(smxBlock(documentation,),);
    }
    return {
      format: "smx",
      content: `${blocks.join("\n\n",)}\n`,
      files: [],
      messages,
    };
  }

  const blocks: string[] = [];
  for (const resolved of resolveKeywords(reference, keywords, messages,)) {
    const documentation = reference.keywords.get(resolved,);
    if (documentation === undefined) continue;
    blocks.push(smxBlock(documentation,),);
  }
  return {
    format: "smx",
    content: blocks.length === 0 ? "" : `${blocks.join("\n\n",)}\n`,
    files: [],
    messages,
  };
}

/** `html` format: the complete manual, or one page. */
function generateHtml(
  keywords: string[],
  request: ManRequest,
  messages: ManMessage[],
): ManOutput {
  if (keywords.length === 0) {
    const manual = new UserManual({ ignoreOld: request.ignoreOld ?? false, },);
    const pages = manual.generate();
    return {
      format: "html",
      content: "",
      files: Object.entries(pages,).map(([name, contents,],) => ({
        name,
        contents,
      })),
      messages,
    };
  }

  // A single page: it does not generate the whole manual, but needs the
  // reference bound to the manual (header, footer, navigation and examples).
  const manual = new UserManual({ ignoreOld: request.ignoreOld ?? false, },);
  manual.reference.all();

  const files: ManFile[] = [];
  for (
    const resolved of resolveKeywords(manual.reference, keywords, messages,)
  ) {
    files.push({
      name: `${resolved}.html`,
      contents: manual.reference.generateHTMLreference(resolved, manual,),
    },);
  }
  if (files.length > 0) {
    files.push({
      name: MANUAL_STYLESHEET_NAME,
      contents: MANUAL_STYLESHEET,
    },);
  }
  return { format: "html", content: "", files, messages, };
}

// --- Helpers ----------------------------------------------------------------

/** `# keyword: syntax` header, annotated example and purpose, in that order. */
function smxBlock(documentation: KeywordDocumentation,): string {
  const header = `# ${documentation.title()}: ${documentation.syntax}`;
  const example = exampleFor(documentation,);
  if (example !== null) return `${header}\n${example.trimEnd()}`;
  const purpose = documentation.purposeText();
  return purpose === "" ? header : `${header}\n# ${purpose}`;
}

/**
 * Resolves every requested keyword, accumulating messages (faithful to
 * `Tj3Man`).
 *
 * A prefix matching **a single** keyword is resolved to it: `tj3man` forwards the
 * typed text to `to_s` and prints nothing, which only frustrates whoever types
 * `syntaxmesh man effor`. Ambiguity remains a warning, as in Ruby.
 */
function resolveKeywords(
  reference: SyntaxReference,
  keywords: string[],
  messages: ManMessage[],
): string[] {
  const tree = new TernarySearchTree<string>();
  tree.insertList(reference.all(),);

  const resolved: string[] = [];
  for (const keyword of keywords) {
    const match = tree.find(keyword, true,);
    if (match === null) {
      messages.push({
        level: "error",
        id: "man_no_matches",
        text: `No matches found for '${keyword}'`,
      },);
      continue;
    }
    const candidates = Array.isArray(match,) ? match : [match,];
    if (candidates.length === 1) {
      resolved.push(candidates[0]!,);
      continue;
    }
    if (candidates.includes(keyword,)) {
      resolved.push(keyword,);
      continue;
    }
    messages.push({
      level: "warning",
      id: "man_multi_match",
      text: `Multiple matches found for '${keyword}':\n${
        candidates.join(", ",)
      }`,
    },);
  }
  return resolved;
}

/** Cache of the already processed example files (one per corpus). */
const exampleCache = new Map<string, ExampleSnippet>();

/** Annotated example of the keyword (or `null` when it declares none). */
function exampleFor(documentation: KeywordDocumentation,): string | null {
  const file = documentation.pattern.exampleFile;
  if (!file) return null;
  let snippet = exampleCache.get(file,);
  if (snippet === undefined) {
    const source = EXAMPLE_CORPUS[file];
    if (source === undefined) return null;
    snippet = new ExampleSnippet();
    snippet.parse(source,);
    exampleCache.set(file, snippet,);
  }
  return snippet.text(documentation.pattern.exampleTag,);
}
