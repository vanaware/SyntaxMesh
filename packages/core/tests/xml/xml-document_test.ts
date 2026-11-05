/**
 * 17.2 — `XMLDocument`.
 *
 * Expectativas conferidas contra o Ruby real (`XMLDocument.rb`): o `<<` do
 * documento achata arrays mas não valida nem conversões de string — string é
 * argumento **não suportado** aqui (diferente de `XMLElement#<<`, que aceita).
 *
 * @see docs/taskjuggler/lib/taskjuggler/XMLDocument.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.2)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";

import { XMLDocument, } from "../../src/xml/xml-document.ts";
import {
  XMLBlob,
  XMLComment,
  XMLElement,
  XMLText,
} from "../../src/xml/xml-element.ts";

/** Expõe `@elements` (protected) para inspeção. */
class DocumentProbe extends XMLDocument {
  get exposed(): XMLElement[] {
    return this.elements;
  }
}

describe("XMLDocument — construtor (17.2.1–3)", () => {
  it("sem bloco começa vazio", () => {
    assertEquals(new XMLDocument().to_s(), "",);
  });

  it("bloco devolve a lista de elementos de topo", () => {
    const doc = new DocumentProbe(() => [new XMLElement("a",),]);
    assertEquals(doc.exposed.length, 1,);
  });

  it("bloco que devolve nada resulta em documento vazio", () => {
    const doc = new DocumentProbe(() => {},);
    assertEquals(doc.to_s(), "",);
  });
});

describe("XMLDocument#append (17.2.4–5)", () => {
  it("anexa um XMLElement", () => {
    const doc = new XMLDocument();
    doc.append(new XMLElement("root",),);
    assertEquals(doc.to_s(), "<root></root>",);
  });

  it("anexa array (cada elemento individualmente)", () => {
    const doc = new DocumentProbe();
    doc.append([new XMLElement("a",), new XMLElement("b",),],);
    assertEquals(doc.exposed.length, 2,);
  });

  it("achata arrays aninhados, como `arg.flatten`", () => {
    const doc = new DocumentProbe();
    doc.append([new XMLElement("a",), [new XMLElement("b",),],],);
    assertEquals(doc.exposed.length, 2,);
  });

  it("null dentro de array permanece (flatten não compacta) e serializa vazio", () => {
    const doc = new DocumentProbe();
    doc.append([new XMLElement("a",), null,],);
    assertEquals(doc.exposed.length, 2,);
    assertEquals(doc.to_s(), "<a></a>",);
  });

  it("ignora null", () => {
    const doc = new DocumentProbe();
    doc.append(null,);
    assertEquals(doc.exposed.length, 0,);
  });

  it("aceita subclasses (XMLText/XMLComment/XMLBlob)", () => {
    const doc = new XMLDocument();
    doc.append(new XMLBlob("<!DOCTYPE html>",),);
    doc.append(new XMLComment("oi",),);
    doc.append(new XMLText("x",),);
    assertEquals(doc.to_s(), "<!DOCTYPE html><!-- oi -->\nx",);
  });

  it("rejeita string (XMLDocument#<< não converte texto)", () => {
    const doc = new XMLDocument();
    assertThrows(
      () => doc.append("texto",),
      Error,
      "Unsupported argument of type",
    );
  });

  it("rejeita número", () => {
    const doc = new XMLDocument();
    assertThrows(
      () => doc.append(7 as unknown as XMLElement,),
      Error,
      "Unsupported argument of type",
    );
  });
});

describe("XMLDocument#to_s (17.2.6)", () => {
  it("concatena os elementos sem separador", () => {
    const doc = new XMLDocument();
    doc.append(new XMLElement("a",),);
    doc.append(new XMLElement("b",),);
    assertEquals(doc.to_s(), "<a></a><b></b>",);
  });

  it("critério de aceite da fase", () => {
    const doc = new XMLDocument();
    doc.append(new XMLElement("root",),);
    assertEquals(doc.to_s(), "<root></root>",);
  });

  it("serializa cada elemento com indentação zero (filhos ainda indentam)", () => {
    const root = new XMLElement("root",);
    root.append([new XMLElement("a",), new XMLElement("b",),],);
    const doc = new XMLDocument();
    doc.append(root,);
    assertEquals(doc.to_s(), "<root>\n <a></a>\n <b></b>\n</root>",);
  });
});

describe("XMLDocument#write (17.2.7)", () => {
  it("'.' devolve a string com semântica de `puts` (browser, ADR 027)", () => {
    const doc = new XMLDocument();
    doc.append(new XMLElement("root",),);
    // Ruby faz `f.puts element.to_s(0)`: acrescenta \n só quando falta.
    assertEquals(doc.write(".",), "<root></root>\n",);
  });

  it("não duplica o \n que o elemento já termina (XMLComment)", () => {
    const doc = new XMLDocument();
    doc.append(new XMLComment("oi",),);
    assertEquals(doc.write(".",), "<!-- oi -->\n",);
  });

  it('"." difere de to_s(), que concatena sem separador', () => {
    const doc = new XMLDocument();
    doc.append(new XMLElement("a",),);
    doc.append(new XMLElement("b",),);
    assertEquals(doc.to_s(), "<a></a><b></b>",);
    assertEquals(doc.write(".",), "<a></a>\n<b></b>\n",);
  });

  it("outro nome é no-op com warning e devolve undefined", () => {
    const doc = new XMLDocument();
    doc.append(new XMLElement("root",),);
    assertEquals(doc.write("arquivo.xml",), undefined,);
  });

  it("'.' com documento vazio devolve string vazia", () => {
    assertEquals(new XMLDocument().write(".",), "",);
  });

  it("não lança ao escrever em nome de arquivo", () => {
    const doc = new XMLDocument();
    doc.append(new XMLElement("root",),);
    doc.write("arquivo.xml",);
    assert(true,);
  });
});
