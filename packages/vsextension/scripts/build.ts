/**
 * `build.ts` — bundles the four extension artifacts (22.4.7).
 *
 * `deno bundle` is the project's only bundler that resolves the workspace
 * import map (core `npm:`/relative + `vscode-*` subpaths) natively **and**
 * supports `--external vscode` (ADR 034 / CLI `bundle-node.ts` precedent; the
 * plan §10 esbuild mention is adapted here, see the P3 kickoff decisions).
 *
 * Artifacts in `dist/` (git-ignored), all `--external vscode` (the runtime is
 * provided by the extension host) with external source maps:
 *  - `extension.node.js` + `server.node.js` — `--platform=deno --format=cjs`
 *    (Desktop: the Node extension host `require`s the CJS bundles; the server
 *    is a separate module forked over IPC);
 *  - `extension.web.js` + `server.web.js` — `--platform=browser --format=esm`
 *    (Web: ESM, no `node:*`; the server runs inside a Worker).
 *
 * Usage: `deno task build` — requires `--allow-read --allow-write --allow-run
 * --allow-env`. Type-checking is a separate gate (`deno task check`), so the
 * bundle runs `--no-check`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §7, §10
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.4.7
 */

import { join, } from "node:path";

/** Package root (the parent of `scripts/`). */
const ROOT = new URL("../", import.meta.url,).pathname;
/** Distribution directory of the bundled artifacts. */
const DIST = join(ROOT, "dist",);

/** One bundle target: entry module, output name and bundler mode. */
interface Target {
  /** Entry module path relative to the package root. */
  entry: string;
  /** Output file name inside `dist/`. */
  out: string;
  /** Bundler platform (`deno` runs on Node via `node:` builtins). */
  platform: "deno" | "browser";
  /** Module format of the bundle. */
  format: "cjs" | "esm";
}

/** The four artifacts (Desktop CJS pair + Web ESM pair). */
const TARGETS: Target[] = [
  {
    entry: "src/extension.node.ts",
    out: "extension.node.js",
    platform: "deno",
    format: "cjs",
  },
  {
    entry: "src/server/node.ts",
    out: "server.node.js",
    platform: "deno",
    format: "cjs",
  },
  {
    entry: "src/extension.web.ts",
    out: "extension.web.js",
    platform: "browser",
    format: "esm",
  },
  {
    entry: "src/server/browser.ts",
    out: "server.web.js",
    platform: "browser",
    format: "esm",
  },
];

/**
 * Runs `deno bundle` for one target, writing `dist/<out>` (+ `.map`).
 *
 * @param target the bundle target to build.
 * @throws when the bundler exits non-zero (stderr is surfaced verbatim).
 */
async function bundle(target: Target,): Promise<void> {
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "bundle",
      `--platform=${target.platform}`,
      `--format=${target.format}`,
      "--external=vscode",
      "--sourcemap=external",
      "--no-check",
      "--output",
      join(DIST, target.out,),
      join(ROOT, target.entry,),
    ],
    stdout: "piped",
    stderr: "piped",
  },);
  const output = await command.output();
  if (!output.success) {
    const err = new TextDecoder().decode(output.stderr,);
    throw new Error(`deno bundle failed for ${target.out}:\n${err}`,);
  }
  const warned = new TextDecoder().decode(output.stderr,);
  for (const line of warned.split("\n",)) {
    if (line.trim() === "") continue;
    console.error(line,);
  }
}

if (import.meta.main) {
  await Deno.mkdir(DIST, { recursive: true, },);
  for (const target of TARGETS) {
    await bundle(target,);
    const bytes = (await Deno.stat(join(DIST, target.out,),)).size;
    const kb = Math.round(bytes / 1024,);
    console.log(
      `dist/${target.out} — ${kb} kB (${target.platform}/${target.format})`,
    );
  }
}
