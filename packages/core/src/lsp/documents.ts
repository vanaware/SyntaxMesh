/**
 * `documents.ts` — the LSP document store (22.1.5).
 *
 * Pure in-memory `Map<uri, {text, version}>` fed by `didOpen`/`didChange`/
 * `didClose`. Supports **full** and **incremental** (range) synchronization;
 * no transport and no filesystem — the host pushes the content.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (DocumentStore)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import type { ContentChange, Range, } from "./types.ts";

/** One open document: its current text and the client's version counter. */
export interface DocumentEntry {
  /** Full text of the document after the last applied change. */
  text: string;
  /** Version sent by the client (`didOpen`/`didChange`). */
  version: number;
}

/**
 * Applies one range edit to a text, converting the 0-based LSP line/character
 * pair into string offsets. Out-of-bounds positions are clamped (defensive:
 * a well-behaved client never sends them).
 */
function applyRangeEdit(
  text: string,
  range: Range,
  replacement: string,
): string {
  const lineStarts: number[] = [0,];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") lineStarts.push(i + 1,);
  }
  const offsetOf = (line: number, character: number,): number => {
    const clampedLine = Math.min(Math.max(line, 0,), lineStarts.length - 1,);
    const start = lineStarts[clampedLine]!;
    let end = text.length;
    if (clampedLine + 1 < lineStarts.length) {
      end = lineStarts[clampedLine + 1]! - 1;
    }
    // Exclude a trailing `\r` so CRLF documents edit cleanly.
    if (end > start && text[end - 1] === "\r") end--;
    return start + Math.min(Math.max(character, 0,), end - start,);
  };
  const start = offsetOf(range.start.line, range.start.character,);
  const end = offsetOf(range.end.line, range.end.character,);
  return text.slice(0, start,) + replacement +
    text.slice(Math.max(end, start,),);
}

/**
 * The open documents of one server instance. Every method is synchronous and
 * side-effect-free outside the internal map.
 */
export class DocumentStore {
  private readonly documents = new Map<string, DocumentEntry>();

  /** Number of open documents. */
  get size(): number {
    return this.documents.size;
  }

  /**
   * Registers a document (`textDocument/didOpen`). Re-opening an URI replaces
   * the previous entry, as the protocol allows only one open per URI.
   *
   * @param uri document URI.
   * @param text initial full text.
   * @param version client version, default `0`.
   */
  open(uri: string, text: string, version = 0,): void {
    this.documents.set(uri, { text, version, },);
  }

  /**
   * Applies `textDocument/didChange` events in order. Each change is either
   * full (`{text}`) or incremental (`{range, text}`); incremental ranges
   * refer to the state **after** the previous change of the same event.
   *
   * @param uri document URI.
   * @param version new client version.
   * @param changes the content changes, in protocol order.
   * @returns `false` when the URI is not open (the change is dropped).
   */
  change(
    uri: string,
    version: number,
    changes: readonly ContentChange[],
  ): boolean {
    const entry = this.documents.get(uri,);
    if (entry === undefined) return false;
    let text = entry.text;
    for (const change of changes) {
      if ("range" in change && change.range !== undefined) {
        text = applyRangeEdit(text, change.range, change.text,);
      } else {
        text = change.text;
      }
    }
    this.documents.set(uri, { text, version, },);
    return true;
  }

  /**
   * Forgets a document (`textDocument/didClose`).
   *
   * @param uri document URI.
   * @returns `false` when the URI was not open.
   */
  close(uri: string,): boolean {
    return this.documents.delete(uri,);
  }

  /**
   * Reads the current entry of a document.
   *
   * @param uri document URI.
   * @returns the entry, or `undefined` when the URI is not open.
   */
  get(uri: string,): DocumentEntry | undefined {
    return this.documents.get(uri,);
  }
}
