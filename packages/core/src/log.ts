export class Log {
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
    if (!this.silent && Deno?.stderr?.isTerminal()) {
      this.progressMeter = text;
      console.error(this.formatMessage(`[${text}]`,),);
    }
  }

  static stopProgressMeter(): void {
    if (this.progressMeter) {
      console.error(
        this.formatMessage(`[${this.progressMeter}] - concluído`,),
      );
      this.progressMeter = "";
    }
  }

  static activity(): void {
    if (this.silent) return;
    this.progressPct = (this.progressPct + 1) % 100;
    if (Deno?.stderr?.isTerminal()) {
      Deno.stdout.writeSync(
        new TextEncoder().encode(`\rProgress: ${this.progressPct}%`,),
      );
    }
  }

  static progress(percent: number,): void {
    this.progressPct = Math.max(0, Math.min(100, percent,),);
    if (Deno?.stderr?.isTerminal()) {
      Deno.stdout.writeSync(
        new TextEncoder().encode(`\rProgress: ${this.progressPct}%`,),
      );
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
