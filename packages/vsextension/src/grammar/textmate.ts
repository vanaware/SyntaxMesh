/**
 * `grammar/textmate.ts` — pure TextMate grammar generator (22.3.1).
 *
 * Projects the shared highlight data of {@link SyntaxCore} (`doc-core`) into a
 * TextMate grammar **as data** (no file IO, no `vscode` runtime). The generate
 * script (22.3.5) serializes the result to `syntaxes/syntaxmesh.tmLanguage.json`.
 *
 * Projection rules:
 * - `categories()` → the three keyword lists: `keywords` (macro/project/
 *   supplement) → `keyword.control`, `builtin` (properties) → `storage.type`,
 *   `types` (attributes) → `keyword.other`.
 * - `tokenRules()` → date/time/duration (`constant.*`), include directive,
 *   strings, comments, numbers and brace/bracket punctuation. The `Arguments`
 *   rule (`\{.*}$`) is **skipped**: it is subsumed by the brace punctuation.
 *
 * ⚠️ ADAPTAÇÃO: the Kate `number` rules carry only `float` + `suffixes` (Kate
 * uses its built-in `HlCFloat`/`HlCInt` regexes, absent from the data API), so
 * the numeric patterns are synthesized here from a conventional base plus the
 * documented suffixes. The `Include` rule is word-boundary anchored
 * (`\binclude\b.*$`) instead of Kate's bare `include.*$`.
 *
 * Repository order follows TextMate practice: comments and strings first (so
 * their content is never re-highlighted), then include, keywords, constants,
 * numbers and punctuation. Output is deterministic (stable sorts, fixed rule
 * order) so the golden snapshots (22.3.6) regenerate byte-for-byte.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §6
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.3.1
 */

import { SyntaxCore, } from "@vanaware/syntaxmesh/doc-core";
import type { TokenRule, } from "@vanaware/syntaxmesh/doc-core";
import type {
  TextMateGrammar,
  TextMatePattern,
  TextMateRepositoryEntry,
} from "./types.ts";
import { alternation, escapeRegExp, } from "./pattern-utils.ts";

/** TextMate scopes assigned to each projected token family. */
const SCOPE = {
  keywordControl: "keyword.control.syntaxmesh",
  storageType: "storage.type.syntaxmesh",
  keywordOther: "keyword.other.syntaxmesh",
  include: "keyword.control.include.syntaxmesh",
  date: "constant.other.date.syntaxmesh",
  time: "constant.other.time.syntaxmesh",
  duration: "constant.numeric.duration.syntaxmesh",
  float: "constant.numeric.float.syntaxmesh",
  integer: "constant.numeric.integer.syntaxmesh",
  stringSingle: "string.quoted.single.syntaxmesh",
  stringDouble: "string.quoted.double.syntaxmesh",
  stringScissors: "string.unquoted.scissors.syntaxmesh",
  escape: "constant.character.escape.syntaxmesh",
  commentLineHash: "comment.line.number-sign.syntaxmesh",
  commentLineSlash: "comment.line.double-slash.syntaxmesh",
  commentBlock: "comment.block.syntaxmesh",
  blockBegin: "punctuation.section.block.begin.syntaxmesh",
  blockEnd: "punctuation.section.block.end.syntaxmesh",
  bracketsBegin: "punctuation.section.brackets.begin.syntaxmesh",
  bracketsEnd: "punctuation.section.brackets.end.syntaxmesh",
} as const;

/** Scope of each single-character punctuation rule (`tokenRules` `char`). */
const CHAR_SCOPE: Record<string, string> = {
  "{": SCOPE.blockBegin,
  "}": SCOPE.blockEnd,
  "[": SCOPE.bracketsBegin,
  "]": SCOPE.bracketsEnd,
};

/** Word-boundary keyword pattern from a name list (longest first). */
function keywordPattern(names: readonly string[],): string {
  return `\\b(?:${alternation(names,)})\\b`;
}

/**
 * Synthesizes a numeric pattern from a Kate `number` rule (⚠️ ADAPTAÇÃO: the
 * data API carries no regex). Integers are `\d+` plus the documented suffixes;
 * floats accept `1.5`, `.5` and `1e5` forms with an optional exponent/suffix.
 */
function numberPattern(
  rule: Extract<TokenRule, { kind: "number" }>,
): string {
  const suffix = rule.suffixes.length > 0
    ? `(?:${alternation(rule.suffixes,)})?`
    : "";
  if (rule.float) {
    return `(?:\\b\\d+\\.\\d+(?:[eE][+-]?\\d+)?|\\B\\.\\d+(?:[eE][+-]?\\d+)?|\\b\\d+[eE][+-]?\\d+)${suffix}\\b`;
  }
  return `\\b\\d+${suffix}\\b`;
}

