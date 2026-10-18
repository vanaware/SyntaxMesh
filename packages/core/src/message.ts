import { SourceFileInfo } from "./source-file-info.ts";
import { TjRuntimeError } from "./model/errors.ts";
import { Scenario } from "./model/scenario.ts";

export type MessageType = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

export class Message {
  readonly type: MessageType;
  readonly id: string;
  readonly message: string;
  sourceFileInfo: SourceFileInfo | null;
  readonly line: string | null;
  readonly data: unknown;
  readonly scenario: Scenario | null;

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

  to_s(): string {
    const colorCodes = {
      fatal: '\x1b[31m',
      error: '\x1b[31m',
      warning: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[90m',
    };
    const reset = '\x1b[0m';
    const color = colorCodes[this.type] || '';
    let result = `${color}${this.id}: ${this.message}${reset}`;
    if (this.sourceFileInfo) {
      result += ` [${this.sourceFileInfo.to_s()}]`;
    }
    return result;
  }

  to_log(): string {
    return `${this.type.toUpperCase()}: ${this.id}: ${this.message}`;
  }
}
