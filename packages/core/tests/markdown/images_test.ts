/**
 * Testes de resolução de imagens em Markdown (Adendo 13.14).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown-tarefas.md (13.14)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  isExternalImageRef,
  resolveImageRef,
} from "../../src/markdown/extensions/images.ts";
import type { ImageStore, } from "../../src/markdown/extensions/images.ts";
import { MarkdownFactory, } from "../../src/markdown/factory.ts";
import { RichTextImage, } from "../../src/richtext/rich-text-image.ts";
import { RichTextElement, } from "../../src/richtext/rich-text-element.ts";

/** Store fake simulando OPFS (13.14.5). */
function fakeOpfs(paths: Record<string, string>,): ImageStore {
  return {
    has: (p: string,) => Promise.resolve(p in paths,),
    resolve: (p: string,) => Promise.resolve(paths[p] ?? null,),
  };
}

describe("isExternalImageRef (13.14.1)", () => {
  it("http(s) é externa", () => {
    assert(isExternalImageRef("http://x.com/a.png",),);
    assert(isExternalImageRef("https://cdn.example.com/l.png",),);
  });
  it("protocol-relative é externa", () => {
    assert(isExternalImageRef("//cdn.com/a.png",),);
  });
  it("data URI é externa", () => {
    assert(isExternalImageRef("data:image/png;base64,AAAA",),);
  });
  it("caminho relativo não é externa", () => {
    assert(!isExternalImageRef("img/a.png",),);
    assert(!isExternalImageRef("./a.png",),);
    assert(!isExternalImageRef("/absolute/a.png",),);
  });
});

describe("resolveImageRef (13.14.1-13.14.3)", () => {
  it("URL externa passa intacta (13.14.1)", async () => {
    const r = await resolveImageRef("https://cdn.example.com/l.png", {
      alt: "logo",
    },);
    assertEquals(r.origin, "external",);
    assertEquals(r.src, "https://cdn.example.com/l.png",);
    assertEquals(r.alt, "logo",);
  });

  it("relativa presente no OPFS usa store (13.14.2)", async () => {
    const store = fakeOpfs({ "a.png": "blob:opfs/a", },);
    const r = await resolveImageRef("a.png", { store, },);
    assertEquals(r.origin, "opfs",);
    assertEquals(r.src, "blob:opfs/a",);
  });

  it("relativa ausente no OPFS cai em dataDirs (13.14.2)", async () => {
    const store = fakeOpfs({},);
    const r = await resolveImageRef("a.png", {
      store,
      dataDirs: ["/data/project",],
    },);
    assertEquals(r.origin, "dataDir",);
    assertEquals(r.src, "/data/project/a.png",);
  });

  it("sem store mas com dataDirs resolve em dataDir (13.14.2)", async () => {
    const r = await resolveImageRef("sub/a.png", {
      dataDirs: ["images/",],
    },);
    assertEquals(r.origin, "dataDir",);
    assertEquals(r.src, "images/sub/a.png",);
  });

  it("sem store e sem dataDirs fica unresolved (cru)", async () => {
    const r = await resolveImageRef("a.png", { alt: null, },);
    assertEquals(r.origin, "unresolved",);
    assertEquals(r.src, "a.png",);
  });

  it("armazém que devolve null cai em dataDirs (13.14.3)", async () => {
    const store: ImageStore = {
      has: () => Promise.resolve(true,),
      resolve: () => Promise.resolve(null,),
    };
    const r = await resolveImageRef("a.png", {
      store,
      dataDirs: ["/d",],
    },);
    assertEquals(r.origin, "dataDir",);
    assertEquals(r.src, "/d/a.png",);
  });
});

describe("Imagens via MarkdownFactory (13.14 alt/external)", () => {
  const factory = new MarkdownFactory(null,);

  it("URL externa preservada intacta no RichTextImage.fileName", () => {
    const rti = factory.create("![logo](https://cdn.example.com/l.png)",);
    const para = rti.tree!.children[0] as RichTextElement;
    const imgEl = para.children.find((c,) =>
      c instanceof RichTextElement && c.category === "img"
    ) as RichTextElement;
    const img = imgEl.data as RichTextImage;
    assertEquals(img.fileName, "https://cdn.example.com/l.png",);
  });

  it("alt text é capturado", () => {
    const rti = factory.create("![description](a.png)",);
    const para = rti.tree!.children[0] as RichTextElement;
    const imgEl = para.children.find((c,) =>
      c instanceof RichTextElement && c.category === "img"
    ) as RichTextElement;
    const img = imgEl.data as RichTextImage;
    assertEquals(img.altText, "description",);
  });

  it("sem alt mantém altText null", () => {
    const rti = factory.create("![](a.png)",);
    const para = rti.tree!.children[0] as RichTextElement;
    const imgEl = para.children.find((c,) =>
      c instanceof RichTextElement && c.category === "img"
    ) as RichTextElement;
    const img = imgEl.data as RichTextImage;
    assertEquals(img.altText, null,);
  });
});
