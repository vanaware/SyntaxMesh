/**
 * RichTextSnip — bloco de construção de um `RichTextDocument` (Fase 12.9).
 *
 * No Ruby, um Snip lê um arquivo de texto estruturado via `File.open` e gera
 * um HTML correspondente com `HTMLDocument#write`. No navegador (PWA) não há
 * sistema de arquivos: o **conteúdo é injetado** pelo chamador (parâmetro
 * `text`) e {@link generateHTML} **retorna o elemento `<html>`** em vez de
 * escrever em disco. Toda a demais estrutura (nome sem diretórios, contadores de seção
 * compartilhados, delegação de `linkTarget`/`cssClass`, TOC, referências
 * internas, barra de navegação prev/next) é fiel a `Snip.rb`.
 *
 * Port fiel de `RichText/Snip.rb:24-103`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Snip.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichText, } from "./rich-text.ts";
import type { RichTextIntermediate, } from "./rich-text-intermediate.ts";
import type { TableOfContents, } from "./table-of-contents.ts";
import { createHtmlShell, } from "./html-shell.ts";
import { SimpleXMLElement, } from "./xml-like.ts";
import type { XMLElementLike, } from "./xml-like.ts";
// Referência circular — `import type` (Document importa Snip como valor).
import type { RichTextDocument, } from "./rich-text-document.ts";

export class RichTextSnip {
  /** Nome do snip (arquivo sem diretórios). */
  readonly name: string;
  /** Snip anterior/seguinte na sequência do documento (encadeados por crossReference). */
  prevSnip: RichTextSnip | null = null;
  nextSnip: RichTextSnip | null = null;

  /** Documento dono (fonte dos handlers e dos geradores abstratos). */
  private readonly document: RichTextDocument;
  /** Representação intermediária do texto (árvore RichTextElement). */
  private readonly richText: RichTextIntermediate;

  /**
   * Cria um snip. `fileName` pode conter diretórios — são removidos como no
   * Ruby (`@name` usa `rindex('/')`). `text` é o conteúdo do arquivo; no Ruby
   * ele seria lido via `File.open`. `sectionCounter` (3 números) é compartilhado
   * entre os snips do documento e avançado pelo parser. O HTML gerado é
   * retornado como elemento (a escrita em disco é delegada à Fase 17).
   */
  constructor(
    document: RichTextDocument,
    fileName: string,
    sectionCounter: number[],
    text: string,
  ) {
    this.document = document;
    // Strip any directories from fileName (Snip.rb:37-38).
    const slash = fileName.lastIndexOf("/",);
    this.name = slash >= 0 ? fileName.slice(slash + 1,) : fileName;

    const rText = new RichText(text, this.document.functionHandlers,);
    const rti = rText.generateIntermediateFormat(sectionCounter,);
    if (!rti) {
      // Ruby: `exit` — no navegador, erro aborta apenas a montagem.
      throw new Error(`RichText error in snip "${this.name}"`,);
    }
    this.richText = rti;
  }

  /** Define o target de todos os links do snip (delegado ao RTI). */
  setLinkTarget(target: string | null,): void {
    this.richText.linkTarget = target;
  }

  /** Define a classe CSS do snip (delegado ao RTI). */
  setCssClass(css: string | null,): void {
    this.richText.cssClass = css;
  }

  /** Coleta os títulos de seção em `toc` como `fileName`. */
  tableOfContents(toc: TableOfContents, fileName: string,): void {
    this.richText.tableOfContents(toc, fileName,);
  }

  /** Nomes de snips referenciados por `[[...]]` internos (sem `:`). */
  internalReferences(): string[] {
    return this.richText.internalReferences();
  }

  /**
   * Gera a versão HTML do snip. No Ruby o resultado era escrito em
   * `directory + name + '.html'`; aqui a string serializada (doctype +
   * documento completo) é retornada — mesma estrutura: head + stylesheet,
   * header, navbar, div 90%, conteúdo, navbar, footer (Snip.rb:77-93).
   */
  generateHTML(): string {
    const shell = createHtmlShell();
    const head = shell.generateHead(this.name,);
    head.append(this.document.generateStyleSheet(),);

    const body = shell.body;
    body.append(this.document.generateHTMLHeader(),);
    body.append(this.generateHTMLNavigationBar(),);

    const div = new SimpleXMLElement("div", {
      style: "width:90%; margin-left:5%; margin-right:5%",
    },);
    const content = this.richText.to_html();
    if (content) div.append(content,);
    body.append(div,);
    body.append(this.generateHTMLNavigationBar(),);
    body.append(this.document.generateHTMLFooter(),);

    return shell.toHTML();
  }

  /** Barra de navegação prev/next (nomes + `.html`), como Snip.rb:97-103. */
  private generateHTMLNavigationBar(): XMLElementLike {
    const prev = this.prevSnip;
    const next = this.nextSnip;
    return this.document.generateHTMLNavigationBar(
      prev ? prev.name : null,
      prev ? `${prev.name}.html` : null,
      next ? next.name : null,
      next ? `${next.name}.html` : null,
    );
  }
}
