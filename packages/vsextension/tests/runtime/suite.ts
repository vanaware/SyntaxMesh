/**
 * `runtime/suite.ts` — in-host runtime acceptance suite (26.34, F21).
 *
 * Loaded by the VS Code **Node extension host** via `extensionTestsPath`
 * (bundled CJS, `--external vscode`), NOT by `deno test`. Documented BDD
 * exception (kickoff 26.34): `@std/testing/bdd` registers `Deno.test`, which
 * cannot run inside the extension host — so the suite uses `@std/assert`
 * with a sequential `check(name, fn)` collector and throws on any failure
 * (the Deno driver then exits non-zero).
 *
 * Modes (env `SMX_RUNTIME_MODE`, set by `run.ts`):
 * - `full` — activation + LSP-in-host + all 9 manifest commands (26.34.1–.2);
 * - `untrusted` — Workspace Trust phase A (26.34.3; phase B = probe);
 * - `clean` — subset over the installed `.vsix` artifact (26.34.4).
 *
 * UI instrumentation: the suite shares the extension host process, so it
 * stubs `window.showQuickPick` (auto-pick; `pickLabel` selects by label),
 * `window.showSaveDialog` (auto-approve to `exported.tjp`) and records the
 * `show*Message` calls for assertions. Webview panels are observed through
 * `window.tabGroups.all` labels.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md
 *      (adendo 26.34)
 * @see packages/vsextension/tests/runtime/run.ts (Deno driver)
 */
import * as vscode from "vscode";
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { UNTRUSTED_MESSAGE, } from "../../src/trust.ts";

/** Node-host global (absent from Deno's lib; present at runtime here). */
declare const process: { env: Record<string, string | undefined> };

/** Acceptance mode, injected by the driver via `extensionTestsEnv`. */
const MODE = process.env["SMX_RUNTIME_MODE"] ?? "full";

/** Extension id under test (publisher.name of the manifest). */
const EXTENSION_ID = "vanaware.syntaxmesh-vscode";

/** One named check result of the sequential collector. */
interface CheckResult {
  name: string;
  ok: boolean;
  error?: string;
}

const results: CheckResult[] = [];

/** Runs one named check, recording (never aborting) its outcome. */
async function check(
  name: string,
  fn: () => Promise<void> | void,
): Promise<void> {
  try {
    await fn();
    results.push({ name, ok: true, },);
    console.log(`  ok ${name}`,);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error,);
    results.push({ name, ok: false, error: message, },);
    console.error(`  FAIL ${name}: ${message}`,);
  }
}

/** Polls `fn` until it returns a value or the deadline passes. */
async function poll<T,>(
  fn: () => T | undefined,
  label: string,
  ms = 20000,
  step = 250,
): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const value = fn();
    if (value !== undefined) return value;
    if (Date.now() > deadline) throw new Error(`timeout: ${label}`,);
    await new Promise((resolve,) => setTimeout(resolve, step,));
  }
}

/** Captured `show*Message` calls, in order. */
const messages: { kind: "info" | "error" | "warning"; text: string }[] = [];

/** Quick-pick calls received by the stub (items of each call). */
const picks: unknown[][] = [];

/** When set, the quick-pick stub selects the item with this label. */
let pickLabel: string | null = null;

/** Structural view of the mutable `window` surface used by the stubs. */
interface StubWindow {
  showQuickPick: (items: unknown[], ...rest: unknown[]) => Promise<unknown>;
  showSaveDialog: (options: { defaultUri?: vscode.Uri },) => Promise<
    vscode.Uri | undefined
  >;
  showInformationMessage: (message: string, ...rest: unknown[]) => Promise<
    unknown
  >;
  showErrorMessage: (message: string, ...rest: unknown[]) => Promise<unknown>;
  showWarningMessage: (message: string, ...rest: unknown[]) => Promise<unknown>;
}

