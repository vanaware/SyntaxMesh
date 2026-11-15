/**
 * Testes do gate de benchmarks (F21¹, 26.11.9/26.11.10).
 *
 * Valida o baseline commitado e a lógica pura de regressão (compare.ts) com
 * dados sintéticos — sem rodar os benches reais (lentos/ruidosos) no gate de
 * testes. A medição real fica a cargo de `deno task bench:compare`.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.11)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  type BenchMeasurement,
  type DenoBenchJson,
  detectRegressions,
  extractMeasurements,
} from "./compare.ts";

describe("bench baseline (26.11.10)", () => {
  it("baseline.json existe, é válido e tem >= 10 benches", async () => {
    const url = new URL("./baseline.json", import.meta.url,);
    const json = JSON.parse(await Deno.readTextFile(url,),) as DenoBenchJson;
    assertEquals(json.version, 1,);
    const measurements = extractMeasurements(json,);
    assert(
      measurements.length >= 10,
      `esperava >= 10 benches, veio ${measurements.length}`,
    );
    for (const bench of measurements) {
      assert(bench.name.length > 0, "bench sem nome",);
      assert(bench.avg > 0, `avg inválido em ${bench.name}`,);
    }
  });

  it("sem regressão quando current == baseline (dados reais)", async () => {
    const url = new URL("./baseline.json", import.meta.url,);
    const json = JSON.parse(await Deno.readTextFile(url,),) as DenoBenchJson;
    const baseline = extractMeasurements(json,);
    assertEquals(detectRegressions(baseline, baseline,), [],);
  });
});

describe("bench regression gate (26.11.9)", () => {
  const baseline: BenchMeasurement[] = [
    { name: "parse_100", avg: 100, },
    { name: "schedule_1000", avg: 200, },
  ];

  it("detecta regressão > 20% e respeita o limiar", () => {
    // +50% em parse_100 → regressão; schedule_1000 inalterado.
    const slow: BenchMeasurement[] = [
      { name: "parse_100", avg: 150, },
      { name: "schedule_1000", avg: 200, },
    ];
    const regs = detectRegressions(baseline, slow, 20,);
    assertEquals(regs.length, 1,);
    assertEquals(regs[0]!.name, "parse_100",);
    assertEquals(regs[0]!.pct, 50,);

    // Exatamente +20% NÃO é regressão (limiar estrito).
    const edge: BenchMeasurement[] = [
      { name: "parse_100", avg: 120, },
      { name: "schedule_1000", avg: 200, },
    ];
    assertEquals(detectRegressions(baseline, edge, 20,), [],);

    // Melhoria (avg menor) nunca é regressão.
    const fast: BenchMeasurement[] = [
      { name: "parse_100", avg: 50, },
      { name: "schedule_1000", avg: 100, },
    ];
    assertEquals(detectRegressions(baseline, fast, 20,), [],);
  });
});
