/**
 * `web/bundle-purity.ts` — generated browser-bundle purity scanner (22.12.21).
 *
 * Source scans cannot see dependencies pulled in by the bundler. This scanner
 * tokenizes the generated JavaScript so executable runtime globals are rejected
 * while comments, ordinary strings, template text and source-map payloads do not
 * create false positives. Optional host capabilities remain valid when accessed
 * through a bound object such as `globalThis.Deno` or an injected alias.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §9.2
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.12.21
 */

/** One runtime-specific construct found in a generated browser bundle. */
export interface BundleViolation {
  /** Bundle path reported by the quality gate. */
  file: string;
  /** 1-based line number of the offending construct. */
  line: number;
  /** Trimmed source line containing the construct. */
  snippet: string;
  /** Why the construct is unsafe in the browser artifact. */
  reason: string;
}

type TokenKind = "identifier" | "string" | "punctuator" | "other";

interface Token {
  kind: TokenKind;
  value: string;
  start: number;
}

const UNSAFE_PROCESS_PROPERTIES = new Set([
  "env",
  "argv",
  "exit",
  "cwd",
  "platform",
],);

const OPERATORS = [
  ">>>",
  "===",
  "!==",
  "=>",
  "?.",
  "&&",
  "||",
  "??",
  "==",
  "!=",
  "<=",
  ">=",
  "++",
  "--",
  "**",
  "<<",
  ">>",
  "...",
] as const;

/** Small JavaScript lexer that retains executable tokens and source offsets. */
class BundleTokenizer {
  private readonly tokens: Token[] = [];

  constructor(private readonly text: string,) {}

  /** Tokenizes code and template interpolations, skipping non-executable text. */
  tokenize(): Token[] {
    this.readCode(0, false,);
    return this.tokens;
  }

  /** Reads code until EOF or the unmatched brace closing an interpolation. */
  private readCode(start: number, interpolation: boolean,): number {
    let index = start;
    let braceDepth = 0;
    while (index < this.text.length) {
      const char = this.text[index]!;
      if (/\s/.test(char,)) {
        index++;
        continue;
      }
      if (char === "/" && this.text[index + 1] === "/") {
        index = this.skipLineComment(index,);
        continue;
      }
      if (char === "/" && this.text[index + 1] === "*") {
        index = this.skipBlockComment(index,);
        continue;
      }
      if (char === "'" || char === '"') {
        index = this.readString(index,);
        continue;
      }
      if (char === "`") {
        index = this.readTemplate(index,);
        continue;
      }
      if (interpolation && char === "}") {
        if (braceDepth === 0) return index + 1;
        braceDepth--;
        this.push("punctuator", char, index,);
        index++;
        continue;
      }
      if (char === "{") {
        if (interpolation) braceDepth++;
        this.push("punctuator", char, index,);
        index++;
        continue;
      }
      if (this.isIdentifierStart(char,)) {
        index = this.readIdentifier(index,);
        continue;
      }
      if (/\d/.test(char,)) {
        index = this.readNumber(index,);
        continue;
      }
      if (char === "/" && this.canStartRegex()) {
        index = this.readRegex(index,);
        continue;
      }
      const operator = OPERATORS.find((candidate,) =>
        this.text.startsWith(candidate, index,)
      );
      if (operator !== undefined) {
        this.push("punctuator", operator, index,);
        index += operator.length;
        continue;
      }
      this.push("punctuator", char, index,);
      index++;
    }
    return index;
  }

  /** Skips a `//` comment, including source-map data URLs. */
  private skipLineComment(start: number,): number {
    const end = this.text.indexOf("\n", start + 2,);
    return end < 0 ? this.text.length : end + 1;
  }

  /** Skips a `/* ... *\/` comment without interpreting its contents. */
  private skipBlockComment(start: number,): number {
    const end = this.text.indexOf("*/", start + 2,);
    return end < 0 ? this.text.length : end + 2;
  }

