/**
 * Scanner — modal text scanner with support for nested includes and macros.
 *
 * Port of `TextParser/Scanner.rb` (l.206-565). The token patterns are supplied
 * by the subclass (e.g. `ProjectFileScanner`) and the scanner is modal: each
 * mode uses only the subset of patterns assigned to it, so switching mode
 * switches the whole lexing grammar at once.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/Scanner.rb
 */
import { type MessageType, } from "../message.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { TjError, } from "../model/errors.ts";
import { SourceFileInfo, } from "../source-file-info.ts";
import { Macro, MacroTable, Template, } from "./macro-table.ts";
import type { AddTemplateResult, } from "./macro-table.ts";
import { templateEngine, } from "./template-engine.ts";
import {
  type ExpressionEvaluation,
  parseTemplateArguments,
  type TemplateArgumentValue,
} from "./template-arguments.ts";
import {
  BufferStreamHandle,
  FileStreamHandle,
  type FileTextLoader,
  type LogLike,
  type ScannerHostLike,
  type StreamHandle,
} from "./stream-handle.ts";

/** Token post-processing: may rewrite `[type, text]` after the match. */
export type TokenPostProcessor = (
  type: string | null,
  text: string,
) => [string | null, unknown,];

/**
 * Token pattern:
 * `[type (null = ignore), regex, mode(s), post-processing]`.
 */
export type TokenPattern = [
  string | null,
  RegExp,
  string | string[] | undefined,
  TokenPostProcessor | null,
];

/** Token produced by the scanner: `[type, text, origin]`. */
export type ScannerToken = [string, unknown, SourceFileInfo | null,];

/** File-stack entry: handle, buffered token and EOF callback. */
export type FileStackEntry = [
  StreamHandle,
  ScannerToken | null,
  (() => void) | null,
];

/**
 * Pass limit of phase 1 (macros inside a template body). Aligned with the
 * 20-level `macroStack` limit of Ruby.
 */
const BODY_EXPANSION_PASSES = 20;

/**
 * Maximum depth of templates being evaluated. It is the **same** 20 of the
 * `macroStack` (Ruby l.211): templates and macros pile up on the same injection
 * mechanism, so the ceiling is single and the backstop is the same
 * `macro_stack_overflow` error. Direct/mutual recursion is caught earlier by
 * `template_recursion`.
 */
const TEMPLATE_DEPTH_LIMIT = 20;

/** Positional arguments of a macro call (Ruby `endMacroCall`). */
export interface PositionalMacroArgs {
  /** Name of the macro being called. */
  name: string;
  /** Arguments quoted with `"` and already unescaped. */
  args: string[];
}

/** Empty frozen view used while there is no project yet (§4.7). */
const EMPTY_PROJECT_VIEW: Readonly<Record<string, unknown>> = Object.freeze(
  {},
);

/**
 * Converts any JS value (coming from `expandTemplate(name, args)`) into a
 * `TemplateArgumentValue`, preserving numbers, booleans, lists and objects.
 * Whatever does not fit becomes text — never `undefined`/`null` in the context.
 *
 * @param value External value to normalize.
 * @returns The value as a template argument.
 */
export function toArgumentValue(value: unknown,): TemplateArgumentValue {
  if (
    typeof value === "string" || typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value,)) {
    return value.map((item,) => toArgumentValue(item,));
  }
  if (value && typeof value === "object") {
    const out: { [key: string]: TemplateArgumentValue } = {};
    for (const [key, item,] of Object.entries(value,)) {
      out[key] = toArgumentValue(item,);
    }
    return out;
  }
  return String(value ?? "",);
}

/** Normalizes the argument object of `expandTemplate` into a params map. */
function toArgumentMap(args: unknown,): Record<string, TemplateArgumentValue> {
  const out: Record<string, TemplateArgumentValue> = {};
  if (args && typeof args === "object" && !Array.isArray(args,)) {
    for (const [key, value,] of Object.entries(args,)) {
      out[key] = toArgumentValue(value,);
    }
  }
  return out;
}

/**
 * Abstract base of the token scanner: holds the pattern table, the file stack
 * and the macro namespace, and turns text into tokens mode by mode.
 */
