import { Message, MessageType, } from "./message.ts";
import { SourceFileInfo, } from "./source-file-info.ts";
import { TjRuntimeError, } from "./model/errors.ts";
import { Scenario, } from "./model/scenario.ts";

export class MessageHandlerInstance {
  messages: Message[] = [];
  errors: number = 0;
  outputLevel: number = 2;
  logLevel: number = 2;
  logFile: string | null = null;
  hideScenario: boolean = false;
  abortOnWarning: boolean = false;
  baselineSFI: SourceFileInfo | null = null;
  trapSetup: boolean = false;

  private static _instance: MessageHandlerInstance | null = null;

  static get instance(): MessageHandlerInstance {
    if (!MessageHandlerInstance._instance) {
      MessageHandlerInstance._instance = new MessageHandlerInstance();
    }
    return MessageHandlerInstance._instance;
  }

  constructor() {
    if (MessageHandlerInstance._instance) {
      return MessageHandlerInstance._instance;
    }
    MessageHandlerInstance._instance = this;
  }

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

  error(
    id: string,
    message: string,
    sfi?: SourceFileInfo | null,
    line?: string | null,
    data?: unknown,
    scenario?: Scenario | null,
  ): never {
    this.addMessage("error", id, message, sfi, line, data, scenario,);
    this.errors++;
    throw new TjRuntimeError(`${id}: ${message}`,);
  }

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

  to_s(): string {
    return this.messages.map((m,) => m.to_s()).join("\n",);
  }
}
