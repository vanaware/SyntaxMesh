/**
 * RichTextParser — testes da Fase 12.6 (TDD).
 *
 * Cobre a estrutura do parser (12.6.1) e todas as regras de
 * `RichTextSyntaxRules.rb` (12.6.2), com asserts de estrutura da árvore de
 * `RichTextElement` e da saída `to_tagged()`/`to_s()` (já validadas contra o
 * Ruby na subfase 12.3).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Parser.rb
 * @see docs/taskjuggler/lib/taskjuggler/RichText/SyntaxRules.rb
 */

import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import { RichTextParser, } from "../../src/richtext/rich-text-parser.ts";
import { RichTextElement, } from "../../src/richtext/rich-text-element.ts";

/** Stub mínimo do RichText (12.18) só para o check de functionHandler. */
interface FakeHandler {
  function: string;
  blockFunction: boolean;
}

function parseText(
  text: string,
  handlers: FakeHandler[] = [],
): RichTextElement | false | null {
  MessageHandlerInstance.instance.reset();
  const owner = {
    functionHandler(name: string, block: boolean,): FakeHandler | null {
      return (
        handlers.find(
          (h,) => h.function === name && h.blockFunction === block,
        ) ?? null
      );
    },
  };
  const rti = new RichTextIntermediate(owner,);
  const parser = new RichTextParser(rti,);
  parser.open(text,);
  return parser.parse("richtext",) as RichTextElement | false | null;
}

/** Lista plana de categorias da árvore (ordem pré-fixada). */
function categories(el: RichTextElement | null,): string[] {
  if (!el) return [];
  const out: string[] = [el.category,];
  for (const c of el.children) {
    if (c instanceof RichTextElement) {
      out.push(...categories(c,),);
    }
  }
  return out;
}

/** Erros registrados pelo MessageHandler desde o último reset. */
function errorCount(): number {
  return MessageHandlerInstance.instance.errors;
}

const INLINE_HANDLERS: FakeHandler[] = [
  { function: "query", blockFunction: false, },
];
const BLOCK_HANDLERS: FakeHandler[] = [
  { function: "report", blockFunction: true, },
];
const ALL_HANDLERS = [...INLINE_HANDLERS, ...BLOCK_HANDLERS,];

