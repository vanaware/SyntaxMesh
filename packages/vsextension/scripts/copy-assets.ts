/**
 * Build-only report asset copier (Fase 22 P8, 22.12.8).
 *
 * The repository owns the canonical HTML assets. Each extension build replaces
 * the package copy so development and installed VSIX runs resolve the same tree
 * through `context.asAbsolutePath("assets")`. This script is never imported by
 * the Desktop or browser extension graph.
 */
import { join, relative, resolve, sep, } from "node:path";

/** Recursively copies one directory and records POSIX-style relative file paths. */
async function copyTree(
  source: string,
  destination: string,
  rootDestination: string,
  files: string[],
): Promise<void> {
  await Deno.mkdir(destination, { recursive: true, },);
  const entries: Deno.DirEntry[] = [];
  for await (const entry of Deno.readDir(source,)) entries.push(entry,);
  entries.sort((a, b,) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const entry of entries) {
    const from = join(source, entry.name,);
    const to = join(destination, entry.name,);
    if (entry.isDirectory) {
      await copyTree(from, to, rootDestination, files,);
    } else if (entry.isFile) {
      await Deno.copyFile(from, to,);
      files.push(relative(rootDestination, to,).split(sep,).join("/",),);
    } else {
      throw new Error(`unsupported report asset entry: ${from}`,);
    }
  }
}

/**
 * Replaces `<packageRoot>/assets` with a deterministic copy of `sourceRoot`.
 *
 * @param sourceRoot canonical repository `assets/` directory.
 * @param packageRoot extension package root.
 * @returns copied paths relative to the package `assets/` directory, sorted.
 */
export async function copyReportAssets(
  sourceRoot: string,
  packageRoot: string,
): Promise<string[]> {
  const source = resolve(sourceRoot,);
  const destination = resolve(packageRoot, "assets",);
  if (source === destination) {
    throw new Error("report asset source and destination must differ",);
  }
  try {
    await Deno.remove(destination, { recursive: true, },);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  const files: string[] = [];
  await copyTree(source, destination, destination, files,);
  return files.sort();
}
