export class Log {
  static level: number = 0;
  static stack: string[] = [];
  static segments: string[] = [];
  static silent: boolean = false;
  static progress: number = 0;
  static progressMeter: string = '';

  static enter(segment: string, message: string): void {
    this.stack.push(segment);
    this.segments.push(`${segment}: ${message}`);
    if (this.level > 0) {
      console.error(this.formatMessage(this.segments[this.segments.length - 1]));
    }
  }

  static exit(segment: string, message?: string): void {
    if (this.stack.length > 0 && this.stack[this.stack.length - 1] === segment) {
      this.stack.pop();
    }
    if (message) {
      this.segments.push(`${segment}: ${message}`);
      if (this.level > 0) {
        console.error(this.formatMessage(`${segment}: ${message}`));
      }
    }
  }

  static msg(block: () => string): void {
    if (this.level > 0) {
      const result = block();
      console.error(this.formatMessage(result));
    }
  }

  static status(message: string): void {
    if (this.level > 0) {
      console.error(this.formatMessage(message));
    }
  }

  static startProgressMeter(text: string): void {
    if (!this.silent && Deno?.stderr?.isTerminal()) {
      this.progressMeter = text;
      console.error(this.formatMessage(`[${text}]`));
    }
  }

  static stopProgressMeter(): void {
    if (this.progressMeter) {
      console.error(this.formatMessage(`[${this.progressMeter}] - concluído`));
      this.progressMeter = '';
    }
  }

  static activity(): void {
    if (this.silent) return;
    this.progress = (this.progress + 1) % 100;
    if (Deno?.stderr?.isTerminal()) {
      process.stdout.write(`\rProgress: ${this.progress}%`);
    }
  }

  static progress(percent: number): void {
    this.progress = Math.max(0, Math.min(100, percent));
    if (Deno?.stderr?.isTerminal()) {
      process.stdout.write(`\rProgress: ${this.progress}%`);
    }
  }

  static reset(): void {
    this.level = 0;
    this.stack = [];
    this.segments = [];
    this.silent = false;
    this.progress = 0;
    this.progressMeter = '';
  }

  private static formatMessage(message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${message}`;
  }
}
