/**
 * html-shell — casca de documento HTML equivalente ao `HTMLDocument` do Ruby
 * (Fase 12.9/12.10).
 *
 * O `HTMLDocument` real (com escrita em disco e `XMLDocument`) só nasce na
 * **Fase 17**. O RichText desta fase precisa montar documentos HTML completos
 * (`<!DOCTYPE>` + `<html>` + `<head>` + `<body>`) para `RichTextSnip` e
 * `RichTextDocument`, mas **sem E/S de disco** — o navegador é o ambiente
 * alvo. Este módulo reproduz fielmente a *estrutura* gerada por
 * `HTMLDocument.rb` (doctype, comentário, atributos `xml:lang`/`lang`,
 * `generateHead` com `title` + 2 `meta`) e serializa para string.
 *
 * @see docs/taskjuggler/lib/taskjuggler/HTMLDocument.rb:32-82
 * @see ADR 025 (RichText e function handlers)
 */

import type { XMLElementLike, } from "./xml-like.ts";
import { createComment, SimpleXMLElement, } from "./xml-like.ts";

/** Documento com os nós de encaixe devolvidos por `html`/`head`/`body`. */
export interface HtmlShell {
  /** Elemento raiz `<html>` (contém `<head>` e `<body>`). */
  readonly html: XMLElementLike;
  /** `<head>` criado por `generateHead(title)`. */
  readonly head: XMLElementLike;
  /** `<body>` já criado pelo construtor (anexe conteúdo a ele). */
  readonly body: XMLElementLike;
  /** Preenche `<head>` com `title` + metas obrigatórias; retorna o `<head>`. */
  generateHead(title: string,): XMLElementLike;
  /** Serializa o documento completo (`<!DOCTYPE html>` + comentário + `<html>`). */
  toHTML(): string;
}

class HtmlShellImpl implements HtmlShell {
  readonly html: XMLElementLike;
  readonly head: XMLElementLike;
  readonly body: XMLElementLike;
  private readonly preamble: XMLElementLike;

  constructor() {
    // Replica HTMLDocument#initialize (docType :html5, HTMLDocument.rb:53-60).
    const doc = new SimpleXMLElement(null,);
    doc.append(createComment("Rich text document (SyntaxMesh)",),);
    this.preamble = new RawSequence(doc,);
    this.html = new SimpleXMLElement("html", { lang: "en", },);
    this.head = new SimpleXMLElement("head",);
    this.body = new SimpleXMLElement("body",);
    this.html.append(this.head,);
    this.html.append(this.body,);
  }

  /** Replica HTMLDocument#generateHead (HTMLDocument.rb:64-82): title + metas. */
  generateHead(title: string,): XMLElementLike {
    const t = new SimpleXMLElement("title",);
    t.append(title,);
    this.head.append(t,);
    this.head.append(
      new SimpleXMLElement("meta", {
        "http-equiv": "Content-Type",
        content: "text/html; charset=utf-8",
      },),
    );
    this.head.append(
      new SimpleXMLElement("meta", {
        "http-equiv": "X-UA-Compatible",
        content: "IE=9",
      },),
    );
    return this.head;
  }

  toHTML(): string {
    return this.preamble.toHTML() + this.html.toHTML();
  }
}

/**
 * Nó auxiliar que serializa uma sequência pré-montada (o doctype e o
 * comentário que antecedem `<html>` no Ruby são `XMLBlob`/`XMLComment`
 * irmãos do `<html>`; aqui vivem num fragmento sem tag própria).
 */
class RawSequence implements XMLElementLike {
  readonly tag = null;
  readonly attrs: Record<string, string> = {};
  readonly children: Array<XMLElementLike | string> = [];

  constructor(private readonly inner: XMLElementLike,) {}

  append(child: XMLElementLike | string,): void {
    this.inner.append(child,);
  }

  toHTML(): string {
    // O fragmento interno renderiza cru (comentário) — sem escape.
    return "<!DOCTYPE html>" + this.inner.toHTML();
  }
}

/** Cria a casca de um documento HTML5 (equivalente a `HTMLDocument.new`). */
export function createHtmlShell(): HtmlShell {
  return new HtmlShellImpl();
}