export class Scanner implements ScannerHostLike {
  /** Name of the initial file (or text) (Ruby @masterFile). */
  readonly masterFile: string;
  /** Handler that receives every error and warning. */
  protected messageHandler: MessageHandlerInstance;
  /** Log used for progress and diagnostics. */
  protected log: LogLike;
  /** Macro table expandable during lexing (Ruby @macroTable). */
  readonly macroTable: MacroTable = new MacroTable();
  /** Handle of the stream currently being processed (Ruby @cf). */
  cf: StreamHandle | null = null;
  /** Stack of the nested files (Ruby @fileStack). */
  fileStack: FileStackEntry[] = [];
  /** true once the last file reached its end (Ruby @finishLastFile). */
  finishLastFile = false;
  /** true when the scanner works on a text buffer instead of a file. */
  fileNameIsBuffer = false;
  /** `SourceFileInfo` of the start of the token being processed. */
  startOfToken: SourceFileInfo | null = null;
  /** Line-number correction applied to error messages. */
  lineDelta = 0;
  /** Patterns grouped by mode (Ruby @patternsByMode). */
  readonly patternsByMode: Map<string, TokenPattern[]> = new Map();
  /** Mode currently active (Ruby @scannerMode). */
  scannerMode: string = "";
  /** Start/end mode of the file (Ruby @defaultMode). */
  readonly defaultMode: string;
  /** Pattern set of the active mode (a pointer, not a copy). */
  activePatterns: TokenPattern[] | null = null;
  /** Path of the master file with a trailing slash (Ruby @masterPath). */
  masterPath = "";
  /** Token pushed back and pending (Ruby @tokenBuffer). */
  tokenBuffer: ScannerToken | null = null;
  /**
   * Logical-expression engine injected by phase 11 to evaluate template
   * arguments (sub-phase 23.4.6). `null` keeps the expression as text.
   */
  private expressionEvaluator:
    | ((text: string,) => ExpressionEvaluation)
    | null = null;
  /** Read-only view of the project metadata (`project` of §4.7). */
  private projectContextProvider:
    | (() => Readonly<Record<string, unknown>> | null)
    | null = null;
  /** Resolver of IDs (`ids()` of §4.7). */
  private templateIdResolver: ((id: string,) => string) | null = null;
  /**
   * File-content reader injected per instance (phase 24 — ADR 034).
   *
   * When set, every `FileStreamHandle` created by this scanner (master and
   * `include`s) reads the text through it — never through the filesystem.
   * `null` keeps the legacy behaviour (`loadFileText`).
   */
  private fileLoader: FileTextLoader | null = null;
  /** Optional name of the current buffer (`parseContent(content, name)`). */
  private bufferName: string | null = null;
  /** Templates being evaluated **inline** (`expandTemplate`), base → top. */
  private readonly inlineTemplateStack: string[] = [];

  /**
   * Creates a scanner over the master file and its token patterns.
   *
   * @param masterFile File name (or literal text, for a buffer).
   * @param log Log used for progress and diagnostics.
   * @param tokenPatterns Patterns of every mode, registered up front.
   * @param defaultMode Mode active at the start and at the end of the file.
   */
  constructor(
    masterFile: string,
    log: LogLike,
    tokenPatterns: TokenPattern[],
    defaultMode: string,
  ) {
    this.masterFile = masterFile;
    this.messageHandler = MessageHandlerInstance.instance;
    this.log = log;
    this.defaultMode = defaultMode;

    for (const pat of tokenPatterns) {
      const type = pat[0];
      const regExp = pat[1];
      const mode = pat[2] ?? ":tjp";
      const postProc = pat[3];
      this.addPattern(type, regExp, mode, postProc,);
    }
    // Lets subclasses register patterns after super(): if the mode does not
    // exist yet, only the name is kept; the subclass reassigns `mode` later.
    this.activePatterns = this.patternsByMode.get(defaultMode,) ?? null;
    this.scannerMode = defaultMode;
  }

  /**
   * Adds a pattern to the scanner. _type_ is null for ignored tokens;
   * _mode_ accepts one mode or a list of modes. _postProc_ may rewrite
   * `[type, text]` after the match (Ruby addPattern, l.261-273).
   *
   * @param type Token type, or `null` to match and discard.
   * @param regExp Pattern that recognizes the token.
   * @param mode Mode or modes in which the pattern is active.
   * @param postProc Optional hook applied right after a match.
   */
  addPattern(
    type: string | null,
    regExp: RegExp,
    mode: string | string[],
    postProc: TokenPostProcessor | null = null,
  ): void {
    const modes = Array.isArray(mode,) ? mode : [mode,];
    for (const m of modes) {
      if (!this.patternsByMode.has(m,)) {
        this.patternsByMode.set(m, [],);
      }
      this.patternsByMode.get(m,)!.push([type, regExp, m, postProc,],);
    }
  }

  /** Switches the scanner mode; only the patterns of the new mode stay active. */
  set mode(newMode: string,) {
    const active = this.patternsByMode.get(newMode,);
    if (!active) {
      throw new Error(`Undefined mode ${newMode}`,);
    }
    this.activePatterns = active;
    this.scannerMode = newMode;
  }

  get mode(): string {
    return this.scannerMode;
  }

  /** Sets (or clears) the injected content reader of this scanner. */
  setFileLoader(loader: FileTextLoader | null,): void {
    this.fileLoader = loader;
  }

  /**
   * Starts processing; _fileNameIsBuffer_ works over a `String`.
   *
   * @param fileNameIsBuffer Whether `masterFile` is the text itself.
   * @param bufferText Text to scan when running over a buffer.
   * @param bufferName Optional buffer name used in messages.
   */
  open(
    fileNameIsBuffer = false,
    bufferText?: string,
    bufferName?: string,
  ): void {
    this.fileNameIsBuffer = fileNameIsBuffer;
    // Optional buffer name (phase 24 extension): shows up in `fileName()` and
    // in the messages as `<name>:<line>`. Absent keeps the legacy (unnamed).
    this.bufferName = fileNameIsBuffer ? (bufferName ?? null) : null;
    if (fileNameIsBuffer) {
      this.cf = new BufferStreamHandle(
        bufferText ?? this.masterFile,
        this.log,
        this,
      );
      this.fileStack = [[this.cf, null, null,],];
    } else {
      try {
        this.cf = new FileStreamHandle(
          this.masterFile,
          this.log,
          this,
          this.fileLoader,
        );
        this.fileStack = [[this.cf, null, null,],];
      } catch (e) {
        this.error("open_file", `Cannot open file ${this.masterFile}: ${e}`,);
      }
    }
    this.masterPath = (this.cf ? this.cf.dirname() : "") + "/";
    this.tokenBuffer = null;
  }

