/**
 * Built-bundle stdio smoke (F21², 26.32.2) — EVIDENCE driver, not a gate test.
 *
 * Proves the *shipped* artifact `dist/syntaxmesh-lsp.js` (the `deno task build`
 * output: version-injected + shebang, `--platform=deno --format=esm`) speaks
 * the same protocol as the source server: `--version` banner, then
 * initialize → didOpen → hover → shutdown/exit with pure stdout.
 *
 * Intentionally NOT `*test.ts`: the bundle is git-ignored and built on demand,
 * so collecting it in `deno task tests` would add a pre-build dependency to the
 * gate (plan 26.32.2). Run it manually after `deno task build`:
 *
 *   deno run --allow-read --allow-run --allow-env tests/smoke-bundle.ts
 *
 * Reuses the `StdioClient` framing harness (26.29.1) but spawns the bundle
 * instead of `src/mod.ts`. Type-checked by `deno task check` (`tests/**`).
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.32.2)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §10
 */
import { assert, assertEquals, } from "@std/assert";
import {
  didOpen,
  nextDiagnostics,
  StdioClient,
  withTimeout,
} from "./stdio-client.ts";

/** The built artifact under test (git-ignored; produced by `deno task build`). */
const BUNDLE = new URL("../dist/syntaxmesh-lsp.js", import.meta.url,).pathname;
/** Document URI of the smoke session (in-memory; no file is read). */
const URI = "file:///bundle-smoke.tjp";
/** Same realistic fixture as the source protocol smoke (22.9.5). */
const TEXT = `project prj "Bundle" "1.0" 2026-01-01 - 2026-12-31 {
}
resource dev "Developer" {
}
task build "Build" {
  effort 5d
  allocate dev
}
task ship "Ship" {
  depends build
}
`;

/** Spawns the built bundle with piped stdio for the framed session. */
function spawnBundle(args: string[],): Deno.ChildProcess {
  return new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--no-prompt",
      "--allow-read",
      "--allow-env",
      BUNDLE,
      ...args,
    ],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  },).spawn();
}

// Fail loudly (not with a confusing frame error) when the bundle is absent.
try {
  await Deno.stat(BUNDLE,);
} catch {
  console.error(
    `bundle not found: ${BUNDLE}\n` +
      "run `deno task build` first (26.32.2 evidence step).",
  );
  Deno.exit(1,);
}

// 1. --version banner from the built artifact: proves the version constant
//    was injected (the source server prints "" — only the bundle carries it).
const versionOut = await withTimeout(
  new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--no-prompt",
      "--allow-read",
      "--allow-env",
      BUNDLE,
      "--version",
    ],
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  },).output(),
  30_000,
  "--version",
);
assertEquals(versionOut.code, 0,);
const banner = new TextDecoder().decode(versionOut.stdout,);
assert(banner.startsWith("SyntaxMesh language server ",),);
assert(banner.trim() !== "SyntaxMesh language server",); // version is non-empty
assertEquals(new TextDecoder().decode(versionOut.stderr,), "",);

// 2. initialize → didOpen → hover → shutdown/exit over the built bundle.
const client = new StdioClient(spawnBundle(["--stdio",],),);
try {
  const init = await client.request("initialize", {
    processId: null,
    rootUri: null,
    capabilities: {},
  },);
  const capabilities = (init.result as {
    capabilities: Record<string, unknown>;
  }).capabilities;
  assertEquals(capabilities["textDocumentSync"], 2,);
  assertEquals(capabilities["hoverProvider"], true,);
  await client.notify("initialized", {},);

  // didOpen of a valid project publishes empty diagnostics.
  await didOpen(client, URI, TEXT,);
  const diag = await nextDiagnostics(client,);
  assertEquals(diag.uri, URI,);
  assertEquals(diag.diagnostics, [],);

  // hover over the `task` keyword (line 4, column 1) → Markdown.
  const hover = await client.request("textDocument/hover", {
    textDocument: { uri: URI, },
    position: { line: 4, character: 1, },
  },);
  const hoverResult = hover.result as {
    contents: { kind: string; value: string };
  } | null;
  assert(hoverResult !== null,);
  assertEquals(hoverResult!.contents.kind, "markdown",);

  // shutdown/exit: a well-behaved server leaves with code 0.
  assertEquals(await client.shutdown(), 0,);
  // stdout carried nothing but frames: no trailing log byte.
  assertEquals((await client.remaining()).byteLength, 0,);

  console.log("BUNDLE SMOKE OK — dist/syntaxmesh-lsp.js",);
  console.log(`  banner      : ${banner.trim()}`,);
  console.log(
    `  capabilities: textDocumentSync=2 hoverProvider=true ` +
      `(${Object.keys(capabilities,).length} keys)`,
  );
  console.log(
    `  hover       : ${hoverResult!.contents.value.split("\n",)[0]}`,
  );
  console.log(`  diagnostics : ${diag.diagnostics.length} (valid document)`,);
  console.log("  exit        : 0; stdout pure (0 trailing bytes)",);
} finally {
  await client.close();
}
