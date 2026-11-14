/**
 * Unit tests of the pure include closure (22.5.4). BDD + `@std/assert`,
 * no `vscode` runtime — an injected in-memory reader stands in for the host.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  buildClosure,
  extractIncludes,
} from "../../src/daemon/include-closure.ts";

/** In-memory reader: resolves known paths, rejects the rest (like the FS). */
function reader(
  files: Map<string, string>,
): (path: string,) => Promise<string> {
  return (path: string,) => {
    const content = files.get(path,);
    return content === undefined
      ? Promise.reject(new Error(`not found: ${path}`,),)
      : Promise.resolve(content,);
  };
}

describe("extractIncludes", () => {
  it("reads include paths in order, ignoring comments and other lines", () => {
    const text = [
      `project "p" "1.0" 2026-01-01 - 2026-12-31`,
      `include "tasks.tji"`,
      `# include "commented.tji"`,
      `include "resources.tji" # trailing comment`,
      `task t "Task"`,
    ].join("\n",);
    assertEquals(extractIncludes(text,), ["tasks.tji", "resources.tji",],);
  });
});

describe("buildClosure", () => {
  it("closes includes transitively, resolving relative paths", async () => {
    const files = new Map<string, string>([
      ["proj/master.tjp", `include "sub/a.tji"`,],
      ["proj/sub/a.tji", `include "../b.tji"`,],
      ["proj/b.tji", "",],
    ],);
    const closure = await buildClosure("proj/master.tjp", reader(files,),);
    assertEquals(closure.files.map((f,) => f.path), [
      "proj/master.tjp",
      "proj/sub/a.tji",
      "proj/b.tji",
    ],);
    assertEquals(closure.missing, [],);
  });

  it("records missing files as data instead of throwing", async () => {
    const files = new Map<string, string>([
      ["master.tjp", `include "gone.tji"`,],
    ],);
    const closure = await buildClosure("master.tjp", reader(files,),);
    assertEquals(closure.files.map((f,) => f.path), ["master.tjp",],);
    assertEquals(closure.missing, ["gone.tji",],);

    const noMaster = await buildClosure("nope.tjp", reader(files,),);
    assertEquals(noMaster.files, [],);
    assertEquals(noMaster.missing, ["nope.tjp",],);
  });

  it("cuts cycles so each path enters the closure once", async () => {
    const files = new Map<string, string>([
      ["master.tjp", `include "a.tji"`,],
      ["a.tji", `include "master.tjp"`,],
    ],);
    const closure = await buildClosure("master.tjp", reader(files,),);
    assertEquals(closure.files.map((f,) => f.path), ["master.tjp", "a.tji",],);
    assertEquals(closure.missing, [],);
  });
});
