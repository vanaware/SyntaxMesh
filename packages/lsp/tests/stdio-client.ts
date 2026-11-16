/**
 * Reusable headless LSP client over stdio (F21², 26.29.1).
 *
 * Extracted from the 22.9.5 protocol smoke (`protocol_test.ts`) so the wave-2
 * integration suites can drive the **real** standalone server
 * (`packages/lsp/src/mod.ts --stdio`) without VS Code: Content-Length-framed
 * JSON-RPC requests/notifications, keeping notifications that arrive while
 * awaiting a response. The frame parser is strict — any byte on stdout that
 * is not a JSON-RPC frame fails (plan §7: stdout is the protocol channel,
 * logs go to stderr).
 *
 * This is a test helper (not `*test.ts`), so the gate does not collect it as
 * a suite; it lives in the transport package, where `Deno.Command`/stdio are
 * allowed (the `lsp-core` boundary stays pure).
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.29)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §4.2/§7
 */

/** Entry module of the server under test (source, not the bundle). */
export const SERVER = new URL("../src/mod.ts", import.meta.url,).pathname;

/** One JSON-RPC message (request, response or notification). */
export interface Message {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

/** Spawns the server with piped stdio for the framed session. */
export function spawnServer(args: string[],): Deno.ChildProcess {
  return new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--no-prompt",
      "--allow-read",
      "--allow-env",
      SERVER,
      ...args,
    ],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  },).spawn();
}

/** Runs the CLI to completion (no session) and collects its output. */
export function runCli(args: string[],): Promise<Deno.CommandOutput> {
  return new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--no-prompt",
      "--allow-read",
      "--allow-env",
      SERVER,
      ...args,
    ],
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  },).output();
}

/** Rejects after `ms` so a hung server can never hang the gate. */
export async function withTimeout<T,>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject,) => {
    timer = setTimeout(
      () => reject(new Error(`timeout waiting for ${label}`,),),
      ms,
    );
  },);
  try {
    return await Promise.race([promise, timeout,],);
  } finally {
    clearTimeout(timer,);
  }
}

/** Concatenates two byte chunks (the reader's accumulate step). */
function concat(a: Uint8Array, b: Uint8Array,): Uint8Array {
  const out = new Uint8Array(a.byteLength + b.byteLength,);
  out.set(a,);
  out.set(b, a.byteLength,);
  return out;
}

/** Index of the `\r\n\r\n` header terminator, or -1 when incomplete. */
function headerEnd(buffer: Uint8Array,): number {
  for (let i = 0; i + 3 < buffer.byteLength; i++) {
    if (
      buffer[i] === 13 && buffer[i + 1] === 10 && buffer[i + 2] === 13 &&
      buffer[i + 3] === 10
    ) {
      return i;
    }
  }
  return -1;
}

/** Encodes one message as a Content-Length-framed payload. */
function frame(message: Message,): Uint8Array {
  const body = new TextEncoder().encode(JSON.stringify(message,),);
  const header = new TextEncoder().encode(
    `Content-Length: ${body.byteLength}\r\n\r\n`,
  );
  return concat(header, body,);
}

/**
 * Minimal LSP client over the child's stdio: writes framed requests and
 * reads framed messages, keeping notifications that arrive while waiting
 * for a response.
 */
export class StdioClient {
  private buffer: Uint8Array = new Uint8Array(0,);
  private nextId = 1;
  private readonly reader: ReadableStreamDefaultReader<Uint8Array>;
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  /** Notifications received while awaiting responses. */
  readonly notifications: Message[] = [];

  constructor(private readonly child: Deno.ChildProcess,) {
    this.reader = child.stdout.getReader();
    this.writer = child.stdin.getWriter();
  }

  /** Sends a notification (no id, no response expected). */
  async notify(method: string, params: unknown,): Promise<void> {
    await this.writer.write(frame({ jsonrpc: "2.0", method, params, },),);
  }

  /** Sends a request and resolves with the matching response. */
  async request(method: string, params: unknown,): Promise<Message> {
    const id = this.nextId++;
    await this.writer.write(frame({ jsonrpc: "2.0", id, method, params, },),);
    for (;;) {
      const message = await this.read();
      if (message.id === id) return message;
      this.notifications.push(message,);
    }
  }