/** Installs the UI stubs (same host process as the extension under test). */
function installStubs(workspaceRoot: vscode.Uri,): void {
  const win = vscode.window as unknown as StubWindow;
  win.showQuickPick = (items: unknown[],) => {
    picks.push(items,);
    const labeled = items as { label?: string }[];
    const chosen = pickLabel === null
      ? labeled[0]
      : labeled.find((item,) => item.label === pickLabel) ?? labeled[0];
    return Promise.resolve(chosen,);
  };
  win.showSaveDialog = (options,) => {
    const base = options.defaultUri ?? vscode.Uri.joinPath(workspaceRoot, "x",);
    return Promise.resolve(vscode.Uri.joinPath(base, "..", "exported.tjp",),);
  };
  win.showInformationMessage = (message: string,) => {
    messages.push({ kind: "info", text: message, },);
    return Promise.resolve(undefined,);
  };
  win.showErrorMessage = (message: string,) => {
    messages.push({ kind: "error", text: message, },);
    return Promise.resolve(undefined,);
  };
  win.showWarningMessage = (message: string,) => {
    messages.push({ kind: "warning", text: message, },);
    return Promise.resolve(undefined,);
  };
}

/** Last captured message of a kind (or `undefined`). */
function lastMessage(kind: "info" | "error" | "warning",): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]!.kind === kind) return messages[i]!.text;
  }
  return undefined;
}

/** Opens a workspace file and returns its document. */
async function openDoc(
  root: vscode.Uri,
  name: string,
): Promise<vscode.TextDocument> {
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.joinPath(root, name,),
  );
  await vscode.window.showTextDocument(doc,);
  return doc;
}

/** Index of the first line starting with `prefix` (throws when absent). */
function lineOf(doc: vscode.TextDocument, prefix: string,): number {
  for (let i = 0; i < doc.lineCount; i++) {
    if (doc.lineAt(i,).text.startsWith(prefix,)) return i;
  }
  throw new Error(`line not found: ${prefix}`,);
}

/** Whether a tab with the given label is open in any editor group. */
function hasTab(label: string,): boolean {
  return vscode.window.tabGroups.all.some((group,) =>
    group.tabs.some((tab,) => tab.label === label)
  );
}

/** Activation + LSP surface inside the real extension host (26.34.1). */
async function lspChecks(root: vscode.Uri,): Promise<void> {
  await check("extension present and activates", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID,);
    assert(ext !== undefined, `extension ${EXTENSION_ID} not found`,);
    await ext.activate();
    assertEquals(ext.isActive, true,);
  },);

  const master = await openDoc(root, "master.tjp",);
  await check("master.tjp recognized as syntaxmesh", () => {
    assertEquals(master.languageId, "syntaxmesh",);
  },);

  // Open the error fixture and wait for its diagnostics: this proves the
  // bundled server is up and processing didOpen in order, so the master's
  // (earlier) didOpen has already been answered when we assert [] below.
  const errorDoc = await openDoc(root, "error.tjp",);
  await check("error.tjp yields diagnostics with shape", async () => {
    const diagnostics = await poll(
      () => {
        const list = vscode.languages.getDiagnostics(errorDoc.uri,);
        return list.length > 0 ? list : undefined;
      },
      "error.tjp diagnostics",
    );
    for (const diagnostic of diagnostics) {
      assert(diagnostic.message.length > 0, "empty diagnostic message",);
      assert(diagnostic.range.start.line >= 0, "invalid range",);
      assert(
        diagnostic.severity >= vscode.DiagnosticSeverity.Error &&
          diagnostic.severity <= vscode.DiagnosticSeverity.Hint,
        "invalid severity",
      );
    }
  },);

  await check("master.tjp has no diagnostics", () => {
    assertEquals(vscode.languages.getDiagnostics(master.uri,).length, 0,);
  },);

  await check("hover over `task` returns markdown", async () => {
    await vscode.window.showTextDocument(master,);
    const line = lineOf(master, "task build",);
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      "vscode.executeHoverProvider",
      master.uri,
      new vscode.Position(line, 1,),
    );
    assert(hovers !== undefined && hovers.length > 0, "no hover result",);
    const texts = hovers.flatMap((hover,) =>
      hover.contents.map((content,) =>
        typeof content === "string" ? content : content.value
      )
    );
    assert(
      texts.some((text,) => text.includes("task",)),
      `hover without 'task': ${JSON.stringify(texts,)}`,
    );
  },);

  await check("completion after `depends` offers `build`", async () => {
    const line = lineOf(master, "  depends build",);
    const character = "  depends ".length;
    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      master.uri,
      new vscode.Position(line, character,),
    );
    assert(list !== undefined && list.items.length > 0, "no completion items",);
    assert(
      list.items.some((item,) => item.label === "build"),
      "completion missing 'build'",
    );
  },);
}

