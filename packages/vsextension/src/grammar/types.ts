/**
 * `grammar/types.ts` — structural types of the TextMate artifacts (22.3.1).
 *
 * Minimal, dependency-free shapes of a TextMate grammar and a VS Code
 * language configuration. The generators (`textmate.ts`, `tji.ts`,
 * `language-config.ts`) return these as **data**; the generate script
 * (22.3.5) serializes them to JSON. Keeping the shapes local avoids dragging
 * an external grammar typings package into the pure, browser-safe core of the
 * extension (ADR 035; plan §6).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §6
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.3
 */

/** A single TextMate rule (match, begin/end region, or repository include). */
export interface TextMatePattern {
  /** Scope assigned to the whole match. */
  name?: string;
  /** Regular expression matched against the text (single-line rule). */
  match?: string;
  /** Regular expression opening a multi-line region. */
  begin?: string;
  /** Regular expression closing a multi-line region. */
  end?: string;
  /** Reference to a repository entry (`#name`) or another grammar scope. */
  include?: string;
  /** Nested rules applied inside a begin/end region. */
  patterns?: TextMatePattern[];
  /** Scopes of the capture groups of `match`. */
  captures?: Record<string, TextMateCapture>;
  /** Scopes of the capture groups of `begin`. */
  beginCaptures?: Record<string, TextMateCapture>;
  /** Scopes of the capture groups of `end`. */
  endCaptures?: Record<string, TextMateCapture>;
}

/** Scope assigned to one numbered capture group. */
export interface TextMateCapture {
  /** Scope name of the capture group. */
  name: string;
}

/** A named collection of rules referenced by `include: "#name"`. */
export interface TextMateRepositoryEntry {
  /** Rules of the entry, applied in order. */
  patterns: TextMatePattern[];
}

/** A complete TextMate grammar (serialized to `*.tmLanguage.json`). */
export interface TextMateGrammar {
  /** Human-readable grammar name. */
  name: string;
  /** Root scope of the grammar (e.g. `source.syntaxmesh`). */
  scopeName: string;
  /** Top-level rules, applied in order. */
  patterns: TextMatePattern[];
  /** Named rule collections referenced by the patterns. */
  repository: Record<string, TextMateRepositoryEntry>;
}

/** Comment configuration of a language (line and block delimiters). */
export interface CommentRule {
  /** Line-comment prefix (e.g. `#`). */
  lineComment?: string;
  /** Block-comment opening and closing delimiters. */
  blockComment?: [string, string,];
}

/** A bracket pair recognized by the editor. */
export interface BracketPair {
  /** Opening delimiter. */
  open: string;
  /** Closing delimiter. */
  close: string;
}

/** An auto-closing pair (optionally restricted to certain scopes). */
export interface AutoClosingPair {
  /** Opening delimiter. */
  open: string;
  /** Closing delimiter. */
  close: string;
  /** Scopes where the pair must not auto-close. */
  notIn?: string[];
}

/** Folding markers of a language. */
export interface FoldingRules {
  /** Regex marking the start of a foldable region. */
  start?: string;
  /** Regex marking the end of a foldable region. */
  end?: string;
}

/** Indentation rules driven by regular expressions. */
export interface IndentationRules {
  /** Regex after which the next line is indented one level. */
  increaseIndentPattern?: string;
  /** Regex after which the next line is dedented one level. */
  decreaseIndentPattern?: string;
}

/** A VS Code `language-configuration.json` document. */
export interface LanguageConfiguration {
  /** Comment delimiters. */
  comments: CommentRule;
  /** Recognized bracket pairs. */
  brackets: BracketPair[];
  /** Pairs auto-closed while typing. */
  autoClosingPairs: AutoClosingPair[];
  /** Pairs highlighted when the cursor is adjacent. */
  surroundingPairs: BracketPair[];
  /** Folding markers. */
  folding: FoldingRules;
  /** Indentation rules. */
  indentationRules: IndentationRules;
  /** Regex defining a word (for double-click selection). */
  wordPattern: string;
}

/** A single VS Code snippet (serialized into `snippets/syntaxmesh.json`). */
export interface Snippet {
  /** Trigger prefix typed by the user. */
  prefix: string;
  /** Snippet body lines (with `$1`/`${1:placeholder}` tab stops). */
  body: string[];
  /** Human-readable description (English, v1). */
  description: string;
}
