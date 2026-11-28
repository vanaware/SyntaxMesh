/**
 * `sheet-files.ts` — pure discovery of the phase-18 sheet trees.
 *
 * The core receives an in-memory file store keyed by root-relative paths. This
 * module performs the traversal without touching a runtime global: callers inject
 * the three operations needed to read directories and files.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.10)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md (22.12.1)
 */
import type { ExecutionInputFile, } from "@vanaware/syntaxmesh";

export type { ExecutionInputFile, } from "@vanaware/syntaxmesh";

/** Runtime operations needed to discover a sheet tree. */
export interface SheetFileIo {
  /** Reads one UTF-8 file. */
  read(path: string,): Promise<string>;
  /** Lists one directory in discovery order. */
  listDir(path: string,): Promise<string[]>;
  /** Reports whether a path is a directory. */
  isDir(path: string,): Promise<boolean>;
}

/** Trees read by the sheet apps; unrelated project files are never scanned. */
const SHEET_TREES = [
  "TimeSheetTemplates",
  "TimeSheets",
  "StatusSheetTemplates",
  "StatusSheets",
];

/** Joins directory and name without a double slash (`"."` and `""` are root). */
function joinDisk(dir: string, name: string,): string {
  if (dir === "" || dir === ".") return name;
  return `${dir.replace(/\/+$/u, "",)}/${name}`;
}

/** Recursively collects one tree, skipping unreadable files and directories. */
async function collectTree(
  diskDir: string,
  relDir: string,
  files: ExecutionInputFile[],
  seen: Set<string>,
  io: SheetFileIo,
): Promise<void> {
  let names: string[];
  try {
    names = await io.listDir(diskDir,);
  } catch {
    return;
  }
  for (const name of names) {
    const disk = joinDisk(diskDir, name,);
    const rel = relDir === "" ? name : `${relDir}/${name}`;
    if (await io.isDir(disk,)) {
      await collectTree(disk, rel, files, seen, io,);
      continue;
    }
    if (seen.has(rel,)) continue;
    try {
      const content = await io.read(disk,);
      seen.add(rel,);
      files.push({ path: rel, content, },);
    } catch {
      // Unreadable file (binary/permission): out of the seed, inventing no data.
    }
  }
}

/**
 * Reads the four sheet trees as root-relative execution input files.
 *
 * Missing roots and unreadable entries are omitted. Repeated directory entries
 * do not duplicate a relative path, and discovery order is preserved.
 */
export async function collectSheetFiles(
  root: string,
  io: SheetFileIo,
): Promise<ExecutionInputFile[]> {
  const files: ExecutionInputFile[] = [];
  const seen = new Set<string>();
  for (const tree of SHEET_TREES) {
    await collectTree(joinDisk(root, tree,), tree, files, seen, io,);
  }
  return files;
}
