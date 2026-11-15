/**
 * Lógica pura de comparação de benchmarks (F21¹, 26.11.8/26.11.9).
 *
 * Sem I/O: extrai medições do JSON do `deno bench --json` e detecta
 * regressões relative ao baseline. Mantida pura para ser testável com dados
 * sintéticos (bench_test.ts) e reutilizada pelo runner (compare-run.ts).
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.11)
 */

/** Medição de um bench: nome + tempo médio em ns/iter (menor = mais rápido). */
export interface BenchMeasurement {
  name: string;
  group?: string;
  avg: number;
}

/** Regressão: bench atual mais lento que o baseline além do limiar. */
export interface Regression {
  name: string;
  baselineAvg: number;
  currentAvg: number;
  /** Aumento percentual relativo ao baseline (ex.: 50 = +50%). */
  pct: number;
}

/** Subconjunto do formato `deno bench --json` (version 1) que consumimos. */
export interface DenoBenchJson {
  version: number;
  runtime?: string;
  cpu?: string;
  benches: Array<{
    origin?: string;
    group?: string;
    name: string;
    baseline?: boolean;
    results: Array<{ ok?: { avg: number; n?: number } }>;
  }>;
}

/**
 * Extrai medições (nome + avg ns/iter) do JSON do `deno bench`. Ignora benches
 * sem resultado `ok` (falha/erro) ou sem `avg` numérico.
 */
export function extractMeasurements(json: DenoBenchJson,): BenchMeasurement[] {
  const out: BenchMeasurement[] = [];
  for (const bench of json.benches) {
    const ok = bench.results[0]?.ok;
    if (!ok || typeof ok.avg !== "number") continue;
    out.push({ name: bench.name, group: bench.group, avg: ok.avg, },);
  }
  return out;
}

/**
 * Detecta regressões: benches cujo `avg` atual excede o baseline em mais que
 * `thresholdPct`% (default 20). Benches sem baseline correspondente ou com
 * baseline <= 0 são ignorados (não há referência válida para comparar).
 */
export function detectRegressions(
  baseline: BenchMeasurement[],
  current: BenchMeasurement[],
  thresholdPct = 20,
): Regression[] {
  const baseMap = new Map(baseline.map((b,) => [b.name, b.avg,]),);
  const regressions: Regression[] = [];
  for (const cur of current) {
    const base = baseMap.get(cur.name,);
    if (base === undefined || base <= 0) continue;
    const pct = ((cur.avg - base) / base) * 100;
    if (pct > thresholdPct) {
      regressions.push({
        name: cur.name,
        baselineAvg: base,
        currentAvg: cur.avg,
        pct,
      },);
    }
  }
  return regressions;
}
