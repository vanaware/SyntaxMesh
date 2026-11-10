/**
 * `io.ts` — single runtime boundary of the CLI (ADR 034 §3).
 *
 * Rules of this layer:
 *  - **Every** access to the file system, process, `argv` and terminal goes
 *    through here.
 *  - **Zero** runtime branching for files: `node:fs/promises` is natively
 *    supported by Deno, Node and Bun.
 *  - The only branching left is `args`/`exit` (one line each), kept so tests can
 *    inject their own implementation.
 *  - No `any`: global access uses the typed interface {@link RuntimeGlobals}
 *    (same convention as the core lexer).
 *
 * @see docs/syntaxmesh/decisoes/034-cli-multiruntime.md
 */

import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir, } from "node:os";
import { join, resolve, } from "node:path";
import { fileURLToPath, pathToFileURL, } from "node:url";

// Cliffy re-exported at the same boundary: the other modules of the package
// never import from `@cliffy/*` directly (24.1.8).
export { Command, } from "@cliffy/command";

/** Name of the runtime in execution. */
export type RuntimeName = "deno" | "bun" | "node";

/**
 * Minimal shape of the runtime globals read by the CLI. Typed to avoid `any` in
 * `src/` — extend it here when a new global becomes necessary.
 */
export interface RuntimeGlobals {
  /** Deno globals (reference runtime of the port). */
  Deno?: {
    args: string[];
    mainModule?: string;
    exit: (code?: number,) => never;
    stdout?: { isTerminal?: () => boolean };
  };
  /** Bun globals (alternative bundle of ADR 034). */
  Bun?: Record<string, unknown>;
  /** Node globals (alternative bundle of ADR 034). */
  process?: {
    argv: string[];
    exit: (code?: number,) => never;
    stdout?: { isTTY?: boolean };
    stdin?: AsyncIterable<Uint8Array>;
  };
}

/** Detects the runtime from the globals. */
export function detectRuntime(g: RuntimeGlobals,): RuntimeName {
  if (g.Deno) return "deno";
  if (g.Bun) return "bun";
  return "node";
}

/**
 * Normalises `argv` for the current runtime.
 *
 * It is the **only** entry branching of the package: kept for testability (tests
 * pass a fake globals object instead of a real process).
 */
export function resolveArgs(g: RuntimeGlobals,): string[] {
  if (g.Deno) return [...g.Deno.args,];
  const argv = g.process?.argv ?? [];
  return argv.slice(2,);
}

/**
 * Tells whether the module at `metaUrl` is the entry point of the process.
 *
 * `import.meta.main` only exists in Deno/Bun; in Node and in the bundles the
 * test compares `argv[1]` with the module URL. A single function for the three
 * runtimes avoids a second entrypoint (ADR 034 §2).
 */
export function isEntrypoint(
  metaUrl: string,
  g: RuntimeGlobals = globals,
): boolean {
  if (g.Deno) return g.Deno.mainModule === metaUrl;
  const entry = g.process?.argv[1];
  if (!entry) return false;
  return pathToFileURL(resolve(entry,),).href === metaUrl;
}

/** Globals of the current process, without `any`. */
export const globals: RuntimeGlobals = globalThis as unknown as RuntimeGlobals;

/**
 * Disk path relative to the module (`import.meta.url`).
 *
 * `new URL(…).pathname` percent-encodes spaces and accents (`/com%20espaco/`)
 * and on Windows starts with `/C:/…`, so an asset next to the module would never
 * be found. `fileURLToPath` handles both cases.
 */
export function modulePath(metaUrl: string, relative = ".",): string {
  return fileURLToPath(new URL(relative, metaUrl,),);
}

/**
 * Is `stdout` a terminal?
 *
 * On a pipe/redirection the reporter does **not** emit ANSI (24.4.2). Deno and
 * Node expose the same information under different names; this probe is the last
 * runtime branching besides `args`/`exit`.
 */