  /** Ends processing and resets the structures. */
  close(): void {
    if (!this.fileNameIsBuffer) {
      this.log.startProgressMeter(`Reading file ${this.masterFile}`,);
      this.log.stopProgressMeter();
    }
    this.fileStack = [];
    this.cf = null;
    this.tokenBuffer = null;
  }

  /**
   * Starts processing _includeFileName_ (relative to the calling file); on
   * completion, resumes the parent. Returns the qualified name of the include.
   *
   * @param includeFileName File to include, as written in the source.
   * @param sfi Location of the `include` call, for error messages.
   * @param onEof Optional callback fired when the included file ends.
   * @returns The qualified name of the included file.
   */
  include(
    includeFileName: string,
    sfi: SourceFileInfo | null,
    onEof: (() => void) | null = null,
  ): string {
    if (includeFileName[0] !== "/") {
      const parent = this.fileStack[this.fileStack.length - 1];
      const pathOfCallingFile = parent ? parent[0].dirname() : "";
      const path = pathOfCallingFile === "" ? "" : pathOfCallingFile + "/";
      includeFileName = path + includeFileName;
    }

    // Detection of recursive inclusion (does not catch filesystem links).
    for (const entry of this.fileStack) {
      if (includeFileName === entry[0].fileName) {
        this.error(
          "include_recursion",
          `Recursive inclusion of ${includeFileName} detected`,
          sfi,
        );
        // `tj3` dies here: without `trapSetup` the `MessageHandler#error` does
        // `exit 1` (MessageHandler.rb l.289-298). Accumulating the message and
        // continuing would push the same file forever (OOM). The abort keeps
        // the message already recorded and fails the parse.
        throw new TjError("",);
      }
    }

    // Keeps the buffered token of the parent on the stack.
    if (this.fileStack.length > 0) {
      this.fileStack[this.fileStack.length - 1]![1] = this.tokenBuffer;
    }
    this.tokenBuffer = null;
    this.finishLastFile = false;

    try {
      const handle = new FileStreamHandle(
        includeFileName,
        this.log,
        this,
        this.fileLoader,
      );
      this.cf = handle;
      this.fileStack.push([handle, null, onEof,],);
      this.log.msg(() => `Parsing file ${includeFileName}`);
    } catch (_e) {
      this.error(
        "bad_include",
        `Cannot open include file ${includeFileName}`,
        sfi,
      );
    }

    return includeFileName;
  }

  /** `SourceFileInfo` of the current processing position. */
  sourceFileInfo(): SourceFileInfo {
    return this.cf
      ? new SourceFileInfo(
        this.fileName(),
        this.cf.lineNo() - this.lineDelta,
        0,
      )
      : new SourceFileInfo(this.masterFile, 0, 0,);
  }

  /** Name of the current file (or the text itself, when running on a buffer). */
  fileName(): string {
    return this.cf
      ? this.cf.fileName ?? this.bufferName ?? ""
      : this.masterFile;
  }

  /** Line number of the current position (0 before the first line). */
  lineNo(): number {
    return this.cf ? this.cf.lineNo() : 0;
  }

  /**
   * Column of the current position. Always 0: the scanner reports line-level
   * locations only, exactly like the Ruby port.
   */
  columnNo(): number {
    return 0;
  }

  /** Current line already consumed from the active file. */
  line(): string {
    return this.cf ? this.cf.currentLine() : "";
  }

  /**
   * Next token of the stream (handling the file stack and file EOFs).
   * Ruby nextToken (l.381-422).
   *
   * @returns The next token, or the `eof`/`endOfText` sentinel.
   */
  nextToken(): ScannerToken {
    // Returns a pushed-back token first.
    if (this.tokenBuffer !== null) {
      const res = this.tokenBuffer;
      this.tokenBuffer = null;
      return res;
    }

    if (this.finishLastFile) {
      // The previous file was actually finished: close it and pop the stack.
      this.finishLastFile = false;

      const top = this.fileStack[this.fileStack.length - 1];
      const onEof = top ? top[2] : null;
      if (onEof) onEof();

      if (this.cf) this.cf.close();
      this.fileStack.pop();

      if (this.fileStack.length === 0) {
        // End of the top-level file.
        this.cf = null;
        this.tokenBuffer = null;
        this.finishLastFile = true;
        return ["endOfText", "<EOT>", this.startOfToken,];
      } else {
        // Resumes the file that included the current one.
        const entry = this.fileStack[this.fileStack.length - 1]!;
        this.cf = entry[0];
        const tokenBuffer = entry[1];
        this.log.msg(() => `Parsing file ${this.cf?.fileName ?? ""} ...`);
        if (tokenBuffer) {
          if (tokenBuffer[0] === "eof") this.finishLastFile = true;
          return tokenBuffer;
        }
      }
    }

    return this.scanToken();
  }

