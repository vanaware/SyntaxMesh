/**
 * 17.10 — `Painter`: o canvas SVG (`Painter.rb`).
 *
 * Porta `TaskJuggler::Painter`: um retângulo `width × height` que acumula
 * elementos (via `Primitives`) e serializa a raiz `<svg width="…px"
 * height="…px">…</svg>`.
 *
 * Estrutura do port: `Painter extends Primitives` (no Ruby é `include
 * Primitives`), e implementa `newGroup` devolvendo um `Group`. As formas
 * (`rect`, `line`, `text`, `group`, …) já vêm da base e empurram para o mesmo
 * `@elements`.
 *
 * Saídas conferidas no oráculo (2026-11-04, `.tmp/painter_ruby_check.rb`):
 * - `Painter.new(100, 50).to_svg.to_s` == `<svg height="50px" width="100px"></svg>`
 *   — `height` vem **antes** de `width` (XMLElement ordena as chaves, regra do 17.1).
 * - 1 filho: `<svg …><line …></line></svg>` (sem quebra).
 * - 2 filhos: `\n` + indent de 1 espaço antes de cada filho (regra do 17.1).
 * - `group` e `group` aninhado serializam `<g>` dentro do `<svg>`.
 * - **Divergência (Categoria B/C, documentada)**: o Ruby faz `"#{@width}px"`;
 *   para Floats inteiros (`50.0`) isso dá `"50.0px"`, mas `String(50.0)` em TS
 *   é `"50"`. `100.5` → `"100.5px"` em ambos. Só o caso Float-inteiro difere; o
 *   `ChartPlotter` passa `Integer`, então não aparece nos goldens reais.
 * - **Divergência (Categoria A)**: como em `Group`, o `instance_eval` (bloco de
 *   arity 0) não existe em TS; o bloco sempre recebe o `Painter` (`yield self`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.10)
 */

import { XMLElement, } from "../xml/xml-element.ts";
import { Group, type GroupBlock, } from "./group.ts";
import { Primitives, } from "./primitives.ts";
import { type SVGValues, } from "./svg-support.ts";

/** Bloco do construtor (Ruby `&block`): recebe o `Painter` em construção. */
export type PainterBlock = (painter: Painter,) => void;

export class Painter extends Primitives {
  private readonly width: number;
  private readonly height: number;

  /** Ruby `initialize(width, height, &block)`. */
  constructor(width: number, height: number, block?: PainterBlock,) {
    super();
    this.width = width;
    this.height = height;
    block?.(this,);
  }

  /** Gancho de `Primitives#group`: um grupo filho é um novo `Group`. */
  protected newGroup(attrs: SVGValues, block?: GroupBlock,): Group {
    return new Group(attrs, block,);
  }

  /** Raiz `<svg width="…px" height="…px">` com todos os elementos. */
  to_svg(): XMLElement {
    return new XMLElement(
      "svg",
      { height: `${this.height}px`, width: `${this.width}px`, },
      false,
      () => this.elements.map((element,) => element.to_svg()),
    );
  }
}
