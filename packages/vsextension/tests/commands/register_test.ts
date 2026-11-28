/**
 * Shared command-registration regressions (22.12.19). The real registry and
 * compatibility-alias registrar run against fake command boundaries; no VS Code
 * runtime is required.
 */
import { describe, it, } from "@std/testing/bdd";
import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import type { Disposable, } from "vscode";
import {
  LEGACY_COMMAND_IDS,
  PUBLIC_COMMAND_IDS,
} from "../../src/commands/contracts.ts";
import {
  type CommandExecutor,
  LEGACY_COMMAND_ALIASES,
  registerLegacyAliases,
} from "../../src/commands/aliases.ts";
import {
  type CommandHandler,
  type CommandRegistrar,
  CommandRegistry,
} from "../../src/commands/registry.ts";
import {
  type CommandGroups,
  registerCommandSet,
} from "../../src/commands/registration-core.ts";

/** Records command handlers and returns one disposable per registration. */
function registrar(): {
  registrar: CommandRegistrar;
  handlers: Map<string, CommandHandler>;
  disposables: Disposable[];
} {
  const handlers = new Map<string, CommandHandler>();
  const disposables: Disposable[] = [];
  return {
    handlers,
    disposables,
    registrar: {
      registerCommand: (id, handler,) => {
        if (handlers.has(id,)) throw new Error(`duplicate fixture id: ${id}`,);
        handlers.set(id, handler,);
        const disposable: Disposable = { dispose: () => {}, };
        disposables.push(disposable,);
        return disposable;
      },
    },
  };
}

/** Invokes a recorded handler through its runtime argument shape. */
async function invoke(
  handler: CommandHandler | undefined,
  ...args: unknown[]
): Promise<unknown> {
  assert(handler !== undefined, "command handler was not registered",);
  return await (handler as (...args: unknown[]) => unknown)(...args,);
}

describe("shared command registry", () => {
  it("registers each id once and owns the returned disposable", () => {
    const host = registrar();
    const registry = new CommandRegistry(host.registrar,);
    const disposable = registry.register("syntaxmesh.test", () => "ok",);

    assertEquals([...host.handlers.keys(),], ["syntaxmesh.test",],);
    assertStrictEquals(host.disposables[0], disposable,);
    assertEquals(registry.ids, ["syntaxmesh.test",],);
  });

  it("rejects a duplicate registration before calling the host", () => {
    const host = registrar();
    const registry = new CommandRegistry(host.registrar,);
    registry.register("syntaxmesh.test", () => "first",);

    assertThrows(
      () => registry.register("syntaxmesh.test", () => "second",),
      Error,
      "duplicate command registration: syntaxmesh.test",
    );
    assertEquals(host.disposables.length, 1,);
  });

  it("requires the exact public command set after shared registration", () => {
    const host = registrar();
    const registry = new CommandRegistry(host.registrar,);
    registry.register("syntaxmesh.public", () => undefined,);

    assertThrows(
      () => registry.assertExact(["syntaxmesh.public", "syntaxmesh.missing",],),
      Error,
      "missing command registrations: syntaxmesh.missing",
    );
    assertThrows(
      () => registry.assertExact([],),
      Error,
      "unexpected command registrations: syntaxmesh.public",
    );
  });
});

describe("legacy command aliases", () => {
  it("maps every legacy id to one canonical public id", () => {
    assertEquals(LEGACY_COMMAND_ALIASES, {
      "syntaxmesh.addProject": "syntaxmesh.project.add",
      "syntaxmesh.reloadProject": "syntaxmesh.project.refresh",
      "syntaxmesh.removeProject": "syntaxmesh.project.remove",
      "syntaxmesh.listProjects": "syntaxmesh.project.list",
      "syntaxmesh.generateReport": "syntaxmesh.report.open",
    },);
    assertEquals(
      Object.keys(LEGACY_COMMAND_ALIASES,).sort(),
      [
        ...LEGACY_COMMAND_IDS,
      ].sort(),
    );
    for (const target of Object.values(LEGACY_COMMAND_ALIASES,)) {
      assert((PUBLIC_COMMAND_IDS as readonly string[]).includes(target,),);
    }
  });

  it("forwards arguments and returns the canonical command result", async () => {
    const host = registrar();
    const registry = new CommandRegistry(host.registrar,);
    const calls: Array<{ id: string; args: unknown[] }> = [];
    const expected = { ok: true, value: null, messages: [], };
    const executor: CommandExecutor = {
      execute<T,>(id: string, ...args: unknown[]): Promise<T> {
        calls.push({ id, args, },);
        return Promise.resolve(expected as T,);
      },
    };
    const disposables = registerLegacyAliases(registry, executor,);

    const result = await invoke(
      host.handlers.get("syntaxmesh.addProject",),
      "file:///master.smx",
      7,
    );
    assertStrictEquals(result, expected,);
    assertEquals(calls, [{
      id: "syntaxmesh.project.add",
      args: ["file:///master.smx", 7,],
    },],);
    assertEquals(disposables, host.disposables,);
  });

  it("allows generateReport to route without duplicating command logic", async () => {
    const host = registrar();
    const registry = new CommandRegistry(host.registrar,);
    let canonicalCalls = 0;
    let legacyCalls = 0;
    const executor: CommandExecutor = {
      execute<T,>(): Promise<T> {
        canonicalCalls++;
        return Promise.resolve(undefined as T,);
      },
    };
    registerLegacyAliases(registry, executor, {
      "syntaxmesh.generateReport": () => {
        legacyCalls++;
        return Promise.resolve("routed",);
      },
    },);

    assertEquals(
      await invoke(host.handlers.get("syntaxmesh.generateReport",),),
      "routed",
    );
    assertEquals(legacyCalls, 1,);
    assertEquals(canonicalCalls, 0,);
  });
});

