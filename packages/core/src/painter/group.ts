/**
 * 17.8.6 — `Group`: agrupa elementos com atributos comuns (`Painter/Group.rb`).
 *
 * Porta `TaskJuggler::Painter::Group`: valida as chaves contra a lista fixa
 * de atributos herdáveis, acumula elementos produzidos pelas primitivas
 * (`Primitives`, 17.9) e serializa como `<g>`.
 *
 * Observações do oráculo Ruby (2026-11-04, `.tmp/element_ruby_check.rb`):
 * - A mensagem de erro é diferente da do `Element`: traz a lista sugerida —
 *   `"Unsupported attribute bogus. Use one of fill, font_family, font_size,
 *   stroke, stroke_width."` (os símbolos do Ruby viram texto sem `:`).
 * - `@values = values`: o Group **aliasa** o hash recebido (não copia, ao
 *   contrário do `Element`). Mutar o objeto depois de construir altera o SVG
 *   — replicado no port, que guarda a mesma referência.
 * - `to_svg` com um filho: `"<g fill=\"red\"><foo a=\"1\"></foo></g>"` — sem
 *   quebra de linha (regra do 17.1: só há `\n` com 2+ filhos não-`XMLText`).
 * - **Divergência (Categoria A)**: o Ruby aceita bloco de arity 0 via
 *   `instance_eval` (com `method_missing` delegado ao `self` original) e de
 *   arity 1 via `yield self`. Em TS não existe `instance_eval`; o bloco
 *   recebe sempre o grupo como parâmetro (`(g) => { g.line(…) }`), que é o
 *   caminho já usado pelo `Painter` do port.
 *
 * Integração com `Primitives` (17.9): no Ruby `Group` inclui `Primitives`, então
 * `Group extends Primitives` aqui. O campo `elements` (que alimenta `to_svg`) e
 * as formas (`line`, `rect`, `group`, …) vêm da base; `newGroup` é o gancho que
 * devolve um `Group` e mantém `primitives.ts` sem dependência de valor em
 * `group.ts`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Group.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.8)
 */

import { TjArgumentError, } from "../model/errors.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import { Primitives, } from "./primitives.ts";
import { type SVGValues, valuesToSVG, } from "./svg-support.ts";

/** Bloco do Ruby (`&block`): recebe o grupo em construção. */
export type GroupBlock = (group: Group,) => void;

/** Atributos que um `<g>` pode herdar (`@attributes` do Ruby, na ordem). */
export const GROUP_ATTRS: readonly string[] = [
  "fill",
  "font_family",
  "font_size",
  "stroke",
  "stroke_width",
];

export class Group extends Primitives {
  /** Chaves aceitas num grupo (`@attributes`). */
  protected readonly attributes: readonly string[] = GROUP_ATTRS;
  /** Atributos do grupo — aliasados do argumento, como no Ruby. */
  protected values: SVGValues;

  /** Ruby `initialize(values, &block)`. */
  constructor(values: SVGValues, block?: GroupBlock,) {
    super();
    for (const key of Object.keys(values,)) {
      if (!this.attributes.includes(key,)) {
        throw new TjArgumentError(
          `Unsupported attribute ${key}. Use one of ` +
            `${this.attributes.join(", ",)}.`,
        );
      }
    }

    this.values = values;

    block?.(this,);
  }

  /** Gancho de `Primitives#group`: um grupo filho é um novo `Group`. */
  protected newGroup(attrs: SVGValues, block?: GroupBlock,): Group {
    return new Group(attrs, block,);
  }

  /** `<g …>filhos</g>` — Ruby `XMLElement.new('g', valuesToSVG) { … }`. */
  to_svg(): XMLElement {
    return new XMLElement(
      "g",
      valuesToSVG(this.values,),
      false,
      () => this.elements.map((element,) => element.to_svg()),
    );
  }
}
