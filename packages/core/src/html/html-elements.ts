/**
 * HTMLElements — port of `HTMLElements.rb` (phase 17.3).
 *
 * In Ruby, `class_eval` generates an UPPERCASE class for each tag of the
 * `htmlTags` list; the constructor only repeats `super(tag, attrs, selfClosing)`,
 * where `selfClosing` is the presence of the tag in `closureTags`. TypeScript has
 * no `class_eval`, so `createHTMLElementClass()` is the factory and every class
 * is exported nominally (ADR 038, plan rule: "static map of classes").
 *
 * Ruby behaviours preserved:
 *   - `initialize(attrs = {}, &block)` **forwards the block** to `super` (in Ruby
 *     the block is passed implicitly even with explicit arguments), so
 *     `DIV.new { block }` works like `XMLElement.new('div', …, block)`.
 *   - `closureTags` holds tags that are not in `htmlTags` (`area`, `base`,
 *     `basefont`, `input`, `img`, `link`). Ruby does not generate a class for
 *     them; the list is kept whole and the intersection decides `selfClosing`.
 *   - Only `br`, `hr` and `meta` (the ones common to both lists) start out
 *     self-closed.
 *
 * Non-idiomatic addition to TS (recorded in ADR 038): `Object.defineProperty`
 * gives the class the UPPERCASE name Ruby would give it, so that
 * `DIV.name === 'DIV'` — useful in error messages and introspection.
 *
 * @see docs/taskjuggler/lib/taskjuggler/HTMLElements.rb
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.3)
 */

import { type XmlBlock, XMLElement, } from "../xml/xml-element.ts";

/** The 25 supported tags (Ruby `htmlTags`), in the order of the original file. */
export const htmlTags: readonly string[] = [
  "a",
  "b",
  "body",
  "br",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "frame",
  "frameset",
  "footer",
  "h1",
  "h2",
  "h3",
  "head",
  "html",
  "hr",
  "meta",
  "p",
  "pre",
  "span",
  "table",
  "td",
  "title",
  "tr",
];

/** Self-closing tags (Ruby `closureTags`) — not all of them become a class. */
export const closureTags: readonly string[] = [
  "area",
  "base",
  "basefont",
  "br",
  "hr",
  "input",
  "img",
  "link",
  "meta",
];

/**
 * Signature of the generated classes: the Ruby `attrs` first and the block
 * second (the tag `name` is already baked into the closure).
 */
export type HTMLElementConstructor = new (
  attrs?: Record<string, string>,
  block?: XmlBlock,
) => XMLElement;

/**
 * Factory equivalent to Ruby's `class_eval` (17.3.4): returns a subclass of
 * `XMLElement` pinned to `tag` and to the matching `selfClosing` flag.
 *
 * @param tag HTML tag name the class represents.
 * @returns A constructor of self-contained `XMLElement` subclasses.
 */
export function createHTMLElementClass(tag: string,): HTMLElementConstructor {
  const selfClosing = closureTags.includes(tag,);
  const cls = class extends XMLElement {
    constructor(
      attrs: Record<string, string> = {},
      block?: XmlBlock,
    ) {
      super(tag, attrs, selfClosing, block,);
    }
  };
  Object.defineProperty(cls, "name", {
    value: tag.toUpperCase(),
    configurable: true,
  },);
  return cls;
}

/** HTML `<a>` element. */
export const A: HTMLElementConstructor = createHTMLElementClass("a",);
/** HTML `<b>` element. */
export const B: HTMLElementConstructor = createHTMLElementClass("b",);
/** HTML `<body>` element. */
export const BODY: HTMLElementConstructor = createHTMLElementClass("body",);
/** HTML `<br>` element (self-closing). */
export const BR: HTMLElementConstructor = createHTMLElementClass("br",);
/** HTML `<code>` element. */
export const CODE: HTMLElementConstructor = createHTMLElementClass("code",);
/** HTML `<col>` element. */
export const COL: HTMLElementConstructor = createHTMLElementClass("col",);
/** HTML `<colgroup>` element. */
export const COLGROUP: HTMLElementConstructor = createHTMLElementClass(
  "colgroup",
);
/** HTML `<div>` element. */
export const DIV: HTMLElementConstructor = createHTMLElementClass("div",);
/** HTML `<em>` element. */
export const EM: HTMLElementConstructor = createHTMLElementClass("em",);
/** HTML `<frame>` element. */
export const FRAME: HTMLElementConstructor = createHTMLElementClass("frame",);
/** HTML `<frameset>` element. */
export const FRAMESET: HTMLElementConstructor = createHTMLElementClass(
  "frameset",
);
/** HTML `<footer>` element. */
export const FOOTER: HTMLElementConstructor = createHTMLElementClass("footer",);
/** HTML `<h1>` element. */
export const H1: HTMLElementConstructor = createHTMLElementClass("h1",);
/** HTML `<h2>` element. */
export const H2: HTMLElementConstructor = createHTMLElementClass("h2",);
/** HTML `<h3>` element. */
export const H3: HTMLElementConstructor = createHTMLElementClass("h3",);
/** HTML `<head>` element. */
export const HEAD: HTMLElementConstructor = createHTMLElementClass("head",);
/** HTML `<html>` element. */
export const HTML: HTMLElementConstructor = createHTMLElementClass("html",);
/** HTML `<hr>` element (self-closing). */
export const HR: HTMLElementConstructor = createHTMLElementClass("hr",);
/** HTML `<meta>` element (self-closing). */
export const META: HTMLElementConstructor = createHTMLElementClass("meta",);
/** HTML `<p>` element. */
export const P: HTMLElementConstructor = createHTMLElementClass("p",);
/** HTML `<pre>` element. */
export const PRE: HTMLElementConstructor = createHTMLElementClass("pre",);
/** HTML `<span>` element. */
export const SPAN: HTMLElementConstructor = createHTMLElementClass("span",);
/** HTML `<table>` element. */
export const TABLE: HTMLElementConstructor = createHTMLElementClass("table",);
/** HTML `<td>` element. */
export const TD: HTMLElementConstructor = createHTMLElementClass("td",);
/** HTML `<title>` element. */
export const TITLE: HTMLElementConstructor = createHTMLElementClass("title",);
/** HTML `<tr>` element. */
export const TR: HTMLElementConstructor = createHTMLElementClass("tr",);

/**
 * Mirrors Ruby's `module HTMLElements`: one constant per tag, reachable by
 * dynamic name (`HTMLElements['DIV']`) and sharing **identity** with the
 * nominal exports — as in Ruby, where `HTMLElements::DIV` is the class itself.
 * Useful when the tag name is only known at runtime.
 */
export const HTMLElements: Record<string, HTMLElementConstructor> = {
  A,
  B,
  BODY,
  BR,
  CODE,
  COL,
  COLGROUP,
  DIV,
  EM,
  FOOTER,
  FRAME,
  FRAMESET,
  H1,
  H2,
  H3,
  HEAD,
  HR,
  HTML,
  META,
  P,
  PRE,
  SPAN,
  TABLE,
  TD,
  TITLE,
  TR,
};
