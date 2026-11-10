/**
 * ProjectFileScanner — specialisation of the `Scanner` for the TJP syntax.
 *
 * Port of `ProjectFileScanner.rb` (whole file). Registers the ~30 patterns with
 * their modes (:tjp, :dqString, :sqString, :szrString(1), :macroCall,
 * :macroDef, :cppComment) and the token post-processors.
 *
 * SyntaxMesh extension (ADR 023): when `language !== 'en'`, `ID` tokens are
 * normalized to the canonical keyword through `LanguageRegistry.resolve`,
 * KEEPING the "ID" type — the FSM matches literals by the text of the ID token
 * (State#transition tries the literal transition before the :ID fallback).
 *
 * Port note: the Ruby ID patterns are ASCII-only (`[a-zA-Z_]` followed by
 * `\w`); here we use the Unicode class (`\p{L}` and `\p{N}`) to allow accented
 * keywords ('esforço', 'duración').
 *
 * @see docs/taskjuggler/lib/taskjuggler/ProjectFileScanner.rb
 */
import { TjTime, } from "../time/tj-time.ts";
import { globalRegistry, LanguageRegistry, } from "../i18n/mod.ts";
import type { CanonicalUnit, } from "../i18n/types.ts";
import type { LogLike, } from "./stream-handle.ts";
import {
  Scanner,
  type TokenPattern,
  type TokenPostProcessor,
} from "./scanner.ts";

/** Scanner modes of the TJP file reader (Ruby Symbols → ':'-prefixed strings). */
export const TJP_MODES = {
  tjp: ":tjp",
  dqString: ":dqString",
  sqString: ":sqString",
  szrString: ":szrString",
  szrString1: ":szrString1",
  macroCall: ":macroCall",
  macroDef: ":macroDef",
  cppComment: ":cppComment",
} as const;

/** Canonical unit → short literal used by the TJP grammar. */
const UNIT_TO_LITERAL: Record<CanonicalUnit, string> = {
  minute: "min",
  hour: "h",
  day: "d",
  week: "w",
  month: "m",
  quarter: "q",
  year: "y",
};

/**
 * Scanner of TJP project files: registers the full TJP pattern table and turns
 * its matches into typed tokens, including the language normalisation of IDs.
 */
export class ProjectFileScanner extends Scanner {
  /** Language of the file used to normalize keywords (ADR 023). */
  readonly language: string;
  /** Injectable language registry (tests use isolated instances). */
  protected registry: LanguageRegistry;

  /** Accumulator of the multi-line strings (Ruby @string). */
  private string = "";
  /** Indentation of the first line of a szr string (Ruby @indent). */
  private indent = "";
  /** Text of the macro call being assembled (Ruby @macroCall). */
  private macroCall = "";
  /** Mode to restore at the end of the macro call (Ruby @macroCallPreviousMode). */
  private macroCallPreviousMode = ":tjp";
  /** Text of the macro definition being assembled (Ruby @macroDef). */
  private macroDef = "";
  /**
   * true when the `[ ... ]` definition being assembled is a **template**
   * (TS-only extension, phase 23): the `]` may be followed by `( params )` on
   * the same line. Detected in `startMacroDef`/`definitionLine` — in both cases
   * the body is collected by the SAME mechanism used for macros.
   */
  private templateBody = false;
  /** Raw text of the parameter list of the last template definition. */
  private lastTemplateParams: string | null = null;

  /**
   * Environment-variable provider (Ruby `ENV[name]`).
   * Browser: replaced by the UI; default: `Deno.env` when it exists.
   */
  static envProvider: (name: string,) => string | null = (name,) => {
    const g = globalThis as unknown as {
      Deno?: { env?: { get?: (name: string,) => string | undefined } };
    };
    return g.Deno?.env?.get?.(name,) ?? null;
  };

