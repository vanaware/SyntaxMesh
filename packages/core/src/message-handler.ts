import { Message, MessageType, } from "./message.ts";
import { SourceFileInfo, } from "./source-file-info.ts";
import { TjArgumentError, TjRuntimeError, } from "./model/errors.ts";
import { Scenario, } from "./model/scenario.ts";

/**
 * Níveis de log — espelho de `MessageHandler::LogLevels` (l.121-122). Note que
 * `error` e `critical` compartilham o nível 2.
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

export type LogLevelName = keyof typeof LOG_LEVELS;

export class MessageHandlerInstance {
  messages: Message[] = [];
  errors: number = 0;
  logFile: string | null = null;
  hideScenario: boolean = false;
  abortOnWarning: boolean = false;
  baselineSFI: SourceFileInfo | null = null;
  trapSetup: boolean = false;

  private _outputLevel: number = 2;
  private _logLevel: number = 2;

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

  /** Nível de mensagens escritas no console (Ruby `outputLevel`, l.175). */
  get outputLevel(): number {
    return this._outputLevel;
  }

  set outputLevel(level: number | LogLevelName,) {
    this._outputLevel = this.checkLevel(level,);
  }

  /** Nível de mensagens escritas no arquivo de log (Ruby `logLevel`, l.180). */
  get logLevel(): number {
    return this._logLevel;
  }

  set logLevel(level: number | LogLevelName,) {
    this._logLevel = this.checkLevel(level,);
  }

  /**
   * Valida um nível — espelho de `MessageHandler#checkLevel` (l.233-245).
   *
   * Aceita inteiro em `0..5` ou um nome de `LogLevels`. Fora disso lança
   * `TjArgumentError` com a redação do Ruby (`ArgumentError` l.236/240): para
   * inteiro fora da faixa a mensagem traz o número; para nome desconhecido o
   * Ruby sobrescreve `level` com `nil` na atribuição do `unless`, então a
   * mensagem sai sem o valor.
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
