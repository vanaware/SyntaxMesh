import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { Message } from "../src/message.ts";
import { SourceFileInfo } from "../src/source-file-info.ts";

describe("Message", () => {
  it("to_s inclui baselineSFI se houver", () => {
    const sfi = new SourceFileInfo("test.tjp", 5, 3);
    const msg = new Message('warning', 'w1', 'hello', sfi, null, null, null);
    assertEquals(msg.to_s().includes("test.tjp:5:"), true);
  });

  it("to_log retorna formatação para arquivo", () => {
    const sfi = new SourceFileInfo("test.tjp", 5, 3);
    const msg = new Message('error', 'e1', 'boom', sfi, null, null, null);
    assertEquals(msg.to_log(), "ERROR: e1: boom");
  });
});
