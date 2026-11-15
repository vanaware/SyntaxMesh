/**
 * 26.9.5/26.9.6 — Regression snapshot de RichText (F21 wave 1).
 *
 * Fixa as três serializações do formato intermediário (`to_s`, `to_html`,
 * `to_tagged`) para um corpus de markup MediaWiki representativo. Um
 * snapshot por modo — diffs isolados por serialização.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.9)
 */
import { assert, } from "@std/assert";
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { RichText, } from "../../src/richtext/rich-text.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { assertSnapshot, } from "./snapshot-io.ts";

/** Amostras de markup (nomes estáveis — são as chaves do snapshot). */
const SAMPLES: Record<string, string> = {
  plain: "Hello world",
  "bold-italic": "'''bold''' and ''italic'' and '''''both'''''",
  headings: "= H1 =\n== H2 ==\n=== H3 ===",
  lists: "* item 1\n* item 2\n** nested\n# ordered\n# second",
  links: "[[Internal]] and [http://example.com external] and [[Page|label]]",
  table: "{|\n! H1 !! H2\n|-\n| a || b\n|}",
  nowiki: "<nowiki>'''not bold'''</nowiki> and\n preformatted line",
  "hr-mixed": "----\nline one<br>line two",
};

type Mode = "to_s" | "to_html" | "to_tagged";

/** Serializa todas as amostras no modo pedido (chaves ordenadas). */
function snapshotMode(mode: Mode,): string {
  const entries: Record<string, string> = {};
  for (const name of Object.keys(SAMPLES,).sort()) {
    const rti = new RichText(SAMPLES[name]!,).generateIntermediateFormat();
    assert(rti !== null, `${name}: rti null`,);
    entries[name] = mode === "to_s"
      ? rti.to_s()
      : mode === "to_html"
      ? rti.to_html()?.toHTML() ?? "null"
      : rti.to_tagged();
  }
  return JSON.stringify(entries, null, 2,) + "\n";
}

describe("RichText regression snapshots (26.9.6)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("to_s bate com o baseline", () => {
    assertSnapshot("richtext-to_s.snap.json", snapshotMode("to_s",),);
  });

  it("to_html bate com o baseline", () => {
    assertSnapshot("richtext-to_html.snap.json", snapshotMode("to_html",),);
  });

  it("to_tagged bate com o baseline", () => {
    assertSnapshot("richtext-to_tagged.snap.json", snapshotMode("to_tagged",),);
  });
});