/** Projects a `string` rule into a begin/end region (escapes for quotes). */
function stringPattern(
  rule: Extract<TokenRule, { kind: "string" }>,
): TextMatePattern {
  const name = rule.open === "'"
    ? SCOPE.stringSingle
    : rule.open === '"'
    ? SCOPE.stringDouble
    : SCOPE.stringScissors;
  const pattern: TextMatePattern = {
    name,
    begin: escapeRegExp(rule.open,),
    end: escapeRegExp(rule.close,),
  };
  // Quoted strings honour backslash escapes; the scissors heredoc is raw.
  if (rule.open === "'" || rule.open === '"') {
    pattern.patterns = [{ name: SCOPE.escape, match: "\\\\.", },];
  }
  return pattern;
}

/** Projects a `comment` rule into a line match or a begin/end block. */
function commentPattern(
  rule: Extract<TokenRule, { kind: "comment" }>,
): TextMatePattern {
  if (rule.close === null) {
    const name = rule.open === "#"
      ? SCOPE.commentLineHash
      : SCOPE.commentLineSlash;
    return { name, match: `${escapeRegExp(rule.open,)}.*$`, };
  }
  return {
    name: SCOPE.commentBlock,
    begin: escapeRegExp(rule.open,),
    end: escapeRegExp(rule.close,),
  };
}

/**
 * Generates the SyntaxMesh TextMate grammar (`source.syntaxmesh`) from the
 * shared highlight data. Pure and deterministic: the same {@link SyntaxCore}
 * always yields the same grammar object.
 *
 * @param core highlight data source; defaults to a fresh {@link SyntaxCore}.
 * @returns the grammar as data, ready to serialize to `*.tmLanguage.json`.
 */
export function generateGrammar(
  core: SyntaxCore = new SyntaxCore(),
): TextMateGrammar {
  const comments: TextMatePattern[] = [];
  const strings: TextMatePattern[] = [];
  const constants: TextMatePattern[] = [];
  const numbers: TextMatePattern[] = [];
  const punctuation: TextMatePattern[] = [];
  const include: TextMatePattern[] = [];

  for (const rule of core.tokenRules()) {
    switch (rule.kind) {
      case "regexp": {
        if (rule.attribute === "Date") {
          constants.push({ name: SCOPE.date, match: rule.pattern, },);
        } else if (rule.attribute === "Time") {
          constants.push({ name: SCOPE.time, match: rule.pattern, },);
        } else if (rule.attribute === "Duration") {
          constants.push({ name: SCOPE.duration, match: rule.pattern, },);
        } else if (rule.attribute === "Include") {
          include.push({ name: SCOPE.include, match: "\\binclude\\b.*$", },);
        }
        // `Arguments` (\{.*}$) is subsumed by the brace punctuation: skipped.
        break;
      }
      case "char": {
        const scope = CHAR_SCOPE[rule.char];
        if (scope !== undefined) {
          punctuation.push({ name: scope, match: escapeRegExp(rule.char,), },);
        }
        break;
      }
      case "string":
        strings.push(stringPattern(rule,),);
        break;
      case "comment":
        comments.push(commentPattern(rule,),);
        break;
      case "number":
        numbers.push({
          name: rule.float ? SCOPE.float : SCOPE.integer,
          match: numberPattern(rule,),
        },);
        break;
      case "keywords":
        // Projected from categories() below (the three keyword lists).
        break;
    }
  }

  const categories = core.categories();
  const keywords: TextMatePattern[] = [];
  if (categories.keywords.length > 0) {
    keywords.push({
      name: SCOPE.keywordControl,
      match: keywordPattern(categories.keywords,),
    },);
  }
  if (categories.builtin.length > 0) {
    keywords.push({
      name: SCOPE.storageType,
      match: keywordPattern(categories.builtin,),
    },);
  }
  if (categories.types.length > 0) {
    keywords.push({
      name: SCOPE.keywordOther,
      match: keywordPattern(categories.types,),
    },);
  }

  const repository: Record<string, TextMateRepositoryEntry> = {
    comments: { patterns: comments, },
    strings: { patterns: strings, },
    include: { patterns: include, },
    keywords: { patterns: keywords, },
    constants: { patterns: constants, },
    numbers: { patterns: numbers, },
    punctuation: { patterns: punctuation, },
  };

  return {
    name: "SyntaxMesh",
    scopeName: "source.syntaxmesh",
    patterns: [
      { include: "#comments", },
      { include: "#strings", },
      { include: "#include", },
      { include: "#keywords", },
      { include: "#constants", },
      { include: "#numbers", },
      { include: "#punctuation", },
    ],
    repository,
  };
}
