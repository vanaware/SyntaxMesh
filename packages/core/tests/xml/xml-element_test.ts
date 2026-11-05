/**
 * 17.1 — `XMLElement` + `XMLText` + `XMLNamedText` + `XMLComment` + `XMLBlob`.
 *
 * Cada `describe` corresponde a uma tarefa da tabela 17.1 do arquivo de
 * tarefas; os casos esperados são os que o `XMLElement.rb` produz (oracle
 * Ruby), incluindo a indentação de UMA space por nível e o escape `\"`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/XMLElement.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.1)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";

import {
  XMLBlob,
  XMLComment,
  XMLElement,
  XMLNamedText,
  XMLText,
} from "../../src/xml/xml-element.ts";
import { compat, } from "../../src/compat.ts";

/** Subclasse que expõe os `protected` do Ruby para teste direto. */
class ElementProbe extends XMLElement {
  exposeEscape(str: string, quotes = false,): string {
    return this.escape(str, quotes,);
  }
  exposeIndentation(indent: number,): string {
    return this.indentation(indent,);
  }
}

function probe(name: string | null = "div",): ElementProbe {
  return new ElementProbe(name,);
}

describe("XMLElement — construtor (17.1.1.3–17.1.1.8)", () => {
  it("aceita nome string", () => {
    assertEquals(new XMLElement("div",).name, "div",);
  });

  it("aceita nome null sem atributos (nó de texto/comentário/blobo)", () => {
    assertEquals(new XMLElement(null,).name, null,);
  });

  it("rejeita nome null com atributos", () => {
    assertThrows(
      () => new XMLElement(null, { class: "x", },),
      Error,
      "Name must be nil or a String",
    );
  });

  it("rejeita nome que não é string", () => {
    assertThrows(
      () => new XMLElement(42 as unknown as string,),
      Error,
      "Name must be nil or a String",
    );
  });

  it("aceita atributos com valores string", () => {
    const el = new XMLElement("div", { id: "a", class: "b", },);
    assertEquals(el.attrs, { id: "a", class: "b", },);
  });

  it("rejeita valor de atributo nulo", () => {
    assertThrows(
      () =>
        new XMLElement("div", {
          id: null as unknown as string,
        },),
      Error,
      "may not be nil",
    );
  });

  it("rejeita valor de atributo não-string", () => {
    assertThrows(
      () => new XMLElement("div", { width: 10 as unknown as string, },),
      Error,
      "must be a String",
    );
  });

  it("bloco com elemento único vira lista de um", () => {
    const el = new XMLElement("div", {}, false, () => new XMLElement("p",),);
    assertEquals(el.children.length, 1,);
    assertEquals(el.children[0]?.name, "p",);
  });

  it("bloco com array é achatado", () => {
    const el = new XMLElement(
      "div",
      {},
      false,
      () => [new XMLElement("a",), [new XMLElement("b",),],],
    );
    assertEquals(el.children.map((c,) => c.name), ["a", "b",],);
  });

  it("bloco com string vira XMLText", () => {
    const el = new XMLElement("div", {}, false, () => "olá",);
    assert(el.children[0] instanceof XMLText,);
  });

  it("sem bloco começa sem filhos", () => {
    assertEquals(new XMLElement("div",).children.length, 0,);
  });

  it("strings filhas são convertidas em XMLText", () => {
    const el = new XMLElement("div", {}, false, () => ["a", "b",],);
    assert(el.children.every((c,) => c instanceof XMLText),);
  });

  it("XMLText filho renderiza escapado dentro do pai", () => {
    const el = new XMLElement("p", {}, false, () => "1 < 2 & 3 > 2",);
    assertEquals(el.to_s(), "<p>1 &lt; 2 &amp; 3 &gt; 2</p>",);
  });

  it("descarta filhos nulos do bloco", () => {
    const el = new XMLElement(
      "div",
      {},
      false,
      () => [null, new XMLElement("p",), undefined,],
    );
    assertEquals(el.children.length, 1,);
  });

  it("null puro vindo do bloco resulta em zero filhos", () => {
    const el = new XMLElement("div", {}, false, () => null,);
    assertEquals(el.children.length, 0,);
  });

  it("rejeita filho numérico", () => {
    assertThrows(
      () => new XMLElement("div", {}, false, () => 7 as unknown as XMLElement,),
      Error,
      "Element must be of type XMLElement",
    );
  });

  it("rejeita filho objeto puro com o nome do tipo na mensagem", () => {
    assertThrows(
      () =>
        new XMLElement(
          "div",
          {},
          false,
          () => ({ nope: true, }) as unknown as XMLElement,
        ),
      Error,
      "not Object",
    );
  });

  it("aceita subclasses de XMLElement como filhos", () => {
    const el = new XMLElement("div", {}, false, () => new XMLText("oi",),);
    assertEquals(el.children.length, 1,);
  });
});