describe("canonical command-set registration", () => {
  it("shares dependencies, registers every public id and owns runtime commands", async () => {
    const host = registrar();
    const subscriptions: Disposable[] = [];
    const shared = { service: "shared", output: "shared", };
    const seen: unknown[] = [];
    const group = (
      ids: readonly string[],
    ): CommandGroups<typeof shared>["project"] =>
    (registry, dependencies,) => {
      seen.push(dependencies,);
      for (const id of ids) registry.register(id, () => undefined,);
    };
    const groups: CommandGroups<typeof shared> = {
      project: group([
        "syntaxmesh.project.add",
        "syntaxmesh.project.remove",
        "syntaxmesh.project.list",
        "syntaxmesh.project.setActive",
        "syntaxmesh.project.refresh",
      ],),
      execution: group([
        "syntaxmesh.compile",
        "syntaxmesh.checkSyntax",
        "syntaxmesh.scheduleOnly",
        "syntaxmesh.freeze",
        "syntaxmesh.checkTimeSheet",
        "syntaxmesh.checkStatusSheet",
        "syntaxmesh.run",
        "syntaxmesh.sheet.time.send",
        "syntaxmesh.sheet.time.receive",
        "syntaxmesh.sheet.time.summary",
        "syntaxmesh.sheet.status.send",
        "syntaxmesh.sheet.status.receive",
      ],),
      report: group([
        "syntaxmesh.report.list",
        "syntaxmesh.report.render",
        "syntaxmesh.report.open",
        "syntaxmesh.report.export",
      ],),
      misc: group([
        "syntaxmesh.help",
        "syntaxmesh.version",
        "syntaxmesh.man",
        "syntaxmesh.exportTjp",
        "syntaxmesh.switchLanguage",
        "syntaxmesh.showProjectTree",
        "syntaxmesh.openManual",
      ],),
      console: group(["syntaxmesh.console.open",],),
    };
    const calls: string[] = [];
    const executor: CommandExecutor = {
      execute<T,>(id: string,): Promise<T> {
        calls.push(id,);
        return Promise.resolve(undefined as T,);
      },
    };
    let cleared = 0;
    let disposed = 0;
    const consoleAdapter = {
      open: () => Promise.resolve(),
      clear: () => {
        cleared++;
      },
      dispose: () => {
        disposed++;
      },
    };

    const registry = registerCommandSet({
      registrar: host.registrar,
      context: { subscriptions, },
      shared,
      groups,
      executor,
      console: consoleAdapter,
    },);

    assertEquals(seen, [shared, shared, shared, shared, shared,],);
    assertEquals(
      registry.ids.slice(0, PUBLIC_COMMAND_IDS.length,).sort(),
      [...PUBLIC_COMMAND_IDS,].sort(),
    );
    assertEquals(registry.ids.length, PUBLIC_COMMAND_IDS.length + 6,);
    assertEquals(subscriptions.length, host.disposables.length + 1,);
    assertEquals(subscriptions.at(-1,), consoleAdapter,);
    await invoke(host.handlers.get("syntaxmesh.reloadProject",), "master.smx",);
    assertEquals(calls, ["syntaxmesh.project.refresh",],);
    host.handlers.get("syntaxmesh.console.clear",)?.();
    assertEquals(cleared, 1,);
    consoleAdapter.dispose();
    assertEquals(disposed, 1,);
  });

  it("rejects an incomplete public set before registering runtime aliases", () => {
    const host = registrar();
    const subscriptions: Disposable[] = [];
    const shared = {};
    const groups: CommandGroups<typeof shared> = {
      project: (registry,) => {
        registry.register("syntaxmesh.project.add", () => undefined,);
      },
      execution: () => {},
      report: () => {},
      misc: () => {},
      console: () => {},
    };

    assertThrows(
      () =>
        registerCommandSet({
          registrar: host.registrar,
          context: { subscriptions, },
          shared,
          groups,
          executor: {
            execute<T,>(): Promise<T> {
              return Promise.resolve(undefined as T,);
            },
          },
          console: {
            open: () => Promise.resolve(),
            clear: () => {},
            dispose: () => {},
          },
        },),
      Error,
      "missing command registrations:",
    );
    assertEquals(
      host.handlers.has("syntaxmesh.addProject",),
      false,
      "legacy aliases must be registered only after the public set is exact",
    );
  });
});
