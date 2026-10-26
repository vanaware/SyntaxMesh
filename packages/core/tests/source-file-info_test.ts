import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { SourceFileInfo, } from "../src/source-file-info.ts";

describe("SourceFileInfo", () => {
  it("armazena campos", () => {
    const sfi = new SourceFileInfo("proj.tjp", 42, 5,);
    assertEquals(sfi.fileName, "proj.tjp",);
    assertEquals(sfi.lineNo, 42,);
    assertEquals(sfi.columnNo, 5,);
  });

  it("to_s retorna fileName:lineNo:", () => {
    const sfi = new SourceFileInfo("proj.tjp", 42, 5,);
    assertEquals(sfi.to_s(), "proj.tjp:42:",);
  });

  it("linha zero retorna :", () => {
    const sfi = new SourceFileInfo("file.rb", 0, 0,);
    assertEquals(sfi.to_s(), "file.rb:0:",);
  });
});
