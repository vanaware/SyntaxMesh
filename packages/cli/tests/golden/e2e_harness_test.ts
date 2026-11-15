/**
 * E2E harness contract (26.3, F21 wave 1).
 *
 * The per-group e2e suites (`e2e_<group>_test.ts`) share one harness: the
 * golden loaded from `cli-tj3.golden.json`, the divergence registry and
 * the real CLI spawn. These tests pin the pure selection logic — group
 * filtering and the registry compare downgrade — with synthetic cases.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.3)
 * @see docs/syntaxmesh/decisoes/042-estrategia-validacao.md
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  canonicalizeDates,
  casesForGroup,
  effectiveCompare,
  type GoldenCase,
  normalizeMessage,
} from "./e2e-harness.ts";
import { parseRegistry, } from "./divergences.ts";

function kase(overrides: Partial<GoldenCase> = {},): GoldenCase {
  return {
    id: "mwe/mwe001",
    path: "docs/Learning/mwe001/tutorial.tjp",
    group: "mwe",
    kind: "project",
    compare: "artifacts",
    exit: 0,
    artifacts: [],
    messages: [],
    firstMessage: null,
    stdout: [],
    stderr: [],
    ...overrides,
  };
}

const CASES: GoldenCase[] = [
  kase(),
  kase({ id: "mwe/mwe002", group: "mwe", },),
  kase({
    id: "parity/parity-csv-tasks",
    group: "parity",
    kind: "parity",
    compare: "exact",
  },),
];

describe("casesForGroup (26.3)", () => {
  it("selects only the cases of the group, in golden order", () => {
    const selected = casesForGroup(CASES, "mwe",);
    assertEquals(selected.map((c,) => c.id), ["mwe/mwe001", "mwe/mwe002",],);
  });

  it("returns an empty list for an unknown group", () => {
    assertEquals(casesForGroup(CASES, "nope",), [],);
  });

  it("keeps excluded cases in the selection (the suite asserts them)", () => {
    const excluded = kase({ id: "mwe/mwe004", excluded: "D7", },);
    const selected = casesForGroup([...CASES, excluded,], "mwe",);
    assertEquals(selected.length, 3,);
    assertEquals(selected[2]!.excluded, "D7",);
  });
});

describe("effectiveCompare (26.4)", () => {
  const ids = new Set(CASES.map((c,) => c.id),);

  it("keeps the golden compare level without registry entries", () => {
    const registry = parseRegistry('{"divergences":[]}', ids,);
    assertEquals(effectiveCompare(CASES[2]!, registry,), "exact",);
  });

  it("downgrades to artifacts on a compare-artifacts entry", () => {
    const registry = parseRegistry(
      JSON.stringify({
        divergences: [{
          id: "D2",
          fixture: "parity/parity-csv-tasks",
          kind: "serialization",
          description: "d",
          justification: "j",
          mitigation: "m",
          priority: "medium",
          effect: "compare-artifacts",
          anchor: "known_divergences.md#D2",
        },],
      },),
      ids,
    );
    assertEquals(effectiveCompare(CASES[2]!, registry,), "artifacts",);
  });

  it("never upgrades an artifacts case", () => {
    const registry = parseRegistry('{"divergences":[]}', ids,);
    assertEquals(effectiveCompare(CASES[0]!, registry,), "artifacts",);
  });

  it("applies the global wildcard downgrade", () => {
    const registry = parseRegistry(
      JSON.stringify({
        divergences: [{
          id: "D1",
          fixture: "*",
          kind: "serialization",
          description: "d",
          justification: "j",
          mitigation: "m",
          priority: "low",
          effect: "compare-artifacts",
          anchor: "known_divergences.md#D1",
        },],
      },),
      ids,
    );
    assertEquals(effectiveCompare(CASES[2]!, registry,), "artifacts",);
  });
});

describe("canonicalizeDates (26.5)", () => {
  it("canonicaliza o long form do TjTime para UTC", () => {
    assertEquals(
      canonicalizeDates("before 2007-03-28-00:00-+0000.",),
      "before 2007-03-28T00:00Z.",
    );
  });

  it("converte o offset do long form para UTC", () => {
    assertEquals(
      canonicalizeDates("at 2007-04-25-11:00-+0000",),
      "at 2007-04-25T11:00Z",
    );
  });

  it("canonicaliza o ctime do JS Date para o mesmo instante", () => {
    assertEquals(
      canonicalizeDates(
        "Wed Apr 25 2007 08:00:00 GMT-0300 (Brasilia Standard Time)",
      ),
      "2007-04-25T11:00Z",
    );
  });

  it("canonicaliza data ISO simples como meia-noite UTC", () => {
    assertEquals(
      canonicalizeDates("start (2007-03-29) late",),
      "start (2007-03-29T00:00Z) late",
    );
  });

  it("long form e ctime do mesmo instante convergem", () => {
    assertEquals(
      canonicalizeDates("2007-04-25-11:00-+0000",),
      canonicalizeDates("Wed Apr 25 2007 08:00:00 GMT-0300",),
    );
  });

  it("não corrompe o carimbo canônico já gerado", () => {
    assertEquals(
      canonicalizeDates("2007-04-25T11:00Z",),
      "2007-04-25T11:00Z",
    );
  });
});

describe("normalizeMessage (26.5)", () => {
  it("colapsa floats integrais mas preserva fracionários", () => {
    assertEquals(
      normalizeMessage("1.0d and 9.00h and 1.5d and 2.05",),
      "1d and 9h and 1.5d and 2.05",
    );
  });

  it("normaliza caminho, data e float juntos", () => {
    assertEquals(
      normalizeMessage(
        "docs/x/y.tjp:3: Warning: 1.0d of effort until 2007-03-29",
      ),
      "Warning: 1d of effort until 2007-03-29T00:00Z",
    );
  });

  it("remove a localização de fonte de erro de runtime (26.5)", () => {
    assertEquals(
      normalizeMessage(
        "docs/x/y.tjp:14: Error: must have a 'work' attribute",
      ),
      "Error: must have a 'work' attribute",
    );
  });

  it("preserva mensagem sem localização (26.5)", () => {
    assertEquals(
      normalizeMessage("Warning: This project has no reports defined.",),
      "Warning: This project has no reports defined.",
    );
  });

  it("remove localização mas mantém o texto (diferença real ainda aparece)", () => {
    assertEquals(
      normalizeMessage("docs/x/y.tjp:5: Error: Task t1 cannot depend on self",),
      "Error: Task t1 cannot depend on self",
    );
  });
});
