/**
 * Corpus manifest contract (26.1, F21 wave 1).
 *
 * The manifest at `tests/fixtures/corpus.json` is the single inventory of
 * e2e golden fixtures: the Ruby oracle (`scripts/golden/cli-tj3.rb`) and the
 * CLI runner test both consume it. These tests pin the id rules, the build
 * invariants, and the real corpus counts (regression against accidental
 * fixture loss), plus the committed-manifest sync check.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.1)
 * @see docs/syntaxmesh/decisoes/042-estrategia-validacao.md
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import {
  buildManifest,
  fixtureId,
  GROUPS,
  scanCorpus,
} from "../../../../scripts/golden/corpus.ts";

/** Repository root: manifest paths are relative to it. */
const ROOT = new URL("../../../../", import.meta.url,).pathname;

describe("fixtureId (26.1)", () => {
  it("mwe fixtures use the tutorial directory name", () => {
    assertEquals(
      fixtureId("mwe", "docs/Learning/mwe001/tutorial.tjp",),
      "mwe/mwe001",
    );
  });

  it("tjp fixtures use the group and the file stem", () => {
    assertEquals(
      fixtureId(
        "syntax-correct",
        "docs/taskjuggler/test/TestSuite/Syntax/Correct/Account.tjp",
      ),
      "syntax-correct/Account",
    );
  });

  it("parity fixtures keep the .smx stem", () => {
    assertEquals(
      fixtureId(
        "parity",
        "packages/cli/tests/fixtures/golden/parity-html.smx",
      ),
      "parity/parity-html",
    );
  });
});

describe("buildManifest (26.1)", () => {
  it("sorts fixtures, keeps GROUPS order, counts per group and total", () => {
    const manifest = buildManifest([
      { group: "syntax-correct", path: "b/Zeta.tjp", },
      { group: "mwe", path: "docs/Learning/mwe002/tutorial.tjp", },
      { group: "syntax-correct", path: "b/Alpha.tjp", },
      { group: "mwe", path: "docs/Learning/mwe001/tutorial.tjp", },
    ],);
    assertEquals(manifest.groups.map((g,) => g.id), [
      "mwe",
      "syntax-correct",
    ],);
    assertEquals(manifest.groups[0]!.fixtures.map((f,) => f.id), [
      "mwe/mwe001",
      "mwe/mwe002",
    ],);
    assertEquals(manifest.groups[1]!.fixtures.map((f,) => f.id), [
      "syntax-correct/Alpha",
      "syntax-correct/Zeta",
    ],);
    assertEquals(manifest.groups[0]!.count, 2,);
    assertEquals(manifest.total, 4,);
  });

  it("omits groups without entries", () => {
    const manifest = buildManifest([
      { group: "mwe", path: "docs/Learning/mwe001/tutorial.tjp", },
    ],);
    assertEquals(manifest.groups.length, 1,);
  });

  it("rejects duplicate ids", () => {
    assertThrows(
      () =>
        buildManifest([
          { group: "mwe", path: "docs/Learning/mwe001/tutorial.tjp", },
          { group: "mwe", path: "docs/Learning/mwe001/tutorial.tjp", },
        ],),
      Error,
      "duplicate",
    );
  });

  it("rejects unknown groups", () => {
    assertThrows(
      () => buildManifest([{ group: "nope", path: "x.tjp", },],),
      Error,
      "unknown group",
    );
  });
});

describe("real corpus (26.1 regression)", () => {
  const manifest = scanCorpus(ROOT,);

  it("covers every group with the measured counts", () => {
    const counts = Object.fromEntries(
      manifest.groups.map((g,) => [g.id, g.count,]),
    );
    assertEquals(counts, {
      "mwe": 9,
      "syntax-correct": 75,
      "syntax-errors": 94,
      "scheduler-correct": 35,
      "scheduler-errors": 70,
      "report-generator": 9,
      "html-reports": 13,
      "csv-reports": 18,
      "export-refs": 68,
      "parity": 4,
    },);
    assertEquals(manifest.total, 395,);
  });

  it("every fixture path exists and every id is unique", () => {
    const seen = new Set<string>();
    for (const group of manifest.groups) {
      for (const fixture of group.fixtures) {
        assert(!seen.has(fixture.id,), `duplicate id ${fixture.id}`,);
        seen.add(fixture.id,);
        const stat = Deno.statSync(ROOT + fixture.path,);
        assert(stat.isFile, `not a file: ${fixture.path}`,);
      }
    }
    assertEquals(seen.size, manifest.total,);
  });

  it("GROUPS dirs are repository-relative (no absolute paths)", () => {
    for (const group of GROUPS) {
      assert(!group.dir.startsWith("/",), `absolute dir: ${group.dir}`,);
    }
  });

  it("committed corpus.json is in sync with the scan", async () => {
    const committed = JSON.parse(
      await Deno.readTextFile(ROOT + "tests/fixtures/corpus.json",),
    );
    assertEquals(committed, JSON.parse(JSON.stringify(manifest,),),);
  });
});
