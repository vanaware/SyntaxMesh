/**
 * VS Code adapter for the pure extension output host.
 *
 * URI strings cross the pure command boundary; this module alone converts them
 * to `vscode.Uri` and adapts `workspace.fs`. Desktop uses direct writes while Web
 * uses the existing stub-first permission fallback. No external CLI process is
 * involved.
 */
import { FileType, Uri, workspace, } from "vscode";
import { type WriteStrategy, writeUserFile, } from "../web/write-fallback.ts";
import type { Tj3HostIo, } from "./output-host.ts";

const ABSOLUTE_URI = /^[A-Za-z][A-Za-z\d+.-]*:/;

/** Creates the URI I/O consumed by the shared output host. */
export function createTj3HostIo(options: {
  /** Explicit URI root; defaults to the first workspace folder. */
  cwd?: string;
  /** Desktop uses `direct`; Web uses `stub-first`. */
  writeStrategy?: WriteStrategy;
} = {},): Tj3HostIo {
  const workspaceRoot = workspace.workspaceFolders?.[0]?.uri.toString();
  const configuredRoot = options.cwd ?? workspaceRoot;
  const strategy = options.writeStrategy ?? "direct";

  return {
    resolve(path: string, root?: string,): string {
      const base = root ?? configuredRoot;
      if (path === "") {
        if (base === undefined) {
          throw new Error("SyntaxMesh: no workspace URI root is available.",);
        }
        return Uri.parse(base,).toString();
      }
      if (ABSOLUTE_URI.test(path,)) return Uri.parse(path,).toString();
      if (base === undefined) {
        throw new Error(
          "SyntaxMesh: a relative output path requires a URI root.",
        );
      }
      return Uri.joinPath(Uri.parse(base,), ...path.split("/",),).toString();
    },
    print(text: string,): void {
      console.log(text,);
    },
    async write(path: string, content: string,): Promise<void> {
      const result = await writeUserFile(
        workspace.fs,
        Uri.parse(path,),
        content,
        strategy,
      );
      if (!result.ok) throw new Error(result.error,);
    },
    async mkpath(dir: string,): Promise<void> {
      await workspace.fs.createDirectory(Uri.parse(dir,),);
    },
    async copy(from: string, to: string,): Promise<void> {
      await workspace.fs.copy(Uri.parse(from,), Uri.parse(to,), {
        overwrite: true,
      },);
    },
    async listDir(path: string,): Promise<string[]> {
      const entries = await workspace.fs.readDirectory(Uri.parse(path,),);
      return entries.map(([name,],) => name);
    },
    async isDir(path: string,): Promise<boolean> {
      try {
        const stat = await workspace.fs.stat(Uri.parse(path,),);
        return stat.type === FileType.Directory;
      } catch {
        return false;
      }
    },
    async exists(path: string,): Promise<boolean> {
      try {
        await workspace.fs.stat(Uri.parse(path,),);
        return true;
      } catch {
        return false;
      }
    },
  };
}
