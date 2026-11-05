/**
 * HTMLElements — port de `HTMLElements.rb` (Fase 17.3).
 *
 * No Ruby, `class_eval` gera uma classe em MAIÚSCULAS para cada tag da lista
 * `htmlTags`; o construtor apenas repete `super(tag, attrs, selfClosing)`,
 * onde `selfClosing` é a presença da tag em `closureTags`. TypeScript não
 * tem `class_eval`, então `createHTMLElementClass()` é a fábrica e cada classe
 * é exportada nominalmente (ADR 038, regra do plano: "map estático de classes").
 *
 * Fidelidades preservadas do Ruby:
 *   - `initialize(attrs = {}, &block)` **encaminha o bloco** ao `super` (no
 *     Ruby o bloco é passado implicitamente mesmo com argumentos explícitos),
 *     então `DIV.new { block }` funciona como `XMLElement.new('div', …, block)`.
 *   - `closureTags` contém tags que não estão em `htmlTags` (`area`, `base`,
 *     `basefont`, `input`, `img`, `link`). O Ruby não gera classe para elas;
 *     a lista é mantida integral e a interseção decide o `selfClosing`.
 *   - Só `br`, `hr` e `meta` (as comuns às duas listas) nascem auto-fechadas.
 *
 * Acréscimo não-idiomático ao TS (registrado no ADR 038): `Object.defineProperty`
 * dá à classe o nome em MAIÚSCULAS que o Ruby lhe daria, para que
 * `DIV.name === 'DIV'` — útil em mensagens de erro e introspecção.
 *
 * @see docs/taskjuggler/lib/taskjuggler/HTMLElements.rb
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.3)
 */

import { type XmlBlock, XMLElement, } from "../xml/xml-element.ts";

/** As 25 tags suportadas (`htmlTags` do Ruby), na ordem do arquivo original. */
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

/** Tags auto-fechadas (`closureTags` do Ruby) — nem todas viram classe. */
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
 * Assinatura das classes geradas: o `attrs` do Ruby em primeiro lugar e o
 * bloco em segundo (o `name` da tag já está queimado na closure).
 */
export type HTMLElementConstructor = new (
  attrs?: Record<string, string>,
  block?: XmlBlock,
) => XMLElement;

/**
 * Fábrica equivalente ao `class_eval` do Ruby (17.3.4): devolve uma subclasse
 * de `XMLElement` fixada na `tag` e no `selfClosing` correspondente.
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

export const A = createHTMLElementClass("a",);
export const B = createHTMLElementClass("b",);
export const BODY = createHTMLElementClass("body",);
export const BR = createHTMLElementClass("br",);
export const CODE = createHTMLElementClass("code",);
export const COL = createHTMLElementClass("col",);
export const COLGROUP = createHTMLElementClass("colgroup",);
export const DIV = createHTMLElementClass("div",);
export const EM = createHTMLElementClass("em",);
export const FRAME = createHTMLElementClass("frame",);
export const FRAMESET = createHTMLElementClass("frameset",);
export const FOOTER = createHTMLElementClass("footer",);
export const H1 = createHTMLElementClass("h1",);
export const H2 = createHTMLElementClass("h2",);
export const H3 = createHTMLElementClass("h3",);
export const HEAD = createHTMLElementClass("head",);
export const HTML = createHTMLElementClass("html",);
export const HR = createHTMLElementClass("hr",);
export const META = createHTMLElementClass("meta",);
export const P = createHTMLElementClass("p",);
export const PRE = createHTMLElementClass("pre",);
export const SPAN = createHTMLElementClass("span",);
export const TABLE = createHTMLElementClass("table",);
export const TD = createHTMLElementClass("td",);
export const TITLE = createHTMLElementClass("title",);
export const TR = createHTMLElementClass("tr",);

/**
 * Espelha o `module HTMLElements` do Ruby: uma constante por tag, acessível
 * por nome dinâmico (`HTMLElements['DIV']`), com **identidade** igual às
 * exportações nominais — como no Ruby, onde `HTMLElements::DIV` é a própria
 * classe. Útil quando o nome da tag só é conhecido em runtime.
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
