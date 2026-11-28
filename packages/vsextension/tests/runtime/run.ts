/**
 * `runtime/run.ts` — Deno driver of the desktop runtime acceptance (26.34).
 *
 * Evidence driver, NOT a gate test (kickoff 26.34): it needs VS Code
 * Insiders + a display + built artifacts, so it lives outside `deno task
 * tests` (same policy as `packages/lsp/tests/smoke-bundle.ts`). Run via
 * `deno task test:runtime [-- --mode full|untrusted|clean]`:
 *
 * - `full` (default) — dev-mode run: `extensionDevelopmentPath` over the
 *   built `dist/` bundles; activation + LSP-in-host + commands (26.34.1–.2);
 * - `untrusted` — two-phase trust run: fresh untrusted test window, then a
 *   persisted grant observed by the probe extension over a NORMAL window
 *   (test windows use in-memory storage) (26.34.3);
 * - `clean` — installs the `.vsix` into an isolated `--extensions-dir` and
 *   runs the suite over the INSTALLED artifact (inert dev-path placeholder;
 *   the suite bundle is copied into the installed extension dir so it shares
 *   its `vscode` API object — the host keys the API by containing extension
 *   path) (26.34.4).
 *
 * Every run gets a fresh temp `--user-data-dir` and a temp copy of
 * `tests/runtime/workspace/` (command writes never touch the repo). The
 * in-host suite is bundled CJS (`--external vscode`) exactly like the
 * extension artifacts (22.4.7 pipeline). `@vscode/test-electron` runs
 * through Deno's npm compatibility — no `npm install`, no VS Code download
 * (`vscodeExecutablePath` points at the installed Insiders).
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md
 *      (adendo 26.34)
 * @see packages/vsextension/tests/runtime/suite.ts (in-host suite)
 */
import { join, } from "node:path";
import { DatabaseSync, } from "node:sqlite";
import testElectron from "@vscode/test-electron";

const { runTests, } = testElectron;

/** Package root (two levels up from `tests/runtime/`). */
const PKG_ROOT = new URL("../../", import.meta.url,).pathname;
/** Distribution directory (git-ignored; holds the built artifacts). */
const DIST = join(PKG_ROOT, "dist",);
/** In-host suite entry and its CJS bundle output. */
const SUITE_ENTRY = join(PKG_ROOT, "tests", "runtime", "suite.ts",);
const SUITE_BUNDLE = join(DIST, "runtime-suite.cjs",);
/** Phase-B probe extension (trust grant observed over a NORMAL window). */
const PROBE_DIR = join(PKG_ROOT, "tests", "runtime", "probe",);
const PROBE_ENTRY = join(PROBE_DIR, "probe.ts",);
const PROBE_BUNDLE = join(DIST, "runtime-probe.cjs",);
/** Inert dev-path placeholder for the clean run (never activates). */
const INERT_DIR = join(PKG_ROOT, "tests", "runtime", "inert",);
/** Static workspace fixtures copied to a temp dir for each run. */
const WORKSPACE_FIXTURES = join(PKG_ROOT, "tests", "runtime", "workspace",);
/** Overall safety net so a stuck window cannot hang the driver forever. */
const RUN_TIMEOUT_MS = 6 * 60 * 1000;

/** Acceptance modes supported by the driver. */
type Mode = "full" | "untrusted" | "clean";

/** Parses `--mode <value>` from the CLI args (default `full`). */
function parseMode(args: string[],): Mode {
  const index = args.indexOf("--mode",);
  const value = index >= 0 ? args[index + 1] : "full";
  if (value !== "full" && value !== "untrusted" && value !== "clean") {
    throw new Error(`invalid --mode: ${value} (full|untrusted|clean)`,);
  }
  return value;
}

/** Decodes subprocess output bytes as UTF-8 text. */
function decode(bytes: Uint8Array,): string {
  return new TextDecoder().decode(bytes,);
}

/** Runs a subprocess, returning stdout; throws with stderr on failure. */
async function run(
  command: string,
  args: string[],
): Promise<string> {
  const output = await new Deno.Command(command, {
    args,
    stdout: "piped",
    stderr: "piped",
  },).output();
  if (!output.success) {
    throw new Error(
      `${command} ${args.join(" ",)} failed:\n${decode(output.stderr,)}`,
    );
  }
  return decode(output.stdout,);
}

