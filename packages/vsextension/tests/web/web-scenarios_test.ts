/**
 * Pure Web-host scenarios for the P5 exit criteria (22.8.7). BDD +
 * `@std/assert`, no `vscode` runtime — exercises the four pure P5 modules
 * together: missing storage degrades the daemon to memory, denied writes
 * surface a friendly error, small state round-trips across reactivation, and
 * the browser graph stays pure (plan §9, P5 exit).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §9 (Web/storage)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.8.7
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { resolveStorageCapabilities, } from "../../src/web/storage-capabilities.ts";
import {
  WRITE_ERROR_MESSAGE,
  writeUserFile,
} from "../../src/web/write-fallback.ts";
import type { WorkspaceFsLike, } from "../../src/web/write-fallback.ts";
import { MemoryMemento, SmallStateStore, } from "../../src/web/small-state.ts";
import { scanBrowserSource, } from "../../src/web/purity.ts";

/** A recording workspace fs that rejects its `failOn`-th write (0 = never). */
function fakeFs(failOn = 0,): {
  calls: Array<{ uri: string; text: string }>;
  fs: WorkspaceFsLike;
} {
  const calls: Array<{ uri: string; text: string }> = [];
  let n = 0;
  const fs: WorkspaceFsLike = {
    writeFile(uri: string, content: Uint8Array,): Promise<void> {
      calls.push({ uri, text: new TextDecoder().decode(content,), },);
      n++;
      return n === failOn
        ? Promise.reject(new Error("permission denied",),)
        : Promise.resolve();
    },
  };
  return { calls, fs, };
}

describe("Web host scenarios (P5 exit)", () => {
  it("degrades the daemon to memory and reports to on-demand without storage", () => {
    const strategy = resolveStorageCapabilities({
      hasWorkspaceState: false,
      hasGlobalState: false,
    },);
    assertEquals(strategy.daemonCache, "memory",);
    assertEquals(strategy.largeReports, "ondemand",);
    assertEquals(strategy.smallState, "memory",);
  });

  it("keeps small state in the workspace Memento when only state is available", () => {
    const strategy = resolveStorageCapabilities({
      hasWorkspaceState: true,
      hasGlobalState: true,
    },);
    assertEquals(strategy.daemonCache, "memory",);
    assertEquals(strategy.smallState, "workspaceState",);
  });

  it("surfaces a friendly error when a stub-first overwrite is denied", async () => {
    const { calls, fs, } = fakeFs(2,);
    const result = await writeUserFile(
      fs,
      "file:///w/report.csv",
      "a,b\n1,2\n",
      "stub-first",
    );
    assert(!result.ok,);
    assert(result.error.startsWith(WRITE_ERROR_MESSAGE,),);
    assertEquals(calls.length, 2,);
    assertEquals(calls[0]!.text, "",);
  });

  it("writes an empty stub then the content within the permission window", async () => {
    const { calls, fs, } = fakeFs();
    const result = await writeUserFile(
      fs,
      "file:///w/report.csv",
      "a,b\n",
      "stub-first",
    );
    assertEquals(result, { ok: true, },);
    assertEquals(calls.map((c,) => c.text), ["", "a,b\n",],);
  });

  it("round-trips small state across a simulated reactivation", async () => {
    const memento = new MemoryMemento();
    const first = new SmallStateStore(memento,);
    await first.addRecentProject("file:///w/a.tjp",);
    await first.setLastReportFormat("csv",);
    const second = new SmallStateStore(memento,);
    assertEquals(second.recentProjects(), ["file:///w/a.tjp",],);
    assertEquals(second.lastReportFormat("html",), "csv",);
  });

  it("keeps the P5 browser modules free of unbound runtime globals", async () => {
    const modules = [
      "purity.ts",
      "write-fallback.ts",
      "storage-capabilities.ts",
      "small-state.ts",
    ];
    for (const name of modules) {
      const text = await Deno.readTextFile(
        `${import.meta.dirname}/../../src/web/${name}`,
      );
      assertEquals(
        scanBrowserSource(text,),
        [],
        `${name} must be browser-pure`,
      );
      assert(
        !/indexedDB|navigator\.storage\.getDirectory/.test(text,),
        `${name} must not touch IndexedDB/OPFS`,
      );
    }
  });
});
