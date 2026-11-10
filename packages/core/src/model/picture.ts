/**
 * Picture (SyntaxMesh extension — phase 10 Complemento C3.3).
 *
 * An image attached to a `journalentry` or `status`. TaskJuggler has no such
 * entity: this is the minimal structure the parser fills and that the reports
 * (phase 14 Complemento C0.8) and the image store (phase 19) consume.
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (C3.3.5)
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.0.8)
 */
import { isExternalImageRef, } from "../markdown/extensions/images.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";

/** Valid alignment of an image in a report. */
export type PictureAlign = "left" | "center" | "right";

/** Options of the `to_html` renderer (14C.0.8). */
export interface PictureHtmlOptions {
  /**
   * Resolves the `src` of **relative** paths (hook for the asynchronous
   * `resolveImageRef`/`ImageStore` of phase 19). Without a hook the relative
   * path is preserved as a descriptor, because the core stays DOM-free
   * (ADR 001).
   */
  resolveRelative?: (path: string,) => string;
}

/** Image attached to a journal or status entry. */
export class Picture {
  /** Path or external URL of the image. */
  readonly path: string;
  /** Caption rendered under the image, or `null` when there is none. */
  caption: string | null = null;
  /** Alignment of the image inside the report. */
  align: PictureAlign | null = null;
  /** Rendered width in pixels, or `null` for the natural size. */
  width: number | null = null;
  /** Alternative text of the image. */
  alt: string | null = null;

  /**
   * Creates a picture pointing at `path`.
   *
   * @param path Relative path or external URL of the image.
   */
  constructor(path: string,) {
    this.path = path;
  }

  /**
   * Builds the `<img>` (or `<figure>`/`<figcaption>` when there is a caption)
   * as an XML-like element, serialisable through `toHTML()`.
   *
   * External URLs pass through untouched; relative paths stay as descriptors
   * unless the `resolveRelative` hook is given (contract 13.14). `align`
   * becomes the CSS class of the report.
   *
   * @param options Rendering options.
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
    const img = new XMLElement("img", attrs,);

    if (!this.caption) return img;

    const figure = new XMLElement("figure", { class: "tj_figure", },);
    if (this.align) {
      figure.attrs["class"] += ` tj_figure_align_${this.align}`;
    }
    figure.append(img,);
    const figcaption = new XMLElement("figcaption",);
    figcaption.append(this.caption,);
    figure.append(figcaption,);
    return figure;
  }
}
