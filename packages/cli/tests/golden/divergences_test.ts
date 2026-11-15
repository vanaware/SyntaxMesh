/**
 * Divergence registry contract (26.4/26.6, F21 wave 1).
 *
 * `known-divergences.json` is the machine-readable triage registry consumed
 * by the Ruby oracle (exclusions) and the CLI runner test (compare
 * downgrades). These tests pin the schema validation and the effect
 * precedence, plus the real-registry regression against the corpus.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.6)
 * @see docs/syntaxmesh/decisoes/042-estrategia-validacao.md
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import {
  type Divergence,
  effectFor,
  matchesFixture,
  parseRegistry,
} from "./divergences.ts";

const FIXTURES = new Set(["mwe/mwe004", "syntax-correct/Account",],);

function entry(overrides: Partial<Divergence> = {},): Divergence {
  return {
    id: "D1",
    fixture: "mwe/mwe004",
    kind: "scheduler",
    description: "desc",
    justification: "just",
    mitigation: "mit",
    priority: "high",
    effect: "exclude",
    anchor: "known_divergences.md#D1",
    ...overrides,
  };
}

function registryJson(entries: Divergence[],): string {
  return JSON.stringify({ divergences: entries, },);
}

describe("parseRegistry (26.6.4)", () => {
  it("accepts a valid registry", () => {
    const registry = parseRegistry(registryJson([entry(),],), FIXTURES,);
    assertEquals(registry.divergences.length, 1,);
    assertEquals(registry.divergences[0]!.id, "D1",);
  });

  it("accepts the global fixture wildcard", () => {
    const registry = parseRegistry(
      registryJson([entry({ fixture: "*", effect: "none", },),],),
      FIXTURES,
    );
    assertEquals(registry.divergences[0]!.fixture, "*",);
  });

  it("rejects a missing required field", () => {
    const bad = entry() as Partial<Divergence>;
    delete bad.justification;
    assertThrows(
      () => parseRegistry(registryJson([bad as Divergence,],), FIXTURES,),
      Error,
      "justification",
    );
  });

  it("rejects an empty required field", () => {
    assertThrows(
      () =>
        parseRegistry(registryJson([entry({ anchor: " ", },),],), FIXTURES,),
      Error,
      "anchor",
    );
  });

  it("rejects duplicate divergence ids", () => {
    assertThrows(
      () =>
        parseRegistry(
          registryJson([
            entry(),
            entry({ fixture: "syntax-correct/Account", },),
          ],),
          FIXTURES,
        ),
      Error,
      "duplicate",
    );
  });

  it("rejects malformed divergence ids", () => {
    assertThrows(
      () => parseRegistry(registryJson([entry({ id: "X7", },),],), FIXTURES,),
      Error,
      "id",
    );
  });

  it("rejects unknown fixture ids", () => {
    assertThrows(
      () =>
        parseRegistry(
          registryJson([entry({ fixture: "mwe/mwe999", },),],),
          FIXTURES,
        ),
      Error,
      "fixture",
    );
  });

  it("rejects unknown effects and priorities", () => {
    assertThrows(
      () =>
        parseRegistry(
          registryJson([entry({ effect: "skip" as Divergence["effect"], },),],),
          FIXTURES,
        ),
      Error,
      "effect",
    );
    assertThrows(
      () =>
        parseRegistry(
          registryJson([
            entry({ priority: "urgent" as Divergence["priority"], },),
          ],),
          FIXTURES,
        ),
      Error,
      "priority",
    );
  });

  it("rejects a non-array divergences field", () => {
    assertThrows(
      () => parseRegistry('{"divergences":{}}', FIXTURES,),
      Error,
      "divergences",
    );
  });

  it("accepts a group glob of a known group (26.5)", () => {
    const registry = parseRegistry(
      registryJson([entry({ fixture: "mwe/*", },),],),
      FIXTURES,
    );
    assertEquals(registry.divergences[0]!.fixture, "mwe/*",);
  });

  it("rejects a group glob of an unknown group (26.5)", () => {
    assertThrows(
      () =>
        parseRegistry(
          registryJson([entry({ fixture: "nope/*", },),],),
          FIXTURES,
        ),
      Error,
      "fixture",
    );
  });
});

describe("effectFor (26.4)", () => {
  it("defaults to none without entries", () => {
    const registry = parseRegistry(registryJson([],), FIXTURES,);
    assertEquals(effectFor(registry, "mwe/mwe004",), "none",);
  });

  it("exclude beats compare-artifacts beats none", () => {
    const registry = parseRegistry(
      registryJson([
        entry({ id: "D1", effect: "none", },),
        entry({ id: "D2", effect: "compare-artifacts", },),
        entry({ id: "D3", effect: "exclude", },),
      ],),
      FIXTURES,
    );
    assertEquals(effectFor(registry, "mwe/mwe004",), "exclude",);
  });

  it("global wildcard applies to every fixture", () => {
    const registry = parseRegistry(
      registryJson([entry({ fixture: "*", effect: "compare-artifacts", },),],),
      FIXTURES,
    );
    assertEquals(
      effectFor(registry, "syntax-correct/Account",),
      "compare-artifacts",
    );
  });

  it("fixture-specific exclude beats global downgrade", () => {
    const registry = parseRegistry(
      registryJson([
        entry({ id: "D1", fixture: "*", effect: "compare-artifacts", },),
        entry({ id: "D2", effect: "exclude", },),
      ],),
      FIXTURES,
    );
    assertEquals(effectFor(registry, "mwe/mwe004",), "exclude",);
    assertEquals(
      effectFor(registry, "syntax-correct/Account",),
      "compare-artifacts",
    );
  });

  it("group glob applies only to its group (26.5)", () => {
    const registry = parseRegistry(
      registryJson([entry({ fixture: "mwe/*", effect: "exclude", },),],),
      FIXTURES,
    );
    assertEquals(effectFor(registry, "mwe/mwe004",), "exclude",);
    assertEquals(effectFor(registry, "syntax-correct/Account",), "none",);
  });
});

describe("matchesFixture (26.5)", () => {
  it("exact id, global wildcard and group glob", () => {
    assertEquals(matchesFixture("mwe/mwe004", "mwe/mwe004",), true,);
    assertEquals(matchesFixture("*", "any/thing",), true,);
    assertEquals(matchesFixture("mwe/*", "mwe/mwe004",), true,);
  });

  it("group glob does not leak to other groups or prefix lookalikes", () => {
    assertEquals(matchesFixture("mwe/*", "syntax-correct/Account",), false,);
    assertEquals(matchesFixture("mwe/*", "mwextra/x",), false,);
    assertEquals(matchesFixture("mwe/mwe004", "mwe/mwe005",), false,);
  });
});

describe("real registry (26.6 regression)", () => {
  it("known-divergences.json validates against the real corpus", async () => {
    const root = new URL("../../../../", import.meta.url,).pathname;
    const corpus = JSON.parse(
      await Deno.readTextFile(root + "tests/fixtures/corpus.json",),
    ) as { groups: { fixtures: { id: string }[] }[] };
    const ids = new Set(
      corpus.groups.flatMap((g,) => g.fixtures.map((f,) => f.id)),
    );
    const json = await Deno.readTextFile(
      new URL("./known-divergences.json", import.meta.url,),
    );
    const registry = parseRegistry(json, ids,);
    // The F24.7 exclusions must survive the migration (D7/D8/D9).
    assertEquals(effectFor(registry, "mwe/mwe004",), "exclude",);
    assertEquals(
      effectFor(registry, "syntax-correct/AccountReport",),
      "exclude",
    );
    assertEquals(effectFor(registry, "syntax-correct/Leave",), "exclude",);
    assertEquals(
      effectFor(registry, "parity/parity-csv-balance",),
      "compare-artifacts",
    );
  });
});