  /** Resolves with the next notification of the given method. */
  async notification(method: string,): Promise<Message> {
    for (;;) {
      const queued = this.notifications.findIndex((m,) => m.method === method);
      if (queued >= 0) return this.notifications.splice(queued, 1,)[0]!;
      const message = await this.read();
      if (message.method === method) return message;
      this.notifications.push(message,);
    }
  }

  /** Drains stdout to EOF; used to prove nothing follows the last frame. */
  async remaining(): Promise<Uint8Array> {
    for (;;) {
      const { value, done, } = await withTimeout(
        this.reader.read(),
        15_000,
        "stdout EOF",
      );
      if (done) return this.buffer;
      this.buffer = concat(this.buffer, value!,);
    }
  }

  /** Kills (if needed) and reaps the child, closing every pipe. */
  async close(): Promise<void> {
    try {
      this.child.kill("SIGKILL",);
    } catch {
      // Already exited — nothing to kill.
    }
    await this.child.status.catch(() => {},);
    await this.reader.cancel().catch(() => {},);
    await this.writer.close().catch(() => {},);
    await this.child.stderr.cancel().catch(() => {},);
  }

  /** Sends `shutdown` + `exit`; resolves with the server's exit code. */
  async shutdown(): Promise<number> {
    const response = await this.request("shutdown", null,);
    if (response.result !== null) {
      throw new Error("shutdown did not return null",);
    }
    await this.notify("exit", null,);
    const status = await withTimeout(this.child.status, 15_000, "server exit",);
    return status.code;
  }

  /** Reads the next framed message, accumulating chunks as needed. */
  private async read(): Promise<Message> {
    for (;;) {
      const parsed = this.tryParse();
      if (parsed !== null) return parsed;
      const { value, done, } = await withTimeout(
        this.reader.read(),
        30_000,
        "an LSP frame",
      );
      if (done) throw new Error("server closed stdout before a full frame",);
      this.buffer = concat(this.buffer, value!,);
    }
  }

  /** Parses one frame from the buffer; strict about the header format. */
  private tryParse(): Message | null {
    const sep = headerEnd(this.buffer,);
    if (sep < 0) return null;
    const header = new TextDecoder().decode(this.buffer.subarray(0, sep,),);
    const match = /^Content-Length: (\d+)$/im.exec(header,);
    if (match === null) {
      throw new Error(
        `stdout is not pure JSON-RPC: ${JSON.stringify(header,)}`,
      );
    }
    const length = Number.parseInt(match[1]!, 10,);
    const start = sep + 4;
    if (this.buffer.byteLength < start + length) return null;
    const body = new TextDecoder().decode(
      this.buffer.subarray(start, start + length,),
    );
    this.buffer = this.buffer.slice(start + length,);
    return JSON.parse(body,) as Message;
  }
}

/**
 * Opens a framed session: spawns `--stdio`, sends `initialize` +
 * `initialized`, and returns the client plus the negotiated capabilities.
 * The caller owns `client.close()` (use `try/finally`).
 */
export async function openSession(): Promise<{
  client: StdioClient;
  capabilities: Record<string, unknown>;
}> {
  const client = new StdioClient(spawnServer(["--stdio",],),);
  const init = await client.request("initialize", {
    processId: null,
    rootUri: null,
    capabilities: {},
  },);
  const capabilities = (init.result as {
    capabilities: Record<string, unknown>;
  }).capabilities;
  await client.notify("initialized", {},);
  return { client, capabilities, };
}

/** Sends `textDocument/didOpen` for one in-memory document. */
export async function didOpen(
  client: StdioClient,
  uri: string,
  text: string,
  version = 1,
): Promise<void> {
  await client.notify("textDocument/didOpen", {
    textDocument: { uri, languageId: "taskjuggler", version, text, },
  },);
}

/** Awaits the next `publishDiagnostics` and returns its params. */
export async function nextDiagnostics(
  client: StdioClient,
): Promise<{ uri: string; diagnostics: unknown[] }> {
  const message = await client.notification("textDocument/publishDiagnostics",);
  return message.params as { uri: string; diagnostics: unknown[] };
}
