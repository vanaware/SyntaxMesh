/**
 * GanttHeaderScaleItem (Fase 15.8) — célula de uma escala do cabeçalho.
 *
 * Port fiel de
 * `docs/taskjuggler/lib/taskjuggler/reports/GanttHeaderScaleItem.rb`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.8)
 */
import {
  SimpleXMLElement,
  type XMLElementLike,
} from "../richtext/xml-like.ts";

/**
 * Célula de escala (ex.: "Jan 2027" na linha grande, "07" na pequena).
 *
 * Nota: o Ruby também declara `attr_reader :pos`, mas `@pos` nunca é
 * atribuído (leitor morto) e nenhum consumidor o usa — omitido aqui.
 */
export class GanttHeaderScaleItem {
  readonly label: string;
  readonly width: number;
  private readonly x: number;
  private readonly y: number;
  private readonly height: number;

  constructor(
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    this.label = label;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /** Converte a célula em `<div class="tabhead">` (Ruby `to_html`). */
  to_html(): XMLElementLike {
    // Os espaços finais nos estilos fazem parte da string do Ruby.
    const div = new SimpleXMLElement("div", {
      class: "tabhead",
      style: "font-weight:bold; position:absolute; " +
        `left:${this.x}px; top:${this.y}px; ` +
        `width:${this.width}px; height:${this.height}px; `,
    },);
    const div1 = new SimpleXMLElement("div", { style: "padding:3px; ", },);
    div1.append(`${this.label}`,);
    div.append(div1,);
    return div;
  }
}
