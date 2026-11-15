/**
 * Unit tests of the pure storage capability resolver (22.8.4). BDD +
 * `@std/assert`, no `vscode` runtime — covers Desktop, Web (no storage), and
 * partial capability combinations (plan §9.3).
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { resolveStorageCapabilities, } from "../../src/web/storage-capabilities.ts";

describe("storage capability resolver", () => {
  it("uses file storage and the workspace Memento on Desktop", () => {
    assertEquals(
      resolveStorageCapabilities({
        storageUri: "file:///workspace/.state",
        globalStorageUri: "file:///global/.state",
        hasWorkspaceState: true,
        hasGlobalState: true,
      },),
      {
        daemonCache: "file",
        smallState: "workspaceState",
        largeReports: "file",
      },
    );
  });

  it("degrades to memory and on-demand on the Web with no storage", () => {
    assertEquals(
      resolveStorageCapabilities({
        hasWorkspaceState: false,
        hasGlobalState: false,
      },),
      {
        daemonCache: "memory",
        smallState: "memory",
        largeReports: "ondemand",
      },
    );
  });

  it("keeps the daemon in memory but uses Mementos when only state is available", () => {
    assertEquals(
      resolveStorageCapabilities({
        hasWorkspaceState: true,
        hasGlobalState: true,
      },),
      {
        daemonCache: "memory",
        smallState: "workspaceState",
        largeReports: "ondemand",
      },
    );
  });

  it("falls back to the global Memento when workspace state is absent", () => {
    assertEquals(
      resolveStorageCapabilities({
        storageUri: "file:///workspace/.state",
        hasWorkspaceState: false,
        hasGlobalState: true,
      },),
      { daemonCache: "file", smallState: "globalState", largeReports: "file", },
    );
  });

  it("treats a global storage URI alone as file-capable for reports", () => {
    assertEquals(
      resolveStorageCapabilities({
        globalStorageUri: "file:///global/.state",
        hasWorkspaceState: false,
        hasGlobalState: false,
      },),
      { daemonCache: "memory", smallState: "memory", largeReports: "file", },
    );
  });
});
