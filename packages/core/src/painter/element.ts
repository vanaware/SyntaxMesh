/**
 * 17.8.1 — `Element`: base de todo elemento desenhável (`Painter/Element.rb`).
 *
 * Porta `TaskJuggler::Painter::Element`: guarda o tipo da tag, a lista de
 * atributos aceitos, os valores fornecidos e um texto opcional; `to_svg()`
 * produz a árvore `XMLElement` já em sintaxe SVG.
 *
 * Observações do oráculo Ruby (2026-11-04, `.tmp/element_ruby_check.rb`):
 * - `Element.new('foo', [:a, :b], {a: 1, b: 2}).to_svg.to_s` ==
 *   `"<foo a=\"1\" b=\"2\"></foo>"` — o Ruby **não** fecha a tag em `<foo/>`
 *   (`selfClosing` fica `false`), e os atributos saem **ordenados** (regra do
 *   17.1), não na ordem do hash de origem.
 * - Atributo desconhecido → `ArgumentError: Unsupported attribute c`.
 * - `@text = ''` **é** truthy no Ruby (`if @text`), então `XMLText.new('')`
 *   entra como filho e serializa vazio: `<foo></foo>`. O port usa
 *   `text !== null`, não `if (text)`, para preservar isso.
 * - **Divergência do plano**: o plano pede `abstract class Element`, mas o
 *   Ruby instancia `Element` diretamente (não há `private_class_method new`),
 *   e os testes desta fase usam instâncias nuas. Mantida classe concreta.
 * - `values` é tipado como `SVGValues` (não `Record<string, unknown>`): os
 *   valores do Painter são sempre número, string ou objeto com `to_s()`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Element.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.8)
 */

import { TjArgumentError, } from "../model/errors.ts";
import { XMLElement, XMLText, } from "../xml/xml-element.ts";
import { type SVGValues, valuesToSVG, } from "./svg-support.ts";

/**
 * Contrato de tudo que o Painter sabe aninhar: `Element` e `Group` (no Ruby a
 * lista `@elements` é dinâmica — um `Group` aceita outro `Group` dentro).
 */
export interface Drawable {
  to_svg(): XMLElement;
}

export class Element {
  /** Nome da tag SVG (`@type` do Ruby): `line`, `rect`, `text`, … */
  protected type: string;
  /** Chaves aceitas por este elemento (`@attributes`). */
  protected attributes: string[];
  /** Atributos efetivamente fornecidos (`@values`). */
  protected values: SVGValues;
  /** Texto do elemento (`@text`); `null` = sem texto (Ruby `nil`). */
  protected text: string | null;

  /**
   * Ruby `initialize(type, attrs, values)` — cada chave de `values` precisa
   * estar em `attrs`, ou o elemento levanta `ArgumentError`.
   */
  constructor(type: string, attrs: string[], values: SVGValues,) {
    this.type = type;
    this.attributes = attrs;
    this.values = {};
    this.text = null;

    for (const [key, value,] of Object.entries(values,)) {
      if (!this.attributes.includes(key,)) {
        throw new TjArgumentError(`Unsupported attribute ${key}`,);
      }
      this.values[key] = value;
    }
  }

  /** Converte o elemento em `XMLElement` com sintaxe SVG. */
  to_svg(): XMLElement {
    const el = new XMLElement(this.type, valuesToSVG(this.values,),);
    // Ruby `if @text`: '' é truthy, só nil fica de fora.
    if (this.text !== null && this.text !== undefined) {
      el.append(new XMLText(this.text,),);
    }
    return el;
  }
}