  /** Pushes a token back to be read again; only 1 at a time (Ruby l.426-433). */
  returnToken(token: ScannerToken,): void {
    if (this.tokenBuffer !== null) {
      console.error(this.tokenBuffer,);
      throw new Error("Fatal Error: Cannot return more than 1 token in a row",);
    }
    this.tokenBuffer = token;
  }

  /** Adds a macro to the expansion table. */
  addMacro(macro: Macro,): void {
    this.macroTable.add(macro,);
  }

  /**
   * Registers a template in the unified namespace (phase 23 extension).
   * Returns the refusal reason so the caller can emit the message with the
   * `SourceFileInfo` of the definition (ADR 033).
   *
   * @param template Template to register.
   * @returns Whether the registration succeeded, and why it failed.
   */
  addTemplate(template: Template,): AddTemplateResult {
    return this.macroTable.addTemplate(template,);
  }

  /** true if _name_ is a registered template (phase 23 extension). */
  templateDefined(name: string,): boolean {
    return this.macroTable.templateDefined(name,);
  }

  /**
   * true if the macro _name_ is already defined (Ruby `macroDefined?`).
   *
   * **Macro-only** predicate: a template with the same name does not count (the
   * namespace is shared, but macro redefinition stays the Ruby warning —
   * ADR 033).
   */
  macroDefined(name: string,): boolean {
    return this.macroTable.macroDefined(name,);
  }