describe("XMLElement#append (17.1.1.9–17.1.1.12)", () => {
  it("string vira XMLText", () => {
    const el = new XMLElement("div",);
    el.append("texto",);
    assert(el.children[0] instanceof XMLText,);
  });

  it("retorna self (encadeável, como `<<` do Ruby)", () => {
    const el = new XMLElement("div",);
    assertEquals(el.append("a",).append("b",).children.length, 2,);
  });

  it("serializa a string anexada com escape de texto", () => {
    const el = new XMLElement("div",);
    el.append("a & b",);
    assertEquals(el.to_s(), "<div>a &amp; b</div>",);
  });

  it("rejeita string dentro de array (fiel ao Ruby)", () => {
    const el = new XMLElement("div",);
    assertThrows(
      () => el.append(["não permitido",] as unknown as XMLElement[],),
      Error,
      "Element must be of type XMLElement",
    );
  });

  it("anexa cada elemento de um array", () => {
    const el = new XMLElement("div",);
    el.append([new XMLElement("p",), new XMLElement("span",),],);
    assertEquals(el.children.map((c,) => c.name), ["p", "span",],);
  });

  it("não muta o array recebido (Categoria A)", () => {
    const el = new XMLElement("div",);
    const list = [new XMLElement("p",), null,] as unknown as XMLElement[];
    el.append(list,);
    assertEquals(list.length, 2,);
    assertEquals(el.children.length, 1,);
  });

  it("ignora null", () => {
    const el = new XMLElement("div",);
    el.append(null,);
    assertEquals(el.children.length, 0,);
  });

  it("anexa XMLElement por referência", () => {
    const el = new XMLElement("div",);
    const child = new XMLElement("p",);
    el.append(child,);
    assertEquals(el.children[0], child,);
  });

  it("mutar o filho reflete no pai", () => {
    const el = new XMLElement("div",);
    const child = new XMLElement("p",);
    el.append(child,);
    child.append("oi",);
    assertEquals(el.to_s(), "<div><p>oi</p></div>",);
  });

  it("rejeita objeto que não é XMLElement", () => {
    const el = new XMLElement("div",);
    assertThrows(
      () =>
        el.append(
          { tag: "p", attrs: {}, children: [], } as unknown as XMLElement,
        ),
      Error,
      "Elements must be of type XMLElement not Object",
    );
  });
});

describe("XMLElement#setAttr / #getAttr (17.1.1.13–14)", () => {
  it("define atributo", () => {
    const el = new XMLElement("div",);
    el.setAttr("class", "foo",);
    assertEquals(el.getAttr("class",), "foo",);
  });

  it("substitui atributo existente", () => {
    const el = new XMLElement("div", { id: "a", },);
    el.setAttr("id", "b",);
    assertEquals(el.attrs.id, "b",);
  });

  it("rejeita valor não-string", () => {
    const el = new XMLElement("div",);
    assertThrows(
      () => el.setAttr("id", 3 as unknown as string,),
      Error,
      "is not a String",
    );
  });

  it("getAttr devolve undefined para atributo ausente", () => {
    assertEquals(new XMLElement("div",).getAttr("nope",), undefined,);
  });

  it("getAttr não enxerga a prototipagem de Object", () => {
    assertEquals(new XMLElement("div",).getAttr("toString",), undefined,);
  });
});