/** addProject over the real command wiring (shared by full/clean modes). */
async function checkAddProject(): Promise<void> {
  await check("addProject loads the project", async () => {
    await vscode.commands.executeCommand("syntaxmesh.addProject",);
    const info = lastMessage("info",);
    assert(
      info === "SyntaxMesh: loaded master.tjp (ok).",
      `unexpected messages: ${
        JSON.stringify({
          info,
          warning: lastMessage("warning",),
          error: lastMessage("error",),
        },)
      }`,
    );
  },);
}

/** HTML report generation opens the Webview panel (full/clean modes). */
async function checkHtmlReport(): Promise<void> {
  await check("generateReport HTML opens a webview tab", async () => {
    await vscode.commands.executeCommand("syntaxmesh.generateReport",);
    await poll(
      () => hasTab("SyntaxMesh: overview",) ? true : undefined,
      "report webview tab",
    );
  },);
}

/** All 9 manifest commands over the real UI wiring (26.34.2, full mode). */
async function commandChecks(root: vscode.Uri,): Promise<void> {
  const master = await openDoc(root, "master.tjp",);

  await checkAddProject();

  await check("reloadProject reloads the project", async () => {
    await vscode.commands.executeCommand("syntaxmesh.reloadProject",);
    assertEquals(
      lastMessage("info",),
      "SyntaxMesh: reloaded master.tjp (ok).",
    );
  },);

  await check("listProjects shows the loaded project", async () => {
    picks.length = 0;
    await vscode.commands.executeCommand("syntaxmesh.listProjects",);
    assertEquals(picks.length, 1,);
    const items = picks[0] as { label: string; description: string }[];
    assertEquals(items.length, 1,);
    assertEquals(items[0]!.label, "master.tjp",);
    assertStringIncludes(items[0]!.description, "1 reports",);
  },);

  await check("removeProject removes, re-add restores", async () => {
    await vscode.commands.executeCommand("syntaxmesh.removeProject",);
    assertEquals(lastMessage("info",), "SyntaxMesh: removed master.tjp.",);
    await vscode.commands.executeCommand("syntaxmesh.addProject",);
    assertEquals(lastMessage("info",), "SyntaxMesh: loaded master.tjp (ok).",);
  },);

  await checkHtmlReport();

  await check("generateReport CSV saves overview.csv", async () => {
    const config = vscode.workspace.getConfiguration("syntaxmesh",);
    await config.update(
      "report.defaultFormat",
      "csv",
      vscode.ConfigurationTarget.Workspace,
    );
    try {
      await vscode.commands.executeCommand("syntaxmesh.generateReport",);
      const csv = vscode.Uri.joinPath(root, "overview.csv",);
      const stat = await vscode.workspace.fs.stat(csv,);
      assert(stat.size > 0, "empty CSV report",);
      assertEquals(lastMessage("info",), "SyntaxMesh: saved overview.csv.",);
    } finally {
      await config.update(
        "report.defaultFormat",
        undefined,
        vscode.ConfigurationTarget.Workspace,
      );
    }
  },);

  await check("exportTjp writes exported.tjp", async () => {
    await vscode.window.showTextDocument(master,);
    await vscode.commands.executeCommand("syntaxmesh.exportTjp",);
    const exported = vscode.Uri.joinPath(root, "exported.tjp",);
    const bytes = await vscode.workspace.fs.readFile(exported,);
    assertEquals(new TextDecoder().decode(bytes,), master.getText(),);
    assertEquals(lastMessage("info",), "SyntaxMesh: exported master.tjp.",);
  },);

  await check("switchLanguage inserts the pt-BR directive", async () => {
    await vscode.window.showTextDocument(master,);
    pickLabel = "pt-BR";
    try {
      await vscode.commands.executeCommand("syntaxmesh.switchLanguage",);
    } finally {
      pickLabel = null;
    }
    assertStringIncludes(master.getText(), 'language "pt-BR"',);
    assertEquals(
      lastMessage("info",),
      "SyntaxMesh: language set to pt-BR.",
    );
  },);

  await check("switchLanguage back to en replaces in place", async () => {
    pickLabel = "en";
    try {
      await vscode.commands.executeCommand("syntaxmesh.switchLanguage",);
    } finally {
      pickLabel = null;
    }
    assertStringIncludes(master.getText(), 'language "en"',);
    assertEquals(lastMessage("info",), "SyntaxMesh: language set to en.",);
  },);

  await check("openManual opens a manual webview", async () => {
    await vscode.commands.executeCommand("syntaxmesh.openManual",);
    await poll(
      () =>
        vscode.window.tabGroups.all.some((group,) =>
            group.tabs.some((tab,) =>
              tab.label.startsWith("SyntaxMesh Manual:",)
            )
          ) ?
          true :
          undefined,
      "manual webview tab",
    );
  },);

  await check("showProjectTree focuses the tree view", async () => {
    await vscode.commands.executeCommand("syntaxmesh.showProjectTree",);
  },);
}