  /** Reads a quoted string and retains its raw contents for module checks. */
  private readString(start: number,): number {
    const quote = this.text[start];
    let index = start + 1;
    while (index < this.text.length) {
      const char = this.text[index];
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === quote) {
        index++;
        this.push("string", this.text.slice(start + 1, index - 1,), start,);
        return index;
      }
      index++;
    }
    this.push("string", this.text.slice(start + 1,), start,);
    return index;
  }

  /** Reads template text and tokenizes only executable `${...}` expressions. */
  private readTemplate(start: number,): number {
    let index = start + 1;
    while (index < this.text.length) {
      const char = this.text[index];
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === "`") return index + 1;
      if (char === "$" && this.text[index + 1] === "{") {
        index = this.readCode(index + 2, true,);
        continue;
      }
      index++;
    }
    return index;
  }

  /** Reads an identifier token. */
  private readIdentifier(start: number,): number {
    let index = start + 1;
    while (
      index < this.text.length && this.isIdentifierPart(this.text[index]!,)
    ) {
      index++;
    }
    this.push("identifier", this.text.slice(start, index,), start,);
    return index;
  }

  /** Reads a numeric literal as opaque non-code for pattern matching. */
  private readNumber(start: number,): number {
    let index = start + 1;
    while (
      index < this.text.length && /[\w.]/.test(this.text[index]!,)
    ) {
      index++;
    }
    this.push("other", this.text.slice(start, index,), start,);
    return index;
  }

  /** Skips a regular-expression literal so its pattern text is not executable. */
  private readRegex(start: number,): number {
    let index = start + 1;
    let inClass = false;
    while (index < this.text.length) {
      const char = this.text[index];
      if (char === "\\") {
        index += 2;
        continue;
      }
      if (char === "[") inClass = true;
      if (char === "]") inClass = false;
      if (char === "/" && !inClass) {
        index++;
        while (
          index < this.text.length && /[A-Za-z]/.test(this.text[index]!,)
        ) {
          index++;
        }
        this.push("other", this.text.slice(start, index,), start,);
        return index;
      }
      index++;
    }
    this.push("other", this.text.slice(start,), start,);
    return index;
  }

  /** Appends one token at its original source offset. */
  private push(kind: TokenKind, value: string, start: number,): void {
    this.tokens.push({ kind, value, start, },);
  }

  /** Reports whether a character can start an identifier. */
  private isIdentifierStart(char: string,): boolean {
    return /[A-Za-z_$]/.test(char,);
  }

  /** Reports whether a character can continue an identifier. */
  private isIdentifierPart(char: string,): boolean {
    return /[A-Za-z0-9_$]/.test(char,);
  }

  /** Distinguishes regex literals from division using the previous token. */
  private canStartRegex(): boolean {
    const previous = this.tokens[this.tokens.length - 1];
    if (previous === undefined) return true;
    if (previous.kind === "identifier") {
      return [
        "return",
        "throw",
        "case",
        "delete",
        "void",
        "typeof",
        "instanceof",
        "in",
        "of",
        "yield",
        "await",
      ].includes(previous.value,);
    }
    if (previous.kind !== "punctuator") return false;
    return [
      "(",
      "[",
      "{",
      "=",
      ":",
      ";",
      ",",
      "!",
      "?",
      "&&",
      "||",
      "??",
      "=>",
      "+",
      "-",
      "*",
      "%",
    ].includes(previous.value,);
  }
}

/** Returns one token as a string, or `undefined` when it is not a string. */
function stringValue(token: Token | undefined,): string | undefined {
  return token?.kind === "string" ? token.value : undefined;
}

/** Tests an identifier token by value. */
function isIdentifier(token: Token | undefined, value: string,): boolean {
  return token?.kind === "identifier" && token.value === value;
}

/** Tests a punctuation token by value. */
function isPunctuation(token: Token | undefined, value: string,): boolean {
  return token?.kind === "punctuator" && token.value === value;
}

/** Reads a direct or bracket-access property name after an object token. */
function propertyName(
  tokens: readonly Token[],
  index: number,
): string | undefined {
  const accessor = tokens[index + 1];
  if (accessor === undefined) return undefined;
  if (isPunctuation(accessor, ".",) || isPunctuation(accessor, "?.",)) {
    const property = tokens[index + 2];
    return property?.kind === "identifier" ? property.value : undefined;
  }
  if (isPunctuation(accessor, "[",)) {
    const property = stringValue(tokens[index + 2],);
    return property !== undefined && isPunctuation(tokens[index + 3], "]",)
      ? property
      : undefined;
  }
  return undefined;
}

/** Recognizes the single guarded minimatch platform probe allowed in bundles. */
function isGuardedPlatformProbe(
  tokens: readonly Token[],
  index: number,
): boolean {
  return isIdentifier(tokens[index - 7], "typeof",) &&
    isIdentifier(tokens[index - 6], "process",) &&
    isPunctuation(tokens[index - 5], "===",) &&
    stringValue(tokens[index - 4],) === "object" &&
    isPunctuation(tokens[index - 3], "&&",) &&
    isIdentifier(tokens[index - 2], "process",) &&
    isPunctuation(tokens[index - 1], "&&",) &&
    isIdentifier(tokens[index], "process",) &&
    isPunctuation(tokens[index + 1], ".",) &&
    isIdentifier(tokens[index + 2], "platform",) &&
    isPunctuation(tokens[index + 3], "===",) &&
    stringValue(tokens[index + 4],) === "win32";
}

