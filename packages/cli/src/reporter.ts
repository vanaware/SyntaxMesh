/**
 * `reporter.ts` — envelope messages in the terminal (24.4).
 *
 * The CLI does **not** read the live `MessageHandlerInstance`: messages arrive
 * structured in `result.messages` (`severity`/`id`/`text`/`file`/`line`), the same
 * data the envelope carries to the PWA. Format faithful to Ruby
 * (`Message#to_s`): `file:line: Type: text`, with the type capitalised.
 *
 * Output on **stderr**, as `$stderr.puts msg.to_s` in Ruby: `stdout` stays
 * reserved for the report content (output policy, 24.5), which makes
 * `syntaxmesh proj.smx --report x > out.html` predictable.
 *
 * @see docs/taskjuggler/lib/taskjuggler/MessageHandler.rb (Message#to_s)
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.4)
 */
import type { ExecutionMessage, } from "@vanaware/syntaxmesh";

/** Writes a line; injectable so tests need no global mock. */
export type WriteLine = (text: string,) => void;

/** Renderer options (resolved from `--silent`/`--no-color`/TTY). */
export interface ReporterOptions {
  /** `--silent`: suppresses info/debug (errors and warnings still appear). */
  silent?: boolean;
  /** `false` turns ANSI off (pipe, redirection or `--no-color`). */
  color?: boolean;
  /** `stdout` (project summary, 24.4.5). */
  out?: WriteLine;
  /** `stderr` (messages and final count). */
  err?: WriteLine;
}

/** Final count derived from the envelope. */
export interface MessageCounts {
  errors: number;
  warnings: number;
}

/** SGR colour per severity (Ruby's `Message#to_s`). */
const COLORS: Record<ExecutionMessage["severity"], string> = {
  fatal: "\u001b[31m",
  error: "\u001b[31m",
  warning: "\u001b[35m",
  info: "\u001b[34m",
  debug: "\u001b[32m",
};

/** ANSI reset. */
const RESET = "\u001b[0m";

/** Capitalised type, as in Ruby's `@type.to_s.capitalize`. */
function label(severity: ExecutionMessage["severity"],): string {
  return severity.charAt(0,).toUpperCase() + severity.slice(1,);
}

/**
 * Renders one envelope message as a single line.
 *
 * `file:line: Type: text` when there is an origin; without an origin it falls
 * back to `Type: text`. The `file`/`line` fields of the envelope already arrive
 * separated, so the formatting does not depend on `SourceFileInfo`.
 */
export function formatMessage(
  message: ExecutionMessage,
  color = false,
): string {
  const origin = message.file === null
    ? ""
    : message.line === null
    ? `${message.file}: `
    : `${message.file}:${message.line}: `;
  const tag = `${label(message.severity,)}: `;
  const body = `${origin}${tag}${message.text}`;
  return color
    ? `${origin}${COLORS[message.severity]}${tag}${message.text}${RESET}`
    : body;
}

/** `--silent` hides info and debug; errors/warnings always appear. */
function isHidden(message: ExecutionMessage, silent: boolean,): boolean {
  return silent &&
    (message.severity === "info" || message.severity === "debug");
}

/** Terminal reporter: messages plus the final count. */
export class Reporter {
  private readonly silent: boolean;
  private readonly color: boolean;
  private readonly out: WriteLine;
  private readonly err: WriteLine;

  constructor(options: ReporterOptions = {},) {
    this.silent = options.silent === true;
    this.color = options.color === true;
    this.err = options.err ?? ((text: string,) => console.error(text,));
    this.out = options.out ?? ((text: string,) => console.log(text,));
  }

  /** Prints a message respecting level, silence and colour. */
  message(message: ExecutionMessage,): void {
    if (isHidden(message, this.silent,)) return;
    this.err(formatMessage(message, this.color,),);
  }

  /**
   * Error born in the CLI (not in the envelope) — e.g. a failed report.
   *
   * Uses the same `Error:` format as `Message#to_s` and is **never** silenced:
   * `--silent` mutes progress, not failure.
   */
  error(text: string,): void {
    this.err(
      formatMessage({
        severity: "error",
        id: "cli",
        text,
        file: null,
        line: null,
      }, this.color,),
    );
  }

  /** Counts envelope errors/warnings (fatal counts as an error, as in Ruby). */
  static count(messages: readonly ExecutionMessage[],): MessageCounts {
    let errors = 0;
    let warnings = 0;
    for (const message of messages) {
      if (message.severity === "error" || message.severity === "fatal") {
        errors++;
      } else if (message.severity === "warning") {
        warnings++;
      }
    }
    return { errors, warnings, };
  }

  /**
   * Prints every message and returns the final count.
   *
   * The `N errors, M warnings` line only appears when there is something to
   * report — a clean run gets no noise. **Adaptation** to `tj3`: Ruby prints no
   * count (the messages suffice), but plan 24.4.4 asks for it as a summary.
   */
  report(
    messages: readonly ExecutionMessage[],
  ): MessageCounts {
    for (const message of messages) this.message(message,);
    const counts = Reporter.count(messages,);
    if (counts.errors > 0 || counts.warnings > 0) {
      this.err(summaryLine(counts,),);
    }
    return counts;
  }

  /** Project summary line (`summary.ts`); an empty list is a no-op. */
  summary(lines: readonly string[],): void {
    if (this.silent) return;
    for (const line of lines) this.out(line,);
  }
}

/** `2 errors, 5 warnings` — always with correct singular/plural. */
export function summaryLine(counts: MessageCounts,): string {
  const plural = (count: number, noun: string,): string =>
    `${count} ${noun}${count === 1 ? "" : "s"}`;
  return `${plural(counts.errors, "error",)}, ${
    plural(counts.warnings, "warning",)
  }`;
}
