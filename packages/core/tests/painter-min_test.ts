/**
 * Testes de PainterMin (Fase 14.22.1) — pincel SVG mínimo.
 *
 * Cobre as primitivas (`group`, `line`, `rect`, `text`, `circle`, `polyline`),
 * a conversão de cores (nomeada, RGB e HSV), a serialização SVG (`to_svg`) com
 * atributos em travessão e `font_size` com unidade `pt`, e a validação de
 * atributos de `group`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.22.1)
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { colorFromHsv, PainterMin, } from "../src/painter-min.ts";

describe("PainterMin — primitivas SVG (14.22.1)", () => {
  it("line serializa x1/y1/x2/y2 (14.22.1.4)", () => {
    const p = new PainterMin(100, 50,);
    p.line(1, 2, 3, 4,);
    const svg = p.to_svg().toHTML();
    assert(svg.includes('x1="1"',), svg,);
    assert(svg.includes('y1="2"',), svg,);
    assert(svg.includes('x2="3"',), svg,);
    assert(svg.includes('y2="4"',), svg,);
    assert(svg.includes("<line",), svg,);
  });

  it("line aplica atributos de estilo com travessões (14.22.1.4)", () => {
    const p = new PainterMin(100, 50,);
    p.line(0, 0, 10, 10, { stroke: "#ff0000", stroke_width: 3, },);
    const svg = p.to_svg().toHTML();
    assert(svg.includes('stroke="#ff0000"',), svg,);
    assert(svg.includes('stroke-width="3"',), svg,);
  });

  it("rect serializa x/y/width/height (14.22.1.5)", () => {
    const p = new PainterMin(100, 50,);
    p.rect(5, 6, 7, 8,);
    const svg = p.to_svg().toHTML();
    assert(svg.includes('x="5"',) && svg.includes('width="7"',), svg,);
    assert(svg.includes('y="6"',) && svg.includes('height="8"',), svg,);
  });

  it("text serializa conteúdo escapado (14.22.1.6)", () => {
    const p = new PainterMin(100, 50,);
    p.text(2, 3, "a<b",);
    const svg = p.to_svg().toHTML();
    assert(svg.includes('x="2"',), svg,);
    assert(svg.includes("a&lt;b",), svg,);
    assert(svg.includes("</text>",), svg,);
  });

  it("circle serializa cx/cy/r (14.22.1.7)", () => {
    const p = new PainterMin(100, 50,);
    p.circle(9, 8, 7,);
    const svg = p.to_svg().toHTML();
    assert(svg.includes("<circle",), svg,);
    assert(svg.includes('cx="9"',) && svg.includes('r="7"',), svg,);
  });

  it("polyline serializa pontos no formato SVG (14.22.1.8)", () => {
    const p = new PainterMin(100, 50,);
    p.polyline([[1, 2,], [3, 4,],],);
    const svg = p.to_svg().toHTML();
    // Ruby `Points#to_s`: "x,y " concatenado.
    assert(svg.includes('points="1,2 3,4 "',), svg,);
  });

  it("group envolve primitivas do callback e converte font_size (14.22.1.3)", () => {
    const p = new PainterMin(100, 50,);
    p.group({ stroke: "#000000", font_size: 10.0, }, (gp,) => {
      gp.text(1, 1, "hi",);
    },);
    const svg = p.to_svg().toHTML();
    assert(svg.includes("<g",), svg,);
    assert(svg.includes('stroke="#000000"',), svg,);
    assert(svg.includes('font-size="10pt"',), svg,);
    assert(svg.includes("</g>",), svg,);
  });

  it("group rejeita atributo não suportado (14.22.1.3)", () => {
    const p = new PainterMin(100, 50,);
    assertThrows(
      () => p.group({ bogus_attr: 1, },),
      Error,
      "Unsupported attribute",
    );
  });

  it("color resolve nomeadas e RGB (14.22.1.9)", () => {
    const p = new PainterMin(100, 50,);
    assertEquals(p.color("black",), "#000000",);
    assertEquals(p.color("white",), "#ffffff",);
    assertEquals(p.color(255, 128, 0,), "#ff8000",);
  });

  it("colorFromHsv replica Painter::Color HSV (14.22.1.9)", () => {
    assertEquals(colorFromHsv(0, 255, 255,), "#ff0000",);
    assertEquals(colorFromHsv(0, 0, 230,), "#e6e6e6",);
  });

  it("color nomeada desconhecida lança (14.22.1.9)", () => {
    const p = new PainterMin(100, 50,);
    assertThrows(() => p.color("mauve",), Error, "Unknown color name",);
  });

  it("to_svg cria raiz <svg> com dimensões em px (14.22.1.10)", () => {
    const p = new PainterMin(640, 480,);
    p.line(0, 0, 1, 1,);
    const svg = p.to_svg();
    assertEquals(svg.tag, "svg",);
    assertEquals(svg.attrs.width, "640px",);
    assertEquals(svg.attrs.height, "480px",);
    assert(p.to_svg().toHTML().includes("<line",), "elementos aninhados",);
  });
});
