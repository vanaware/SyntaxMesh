/**
 * Conformance report builder (26.7, F21 wave 1).
 *
 * Pure aggregation of the e2e golden conformance state: the corpus manifest
 * (26.1), the golden cases (26.2) and the triage registry (26.6). Produces a
 * structured report and a deterministic Markdown rendering consumed by
 * `scripts/golden/generate-report.ts`, which writes
 * `docs/syntaxmesh/conformance-report.md`.
 *
 * No I/O here — the module is unit-testable and the rendering is stable
 * (no timestamps), so the generated file only changes when the data does.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.7)
 * @see docs/syntaxmesh/decisoes/042-estrategia-validacao.md
 */
import type { Divergence, DivergenceRegistry, } from "./divergences.ts";

/** The observable fields of a golden case the report needs. */
export interface ReportCase {
  id: string;
  group: string;
  /** Registry id that excludes the case (absent when compared). */
  excluded?: string;
}

/** The corpus manifest shape the report needs (26.1). */
export interface ReportManifest {
  groups: { id: string; fixtures: { id: string }[] }[];
  total: number;
}

/** Input of the report builder. */
export interface ConformanceInput {
  manifest: ReportManifest;
  cases: ReportCase[];
  registry: DivergenceRegistry;
  versions: { tj3: string; port: string };
}

/** Per-group conformance counts. */
export interface GroupStat {
  id: string;
  total: number;
  included: number;
  excluded: number;
}

/** Operational divergences grouped by kind (the missing-feature families). */
export interface KindStat {
  kind: string;
  count: number;
  ids: string[];
}

/** The structured conformance report. */
export interface ConformanceReport {
  versions: { tj3: string; port: string };
  summary: {
    total: number;
    included: number;
    excluded: number;
    /** included / total, percent with one decimal. */
    conformancePct: number;
  };
  groups: GroupStat[];
  /** Registry entries with an operational effect (exclude/compare-artifacts). */
  divergences: Divergence[];
  byKind: KindStat[];
}

/** Numeric order of a `D<n>` id. */
function idOrder(id: string,): number {
  return Number.parseInt(id.slice(1,), 10,);
}

/**
 * Aggregates the conformance state. `included`/`excluded` come from the
 * golden cases (what the e2e actually runs); the divergence listing comes
 * from the registry. A single group-glob entry may exclude many fixtures.
 */
export function buildReport(input: ConformanceInput,): ConformanceReport {
  const { manifest, cases, registry, versions, } = input;
  const excludedIds = new Set(
    cases.filter((c,) => c.excluded !== undefined).map((c,) => c.id),
  );
  const total = manifest.total;
  const excluded = excludedIds.size;
  const included = total - excluded;
  const conformancePct = total === 0
    ? 0
    : Math.round((included / total) * 1000,) / 10;

  const groups: GroupStat[] = manifest.groups.map((g,) => {
    const ex = g.fixtures.filter((f,) => excludedIds.has(f.id,)).length;
    return {
      id: g.id,
      total: g.fixtures.length,
      included: g.fixtures.length - ex,
      excluded: ex,
    };
  },);

  const divergences = registry.divergences
    .filter((d,) => d.effect !== "none")
    .sort((a, b,) => idOrder(a.id,) - idOrder(b.id,));

  const kindMap = new Map<string, string[]>();
  for (const d of divergences) {
    const list = kindMap.get(d.kind,) ?? [];
    list.push(d.id,);
    kindMap.set(d.kind, list,);
  }
  const byKind: KindStat[] = [...kindMap.entries(),]
    .map(([kind, ids,],) => ({ kind, count: ids.length, ids, }))
    .sort((a, b,) => b.count - a.count || (a.kind < b.kind ? -1 : 1));

  return {
    versions,
    summary: { total, included, excluded, conformancePct, },
    groups,
    divergences,
    byKind,
  };
}

/** Renders the report as deterministic Markdown (no timestamps). */
export function renderMarkdown(report: ConformanceReport,): string {
  const { versions, summary, groups, divergences, byKind, } = report;
  const lines: string[] = [];
  lines.push("# Relatório de conformidade — SyntaxMesh × TaskJuggler",);
  lines.push("",);
  lines.push(
    "> Gerado por `scripts/golden/generate-report.ts` (F21¹, 26.7) a partir do",
  );
  lines.push(
    "> golden e2e (`cli-tj3.golden.json`), do corpus (`tests/fixtures/corpus.json`)",
  );
  lines.push("> e do registro de divergências (`known-divergences.json`).",);
  lines.push("",);
  lines.push(`- **tj3 (oráculo):** ${versions.tj3}`,);
  lines.push(`- **SyntaxMesh (port):** ${versions.port}`,);
  lines.push("",);
  lines.push("## Resumo",);
  lines.push("",);
  lines.push("| Métrica | Valor |",);
  lines.push("| --- | --- |",);
  lines.push(`| Fixtures no corpus | ${summary.total} |`,);
  lines.push(`| Incluídos (comparados) | ${summary.included} |`,);
  lines.push(`| Excluídos (divergência registrada) | ${summary.excluded} |`,);
  lines.push(`| Conformidade | ${summary.conformancePct}% |`,);
  lines.push("",);
  lines.push(
    "Conformidade = incluídos / total. Todo caso excluído tem verbete e âncora",
  );
  lines.push(
    "no registro — nada é ignorado em silêncio (ADR 042). Um único verbete de",
  );
  lines.push("grupo (`<group>/*`) pode excluir vários fixtures.",);
  lines.push("",);
  lines.push("## Por categoria (grupo do corpus)",);
  lines.push("",);
  lines.push("| Grupo | Total | Incluídos | Excluídos |",);
  lines.push("| --- | --- | --- | --- |",);
  for (const g of groups) {
    lines.push(`| ${g.id} | ${g.total} | ${g.included} | ${g.excluded} |`,);
  }
  lines.push("",);
  lines.push("## Features ausentes (por tipo de divergência)",);
  lines.push("",);
  lines.push("| Tipo | Entradas | Ids |",);
  lines.push("| --- | --- | --- |",);
  for (const k of byKind) {
    lines.push(`| ${k.kind} | ${k.count} | ${k.ids.join(", ",)} |`,);
  }
  lines.push("",);
  lines.push("## Divergências registradas",);
  lines.push("",);
  lines.push("| Id | Fixture | Tipo | Prioridade | Efeito | Descrição |",);
  lines.push("| --- | --- | --- | --- | --- | --- |",);
  for (const d of divergences) {
    lines.push(
      `| ${d.id} | \`${d.fixture}\` | ${d.kind} | ${d.priority} | ${d.effect} | ${d.description} |`,
    );
  }
  lines.push("",);
  return lines.join("\n",);
}
