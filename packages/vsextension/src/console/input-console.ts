/**
 * Browser-safe input-console adapter (22.12.16).
 *
 * The Web host has no pseudo-terminal. This adapter uses an OutputChannel plus
 * sequential input prompts and an untitled document for `--from -`, while all
 * parsing, dispatch and formatting stay in the shared pure console core.
 */
import type { InputBoxOptions, OutputChannel, TextDocument, } from "vscode";
import type { ConsoleAdapter, } from "../commands/contracts.ts";
import {
  type ConsoleCommandExecutor,
  dispatchConsoleRequest,
} from "./commands.ts";
import { type ConsoleRequest, parseConsoleLine, } from "./parser.ts";

/** Minimal OutputChannel surface used by the Web console. */
export type ConsoleOutputChannel = Pick<
  OutputChannel,
  "append" | "clear" | "show" | "dispose"
>;

/** Host-owned untitled document used for stdin collection. */
export type ConsoleStdinDocument = Pick<TextDocument, "getText">;

/** Browser I/O boundary injected by the Web extension activation. */
export interface InputConsolePort {
  createOutputChannel(): ConsoleOutputChannel;
  showInputBox(
    options: Required<Pick<InputBoxOptions, "prompt">>,
  ): Promise<string | undefined>;
  openStdinDocument(): Promise<ConsoleStdinDocument | undefined>;
}

/** Whether one CLI-compatible argv requests standard input from `-`. */
function needsStdin(argv: readonly string[],): boolean {
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--from" && argv[index + 1] === "-") return true;
    if (argv[index] === "--from=-") return true;
  }
  return false;
}

/** Web console adapter with one sequential prompt loop. */
export class InputConsoleAdapter implements ConsoleAdapter {
  private readonly executor: ConsoleCommandExecutor;
  private readonly port: InputConsolePort;
  private channel: ConsoleOutputChannel | undefined;
  private opening: Promise<void> | undefined;
  private disposed = false;

  constructor(port: {
    executor: ConsoleCommandExecutor;
    port: InputConsolePort;
  },) {
    this.executor = port.executor;
    this.port = port.port;
  }

  /** Starts one prompt loop; concurrent open requests share that loop. */
  async open(): Promise<void> {
    if (this.disposed) return;
    if (this.opening !== undefined) {
      await this.opening;
      return;
    }
    const channel = this.outputChannel();
    channel.show();
    channel.append(
      "SyntaxMesh console\n" +
        "Commands: project, report, compile, help, exit.\n" +
        "CLI-compatible prefixes: run, smx and tj3.\n",
    );
    const opening = this.promptLoop(channel,);
    this.opening = opening;
    try {
      await opening;
    } finally {
      if (this.opening === opening) this.opening = undefined;
    }
  }

  /** Clears the Web output channel without dispatching a command. */
  clear(): void {
    this.channel?.clear();
  }

  /** Disposes the output channel once and prevents reopening. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.channel?.dispose();
    this.channel = undefined;
  }

  /** Creates the output channel lazily on the first open request. */
  private outputChannel(): ConsoleOutputChannel {
    if (this.channel === undefined) {
      this.channel = this.port.createOutputChannel();
    }
    return this.channel;
  }

  /** Prompts, dispatches and waits before showing the next prompt. */
  private async promptLoop(channel: ConsoleOutputChannel,): Promise<void> {
    while (!this.disposed) {
      const input = await this.port.showInputBox({ prompt: "SyntaxMesh>", },);
      if (this.disposed || input === undefined) return;
      const parsed = parseConsoleLine(input,);
      if (!parsed.ok) {
        channel.append(`Error: ${parsed.error}\n`,);
        continue;
      }
      const request = parsed.value;
      if (request.kind === "exit") return;
      if (request.kind === "clear") {
        channel.clear();
        continue;
      }
      const hydrated = await this.collectStdin(request, channel,);
      if (this.disposed || hydrated === undefined) return;
      if (hydrated === null) continue;
      const result = await dispatchConsoleRequest(hydrated, this.executor,);
      if (this.disposed) return;
      if (result.kind === "exit") return;
      if (result.kind === "clear") channel.clear();
      else channel.append(result.text,);
    }
  }

  /** Opens an untitled document when a run request needs stdin. */
  private async collectStdin(
    request: ConsoleRequest,
    channel: ConsoleOutputChannel,
  ): Promise<ConsoleRequest | null | undefined> {
    if (request.kind !== "run" || !needsStdin(request.argv,)) return request;
    const document = await this.port.openStdinDocument();
    if (this.disposed) return undefined;
    if (document === undefined) {
      channel.append("Stdin collection cancelled.\n",);
      return null;
    }
    return { ...request, stdin: document.getText(), };
  }
}
