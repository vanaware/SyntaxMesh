/**
 * Real stdio protocol smoke of the standalone LSP server (22.9.5) — the P6
 * exit criterion: an external editor can drive the server without VS Code.
 *
 * Spawns `deno run src/mod.ts --stdio` and speaks Content-Length-framed
 * JSON-RPC: initialize → capabilities, didOpen → publishDiagnostics, hover,
 * shutdown/exit. The frame parser is strict: any byte on stdout that is not
 * a JSON-RPC frame fails the test (plan §7 — stdout is the protocol channel,
 * logs go to stderr).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §4.2/§7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.9.5
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { APP_VERSION, } from "@vanaware/syntaxmesh/version";

/** Entry module of the server under test (source, not the bundle). */
const SERVER = new URL("../src/mod.ts", import.meta.url,).pathname;
/** Document URI used by the session (in-memory; no file is read). */
const URI = "file:///protocol.tjp";
/** Same realistic fixture as the lsp-core smoke (22.1.16). */
const TEXT = `project prj "Protocol" "1.0" 2026-01-01 - 2026-12-31 {
}
resource dev "Developer" {
}
task build "Build" {
  effort 5d
  allocate dev
}
task ship "Ship" {
  depends build
}
`;

/** One JSON-RPC message (request, response or notification). */
interface Message {
  jsonrpc?: string;
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

/** Spawns the server with piped stdio for the framed session. */
function spawnServer(args: string[],): Deno.ChildProcess {
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
function runCli(args: string[],): Promise<Deno.CommandOutput> {
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
async function withTimeout<T,>(
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
class StdioClient {
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

describe("standalone LSP protocol over stdio (22.9.5)", () => {
  it("prints usage on --help and exits 0", async () => {
    const out = await withTimeout(runCli(["--help",],), 30_000, "--help",);
    assertEquals(out.code, 0,);
    assertStringIncludes(new TextDecoder().decode(out.stdout,), "--stdio",);
  });

  it("rejects unknown flags on stderr with exit 1 and empty stdout", async () => {
    const out = await withTimeout(runCli(["--bogus",],), 30_000, "--bogus",);
    assertEquals(out.code, 1,);
    assertEquals(new TextDecoder().decode(out.stdout,), "",);
    assertStringIncludes(new TextDecoder().decode(out.stderr,), "--bogus",);
  });

  it("prints the version banner on --version and exits 0", async () => {
    const out = await withTimeout(
      runCli(["--version",],),
      30_000,
      "--version",
    );
    assertEquals(out.code, 0,);
    // Same source as the CLI banner: APP_VERSION is build-injected and ""
    // from source — the assertion never hardcodes a version (22.10.1).
    assertEquals(
      new TextDecoder().decode(out.stdout,),
      `SyntaxMesh language server ${APP_VERSION}\n`,
    );
    assertEquals(new TextDecoder().decode(out.stderr,), "",);
  });

  it("serves initialize → didOpen → hover → shutdown/exit", async () => {
    const child = spawnServer(["--stdio",],);
    const client = new StdioClient(child,);
    try {
      // initialize: the §5 capabilities contract, over the real transport.
      const init = await client.request("initialize", {
        processId: null,
        rootUri: null,
        capabilities: {},
      },);
      const caps = (init.result as {
        capabilities: Record<string, unknown>;
      }).capabilities;
      assertEquals(caps["textDocumentSync"], 2,);
      assertEquals(caps["hoverProvider"], true,);
      assertEquals(caps["definitionProvider"], true,);
      assert(caps["semanticTokensProvider"] !== undefined,);

      // didOpen of a valid project publishes empty diagnostics.
      await client.notify("initialized", {},);
      await client.notify("textDocument/didOpen", {
        textDocument: {
          uri: URI,
          languageId: "taskjuggler",
          version: 1,
          text: TEXT,
        },
      },);
      const diag = await client.notification(
        "textDocument/publishDiagnostics",
      );
      const diagParams = diag.params as { uri: string; diagnostics: unknown[] };
      assertEquals(diagParams.uri, URI,);
      assertEquals(diagParams.diagnostics, [],);

      // hover over the `task` keyword (line 4, column 1) → Markdown.
      const hover = await client.request("textDocument/hover", {
        textDocument: { uri: URI, },
        position: { line: 4, character: 1, },
      },);
      const hoverResult = hover.result as {
        contents: { kind: string; value: string };
      } | null;
      assert(hoverResult !== null,);
      assertEquals(hoverResult!.contents.kind, "markdown",);

      // shutdown/exit: a well-behaved server leaves with code 0.
      const shutdown = await client.request("shutdown", null,);
      assertEquals(shutdown.result, null,);
      await client.notify("exit", null,);
      const status = await withTimeout(child.status, 15_000, "server exit",);
      assertEquals(status.code, 0,);

      // stdout carried nothing but frames: no trailing log byte.
      assertEquals((await client.remaining()).byteLength, 0,);
    } finally {
      await client.close();
    }
  });
});
