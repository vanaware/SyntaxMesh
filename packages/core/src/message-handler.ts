/**
 * Process-wide diagnostic sink.
 *
 * Every layer of the engine reports through {@link MessageHandlerInstance}
 * instead of printing or throwing on its own: the handler records
 * {@link Message} objects, keeps the running error count and — depending on its
 * configuration — escalates some severities into thrown `TjRuntimeError`s.
 * Splitting recording from rendering is what lets the same engine run in the
 * browser, in the CLI and inside a time-sheet app.
 */
import { Message, MessageType, } from "./message.ts";
import { SourceFileInfo, } from "./source-file-info.ts";
import { TjArgumentError, TjRuntimeError, } from "./model/errors.ts";
import { Scenario, } from "./model/scenario.ts";

/**
 * Numeric ordering of the log levels.
 *
 * Mirrors TaskJuggler's `MessageHandler::LogLevels`. Note that `error` and
 * `critical` share level 2: a `critical` message is recorded as an `error` and
 * filtered by the same threshold.
 */
export const LOG_LEVELS = {
  none: 0,
  fatal: 1,
  error: 2,
  critical: 2,
  warning: 3,
  info: 4,
  debug: 5,
} as const;

/**
 * Name accepted by {@link MessageHandlerInstance.outputLevel} and
 * {@link MessageHandlerInstance.logLevel} in place of a numeric level.
 */
export type LogLevelName = keyof typeof LOG_LEVELS;

/**
 * Records diagnostics and decides which severities escalate into exceptions.
 *
 * The class is a singleton: the engine keeps no diagnostics in any other place,
 * so `MessageHandlerInstance.instance` is the one handle every consumer needs.
 * Constructing a second instance returns the first one.
 *
 * Severity handling mirrors TaskJuggler:
 *
 * | Method     | Recorded as | Throws                                    |
 * | ---------- | ----------- | ----------------------------------------- |
 * | `fatal`    | `fatal`     | always                                    |
 * | `error`    | `error`     | only while {@link trapSetup} is on         |
 * | `critical` | `error`     | never                                     |
 * | `warning`  | `warning`   | only while {@link abortOnWarning} is on    |
 * | `info`     | `info`      | never                                     |
 * | `debug`    | `debug`     | never                                     |
 */
export class MessageHandlerInstance {
  /** Every message recorded since the last {@link reset} or {@link clear}. */
  messages: Message[] = [];
  /** Number of messages recorded at `error` severity or above. */
  errors: number = 0;
  /** Path of the file new messages are appended to, or `null` for none. */
  logFile: string | null = null;
  /** When `true`, renderers omit the scenario suffix from messages. */
  hideScenario: boolean = false;
  /** When `true`, a `warning` throws instead of only being recorded. */
  abortOnWarning: boolean = false;
  /** Location used when a caller reports without an explicit source file. */
  baselineSFI: SourceFileInfo | null = null;
  /** When `true`, an `error` aborts the current parse by throwing. */
  trapSetup: boolean = false;

  private _outputLevel: number = 2;
  private _logLevel: number = 2;

  private static _instance: MessageHandlerInstance | null = null;

  /** The singleton handler, created on first access. */
  static get instance(): MessageHandlerInstance {
    if (!MessageHandlerInstance._instance) {
      MessageHandlerInstance._instance = new MessageHandlerInstance();
    }
    return MessageHandlerInstance._instance;
  }

  /** Returns the existing singleton when one is already installed. */
  constructor() {
    if (MessageHandlerInstance._instance) {
      return MessageHandlerInstance._instance;
    }
    MessageHandlerInstance._instance = this;
  }

  /**
   * Restores every field to its default: no messages, no errors, both levels
   * back to `2` (`error`), every switch off.
   */
  reset(): void {
    this.messages = [];
    this.errors = 0;
    this.outputLevel = 2;
    this.logLevel = 2;
    this.logFile = null;
    this.hideScenario = false;
    this.abortOnWarning = false;
    this.baselineSFI = null;
    this.trapSetup = false;
  }

  /**
   * Lowest severity written to the console: lower-numbered, more severe
   * messages pass; everything above the threshold is dropped.
   */
  get outputLevel(): number {
    return this._outputLevel;
  }

  set outputLevel(level: number | LogLevelName,) {
    this._outputLevel = this.checkLevel(level,);
  }

  /** Lowest severity written to {@link logFile}. */
  get logLevel(): number {
    return this._logLevel;
  }

  set logLevel(level: number | LogLevelName,) {
    this._logLevel = this.checkLevel(level,);
  }