  /**
   * Creates the TJP scanner over the master file.
   *
   * @param masterFile File name (or literal text, for a buffer).
   * @param log Log used for progress and diagnostics.
   * @param language Language of the file, for the keyword normalisation.
   * @param registry Registry used to canonicalize keywords and units.
   */
  constructor(
    masterFile: string,
    log: LogLike,
    language = "en",
    registry: LanguageRegistry = globalRegistry,
  ) {
    // Patterns registered after super(): `this` is unavailable in the arguments.
    super(masterFile, log, [], TJP_MODES.tjp,);
    this.language = language;
    this.registry = registry;
    this.registerPatterns();
    // Re-evaluates activePatterns now that ':tjp' exists.
    this.mode = TJP_MODES.tjp;
  }

  /** Registers every pattern in the exact Ruby order (order is critical). */
  private registerPatterns(): void {
    const post = (fn: TokenPostProcessor,): TokenPostProcessor => fn;
    const patterns: TokenPattern[] = [
      // Any whitespace.
      [null, /\s+/, ":tjp", post(() => this.newPos()),],

      // Single-line comments starting with #.
      [null, /#.*\n?/, ":tjp", post(() => this.newPos()),],

      // C++-style single-line comments starting with //.
      [null, /\/\/.*\n?/, ":tjp", post(() => this.newPos()),],

      // C-style single-line comments /* .. */.
      [null, /\/\*.*\*\//, ":tjp", post(() => this.newPos()),],

      // Multi-line C-style comments: start (switches to :cppComment).
      [null, /\/\*([^*]*[^/]|.*)\n/, ":tjp", post(() => this.startComment()),],
      // End of the multi-line comment (back to :tjp).
      [null, /.*\*\//, ":cppComment", post(() => this.endComment()),],
      // Lines that contain neither the start nor the end of the comment.
      [null, /.*\n/, ":cppComment", null,],

      // Template call with named arguments — phase 23 extension
      // (`${NAME k=v …}`). Must come BEFORE the generic macro pattern: the
      // generic closing only understands positional strings, so `k=v` would be
      // left over as `junk_at_eom`. A call with `ident=` is never a valid macro,
      // so the order does not change the frozen path.
      // Literal lists/objects (`[a, b]`, `{ k: v }`) enter as a value; a `}` of
      // an object does not close the call (§4.2).
      [
        null,
        /\$\{\s*(\??[A-Za-z_]\w*)\s+[A-Za-z_]\w*=(?:[^}\n{]|\{[^}\n]*\}|\[[^\]\n]*\])*\}/,
        ":tjp",
        post((_, match,) => this.namedCall(match,)),
      ],

      // Macro call: the prefix (number/identifier/string part) is preserved and
      // re-injected together with the expanded text.
      [
        null,
        /([-a-zA-Z_0-9>:.+]*|"(\\"|[^"])*?|'(\\'|[^'])*?)?\$\{\s*(\??[a-zA-Z_]\w*)(\s*"(\\"|[^"])*")*/,
        ":tjp",
        post((_, match,) => this.startMacroCall(match,)),
      ],
      // Idem, active inside multi-line double-quoted strings.
      [
        null,
        /(\\"|[^"])*?\$\{\s*(\??[a-zA-Z_]\w*)(\s*"(\\"|[^"])*")*/,
        ":dqString",
        post((_, match,) => this.startMacroCall(match,)),
      ],
      [
        null,
        /(\\'|[^'])*?\$\{\s*(\??[a-zA-Z_]\w*)(\s*"(\\"|[^"])*")*/,
        ":sqString",
        post((_, match,) => this.startMacroCall(match,)),
      ],
      // End of the call: injects prefix + expanded macro; restores the mode.
      [
        null,
        /(\s*"(\\"|[^"])*")*\s*\}/,
        ":macroCall",
        post((_, match,) => this.endMacroCall(match,)),
      ],
      // Arguments on lines with neither the start nor the end of the call.
      [
        null,
        /.*\n/,
        ":macroCall",
        post((_, match,) => this.midMacroCall(match,)),
      ],

      // Environment-variable reference: cannot cross the line.
      [
        null,
        /([-a-zA-Z_0-9>:.+]*|"(\\"|[^"])*?|'(\\'|[^'])*?)?\$\([A-Z_][A-Z_0-9]*\)/,
        ":tjp",
        post((_, match,) => this.environmentVariable(match,)),
      ],

      // ID with a trailing colon: foo:
      [
        "ID_WITH_COLON",
        /[A-Za-z_\p{L}][\p{L}\p{N}_]*:/u,
        ":tjp",
        post((type, match,) => this.chop(type, match,)),
      ],

      // Absolute ID: a.b.c
      [
        "ABSOLUTE_ID",
        /[A-Za-z_\p{L}][\p{L}\p{N}_]*(\.[A-Za-z_\p{L}][\p{L}\p{N}_]*)+/u,
        undefined,
        null,
      ],

      // Plain ID: bar (with i18n normalization when the language is not en).
      [
        "ID",
        /[A-Za-z_\p{L}][\p{L}\p{N}_]*/u,
        undefined,
        post((type, match,) => this.i18nId(type, match,)),
      ],

      // A date.
      [
        "DATE",
        /\d{4}-\d{1,2}-\d{1,2}(-\d{1,2}:\d{1,2}(:\d{1,2})?(-[-+]?\d{4})?)?/,
        ":tjp",
        post((type, match,) => this.toDate(type, match,)),
      ],

      // Time of day.
      [
        "TIME",
        /\d{1,2}:\d{2}/,
        ":tjp",
        post((type, match,) => this.toTime(type, match,)),
      ],

      // Floating-point number (e.g. 3.143).
      [
        "FLOAT",
        /\d*\.\d+/,
        ":tjp",
        post((type, match,) => [type, Number.parseFloat(match,),]),
      ],

      // Integer number.
      [
        "INTEGER",
        /\d+/,
        ":tjp",
        post((type, match,) => [type, Number.parseInt(match, 10,),]),
      ],

      // Multi-line double-quoted string: start (switches to :dqString).
      [
        null,
        /"(\\"|[^"])*/,
        ":tjp",
        post((_, match,) => this.startStringDQ(match,)),
      ],
      // Any line with neither the start nor the end.
      [
        null,
        /(\\"|[^"])*\n/,
        ":dqString",
        post((_, match,) => this.midStringDQ(match,)),
      ],
      // End of the string (back to :tjp).
      [
        "STRING",
        /(\\"|[^"])*"/,
        ":dqString",
        post((_, match,) => this.endStringDQ(match,)),
      ],

      // Multi-line single-quoted string.
      [
        null,
        /'(\\'|[^'])*/,
        ":tjp",
        post((_, match,) => this.startStringSQ(match,)),
      ],
      [
        null,
        /(\\'|[^'])*\n/,
        ":sqString",
        post((_, match,) => this.midStringSQ(match,)),
      ],
      [
        "STRING",
        /(\\'|[^'])*'/,
        ":sqString",
        post((_, match,) => this.endStringSQ(match,)),
      ],

      // Scissors string -8<- ... ->8-: the opening mark must be the last item
      // of the line. The indentation of the 1st line applies to all the others.
      [
        null,
        /-8<-.*\n/,
        ":tjp",
        post((_, match,) => this.startStringSZR(match,)),
      ],
      // The end may be on the first line (empty string): both modes.
      [
        "STRING",
        /\s*->8-/,
        ":szrString1",
        post((type, match,) => this.endStringSZR(type, match,)),
      ],
      [
        "STRING",
        /\s*->8-/,
        ":szrString",
        post((type, match,) => this.endStringSZR(type, match,)),
      ],
      // Macros inside scissors strings.
      [
        null,
        /.*?\$\{\s*(\??[a-zA-Z_]\w*)(\s*"(\\"|[^"])*")*/,
        [":szrString", ":szrString1",],
        post((_, match,) => this.startMacroCall(match,)),
      ],
      // Any line with neither the start nor the end.
      [
        null,
        /.*\n/,
        ":szrString1",
        post((_, match,) => this.firstStringSZR(match,)),
      ],
      [
        null,
        /.*\n/,
        ":szrString",
        post((_, match,) => this.midStringSZR(match,)),
      ],

      // Single-line template definition with parameters
      // (`template T [ body ] (a, b)` — TS-only extension, ADR 033). Must come
      // BEFORE the macro patterns: if the line is not a template definition, the
      // post-processor reproduces the Ruby path exactly.
      [
        null,
        /\[.*\][ \t]*\([^)\n]*\)[ \t]*\n/,
        ":tjp",
        post((_, match,) => this.definitionLine(match,)),
      ],

      // Single-line macro definition.
      [
        "MACRO",
        /\[.*\]\n/,
        ":tjp",
        post((type, match,) => this.definitionEndSingle(type, match,)),
      ],

      // Multi-line macro definition: start (switches to :macroDef).
      [
        null,
        /\[.*\n/,
        ":tjp",
        post((_, match,) => this.startMacroDef(match,)),
      ],
      // Template close with parameters: `] ( a, b )` at the end of the line
      // (TS-only extension). In a macro body the post-processor keeps the Ruby
      // behaviour (`]` only closes at the end of the line).
      [
        null,
        /.*\][ \t]*\([^)\n]*\)[ \t]*\n/,
        ":macroDef",
        post((type, match,) => this.definitionClose(type, match,)),
      ],
      // End: ']' immediately followed by a line break (back to :tjp).
      [
        "MACRO",
        /.*\]\n/,
        ":macroDef",
        post((type, match,) => this.definitionEnd(type, match,)),
      ],
      // Any line with neither the start nor the end.
      [
        null,
        /.*\n/,
        ":macroDef",
        post((_, match,) => this.midMacroDef(match,)),
      ],

      // Multi-character literals.
      ["LITERAL", /<=?/, undefined, null,],
      ["LITERAL", />=?/, undefined, null,],
      ["LITERAL", /!=?/, undefined, null,],

      // Everything else is returned as a single-character literal.
      ["LITERAL", /./, undefined, null,],
    ];

    for (const [type, regExp, mode, postProc,] of patterns) {
      this.addPattern(type, regExp, mode ?? ":tjp", postProc,);
    }
  }

  // ---------------------------------------------------------------------------
  // Post-processors (private order of Ruby)
  // ---------------------------------------------------------------------------

  /** Marks the start of a token after skipping text; returns an empty token. */
  private newPos(): [null, "",] {
    this.startOfToken = this.sourceFileInfo();
    return [null, "",];
  }

  /** Drops the trailing colon of an `ID_WITH_COLON` token. */
  private chop(type: string | null, match: string,): [string | null, string,] {
    // Removes the last character.
    return [type, match.slice(0, -1,),];
  }

  /** Removes the first and the last character. */
  private chop2(type: string | null, match: string,): [string | null, string,] {
    return [type, match.slice(1, -1,),];
  }

  /** Removes the first character, the last character and the trailing \n. */
  private chop2nl(
    type: string | null,
    match: string,
  ): [string | null, string,] {
    if (match.endsWith("\n",)) {
      // Ruby match[1..-3]: drops '[', ']' and '\n'.
      return [type, match.slice(1, -2,),];
    }
    return [type, match.slice(1, -1,),];
  }

  /** Enters a C-style multi-line comment. */
  private startComment(): [null, "",] {
    this.mode = TJP_MODES.cppComment;
    return [null, "",];
  }

  /** Leaves a C-style multi-line comment. */
  private endComment(): [null, "",] {
    this.mode = TJP_MODES.tjp;
    return [null, "",];
  }

  /** Starts a double-quoted string; collects its first chunk. */
  private startStringDQ(match: string,): [null, "",] {
    this.mode = TJP_MODES.dqString;
    // Drops the opening " and the escape backslashes of escaped ".
    this.string = match.slice(1,).replaceAll('\\"', '"',);
    return [null, "",];
  }

  /** Appends a middle chunk of a double-quoted string. */
  private midStringDQ(match: string,): [null, "",] {
    this.string += match.replaceAll('\\"', '"',);
    return [null, "",];
  }

  /** Closes a double-quoted string and emits the `STRING` token. */
  private endStringDQ(match: string,): ["STRING", string,] {
    this.mode = TJP_MODES.tjp;
    this.string += match.slice(0, -1,).replaceAll('\\"', '"',);
    return ["STRING", this.string,];
  }

  /** Starts a single-quoted string; collects its first chunk. */
  private startStringSQ(match: string,): [null, "",] {
    this.mode = TJP_MODES.sqString;
    this.string = match.slice(1,).replaceAll("\\'", "'",);
    return [null, "",];
  }

  /** Appends a middle chunk of a single-quoted string. */
  private midStringSQ(match: string,): [null, "",] {
    this.string += match.replaceAll("\\'", "'",);
    return [null, "",];
  }

  /** Closes a single-quoted string and emits the `STRING` token. */
  private endStringSQ(match: string,): ["STRING", string,] {
    this.mode = TJP_MODES.tjp;
    this.string += match.slice(0, -1,).replaceAll("\\'", "'",);
    return ["STRING", this.string,];
  }

  /** Starts a scissors string (`-8<-`) and validates the opening mark. */
  private startStringSZR(match: string,): [null, "",] {
    // There must be a line break after the mark; spaces between the mark and the
    // line break are allowed.
    if (
      match.length !== 5 &&
      !/-8<-\s*\n$/.test(match,)
    ) {
      this.lineDelta = 1;
      this.error(
        "junk_after_cut",
        "The cut mark -8<- must be immediately followed by a line break.",
      );
    }
    this.mode = TJP_MODES.szrString1;
    this.startOfToken = this.sourceFileInfo();
    this.string = "";
    return [null, "",];
  }

  /** Records the indentation of the first scissors-string line. */
  private firstStringSZR(match: string,): [null, "",] {
    this.mode = TJP_MODES.szrString;
    // Separates the leading indentation from the rest of the string.
    const m = /(\s*)(.*\n)/.exec(match,);
    this.indent = m ? m[1]! : "";
    this.string = m ? m[2]! : "";
    return [null, "",];
  }

  /** Appends a scissors-string line, dropping the common indentation. */
  private midStringSZR(match: string,): [null, "",] {
    // Skips, from the start of the match, the characters equal to @indent.
    let i = 0;
    while (i < this.indent.length && this.indent[i] === match[i]) i++;
    this.string += match.slice(i,);
    return [null, "",];
  }

  /** Closes a scissors string and emits the accumulated `STRING` token. */
  private endStringSZR(
    type: string | null,
    _match: string,
  ): [string | null, string,] {
    this.mode = TJP_MODES.tjp;
    return [type, this.string,];
  }

  /** `$(VAR)` reference: injects the value of the environment variable. */
  private environmentVariable(match: string,): [null, "",] {
    // Characters before $( become a prefix and are re-injected.
    let prefix = "";
    let envRef = match;
    const start = match.indexOf("$(",);
    if (start > 0) {
      prefix = match.slice(0, start,);
      envRef = match.slice(start,);
    }
    // Drops '$(' and ')'.
    const varName = envRef.slice(2, -1,);

    const value = ProjectFileScanner.envProvider(varName,);
    if (value) {
      this.cf?.injectText(prefix + value, envRef.length,);
    } else {
      this.error(
        "unknown_env_var",
        `Unknown environment variable '${varName}'`,
      );
    }
    return [null, "",];
  }

  /** Starts a multi-line macro definition (switches to :macroDef). */
  private startMacroDef(match: string,): [null, string,] {
    this.mode = TJP_MODES.macroDef;
    // Drops the opening '['.
    this.macroDef = match.slice(1,);
    // Phase 23 extension: a `[ ]` body preceded by `template NAME` is a
    // template, not a macro. The rest of the mechanism (per-line accumulation
    // and re-entry) is the same as the macro one.
    this.templateBody = this.isTemplateDefinition();
    return [null, "",];
  }

  /** Appends a middle line of a multi-line macro definition. */
  private midMacroDef(match: string,): [null, "",] {
    this.macroDef += match;
    return [null, "",];
  }

  /** Closes a multi-line macro definition and emits the `MACRO` token. */
  private endMacroDef(
    type: string | null,
    match: string,
  ): [string | null, string,] {
    this.mode = TJP_MODES.tjp;
    // Drops "](\n|$)".
    if (match.endsWith("\n",)) {
      this.macroDef += match.slice(0, -2,);
    } else {
      this.macroDef += match.slice(0, -1,);
    }
    return [type, this.macroDef,];
  }

  // ---------------------------------------------------------------------------
  // Definition of `template` (TS-only extension, phase 23; ADR 033)
  // ---------------------------------------------------------------------------

  /**
   * true when the current `[` opens the body of a **template**: the text of the
   * line immediately before the bracket is `<template-keyword> <name>`.
   *
   * The reading uses `preMatch()` (text already consumed from the line) instead
   * of a token history: the keyword may be translated (`modelo`, `plantilla`),
   * and it is the `LanguageRegistry` that brings it back to `template`.
   */
  private isTemplateDefinition(): boolean {
    const scanner = this.cf?.scanner;
    if (!scanner) return false;
    const pre = (scanner.preMatch() ?? "").replace(/[ \t]+$/, "",);
    const m = /(?:^|[ \t])([^ \t]+)[ \t]+([^ \t]+)$/u.exec(pre,);
    if (!m) return false;
    const keyword = m[1]!;
    return this.registry.resolve(keyword, this.language,) === "template";
  }

  /**
   * Parameters declared in the last template definition.
   *
   * The `TEMPLATE` token carries only the body (like `MACRO`); the parameter
   * list comes out through here, consumed by the `template` action of the FSM.
   * Returns `[]` when the list was omitted.
   *
   * @returns The declared parameter names, in declaration order.
   */
  takeTemplateParams(): string[] {
    const raw = this.lastTemplateParams;
    this.lastTemplateParams = null;
    if (raw === null) return [];
    return raw
      .split(",",)
      .map((param,) => param.trim())
      .filter((param,) => param.length > 0);
  }

  /**
   * Single-line definition: `template NAME [ body ] ( params )`.
   *
   * When the line is not a template one, delegates to the frozen Ruby path
   * (`startMacroDef`), which leaves the line as a macro body being assembled.
   */
  private definitionLine(match: string,): [string | null, string,] {
    if (!this.isTemplateDefinition()) return this.startMacroDef(match,);
    const tail = /^(.*)\][ \t]*\(([^)\n]*)\)[ \t]*\n$/s.exec(match,);
    if (!tail) return this.startMacroDef(match,);
    this.lastTemplateParams = tail[2]!;
    return ["TEMPLATE", tail[1]!.slice(1,),];
  }

  /**
   * Single-line definition **without** parameters (`[ body ]\n`): it only
   * becomes `TEMPLATE` when the `[` was opened by a template; otherwise it keeps
   * the Ruby `chop2nl`.
   */
  private definitionEndSingle(
    type: string | null,
    match: string,
  ): [string | null, string,] {
    // `templateBody` is only filled by the multi-line path; on this line the
    // `[` is the match itself, so the detection comes from the text before it.
    if (!this.templateBody && !this.isTemplateDefinition()) {
      return this.chop2nl(type, match,);
    }
    this.templateBody = false;
    this.lastTemplateParams = null;
    // Same removal as `chop2nl`: '[' and ']\n'.
    return ["TEMPLATE", match.slice(1, -2,),];
  }

  /**
   * Close of a multi-line body with `] ( params )` at the end of the line.
   *
   * In a macro body the `]` is not at the end of the line, so Ruby accumulates
   * the whole line (`midMacroDef`); the delegation preserves that byte by byte.
   */
  private definitionClose(
    type: string | null,
    match: string,
  ): [string | null, string,] {
    if (!this.templateBody) return this.midMacroDef(match,);
    const tail = /^(.*)\][ \t]*\(([^)\n]*)\)[ \t]*\n$/s.exec(match,);
    if (!tail) return this.definitionEnd(type, match,);
    this.macroDef += tail[1]!;
    this.lastTemplateParams = tail[2]!;
    this.templateBody = false;
    this.mode = TJP_MODES.tjp;
    return ["TEMPLATE", this.macroDef,];
  }

  /**
   * Close `]\n` (without parameters). Keeps the Ruby `endMacroDef` when it is
   * not a template; when it is, only the token type changes.
   */
  private definitionEnd(
    type: string | null,
    match: string,
  ): [string | null, string,] {
    if (!this.templateBody) return this.endMacroDef(type, match,);
    this.templateBody = false;
    this.lastTemplateParams = null;
    return this.endMacroDef("TEMPLATE", match,);
  }

  /**
   * Starts a macro call: remembers the mode to restore and switches to
   * `:macroCall`.
   */
  private startMacroCall(match: string,): [null, "",] {
    this.macroCallPreviousMode = this.scannerMode;
    this.mode = TJP_MODES.macroCall;
    this.macroCall = match;
    return [null, "",];
  }

  /**
   * Named-argument call `${NAME k=v …}`: decides **before** the Ruby string
   * split.
   *
   * A call with `name=value` is a **template form** — no macro accepts it —, so
   * an unknown name can be reported as "not defined" (§5) without touching the
   * macro path. If the name exists as a macro, the frozen Ruby path runs the
   * same way (and reports `junk_at_eom`, as it always did).
   */
  private namedCall(match: string,): [null, "",] {
    const inner = match.slice(2, -1,).replace(/^\s+/, "",);
    const nameMatch = /^(\??[A-Za-z_]\w*)/.exec(inner,);
    const name = nameMatch ? nameMatch[1]! : "";
    const rest = inner.slice(name.length,);
    const target = this.templateCallTarget(name,);
    if (target.template) {
      this.expandTemplateCall("", name, rest, match.length,);
    } else if (
      target.optional && !this.macroTable.includes(name.slice(1,),)
    ) {
      // `${?NAME k=v}` with a missing name: silent no-op (§4.5.4), the same
      // semantics as the optional macro of Ruby.
    } else if (
      this.macroTable.includes(name.slice(target.optional ? 1 : 0,),)
    ) {
      const { name: macroName, args, } = this.splitMacroArgs(name + rest,);
      this.expandMacro("", [macroName, ...args,], match.length,);
    } else {
      const clean = target.optional ? name.slice(1,) : name;
      this.error(
        "template_not_defined",
        `'${clean}' não definido`,
        this.sourceFileInfo(),
      );
    }
    return [null, "",];
  }

  /** Appends a middle line of a macro call. */
  private midMacroCall(match: string,): [null, "",] {
    this.macroCall += match;
    return [null, "",];
  }

  /**
   * Closes a macro call: re-injects the prefix plus the expansion and restores
   * the previous mode. Template calls are routed before the Ruby split.
   */
  private endMacroCall(match: string,): [null, "",] {
    this.mode = this.macroCallPreviousMode;
    this.macroCall += match;

    // Characters before ${ become a prefix and are re-injected.
    let prefix = "";
    const macroStart = this.macroCall.indexOf("${",);
    if (macroStart > 0) {
      prefix = this.macroCall.slice(0, macroStart,);
      this.macroCall = this.macroCall.slice(macroStart,);
    }

    const macroCallLength = this.macroCall.length;
    // Drops '${' and '}' and the surrounding spaces.
    const argsStr = this.macroCall
      .slice(2, -1,)
      .replace(/^[ \t\n]*(.*?)[ \t\n]*$/ms, "$1",);

    // Phase 23 extension: the template receives the **raw** (named) arguments,
    // so the lookup has to happen before the Ruby string split. The macro path
    // below stays exactly the phase 10 one.
    const callSpace = argsStr.indexOf(" ",);
    const callName = callSpace < 0 ? argsStr : argsStr.slice(0, callSpace,);
    if (this.templateCallTarget(callName,).template) {
      this.expandTemplateCall(
        prefix,
        callName,
        argsStr.slice(callName.length,),
        macroCallLength,
      );
      return [null, "",];
    }

    const { name: macroName, args, } = this.splitMacroArgs(argsStr,);
    this.expandMacro(prefix, [macroName, ...args,], macroCallLength,);

    return [null, "",];
  }

  // ---------------------------------------------------------------------------
  // Numeric and temporal conversions
  // ---------------------------------------------------------------------------

  /**
   * Turns a `DATE` token into a `TjTime`.
   *
   * @param type Token type assigned by the pattern.
   * @param match Text matched by the pattern.
   * @returns The type and the parsed date, or an ignored token on failure.
   */
  private toDate(
    type: string | null,
    match: string,
  ): [string | null, unknown,] {
    try {
      return [type, TjTime.fromString(match,),];
    } catch (msg) {
      this.error("time_error", (msg as Error).message,);
      // Ruby: the method summary returns nil → token swallowed (ignored).
      return [null, "",];
    }
  }

  /**
   * Turns a `TIME` token into seconds since midnight, validating the ranges.
   *
   * @param type Token type assigned by the pattern.
   * @param match Text matched by the pattern (`hh:mm`).
   * @returns The type and the time in seconds.
   */
  private toTime(
    type: string | null,
    match: string,
  ): [string | null, number,] {
    const [hStr, mStr,] = match.split(":",);
    let h = Number.parseInt(hStr!, 10,);
    if (h < 0 || h > 24) {
      this.error("time_bad_hour", `Hour ${h} out of range (0 - 24)`,);
      h = 0;
    }
    let m = Number.parseInt(mStr!, 10,);
    if (m < 0 || m > 59) {
      this.error("time_bad_minute", `Minute ${m} out of range (0 - 59)`,);
      m = 0;
    }
    if (h === 24 && m !== 0) {
      this.error("time_bad_time", `Time ${match} cannot be larger then 24:00`,);
    }

    return [type, (h * 60 + m) * 60,];
  }

  // ---------------------------------------------------------------------------
  // i18n (SyntaxMesh extension — ADR 023)
  // ---------------------------------------------------------------------------

  /**
   * Normalizes `ID` tokens: when the text is a synonym of the active language,
   * returns the canonical keyword while KEEPING the "ID" type (the FSM matches
   * literals by the text of ID tokens — see State#transition).
   *
   * @param type Token type assigned by the pattern.
   * @param match Text matched by the pattern.
   * @returns The (possibly normalized) type and text.
   */
  private i18nId(
    type: string | null,
    match: string,
  ): [string | null, string,] {
    if (this.language !== "en" && type === "ID") {
      const canonical = this.registry.resolve(match, this.language,);
      if (canonical !== null) {
        return ["ID", canonical,];
      }
      // Local duration units ('dias' → 'd', 'años' → 'y') — the grammar matches
      // the short English literals (rule_durationUnit). Only the language's own
      // synonyms are translated: 'days' in `loadunit days` (pt-BR file) is a
      // valid English literal of the FSM and must not become 'd'.
      if (this.registry.hasUnitInLanguage(match, this.language,)) {
        const unit = this.registry.resolveUnit(match, this.language,);
        if (unit !== null) {
          const literal = UNIT_TO_LITERAL[unit];
          if (literal) {
            return ["ID", literal,];
          }
        }
      }
    }
    return [type, match,];
  }
}
