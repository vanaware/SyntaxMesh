/**
 * `inject.ts` — pure build-injection helpers for the executable bundle
 * (22.10.2).
 *
 * `deno bundle` has no `--define` flag, so the build post-processes the ESM
 * bundle instead: {@link injectVersion} prepends a module-scope
 * `const __APP_VERSION__` that the bundled `core/src/version.ts` binds to
 * (its free identifier resolves to the prepended constant), and
 * {@link withShebang} makes the artifact directly executable (plan §10 —
 * "Shebang, `--stdio`").
 *
 * The version source is the **root** `deno.jsonc` `"version"` field — the
 * same source the buildit consumes and the golden oracles read (24.6.6
 * precedent), so the banner can never disagree with the rest of the build.
 *
 * Pure by design: string in, string out — no filesystem, no process. The
 * build script (`scripts/build.ts`) does the I/O around these helpers.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §10
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.10.2
 */

/**
 * Shebang of the executable bundle: runs the artifact with the exact
 * permissions the stdio transport needs (read + env), via `env -S` so the
 * whole command line is passed as one argument.
 */
export const SHEBANG = "#!/usr/bin/env -S deno run --allow-read --allow-env";

/**
 * Extracts the `"version"` field from a (possibly commented) `deno.jsonc`.
 *
 * Uses the same tolerant regex as the golden oracles (`ical.rb`/
 * `html-xml.rb`) instead of a JSONC parser — the field is a plain string at
 * the top level, and comments never match the quoted key.
 *
 * @param jsonc the raw text of the root `deno.jsonc`.
 * @returns the version string (e.g. `0.0.2-mtvrt8od`).
 * @throws when no `"version"` field is present.
 */
export function readVersion(jsonc: string,): string {
  const match = /"version"\s*:\s*"([^"]+)"/.exec(jsonc,);
  if (match === null) {
    throw new Error(`no "version" field found in deno.jsonc`,);
  }
  return match[1]!;
}

/**
 * Prepends the build-time version constant to a bundled ESM source.
 *
 * The bundled `version.ts` evaluates
 * `typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : ""`; with the
 * constant declared at the top of the same module scope the check succeeds
 * and `APP_VERSION` carries the injected value. The version is JSON-escaped
 * so any legal version string stays a valid JavaScript literal.
 *
 * @param source the bundler output (untouched after the first line).
 * @param version the version to inject.
 * @returns the source prefixed with `const __APP_VERSION__ = "…";`.
 */
export function injectVersion(source: string, version: string,): string {
  return `const __APP_VERSION__ = ${JSON.stringify(version,)};\n${source}`;
}

/**
 * Prepends {@link SHEBANG} as the very first line of the artifact.
 *
 * Compose as `withShebang(injectVersion(source, version))`: the shebang must
 * stay on line 1 for the OS loader, the constant follows on line 2.
 *
 * @param source the (possibly version-injected) bundle source.
 * @returns the source prefixed with the shebang line.
 */
export function withShebang(source: string,): string {
  return `${SHEBANG}\n${source}`;
}