  /**
   * Validates a level and returns it as a number.
   *
   * Accepts an integer in `0..5` or one of the {@link LOG_LEVELS} names. An
   * integer outside the range throws `TjArgumentError` quoting the number; an
   * unknown name throws the same error with an empty value, matching the
   * TaskJuggler wording byte for byte.
   */
  checkLevel(level: number | LogLevelName,): number {
    if (typeof level === "number" && Number.isInteger(level,)) {
      if (level < 0 || level > 5) {
        throw new TjArgumentError(`Unsupported level ${level}`,);
      }
      return level;
    }
    const resolved = LOG_LEVELS[level as LogLevelName];
    if (resolved === undefined) {
      throw new TjArgumentError("Unsupported level ",);
    }
    return resolved;
  }

  /**
   * Drops every recorded message and resets the error count, keeping the
   * configuration (levels, `logFile`, switches) intact.
   */
  clear(): void {
    this.messages = [];
    this.errors = 0;
  }

  /**
   * Records a fatal condition and always throws `TjRuntimeError`.
   *
   * Called when continuing is pointless — the engine cannot produce a result,
   * so the error propagates to the caller instead of being counted.
   */
  fatal(
    id: string,
    message: string,
    sfi?: SourceFileInfo | null,
    line?: string | null,
    data?: unknown,
    scenario?: Scenario | null,
  ): never {
    this.addMessage("fatal", id, message, sfi, line, data, scenario,);
    this.errors++;
    throw new TjRuntimeError(`${id}: ${message}`,);
  }

  /**
   * Records an error and increments {@link errors}.
   *
   * With {@link trapSetup} on, the first error aborts the current parse by
   * throwing `TjRuntimeError`; otherwise the message is accumulated and the
   * caller decides the final exit status.
   */
  error(
    id: string,
    message: string,
    sfi?: SourceFileInfo | null,
    line?: string | null,
    data?: unknown,
    scenario?: Scenario | null,
  ): void {
    this.addMessage("error", id, message, sfi, line, data, scenario,);
    this.errors++;
    // Ruby (MessageHandler.rb l.291-298): com trapSetup ativo levanta
    // TjRuntimeError (primeiro erro aborta o parse); sem trap, o CLI
    // faria exit 1 — em teste/navegador acumulamos silenciosamente.
    if (this.trapSetup) {
      throw new TjRuntimeError(`${id}: ${message}`,);
    }
  }

  /**
   * Records an unrecoverable condition as an `error` without throwing.
   *
   * Used where the failure must be reported but processing has to continue to
   * collect every remaining diagnostic.
   */
  critical(
    id: string,
    message: string,
    sfi?: SourceFileInfo | null,
    line?: string | null,
    data?: unknown,
    scenario?: Scenario | null,
  ): void {
    this.addMessage("error", id, message, sfi, line, data, scenario,);
    this.errors++;
  }

  /**
   * Records a warning, throwing `TjRuntimeError` when
   * {@link abortOnWarning} is on (`--abort-on-warnings`).
   */
  warning(
    id: string,
    message: string,
    sfi?: SourceFileInfo | null,
    line?: string | null,
    data?: unknown,
    scenario?: Scenario | null,
  ): void {
    this.addMessage("warning", id, message, sfi, line, data, scenario,);
    if (this.abortOnWarning) {
      throw new TjRuntimeError(`${id}: ${message}`,);
    }
  }

  /** Records an informational message; never throws. */
  info(
    id: string,
    message: string,
    sfi?: SourceFileInfo | null,
    line?: string | null,
    data?: unknown,
    scenario?: Scenario | null,
  ): void {
    this.addMessage("info", id, message, sfi, line, data, scenario,);
  }

  /** Records a debugging message; never throws. */
  debug(
    id: string,
    message: string,
    sfi?: SourceFileInfo | null,
    line?: string | null,
    data?: unknown,
    scenario?: Scenario | null,
  ): void {
    this.addMessage("debug", id, message, sfi, line, data, scenario,);
  }

  /**
   * Builds the {@link Message} and appends it, falling back to
   * {@link baselineSFI} when the caller passes no source location.
   */
  private addMessage(
    type: MessageType,
    id: string,
    message: string,
    sfi?: SourceFileInfo | null,
    line?: string | null,
    data?: unknown,
    scenario?: Scenario | null,
  ): void {
    const effectiveSfi = sfi ?? this.baselineSFI;
    const msg = new Message(
      type,
      id,
      message,
      effectiveSfi,
      line,
      data,
      scenario,
    );
    this.messages.push(msg,);
  }

  /**
   * Renders every recorded message for a terminal, one per line, ANSI
   * colouring included (see {@link Message.to_s}).
   */
  to_s(): string {
    return this.messages.map((m,) => m.to_s()).join("\n",);
  }
}