/** The two Insiders entry points: CLI wrapper + Electron binary. */
interface InsidersPaths {
  /** `/usr/bin/code-insiders` wrapper — CLI ops (`--version`, install…). */
  cli: string;
  /**
   * The Electron binary — window launches. The wrapper delegates to
   * `cli.js`, which forwards window opens to a running instance and exits
   * 0 without waiting (unusable for test runs); the binary itself hangs on
   * bare CLI flags like `--version`, so each entry point has its own job.
   */
  binary: string;
}

/** Resolves the installed Insiders CLI wrapper and Electron binary. */
async function resolveInsiders(): Promise<InsidersPaths> {
  let cli = "/usr/bin/code-insiders";
  try {
    const path = (await run("which", ["code-insiders",],)).trim();
    if (path !== "") cli = path;
  } catch {
    // keep the default wrapper path
  }
  const roots = [
    join(cli, "..", "..", "share", "code-insiders",),
    "/usr/share/code-insiders",
    "/opt/code-insiders",
  ];
  for (const root of roots) {
    const binary = join(root, "code-insiders",);
    try {
      const stat = await Deno.stat(binary,);
      if (stat.isFile) return { cli, binary, };
    } catch {
      // try the next root
    }
  }
  throw new Error(
    "code-insiders binary not found — install VS Code Insiders to run the " +
      "runtime acceptance (26.34)",
  );
}

/** Reads the manifest version (no hardcoded version strings). */
async function manifestVersion(): Promise<string> {
  const manifest = JSON.parse(
    await Deno.readTextFile(join(PKG_ROOT, "package.json",),),
  ) as { version: string };
  return manifest.version;
}

/** Bundles an in-host entry to CJS (mirrors `scripts/build.ts`). */
async function bundle(entry: string, output: string,): Promise<void> {
  await run(Deno.execPath(), [
    "bundle",
    "--platform=deno",
    "--format=cjs",
    "--external=vscode",
    "--no-check",
    "--output",
    output,
    entry,
  ],);
}

/** Recursively copies one fixture tree, creating every destination directory. */
async function copyFixtureTree(
  source: string,
  destination: string,
): Promise<void> {
  await Deno.mkdir(destination, { recursive: true, },);
  for await (const entry of Deno.readDir(source,)) {
    const from = join(source, entry.name,);
    const to = join(destination, entry.name,);
    if (entry.isDirectory) await copyFixtureTree(from, to,);
    else if (entry.isFile) await Deno.copyFile(from, to,);
  }
}

/** Copies the static workspace fixtures into a fresh temp directory. */
async function copyWorkspace(): Promise<string> {
  const dir = await Deno.makeTempDir({ prefix: "smx-runtime-ws-", },);
  await copyFixtureTree(WORKSPACE_FIXTURES, dir,);
  return dir;
}

/** Guards that the artifacts the mode needs are present (no auto-build). */
async function assertArtifacts(mode: Mode, version: string,): Promise<void> {
  if (mode === "clean") {
    const vsix = join(PKG_ROOT, `syntaxmesh-vscode-${version}.vsix`,);
    try {
      await Deno.stat(vsix,);
    } catch {
      throw new Error(`${vsix} missing — run \`deno task package\` first`,);
    }
    return;
  }
  for (const artifact of ["extension.node.js", "server.node.js",]) {
    try {
      await Deno.stat(join(DIST, artifact,),);
    } catch {
      throw new Error(
        `dist/${artifact} missing — run \`deno task build\` first`,
      );
    }
  }
}

/** Installs the `.vsix` into an isolated extensions dir and verifies it. */
async function cleanInstall(
  insiders: string,
  extDir: string,
  version: string,
): Promise<void> {
  const vsix = join(PKG_ROOT, `syntaxmesh-vscode-${version}.vsix`,);
  console.log(
    await run(insiders, [
      "--install-extension",
      vsix,
      "--extensions-dir",
      extDir,
    ],),
  );
  const listing = await run(insiders, [
    "--list-extensions",
    "--show-versions",
    "--extensions-dir",
    extDir,
  ],);
  const expected = `vanaware.syntaxmesh-vscode@${version}`;
  if (!listing.includes(expected,)) {
    throw new Error(`clean install missing ${expected}:\n${listing}`,);
  }
  console.log(`clean install verified: ${expected}`,);
}

