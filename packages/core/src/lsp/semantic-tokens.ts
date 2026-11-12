/**
 * `semantic-tokens.ts` — semantic tokens of one document (22.1.13).
 *
 * ⚠️ ADAPTAÇÃO (vs the task wording "tokens do lexer (ScannerToken)"): the
 * engine scanner reports **line-level** positions only (`columnNo()` is always
 * 0), drops comments/whitespace as ignored tokens, expands macros (so token
 * text no longer matches the source) and aborts on the first unrecognized
 * character. None of that fits an editor, which needs exact spans over
 * **incomplete** text. This module therefore runs a tolerant single-pass
 * tokenizer over the raw text, mirroring the token families of
 * `ProjectFileScanner` (ID/ABSOLUTE_ID, DATE, TIME, FLOAT/INTEGER, STRING,
 * comments) with exact 0-based positions, and never throws.
 *
 * Keyword classification uses `CANONICAL_KEYWORDS` of the i18n module — the
 * same vocabulary the FSM matches. The legend is the stable one of
 * `capabilities.ts` (indexes are part of the contract with the client).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (getSemanticTokens)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { CANONICAL_KEYWORDS, } from "../i18n/mod.ts";
import type { AnalysisResult, } from "./analyze.ts";
import { SEMANTIC_TOKEN_TYPES, } from "./capabilities.ts";
import type { Position, } from "./types.ts";

/** Index of each token type in the stable legend (encoding order). */
const TYPE_INDEX: Record<string, number> = Object.fromEntries(
  SEMANTIC_TOKEN_TYPES.map((type, index,) => [type, index,]),
);

/** Canonical keywords as a lookup set (classification of ID tokens). */
const KEYWORDS: ReadonlySet<string> = new Set(CANONICAL_KEYWORDS,);

/** One classified token with its exact 0-based position in the document. */
export interface PositionedToken {
  /** Zero-based line of the token start. */
  line: number;
  /** Zero-based character of the token start (UTF-16 units). */
  character: number;
  /** Length of the token in UTF-16 units. */
  length: number;
  /** Token type name of the legend (`keyword`, `string`, …). */
  type: string;
}

/** Date literal of the scanner (`yyyy-mm-dd` with optional time/zone). */
const DATE_RE =
  /\d{4}-\d{1,2}-\d{1,2}(-\d{1,2}:\d{1,2}(:\d{1,2})?(-[-+]?\d{4})?)?/y;
/** Time of day (`hh:mm`), classified as number (no `time` in the legend). */
const TIME_RE = /\d{1,2}:\d{2}/y;
/** Floating-point number (scanner FLOAT). */
const FLOAT_RE = /\d*\.\d+/y;
/** Integer number (scanner INTEGER). */
const INTEGER_RE = /\d+/y;
/** Identifier, plain or dotted (scanner ID / ABSOLUTE_ID). */
const ID_RE = /[A-Za-z_\p{L}][\p{L}\p{N}_]*(\.[A-Za-z_\p{L}][\p{L}\p{N}_]*)*/uy;

/**
 * Tokenizes one document text into classified, positioned tokens.
 *
 * Single pass, tolerant: unterminated strings/comments run to the end of the
 * text instead of failing. Comments are recognized **outside** strings only
 * (the `#` of `"a # b"` stays string content). Macro calls are not expanded —
 * their names surface as ordinary identifiers.
 *
 * @param text full document text.
 * @returns tokens in source order, with exact 0-based spans.
 */
