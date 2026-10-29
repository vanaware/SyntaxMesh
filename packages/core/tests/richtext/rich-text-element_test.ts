/**
 * Testes de RichTextElement (12.3) e RichTextIntermediate (12.4).
 *
 * A árvore é montada à mão (o parser chega em 12.5/12.6). As expectativas de
 * texto puro/tagged foram conferidas contra o pipeline Ruby real
 * (Element.rb#to_s/#to_tagged + TextFormatter.rb). Para `to_html`, o
 * `XMLElement.rb` injeta espaços de indentação na serialização — comparamos a
 * ESTRUTURA (tag/attrs/texto/escape), não a string exata do Ruby.
 *
 * Fiel ao Ruby: `to_html` espera filhos que são RichTextElement (o parser real
 * embrulha texto inline em nós `:text`). O port é leniente (aceita strings),
 * mas os testes usam `:text` para refletir a árvore real.
 */
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  RichTextElement,
  type RichTextFuncData,
} from "../../src/richtext/rich-text-element.ts";
import type { RichTextCategory, } from "../../src/richtext/rich-text-element.ts";
import { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import { RichTextImage, } from "../../src/richtext/rich-text-image.ts";
import { TableOfContents, } from "../../src/richtext/table-of-contents.ts";
import {
  SimpleXMLElement,
  type XMLElementLike,
} from "../../src/richtext/xml-like.ts";
import {
  type RichTextFunctionArgs,
  RichTextFunctionHandler,
} from "../../src/richtext/handlers/function-handler.ts";

class EchoHandler extends RichTextFunctionHandler {
  to_s(args: RichTextFunctionArgs,): string {
    return `s[${args.a ?? ""}]`;
  }
  to_html(args: RichTextFunctionArgs,): XMLElementLike {
    return new SimpleXMLElement("span", { "data-a": args.a ?? "", },);
  }
  to_tagged(): string {
    return "tagged";
  }
}

function rti(): RichTextIntermediate {
  return new RichTextIntermediate({ inputText: "", },);
}

function make(
  category: RichTextCategory,
  arg?: RichTextElement | string | Array<RichTextElement | string> | null,
  owner = rti(),
): RichTextElement {
  return new RichTextElement(owner, category, arg,);
}

/** Nó de texto inline, como o parser real produz. */
function txt(s: string, owner = rti(),): RichTextElement {
  return new RichTextElement(owner, "text", s,);
}

describe("RichTextElement — construtor (12.3.1)", () => {
  it("aceita string, elemento, array e nulo", () => {
    assertEquals(make("text", "oi",).children, ["oi",],);
    const child = make("text", "x",);
    assertEquals(make("bold", child,).children, [child,],);
    const arr = ["a", child,];
    assertEquals(make("richtext", arr,).children, arr,);
    assertEquals(make("richtext",).children, [],);
  });

  it("lança em arg de tipo inválido (fiel ao Ruby)", () => {
    assertThrows(() => make("bold", 42 as never,));
  });
});

describe("RichTextElement — cleanUp/empty (12.3.2)", () => {
  it("promove os filhos do único paragraph do richtext", () => {
    const inner = ["a", make("bold", "b",),];
    const para = make("paragraph", inner,);
    const root = make("richtext", para,);
    assertEquals(root.cleanUp().children, inner,);
  });

  it("não mexe quando há mais de um filho ou outro tipo", () => {
    const para = make("paragraph", ["a",],);
    const root = make("richtext", [para, make("hline",),],);
    assertEquals(root.cleanUp().children.length, 2,);
    const notPara = make("richtext", make("bold", "x",),);
    assertEquals(notPara.cleanUp().children.length, 1,);
  });

  it("empty só vale para richtext", () => {
    assertEquals(make("richtext",).empty(), true,);
    assertEquals(make("richtext", ["a",],).empty(), false,);
    assertEquals(make("paragraph",).empty(), false,);
  });
});

describe("RichTextElement — to_s (12.3.4)", () => {
  it("paragraph vira bloco + \\n; richtext é pass-through", () => {
    assertEquals(make("paragraph", ["Olá",],).to_s(), "Olá\n\n",);
    assertEquals(make("richtext", ["Olá",],).to_s(), "Olá",);
  });

  it("children_to_s insere espaço após filho com appendSpace", () => {
    const bold = make("bold", "muito",);
    bold.appendSpace = true;
    const root = make("paragraph", ["É ", bold, " bom",],);
    assertEquals(root.children_to_s(), "É muito  bom",);
  });

  it("title1 com/sem sectionNumbers", () => {
    const t = make("title1", "Título",);
    t.data = [1,];
    assertEquals(t.to_s(), "1) Título\n\n",);
    const rt = rti();
    rt.sectionNumbers = false;
    const t2 = new RichTextElement(rt, "title1", "Título",);
    t2.data = [1,];
    assertEquals(t2.to_s(), "Título\n\n",);
  });

  it("hline preenche a largura com '-'", () => {
    const rt = rti();
    rt.lineWidth = 10;
    assertEquals(new RichTextElement(rt, "hline",).to_s(), "----------\n",);
  });

  it("pre aplica preIndent", () => {
    const rt = rti();
    rt.preIndent = 2;
    assertEquals(new RichTextElement(rt, "pre", "code",).to_s(), "  code\n\n",);
  });

  it("bulletitem/numberitem usam o label e o contador", () => {
    const b = make("bulletitem1", txt("item",),);
    assert(b.to_s().includes("* item",),);
    const n = make("numberitem1", "um",);
    n.data = [3,];
    assertEquals(n.to_s().includes("3. um",), true,);
  });

  it("italic/bold/code preservam o texto; htmlblob some", () => {
    assertEquals(make("italic", "itálico",).to_s(), "itálico",);
    assertEquals(make("code", "x=1",).to_s(), "x=1",);
    assertEquals(make("htmlblob", "<b>raw</b>",).to_s(), "",);
  });

  it("img usa altText como conteúdo textual", () => {
    const i = make("img",);
    const img = new RichTextImage("a.png",);
    img.altText = "alternativa";
    i.data = img;
    assertEquals(i.to_s(), "alternativa",);
  });

  it("inlinefunc despacha o handler; ref/href são pass-through", () => {
    const rt = rti();
    rt.registerFunctionHandler(new EchoHandler("echo",),);
    const f = new RichTextElement(rt, "inlinefunc",);
    f.data = ["echo", { a: "1", },] as RichTextFuncData;
    assertEquals(f.to_s(), "s[1]",);
    const ref = new RichTextElement(rt, "ref", txt("label", rt,),);
    ref.data = "snippet";
    assertEquals(ref.to_s(), "label",);
  });

  it("categoria desconhecida lança", () => {
    assertThrows(() => make("nope" as RichTextCategory,).to_s());
  });
});

describe("RichTextElement — to_tagged (12.3.5)", () => {
  it("mapeia categorias para tags com contadores", () => {
    assertEquals(make("paragraph", "oi",).to_tagged(), "<p>oi</p>\n\n",);
    const t2 = make("title2", "Seção",);
    t2.data = [1, 2,];
    assertEquals(t2.to_tagged(), "<h2>1.2 Seção</h2>\n\n",);
    assertEquals(make("bulletitem2", "x",).to_tagged(), "<li> * x</li>\n",);
    const bl = make("bulletlist1", make("bulletitem1", "x",),);
    assertEquals(bl.to_tagged(), "<ul><li>* x</li>\n</ul>",);
    assertEquals(make("text", "bruto",).to_tagged(), "[bruto]",);
  });

  it("appendSpace insere espaço após o filho marcado", () => {
    const b = make("bold", "negrito",);
    b.appendSpace = true;
    assertEquals(
      make("paragraph", [b, "fim",],).to_tagged(),
      "<p><b>negrito</b> fim</p>\n\n",
    );
  });

  it("img/ref/href/fontCol serializam seus dados", () => {
    const i = make("img",);
    i.data = new RichTextImage("a.png",);
    assertEquals(i.to_tagged(), '<img file="a.png"/>',);
    const r = make("ref", "rot",);
    r.data = "algo";
    assertEquals(r.to_tagged(), '<ref data="algo">rot</ref>',);
    const rt = rti();
    rt.linkTarget = "_blank";
    const h = new RichTextElement(rt, "href", "sítio",);
    h.data = "http://x";
    assertEquals(
      h.to_tagged(),
      '<a href="http://x" target="_blank">sítio</a>',
    );
    const f = make("fontCol", "vermelho",);
    f.data = "red";
    assertEquals(f.to_tagged(), "<fcol:red>vermelho</fcol>",);
  });

  it("blockfunc ordena e escapa aspas; inlinefunc idem sem escape", () => {
    const bf = make("blockfunc",);
    bf.data = ["q", { b: '2"a', a: "1", },] as RichTextFuncData;
    assertEquals(bf.to_tagged(), '<blockfunc:q a="1" b="2\\"a"/>',);
    const inf = make("inlinefunc",);
    inf.data = ["q", { a: "1", },] as RichTextFuncData;
    assertEquals(inf.to_tagged(), '<inlinefunc:q a="1"/>',);
  });
});

describe("RichTextElement — to_html (12.3.6)", () => {
  it("richtext é div em blockMode e span em inline", () => {
    const rt = rti();
    assertEquals(
      new RichTextElement(rt, "richtext", ["t",],).to_html()!.tag,
      "div",
    );
    rt.blockMode = false;
    assertEquals(
      new RichTextElement(rt, "richtext", ["t",],).to_html()!.tag,
      "span",
    );
  });

  it("title gera h1 com id sanitizado e número quando sectionNumbers", () => {
    const t = make("title1", txt("Introdução",),);
    t.data = [2,];
    const html = t.to_html()!;
    assertEquals(html.tag, "h1",);
    assertEquals(html.attrs["id"], "Introduo",);
    assertEquals(html.toHTML(), '<h1 id="Introduo">2 Introdução</h1>',);
  });

  it("cssClass vira class só nos elementos que a recebem", () => {
    const rt = rti();
    rt.cssClass = "doc";
    const p = new RichTextElement(rt, "paragraph", [txt("x", rt,),],);
    assertEquals(p.to_html()!.attrs["class"], "doc",);
    const ul = new RichTextElement(rt, "bulletlist1",);
    assertEquals(ul.to_html()!.attrs["class"], undefined,);
  });

  it("pre vira div>pre com codesection e escapa o texto", () => {
    const p = make("pre", "a < b",);
    const html = p.to_html()!;
    assertEquals(html.tag, "div",);
    assertEquals(html.attrs["codesection"], "1",);
    const pre = html.children[0] as SimpleXMLElement;
    assertEquals(pre.tag, "pre",);
    assertEquals(
      p.to_html()!.toHTML(),
      '<div codesection="1"><pre codesection="1">a &lt; b</pre></div>',
    );
  });

  it("hline não tem filhos; p/i/ul/li/code mapeiam direto", () => {
    assertEquals(make("hline",).to_html()!.tag, "hr",);
    assertEquals(
      make("paragraph", [txt("x",),],).to_html()!.toHTML(),
      "<p>x</p>",
    );
    assertEquals(
      make("italic", [txt("y",),],).to_html()!.toHTML(),
      "<i>y</i>",
    );
    assertEquals(make("bulletlist3",).to_html()!.tag, "ul",);
    assertEquals(make("numberitem4",).to_html()!.tag, "li",);
    assertEquals(
      make("code", [txt("c",),],).to_html()!.toHTML(),
      "<code>c</code>",
    );
  });

  it("img vira <object> por extensão; desconhecida → null", () => {
    const i = make("img",);
    const img = new RichTextImage("fig.PNG",);
    img.altText = "alt";
    img.verticalAlign = "top";
    i.data = img;
    const html = i.to_html()!;
    assertEquals(html.tag, "object",);
    assertEquals(html.attrs["type"], "image/png",);
    assertEquals(html.attrs["data"], "fig.PNG",);
    assertEquals(html.attrs["alt"], "alt",);
    assertEquals(html.attrs["style"], "vertical-align:top; ",);
    const bad = make("img",);
    bad.data = new RichTextImage("x.exe",);
    assertEquals(bad.to_html(), null,);
  });

  it("ref vira <a href=….html[#âncora]>; href ganha target do RTI", () => {
    const rt = rti();
    const r = new RichTextElement(rt, "ref", txt("link", rt,),);
    r.data = "snip#anc";
    assertEquals(r.to_html()!.toHTML(), '<a href="snip.html#anc">link</a>',);
    rt.linkTarget = "_top";
    const h = new RichTextElement(rt, "href", txt("ir", rt,),);
    h.data = "http://e.u";
    assertEquals(
      h.to_html()!.toHTML(),
      '<a href="http://e.u" target="_top">ir</a>',
    );
  });

  it("blockfunc/inlinefunc delegam ao handler; sem handler lança", () => {
    const rt = rti();
    rt.registerFunctionHandler(new EchoHandler("echo",),);
    const f = new RichTextElement(rt, "inlinefunc",);
    f.data = ["echo", { a: "v", },] as RichTextFuncData;
    assertEquals(f.to_html()!.toHTML(), '<span data-a="v"></span>',);
    const g = new RichTextElement(rt, "blockfunc",);
    g.data = ["other", null,] as RichTextFuncData;
    assertThrows(() => g.to_html());
  });

  it("text vira texto escapado; htmlblob vira blob cru", () => {
    assertEquals(make("text", "a<b",).to_html()!.toHTML(), "a&lt;b",);
    assertEquals(
      make("htmlblob", "<b>x</b>",).to_html()!.toHTML(),
      "<b>x</b>",
    );
  });

  it("appendSpace vira nó de espaço ' ' entre filhos no HTML", () => {
    const rt = rti();
    const b = new RichTextElement(rt, "bold", txt("n", rt,),);
    b.appendSpace = true;
    const p = new RichTextElement(rt, "paragraph", [b, txt("c", rt,),],);
    assertEquals(p.to_html()!.toHTML(), "<p><b>n</b> c</p>",);
  });
});

describe("RichTextElement — TOC e refs (12.3.3)", () => {
  it("tableOfContents coleta títulos 1-4 recursando pelos outros nós", () => {
    const t1 = make("title1", "Capítulo",);
    t1.data = [1,];
    const t2 = make("title2", "Seção",);
    t2.data = [1, 2,];
    const root = make("richtext", [make("paragraph", ["intro",],), t1, t2,],);
    const toc = new TableOfContents();
    root.tableOfContents(toc, "file1",);
    const entries = [...toc,];
    assertEquals(entries.length, 2,);
    assertEquals(entries[0]!.number, "1 ",);
    assertEquals(entries[0]!.title, "Capítulo",);
    assertEquals(entries[0]!.file, "file1",);
    assertEquals(entries[1]!.number, "1.2 ",);
  });

  it("internalReferences dedupe e ignora refs externas (com ':')", () => {
    const r1 = make("ref", "a",);
    r1.data = "snip";
    const r2 = make("ref", "b",);
    r2.data = "snip";
    const ext = make("ref", "c",);
    ext.data = "http://x";
    const root = make("richtext", [r1, make("bold", r2,), ext,],);
    assertEquals(root.internalReferences(), ["snip",],);
  });

  it("convertToID mantém alfanuméricos, espaço→'_' (um chomp)", () => {
    assertEquals(make("text",).convertToID("Hello World ",), "Hello_World",);
    assertEquals(make("text",).convertToID("A!B",), "AB",);
  });
});

describe("RichTextIntermediate (12.4)", () => {
  it("defaults fiéis ao Ruby", () => {
    const rt = rti();
    assertEquals(rt.tree, null,);
    assertEquals(rt.blockMode, true,);
    assertEquals(rt.sectionNumbers, true,);
    assertEquals(rt.lineWidth, 80,);
    assertEquals(rt.indent, 0,);
    assertEquals(rt.parIndent, 0,);
    assertEquals(rt.listIndent, 1,);
    assertEquals(rt.preIndent, 0,);
    assertEquals(rt.linkTarget, null,);
    assertEquals(rt.cssClass, null,);
  });

  it("registerFunctionHandler/functionHandler", () => {
    const rt = rti();
    const h = new EchoHandler("echo",);
    rt.registerFunctionHandler(h,);
    assertEquals(rt.functionHandler("echo",), h,);
    assertEquals(rt.functionHandler("outro",), null,);
    assertThrows(() => rt.registerFunctionHandler(null as never,));
  });

  it("setQuery propaga só a handlers que o implementam", () => {
    const rt = rti();
    const calls: unknown[] = [];
    class Q extends EchoHandler {
      setQuery(q: unknown,): void {
        calls.push(q,);
      }
    }
    rt.registerFunctionHandler(new Q("q",),);
    rt.registerFunctionHandler(new EchoHandler("plain",),);
    rt.setQuery({ marker: 1, } as never,);
    assertEquals(calls.length, 1,);
  });

  it("delega empty/to_s/to_tagged/tableOfContents/internalReferences", () => {
    const rt = rti();
    assertEquals(rt.empty(), true,);
    assertEquals(rt.to_s(), "",);
    assertEquals(rt.to_tagged(), "",);
    assertEquals(rt.internalReferences(), [],);
    assertEquals(rt.to_html()!.tag, "span",);

    const para = new RichTextElement(rt, "paragraph", [txt("x", rt,),],);
    rt.tree = new RichTextElement(rt, "richtext", para,).cleanUp();
    assertEquals(rt.empty(), false,);
    assertEquals(rt.to_s(), "x",); // chomp das quebras finais
    // cleanUp promoveu os filhos do paragraph: a raiz tagged é o div do
    // richtext envolvendo o texto nu do filho :text.
    assertEquals(rt.to_tagged(), "<div>[x]</div>",);
  });

  it("internalReferences/TOC delegam para a árvore", () => {
    const rt = rti();
    const t = new RichTextElement(rt, "title1", "Cap",);
    t.data = [1,];
    rt.tree = t;
    const toc = new TableOfContents();
    rt.tableOfContents(toc, "f",);
    assertEquals([...toc,].length, 1,);
    const r = new RichTextElement(rt, "ref", "rot",);
    r.data = "snip";
    rt.tree = new RichTextElement(rt, "richtext", r,);
    assertEquals(rt.internalReferences(), ["snip",],);
  });
});
