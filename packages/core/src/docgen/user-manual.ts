/**
 * `user-manual.ts` — manual do usuário em HTML (22.1b.5).
 *
 * Port de `UserManual.rb` (244 linhas). A diferença estrutural é a mesma de
 * todo o `doc-core`: o Ruby escreve arquivos (`generate(directory)`,
 * `FileUtils.cp_r`), aqui o manual é **devolvido como mapa**
 * `nome → conteúdo` — quem grava é a CLI, no `--output-dir`.
 *
 * O manual é uma composição de três partes:
 *
 * 1. os capítulos em RichText ({@link MANUAL_CHAPTERS}), viram
 *    `RichTextSnip`s do `RichTextDocument`;
 * 2. a tabela de conteúdos agregada, incluindo o apêndice `A` da referência
 *    de sintaxe (`SyntaxReference.tableOfContents`);
 * 3. as páginas geradas pela referência (uma por keyword), mais
 *    `navbar.html`, `alphabet.html` e o `index.html` em frames.
 *
 * O corpus de exemplos também é embutido ({@link EXAMPLE_CORPUS}); o
 * {@link exampleText} alimenta tanto as páginas de keyword quanto a função de
 * bloco `<[example …]>` dos capítulos.
 *
 * @see docs/taskjuggler/lib/taskjuggler/UserManual.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco F
 */

import { AppConfig, } from "../app-config.ts";
import { RichTextDocument, } from "../richtext/rich-text-document.ts";
import {
  A,
  B,
  BR,
  DIV,
  EM,
  FRAME,
  FRAMESET,
  H1,
  H3,
  HR,
  TABLE,
  TD,
  TR,
} from "../html/html-elements.ts";
import { HTMLDocument, } from "../html/html-document.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { RichTextFunctionExample, } from "../richtext/handlers/function-example.ts";
import { SyntaxReference, } from "./syntax-reference.ts";
import { ExampleSnippet, } from "./example-snippet.ts";
import type { ManualPageContext, } from "./manual-context.ts";
import { MANUAL_CHAPTERS, } from "./manual/chapters.ts";
import { EXAMPLE_CORPUS, } from "./manual/example-corpus.ts";
import {
  MANUAL_STYLESHEET,
  MANUAL_STYLESHEET_NAME,
} from "./manual/manual-css.ts";

/** Lema do manual (`UserManual.rb:103`). */
const TAGLINE = "Project management, simplified";

/** Opções de construção do manual. */
export interface UserManualOptions {
  /** Omite keywords `deprecated`/`removed` do apêndice. */
  ignoreOld?: boolean;
  /**
   * Referência já construída (para compartilhar o índice caro entre consumidores).
   * Quando ausente, o manual cria a sua, ligada a si mesmo.
   */
  reference?: SyntaxReference;
}

/**
 * Manual do usuário: capítulos RichText + referência de sintaxe.
 *
 * Implementa {@link ManualPageContext}, então serve de contexto para as
 * páginas de keyword (`KeywordDocumentation.toHTML`).
 */
export class UserManual extends RichTextDocument implements ManualPageContext {
  /** Referência de sintaxe publicada no apêndice A. */
  readonly reference: SyntaxReference;
  /** Trechos de exemplo já processados, por arquivo do corpus. */
  private readonly exampleCache = new Map<string, ExampleSnippet>();

  /**
   * Monta o manual inteiro (capítulos + referência de sintaxe).
   *
   * @param options referência já construída e filtro de keywords antigas.
   */
  constructor(options: UserManualOptions = {},) {
    super();
    this.reference = options.reference ??
      new SyntaxReference(this, options.ignoreOld ?? false,);
    this.registerFunctionHandler(
      new RichTextFunctionExample((file, tag,) => this.exampleText(file, tag,)),
    );
    this.linkTarget = "_top";
  }

  /**
   * Gera o manual completo como mapa `nome → conteúdo`.
   *
   * As chaves são relativas ao diretório de saída: `index.html`, `toc.html`,
   * `<capítulo>.html`, `<keyword>.html`, `navbar.html`, `alphabet.html` e
   * `css/tjmanual.css`.
   */
  generate(): Record<string, string> {
    for (const chapter of MANUAL_CHAPTERS) {
      const snip = this.addSnip(chapter.name, chapter.text,);
      snip.setCssClass("manual",);
    }

    this.tableOfContents();
    // O apêndice da referência é a seção `A` (`UserManual.rb:221-226`).
    if (this.toc !== null) {
      this.reference.tableOfContents(this.toc, "A",);
    }
    const keywords = this.reference.all();
    this.anchors.push(...keywords,);

    // Índice + capítulos (Snip#generateHTML de cada um).
    const pages = this.generateHTML("",);

    for (const keyword of keywords) {
      pages[`${keyword}.html`] = this.reference.generateHTMLreference(
        keyword,
        this,
      );
    }
    Object.assign(pages, this.reference.generateHTMLnavbar(keywords,),);
    pages["index.html"] = this.generateHTMLIndex();

    // As páginas de keyword só coletam referências na geração do HTML
    // (`UserManual.rb:81-85`), então a fusão acontece depois.
    this.references = {
      ...this.references,
      ...this.reference.internalReferences(),
    };
    this.checkInternalReferences();

    pages[MANUAL_STYLESHEET_NAME] = MANUAL_STYLESHEET;
    return pages;
  }

