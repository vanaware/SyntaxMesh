/**
 * 14C.0.8 — `Picture.to_html()`: `<img>`/`<figure>` serializável (ADR 027,
 * DOM-free), com URL externa intacta, relativo preservado (ou resolvido por
 * hook síncrono), alt/width/align e caption via figcaption.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { Picture, } from "../../src/model/picture.ts";

describe("Picture.to_html (14C.0.8)", () => {
  it("URL externa passa intacta como <img> simples", () => {
    const p = new Picture("https://cdn.example.com/a.png",);
    const html = p.to_html().toHTML();
    assertEquals(
      html,
      // `img` não é void no XMLElement real (sem `selfClosing`): assim como
      // no Ruby (`ReportTableCell`), renderiza `<img ...></img>`.
      '<img alt="" src="https://cdn.example.com/a.png"></img>',
    );
  });

  it("caminho relativo é preservado; caption embrulha em figure/figcaption", () => {
    const p = new Picture("img/aca.png",);
    p.caption = "Peça";
    const html = p.to_html().toHTML();
    assertEquals(
      html,
      '<figure class="tj_figure">\n' +
        ' <img alt="" src="img/aca.png"></img>\n' +
        " <figcaption>Peça</figcaption>\n" +
        "</figure>",
    );
  });

  it("hook resolveRelative substitui o src relativo (13.14/Fase 19)", () => {
    const p = new Picture("img/aca.png",);
    const html = p.to_html({
      resolveRelative: (path,) => `store://${path}`,
    },).toHTML();
    assertIn(html, 'src="store://img/aca.png"',);
  });

  it("align vira classe; width e alt entram nos atributos; sem caption = img", () => {
    const p = new Picture("a.png",);
    p.align = "center";
    p.width = 300;
    p.alt = "uma peça";
    const html = p.to_html().toHTML();
    assertIn(html, "<img",);
    assertIn(html, 'alt="uma peça"',);
    assertIn(html, 'width="300"',);
    assertIn(html, 'class="tj_picture_align_center"',);
    assertEquals(html.includes("<figure>",), false, html,);
  });

  it("caption + align propagam a classe também ao figure", () => {
    const p = new Picture("a.png",);
    p.align = "left";
    p.caption = "Legenda";
    const html = p.to_html().toHTML();
    assertIn(html, '<figure class="tj_figure tj_figure_align_left">',);
    assertIn(html, 'class="tj_picture_align_left"',);
  });
});

/** `assert(x.includes(sub))` com mensagem útil. */
function assertIn(haystack: string, needle: string,): void {
  if (!haystack.includes(needle,)) {
    throw new Error(`esperado conter ${needle} em: ${haystack}`,);
  }
}
