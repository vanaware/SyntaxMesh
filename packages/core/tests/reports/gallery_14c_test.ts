/**
 * 14C.0.9 — `picturesToHtml`: galeria HTML com corte apenas na SAÍDA.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { Picture, } from "../../src/model/picture.ts";
import {
  picturesFromDetails,
  picturesToHtml,
} from "../../src/reports/gallery.ts";

function pics(n: number,): Picture[] {
  return Array.from({ length: n, }, (_, i,) => new Picture(`img/${i}.png`,),);
}

describe("picturesToHtml (14C.0.9)", () => {
  it("respeita maxPictures cortando só a saída (entrada intacta)", () => {
    const list = pics(5,);
    const html = picturesToHtml(list, 2,);
    assertEquals(html.split("<img",).length - 1, 2,);
    assertEquals(list.length, 5, "a entrada não pode ser mutada",);
    assert(html.startsWith('<div class="tj_gallery">',), html,);
    assert(html.endsWith("</div>",), html,);
    assert(html.includes("img/0.png",),);
    assert(!html.includes("img/2.png",),);
  });

  it("sem limite renderiza todas; lista vazia devolve string vazia", () => {
    assertEquals(picturesToHtml(pics(3,),).split("<img",).length - 1, 3,);
    assertEquals(picturesToHtml([],), "",);
    assertEquals(picturesToHtml(pics(2,), null,), picturesToHtml(pics(2,),),);
  });
});

describe("picturesFromDetails (14C.3.7)", () => {
  it("extrai imagens markdown na ordem de declaração, sem deduplicar", () => {
    const details = [
      "Vistoria concluída.",
      "![Fachada](img/fachada.png)",
      "Texto intermediário.",
      "![](img/sem-alt.jpg)",
      "![Repetida](img/fachada.png)",
    ].join("\n",);

    const found = picturesFromDetails(details,);
    assertEquals(found.map((p,) => p.path), [
      "img/fachada.png",
      "img/sem-alt.jpg",
      "img/fachada.png",
    ],);
    assertEquals(found[0]!.alt, "Fachada",);
    assertEquals(found[1]!.alt, null, "sem alt = null",);
  });

  it("extrai imagens richtext e ignora corpo vazio/inexistente", () => {
    const details =
      "Obra fotografada.\n[[Image:img/rt1.png|Foto frontal|300px]]\n[[File:img/rt2.png]]";
    const found = picturesFromDetails(details,);
    assertEquals(found.map((p,) => p.path), ["img/rt1.png", "img/rt2.png",],);
    assertEquals(found[0]!.alt, "Foto frontal",);
    assertEquals(found[1]!.alt, null,);

    assertEquals(picturesFromDetails(null,), [],);
    assertEquals(picturesFromDetails(undefined,), [],);
    assertEquals(picturesFromDetails("",), [],);
    assertEquals(picturesFromDetails("sem imagens aqui",), [],);
  });
});
