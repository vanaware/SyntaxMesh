/** Optional terminal capabilities used by progress output. */
export interface LogRuntime {
  /** Whether progress output should be emitted. */
  isTerminal?: () => boolean;
  /** Writes progress text to the host's output stream. */
  write?: (text: string,) => void;
}

/** Minimal Deno shape needed by the default logging capability probe. */
interface DenoLogCapabilities {
  stderr?: { isTerminal?: () => boolean };
  stdout?: { writeSync?: (bytes: Uint8Array,) => number };
}

/** Detects optional progress capabilities without binding a runtime global. */
function detectLogRuntime(): LogRuntime {
  const host = globalThis as unknown as { Deno?: DenoLogCapabilities };
  const stderr = host.Deno?.stderr;
  const stdout = host.Deno?.stdout;
  const isTerminal = typeof stderr?.isTerminal === "function"
    ? stderr.isTerminal.bind(stderr,)
    : undefined;
  const writeSync = typeof stdout?.writeSync === "function"
    ? stdout.writeSync.bind(stdout,)
    : undefined;
  return {
    isTerminal,
    write: writeSync === undefined ? undefined : (text: string,) => {
      writeSync(new TextEncoder().encode(text,),);
    },
  };
}

export class Log {
  static runtime: LogRuntime = detectLogRuntime();
  static level: number = 0;
  static stack: string[] = [];
  static segments: string[] = [];
  static silent: boolean = false;
  static progressPct: number = 0;
  static progressMeter: string = "";

  static enter(segment: string, message: string,): void {
    this.stack.push(segment,);
    this.segments.push(`${segment}: ${message}`,);
    if (this.level > 0) {
      const last = this.segments[this.segments.length - 1];
      if (last) {
        console.error(this.formatMessage(last,),);
      }
    }
  }

  static exit(segment: string, message?: string,): void {
    if (
      this.stack.length > 0 && this.stack[this.stack.length - 1] === segment
    ) {
      this.stack.pop();
    }
    if (message) {
      this.segments.push(`${segment}: ${message}`,);
      if (this.level > 0) {
        console.error(this.formatMessage(`${segment}: ${message}`,),);
      }
    }
  }

  static msg(block: () => string,): void {
    if (this.level > 0) {
      const result = block();
      console.error(this.formatMessage(result,),);
    }
  }

  static status(message: string,): void {
    if (this.level > 0) {
      console.error(this.formatMessage(message,),);
    }
  }

  static startProgressMeter(text: string,): void {
    if (!this.silent && this.runtime.isTerminal?.() === true) {
      this.progressMeter = text;
      this.runtime.write?.(
        `${this.formatMessage(`[${text}]`,)}\n`,
      );
    }
  }

  static stopProgressMeter(): void {
    if (this.progressMeter) {
      this.runtime.write?.(
        `${this.formatMessage(`[${this.progressMeter}] - concluído`,)}\n`,
      );
      this.progressMeter = "";
    }
  }

  static activity(): void {
    if (this.silent) return;
    this.progressPct = (this.progressPct + 1) % 100;
    if (this.runtime.isTerminal?.() === true) {
      this.runtime.write?.(`\rProgress: ${this.progressPct}%`,);
    }
  }

  static progress(percent: number,): void {
    this.progressPct = Math.max(0, Math.min(100, percent,),);
    if (this.runtime.isTerminal?.() === true) {
      this.runtime.write?.(`\rProgress: ${this.progressPct}%`,);
    }
  }

  static reset(): void {
    this.level = 0;
    this.stack = [];
    this.segments = [];
    this.silent = false;
    this.progressPct = 0;
    this.progressMeter = "";
  }

  private static formatMessage(message: string,): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${message}`;
  }
}