export function isTty(g: RuntimeGlobals = globals,): boolean {
  if (g.Deno) return g.Deno.stdout?.isTerminal?.() ?? false;
  return g.process?.stdout?.isTTY === true;
}

/** Runtime in execution (for diagnostics/logging). */
export const runtime: RuntimeName = detectRuntime(globals,);

/** Command-line arguments, normalised. */
export const args: string[] = resolveArgs(globals,);

// ---------------------------------------------------------------------------
// Files and directories — always `node:fs/promises`, no branching.
// ---------------------------------------------------------------------------

/** Reads a file as UTF-8. */
export const readText = (path: string,): Promise<string> =>
  readFile(path, "utf8",);

/**
 * Reads the whole `stdin` as UTF-8 (`--from -` of the receivers — 24.10.2).
 *
 * The stream comes from the `node:process` shim, present on all three runtimes
 * and already bound to descriptor 0; async iteration avoids depending on
 * `Deno.stdin` and on a special `-` path. With no `stdin` available the read
 * returns empty text — the consumer (receiver) reports the missing message.
 */
export async function readStdin(g: RuntimeGlobals = globals,): Promise<string> {
  const stdin = g.process?.stdin;
  if (stdin === undefined) return "";
  const decoder = new TextDecoder();
  let text = "";
  for await (const chunk of stdin) {
    text += decoder.decode(chunk, { stream: true, },);
  }
  return text + decoder.decode();
}

/** Writes a UTF-8 file (overwrites). */
export const writeText = (path: string, data: string,): Promise<void> =>
  writeFile(path, data, "utf8",);

/**
 * Reads a binary file (report images, attachments).
 *
 * Normalises to `Uint8Array`: Node/Deno `readFile` returns `Buffer`, a subtype
 * that does not deep-compare equal to `Uint8Array` — the CLI surface stays
 * stable across the three runtimes.
 */
export async function readBytes(path: string,): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path,),);
}

/** Copies a file, preserving the bytes. */
export const copy = (from: string, to: string,): Promise<void> =>
  copyFile(from, to,);

/**
 * `exists` — true when the path exists (file or directory).
 *
 * Implemented with `stat` and **not** with `access`: in Deno's `node:fs` shim,
 * `access()` resolves the process `uid` and then requires `--allow-sys`, which
 * would break the CLI under the minimal permissions of `deno task cli`.
 */
export async function exists(path: string,): Promise<boolean> {
  try {
    await stat(path,);
    return true;
  } catch {
    return false;
  }
}

/** `mkdir -p`. */
export async function mkpath(path: string,): Promise<void> {
  await mkdir(path, { recursive: true, },);
}

/** Unique temporary directory with a prefix. */
export const mktemp = (prefix: string,): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix,),);

/** Lists a directory (plain names). */
export const listDir = (path: string,): Promise<string[]> => readdir(path,);

/**
 * `true` when the path exists and is a directory.
 *
 * `readdir` on a file throws `ENOTDIR` (and in Deno's shim may even require
 * `--allow-sys`), so telling file from directory needs an explicit `stat` at the
 * boundary — never exception handling in the consumer.
 */
export async function isDir(path: string,): Promise<boolean> {
  try {
    return (await stat(path,)).isDirectory();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Terminal — `console` exists natively on all three runtimes.
// ---------------------------------------------------------------------------

/** Writes a line to `stdout`. */
export function print(text: string,): void {
  console.log(text,);
}

/** Writes a line to `stderr`. */
export function printerr(text: string,): void {
  console.error(text,);
}

// ---------------------------------------------------------------------------
// Process
// ---------------------------------------------------------------------------

/**
 * Terminates the process with the given code.
 *
 * The CLI calls this with the `exitCode` of the `execute` envelope — the core
 * never terminates a process (ADR 034 §7). The globals parameter is injectable
 * only for tests (a real `exit` kills the runner).
 */
export function exit(code = 0, g: RuntimeGlobals = globals,): never {
  if (g.Deno) g.Deno.exit(code,);
  g.process?.exit(code,);
  throw new Error("unreachable",);
}
