/**
 * Conformance report generator (26.7, F21 wave 1).
 *
 * Thin I/O entry around the pure `conformance-report.ts` module: reads the
 * corpus manifest, the e2e golden cases and the triage registry, stamps the
 * oracle/port versions and writes `docs/syntaxmesh/conformance-report.md`.
 *
 * Run `deno task conformance:report` to regenerate. The rendering is
 * deterministic (no timestamps) — the file only changes when the data does.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.7)
 * @see docs/syntaxmesh/decisoes/042-estrategia-validacao.md
 */
import {
  buildReport,
  renderMarkdown,
  type ReportCase,
  type ReportManifest,
} from "../../packages/cli/tests/golden/conformance-report.ts";
import { parseRegistry, } from "../../packages/cli/tests/golden/divergences.ts";

const ROOT = new URL("../../", import.meta.url,).pathname;

async function readJson(path: string,): Promise<unknown> {
  return JSON.parse(await Deno.readTextFile(ROOT + path,),);
}

/** Oracle version — same probe as `cli-tj3.rb` (`tj3 --version`, last token). */
function tj3Version(): string {
  const { stdout, success, } = new Deno.Command("tj3", {
    args: ["--version",],
  },).outputSync();
  if (!success) throw new Error("tj3 --version failed — oracle not installed",);
  const version = new TextDecoder().decode(stdout,).trim().split(/\s+/,).pop();
  if (version === undefined || version === "") {
    throw new Error("tj3 --version returned no version",);
  }
  return version;
}

/** Port version from the CLI package config (jsonc — comments are skipped). */
async function portVersion(): Promise<string> {
  const config = await Deno.readTextFile(ROOT + "packages/cli/deno.jsonc",);
  const match = config.match(/^\s*"version":\s*"([^"]+)"/m,);
  if (match === null) throw new Error("packages/cli/deno.jsonc: no version",);
  return match[1]!;
}

const manifest = await readJson(
  "tests/fixtures/corpus.json",
) as ReportManifest;
const golden = await readJson(
  "packages/cli/tests/golden/cli-tj3.golden.json",
) as { cases: ReportCase[] };
const fixtureIds = new Set(
  manifest.groups.flatMap((g,) => g.fixtures.map((f,) => f.id)),
);
const registry = parseRegistry(
  await Deno.readTextFile(
    ROOT + "packages/cli/tests/golden/known-divergences.json",
  ),
  fixtureIds,
);

const report = buildReport({
  manifest,
  cases: golden.cases,
  registry,
  versions: { tj3: tj3Version(), port: await portVersion(), },
},);

const out = "docs/syntaxmesh/conformance-report.md";
await Deno.writeTextFile(ROOT + out, renderMarkdown(report,),);
const { total, included, excluded, conformancePct, } = report.summary;
console.log(
  `${out} — ${included}/${total} incluídos (${conformancePct}%), ${excluded} excluídos`,
);
