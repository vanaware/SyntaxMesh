/**
 * Testes de `parseMdast` (Fase 13.1) — AST `mdast` CommonMark + GFM.
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.1)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  parseMdast,
  parseMdastInline,
} from "../../src/markdown/parse-mdast.ts";
import type { MdastRoot, } from "../../src/markdown/types.ts";

/** Visão estrutural mínima de um nó `mdast`, para as asserções. */
interface NodeLike {
  type: string;
  children?: NodeLike[];
  value?: string;
  depth?: number;
  lang?: string | null;
  url?: string;
  alt?: string;
  title?: string | null;
  ordered?: boolean;
  checked?: boolean | null;
}

const node = (n: unknown,): NodeLike => n as NodeLike;

/** Primeiro filho da raiz. */
function first(root: MdastRoot,): NodeLike {
  const child = root.children[0];
  assert(child, "AST vazia",);
  return node(child,);
}

/** Filhos de um nó (ou `[]`). */
function kids(n: NodeLike,): NodeLike[] {
  return n.children ?? [];
}

/** Todos os `type` da subárvore, em ordem de visita. */
function types(n: NodeLike,): string[] {
  const out: string[] = [n.type,];
  for (const c of kids(n,)) out.push(...types(c,),);
  return out;
}

describe("parseMdast (13.1)", () => {
  it("retorna raiz `root` com children", () => {
    const ast = parseMdast("oi",);
    assertEquals(ast.type, "root",);
    assertEquals(ast.children.length, 1,);
  });

  describe("headings depth 1-6", () => {
    for (const depth of [1, 2, 3, 4, 5, 6,]) {
      it(`depth ${depth}`, () => {
        const h = first(parseMdast(`${"#".repeat(depth,)} Título`,),);
        assertEquals(h.type, "heading",);
        assertEquals(h.depth, depth,);
      });
    }
  });

  it("paragraph", () => {
    const p = first(parseMdast("Um parágrafo.",),);
    assertEquals(p.type, "paragraph",);
    assertEquals(kids(p,)[0]!.value, "Um parágrafo.",);
  });

  it("strong (**bold**)", () => {
    const p = first(parseMdast("**negrito**",),);
    assertEquals(kids(p,)[0]!.type, "strong",);
    assertEquals(kids(kids(p,)[0]!,)[0]!.value, "negrito",);
  });

  it("emphasis (*itálico*)", () => {
    const p = first(parseMdast("*itálico*",),);
    assertEquals(kids(p,)[0]!.type, "emphasis",);
  });

  it("list unordered com listItem", () => {
    const l = first(parseMdast("- a\n- b\n",),);
    assertEquals(l.type, "list",);
    assertEquals(l.ordered, false,);
    assertEquals(kids(l,).length, 2,);
    assertEquals(kids(l,)[0]!.type, "listItem",);
  });

  it("list ordered", () => {
    const l = first(parseMdast("1. um\n2. dois\n",),);
    assertEquals(l.type, "list",);
    assertEquals(l.ordered, true,);
    assertEquals(kids(l,).length, 2,);
  });

  it("list aninhada (bullet dentro de bullet)", () => {
    const l = first(parseMdast("- a\n  - b\n",),);
    const item = kids(l,)[0]!;
    assertEquals(item.type, "listItem",);
    assertEquals(kids(item,).length, 2, "paragraph + sublista",);
    assertEquals(kids(item,)[1]!.type, "list",);
  });

  it("code block fenced", () => {
    const c = first(parseMdast("```js\nfoo()\n```",),);
    assertEquals(c.type, "code",);
    assertEquals(c.lang, "js",);
    assertEquals(c.value, "foo()",);
  });

  it("code block indentado (4 espaços)", () => {
    const c = first(parseMdast("    bar()\n",),);
    assertEquals(c.type, "code",);
    assertEquals(c.value, "bar()",);
  });

  it("inlineCode", () => {
    const p = first(parseMdast("use `x = 1` aqui",),);
    assert(types(p,).includes("inlineCode",),);
    const code = kids(p,).find((c,) => c.type === "inlineCode");
    assertEquals(code!.value, "x = 1",);
  });

  it("link com url e title", () => {
    const p = first(parseMdast('[site](http://a.b "Título")',),);
    const link = kids(p,)[0]!;
    assertEquals(link.type, "link",);
    assertEquals(link.url, "http://a.b",);
    assertEquals(link.title, "Título",);
    assertEquals(kids(link,)[0]!.value, "site",);
  });

  it("image com alt e url", () => {
    const p = first(parseMdast("![logo](img/logo.png)",),);
    const image = kids(p,)[0]!;
    assertEquals(image.type, "image",);
    assertEquals(image.url, "img/logo.png",);
    assertEquals(image.alt, "logo",);
  });

  it("blockquote embrulha paragraph", () => {
    const b = first(parseMdast("> citado",),);
    assertEquals(b.type, "blockquote",);
    assertEquals(kids(b,)[0]!.type, "paragraph",);
  });

  it("thematicBreak (---)", () => {
    assertEquals(first(parseMdast("---\n",),).type, "thematicBreak",);
  });

  it("table GFM com rows e cells", () => {
    const t = first(parseMdast("| a | b |\n|---|---|\n| 1 | 2 |\n",),);
    assertEquals(t.type, "table",);
    assertEquals(kids(t,).length, 2, "linha de cabeça + linha de dados",);
    const row = kids(t,)[0]!;
    assertEquals(row.type, "tableRow",);
    assertEquals(kids(row,).length, 2,);
    assertEquals(kids(row,)[0]!.type, "tableCell",);
    assertEquals(kids(kids(row,)[0]!,)[0]!.value, "a",);
  });

  it("strikethrough GFM (~~x~~) vira `delete`", () => {
    const p = first(parseMdast("riscado ~~fora~~ fim",),);
    assert(types(p,).includes("delete",), JSON.stringify(p,),);
  });

  it("task list GFM (`- [ ]`) preserva o item", () => {
    const l = first(parseMdast("- [x] feito\n- [ ] pendente\n",),);
    assertEquals(l.type, "list",);
    assertEquals(kids(l,).length, 2,);
    assertEquals(node(kids(l,)[0]!,).checked, true,);
  });

  it("autolink GFM (http://…) vira link", () => {
    const p = first(parseMdast("veja http://x.y ok",),);
    const link = kids(p,).find((c,) => c.type === "link");
    assert(link, "autolink deveria produzir link",);
    assertEquals(link!.url, "http://x.y",);
  });

  it("html inline vira nós `html` (abertura e fechamento)", () => {
    const p = first(parseMdast("<b>negrito</b> texto",),);
    const htmls = kids(p,).filter((c,) => c.type === "html");
    assertEquals(htmls.length, 2,);
    assertEquals(htmls[0]!.value, "<b>",);
    assertEquals(htmls[1]!.value, "</b>",);
  });

  it("html em bloco vira nó `html` na raiz", () => {
    const h = first(parseMdast("<div>\n  <span>x</span>\n</div>\n",),);
    assertEquals(h.type, "html",);
    assert((h.value ?? "").includes("<span>",), h.value,);
  });

  it("break (\\ no fim da linha) entre texts", () => {
    const p = first(parseMdast("linha 1\\\nlinha 2",),);
    assert(types(p,).includes("break",), JSON.stringify(p,),);
    assertEquals(types(p,).filter((t,) => t === "text").length, 2,);
  });

  it("text puro vira um único nó `text`", () => {
    const p = first(parseMdast("apenas texto",),);
    assertEquals(kids(p,).length, 1,);
    assertEquals(kids(p,)[0]!.type, "text",);
  });

  it("extensões markdown não-interpretadas ficam como texto cru", () => {
    const p = first(parseMdast("<-effort-> e [[query:attribute=effort]]",),);
    assertEquals(p.type, "paragraph",);
    assertEquals(kids(p,)[0]!.type, "text",);
    assert((kids(p,)[0]!.value ?? "").includes("<-effort->",),);
  });
});

describe("parseMdastInline (conteúdo de <fcol:…>)", () => {
  it("parágrafo único devolve os filhos inline", () => {
    const inlines = parseMdastInline("**a** e b",) as unknown as NodeLike[];
    assertEquals(inlines.length, 2,);
    assertEquals(inlines[0]!.type, "strong",);
    assertEquals(inlines[1]!.value, " e b",);
  });

  it("texto vazio devolve array vazio", () => {
    assertEquals(parseMdastInline("",), [],);
  });

  it("conteúdo não-parágrafo preserva o texto cru", () => {
    const inlines = parseMdastInline("# tÍTULO",) as unknown as NodeLike[];
    assertEquals(inlines.length, 1,);
    assertEquals(inlines[0]!.type, "text",);
    assertEquals(inlines[0]!.value, "# tÍTULO",);
  });
});
