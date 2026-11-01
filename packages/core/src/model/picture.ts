/**
 * Picture (extensão SyntaxMesh — Fase 10 Complemento C3.3).
 *
 * Imagem anexada a uma `journalentry` ou `status`. Não existe no TaskJuggler
 * original como entidade própria: é uma estrutura mínima que o parser preenche
 * e que os relatórios (Fase 14 Complemento C0.8) e o storage de imagens
 * (Fase 19) consomem.
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (C3.3.5)
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.0.8)
 */
import { isExternalImageRef, } from "../markdown/extensions/images.ts";
import {
  SimpleXMLElement,
  type XMLElementLike,
} from "../richtext/xml-like.ts";

/** Alinhamento válido de uma imagem no relatório. */
export type PictureAlign = "left" | "center" | "right";

/** Opções de render `to_html` (14C.0.8). */
export interface PictureHtmlOptions {
  /**
   * Resolve o `src` de caminhos **relativos** (hook para `resolveImageRef`/
   * `ImageStore` da Fase 19 assíncronos). Sem hook, o caminho relativo é
   * preservado como descritor — o core é DOM-free (ADR 001).
   */
  resolveRelative?: (path: string,) => string;
}

/** Imagem anexada a uma entrada de journal/status. */
export class Picture {
  readonly path: string;
  caption: string | null = null;
  align: PictureAlign | null = null;
  width: number | null = null;
  alt: string | null = null;

  constructor(path: string,) {
    this.path = path;
  }

  /**
   * `<img>` (ou `<figure>/<figcaption>` quando há caption) como elemento
   * XML-like — serializável via `toHTML()`. URL externa passa intacta;
   * relativo permanece como descritor salvo hook `resolveRelative`
   * (contrato 13.14). `align` vira classe CSS do relatório.
   */
  to_html(options: PictureHtmlOptions = {},): XMLElementLike {
    const src = isExternalImageRef(this.path,)
      ? this.path
      : options.resolveRelative
      ? options.resolveRelative(this.path,)
      : this.path;

    const attrs: Record<string, string> = { src, };
    attrs.alt = this.alt ?? "";
    if (this.width !== null) attrs.width = `${this.width}`;
    if (this.align) attrs.class = `tj_picture_align_${this.align}`;
    const img = new SimpleXMLElement("img", attrs,);

    if (!this.caption) return img;

    const figure = new SimpleXMLElement("figure", { class: "tj_figure", },);
    if (this.align) {
      figure.attrs["class"] += ` tj_figure_align_${this.align}`;
    }
    figure.append(img,);
    const figcaption = new SimpleXMLElement("figcaption",);
    figcaption.append(this.caption,);
    figure.append(figcaption,);
    return figure;
  }
}
