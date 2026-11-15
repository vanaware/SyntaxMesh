/**
 * Unit tests of the pure small-state store (22.8.5). BDD + `@std/assert`, no
 * `vscode` runtime — covers defaults, round-trips, de-duplication and the
 * recent-projects cap over the in-memory Memento (plan §9.3).
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  MAX_RECENT_PROJECTS,
  MemoryMemento,
  SmallStateStore,
  STATE_KEYS,
} from "../../src/web/small-state.ts";

describe("MemoryMemento", () => {
  it("returns the default when the key is absent", () => {
    const memento = new MemoryMemento();
    assertEquals(memento.get("missing", "fallback",), "fallback",);
  });

  it("round-trips an updated value", async () => {
    const memento = new MemoryMemento();
    await memento.update("key", 42,);
    assertEquals(memento.get("key", 0,), 42,);
  });
});

describe("SmallStateStore", () => {
  it("returns an empty recent list by default", () => {
    const store = new SmallStateStore(new MemoryMemento(),);
    assertEquals(store.recentProjects(), [],);
  });

  it("records the most recent project first", async () => {
    const store = new SmallStateStore(new MemoryMemento(),);
    await store.addRecentProject("file:///a.tjp",);
    await store.addRecentProject("file:///b.tjp",);
    assertEquals(store.recentProjects(), ["file:///b.tjp", "file:///a.tjp",],);
  });

  it("de-duplicates a re-added project and moves it to the front", async () => {
    const store = new SmallStateStore(new MemoryMemento(),);
    await store.addRecentProject("file:///a.tjp",);
    await store.addRecentProject("file:///b.tjp",);
    await store.addRecentProject("file:///a.tjp",);
    assertEquals(store.recentProjects(), ["file:///a.tjp", "file:///b.tjp",],);
  });

  it("caps the list at MAX_RECENT_PROJECTS", async () => {
    const store = new SmallStateStore(new MemoryMemento(),);
    for (let i = 0; i < MAX_RECENT_PROJECTS + 3; i++) {
      await store.addRecentProject(`file:///p${i}.tjp`,);
    }
    const recent = store.recentProjects();
    assertEquals(recent.length, MAX_RECENT_PROJECTS,);
    assertEquals(recent[0], `file:///p${MAX_RECENT_PROJECTS + 2}.tjp`,);
  });

  it("returns the fallback format when nothing was stored", () => {
    const store = new SmallStateStore(new MemoryMemento(),);
    assertEquals(store.lastReportFormat("html",), "html",);
  });

  it("round-trips the last report format", async () => {
    const store = new SmallStateStore(new MemoryMemento(),);
    await store.setLastReportFormat("markdown",);
    assertEquals(store.lastReportFormat("html",), "markdown",);
  });

  it("persists under the extension-owned keys", async () => {
    const memento = new MemoryMemento();
    const store = new SmallStateStore(memento,);
    await store.addRecentProject("file:///a.tjp",);
    await store.setLastReportFormat("csv",);
    assertEquals(memento.get(STATE_KEYS.recentProjects, [],), [
      "file:///a.tjp",
    ],);
    assertEquals(memento.get(STATE_KEYS.lastReportFormat, "",), "csv",);
  });
});