/**
 * Workspace Trust over the real runtime (26.34.3, phase A of the two-phase
 * untrusted run).
 *
 * The manifest declares no `untrustedWorkspaces` capability, so VS Code
 * itself keeps the extension DISABLED in a restricted workspace (commands
 * never register) — the first trust layer. The in-command gate
 * (`assertTrusted`, unit-tested in P4) is the second layer.
 *
 * Insiders 1.147 exposes NO command that grants trust programmatically
 * (`workbench.action.trustWorkspace` does not exist; `workbench.trust.manage`
 * only opens the trust editor UI), and test windows use in-memory storage.
 * Documented fallback (kickoff 26.34): this phase asserts the restricted
 * state in a fresh profile; the driver then persists the SAME trust entry
 * the UI "Trust" button writes and a NORMAL window runs the probe extension
 * (`probe/probe.ts`) asserting grant -> active -> executing.
 */
async function untrustedChecks(): Promise<void> {
  await check("fresh workspace starts untrusted", () => {
    assertEquals(vscode.workspace.isTrusted, false,);
  },);

  await check("extension disabled while untrusted", async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID,);
    assert(ext !== undefined, `extension ${EXTENSION_ID} not found`,);
    assertEquals(ext.isActive, false,);
    const registered = await vscode.commands.getCommands(true,);
    assertEquals(registered.includes("syntaxmesh.addProject",), false,);
    assertEquals(registered.includes("syntaxmesh.generateReport",), false,);
  },);

  // Keep the pure gate constant referenced: it is the message the
  // in-command layer surfaces when trust is lost mid-session (P4 unit).
  assertStringIncludes(UNTRUSTED_MESSAGE, "trusted workspace",);
}

/** Entry point invoked by the VS Code test runner (`exports.run`). */
export async function run(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  assert(folders !== undefined && folders.length > 0, "no workspace folder",);
  const root = folders[0]!.uri;
  console.log(`RUNTIME SUITE mode=${MODE} workspace=${root.toString()}`,);
  installStubs(root,);

  if (MODE === "full") {
    await lspChecks(root,);
    await commandChecks(root,);
  } else if (MODE === "clean") {
    await lspChecks(root,);
    // addProject acts on the ACTIVE editor — make master active again
    // (lspChecks ends on the completion provider, editor focus may drift).
    await openDoc(root, "master.tjp",);
    await checkAddProject();
    await checkHtmlReport();
  } else if (MODE === "untrusted") {
    await untrustedChecks();
  } else {
    throw new Error(`unknown mode: ${MODE}`,);
  }

  const failed = results.filter((result,) => !result.ok);
  console.log(
    `RUNTIME SUITE ${MODE}: ${results.length - failed.length} passed, ` +
      `${failed.length} failed`,
  );
  // No explicit window close here: the test runner derives the exit code
  // from `run()`'s promise and closes the window itself — an early
  // `closeWindow` races that propagation and can turn a green run red.
  if (failed.length > 0) {
    throw new Error(
      `runtime suite failures: ${failed.map((f,) => f.name).join("; ",)}`,
    );
  }
}
