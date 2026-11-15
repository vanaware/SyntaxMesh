/**
 * Conformance report contract (26.7, F21 wave 1).
 *
 * Pins the aggregation (summary, per-group, divergence listing, missing
 * features by kind) and the deterministic Markdown rendering consumed by
 * `scripts/golden/generate-report.ts`. Synthetic corpus/cases/registry
 * fixtures keep the tests independent of the real golden state.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.7)
 * @see docs/syntaxmesh/decisoes/042-estrategia-validacao.md
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  buildReport,
  type ConformanceInput,
  renderMarkdown,
  type ReportCase,
  type ReportManifest,
} from "./conformance-report.ts";
import { type Divergence, parseRegistry, } from "./divergences.ts";

const MANIFEST: ReportManifest = {
  groups: [
    {
      id: "g1",
      fixtures: [{ id: "g1/a", }, { id: "g1/b", }, { id: "g1/c", },],
    },
    { id: "g2", fixtures: [{ id: "g2/x", }, { id: "g2/y", },], },
  ],
  total: 5,
};

const FIXTURE_IDS = new Set(
  MANIFEST.groups.flatMap((g,) => g.fixtures.map((f,) => f.id)),
);

const CASES: ReportCase[] = [
  { id: "g1/a", group: "g1", },
  { id: "g1/b", group: "g1", excluded: "D2", },
  { id: "g1/c", group: "g1", },
  { id: "g2/x", group: "g2", },
  { id: "g2/y", group: "g2", },
];

function entry(overrides: Partial<Divergence> = {},): Divergence {
  return {
    id: "D1",
    fixture: "g2/x",
    kind: "serialization",
    description: "desc",
    justification: "just",
    mitigation: "mit",
    priority: "medium",
    effect: "compare-artifacts",
    anchor: "known_divergences.md#D1",
    ...overrides,
  };
}

/** D2 excludes g1/b, D1 downgrades g2/x, D3 is a global observation. */
const REGISTRY = parseRegistry(
  JSON.stringify({
    divergences: [
      entry({
        id: "D2",
        fixture: "g1/b",
        kind: "scheduler",
        effect: "exclude",
      },),
      entry(),
      entry({ id: "D3", fixture: "*", kind: "diagnostics", effect: "none", },),
    ],
  },),
  FIXTURE_IDS,
);

const INPUT: ConformanceInput = {
  manifest: MANIFEST,
  cases: CASES,
  registry: REGISTRY,
  versions: { tj3: "3.8.4", port: "0.0.2", },
};

describe("buildReport (26.7.2)", () => {
  it("aggregates the summary from the golden cases", () => {
    const report = buildReport(INPUT,);
    assertEquals(report.summary, {
      total: 5,
      included: 4,
      excluded: 1,
      conformancePct: 80,
    },);
  });

  it("counts per group, glob exclusions included", () => {
    const report = buildReport(INPUT,);
    assertEquals(report.groups, [
      { id: "g1", total: 3, included: 2, excluded: 1, },
      { id: "g2", total: 2, included: 2, excluded: 0, },
    ],);
  });

  it("lists operational divergences in D-order, never `none`", () => {
    const report = buildReport(INPUT,);
    assertEquals(report.divergences.map((d,) => d.id), ["D1", "D2",],);
  });

  it("groups the missing features by kind, count desc then name", () => {
    const report = buildReport(INPUT,);
    assertEquals(report.byKind, [
      { kind: "scheduler", count: 1, ids: ["D2",], },
      { kind: "serialization", count: 1, ids: ["D1",], },
    ],);
  });

  it("handles an empty corpus without dividing by zero", () => {
    const report = buildReport({
      ...INPUT,
      manifest: { groups: [], total: 0, },
      cases: [],
    },);
    assertEquals(report.summary, {
      total: 0,
      included: 0,
      excluded: 0,
      conformancePct: 0,
    },);
  });
});

describe("renderMarkdown (26.7.2/26.7.3)", () => {
  it("renders the four sections and both versions", () => {
    const md = renderMarkdown(buildReport(INPUT,),);
    for (
      const header of [
        "## Resumo",
        "## Por categoria (grupo do corpus)",
        "## Features ausentes (por tipo de divergência)",
        "## Divergências registradas",
      ]
    ) {
      assertEquals(md.includes(header,), true, `missing section ${header}`,);
    }
    assertEquals(md.includes("- **tj3 (oráculo):** 3.8.4",), true,);
    assertEquals(md.includes("- **SyntaxMesh (port):** 0.0.2",), true,);
    assertEquals(md.includes("| Conformidade | 80% |",), true,);
  });

  it("lists every operational divergence row with its anchorable id", () => {
    const md = renderMarkdown(buildReport(INPUT,),);
    assertEquals(md.includes("| D1 | `g2/x` | serialization |",), true,);
    assertEquals(md.includes("| D2 | `g1/b` | scheduler |",), true,);
    // `none` observations never reach the divergence table.
    assertEquals(md.includes("| D3 |",), false,);
  });

  it("is deterministic — same input, byte-identical output", () => {
    const report = buildReport(INPUT,);
    assertEquals(renderMarkdown(report,), renderMarkdown(report,),);
  });
});
