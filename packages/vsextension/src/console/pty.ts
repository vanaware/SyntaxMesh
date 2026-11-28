/**
 * Desktop pseudo-terminal console adapter (22.12.16).
 *
 * The session owns only terminal state: line editing, sequential dispatch,
 * multiline stdin collection and lifecycle events. Command parsing and result
 * formatting remain in the shared pure console core.
 */
import { EventEmitter, } from "node:events";
import type {
  Disposable,
  Event,
  Pseudoterminal,
  Terminal,
  TerminalDimensions,
} from "vscode";
import type { ConsoleAdapter, } from "../commands/contracts.ts";
import {
  type ConsoleCommandExecutor,
  dispatchConsoleRequest,
} from "./commands.ts";
import { type ConsoleRequest, parseConsoleLine, } from "./parser.ts";

/** Desktop terminal boundary injected by the extension activation. */
export interface PtyConsolePort {
  executor: ConsoleCommandExecutor;
  createTerminal(pty: Pseudoterminal,): Terminal;
}

/** Adapts one Node event emitter to the VS Code disposable event contract. */
function terminalEvent<T,>(
  emitter: EventEmitter<Record<string, [value: T,]>>,
  name: string,
): Event<T> {
  return (listener, thisArgs, disposables,) => {
    const bound = thisArgs === undefined ? listener : listener.bind(thisArgs,);
    emitter.on(name, bound,);
    const disposable: Disposable = {
      dispose: () => emitter.off(name, bound,),
    };
    disposables?.push(disposable,);
    return disposable;
  };
}

/** Whether one CLI-compatible argv requests standard input from `-`. */
function needsStdin(argv: readonly string[],): boolean {
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--from" && argv[index + 1] === "-") return true;
    if (argv[index] === "--from=-") return true;
  }
  return false;
}

/** One stateful Desktop terminal session. */
class PtyConsoleSession implements Pseudoterminal {
  readonly onDidWrite: Event<string>;
  readonly onDidClose: Event<void | number>;
  private readonly writeEmitter = new EventEmitter<
    Record<string, [value: string,]>
  >();
  private readonly closeEmitter = new EventEmitter<
    Record<string, [value: void | number,]>
  >();
  private readonly queue: Array<() => Promise<void>> = [];
  private line = "";
  private stdinBuffer: string | null = null;
  private pendingRun: Extract<ConsoleRequest, { kind: "run" }> | null = null;
  private skipLineFeed = false;
  private processing = false;
  private closed = false;

  constructor(private readonly executor: ConsoleCommandExecutor,) {
    this.onDidWrite = terminalEvent(this.writeEmitter, "write",);
    this.onDidClose = terminalEvent(this.closeEmitter, "close",);
  }

  /** Whether this session has closed and can no longer accept input. */
  get isClosed(): boolean {
    return this.closed;
  }

  /** Prints the console introduction when VS Code opens the terminal. */
  open(_initialDimensions: TerminalDimensions | undefined,): void {
    if (this.closed) return;
    this.writeText(
      "SyntaxMesh console\r\n" +
        "Commands: project, report, compile, help, exit.\r\n" +
        "CLI-compatible prefixes: run, smx and tj3.\r\n",
    );
    this.prompt();
  }

  /** Closes the terminal once and releases queued input. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.queue.length = 0;
    this.line = "";
    this.stdinBuffer = null;
    this.pendingRun = null;
    this.closeEmitter.emit("close", undefined,);
  }

  /** Handles editing, command submission and Ctrl+D stdin collection. */
  handleInput(data: string,): void {
    if (this.closed) return;
    for (const character of data) {
      if (this.skipLineFeed) {
        this.skipLineFeed = false;
        if (character === "\n") continue;
      }
      if (character === "\r") {
        this.skipLineFeed = true;
        this.completeLine();
      } else if (character === "\n") {
        this.completeLine();
      } else if (character === "\x7f" || character === "\b") {
        if (this.line !== "") {
          this.line = this.line.slice(0, -1,);
          this.write("\b \b",);
        }
      } else if (character === "\x04") {
        this.completeStdin();
      } else {
        this.line += character;
        this.write(character,);
      }
    }
  }

  /** Clears the terminal and restores the prompt. */
  clear(): void {
    if (this.closed) return;
    this.write("\x1b[2J\x1b[H",);
    this.prompt();
  }