  /**
   * Trecho de exemplo anotado (`# *** EXAMPLE: <tag> +`).
   *
   * @returns `null` quando o arquivo não está no corpus distribuído.
   */
  exampleText(file: string, tag: string | null,): string | null {
    let snippet = this.exampleCache.get(file,);
    if (snippet === undefined) {
      const source = EXAMPLE_CORPUS[file];
      if (source === undefined) return null;
      snippet = new ExampleSnippet();
      snippet.parse(source,);
      this.exampleCache.set(file, snippet,);
    }
    return snippet.text(tag,);
  }

  // --- ManualPageContext / RichTextDocument --------------------------------

  /** `<link>` da folha de estilos (`UserManual.rb:90-93`). */
  generateStyleSheet(): XMLElementLike {
    return new XMLElement("link", {
      rel: "stylesheet",
      type: "text/css",
      href: MANUAL_STYLESHEET_NAME,
    },);
  }

  /** Capa do índice (`UserManual.rb:97-120`). */
  generateHTMLCover(): XMLElementLike {
    const today = new Date().toISOString().slice(0, 10,);
    return new DIV(
      { align: "center", style: "margin-top:40px; margin-bottom:40px", },
      () => [
        new H1({}, () => `The ${AppConfig.softwareName} User Manual`,),
        new EM({}, () => TAGLINE,),
        new BR({},),
        new B({}, () => AppConfig.copyright,),
        new BR({},),
        `Generated on ${today}`,
        new BR({},),
        new H3({}, () =>
          `This manual covers ${AppConfig.softwareName} ` +
          `version ${AppConfig.version}.`,),
      ],
    );
  }

  /** Cabeçalho do topo das páginas (`UserManual.rb:124-135`). */
  generateHTMLHeader(): XMLElementLike {
    return new DIV({ align: "center", }, () => [
      new H3(
        { align: "center", },
        () => `The ${AppConfig.softwareName} User Manual`,
      ),
      new EM({ align: "center", }, () => TAGLINE,),
    ],);
  }

  /** Rodapé das páginas (`UserManual.rb:139-150`). */
  generateHTMLFooter(): XMLElementLike {
    return new DIV({ align: "center", style: "font-size:10px;", }, () => [
      `${AppConfig.copyright}. `,
      new A(
        { href: `mailto:${AppConfig.contact}`, },
        () => AppConfig.softwareName,
      ),
      ` is a project management tool.`,
    ],);
  }

  /**
   * Barra `<< anterior · índice · próximo >>` (`UserManual.rb:158-192`).
   *
   * O Ruby devolve um **array** de elementos; o contrato de
   * `RichTextDocument` pede um elemento, então a lista vai dentro de um
   * `div` (sem efeito visual: os filhos já são blocos).
   */
  generateHTMLNavigationBar(
    predLabel: string | null,
    predUrl: string | null,
    succLabel: string | null,
    succUrl: string | null,
  ): XMLElementLike {
    const html: XMLElement[] = [new BR({},), new HR({},),];

    if (predLabel !== null || succLabel !== null) {
      const previous: XMLElement = new TD(
        { style: "text-align:left; width:35%;", },
        () =>
          predLabel === null ? null : [
            "<< ",
            new A({ href: predUrl ?? "", }, () => predLabel,),
            " <<",
          ],
      );
      const next: XMLElement = new TD(
        { style: "text-align:right; width:35%;", },
        () =>
          succLabel === null ? null : [
            ">> ",
            new A({ href: succUrl ?? "", }, () => succLabel,),
            " >>",
          ],
      );
      html.push(
        new TABLE(
          { style: "width:90%; margin-left:5%; margin-right:5%", },
          () =>
            new TR({}, () => [
              previous,
              new TD({ style: "text-align:center; width:30%;", }, () =>
                new A({ href: "toc.html", }, () => "Table Of Contents",),),
              next,
            ],),
        ),
      );
      html.push(new HR({},),);
    }
    html.push(new BR({},),);
    return new DIV({}, () => html,);
  }

  // --- Privados ------------------------------------------------------------

  /**
   * `index.html` em frames (`UserManual.rb:195-215`): navegador e alfabeto à
   * esquerda, página selecionada à direita.
   */
  private generateHTMLIndex(): string {
    const html = new HTMLDocument("frameset",);
    const root = html.generateHead(
      `The ${AppConfig.softwareName} User Manual`,
      {
        description:
          `A reference and user manual for the ${AppConfig.softwareName} project management software.`,
        keywords: `syntaxmesh, project management, manual, reference`,
      },
    );
    root.append(
      new XMLElement("frameset", { cols: "15%, 85%", }, false, () => [
        new XMLElement("frameset", { rows: "140,*", }, false, () => [
          new FRAME({ src: "alphabet.html", name: "alphabet", },),
          new FRAME({ src: "navbar.html", name: "navigator", },),
        ],),
        new FRAME({ src: "toc.html", name: "display", },),
      ],),
    );
    return html.write(".",) ?? "";
  }
}
