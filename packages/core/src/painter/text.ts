/**
 * 17.9.2 — `Text`: elemento de texto do Painter (`Painter/Text.rb`).
 *
 * Porta `TaskJuggler::Painter::Text`: um `Element` de tag `text` com as
 * coordenadas `x`/`y` mais os atributos de texto (`TextAttrs`); o conteúdo é
 * guardado em `@text` e sai entre as tags.
 *
 * Definição de `TextAttrs` (Ruby `Primitives::TextAttrs`):
 * `FillAndStrokeAttrs + [:font_family, :font_size]`. Vive aqui — e não em
 * `primitives.ts` — para manter o grafo de módulos acíclico: `Primitives`
 * importa `Text`, então `Text` não pode importar `Primitives`. O conteúdo e a
 * ordem são os do Ruby.
 *
 * Saídas conferidas no oráculo (2026-11-04, `.tmp/shapes_ruby_check.rb`):
 * - `Text.new('hi', {x: 1, y: 2}).to_svg.to_s` == `<text x="1" y="2">hi</text>`.
 * - `font_family`/`font_size` aceitos: `<text font-family="Arial"
 *   font-size="10pt" x="1" y="2">hi</text>`.
 * - String vazia e `nil` ambos produzem `<text x="1" y="2"></text>`: no Ruby
 *   `''` é truthy e entra como `XMLText.new('')` (serializa vazio); `nil` fica
 *   de fora. O resultado textual é idêntico — o port usa `text !== null`, como
 *   em `Element`.
 * - Chave não listada → `ArgumentError: Unsupported attribute z` (herança do
 *   construtor de `Element`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Text.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.9.2)
 */

import { FillAndStrokeAttrs, } from "./basic-shapes.ts";
import { Element, } from "./element.ts";
import { type SVGValues, } from "./svg-support.ts";

/** Atributos de texto (Ruby `Primitives::TextAttrs`), na ordem do Ruby. */
export const TextAttrs: readonly string[] = [
  ...FillAndStrokeAttrs,
  "font_family",
  "font_size",
];

export class Text extends Element {
  /** Ruby `initialize(str, attrs)` — `str` é o conteúdo textual. */
  constructor(str: string, attrs: SVGValues,) {
    super("text", [...["x", "y",], ...TextAttrs,], attrs,);
    this.text = str;
  }
}
