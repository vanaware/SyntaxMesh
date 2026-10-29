/**
 * Fixture `RichTextDocument` concreto para testes de Snip/Document (12.9/12.10).
 *
 * Os métodos abstratos retornam elementos-marcador (`<tag>TextoMarker</tag>`)
 * que as asserções procuram na saída serializada. `lastNav` guarda os
 * argumentos da última chamada de `generateHTMLNavigationBar` para testar o
 * encadeamento prev/next sem depender de markup específico.
 */

import { RichTextDocument, } from "../../src/richtext/rich-text-document.ts";
import { SimpleXMLElement, } from "../../src/richtext/xml-like.ts";
import type { XMLElementLike, } from "../../src/richtext/xml-like.ts";

export interface NavArgs {
  prevName: string | null;
  prevFile: string | null;
  nextName: string | null;
  nextFile: string | null;
}

export class TestRichTextDocument extends RichTextDocument {
  /** Últimos argumentos recebidos por `generateHTMLNavigationBar`. */
  lastNav: NavArgs | null = null;

  generateStyleSheet(): XMLElementLike {
    const el = new SimpleXMLElement("style", { id: "mystyle", },);
    el.append("STYLESHEET_MARKER",);
    return el;
  }

  generateHTMLCover(): XMLElementLike {
    const el = new SimpleXMLElement("p", {},);
    el.append("COVER_MARKER",);
    return el;
  }

  generateHTMLHeader(): XMLElementLike {
    const el = new SimpleXMLElement("header", {},);
    el.append("HEADER_MARKER",);
    return el;
  }

  generateHTMLFooter(): XMLElementLike {
    const el = new SimpleXMLElement("footer", {},);
    el.append("FOOTER_MARKER",);
    return el;
  }

  generateHTMLNavigationBar(
    prevName: string | null,
    prevFile: string | null,
    nextName: string | null,
    nextFile: string | null,
  ): XMLElementLike {
    this.lastNav = { prevName, prevFile, nextName, nextFile, };
    const el = new SimpleXMLElement("nav", {},);
    el.append("NAV_MARKER",);
    return el;
  }
}