describe("XMLElement#toHTML / #to_s (17.1.1.15–18)", () => {
  it("toHTML é alias de to_s(0)", () => {
    const el = new XMLElement("div", { id: "a", },);
    el.append("x",);
    assertEquals(el.toHTML(), el.to_s(0,),);
  });

  it("critério de aceite da fase", () => {
    const div = new XMLElement("div", { class: "foo", },);
    div.append("Hello",);
    assertEquals(div.to_s(), '<div class="foo">Hello</div>',);
  });

  it("ordena atributos por nome", () => {
    const el = new XMLElement("x", { zeta: "1", alpha: "2", mid: "3", },);
    assertEquals(
      el.to_s(),
      '<x alpha="2" mid="3" zeta="1"></x>',
    );
  });

  it('escapa & e " nos atributos', () => {
    const el = new XMLElement("x", { title: 'a & "b"', },);
    assertEquals(el.to_s(), '<x title="a &amp; \\"b\\""></x>',);
  });

  it("filho único não ganha quebra de linha", () => {
    const el = new XMLElement("div",);
    el.append(new XMLElement("p",),);
    assertEquals(el.to_s(), "<div><p></p></div>",);
  });

  it("dois filhos elementos ganham \\n + indentação de 1 space", () => {
    const el = new XMLElement("div",);
    el.append([new XMLElement("p",), new XMLElement("span",),],);
    assertEquals(el.to_s(), "<div>\n <p></p>\n <span></span>\n</div>",);
  });

  it("filhos texto não forçam quebra de linha", () => {
    const el = new XMLElement("div",);
    el.append("um",);
    el.append("dois",);
    assertEquals(el.to_s(), "<div>umdois</div>",);
  });

  it("mistura de texto e elemento só quebra após `>`", () => {
    const el = new XMLElement("div",);
    el.append("texto",);
    el.append(new XMLElement("b",),);
    // Ruby: o filho texto deixa o buffer sem `>`, então `b` não é prefixado
    // com newline; mas o fechamento após `</b>` (fim de buffer em `>`) é.
    assertEquals(el.to_s(0,), "<div>texto<b></b>\n</div>",);
  });

  it("indentação é cumulativa nos níveis", () => {
    const inner = new XMLElement("div",);
    inner.append([new XMLElement("p",), new XMLElement("q",),],);
    const outer = new XMLElement("root",);
    outer.append([inner, new XMLElement("z",),],);
    assertEquals(
      outer.to_s(0,),
      "<root>\n <div>\n  <p></p>\n  <q></q>\n </div>\n <z></z>\n</root>",
    );
  });

  it("indent inicial desloca todos os níveis (oracle Ruby)", () => {
    const el = new XMLElement("div",);
    el.append([new XMLElement("p",), new XMLElement("q",),],);
    assertEquals(el.to_s(0,), "<div>\n <p></p>\n <q></q>\n</div>",);
    assertEquals(el.to_s(2,), "<div>\n   <p></p>\n   <q></q>\n  </div>",);
  });

  it("selfClosing sem filhos usa `/>` (sem espaço)", () => {
    assertEquals(new XMLElement("br", {}, true,).to_s(), "<br/>",);
  });

  it("selfClosing com filhos não se auto-fecha", () => {
    const el = new XMLElement("span", {}, true,);
    el.append("x",);
    assertEquals(el.to_s(), "<span>x</span>",);
  });

  it("não-selfClosing sem filhos emite par aberto/fechado", () => {
    assertEquals(new XMLElement("div",).to_s(), "<div></div>",);
  });

  it("nome null no construtor base não é serializável", () => {
    assertThrows(() => new XMLElement(null,).to_s(), TypeError,);
  });
});

describe("XMLElement#escape / #indentation (17.1.1.19–20)", () => {
  it("escapa & como &amp;", () => {
    assertEquals(probe().exposeEscape("a&b",), "a&amp;b",);
  });

  it('escapa " como \\" (Categoria B, comportamento do Ruby)', () => {
    assertEquals(probe().exposeEscape('say "hi"',), 'say \\"hi\\"',);
  });

  it("NÃO escapa < nem > (isso é do XMLText)", () => {
    assertEquals(probe().exposeEscape("<a>",), "<a>",);
  });

  it("ignora o parâmetro quotes (Categoria C do Ruby)", () => {
    assertEquals(probe().exposeEscape('x"', false,), 'x\\"',);
  });

  it("preserva outros caracteres e code points fora do BMP", () => {
    assertEquals(probe().exposeEscape('a☕"&',), 'a☕\\"&amp;',);
  });

  it("emitir &quot; quando compat.keepRubyBugs é false", () => {
    const before = compat.keepRubyBugs;
    compat.keepRubyBugs = false;
    try {
      assertEquals(
        new XMLElement("x", { a: '"', },).to_s(),
        '<x a="&quot;"></x>',
      );
    } finally {
      compat.keepRubyBugs = before;
    }
  });

  it("indentation usa uma space por nível", () => {
    assertEquals(probe().exposeIndentation(0,), "",);
    assertEquals(probe().exposeIndentation(3,), "   ",);
  });
});

