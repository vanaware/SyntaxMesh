/**
 * C3.3 — `picture` e `format` em `journalentry` (+ modelo Picture).
 *
 * Cobre C3.3.1 (rule_picture/pictureAttributes), C3.3.2 (rule_format),
 * C3.3.3 (journalentry aceita picture/format) e C3.3.5 (modelo).
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { Picture, } from "../../src/model/picture.ts";
import { type JournalEntry, } from "../../src/model/journal.ts";
import { Task, } from "../../src/model/task.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** Recupera a única journalentry anexada a `property`. */
function singleEntry(
  parser: ReturnType<typeof parseProject>["parser"],
  property: Task,
): JournalEntry {
  const entries = parser.project!.journal.entriesFor(property,);
  assertEquals(entries.length, 1,);
  return entries[0]!;
}

describe("C3.3.1/C3.3.3 picture em journalentry", () => {
  it("picture com corpo preenche caption/align/width/alt", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'task t "T" {\n' +
        'journalentry 2026-02-01 "Chegada" {\n' +
        '  picture "img/aca.png" {\n' +
        '    caption "Peça"\n' +
        "    align center\n" +
        "    width 300\n" +
        '    alt "uma peça"\n' +
        "  }\n" +
        "  }\n" +
        "}\n",
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const t = parser.project!.task("t",) as Task;
    const entry = singleEntry(parser, t,);
    assertEquals(entry.pictures.length, 1,);
    const pic = entry.pictures[0]!;
    assert(pic instanceof Picture, "não é Picture",);
    assertEquals(pic.path, "img/aca.png",);
    assertEquals(pic.caption, "Peça",);
    assertEquals(pic.align, "center",);
    assertEquals(pic.width, 300,);
    assertEquals(pic.alt, "uma peça",);
  });

  it("picture sem corpo usa só o path (restante null)", () => {
    const { parser, threw, messageIds, result, } = parseProject(
      PROJECT_HEADER + 'task t "T" {\n' +
        'journalentry 2026-02-01 "E" {\n  picture "a.png"\n  }\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const t = parser.project!.task("t",) as Task;
    const pic = singleEntry(parser, t,).pictures[0]!;
    assertEquals(pic.path, "a.png",);
    assertEquals(pic.caption, null,);
    assertEquals(pic.align, null,);
  });

  it("align left|right aceitos", () => {
    for (const a of ["left", "right",]) {
      const { parser, threw, messageIds, } = parseProject(
        PROJECT_HEADER + 'task t "T" {\n' +
          `journalentry 2026-02-01 "E" {\n  picture "a.png" {\n    align ${a}\n  }\n  }\n}\n`,
      );
      assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
      const t = parser.project!.task("t",) as Task;
      assertEquals(singleEntry(parser, t,).pictures[0]!.align, a,);
    }
  });
});

describe("C3.3.2/C3.3.3 format em journalentry", () => {
  it("default format é markdown", () => {
    const { parser, threw, messageIds, } = parseProject(
      PROJECT_HEADER + 'task t "T" {\n' +
        'journalentry 2026-02-01 "E"\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    const t = parser.project!.task("t",) as Task;
    assertEquals(singleEntry(parser, t,).format, "markdown",);
  });

  it("format richtext altera entry.format", () => {
    const { parser, threw, messageIds, } = parseProject(
      PROJECT_HEADER + 'task t "T" {\n' +
        'journalentry 2026-02-01 "E" {\n  format richtext\n  }\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    const t = parser.project!.task("t",) as Task;
    assertEquals(singleEntry(parser, t,).format, "richtext",);
  });

  it("format markdown explícito", () => {
    const { parser, threw, messageIds, } = parseProject(
      PROJECT_HEADER + 'task t "T" {\n' +
        'journalentry 2026-02-01 "E" {\n  format markdown\n  }\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    const t = parser.project!.task("t",) as Task;
    assertEquals(singleEntry(parser, t,).format, "markdown",);
  });
});

describe("C3.3.4 picture/format em status (estrutura)", () => {
  it("status de statussheet aceita picture e format", () => {
    const { parser, threw, messageIds, result, } = parseProject(
      PROJECT_HEADER + 'resource john "J" {}\ntask t1 "T1" {}\n' +
        "statussheet john 2026-02-01 - 2026-02-28 {\n  task t1 {\n" +
        '    status green "ok" {\n      picture "a.png"\n' +
        "      format richtext\n    }\n  }\n}\n",
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    // O status produz uma JournalEntry com picture + format richtext.
    const withPic = parser.project!.journal.entries.find((e,) =>
      e.pictures.length === 1
    );
    assert(withPic !== undefined, "status deveria gerar entrada com picture",);
    assertEquals(withPic!.pictures[0]!.path, "a.png",);
    assertEquals(withPic!.format, "richtext",);
  });
});
