/**
 * Divergence registry loader (26.4/26.6, F21 wave 1).
 *
 * `known-divergences.json` is the machine-readable triage registry of the
 * e2e golden suite (ADR 042): the Ruby oracle skips `exclude`d fixtures,
 * the runner test downgrades `compare-artifacts` cases, and the conformance
 * report lists every entry. Validation is strict — a malformed registry
 * must fail loudly, never silently weaken the comparison.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.6)
 * @see docs/syntaxmesh/decisoes/042-estrategia-validacao.md
 */

/** What the registry does to a fixture's comparison. */
export type DivergenceEffect = "none" | "exclude" | "compare-artifacts";

/** One registered divergence (policy: default is a port bug, ADR 042). */
export interface Divergence {
  /** Registry id, `D<number>` (continues the F24.7 series). */
  id: string;
  /** Corpus fixture id, `<group>/*` group glob, or `*` for a global observation. */
  fixture: string;
  /** Category: scheduler, serialization, ui, architecture, … */
  kind: string;
  description: string;
  justification: string;
  mitigation: string;
  priority: "high" | "medium" | "low";
  effect: DivergenceEffect;
  /** File/section anchor proving the triage (never silent). */
  anchor: string;
}

/** The parsed registry. */
export interface DivergenceRegistry {
  divergences: Divergence[];
}

const EFFECTS: readonly DivergenceEffect[] = [
  "none",
  "exclude",
  "compare-artifacts",
];
const PRIORITIES = ["high", "medium", "low",] as const;
const REQUIRED = [
  "id",
  "fixture",
  "kind",
  "description",
  "justification",
  "mitigation",
  "priority",
  "effect",
  "anchor",
] as const;

/**
 * Parses and validates the registry JSON against the known corpus ids.
 * Throws on any schema violation — the registry is a contract.
 */
export function parseRegistry(
  json: string,
  knownFixtureIds: ReadonlySet<string>,
): DivergenceRegistry {
  const data = JSON.parse(json,) as { divergences?: unknown };
  if (!Array.isArray(data.divergences,)) {
    throw new Error("registry: divergences must be an array",);
  }
  const seen = new Set<string>();
  const divergences: Divergence[] = [];
  for (const raw of data.divergences) {
    const entry = raw as Record<string, unknown>;
    for (const field of REQUIRED) {
      const value = entry[field];
      if (typeof value !== "string" || value.trim() === "") {
        throw new Error(`registry: missing or empty field ${field}`,);
      }
    }
    const id = entry.id as string;
    if (!/^D\d+$/.test(id,)) {
      throw new Error(`registry: malformed id ${id} (expected D<number>)`,);
    }
    if (seen.has(id,)) {
      throw new Error(`registry: duplicate id ${id}`,);
    }
    seen.add(id,);
    const fixture = entry.fixture as string;
    if (!isKnownFixture(fixture, knownFixtureIds,)) {
      throw new Error(`registry: unknown fixture ${fixture}`,);
    }
    const effect = entry.effect as DivergenceEffect;
    if (!EFFECTS.includes(effect,)) {
      throw new Error(`registry: unknown effect ${effect}`,);
    }
    const priority = entry.priority as Divergence["priority"];
    if (!(PRIORITIES as readonly string[]).includes(priority,)) {
      throw new Error(`registry: unknown priority ${priority}`,);
    }
    divergences.push({
      id,
      fixture,
      kind: entry.kind as string,
      description: entry.description as string,
      justification: entry.justification as string,
      mitigation: entry.mitigation as string,
      priority,
      effect,
      anchor: entry.anchor as string,
    },);
  }
  return { divergences, };
}

/**
 * Matches a fixture pattern: exact id, the global `*`, or a group glob
 * `<group>/*` (26.5 — whole-group triage, e.g. `csv-reports/*`).
 */
export function matchesFixture(pattern: string, fixtureId: string,): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith("/*",)) {
    return fixtureId.startsWith(pattern.slice(0, -1,),);
  }
  return pattern === fixtureId;
}

/** A glob is only valid when at least one known fixture lives in the group. */
function isKnownFixture(
  fixture: string,
  knownFixtureIds: ReadonlySet<string>,
): boolean {
  if (fixture === "*" || knownFixtureIds.has(fixture,)) return true;
  if (fixture.endsWith("/*",)) {
    const prefix = fixture.slice(0, -1,);
    for (const id of knownFixtureIds) {
      if (id.startsWith(prefix,)) return true;
    }
  }
  return false;
}

/** Effect precedence: exclude > compare-artifacts > none. */
const RANK: Record<DivergenceEffect, number> = {
  "none": 0,
  "compare-artifacts": 1,
  "exclude": 2,
};

/**
 * The effective comparison level for a fixture: the strongest effect among
 * its own entries, its group globs (`<group>/*`) and the global (`*`) ones.
 */
export function effectFor(
  registry: DivergenceRegistry,
  fixtureId: string,
): DivergenceEffect {
  let effect: DivergenceEffect = "none";
  for (const entry of registry.divergences) {
    if (!matchesFixture(entry.fixture, fixtureId,)) continue;
    if (RANK[entry.effect] > RANK[effect]) effect = entry.effect;
  }
  return effect;
}