describe("XMLText (17.1.2)", () => {
  it("guarda o texto", () => {
    assertEquals(new XMLText("oi",).to_s(), "oi",);
  });

  it("aceita string vazia (truthy em Ruby)", () => {
    assertEquals(new XMLText("",).to_s(), "",);
  });

  it("escapa <, > e &", () => {
    assertEquals(
      new XMLText("<a> & <b>",).to_s(),
      "&lt;a&gt; &amp; &lt;b&gt;",
    );
  });

  it("não escapa aspas", () => {
    assertEquals(new XMLText('"quote"',).to_s(), '"quote"',);
  });

  it("ignora o argumento de indentação", () => {
    assertEquals(new XMLText("x",).to_s(4,), "x",);
  });

  it("é um XMLElement sem nome", () => {
    const text = new XMLText("x",);
    assert(text instanceof XMLElement,);
    assertEquals(text.name, null,);
  });
});

describe("XMLNamedText (17.1.3)", () => {
  it("recebe texto + nome", () => {
    assertEquals(new XMLNamedText("Olá", "p",).to_s(), "<p>Olá</p>",);
  });

  it("recebe atributos", () => {
    assertEquals(
      new XMLNamedText("t", "td", { class: "c", },).to_s(),
      '<td class="c">t</td>',
    );
  });

  it("default de atributos é objeto vazio", () => {
    assertEquals(new XMLNamedText("t", "td",).attrs, {},);
  });

  it("anexa um XMLText como único filho", () => {
    const node = new XMLNamedText("t", "td",);
    assertEquals(node.children.length, 1,);
    assert(node.children[0] instanceof XMLText,);
  });

  it("escapa o texto, não o marca como cru", () => {
    assertEquals(new XMLNamedText("<b>", "td",).to_s(), "<td>&lt;b&gt;</td>",);
  });
});

describe("XMLComment (17.1.4)", () => {
  it("default é comentário vazio", () => {
    assertEquals(new XMLComment().to_s(0,), "<!--  -->\n",);
  });

  it("serializa com `-->` + newline + indentação", () => {
    assertEquals(new XMLComment("oi",).to_s(3,), "<!-- oi -->\n   ",);
  });

  it("canonicaliza -- em -\\-", () => {
    assert(new XMLComment("a--b",).to_s(0,).includes("a-\\-b",),);
  });

  it("canonicaliza múltiplas ocorrências", () => {
    assertEquals(new XMLComment("--x--",).to_s(0,), "<!-- -\\-x-\\- -->\n",);
  });

  it("não canônica single hyphen", () => {
    assertEquals(new XMLComment("a-b",).to_s(0,), "<!-- a-b -->\n",);
  });

  it("comentário dentro de elemento mantém a estrutura do pai", () => {
    const el = new XMLElement(
      "div",
      {},
      false,
      () => [new XMLComment("note",), new XMLElement("p",),],
    );
    // O próprio `XMLComment#to_s` termina com "\n" + indentação, então o
    // `<p>` já cai na coluna certa sem nova quebra inserida pelo pai.
    assertEquals(el.to_s(), "<div>\n <!-- note -->\n <p></p>\n</div>",);
  });
});

describe("XMLBlob (17.1.5)", () => {
  it("default é bloco vazio", () => {
    assertEquals(new XMLBlob().to_s(0,), "",);
  });

  it("preserva o conteúdo cru", () => {
    assertEquals(
      new XMLBlob("<style>a{}</style>",).to_s(0,),
      "<style>a{}</style>",
    );
  });

  it("reindent após \\n", () => {
    assertEquals(new XMLBlob("a\nb",).to_s(2,), "a\n  b",);
  });

  it("newline final ganha a indentação", () => {
    assertEquals(new XMLBlob("a\n",).to_s(1,), "a\n ",);
  });

  it("indent 0 mantém \\n sem espaços", () => {
    assertEquals(new XMLBlob("a\nb",).to_s(0,), "a\nb",);
  });

  it("não escapa nada", () => {
    assertEquals(
      new XMLBlob('<a href="x">&</a>',).to_s(0,),
      '<a href="x">&</a>',
    );
  });
});
