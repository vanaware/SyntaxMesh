/**
 * Runner do gate de regressão de benchmarks (F21¹, 26.11.8).
 *
 * Roda `deno bench --json`, compara com `bench/baseline.json` e sai com código
 * 1 se algum bench regredir mais que o limiar (default 20%, configurável via
 * `BENCH_THRESHOLD_PCT`). Uso: `deno task bench:compare`.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.11)
 */
import { dirname, fromFileUrl, } from "@std/path";
import {
  type DenoBenchJson,
  detectRegressions,
  extractMeasurements,
} from "./compare.ts";

const BENCH_DIR = dirname(fromFileUrl(import.meta.url,),);
const ROOT = dirname(BENCH_DIR,);

/** Formata ns/iter de forma legível (ms/s). */
function fmtNs(ns: number,): string {
  if (ns >= 1e9) return `${(ns / 1e9).toFixed(2,)}s`;
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(1,)}ms`;
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(1,)}µs`;
  return `${ns.toFixed(0,)}ns`;
}

async function main(): Promise<number> {
  const baselineUrl = new URL("./baseline.json", import.meta.url,);
  let baselineJson: DenoBenchJson;
  try {
    baselineJson = JSON.parse(await Deno.readTextFile(baselineUrl,),);
  } catch (err) {
    console.error(`baseline.json ausente ou inválido: ${err}`,);
    return 1;
  }
  const baseline = extractMeasurements(baselineJson,);
  if (baseline.length === 0) {
    console.error("baseline.json não contém medições válidas",);
    return 1;
  }

  const command = new Deno.Command(Deno.execPath(), {
    args: ["bench", "--no-check", "-A", "--json",],
    cwd: ROOT,
    stdout: "piped",
    stderr: "inherit",
  },);
  const { code, stdout, } = await command.output();
  if (code !== 0) {
    console.error("`deno bench` falhou — não é possível comparar",);
    return 1;
  }
  const currentJson: DenoBenchJson = JSON.parse(
    new TextDecoder().decode(stdout,),
  );
  const current = extractMeasurements(currentJson,);

  const threshold = Number(Deno.env.get("BENCH_THRESHOLD_PCT",) ?? "20",);
  const regressions = detectRegressions(baseline, current, threshold,);

  const baseMap = new Map(baseline.map((b,) => [b.name, b.avg,]),);
  console.log(`\nbench:compare (limiar ${threshold}%)`,);
  console.log("bench                       baseline      atual       delta",);
  for (const cur of current) {
    const base = baseMap.get(cur.name,);
    if (base === undefined) {
      console.log(`${cur.name.padEnd(26,)} —             ${fmtNs(cur.avg,)}`,);
      continue;
    }
    const pct = ((cur.avg - base) / base) * 100;
    const sign = pct >= 0 ? "+" : "";
    console.log(
      `${cur.name.padEnd(26,)} ${fmtNs(base,).padEnd(13,)} ${
        fmtNs(cur.avg,).padEnd(11,)
      } ${sign}${pct.toFixed(1,)}%`,
    );
  }

  if (regressions.length > 0) {
    console.error(
      `\nFAIL: ${regressions.length} regressão(ões) > ${threshold}%:`,
    );
    for (const reg of regressions) {
      const sign = reg.pct >= 0 ? "+" : "";
      console.error(
        `  - ${reg.name}: ${fmtNs(reg.baselineAvg,)} → ${
          fmtNs(reg.currentAvg,)
        } (${sign}${reg.pct.toFixed(1,)}%)`,
      );
    }
    return 1;
  }
  console.log(
    `\nOK: sem regressões > ${threshold}% (${current.length} benches)`,
  );
  return 0;
}

if (import.meta.main) {
  Deno.exit(await main(),);
}
