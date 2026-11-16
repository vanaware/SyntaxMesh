/**
 * `runtime/probe/probe.ts` — phase-B observer of the trust run (26.34.3).
 *
 * Test windows (`--extensionTestsPath`) use IN-MEMORY storage (VS Code sets
 * `useInMemoryStorage: !!extensionTestsLocationURI`), so a persisted trust
 * grant is only observable in a NORMAL window. This minimal dev extension
 * (second `--extensionDevelopmentPath`, no test path) observes the granted
 * profile over the real `vscode` API, writes `probe-result.json` into the
 * workspace (the driver asserts it after the window exits) and quits.
 *
 * It declares `untrustedWorkspaces.supported` so it also activates when the
 * grant FAILED — reporting `trusted: false` instead of silently never
 * running. Harness only (26.34): never packaged into any artifact.
 *
 * @see packages/vsextension/tests/runtime/run.ts (driver, phase B)
 */
import * as vscode from "vscode";

/** Extension id under test (publisher.name of the manifest). */
const EXTENSION_ID = "vanaware.syntaxmesh-vscode";

/** One named observation of the probe. */
interface ProbeCheck {
  name: string;
  ok: boolean;
  error?: string;
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

/** Entry point (`onStartupFinished`): observe, report, quit. */
export async function activate(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (folders === undefined || folders.length === 0) {
    throw new Error("probe: no workspace folder",);
  }
  const root = folders[0]!.uri;
  const checks: ProbeCheck[] = [];
  const trusted = vscode.workspace.isTrusted;

  const check = async (
    name: string,
    fn: () => Promise<void> | void,
  ): Promise<void> => {
    try {
      await fn();
      checks.push({ name, ok: true, },);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error,);
      checks.push({ name, ok: false, error: message, },);
    }
  };

  try {
    await check("granted workspace is trusted", () => {
      if (!trusted) throw new Error("workspace still untrusted",);
    },);

    // Capture the info messages of the extension under test (same host).
    const messages: string[] = [];
    const win = vscode.window as unknown as {
      showInformationMessage: (message: string,) => Promise<unknown>;
    };
    win.showInformationMessage = (message: string,) => {
      messages.push(message,);
      return Promise.resolve(undefined,);
    };

    const doc = await vscode.workspace.openTextDocument(
      vscode.Uri.joinPath(root, "master.tjp",),
    );
    await vscode.window.showTextDocument(doc,);

    await check("extension activates after trust grant", async () => {
      const ext = await poll(
        () => {
          const candidate = vscode.extensions.getExtension(EXTENSION_ID,);
          return candidate?.isActive ? candidate : undefined;
        },
        "extension activation after trust",
      );
      if (!ext.isActive) throw new Error("extension not active",);
    },);

    await check("addProject executes after trust grant", async () => {
      await vscode.commands.executeCommand("syntaxmesh.addProject",);
      const last = messages[messages.length - 1];
      if (last !== "SyntaxMesh: loaded master.tjp (ok).") {
        throw new Error(`unexpected message: ${last}`,);
      }
    },);
  } finally {
    const report = { trusted, checks, };
    await vscode.workspace.fs.writeFile(
      vscode.Uri.joinPath(root, "probe-result.json",),
      new TextEncoder().encode(JSON.stringify(report, null, 2,),),
    );
    await vscode.commands.executeCommand("workbench.action.quit",);
  }
}
