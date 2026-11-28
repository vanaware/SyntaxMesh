/**
 * Web input-console regressions (22.12.16). OutputChannel, input prompts and
 * untitled-document stdin are injected so the real adapter can be tested without
 * a browser or VS Code runtime.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, } from "@std/assert";
import type { CommandResult, } from "../../src/commands/contracts.ts";
import type { ConsoleCommandExecutor, } from "../../src/console/commands.ts";
import {
  type ConsoleStdinDocument,
  InputConsoleAdapter,
  type InputConsolePort,
} from "../../src/console/input-console.ts";

interface RecordedCall {
  id: string;
  args: unknown[];
}

type Responder = (
  id: string,
  args: unknown[],
) => unknown | Promise<unknown>;

/** One deferred command response used to prove sequential prompts. */
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

/** Fake OutputChannel with observable text and lifecycle effects. */
class FakeChannel {
  text = "";
  shown = 0;
  cleared = 0;
  disposed = 0;

  append(value: string,): void {
    this.text += value;
  }

  show(): void {
    this.shown++;
  }

  clear(): void {
    this.text = "";
    this.cleared++;
  }

  dispose(): void {
    this.disposed++;
  }
}

/** Host-owned untitled message document, matching VS Code's TextDocument API. */
class FakeStdinDocument {
  constructor(private readonly text: string,) {}

  getText(): string {
    return this.text;
  }
}

/** Builds one Web adapter with scripted input and a recording executor. */
function harness(
  input: Array<string | undefined | Promise<string | undefined>>,
  responder: Responder = () => ok([],),
  stdin: ConsoleStdinDocument | undefined = undefined,
): {
  adapter: InputConsoleAdapter;
  calls: RecordedCall[];
  channel: FakeChannel;
  prompts: string[];
  stdinDocuments: number;
} {
  const calls: RecordedCall[] = [];
  const prompts: string[] = [];
  let stdinDocuments = 0;
  const channel = new FakeChannel();
  const executor: ConsoleCommandExecutor = {
    async execute<T,>(id: string, ...args: unknown[]): Promise<T> {
      calls.push({ id, args, },);
      return await responder(id, args,) as T;
    },
  };
  const port: InputConsolePort = {
    createOutputChannel: () => channel,
    showInputBox: async (options,) => {
      prompts.push(options.prompt,);
      return await input.shift();
    },
    openStdinDocument: () => {
      stdinDocuments++;
      return Promise.resolve(stdin,);
    },
  };
  return {
    adapter: new InputConsoleAdapter({ executor, port, },),
    calls,
    channel,
    prompts,
    get stdinDocuments() {
      return stdinDocuments;
    },
  };
}

describe("Web input console", () => {
  it("shows help, prompts sequentially and appends command output", async () => {
    const h = harness(["project list", undefined,],);
    await h.adapter.open();
    assertEquals(h.channel.shown, 1,);
    assertEquals(h.prompts, ["SyntaxMesh>", "SyntaxMesh>",],);
    assertEquals(h.calls, [{
      id: "syntaxmesh.project.list",
      args: [],
    },],);
    assertStringIncludes(h.channel.text, "run, smx and tj3",);
    assertStringIncludes(h.channel.text, "No projects loaded.",);
    h.adapter.dispose();
  });

  it("shares one active prompt loop across duplicate open requests", async () => {
    const answer = deferred<string | undefined>();
    const h = harness([answer.promise,],);
    const opening = h.adapter.open();
    await settle();
    let duplicateSettled = false;
    const duplicateOpen = h.adapter.open().then(() => {
      duplicateSettled = true;
    },);
    await settle();
    assertEquals(duplicateSettled, false,);
    assertEquals(h.channel.shown, 1,);
    assertEquals(h.prompts, ["SyntaxMesh>",],);
    answer.resolve(undefined,);
    await Promise.all([opening, duplicateOpen,],);
    assertEquals(duplicateSettled, true,);
    assertEquals(h.channel.shown, 1,);
    assertEquals(h.prompts, ["SyntaxMesh>",],);
    h.adapter.dispose();
  });

  it("clears the channel locally without executing a command", async () => {
    const h = harness(["clear", undefined,],);
    await h.adapter.open();
    assertEquals(h.calls, [],);
    assertEquals(h.channel.cleared, 1,);
    assertEquals(h.channel.text, "",);
    h.adapter.dispose();
  });

  it("stops prompting on exit without executing a command", async () => {
    const h = harness(["exit", "project list", undefined,],);
    await h.adapter.open();
    assertEquals(h.prompts.length, 1,);
    assertEquals(h.calls, [],);
    h.adapter.dispose();
  });

  it("opens an untitled document for --from - and forwards its text", async () => {
    const document = new FakeStdinDocument("Subject: web\n\nbody\n",);
    const h = harness(
      ["run ts receive master.smx --from -", undefined,],
      () => ({ ok: false, error: "fixture stop", messages: [], }),
      document,
    );
    await h.adapter.open();
    const argv = ["ts", "receive", "master.smx", "--from", "-",];
    assertEquals(h.calls, [{
      id: "syntaxmesh.run",
      args: [argv, { stdin: "Subject: web\n\nbody\n", },],
    },],);
    assertEquals(h.stdinDocuments, 1,);
    h.adapter.dispose();
  });

  it("reports cancelled stdin collection and continues prompting", async () => {
    const h = harness(["run ts receive master.smx --from -", undefined,],);
    await h.adapter.open();
    assertEquals(h.calls, [],);
    assertEquals(h.stdinDocuments, 1,);
    assertEquals(h.prompts.length, 2,);
    assertStringIncludes(h.channel.text, "Stdin collection cancelled.",);
    h.adapter.dispose();
  });

  it("waits for each command before showing the next prompt", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const secondStarted = deferred<void>();
    let call = 0;
    const h = harness(
      ["project list", "project list", undefined,],
      () => {
        call++;
        if (call === 1) return first.promise;
        secondStarted.resolve();
        return second.promise;
      },
    );
    const opening = h.adapter.open();
    await settle();
    assertEquals(h.calls.length, 1,);
    assertEquals(h.prompts.length, 1,);
    first.resolve(ok([],),);
    await secondStarted.promise;
    await settle();
    assertEquals(h.calls.length, 2,);
    assertEquals(h.prompts.length, 2,);
    second.resolve(ok([],),);
    await opening;
    h.adapter.dispose();
  });

  it("prints parser errors and keeps accepting input", async () => {
    const h = harness(["not-a-command", "project list", undefined,],);
    await h.adapter.open();
    assertEquals(h.calls.length, 1,);
    assertStringIncludes(
      h.channel.text,
      "Error: unknown console command: not-a-command",
    );
    assertStringIncludes(h.channel.text, "No projects loaded.",);
    h.adapter.dispose();
  });

  it("disposes the channel idempotently and does not reopen", async () => {
    const h = harness([undefined,],);
    await h.adapter.open();
    h.adapter.dispose();
    h.adapter.dispose();
    await h.adapter.open();
    assertEquals(h.channel.disposed, 1,);
    assertEquals(h.channel.shown, 1,);
    assertEquals(h.prompts.length, 1,);
  });
});
