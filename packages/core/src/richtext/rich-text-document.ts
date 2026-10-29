/**
 * RichTextDocument — coleção de `RichTextSnip` em um documento único
 * (Fase 12.10).
 *
 * Classe abstrata fiel a `RichText/Document.rb:27-144`: registra handlers,
 * adiciona snips, agrega a tabela de conteúdos transversal, valida referências
 * internas e orquestra a geração de HTML. As variações port-específicas:
 *
 * - `addSnip(file, text)` recebe o **conteúdo** como parâmetro (o Ruby lê o
 *   arquivo via `File.open`; o navegador não tem filesystem).
 * - `generateHTML(directory)` **retorna um mapa nome→elemento HTML** em vez de
 *   escrever `directory + nome + '.html'` em disco (a escrita é delegada à
 *   camada de exportação / Fase 17).
 * - O aviso de referência desconhecida (`puts` no Ruby) vira
 *   `MessageHandlerInstance.warning('rt_doc_unknown_reference', …)`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Document.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichTextSnip, } from "./rich-text-snip.ts";
import { TableOfContents, } from "./table-of-contents.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { createHtmlShell, } from "./html-shell.ts";
import { SimpleXMLElement, } from "./xml-like.ts";
import type { XMLElementLike, } from "./xml-like.ts";
import type { RichTextFunctionHandler, } from "./handlers/function-handler.ts";

export abstract class RichTextDocument {
  /** Handlers de função compartilhados por todos os snips do documento. */
  readonly functionHandlers: RichTextFunctionHandler[] = [];
  /** Snips registrados, na ordem de adição. */
  readonly snippets: RichTextSnip[] = [];
  /** Tabela de conteúdos agregada (criada por `tableOfContents()`). */
  toc: TableOfContents | null = null;
  /** Contadores de seção compartilhados entre snips (Ruby `[0, 0, 0]`). */
  readonly sectionCounter: number[] = [0, 0, 0,];
  /** Target de todos os links dos snips adicionados depois. */
  linkTarget: string | null = null;
  /** Âncoras conhecidas: nomes de snip + `arquivo#tag` das entradas de TOC. */
  readonly anchors: string[] = [];
  /** Referências internas por snip (`snip.name → alvos`). */
  references: Record<string, string[]> = {};

  /** Marca que há snips novos sem encadeamento prev/next feito (Ruby @dirty). */
  private dirty = false;

  /** Registra um handler de função no documento (sem `dup`, como no Ruby). */
  registerFunctionHandler(handler: RichTextFunctionHandler,): void {
    this.functionHandlers.push(handler,);
  }

  /** Adiciona um snip ao documento, propagando o `linkTarget` corrente. */
  addSnip(file: string, text: string,): RichTextSnip {
    const snippet = new RichTextSnip(this, file, this.sectionCounter, text,);
    this.snippets.push(snippet,);
    snippet.setLinkTarget(this.linkTarget,);
    this.dirty = true;
    return snippet;
  }

  /**
   * Gera a tabela de conteúdos de todos os snips e coleta âncoras/referências.
   * Deve ser chamada antes de {@link checkInternalReferences}.
   */
  tableOfContents(): void {
    this.toc = new TableOfContents();
    this.references = {};
    this.anchors.length = 0;
    // Collect all file names as potential anchors.
    for (const snip of this.snippets) {
      snip.tableOfContents(this.toc, snip.name,);
      this.anchors.push(snip.name,);
      const refs = snip.internalReferences();
      if (refs.length > 0) this.references[snip.name] = refs;
    }
    // Then add all section entries as well, HTML-style `<file>#<tag>`.
    for (const tocEntry of this.toc) {
      this.anchors.push(`${tocEntry.file}#${tocEntry.tag}`,);
    }
  }

  /** Avisa sobre referências internas que apontam para âncoras desconhecidas. */
  checkInternalReferences(): void {
    for (const snip of Object.keys(this.references,)) {
      for (const reference of this.references[snip] ?? []) {
        if (!this.anchors.includes(reference,)) {
          MessageHandlerInstance.instance.warning(
            "rt_doc_unknown_reference",
            `Rich text file ${snip} references unknown object ${reference}`,
          );
        }
      }
    }
  }

  /**
   * Gera o HTML do documento: encadeia prev/next, monta o índice e cada snip.
   * Retorna mapa `'toc.html'`/`'<snip>.html'` → string HTML completa (a
   * escrita em disco é delegada à camada de exportação / Fase 17).
   */
  generateHTML(directory = "",): Record<string, string> {
    this.crossReference();

    const out: Record<string, string> = {};
    out[directory + "toc.html"] = this.generateHTMLTableOfContents();

    for (const snip of this.snippets) {
      out[directory + snip.name + ".html"] = snip.generateHTML();
    }
    return out;
  }

  // --- Métodos abstratos (implementados pelas subclasses, ex.: UserManual) ---

  /** Folha de estilos do documento (Ruby: `generateStyleSheet`). */
  abstract generateStyleSheet(): XMLElementLike;
  /** Capa do índice (Ruby: `generateHTMLCover`). */
  abstract generateHTMLCover(): XMLElementLike;
  /** Cabeçalho de cada página (Ruby: `generateHTMLHeader`). */
  abstract generateHTMLHeader(): XMLElementLike;
  /** Rodapé de cada página (Ruby: `generateHTMLFooter`). */
  abstract generateHTMLFooter(): XMLElementLike;
  /** Barra de navegação prev/next (Ruby: `generateHTMLNavigationBar`). */
  abstract generateHTMLNavigationBar(
    prevName: string | null,
    prevFile: string | null,
    nextName: string | null,
    nextFile: string | null,
  ): XMLElementLike;

  // --- Privados ---

  /**
   * Encadeia `prevSnip`/`nextSnip` nos snips novos. Só executa se `dirty`
   * (Document.rb:113-126) e limpa a marca ao terminar.
   */
  private crossReference(): void {
    if (!this.dirty) return;

    let prevSnip: RichTextSnip | null = null;
    for (const snip of this.snippets) {
      if (prevSnip) {
        snip.prevSnip = prevSnip;
        prevSnip.nextSnip = snip;
      }
      prevSnip = snip;
    }

    this.dirty = false;
  }

  /** Página de índice: capa + TOC + rodapé (Document.rb:129-142). */
  private generateHTMLTableOfContents(): string {
    const shell = createHtmlShell();
    shell.generateHead("Index",);
    const body = shell.body;

    body.append(this.generateHTMLCover(),);
    if (this.toc) body.append(this.toc.to_html(),);
    body.append(new SimpleXMLElement("br",),);
    body.append(new SimpleXMLElement("hr",),);
    body.append(new SimpleXMLElement("br",),);
    body.append(this.generateHTMLFooter(),);

    return shell.toHTML();
  }
}
