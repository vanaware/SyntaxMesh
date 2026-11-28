/**
 * Desktop pseudo-terminal state regressions (22.12.16). The real session and
 * dispatcher run against fake terminal/command boundaries; no VS Code host is
 * required.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import type { Pseudoterminal, Terminal, } from "vscode";
import type { CommandResult, } from "../../src/commands/contracts.ts";
import type { ConsoleCommandExecutor, } from "../../src/console/commands.ts";
import { PtyConsoleAdapter, } from "../../src/console/pty.ts";

interface RecordedCall {
  id: string;
  args: unknown[];
}

type Responder = (
  id: string,
  args: unknown[],
) => unknown | Promise<unknown>;

/** One deferred command response used to prove sequential dispatch. */
function deferred<T,>(): {
  promise: Promise<T>;
  resolve: (value: T,) => void;
} {
  let resolve!: (value: T,) => void;
  const promise = new Promise<T>((done,) => {
    resolve = done;
  },);
  return { promise, resolve, };
}

/** Wraps a raw utility value in the canonical command contract. */
function ok<T,>(value: T,): CommandResult<T> {
  return { ok: true, value, messages: [], };
}

/** Drains the promise queue without relying on timers. */
async function settle(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

/** Builds one adapter with a recording executor and fake VS Code terminal. */
function harness(responder: Responder = () => ok([],),): {
  adapter: PtyConsoleAdapter;
  calls: RecordedCall[];
  writes: string[];
  terminal: Terminal;
  pty: () => Pseudoterminal;
} {
  const calls: RecordedCall[] = [];
  const writes: string[] = [];
  let currentPty: Pseudoterminal | undefined;
  const executor: ConsoleCommandExecutor = {
    async execute<T,>(id: string, ...args: unknown[]): Promise<T> {
      calls.push({ id, args, },);
      return await responder(id, args,) as T;
    },
  };
  const terminal = {
    show: () => {},
    dispose: () => {},
  } as unknown as Terminal;
  const adapter = new PtyConsoleAdapter({
    executor,
    createTerminal: (pty,): Terminal => {
      currentPty = pty;
      return terminal;
    },
  },);
  return {
    adapter,
    calls,
    writes,
    terminal,
    pty: () => {
      assert(currentPty !== undefined, "terminal has not been created",);
      return currentPty;
    },
  };
}

describe("Desktop pseudo-terminal", () => {
  it("opens one terminal and prints help plus equivalent run prefixes", async () => {
    const h = harness();
    let shown = 0;
    h.terminal.show = () => {
      shown++;
    };
    await h.adapter.open();
    await h.adapter.open();
    const pty = h.pty();
    pty.onDidWrite((text,) => h.writes.push(text,));
    pty.open(undefined,);
    assertEquals(shown, 2,);
    const text = h.writes.join("",);
    assertStringIncludes(text, "SyntaxMesh console",);
    assertStringIncludes(text, "run, smx and tj3",);
    assertStringIncludes(text, "syntaxmesh>",);
    h.adapter.dispose();
  });

  it("edits the line buffer and dispatches enter exactly once", async () => {
    const h = harness();
    await h.adapter.open();
    const pty = h.pty();
    pty.onDidWrite((text,) => h.writes.push(text,));
    pty.open(undefined,);
    h.writes.length = 0;
    pty.handleInput?.("project l\x7flist\r",);
    await settle();
    assertEquals(h.calls, [{
      id: "syntaxmesh.project.list",
      args: [],
    },],);
    assertStringIncludes(h.writes.join("",), "No projects loaded.",);
    assertStringIncludes(h.writes.join("",), "syntaxmesh>",);
    h.adapter.dispose();
  });

  it("queues input while a previous command is still running", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const secondStarted = deferred<void>();
    let call = 0;
    const h = harness(() => {
      call++;
      if (call === 1) return first.promise;
      secondStarted.resolve();
      return second.promise;
    },);
    await h.adapter.open();
    const pty = h.pty();
    pty.open(undefined,);
    pty.handleInput?.("project list\rproject list\r",);
    await settle();
    assertEquals(h.calls.length, 1,);
    first.resolve(ok([],),);
    await secondStarted.promise;
    assertEquals(h.calls.length, 2,);
    second.resolve(ok([],),);
    await settle();
    h.adapter.dispose();
  });

  it("clears the terminal without executing a command", async () => {
    const h = harness();
    await h.adapter.open();
    const pty = h.pty();
    pty.onDidWrite((text,) => h.writes.push(text,));
    pty.open(undefined,);
    h.writes.length = 0;
    h.adapter.clear();
    assertEquals(h.calls, [],);
    assertStringIncludes(h.writes.join("",), "\x1b[2J\x1b[H",);
    h.adapter.dispose();
  });

  it("closes on exit and ignores later input", async () => {
    const h = harness();
    let closes = 0;
    await h.adapter.open();
    const pty = h.pty();
    pty.onDidClose?.(() => {
      closes++;
    },);
    pty.open(undefined,);
    pty.handleInput?.("exit\rproject list\r",);
    await settle();
    assertEquals(closes, 1,);
    assertEquals(h.calls, [],);
    h.adapter.dispose();
  });

  it("collects multiline stdin until Ctrl+D and forwards it to run", async () => {
    const h = harness(() => ({
      ok: false,
      error: "expected fixture stop",
      messages: [],
    }));
    await h.adapter.open();
    const pty = h.pty();
    pty.open(undefined,);
    const argv = ["ts", "receive", "master.smx", "--from", "-",];
    pty.handleInput?.(`run ${argv.join(" ",)}\r`,);
    await settle();
    assertEquals(h.calls, [],);
    pty.handleInput?.("Subject: fixture\r\n\r\nbody\r\n\x04",);
    await settle();
    assertEquals(h.calls, [{
      id: "syntaxmesh.run",
      args: [argv, { stdin: "Subject: fixture\n\nbody\n", },],
    },],);
    h.adapter.dispose();
  });

  it("includes an unterminated final stdin line on Ctrl+D", async () => {
    const h = harness();
    await h.adapter.open();
    const pty = h.pty();
    pty.open(undefined,);
    const argv = ["ts", "receive", "master.smx", "--from", "-",];
    pty.handleInput?.(`run ${argv.join(" ",)}\r`,);
    await settle();
    pty.handleInput?.("Subject: fixture\r\n\r\nbody\x04",);
    await settle();
    assertEquals(h.calls, [{
      id: "syntaxmesh.run",
      args: [argv, { stdin: "Subject: fixture\n\nbody", },],
    },],);
    h.adapter.dispose();
  });

  it("prints parser errors without calling the executor", async () => {
    const h = harness();
    const writes: string[] = [];
    await h.adapter.open();
    const pty = h.pty();
    pty.onDidWrite((text,) => writes.push(text,));
    pty.open(undefined,);
    writes.length = 0;
    pty.handleInput?.("syntaxmesh.anything.goes\r",);
    await settle();
    assertEquals(h.calls, [],);
    assertStringIncludes(
      writes.join("",),
      "Error: console input cannot be used as a command id",
    );
    h.adapter.dispose();
  });

  it("disposes the terminal and session idempotently", async () => {
    const h = harness();
    let terminalDisposals = 0;
    h.terminal.dispose = () => {
      terminalDisposals++;
    };
    await h.adapter.open();
    const pty = h.pty();
    let closes = 0;
    pty.onDidClose?.(() => {
      closes++;
    },);
    pty.open(undefined,);
    h.adapter.dispose();
    h.adapter.dispose();
    assertEquals(terminalDisposals, 1,);
    assertEquals(closes, 1,);
    await h.adapter.open();
    assertEquals(terminalDisposals, 1,);
  });
});
