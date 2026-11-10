/**
 * A single diagnostic emitted by the engine.
 *
 * Messages are plain records produced by {@link MessageHandlerInstance} and
 * mirrored from TaskJuggler's `Message` class: they carry a severity, a stable
 * identifier, the human-readable text and the source location that triggered
 * them. They are deliberately free of side effects — rendering is left to
 * {@link Message.to_s} (console, ANSI coloured) and {@link Message.to_log}
 * (log file, uncoloured), so the same record can be shipped to a browser or
 * serialised into an execution envelope.
 */
import { SourceFileInfo, } from "./source-file-info.ts";
import { TjRuntimeError, } from "./model/errors.ts";
import { Scenario, } from "./model/scenario.ts";

/**
 * Severity of a {@link Message}.
 *
 * `fatal` aborts immediately, `error` aborts when the parser is trapping
 * setup errors, `warning` aborts only under `--abort-on-warnings`; `info` and
 * `debug` are purely informational.
 */
export type MessageType = "fatal" | "error" | "warning" | "info" | "debug";

/**
 * One diagnostic record: what happened, how bad it was and where.
 *
 * Instances are immutable apart from {@link Message.sourceFileInfo}, which the
 * handler rebinds when it falls back to a baseline location.
 */
export class Message {
  /** Severity bucket used for colouring, filtering and exit-code decisions. */
  readonly type: MessageType;
  /** Stable identifier of the condition (TaskJuggler message id). */
  readonly id: string;
  /** Human-readable description, already interpolated. */
  readonly message: string;
  /** File/line region the condition refers to, or `null` when unknown. */
  sourceFileInfo: SourceFileInfo | null;
  /** Offending source line, verbatim, or `null` when not captured. */
  readonly line: string | null;
  /** Extra machine-readable payload for consumers that need more detail. */
  readonly data: unknown;
  /** Scenario in effect when the message was produced, if any. */
  readonly scenario: Scenario | null;

  /**
   * Creates a message record, filling every optional slot with its default
   * (`null`, or `undefined` for `data`).
   *
   * @param type Severity bucket.
   * @param id Stable condition identifier.
   * @param message Human-readable description.
   * @param sfi Source location, defaulting to `null`.
   * @param line Offending source line, defaulting to `null`.
   * @param data Extra payload, defaulting to `undefined`.
   * @param scenario Scenario in effect, defaulting to `null`.
   */
  constructor(
    type: MessageType,
    id: string,
    message: string,
    sfi?: SourceFileInfo | null,
    line?: string | null,
    data?: unknown,
    scenario?: Scenario | null,
  ) {
    this.type = type;
    this.id = id;
    this.message = message;
    this.sourceFileInfo = sfi ?? null;
    this.line = line ?? null;
    this.data = data;
    this.scenario = scenario ?? null;
  }

  /**
   * Renders the message for a terminal: `id: message [location]`.
   *
   * ANSI colours encode the severity (red for `fatal`/`error`, yellow for
   * `warning`, cyan for `info`, grey for `debug`); the location suffix is
   * omitted when no {@link Message.sourceFileInfo} is known.
   */
  to_s(): string {
    const colorCodes = {
      fatal: "\x1b[31m",
      error: "\x1b[31m",
      warning: "\x1b[33m",
      info: "\x1b[36m",
      debug: "\x1b[90m",
    };
    const reset = "\x1b[0m";
    const color = colorCodes[this.type] || "";
    let result = `${color}${this.id}: ${this.message}${reset}`;
    if (this.sourceFileInfo) {
      result += ` [${this.sourceFileInfo.to_s()}]`;
    }
    return result;
  }

  /**
   * Renders the message for a log file: `TYPE: id: message`.
   *
   * No ANSI sequences and no location, matching TaskJuggler's log format.
   */
  to_log(): string {
    return `${this.type.toUpperCase()}: ${this.id}: ${this.message}`;
  }
}
