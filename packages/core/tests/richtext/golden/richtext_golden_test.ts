/**
 * Golden test do RichText (Fase 12.19).
 *
 * Carrega `richtext.golden.json` (oracle TaskJuggler Ruby real) e valida que a
 * implementação TS reproduz as três serializações de cada markup:
 *
 * - `to_s` (plain): comparado com **tolerância de whitespace** (12.19.8) — o
 *   `textBlockFormat` do Ruby quebra linhas conforme a largura; colapsamos
 *   runs de whitespace para comparar o conteúdo.
 * - `to_tagged`: comparado **byte-a-byte** (formato canônico dos testes).
 * - `to_html`: comparado após **normalização de serialização** — remove o
 *   whitespace *entre tags* e antes de `/>`, que o `XMLElement` do Ruby imprime
 *   por indentação mas o `SimpleXMLElement` mínimo desta fase não. Essa
 *   divergência é puramente de formatação e desaparece quando a Fase 17 troca
 *   `SimpleXMLElement` pelo `XMLElement` real. O **conteúdo** (tags, atributos,
 *   texto escapado) é comparado rigorosamente.
 *
 * @see scripts/golden/richtext.rb
 * @see docs/taskjuggler/lib/taskjuggler/RichText.rb
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { RichText, } from "../../../src/richtext/rich-text.ts";
import type { XMLElementLike, } from "../../../src/richtext/xml-like.ts";

interface GoldenCase {
  id: string;
  description: string;
  input: string;
  sectionNumbers: boolean;
  expected: { plain: string; tagged: string; html: string | null };
}

function loadCases(): GoldenCase[] {
  const path = new URL("./richtext.golden.json", import.meta.url,);
  const parsed = JSON.parse(Deno.readTextFileSync(path,),) as {
    cases: GoldenCase[];
  };
  return parsed.cases;
}

/** plain: colapsa runs de whitespace e apara (tolerância 12.19.8). */
function normPlain(s: string | null,): string {
  return s === null ? "∅" : s.replace(/\s+/g, " ",).trim();
}

/** html: remove whitespace entre tags e antes de auto-fechamento. */
function normHtml(s: string | null,): string {
  if (s === null || s === undefined) return "∅";
  return s.replace(/>\s+</g, "><",).replace(/\s+\/>/g, "/>",).trim();
}

function render(input: string, sectionNumbers: boolean,): {
  plain: string;
  tagged: string;
  html: string | null;
} {
  const rt = new RichText(input,);
  const rti = rt.generateIntermediateFormat();
  if (!rti) {
    throw new Error(`generateIntermediateFormat retornou null: ${input}`,);
  }
  rti.sectionNumbers = sectionNumbers;
  const html: XMLElementLike | null = rti.to_html();
  return {
    plain: rti.to_s(),
    tagged: rti.to_tagged(),
    html: html ? html.toHTML() : null,
  };
}

describe("RichText golden (12.19)", () => {
  const cases = loadCases();

  it("tem pelo menos 30 casos", () => {
    assertEquals(cases.length >= 30, true, `${cases.length} casos`,);
  });

  for (const c of cases) {
    it(c.description, () => {
      const got = render(c.input, c.sectionNumbers,);
      assertEquals(
        normPlain(got.plain,),
        normPlain(c.expected.plain,),
        "plain",
      );
      assertEquals(got.tagged, c.expected.tagged, "tagged",);
      assertEquals(normHtml(got.html,), normHtml(c.expected.html,), "html",);
    },);
  }

  describe("tolerância de normalização (12.19.8)", () => {
    it("plain ignora quebras de linha extras do textBlockFormat", () => {
      assertEquals(normPlain("a\n\n b  c",), normPlain("a b c",),);
    });

    it("html ignora indentação entre tags", () => {
      assertEquals(
        normHtml("<div>\n <p>a</p>\n <p>b</p>\n</div>",),
        "<div><p>a</p><p>b</p></div>",
      );
    });

    it("html ignora espaço antes de auto-fechamento", () => {
      assertEquals(normHtml("<div><hr /></div>",), "<div><hr/></div>",);
    });

    it("html mantém o conteúdo rigoroso (escape e atributos)", () => {
      assertEquals(
        normHtml('<a href="x&amp;y">r</a>',),
        '<a href="x&amp;y">r</a>',
      );
      // Um atributo divergente NÃO é normalizado para igual.
      assertEquals(
        normHtml('<a href="x">r</a>',) === normHtml('<a href="y">r</a>',),
        false,
      );
    });
  });
});