  /**
   * Expands a macro and injects it into the stream. _prefix_ re-injects the text
   * immediately before the call; _callLength_ is the length of the whole
   * `${...}`. Ruby expandMacro (l.450-464).
   *
   * @param prefix Text to inject before the expansion.
   * @param args Macro name followed by its positional arguments.
   * @param callLength Length of the full call being replaced.
   */
  expandMacro(prefix: string, args: string[], callLength: number,): void {
    const resolved = this.macroTable.resolve(args, this.sourceFileInfo(),);
    const macro = resolved ? resolved[0] : null;
    const text = resolved ? resolved[1] : null;

    // Macro expanded to nothing: ignored silently.
    if (text === "") return;

    if (!(macro && text)) {
      this.error("undefined_macro", `Undefined macro '${args[0]}' called`,);
    }

    const injected = this.cf
      ? this.cf.injectMacro(
        macro,
        args,
        (prefix ?? "") + (text ?? ""),
        callLength,
      )
      : false;
    if (!injected) {
      this.error("macro_stack_overflow", "Too many nested macro calls.",);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 23 extension — expansion of `template` (ADR 033)
  // ---------------------------------------------------------------------------

  /**
   * Expands a `${NAME k=v …}` template call (plan §4.4, two phases):
   *
   * 1. Phase 1 — the `${MACRO …}` of the body is expanded textually;
   * 2. Phase 2 — the resulting body is rendered by Vento with the params;
   *
   * and the final text re-enters the stream through the same `injectMacro` used
   * by macros.
   *
   * The re-entrant text is rescanned as plain TJP — that is what makes a
   * template call produced by the render (`${OTHER …}`) expand in cascade
   * (23.3.9).
   *
   * @param prefix Text to inject before the rendered content.
   * @param name Name of the template, possibly prefixed with `?`.
   * @param rawArgs Raw named-argument list of the call.
   * @param callLength Length of the full call being replaced.
   * @param callSfi Location of the call, for error messages.
   */
  expandTemplateCall(
    prefix: string,
    name: string,
    rawArgs: string,
    callLength: number,
    callSfi: SourceFileInfo = this.sourceFileInfo(),
  ): void {
    const target = this.templateCallTarget(name,);
    const template = target.template;
    if (!template) {
      // `${?NAME …}` with a missing template is a silent no-op (§4.5.4).
      if (target.optional) return;
      // Unreachable through the normal path (the caller decides by lookup), but
      // keeps the same message as the macro if the namespace changes midway.
      this.error("undefined_macro", `Undefined macro '${name}' called`,);
      return;
    }
    const cleanName = template.name;

    // Guards (§4.6): recursion with the full chain and a depth ceiling. Both
    // check before rendering, so the body is never re-executed indefinitely.
    const chain = this.templateCallChain();
    const cycleAt = chain.indexOf(cleanName,);
    if (cycleAt >= 0) {
      const cycle = [...chain.slice(cycleAt,), cleanName,].join(" → ",);
      this.error(
        "template_recursion",
        `recursão detectada: ${cycle}`,
        callSfi,
      );
      return;
    }
    if (chain.length >= TEMPLATE_DEPTH_LIMIT) {
      this.error("macro_stack_overflow", "Too many nested macro calls.",);
      return;
    }

    const data = this.parseNamedArguments(cleanName, rawArgs, callSfi,);
    if (data === null) return;
    if (!this.validateTemplateArgs(template, data, callSfi,)) return;

    const content = this.renderTemplate(template, data, callSfi,);
    if (content === null) return;

    const injected = this.cf
      ? this.cf.injectMacro(
        null,
        [cleanName,],
        (prefix ?? "") + content,
        callLength,
      )
      : false;
    if (!injected) {
      this.error("macro_stack_overflow", "Too many nested macro calls.",);
    }
  }

  /**
   * Validates the arguments against the declared parameter list (§5).
   *
   * Undeclared comes before missing: a typo (`effortt`) is usually the cause of
   * the "missing parameter" and the right message is the typo one.
   *
   * @param template Template being called.
   * @param data Arguments read from the call.
   * @param callSfi Location of the call, for error messages.
   * @returns `true` when the arguments match the declaration.
   */
  protected validateTemplateArgs(
    template: Template,
    data: Record<string, TemplateArgumentValue>,
    callSfi: SourceFileInfo,
  ): boolean {
    const name = template.name;
    for (const key of Object.keys(data,)) {
      if (!template.params.includes(key,)) {
        this.error(
          "template_unknown_param",
          `template '${name}': parâmetro '${key}' não declarado`,
          callSfi,
        );
        return false;
      }
    }
    for (const param of template.params) {
      if (!(param in data)) {
        this.error(
          "template_missing_param",
          `template '${name}': parâmetro '${param}' não fornecido`,
          callSfi,
        );
        return false;
      }
    }
    return true;
  }

  /**
   * Rendering core (two phases, §4.4) shared by the stream call
   * (`${NAME …}`) and by the inline composition (`expandTemplate`).
   *
   * Returns the rendered text or `null` when the error was already reported.
   *
   * @param template Template to render.
   * @param data Arguments of the call.
   * @param callSfi Location of the call, for error messages.
   * @returns The rendered text, or `null` on failure.
   */
  protected renderTemplate(
    template: Template,
    data: Record<string, TemplateArgumentValue>,
    callSfi: SourceFileInfo,
  ): string | null {
    const cleanName = template.name;

    // Phase 1 — macros of the body, before the render.
    const expandedBody = this.expandMacrosInText(template.body,);

    // Phase 2 — Vento render with params + global keys in the context (§4.7).
    const context = this.buildTemplateContext(cleanName, data, callSfi,);
    const rendered = templateEngine.render(expandedBody, context,);
    if (!rendered.ok) {
      const syntax = rendered.kind === "syntax";
      const kind = syntax ? "erro de sintaxe" : "erro de execução";
      // The body starts on the definition line when the text follows the `[`
      // on the same line; it starts one line later when `[` closes the line.
      const offset = template.body.startsWith("\n",) ? 1 : 0;
      const line = template.sourceFileInfo.lineNo + offset + rendered.line - 1;
      this.error(
        syntax ? "template_syntax_error" : "template_render_error",
        `template '${cleanName}': ${kind} na linha ${rendered.line}: ${rendered.message}`,
        new SourceFileInfo(
          template.sourceFileInfo.fileName,
          line,
          rendered.column,
        ),
      );
      return null;
    }
    return rendered.content;
  }

  /**
   * Builds the rendering context: global keys (§4.7) + parameters.
   *
   * The parameter **overrides** the homonymous global and the collision becomes
   * a warning with the `sfi` of the call (23.6.5) — the template keeps
   * rendering.
   *
   * @param callName Name of the template being called.
   * @param data Arguments of the call.
   * @param callSfi Location of the call, for the warning.
   * @returns The context handed to the template engine.
   */
  protected buildTemplateContext(
    callName: string,
    data: Record<string, TemplateArgumentValue>,
    callSfi: SourceFileInfo,
  ): Record<string, unknown> {
    const context = this.templateGlobals(callSfi,);
    for (const key of Object.keys(data,)) {
      if (key in context) {
        this.warning(
          "template_shadowed_global",
          `template '${callName}': parâmetro '${key}' sobrescreve a chave ` +
            "global de mesmo nome",
          callSfi,
        );
      }
      context[key] = data[key];
    }
    return context;
  }

  /**
   * Global keys available in any body (§4.7): `project` (frozen, read-only
   * view), `ids`, `expandTemplate`, `expandMacro` and `expandTemplateList`.
   *
   * @param callSfi Location of the call, propagated to the helpers.
   * @returns The global part of the template context.
   */
  protected templateGlobals(
    callSfi: SourceFileInfo,
  ): Record<string, unknown> {
    const view = this.projectContextProvider?.() ?? null;
    return {
      project: view ?? EMPTY_PROJECT_VIEW,
      ids: (id: unknown,) =>
        this.templateIdResolver?.(String(id ?? "",),) ?? "",
      expandTemplate: (name: unknown, args: unknown,) =>
        this.expandTemplateInline(String(name ?? "",), args, callSfi,),
      expandMacro: (name: unknown, ...args: unknown[]) =>
        this.expandMacroInline(
          String(name ?? "",),
          args.map((a,) => String(a ?? "",)),
          callSfi,
        ),
      expandTemplateList: (name: unknown, list: unknown,) =>
        this.expandTemplateListInline(String(name ?? "",), list, callSfi,),
    };
  }

  /**
   * `expandTemplate(name, { … })` — renders another template **inline** and
   * returns the text (without injecting it into the stream). It is the explicit
   * composition form recommended by plan §4.4.
   *
   * @param name Name of the template, possibly prefixed with `?`.
   * @param args Argument object handed to the template.
   * @param callSfi Location of the call, for error messages.
   * @returns The rendered text, or `""` on failure.
   */
  protected expandTemplateInline(
    name: string,
    args: unknown,
    callSfi: SourceFileInfo,
  ): string {
    const target = this.templateCallTarget(name,);
    const template = target.template;
    if (!template) {
      if (target.optional) return "";
      const clean = name.replace(/^\?/, "",);
      this.error("template_not_defined", `'${clean}' não definido`, callSfi,);
      return "";
    }
    const cleanName = template.name;

    // Recursion: the stream chain + the stack of the inline calls in progress.
    const chain = [...this.templateCallChain(), ...this.inlineTemplateStack,];
    const cycleAt = chain.indexOf(cleanName,);
    if (cycleAt >= 0) {
      const cycle = [...chain.slice(cycleAt,), cleanName,].join(" → ",);
      this.error(
        "template_recursion",
        `recursão detectada: ${cycle}`,
        callSfi,
      );
      return "";
    }

    const data = toArgumentMap(args,);
    if (!this.validateTemplateArgs(template, data, callSfi,)) return "";

    this.inlineTemplateStack.push(cleanName,);
    try {
      return this.renderTemplate(template, data, callSfi,) ?? "";
    } finally {
      this.inlineTemplateStack.pop();
    }
  }

  /**
   * `expandMacro(name, …)` — resolves the macro from a string (§4.7).
   * The macro is still a textual substitution; the returned text enters the
   * rendered body and is rescanned normally.
   *
   * @param name Name of the macro, possibly prefixed with `?`.
   * @param args Positional arguments of the call.
   * @param callSfi Location of the call, for error messages.
   * @returns The macro body, or `""` when it does not exist.
   */
  protected expandMacroInline(
    name: string,
    args: string[],
    callSfi: SourceFileInfo,
  ): string {
    const resolved = this.macroTable.resolve([name, ...args,], callSfi,);
    if (!resolved) {
      if (name.startsWith("?",)) return "";
      this.error(
        "undefined_macro",
        `Undefined macro '${name}' called`,
        callSfi,
      );
      return "";
    }
    return resolved[1];
  }

  /**
   * `expandTemplateList(name, list)` — optional convenience of plan §4.7:
   * renders the same template for each item and returns the array of texts.
   *
   * An item that is not an object is bound to the **first** declared parameter:
   * it is the common case of a list of IDs (`["a", "b"]`).
   *
   * @param name Name of the template to render.
   * @param list Items rendered one by one.
   * @param callSfi Location of the call, for error messages.
   * @returns One rendered text per item.
   */
  protected expandTemplateListInline(
    name: string,
    list: unknown,
    callSfi: SourceFileInfo,
  ): string[] {
    if (!Array.isArray(list,)) return [];
    const params = this.templateCallTarget(name,).template?.params ?? [];
    const first = params[0];
    return list.map((item,) => {
      const isObject = item !== null && typeof item === "object" &&
        !Array.isArray(item,);
      const args = isObject || first === undefined ? item : { [first]: item, };
      return this.expandTemplateInline(name, args, callSfi,);
    },);
  }

  /**
   * Splits `NAME "a" "b"` into name + positional args (Ruby `endMacroCall`).
   * The leftover text is the Ruby `junk_at_eom` error — the macro path is
   * **frozen**: both callers (macro and phase 1 of the template) use exactly
   * the same routine.
   *
   * @param argsStr Text of the call after `${` and before `}`.
   * @returns Name of the macro plus its positional arguments.
   */
  protected splitMacroArgs(argsStr: string,): PositionalMacroArgs {
    const spaceIdx = argsStr.indexOf(" ",);
    if (spaceIdx < 0) return { name: argsStr, args: [], };

    const name = argsStr.slice(0, spaceIdx,);
    let rest = argsStr.slice(name.length,);
    const args: string[] = [];
    // Internal StringScanner to strip the double quotes of the arguments.
    for (;;) {
      const open = /^\s*"/.exec(rest,);
      if (!open) break;
      rest = rest.slice(open[0].length,);
      const body = /^(\\"|[^"])*/.exec(rest,)![0];
      args.push(body.replaceAll('\\"', '"',),);
      rest = rest.slice(body.length,);
      const close = /^"\s*/.exec(rest,);
      rest = close ? rest.slice(close[0].length,) : rest.slice(1,);
    }

    if (rest !== "") {
      this.error(
        "junk_at_eom",
        `Junk found at end of macro: ${rest}`,
      );
    }

    return { name, args, };
  }

  /**
   * Phase 1 — expands the `${MACRO …}` calls of a template body.
   *
   * **Macros only**: `${TEMPLATE …}` in the body is text (a template call uses
   * `expandTemplate()` from the context — plan §4.4). The `$${` escape loses
   * one `$` and does not expand, as in Ruby's `MacroTable#resolve`.
   *
   * @param body Raw body of the template.
   * @returns The body with every macro call replaced by its value.
   */
  protected expandMacrosInText(body: string,): string {
    let text = body;
    for (let pass = 0; pass < BODY_EXPANSION_PASSES; pass++) {
      let changed = false;
      const callRe = /\$\{\s*(\??[A-Za-z_]\w*)((?:\s*"(?:\\"|[^"])*")*)\s*\}/g;
      text = text.replaceAll(
        callRe,
        (
          match: string,
          rawName: string,
          rawArgs: string,
          offset: number,
          whole: string,
        ): string => {
          if (offset > 0 && whole[offset - 1] === "$") return match;
          const name = rawName.replace(/^\?/, "",);
          // A template in the body stays text (§4.4).
          if (this.macroTable.template(name,)) return match;
          const { name: macroName, args, } = this.splitMacroArgs(
            rawName + rawArgs,
          );
          const resolved = this.macroTable.resolve(
            [macroName, ...args,],
            this.sourceFileInfo(),
          );
          if (!resolved) {
            this.error(
              "undefined_macro",
              `Undefined macro '${macroName}' called`,
            );
            return match;
          }
          changed = true;
          return resolved[1];
        },
      );
      if (!changed) return text;
    }
    this.error("macro_stack_overflow", "Too many nested macro calls.",);
    return text;
  }

  /**
   * Decides whether _name_ points to a template, honouring the `?` prefix
   * (optional call, §4.5.4). It also returns the optionality state so the
   * caller knows to silence a missing name.
   *
   * @param name Name as written in the call, possibly with `?`.
   * @returns The template (or `null`) and whether the call was optional.
   */
  templateCallTarget(
    name: string,
  ): { template: Template | null; optional: boolean } {
    const optional = name.startsWith("?",);
    const clean = optional ? name.slice(1,) : name;
    return { template: this.macroTable.template(clean,), optional, };
  }

  /**
   * Chain of templates currently being evaluated, from base to top.
   *
   * The anchoring is the same as the macros': `macro === null` entries in the
   * expansion stack of the stream, pushed by `injectMacro` and popped by
   * `cleanupMacroStack` as the cursor advances. That is why recursion detection
   * sees the nested calls produced by the render itself (stream re-entry), not
   * only the syntactic nesting.
   *
   * @returns The names of the templates being evaluated, outermost first.
   */
  protected templateCallChain(): string[] {
    const cf = this.cf;
    if (!cf) return [];
    const chain: string[] = [];
    for (const entry of cf.macroStack) {
      if (entry.macro === null && entry.args.length > 0) {
        chain.push(entry.args[0]!,);
      }
    }
    return chain;
  }

  /**
   * Wires the logical-expression engine of phase 11 to the argument expansion.
   * Without an evaluator, a call such as `isMilestone(!t1)` stays text.
   *
   * @param evaluator External evaluator, or `null` to detach it.
   */
  setExpressionEvaluator(
    evaluator: ((text: string,) => ExpressionEvaluation) | null,
  ): void {
    this.expressionEvaluator = evaluator;
  }

  /**
   * Wires the read-only view of `project` (§4.7). The provider is **lazy**: the
   * `${NAME …}` call happens after the project header.
   *
   * @param provider Supplier of the project view, or `null` to detach it.
   */
  setProjectContextProvider(
    provider: (() => Readonly<Record<string, unknown>> | null) | null,
  ): void {
    this.projectContextProvider = provider;
  }

  /** Wires `ids()` (§4.7) to the ID resolver of the project. */
  setTemplateIdResolver(
    resolver: ((id: string,) => string) | null,
  ): void {
    this.templateIdResolver = resolver;
  }

  /** Result of the external evaluator (`ok: false` when there is no engine). */
  protected evaluateArgumentExpression(text: string,): ExpressionEvaluation {
    return this.expressionEvaluator
      ? this.expressionEvaluator(text,)
      : { ok: false, };
  }

  /**
   * Converts `k=v k2="v 2"` into the call context (sub-phase 23.4).
   *
   * The typing (string/number/boolean/`!id`/list/object/expression) lives in
   * `template-arguments.ts`, which does not know the scanner. Here we only turn
   * the refusal into a localized message. Returns `null` when the text is not a
   * valid pair list (error already reported).
   *
   * @param callName Name of the template being called.
   * @param rawArgs Raw named-argument list of the call.
   * @param callSfi Location of the call, for error messages.
   * @returns The typed arguments, or `null` on failure.
   */
  protected parseNamedArguments(
    callName: string,
    rawArgs: string,
    callSfi: SourceFileInfo,
  ): Record<string, TemplateArgumentValue> | null {
    const parsed = parseTemplateArguments(rawArgs, {
      evaluateExpression: (text: string,) =>
        this.evaluateArgumentExpression(text,),
    },);
    if (parsed.ok) return parsed.args;

    const prefix = `template '${callName}': `;
    switch (parsed.reason) {
      case "invalid_pair":
        this.error(
          "template_bad_argument",
          `${prefix}argumento inválido em '${parsed.at}'`,
          callSfi,
        );
        break;
      case "missing_value":
        this.error(
          "template_bad_argument",
          `${prefix}valor ausente para '${parsed.key}'`,
          callSfi,
        );
        break;
      case "unterminated_string":
        this.error(
          "template_bad_argument",
          `${prefix}string não fechada em '${parsed.key}'`,
          callSfi,
        );
        break;
      case "unbalanced":
        this.error(
          "template_bad_argument",
          `${prefix}delimitador não balanceado em '${parsed.key}'`,
          callSfi,
        );
        break;
    }
    return null;
  }

  /**
   * Error related to the processed text (throws ≈ Ruby trapSetup).
   *
   * @param id Message id used for deduplication.
   * @param text Error text.
   * @param sfi Location of the error, when known.
   * @param data Extra payload handed to the handler.
   */
  error(
    id: string,
    text: string,
    sfi: SourceFileInfo | null = null,
    data: unknown = null,
  ): void {
    this.message("error", id, text, sfi, data,);
  }

  /**
   * Warning related to the processed text: recorded but does not abort.
   *
   * @param id Message id used for deduplication.
   * @param text Warning text.
   * @param sfi Location of the warning, when known.
   * @param data Extra payload handed to the handler.
   */
  warning(
    id: string,
    text: string,
    sfi: SourceFileInfo | null = null,
    data: unknown = null,
  ): void {
    this.message("warning", id, text, sfi, data,);
  }

  /**
   * Lexing core: matches the active patterns, advancing line by line.
   * Ruby scanToken (l.477-533). The `match` variable persists across turns of
   * the outer loop exactly as in Ruby (Category B preserved).
   *
   * @returns The next token of the active file.
   */
  private scanToken(): ScannerToken {
    this.startOfToken = this.sourceFileInfo();
    let match: string | null = null;
    for (;;) {
      if (!this.cf || !this.cf.readyNextLine()) {
        if (this.scannerMode !== this.defaultMode) {
          // The stream restarts the line count; compensate through lineDelta.
          this.lineDelta = -(this.startOfToken!.lineNo - 1);
          this.error(
            "runaway_token",
            `Unterminated token starting at line ${this.startOfToken}`,
          );
        }
        // End of the input file: special token.
        this.finishLastFile = true;
        return ["eof", "<END>", this.startOfToken,];
      }

      if (this.activePatterns) {
        for (const entry of this.activePatterns) {
          // Ruby: `if (match = @cf.scan(re))` — the assignment also clears
          // `match` when the pattern does not match. Without that, an ignored
          // token (type nil) would leave `match` stale and the loop would never
          // reach the error branch (infinite loop in `no_token_match`).
          match = this.cf.scan(entry[1],);
          if (match !== null) {
            let type: string | null = entry[0];
            let value: unknown = match;
            const postProc = entry[3];
            if (postProc) {
              [type, value,] = postProc(type, value as string,);
              match = value as string;
            }
            if (type === null) break; // Ignored token.

            this.cf.cleanupMacroStack();
            return [type, value, this.startOfToken,];
          }
        }
      }

      if (match === null) {
        // No match: either an unexpected EOF or an unrecognized character.
        if (this.cf.eof()) {
          this.error("unexpected_eof", "Unexpected end of file found",);
        } else {
          this.error(
            "no_token_match",
            `Unexpected characters found: '${this.cf.peek(10,)}...'`,
          );
          // No pattern consumed the cursor: repeating the loop turn would match
          // the same patterns at the same position forever (Ruby leaves the
          // process in `MessageHandler#error` without `trapSetup`). Aborts the
          // parse — the message above is already in the handler.
          throw new TjError("",);
        }
      } else {
        // Removes fully consumed expanded macros.
        this.cf.cleanupMacroStack();
      }
    }
  }

  /**
   * Logs into the MessageHandler — equivalent to `message` of Scanner.rb
   * (l.535-563): errors and warnings go through `MessageHandler#error/warning`,
   * which THROWS `TjRuntimeError` when `trapSetup` is active (the first error
   * aborts the parse — that is the behaviour the golden tests record). Includes
   * the macro history as previous infos.
   *
   * @param type Whether the message is an error or a warning.
   * @param id Message id used for deduplication.
   * @param text Message text.
   * @param sfi Location of the message, when known.
   * @param data Extra payload handed to the handler.
   */
  private message(
    type: MessageType,
    id: string,
    text: string,
    sfi: SourceFileInfo | null,
    data: unknown,
  ): void {
    if (text === "") return;

    const line = this.cf ? this.cf.currentLine() : null;
    const at = sfi ?? this.sourceFileInfo();

    if (this.cf && this.cf.macroStack.length > 0) {
      this.messageHandler.info("macro_stack", "Macro call history:", null,);
      for (const entry of [...this.cf.macroStack,].reverse()) {
        const macro = entry.macro;
        if (!macro) continue;
        const args = entry.args.slice(1,).map((a,) => `"${a}"`);
        this.messageHandler.info(
          "macro_stack",
          `  \${${macro.name}${args.length === 0 ? "" : " "}` +
            `${args.join(" ",)}}`,
          macro.sourceFileInfo,
        );
      }
    }

    if (type === "error") {
      this.messageHandler.error(id, text, at, line, data,);
    } else {
      this.messageHandler.warning(id, text, at, line, data,);
    }
  }
}