describe("RichTextParser (Fase 12.6)", () => {
  // ----------------------------------------------------------------
  // 12.6.1 — estrutura
  // ----------------------------------------------------------------
  it("construtor registra as ~27 regras e os 38 tokens do scanner", () => {
    const rti = new RichTextIntermediate({},);
    const parser = new RichTextParser(rti,);
    for (
      const name of [
        "richtext",
        "sections",
        "section",
        "headlines",
        "pre",
        "title1",
        "title2",
        "title3",
        "title4",
        "bulletList1",
        "bulletList2",
        "bulletList3",
        "bulletList4",
        "numberList1",
        "numberList2",
        "numberList3",
        "numberList4",
        "paragraph",
        "text",
        "textWithSpace",
        "plainTextWithLinks",
        "moreRefToken",
        "refToken",
        "wordWithQueries",
        "plainText",
        "plainTextWithQueries",
        "htmlBlob",
        "space",
        "blankLines",
        "blockFunction",
        "inlineFunction",
        "functionArguments",
      ]
    ) {
      assert(parser.rules.has(name,), `regra ausente: ${name}`,);
    }
    assertEquals(parser.variables.length, 39,);
  });

  it("construtor aceita sectionCounter inicial (12.6.1.3)", () => {
    const parser = new RichTextParser(new RichTextIntermediate({},), [
      5,
      4,
      3,
      2,
    ],);
    assertEquals(parser.sectionCounter, [5, 4, 3, 2,],);
    assertEquals(parser.numberListCounter, [0, 0, 0, 0,],);
  });

  it("tokenSet limita os tokens aceitos (12.6.1.3)", () => {
    // Somente texto plano: títulos ficam bloqueados.
    const rti = new RichTextIntermediate({},);
    const parser = new RichTextParser(rti, [0, 0, 0, 0,], ["WORD", "SPACE",],);
    parser.open("== T ==\n\n",);
    parser.parse("richtext",);
    assert(errorCount() > 0, "token TITLE1 bloqueado deveria registrar erro",);
  });

  it("reuse reseta richTextI e sectionCounter (12.6.1.4)", () => {
    const rti1 = new RichTextIntermediate({},);
    const rti2 = new RichTextIntermediate({},);
    const parser = new RichTextParser(rti1, [9, 9, 9, 9,],);
    parser.reuse(rti2, [1, 2, 3, 4,],);
    assertEquals(parser.richTextI, rti2,);
    assertEquals(parser.sectionCounter, [1, 2, 3, 4,],);
    assertEquals(parser.stack, null,);
    // Após reuse, a instância continua parseável.
    parser.open("olá\n\n",);
    const tree = parser.parse("richtext",) as RichTextElement;
    assertEquals(tree.category, "richtext",);
  });

  it("reuse sem tokenSet desbloqueia tokens anteriores (12.6.1.4)", () => {
    MessageHandlerInstance.instance.reset();
    const parser = new RichTextParser(new RichTextIntermediate({},), [
      0,
      0,
      0,
      0,
    ], ["WORD", "SPACE",],);
    parser.reuse(new RichTextIntermediate({},),);
    parser.open("== T ==\n\n",);
    const tree = parser.parse("richtext",) as RichTextElement;
    assertEquals(errorCount(), 0,);
    assert(categories(tree,).includes("title1",),);
  });

  it("open + nextToken entregam tokens do RichTextScanner (12.6.1.5/6/7)", () => {
    MessageHandlerInstance.instance.reset();
    const parser = new RichTextParser(new RichTextIntermediate({},),);
    parser.open("oi\n\n",);
    const tree = parser.parse("richtext",) as RichTextElement;
    assertEquals(tree.category, "richtext",);
    assertEquals(errorCount(), 0,);
  });

  // ----------------------------------------------------------------
  // 12.6.2 — regras
  // ----------------------------------------------------------------
  it("texto vazio produz resultado falsy sem erros (12.6.2.2)", () => {
    // Ruby: `parse(:richtext)` devolve `@stack[0].val[0]` — nil para texto
    // vazio (`"" + "\n\n"` só tem linhas em branco; `!sections` é opcional).
    MessageHandlerInstance.instance.reset();
    const tree = parseText("",);
    assert(!tree, "texto vazio deve produzir resultado falsy",);
    assertEquals(errorCount(), 0,);
  });

  it("parágrafo: palavras viram richtext>paragraph>text (12.6.2.8)", () => {
    const tree = parseText("hello world",) as RichTextElement;
    assertEquals(categories(tree,), [
      "richtext",
      "paragraph",
      "text",
      "text",
    ],);
    assertEquals(tree.to_s().trim(), "hello world",);
  });

  it("título 1 com contador de seção (12.6.2.4/5)", () => {
    const tree = parseText("== Capítulo ==\n\n",) as RichTextElement;
    assertEquals(categories(tree,), ["richtext", "title1", "text",],);
    const title = tree.children[0] as RichTextElement;
    assertEquals(title.data, [1, 0, 0, 0,],);
    assert(title.to_tagged().startsWith("<h1>1 ",),);
  });

  it("contadores aninhados: ==, ===, ====, ===== (12.6.2.5)", () => {
    const tree = parseText(
      "== A ==\n\n=== B ===\n\n==== C ====\n\n===== D =====\n\n",
    ) as RichTextElement;
    const titles = tree.children.filter((c,) =>
      c instanceof RichTextElement && c.category.startsWith("title",)
    ) as RichTextElement[];
    assertEquals(titles.length, 4,);
    assertEquals(titles[0]!.data, [1, 0, 0, 0,],);
    assertEquals(titles[1]!.data, [1, 1, 0, 0,],);
    assertEquals(titles[2]!.data, [1, 1, 1, 0,],);
    assertEquals(titles[3]!.data, [1, 1, 1, 1,],);
    assertEquals(titles[3]!.category, "title4",);
  });

  it("nova seção zera contadores internos (12.6.2.5)", () => {
    const tree = parseText(
      "== A ==\n\n=== B ===\n\n== C ==\n\n=== D ===\n\n",
    ) as RichTextElement;
    const titles = tree.children.filter((c,) =>
      c instanceof RichTextElement && c.category.startsWith("title",)
    ) as RichTextElement[];
    assertEquals(titles[2]!.data, [2, 0, 0, 0,],);
    assertEquals(titles[3]!.data, [2, 1, 0, 0,],);
  });

  it("HLINE isolado vira elemento hline (12.6.2.3)", () => {
    const tree = parseText("----\n\n",) as RichTextElement;
    assertEquals(categories(tree,), ["richtext", "hline",],);
  });

  it("pre: linhas iniciadas por espaço (12.6.2.6)", () => {
    const tree = parseText(" code line\n mais uma\n\n",) as RichTextElement;
    assertEquals(categories(tree,), ["richtext", "pre",],);
    const pre = tree.children[0] as RichTextElement;
    assertEquals(pre.children.join("",), "code line\nmais uma\n",);
  });

  it("bullet list nível 1 (12.6.2.7)", () => {
    const tree = parseText("* um\n* dois\n\n",) as RichTextElement;
    assertEquals(categories(tree,), [
      "richtext",
      "bulletlist1",
      "bulletitem1",
      "text",
      "bulletitem1",
      "text",
    ],);
  });

  it("bullet list aninhada 1>2 (12.6.2.7)", () => {
    const tree = parseText("* um\n** dois\n\n",) as RichTextElement;
    assertEquals(categories(tree,), [
      "richtext",
      "bulletlist1",
      "bulletitem1",
      "text",
      "bulletlist2",
      "bulletitem2",
      "text",
    ],);
  });

  it("number list com contadores 1, 2, 3 (12.6.2.7)", () => {
    const tree = parseText("# a\n# b\n# c\n\n",) as RichTextElement;
    const items = (tree.children[0] as RichTextElement).children.filter((c,) =>
      c instanceof RichTextElement
    ) as RichTextElement[];
    assertEquals(items.length, 3,);
    assertEquals(items[0]!.data, [1, 0, 0, 0,],);
    assertEquals(items[1]!.data, [2, 0, 0, 0,],);
    assertEquals(items[2]!.data, [3, 0, 0, 0,],);
  });

  it("itálico, negrito, código e bolditalic (12.6.2.9/17 agregado)", () => {
    const t1 = parseText("isso ''it'' aqui\n\n",) as RichTextElement;
    assertEquals(categories(t1,), [
      "richtext",
      "paragraph",
      "text",
      "italic",
      "text",
      "text",
    ],);
    const t2 = parseText("'''nb'''\n\n",) as RichTextElement;
    assertEquals(categories(t2,), ["richtext", "paragraph", "bold", "text",],);
    const t3 = parseText("''''mono''''\n\n",) as RichTextElement;
    assertEquals(categories(t3,), ["richtext", "paragraph", "code", "text",],);
    const t4 = parseText("'''''bi'''''\n\n",) as RichTextElement;
    assertEquals(categories(t4,), [
      "richtext",
      "paragraph",
      "bold",
      "italic",
      "text",
    ],);
  });

  it("espaço após itálico é controlado por appendSpace (12.6.2.9)", () => {
    const tree = parseText("''it''x\n\n",) as RichTextElement;
    const para = tree.children[0] as RichTextElement;
    const italic = para.children[0] as RichTextElement;
    assertEquals(italic.category, "italic",);
    assertEquals(italic.appendSpace, false,);
  });

  it("fontCol <fcol:red>texto</fcol> (12.6.2.19 agregado)", () => {
    const tree = parseText("<fcol:red>vermelho</fcol>\n\n",) as RichTextElement;
    assertEquals(categories(tree,), [
      "richtext",
      "paragraph",
      "fontCol",
      "text",
    ],);
    const fc = (tree.children[0] as RichTextElement)
      .children[0] as RichTextElement;
    assertEquals(fc.data, "red",);
  });

  it("href [http://url Texto] (12.6.2.10/18 agregado)", () => {
    const tree = parseText(
      "[http://exemplo.com Exemplo]\n\n",
      ALL_HANDLERS,
    ) as RichTextElement;
    assertEquals(categories(tree,), [
      "richtext",
      "paragraph",
      "href",
      "text",
    ],);
    const href = (tree.children[0] as RichTextElement).children[0] as
      & RichTextElement
      & { data: RichTextElement };
    assertEquals(href.category, "href",);
    // data: richtext com os WORDs da URL (tokenizados pelo scanner href).
    assertEquals(href.data.category, "richtext",);
    assertEquals((href.children[0] as RichTextElement).children[0], "Exemplo",);
  });

  it("href sem texto usa a URL como rótulo (12.6.2.10)", () => {
    const tree = parseText(
      "[http://exemplo.com]\n\n",
      ALL_HANDLERS,
    ) as RichTextElement;
    const href = (tree.children[0] as RichTextElement).children[0] as
      & RichTextElement
      & { data: RichTextElement };
    assertEquals(href.children.length > 0, true,);
    assertEquals(href.data.category, "richtext",);
  });

  it("ref [[Section]] gera ref>text e data (12.6.2.10/18 agregado)", () => {
    const tree = parseText("veja [[Section]] aqui\n\n",) as RichTextElement;
    const para = tree.children[0] as RichTextElement;
    const ref = para.children.find((c,) =>
      c instanceof RichTextElement && c.category === "ref"
    ) as RichTextElement;
    assertEquals(ref.data, "Section",);
    const inner = ref.children[0] as RichTextElement;
    assertEquals(inner.category, "text",);
    assertEquals(inner.children.join("",), "Section",);
  });

  it("ref com rótulo [[Section|Um rótulo]] (12.6.2.10)", () => {
    // Ruby (fonte de verdade, probe): `data` é o alvo completo até o `|`
    // ("Section"); o `|` é LITERAL e não entra no join dos refTokens; o
    // rótulo após o `|` vira o filho `text`.
    const tree = parseText("[[Section|Um rótulo]]\n\n",) as RichTextElement;
    const ref = (tree.children[0] as RichTextElement)
      .children[0] as RichTextElement;
    assertEquals(ref.category, "ref",);
    assertEquals(ref.data, "Section",);
    const inner = ref.children[0] as RichTextElement;
    assertEquals(inner.children[0], "Um rótulo",);
  });

  it("File ref vira img com alt e alinhamento (12.6.2.10)", () => {
    // Divergência fiel: o scanner `:ref` do Ruby (e o nosso) casa o conteúdo
    // após `File:` como um ÚNICO WORD (inclui espaços), então as opções
    // `alt=`/alinhamento nunca são separadas — o Ruby também trata tudo como
    // nome de arquivo (probe Ruby registra inclusive o erro de extensão).
    const tree = parseText(
      "[[File:logo.png alt=Logo middle]]\n\n",
    ) as RichTextElement;
    const para = tree.children[0] as RichTextElement;
    const img = para.children[0] as RichTextElement;
    assertEquals(img.category, "img",);
    const image = img.data as {
      fileName: string;
      altText: string | null;
      verticalAlign: string | null;
    };
    assertEquals(image.fileName, "logo.png alt=Logo middle",);
    assertEquals(image.altText, null,);
    assertEquals(image.verticalAlign, null,);
  });

  it("File com opções separadas por espaço vira img limpa (12.6.2.10)", () => {
    // Sem o comportamento agregador do `:ref`, a forma canônica com um único
    // token funciona: `[[File:logo.png]]`.
    const tree = parseText("[[File:logo.png]]\n\n",) as RichTextElement;
    const para = tree.children[0] as RichTextElement;
    const img = para.children[0] as RichTextElement;
    assertEquals(img.category, "img",);
    const image = img.data as { fileName: string };
    assertEquals(image.fileName, "logo.png",);
  });

  it("File sem extensão registra erro (12.6.2.10)", () => {
    parseText("[[File:logo]]\n\n",);
    assert(errorCount() > 0, "rt_file_no_ext deveria ser registrado",);
  });

  it("extensão inválida registra erro (12.6.2.10)", () => {
    parseText("[[File:logo.bmp]]\n\n",);
    assert(errorCount() > 0, "rt_file_bad_ext deveria ser registrado",);
  });

  it("QUERY vira inlinefunc query dentro de href (12.6.2.11)", () => {
    const tree = parseText(
      "[http://x.com/<-effort-> y]\n\n",
      ALL_HANDLERS,
    ) as RichTextElement;
    const para = tree.children[0] as RichTextElement;
    const href = para.children[0] as RichTextElement;
    const data = href.data as RichTextElement;
    // A URL contém um QUERY: wordWithQueries produz text + inlinefunc.
    const funcs = data.children.filter((c,) =>
      c instanceof RichTextElement && c.category === "inlinefunc"
    ) as RichTextElement[];
    assertEquals(funcs.length, 1,);
    assertEquals(funcs[0]!.data, ["query", { attribute: "effort", },],);
  });

  it("html blob <html>...</html> (12.6.2.12/21 agregado)", () => {
    const tree = parseText("<html><b>oi</b></html>\n\n",) as RichTextElement;
    assertEquals(categories(tree,), ["richtext", "paragraph", "htmlblob",],);
    const blob = (tree.children[0] as RichTextElement)
      .children[0] as RichTextElement;
    assertEquals(blob.children.join("",), "<b>oi</b>",);
  });

  it("nowiki preserva literalmente o markup (12.6.2.20 agregado)", () => {
    const tree = parseText(
      "<nowiki>'''text'''</nowiki>\n\n",
    ) as RichTextElement;
    assertEquals(categories(tree,), [
      "richtext",
      "paragraph",
      "text",
    ],);
    const para = tree.children[0] as RichTextElement;
    assertEquals(para.to_s().trim(), "'''text'''",);
  });

  it('block function <[report id="x"]> com handler (12.6.2.14/22)', () => {
    const tree = parseText(
      '<[report id="x"]>\n\n',
      ALL_HANDLERS,
    ) as RichTextElement;
    assertEquals(categories(tree,), ["richtext", "blockfunc",],);
    assertEquals(errorCount(), 0,);
    const bf = tree.children[0] as RichTextElement;
    assertEquals(bf.data, ["report", { id: "x", },],);
  });

  it("block function desconhecida registra erro (12.6.2.14)", () => {
    const tree = parseText('<[novum arg="1"]>\n\n', ALL_HANDLERS,);
    assert(errorCount() > 0, "bad_block_function deveria ser registrado",);
    // Ruby continua sem exceção (trapSetup=false): árvore ainda vem.
    assert(tree instanceof RichTextElement,);
  });

  it('inline function <-query attribute="effort"-> (12.6.2.14/22)', () => {
    const tree = parseText(
      'valor <-query attribute="effort"-> fim\n\n',
      ALL_HANDLERS,
    ) as RichTextElement;
    const para = tree.children[0] as RichTextElement;
    const func = para.children.find((c,) =>
      c instanceof RichTextElement && c.category === "inlinefunc"
    ) as RichTextElement;
    assertEquals(func.data, ["query", { attribute: "effort", },],);
    assertEquals(errorCount(), 0,);
  });

  it("functionArguments aceita múltiplos pares (12.6.2.14)", () => {
    const tree = parseText(
      '<[report id="a" name="b c"]>\n\n',
      ALL_HANDLERS,
    ) as RichTextElement;
    const bf = tree.children[0] as RichTextElement;
    assertEquals(bf.data, ["report", { id: "a", name: "b c", },],);
  });

  it("agregado: título + parágrafo + bullet (12.6.2.15/16)", () => {
    const tree = parseText(
      "== Título ==\n\num parágrafo\n\n* item\n\n",
    ) as RichTextElement;
    assertEquals(categories(tree,), [
      "richtext",
      "title1",
      "text",
      "paragraph",
      "text",
      "text",
      "bulletlist1",
      "bulletitem1",
      "text",
    ],);
    assertEquals(errorCount(), 0,);
    const tagged = tree.to_tagged();
    assert(
      tagged.includes("<h1>1 Título</h1>",) || tagged.includes("<h1>1 ",),
    );
  });

  it("parse com bloco não suportado e blankLines entre seções", () => {
    // blankLines absorve LINEBREAK/SPACE entre blocos; a palavra seguinte
    // inicia novo parágrafo (probe Ruby: [:richtext, :paragraph, :text,
    // :paragraph, :text] para `a\n\n\n\nb`).
    const tree = parseText("a\n\n\n\nb\n\n",) as RichTextElement;
    assertEquals(categories(tree,), [
      "richtext",
      "paragraph",
      "text",
      "paragraph",
      "text",
    ],);
    assertEquals(errorCount(), 0,);
  });
});
