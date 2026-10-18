import { Message } from "./message.ts";
import { SourceFileInfo } from "./source-file-info.ts";
import { TjRuntimeError } from "./model/errors.ts";
import { Scenario } from "./model/scenario.ts";

export class MessageHandlerInstance {
  static readonly instance = new MessageHandlerInstance();

  private messages: Message[] = [];
  private errors: number = 0;
  private outputLevel: number = 2;
  private logLevel: number = 2;
  private logFile: string | null = null;
  private hideScenario: boolean = false;
  private abortOnWarning: boolean = false;
  private baselineSFI: SourceFileInfo | null = null;
  private trapSetup: boolean = false;

  private constructor() {}

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

  clear(): void {
    this.messages = [];
    this.errors = 0;
  }

  fatal(id: string, message: string, sfi?: SourceFileInfo | null, line?: string | null, data?: unknown, scenario?: Scenario | null): never {
    this.addMessage('fatal', id, message, sfi, line, data, scenario);
    throw new TjRuntimeError(`${id}: ${message}`);
  }

  error(id: string, message: string, sfi?: SourceFileInfo | null, line?: string | null, data?: unknown, scenario?: Scenario | null): never {
    this.addMessage('error', id, message, sfi, line, data, scenario);
    this.errors++;
    if (this.trapSetup) {
      throw new TjRuntimeError(`${id}: ${message}`);
    }
    throw new TjRuntimeError(`${id}: ${message}`);
  }

  critical(id: string, message: string, sfi?: SourceFileInfo | null, line?: string | null, data?: unknown, scenario?: Scenario | null): void {
    this.addMessage('error', id, message, sfi, line, data, scenario);
    this.errors++;
  }

  warning(id: string, message: string, sfi?: SourceFileInfo | null, line?: string | null, data?: unknown, scenario?: Scenario | null): void {
    this.addMessage('warning', id, message, sfi, line, data, scenario);
    if (this.abortOnWarning) {
      throw new TjRuntimeError(`${id}: ${message}`);
    }
  }

  info(id: string, message: string, sfi?: SourceFileInfo | null, line?: string | null, data?: unknown, scenario?: Scenario | null): void {
    this.addMessage('info', id, message, sfi, line, data, scenario);
  }

  debug(id: string, message: string, sfi?: SourceFileInfo | null, line?: string | null, data?: unknown, scenario?: Scenario | null): void {
    this.addMessage('debug', id, message, sfi, line, data, scenario);
  }

  private addMessage(
    type: MessageType,
    id: string,
    message: string,
    sfi?: SourceFileInfo | null,
    line?: string | null,
    data?: unknown,
    scenario?: Scenario | null,
  ): void {
    const msg = new Message(type, id, message, sfi, line, data, scenario);
    this.messages.push(msg);
  }

  to_s(): string {
    return this.messages.map(m => m.to_s()).join('\n');
  }

  get baselineSFI(): SourceFileInfo | null {
    return this.baselineSFI;
  }

  set baselineSFI(value: SourceFileInfo | null) {
    this.baselineSFI = value;
  }

  get trapSetup(): boolean {
    return this.trapSetup;
  }

  set trapSetup(value: boolean) {
    this.trapSetup = value;
  }
}
