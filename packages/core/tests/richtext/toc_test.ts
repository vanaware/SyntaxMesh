/**
 * Testes de TOCEntry e TableOfContents (Fases 12.7 / 12.8).
 *
 * Estrutura conferida contra o Ruby real (`TOCEntry.rb`/`TableOfContents.rb`
 * com `XMLElement`); a serialização do port é mínima (sem os espaços de
 * indentação que o XMLElement.rb injeta — decidido em 12.1).
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { TOCEntry, } from "../../src/richtext/toc-entry.ts";
import { TableOfContents, } from "../../src/richtext/table-of-contents.ts";
import type { SimpleXMLElement, } from "../../src/richtext/xml-like.ts";

describe("TOCEntry (12.7)", () => {
  it("guarda number/title/file/tag (tag default null)", () => {
    const e = new TOCEntry("1 ", "Intro", "chap1",);
    assertEquals(e.number, "1 ",);
    assertEquals(e.title, "Intro",);
    assertEquals(e.file, "chap1",);
    assertEquals(e.tag, null,);
    const e2 = new TOCEntry("1.1 ", "Sub", "chap1", "Sub",);
    assertEquals(e2.tag, "Sub",);
  });

  it("nível 0: 2 linhas (spacer + entrada), número na coluna esquerda", () => {
    const e = new TOCEntry("1 ", "Intro", "chap1", "Intro",);
    const html = e.to_html();
    assertEquals(html.length, 2,);
    assertEquals(
      html[0]!.toHTML(),
      '<tr><td><div style="height:10px"></div></td></tr>',
    );
    assertEquals(
      html[1]!.toHTML(),
      '<tr style="font-size:20px;"><td style="width:30px;">1 </td>' +
        '<td><a href="chap1.html#Intro">Intro</a></td></tr>',
    );
  });

  it("nível > 0: 1 linha, número em span na coluna direita", () => {
    const e = new TOCEntry("1.1 ", "Sub", "chap1",);
    const html = e.to_html();
    assertEquals(html.length, 1,);
    assertEquals(
      html[0]!.toHTML(),
      '<tr style="font-size:17px;"><td style="width:30px;"></td><td>' +
        '<span style="padding-right:15px;">1.1 </span>' +
        '<a href="chap1.html">Sub</a></td></tr>',
    );
  });

  it("level() conta pontos: 20/17/15/14px por nível", () => {
    const sizes = ["20", "17", "15", "14",];
    const numbers = ["1 ", "1.1 ", "1.1.1 ", "1.1.1.1 ",];
    numbers.forEach((number, i,) => {
      const e = new TOCEntry(number, "T", "f",);
      const html = e.to_html();
      const tr = html[html.length - 1]!;
      assertEquals(tr.attrs["style"], `font-size:${sizes[i]}px;`,);
    },);
  });

  it('escapa texto e atributo como decide 12.1 (mínimo: & e ")', () => {
    const e = new TOCEntry("1 ", "A & B <c>", 'f"x',);
    const html = e.to_html();
    const flat = html[html.length - 1]!.toHTML();
    assertEquals(flat.includes('href="f&quot;x.html"',), true,);
    assertEquals(flat.includes("A &amp; B &lt;c&gt;",), true,);
  });
});

describe("TableOfContents (12.8)", () => {
  it("addEntry + iteração via for..of e each()", () => {
    const toc = new TableOfContents();
    const e1 = new TOCEntry("1 ", "Um", "f1",);
    const e2 = new TOCEntry("2 ", "Dois", "f2",);
    toc.addEntry(e1,);
    toc.addEntry(e2,);
    assertEquals([...toc,], [e1, e2,],);
    const seen: string[] = [];
    toc.each((e,) => seen.push(e.title,));
    assertEquals(seen, ["Um", "Dois",],);
  });

  it("to_html serializa div > table com linhas das entradas", () => {
    const toc = new TableOfContents();
    toc.addEntry(new TOCEntry("1.1 ", "Sub", "chap1",),);
    const html = toc.to_html();
    assertEquals(html.tag, "div",);
    assertEquals(
      html.attrs["style"],
      "margin-left:15%; margin-right:15%;",
    );
    assertEquals(html.children.length, 1,);
    const table = html.children[0] as SimpleXMLElement;
    assertEquals(table.tag, "table",);
    assertEquals(table.children.length, 1,);
    assertEquals((table.children[0] as SimpleXMLElement).tag, "tr",);
  });

  it("TOC vazio produz table sem linhas", () => {
    const toc = new TableOfContents();
    const html = toc.to_html();
    assertEquals(
      html.toHTML().replace(/\n\s*/g, "",),
      '<div style="margin-left:15%; margin-right:15%;"><table></table></div>',
    );
  });
});
