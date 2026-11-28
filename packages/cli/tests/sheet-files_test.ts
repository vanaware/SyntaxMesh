/**
 * Pure sheet-tree collection tests (Fase 22 P8, 22.12.1).
 *
 * The collector receives every runtime operation through `SheetFileIo`; these
 * tests exercise the real traversal without a process, terminal or file system.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { collectSheetFiles, type SheetFileIo, } from "../src/sheet-files.ts";

/** In-memory directory tree preserving the declared discovery order. */
function treeIo(files: Record<string, string>,): SheetFileIo {
  const directories = new Set<string>(["",],);
  for (const path of Object.keys(files,)) {
    const parts = path.split("/",);
    for (let i = 1; i < parts.length; i++) {
      directories.add(parts.slice(0, i,).join("/",),);
    }
  }
  return {
    read: (path,) => {
      const content = files[path];
      return content === undefined
        ? Promise.reject(new Error(`ENOENT: ${path}`,),)
        : Promise.resolve(content,);
    },
    listDir: (path,) => {
      const prefix = path === "" ? "" : `${path}/`;
      const names = new Set<string>();
      for (const file of Object.keys(files,)) {
        if (!file.startsWith(prefix,)) continue;
        names.add(file.slice(prefix.length,).split("/",)[0]!,);
      }
      return names.size === 0
        ? Promise.reject(new Error(`ENOENT: ${path}`,),)
        : Promise.resolve([...names,],);
    },
    isDir: (path,) => Promise.resolve(directories.has(path,),),
  };
}

describe("collectSheetFiles", () => {
  it("collects all four trees recursively with root-relative paths", async () => {
    const files = await collectSheetFiles(
      "work",
      treeIo({
        "work/TimeSheetTemplates/week.tji": "time template\n",
        "work/TimeSheets/2026-05-18/dev.tji": "time sheet\n",
        "work/StatusSheetTemplates/week.tji": "status template\n",
        "work/StatusSheets/2026-05-18/dev.tji": "status sheet\n",
        "work/other/ignored.tji": "ignored\n",
      },),
    );

    assertEquals(files, [
      { path: "TimeSheetTemplates/week.tji", content: "time template\n", },
      { path: "TimeSheets/2026-05-18/dev.tji", content: "time sheet\n", },
      { path: "StatusSheetTemplates/week.tji", content: "status template\n", },
      { path: "StatusSheets/2026-05-18/dev.tji", content: "status sheet\n", },
    ],);
  });

  it("normalizes trailing slashes on the root before discovery", async () => {
    const files = await collectSheetFiles(
      "work///",
      treeIo({ "work/TimeSheets/week.tji": "time sheet\n", },),
    );

    assertEquals(files, [
      { path: "TimeSheets/week.tji", content: "time sheet\n", },
    ],);
  });

  it("deduplicates repeated directory entries without reordering discovery", async () => {
    const io = treeIo({
      "TimeSheets/b.tji": "b\n",
      "TimeSheets/a.tji": "a\n",
    },);
    const files = await collectSheetFiles("", {
      ...io,
      listDir: (path,) =>
        path === "TimeSheets"
          ? Promise.resolve(["b.tji", "a.tji", "b.tji",],)
          : io.listDir(path,),
    },);

    assertEquals(files.map((file,) => file.path), [
      "TimeSheets/b.tji",
      "TimeSheets/a.tji",
    ],);
  });

  it("omits unreadable files and missing trees", async () => {
    const io = treeIo({
      "TimeSheets/a.tji": "a\n",
      "TimeSheets/private.tji": "private\n",
      "StatusSheets/s.tji": "s\n",
    },);
    const files = await collectSheetFiles("", {
      ...io,
      read: (path,) =>
        path.endsWith("private.tji",)
          ? Promise.reject(new Error("EACCES",),)
          : io.read(path,),
    },);

    assertEquals(files.map((file,) => file.path), [
      "TimeSheets/a.tji",
      "StatusSheets/s.tji",
    ],);
    assertEquals(await collectSheetFiles("missing", treeIo({},),), [],);
  });
});
