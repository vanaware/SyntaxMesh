/**
 * Console command registration regressions (22.12.16). The real registrar runs
 * against fake command/context boundaries; no VS Code runtime is required.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import type { Disposable, } from "vscode";
import type { ConsoleAdapter, } from "../../src/commands/contracts.ts";
import {
  type CommandHandler,
  type CommandRegistrar,
  CommandRegistry,
} from "../../src/commands/registry.ts";
import { registerConsoleGroup, } from "../../src/console/register.ts";

/** One deferred open session used to prove the command awaits it. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done,) => {
    resolve = done;
  },);
  return { promise, resolve, };
}

/** Records public console-group registrations without owning adapter lifetime. */
function harness(): {
  adapter: ConsoleAdapter;
  registry: CommandRegistry;
  handlers: Map<string, CommandHandler>;
  registrations: Disposable[];
  openCalls: () => number;
  disposeCalls: () => number;
  setOpen: (handler: () => Promise<void>,) => void;
} {
  const handlers = new Map<string, CommandHandler>();
  const registrations: Disposable[] = [];
  let openCalls = 0;
  let disposeCalls = 0;
  let openHandler: () => Promise<void> = () => Promise.resolve();
  const adapter: ConsoleAdapter = {
    open: () => {
      openCalls++;
      return openHandler();
    },
    clear: () => {},
    dispose: () => {
      disposeCalls++;
    },
  };
  const registrar: CommandRegistrar = {
    registerCommand: (id, handler,) => {
      handlers.set(id, handler,);
      const disposable: Disposable = { dispose: () => {}, };
      registrations.push(disposable,);
      return disposable;
    },
  };
  const registry = new CommandRegistry(registrar,);
  registerConsoleGroup(registry, adapter,);
  return {
    adapter,
    registry,
    handlers,
    registrations,
    openCalls: () => openCalls,
    disposeCalls: () => disposeCalls,
    setOpen: (handler,) => {
      openHandler = handler;
    },
  };
}

describe("console command registration", () => {
  it("registers only the public open command without owning the adapter", () => {
    const h = harness();
    assertEquals([...h.handlers.keys(),], ["syntaxmesh.console.open",],);
    assertEquals(h.registry.disposables, h.registrations,);
    assertEquals(h.disposeCalls(), 0,);
  });

  it("awaits the adapter session when console.open is invoked", async () => {
    const h = harness();
    const session = deferred();
    h.setOpen(() => session.promise);
    let settled = false;
    const opening = (async () => {
      await h.handlers.get("syntaxmesh.console.open",)!();
      settled = true;
    })();
    assertEquals(h.openCalls(), 1,);
    assertEquals(settled, false,);
    session.resolve();
    await opening;
    assertEquals(settled, true,);
  });
});