export function tokenize(text: string,): PositionedToken[] {
  const tokens: PositionedToken[] = [];
  let line = 0;
  let character = 0;
  let i = 0;

  /** Consumes `length` characters, keeping the line/character cursor. */
  const advance = (length: number,): void => {
    for (let k = i; k < i + length; k++) {
      if (text[k] === "\n") {
        line++;
        character = 0;
      } else {
        character++;
      }
    }
    i += length;
  };
  /** Records a token at the current cursor and consumes its text. */
  const emit = (length: number, type: string,): void => {
    tokens.push({ line, character, length, type, },);
    advance(length,);
  };
  /** Tries a sticky regex at the cursor; returns the match or `null`. */
  const match = (re: RegExp,): string | null => {
    re.lastIndex = i;
    const found = re.exec(text,);
    return found === null ? null : found[0];
  };

  while (i < text.length) {
    const ch = text[i]!;

    // Line comments: `#` and `//` (scanner ignores them; here they are tokens).
    if (ch === "#" || (ch === "/" && text[i + 1] === "/")) {
      let end = text.indexOf("\n", i,);
      if (end === -1) end = text.length;
      emit(end - i, "comment",);
      continue;
    }
    // Block comment `/* … */` (unterminated runs to the end of the text).
    if (ch === "/" && text[i + 1] === "*") {
      const close = text.indexOf("*/", i + 2,);
      const end = close === -1 ? text.length : close + 2;
      emit(end - i, "comment",);
      continue;
    }
    // Quoted strings (double or single), honouring backslash escapes.
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== ch) {
        j += text[j] === "\\" ? 2 : 1;
      }
      const end = Math.min(j + 1, text.length,);
      emit(end - i, "string",);
      continue;
    }
    // Scissors string `-8<- … ->8-` (the opening mark ends its line).
    if (text.startsWith("-8<-", i,)) {
      const close = text.indexOf("->8-", i + 4,);
      const end = close === -1 ? text.length : close + 4;
      emit(end - i, "string",);
      continue;
    }

    // Numbers and dates: DATE before TIME before FLOAT before INTEGER, the
    // same precedence as the scanner pattern table.
    const date = match(DATE_RE,);
    if (date !== null) {
      emit(date.length, "date",);
      continue;
    }
    const time = match(TIME_RE,);
    if (time !== null) {
      emit(time.length, "number",);
      continue;
    }
    const float = match(FLOAT_RE,);
    if (float !== null) {
      emit(float.length, "number",);
      continue;
    }
    const integer = match(INTEGER_RE,);
    if (integer !== null) {
      emit(integer.length, "number",);
      continue;
    }

    // Identifiers: keywords of the language vs user-defined names.
    const id = match(ID_RE,);
    if (id !== null) {
      emit(id.length, KEYWORDS.has(id,) ? "keyword" : "identifier",);
      continue;
    }

    // Whitespace, punctuation and macro syntax: no semantic token.
    advance(1,);
  }
  return tokens;
}

/**
 * The token under a 0-based position, of any type (keyword, identifier,
 * string, …), or `null` when the cursor is on whitespace/punctuation.
 *
 * @param text full document text.
 * @param position 0-based cursor position.
 * @returns the positioned token containing the cursor, or `null`.
 */
export function tokenAt(
  text: string,
  position: Position,
): PositionedToken | null {
  for (const token of tokenize(text,)) {
    if (token.line !== position.line) continue;
    if (
      position.character >= token.character &&
      position.character < token.character + token.length
    ) return token;
  }
  return null;
}

/**
 * Encodes positioned tokens into the LSP semantic-tokens delta format: five
 * integers per token — `deltaLine`, `deltaStartChar`, `length`, `tokenType`,
 * `tokenModifiers` (always 0: the v1 legend has no modifiers). Tokens must
 * arrive in source order (as {@link tokenize} produces them).
 *
 * @param tokens classified tokens in source order.
 * @returns the flat delta-encoded array the protocol expects.
 */
export function encodeSemanticTokens(
  tokens: readonly PositionedToken[],
): number[] {
  const data: number[] = [];
  let previousLine = 0;
  let previousCharacter = 0;
  for (const token of tokens) {
    const deltaLine = token.line - previousLine;
    const deltaStart = deltaLine === 0
      ? token.character - previousCharacter
      : token.character;
    data.push(
      deltaLine,
      deltaStart,
      token.length,
      TYPE_INDEX[token.type] ?? 0,
      0,
    );
    previousLine = token.line;
    previousCharacter = token.character;
  }
  return data;
}

/**
 * Semantic tokens of one analyzed document, delta-encoded for the protocol.
 * Works on the raw text — the parse result is not required, so highlighting
 * survives syntax errors.
 *
 * @param analysis result of {@link analyzeDocument} (only `text` is used).
 * @returns the `SemanticTokens.data` array (empty for an empty document).
 */
export function getSemanticTokens(analysis: AnalysisResult,): number[] {
  return encodeSemanticTokens(tokenize(analysis.text,),);
}