/**
 * Races `promise` against the safety net, CLEARING the timer on settle —
 * an uncleared `setTimeout` would keep the Deno event loop alive for the
 * full timeout after a green run.
 */
async function withTimeout<T,>(promise: Promise<T>,): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject,) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `runtime run exceeded ${RUN_TIMEOUT_MS}ms — check the ` +
                  "display/sandbox and any lingering code-insiders process",
              ),
            ),
          RUN_TIMEOUT_MS,
        );
      },),
    ],);
  } finally {
    clearTimeout(timer,);
  }
}

/**
 * Persists a workspace-trust grant into the profile's global state — the
 * SAME entry the trust editor's "Trust" button writes (`uriTrustInfo` under
 * `content.trust.model.key`, APPLICATION scope). Insiders 1.147 exposes no
 * command that grants trust programmatically (`workbench.trust.manage` only
 * opens the editor UI), and test windows use IN-MEMORY storage — so the
 * grant is persisted for a NORMAL phase-B window (documented fallback,
 * kickoff 26.34).
 */
function grantTrust(userDataDir: string, workspaceDir: string,): void {
  const dbPath = join(userDataDir, "User", "globalStorage", "state.vscdb",);
  const db = new DatabaseSync(dbPath,);
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS ItemTable " +
        "(key TEXT UNIQUE ON CONFLICT REPLACE, value BLOB)",
    );
    const model = JSON.stringify({
      uriTrustInfo: [{
        uri: {
          $mid: 1,
          scheme: "file",
          path: workspaceDir,
          fsPath: workspaceDir,
          external: `file://${workspaceDir}`,
        },
        trusted: true,
      },],
    },);
    db.prepare(
      "INSERT OR REPLACE INTO ItemTable (key, value) VALUES (?, ?)",
    ).run("content.trust.model.key", model,);
  } finally {
    db.close();
  }
  console.log(`trust granted for ${workspaceDir} (persisted entry)`,);
}

/** Phase-B probe report written into the workspace by `probe/probe.ts`. */
interface ProbeReport {
  trusted: boolean;
  checks: { name: string; ok: boolean; error?: string }[];
}

/** Asserts the phase-B probe report (trust grant over a normal window). */
async function assertProbeReport(workspaceDir: string,): Promise<void> {
  const path = join(workspaceDir, "probe-result.json",);
  let report: ProbeReport;
  try {
    report = JSON.parse(await Deno.readTextFile(path,),) as ProbeReport;
  } catch {
    throw new Error(
      `probe report missing: ${path} — the phase-B window did not report`,
    );
  }
  for (const item of report.checks) {
    if (item.ok) console.log(`  ok ${item.name}`,);
    else console.error(`  FAIL ${item.name}: ${item.error}`,);
  }
  const failed = report.checks.filter((item,) => !item.ok);
  console.log(
    `RUNTIME PROBE trusted=${report.trusted}: ` +
      `${report.checks.length - failed.length} passed, ${failed.length} failed`,
  );
  if (!report.trusted || failed.length > 0) {
    throw new Error(
      `trust grant probe failed: ${
        failed.map((item,) => item.name).join("; ",) || "workspace not trusted"
      }`,
    );
  }
}

/** Runs one VS Code window over the suite and waits for its exit code. */
async function runWindow(
  insiders: string,
  args: string[],
  mode: Mode | "trusted",
): Promise<void> {
  const child = new Deno.Command(insiders, {
    args,
    env: { SMX_RUNTIME_MODE: mode, },
    stdout: "inherit",
    stderr: "inherit",
  },).spawn();
  const status = await withTimeout(child.status,);
  if (!status.success) {
    throw new Error(`VS Code window exited with code ${status.code}`,);
  }
}

