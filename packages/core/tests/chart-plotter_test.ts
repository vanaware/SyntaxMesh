/**
 * Testes de ChartPlotter (Fase 14.22.2).
 *
 * Cobre `analyzeData` (transpose, validação de tipos/min-max), a geometria
 * (`calcChartGeometry`), os conversores de coordenada e a serialização SVG
 * (`to_svg`) para 1 e 2 séries e para dados de data. Erros de dados lançam
 * `ChartPlotterError` (equivalente ao Ruby).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.22.2)
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { ChartPlotter, ChartPlotterError, } from "../src/chart-plotter.ts";
import { TjTime, } from "../src/time/tj-time.ts";

function date(s: string,): TjTime {
  return TjTime.fromString(s,);
}

describe("ChartPlotter.analyzeData (14.22.2.6)", () => {
  it("transpõe e classifica colunas numéricas", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "Effort", "Load",],
      [date("2026-01-01",), 10, 20,],
      [date("2026-01-08",), 30, 40,],
    ],);
    cp.generate();
    assertEquals(cp.getLabels(), ["Effort", "Load",],);
    assertEquals(cp.getDataType(), "number",);
    assertEquals(cp.getXData()?.length, 2,);
    assertEquals(cp.getYData().length, 2,);
    const [yMin, yMax,] = cp.getYNumericRange();
    assertEquals(yMin, 10,);
    assertEquals(yMax, 40,);
  });

  it("classifica colunas de data como dataType 'date'", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "Deadline",],
      [date("2026-01-01",), date("2026-03-01",),],
      [date("2026-01-08",), date("2026-04-01",),],
    ],);
    cp.generate();
    assertEquals(cp.getDataType(), "date",);
  });

  it("lança quando o cabeçalho não é 'Date'", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Dia", "A",],
      [date("2026-01-01",), 1,],
    ],);
    assertThrows(() => cp.generate(), ChartPlotterError, "'Date' header",);
  });

  it("lança quando a 1ª coluna tem não-data", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "A",],
      ["2026-01-01", 1,], // string, não TjTime
    ],);
    assertThrows(() => cp.generate(), ChartPlotterError, "must be all dates",);
  });

  it("lança quando uma coluna tem dado inválido (string)", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "A",],
      [date("2026-01-01",), "foo",],
    ],);
    assertThrows(
      () => cp.generate(),
      ChartPlotterError,
      "invalid data",
    );
  });

  it("lança quando há mistura de número e data na Y", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "A",],
      [date("2026-01-01",), 5,],
      [date("2026-01-08",), date("2026-02-01",),],
    ],);
    assertThrows(() => cp.generate(), ChartPlotterError, "ignored",);
  });

  it("lança quando nenhuma coluna tem dados válidos", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date",],
      [date("2026-01-01",),],
    ],);
    assertThrows(
      () => cp.generate(),
      ChartPlotterError,
      "valid dates",
    );
  });
});

describe("ChartPlotter.geometria (14.22.2.7/.9)", () => {
  it("x2c/y2c ancoram na origem do gráfico", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "A",],
      [date("2026-01-01",), 1,],
      [date("2026-02-01",), 2,],
    ],);
    cp.generate();
    // leftMargin=70, bottomMargin=30 → origem (70, 450).
    assertEquals(cp.x2c(0,), 70,);
    assertEquals(cp.y2c(0,), 450,);
  });

  it("xDate2c é monotônico com o tempo", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "A",],
      [date("2026-01-01",), 1,],
      [date("2026-02-01",), 2,],
    ],);
    cp.generate();
    const x = cp.getXData()!;
    assert(cp.xDate2c(x[1]!,) > cp.xDate2c(x[0]!,),);
  });

  it("yNum2c: valores maiores ficam mais acima (y menor)", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "A",],
      [date("2026-01-01",), 10,],
      [date("2026-02-01",), 20,],
    ],);
    cp.generate();
    assert(cp.yNum2c(20,) < cp.yNum2c(10,),);
  });

  it("calcula contagem de rótulos X/Y", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "A",],
      [date("2026-01-01",), 1,],
      [date("2026-06-01",), 2,],
    ],);
    cp.generate();
    assert(cp.getNoXLabels() >= 1,);
    assert(cp.getNoYLabels() >= 1,);
  });

  it("garante intervalo mínimo no eixo Y numérico quando tudo igual", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "A",],
      [date("2026-01-01",), 7,],
      [date("2026-02-01",), 7,],
    ],);
    cp.generate();
    // yMin==yMax → força yMin=0 e range >= noYLabels.
    const [yMin, yMax,] = cp.getYNumericRange();
    assertEquals(yMin, 0,);
    assert((yMax as number) > (yMin as number),);
  });
});

describe("ChartPlotter.to_svg (14.22.2.5)", () => {
  it("gera SVG com grade para 1 série", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "Effort",],
      [date("2026-01-01",), 5,],
      [date("2026-01-08",), 10,],
    ],);
    const svg = cp.to_svg();
    assert(svg.startsWith("<svg",), svg.slice(0, 20,),);
    assert(svg.includes("<line",), "grade/série",);
    assert(svg.includes("Effort",), "legenda",);
    assert(svg.endsWith("</svg>",),);
  });

  it("gera SVG com marcadores para 2 séries", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "A", "B",],
      [date("2026-01-01",), 1, 5,],
      [date("2026-01-08",), 2, 4,],
    ],);
    const svg = cp.to_svg();
    assert(svg.includes("A",) && svg.includes("B",), "duas legendas",);
    // Marcadores para séries 0/1 → losango (Ruby `case (type/5)%5 == 0`).
    assert(svg.includes("<polyline",), "marcador losango",);
  });

  it("serializa datas Y no SVG", () => {
    const cp = new ChartPlotter(640, 480, [
      ["Date", "Deadline",],
      [date("2026-01-01",), date("2026-03-01",),],
      [date("2026-01-08",), date("2026-04-01",),],
    ],);
    const svg = cp.to_svg();
    assert(svg.includes("<svg",),);
    assert(svg.includes("Deadline",),);
  });

  it("usa marcador quadrado (rect) para a 6ª série (14.22.2.13)", () => {
    // Ruby `case (type/5)%5`: ci=5 → 1 → quadrado (rect).
    const header = ["Date",];
    for (let i = 0; i < 6; i++) header.push(`S${i}`,);
    const cp = new ChartPlotter(640, 480, [
      header,
      [date("2026-01-01",), 1, 2, 3, 4, 5, 6,],
      [date("2026-02-01",), 6, 5, 4, 3, 2, 1,],
    ],);
    const svg = cp.to_svg();
    assert(svg.includes("<rect",), "marcador quadrado",);
  });

  it("usa marcador círculo para a 21ª série (14.22.2.13)", () => {
    // Ruby `case (type/5)%5`: ci=20 → 4 → círculo (default).
    const header = ["Date",];
    for (let i = 0; i < 21; i++) header.push(`S${i}`,);
    const values: number[] = [];
    for (let i = 0; i < 21; i++) values.push(i + 1,);
    const cp = new ChartPlotter(640, 480, [
      header,
      [date("2026-01-01",), ...values,],
      [date("2026-02-01",), ...values.map((v,) => v + 1),],
    ],);
    const svg = cp.to_svg();
    assert(svg.includes("<circle",), "marcador círculo",);
  });
});