  /** Closes the session and removes all event listeners. */
  dispose(): void {
    this.close();
    this.writeEmitter.removeAllListeners();
    this.closeEmitter.removeAllListeners();
  }

  /** Completes one command line or one stdin line. */
  private completeLine(): void {
    const line = this.line;
    this.line = "";
    this.write("\r\n",);
    if (this.stdinBuffer !== null) {
      this.stdinBuffer += `${line}\n`;
      return;
    }
    if (line === "") {
      this.prompt();
      return;
    }
    this.enqueue(() => this.processLine(line,));
  }

  /** Finishes Ctrl+D stdin collection and queues the pending run request. */
  private completeStdin(): void {
    if (this.stdinBuffer === null || this.pendingRun === null) return;
    const request = this.pendingRun;
    const stdin = this.stdinBuffer + this.line;
    this.line = "";
    this.stdinBuffer = null;
    this.pendingRun = null;
    this.write("\r\n",);
    this.enqueue(() => this.dispatchAndPrompt({ ...request, stdin, },));
  }

  /** Queues one asynchronous session action. */
  private enqueue(action: () => Promise<void>,): void {
    this.queue.push(action,);
    if (this.processing) return;
    this.processing = true;
    void this.drain();
  }

  /** Executes queued actions one at a time until the session closes. */
  private async drain(): Promise<void> {
    try {
      while (!this.closed && this.queue.length > 0) {
        const action = this.queue.shift();
        if (action !== undefined) await action();
      }
    } finally {
      this.processing = false;
    }
  }

  /** Parses one line and either starts stdin collection or dispatches it. */
  private async processLine(line: string,): Promise<void> {
    const parsed = parseConsoleLine(line,);
    if (!parsed.ok) {
      this.writeText(`Error: ${parsed.error}\r\n`,);
      this.prompt();
      return;
    }
    const request = parsed.value;
    if (request.kind === "run" && needsStdin(request.argv,)) {
      this.pendingRun = request;
      this.stdinBuffer = "";
      this.writeText("Stdin: finish with Ctrl+D.\r\n",);
      return;
    }
    await this.dispatchAndPrompt(request,);
  }

  /** Dispatches one request and renders its shared console result. */
  private async dispatchAndPrompt(request: ConsoleRequest,): Promise<void> {
    const result = await dispatchConsoleRequest(request, this.executor,);
    if (this.closed) return;
    if (result.kind === "clear") {
      this.clear();
      return;
    }
    if (result.kind === "exit") {
      this.close();
      return;
    }
    this.writeText(result.text,);
    this.prompt();
  }

  /** Restores the command prompt after input or output. */
  private prompt(): void {
    if (!this.closed) this.write("syntaxmesh> ",);
  }

  /** Writes text with terminal-safe CRLF line endings. */
  private writeText(text: string,): void {
    this.write(text.replace(/\r?\n/g, "\r\n",),);
  }

  /** Emits one terminal write. */
  private write(text: string,): void {
    if (!this.closed) this.writeEmitter.emit("write", text,);
  }
}

/** Desktop console adapter backed by one VS Code pseudo-terminal. */
export class PtyConsoleAdapter implements ConsoleAdapter {
  private readonly executor: ConsoleCommandExecutor;
  private readonly createTerminal: (pty: Pseudoterminal,) => Terminal;
  private session: PtyConsoleSession | undefined;
  private terminal: Terminal | undefined;
  private disposed = false;

  constructor(port: PtyConsolePort,) {
    this.executor = port.executor;
    this.createTerminal = port.createTerminal;
  }

  /** Creates the terminal once and shows it on every open request. */
  open(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    if (this.terminal === undefined || this.session?.isClosed === true) {
      this.session?.dispose();
      this.terminal?.dispose();
      this.session = new PtyConsoleSession(this.executor,);
      this.terminal = this.createTerminal(this.session,);
    }
    this.terminal.show();
    return Promise.resolve();
  }

  /** Clears the active terminal without dispatching a command. */
  clear(): void {
    this.session?.clear();
  }

  /** Disposes the terminal and session once. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.session?.dispose();
    this.terminal?.dispose();
    this.session = undefined;
    this.terminal = undefined;
  }
}