if (import.meta.main) {
  const mode = parseMode(Deno.args,);
  const insiders = await resolveInsiders();
  const version = await manifestVersion();
  console.log(`RUNTIME DRIVER mode=${mode}`,);
  console.log(`cli: ${insiders.cli} | binary: ${insiders.binary}`,);
  console.log((await run(insiders.cli, ["--version",],)).trim(),);
  await assertArtifacts(mode, version,);
  await bundle(SUITE_ENTRY, SUITE_BUNDLE,);
  await bundle(PROBE_ENTRY, PROBE_BUNDLE,);

  const workspaceDir = await copyWorkspace();
  const userDataDir = await Deno.makeTempDir({ prefix: "smx-runtime-ud-", },);
  const extDir = mode === "clean"
    ? await Deno.makeTempDir({ prefix: "smx-runtime-ext-", },)
    : null;
  try {
    const nestedSheet = join(
      workspaceDir,
      "TimeSheets",
      "2026-05-18",
      "dev.tji",
    );
    const nestedSheetStat = await Deno.stat(nestedSheet,);
    if (!nestedSheetStat.isFile) {
      throw new Error(`nested sheet fixture is not a file: ${nestedSheet}`,);
    }
    console.log(`nested sheet fixture verified: ${nestedSheet}`,);
    if (mode === "clean" && extDir !== null) {
      await cleanInstall(insiders.cli, extDir, version,);
    }
    // The host's `vscode` API object is keyed by the extension path that
    // CONTAINS the requiring module (`findSubstr` in the API factory): for
    // the UI stubs to reach the extension under test, the suite must live
    // inside its directory. Clean mode copies the bundle INTO the installed
    // artifact (the inert dev path only satisfies the test runner's
    // both-paths guard and never activates).
    let testsPath = SUITE_BUNDLE;
    if (mode === "clean" && extDir !== null) {
      const installedDir = join(
        extDir,
        `vanaware.syntaxmesh-vscode-${version}`,
      );
      testsPath = join(installedDir, "runtime-suite.cjs",);
      await Deno.copyFile(SUITE_BUNDLE, testsPath,);
    }
    const launchArgs = [
      workspaceDir,
      "--user-data-dir",
      userDataDir,
      "--disable-gpu",
      "--skip-release-notes",
    ];
    if (mode === "clean") {
      launchArgs.push("--extensions-dir", extDir!,);
    } else {
      launchArgs.push("--disable-extensions",);
    }

    if (mode === "untrusted") {
      // test-electron ALWAYS appends `--disable-workspace-trust` (which
      // forces `workspace.isTrusted === true`), so the trust scenario
      // spawns Insiders directly with the same `--extensionTestsPath`
      // mechanism but WITHOUT that flag: the fresh profile then opens the
      // folder untrusted, exactly like a first-run user window.
      // Phase A: test window (in-memory storage) — restricted workspace.
      await runWindow(insiders.binary, [
        ...launchArgs,
        `--extensionTestsPath=${SUITE_BUNDLE}`,
        `--extensionDevelopmentPath=${PKG_ROOT}`,
        "--no-sandbox",
        "--disable-gpu-sandbox",
      ], "untrusted",);
      // Test windows never touch disk storage, so the grant is persisted
      // for a NORMAL window (documented fallback, kickoff 26.34).
      grantTrust(userDataDir, workspaceDir,);
      // Phase B: normal window (disk storage) over the granted profile;
      // the probe extension observes via the real API, reports, and quits.
      await runWindow(insiders.binary, [
        ...launchArgs,
        `--extensionDevelopmentPath=${PKG_ROOT}`,
        `--extensionDevelopmentPath=${PROBE_DIR}`,
        "--no-sandbox",
        "--disable-gpu-sandbox",
      ], "trusted",);
      await assertProbeReport(workspaceDir,);
    } else {
      const options: Parameters<typeof runTests>[0] = {
        vscodeExecutablePath: insiders.binary,
        // The in-host test runner requires BOTH a development path and a
        // tests path (`_doHandleExtensionTests` throws without either).
        // Clean mode passes an INERT placeholder extension (no main, no
        // activation events — never activates): the extension under test
        // comes exclusively from the installed `.vsix`.
        extensionDevelopmentPath: mode === "clean" ? INERT_DIR : PKG_ROOT,
        extensionTestsPath: testsPath,
        extensionTestsEnv: { SMX_RUNTIME_MODE: mode, },
        launchArgs,
      };
      await withTimeout(runTests(options,),);
    }
    console.log(`RUNTIME DRIVER ${mode}: OK`,);
  } catch (error) {
    console.error(
      `RUNTIME DRIVER ${mode}: FAILED — ${
        error instanceof Error ? error.message : String(error,)
      }`,
    );
    Deno.exit(1,);
  } finally {
    for (const dir of [workspaceDir, userDataDir, extDir,]) {
      if (dir === null) continue;
      await Deno.remove(dir, { recursive: true, },).catch(() => undefined);
    }
  }
}