/** Finds a `from "node:*"` clause in one import/export statement. */
function nodeFromImport(
  tokens: readonly Token[],
  start: number,
): Token | undefined {
  for (let index = start + 1; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (isPunctuation(token, ";",)) return undefined;
    if (isIdentifier(token, "import",) || isIdentifier(token, "export",)) {
      return undefined;
    }
    if (isIdentifier(token, "from",)) {
      const specifier = tokens[index + 1];
      return stringValue(specifier,)?.startsWith("node:",)
        ? specifier
        : undefined;
    }
  }
  return undefined;
}

/** Finds the string argument of a static or dynamic module load. */
function nodeModuleArgument(
  tokens: readonly Token[],
  start: number,
): Token | undefined {
  const direct = tokens[start + 1];
  if (stringValue(direct,)?.startsWith("node:",)) return direct;
  if (!isPunctuation(direct, "(",)) return undefined;
  const argument = tokens[start + 2];
  return stringValue(argument,)?.startsWith("node:",) ? argument : undefined;
}

/** Builds the 1-based line starts used for diagnostic lookup. */
function lineStarts(text: string,): number[] {
  const starts = [0,];
  for (let index = 0; index < text.length; index++) {
    if (text[index] === "\n") starts.push(index + 1,);
  }
  return starts;
}

/** Finds the 1-based line containing one source offset. */
function lineAt(starts: readonly number[], offset: number,): number {
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2,);
    if (starts[middle]! <= offset) low = middle;
    else high = middle;
  }
  return low + 1;
}

/** Returns the trimmed original line containing one source offset. */
function snippetAt(text: string, offset: number,): string {
  const start = text.lastIndexOf("\n", offset - 1,) + 1;
  const end = text.indexOf("\n", offset,);
  return text.slice(start, end < 0 ? text.length : end,).trim();
}

/**
 * Scans generated browser JavaScript for executable runtime-only constructs.
 *
 * Comments, strings, template text, regex literals and source-map payloads are
 * ignored. Bound optional capabilities such as `globalThis.Deno` are accepted;
 * bare `Deno`/`process` access is rejected, except for minimatch's exact guarded
 * `process.platform === "win32"` capability probe.
 *
 * @param file bundle path used in diagnostics
 * @param text generated JavaScript source
 * @returns violations in source order
 */
export function scanBrowserBundle(
  file: string,
  text: string,
): BundleViolation[] {
  const tokens = new BundleTokenizer(text,).tokenize();
  const starts = lineStarts(text,);
  const found: Array<{ offset: number; reason: string }> = [];
  const add = (token: Token, reason: string,): void => {
    found.push({ offset: token.start, reason, },);
  };

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    if (isIdentifier(token, "Deno",)) {
      const previous = tokens[index - 1];
      const bound = isPunctuation(previous, ".",) ||
        isPunctuation(previous, "?.",);
      const member = isPunctuation(tokens[index + 1], ".",) ||
        isPunctuation(tokens[index + 1], "?.",);
      if (!bound && member) {
        add(token, "unbound Deno.* is unavailable in a browser bundle",);
      }
      continue;
    }
    if (isIdentifier(token, "process",)) {
      const property = propertyName(tokens, index,);
      if (
        property !== undefined && UNSAFE_PROCESS_PROPERTIES.has(property,) &&
        !(property === "platform" && isGuardedPlatformProbe(tokens, index,))
      ) {
        add(token, `process.${property} is unavailable in a browser bundle`,);
      }
      continue;
    }
    if (isIdentifier(token, "import",) || isIdentifier(token, "export",)) {
      const specifier = nodeModuleArgument(tokens, index,) ??
        nodeFromImport(tokens, index,);
      if (specifier !== undefined) {
        add(specifier, "node:* import is unavailable in a browser bundle",);
      }
      continue;
    }
    if (isIdentifier(token, "require",)) {
      const direct = nodeModuleArgument(tokens, index,);
      const resolved = isPunctuation(tokens[index + 1], ".",) &&
          isIdentifier(tokens[index + 2], "resolve",)
        ? nodeModuleArgument(tokens, index + 2,)
        : undefined;
      const specifier = direct ?? resolved;
      if (specifier !== undefined) {
        add(specifier, "node:* require is unavailable in a browser bundle",);
      }
    }
  }

  found.sort((left, right,) => left.offset - right.offset);
  return found.map(({ offset, reason, },) => ({
    file,
    line: lineAt(starts, offset,),
    snippet: snippetAt(text, offset,),
    reason,
  }));
}
