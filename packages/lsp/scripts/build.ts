/**
 * `build.ts` — bundles the standalone LSP server (22.9.4, 22.10.2).
 *
 * `deno bundle` resolves the workspace import map (relative `lsp-core` +
 * `npm:vscode-languageserver`) natively (ADR 034 / vsextension `build.ts`
 * precedent). The single artifact `dist/syntaxmesh-lsp.js` is
 * `--platform=deno --format=esm` — runnable with
 * `deno run --allow-read --allow-env dist/syntaxmesh-lsp.js --stdio` or
 * directly via its shebang. Unlike the extension bundles there is no
 * `--external vscode`: this server never touches the VS Code API.
 *
 * Post-processing (22.10.2): `deno bundle` has no `--define`, so the build
 * prepends the version constant (`__APP_VERSION__`, read from the **root**
 * `deno.jsonc` — the same source the buildit consumes) and the executable
 * shebang, then chmods the artifact 755. The pure helpers live in
 * `scripts/inject.ts` (unit-tested).
 *
 * Usage: `deno task build` — requires `--allow-read --allow-write --allow-run
 * --allow-env`. Type-checking is a separate gate (`deno task check`), so the
 * bundle runs `--no-check`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §10
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.9.4
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.10.2
 */

import { join, } from "node:path";
import { injectVersion, readVersion, withShebang, } from "./inject.ts";

/** Package root (the parent of `scripts/`). */
const ROOT = new URL("../", import.meta.url,).pathname;
/** Distribution directory of the bundled artifact. */
const DIST = join(ROOT, "dist",);
/** Output file name of the executable bundle. */
const OUT = "syntaxmesh-lsp.js";
/** Root workspace config — the single source of the build version. */
const ROOT_CONFIG = join(ROOT, "../../deno.jsonc",);

/**
 * Runs `deno bundle` for the stdio server, writing `dist/syntaxmesh-lsp.js`
 * (+ external source map).
 *
 * @throws when the bundler exits non-zero (stderr is surfaced verbatim).
 */
async function bundle(): Promise<void> {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "bundle",
      "--platform=deno",
      "--format=esm",
      "--sourcemap=external",
      "--no-check",
      "--output",
      join(DIST, OUT,),
      join(ROOT, "src/mod.ts",),
    ],
    stdout: "piped",
    stderr: "piped",
  },);
  const output = await command.output();
  if (!output.success) {
    const err = new TextDecoder().decode(output.stderr,);
    throw new Error(`deno bundle failed for ${OUT}:\n${err}`,);
  }
  const warned = new TextDecoder().decode(output.stderr,);
  for (const line of warned.split("\n",)) {
    if (line.trim() === "") continue;
    console.error(line,);
  }
}

/**
 * Injects the build version and the shebang into the bundled artifact and
 * marks it executable (22.10.2). The prepended module-scope constant binds
 * the free `__APP_VERSION__` identifier of the bundled `version.ts`.
 *
 * @param version the version read from the root `deno.jsonc`.
 */
async function finalize(version: string,): Promise<void> {
  const path = join(DIST, OUT,);
  const source = await Deno.readTextFile(path,);
  await Deno.writeTextFile(
    path,
    withShebang(injectVersion(source, version,),),
  );
  await Deno.chmod(path, 0o755,);
}

if (import.meta.main) {
  await Deno.mkdir(DIST, { recursive: true, },);
  await bundle();
  const version = readVersion(await Deno.readTextFile(ROOT_CONFIG,),);
  await finalize(version,);
  const bytes = (await Deno.stat(join(DIST, OUT,),)).size;
  const kb = Math.round(bytes / 1024,);
  console.log(`dist/${OUT} — ${kb} kB (deno/esm, v${version}, executable)`,);
}
