/**
 * 26.9.1/26.9.2 — Regression snapshot da AST (F21 wave 1).
 *
 * Fixa o snapshot estrutural (`snapshotAST` + `serializeValue`, chaves
 * ordenadas) de cada fixture en: os 9 MWEs (in place em `docs/Learning/`)
 * e as famílias `*.en.tjp` de `tests/fixtures/i18n/`. Diferente do golden
 * e2e (conformidade × tj3), aqui o baseline é o comportamento ATUAL do
 * port — qualquer drift de parse/modelo quebra o snapshot.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.9)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { parseProject, } from "../parser/parse-helper.ts";
import { serializeValue, snapshotAST, } from "../helpers/ast-snapshot.ts";
import type { Project, } from "../../src/model/project.ts";
import { assertSnapshot, } from "./snapshot-io.ts";

const REPO_ROOT = new URL("../../../../", import.meta.url,).pathname;
const I18N_DIR = new URL("../fixtures/i18n/", import.meta.url,).pathname;

const MWE_IDS = [
  "mwe001",
  "mwe002",
  "mwe003",
  "mwe004",
  "mwe005",
  "mwe006",
  "mwe007",
  "mwe008",
  "mwe009",
];

/** Fixture id → source text (MWEs in place + famílias i18n en). */
function fixtures(): Map<string, string> {
  const out = new Map<string, string>();
  for (const mwe of MWE_IDS) {
    out.set(
      `mwe/${mwe}`,
      Deno.readTextFileSync(`${REPO_ROOT}docs/Learning/${mwe}/tutorial.tjp`,),
    );
  }
  const families = [...Deno.readDirSync(I18N_DIR,),]
    .filter((e,) => e.isFile && e.name.endsWith(".en.tjp",))
    .map((e,) => e.name.replace(/\.en\.tjp$/, "",))
    .sort();
  for (const family of families) {
    out.set(
      `i18n/${family}`,
      Deno.readTextFileSync(`${I18N_DIR}${family}.en.tjp`,),
    );
  }
  return out;
}

describe("AST regression snapshot (26.9.2)", () => {
  it("snapshot estrutural de cada fixture en bate com o baseline", () => {
    const entries: Record<string, string> = {};
    for (const [id, text,] of fixtures()) {
      const out = parseProject(text,);
      assert(out.threw === null, `${id} lançou: ${out.threw?.message}`,);
      assertEquals(out.messageIds, [], `${id} mensagens`,);
      entries[id] = serializeValue(snapshotAST(out.result as Project,),);
    }
    assert(Object.keys(entries,).length >= 30, "esperado ≥30 fixtures",);
    assertSnapshot(
      "ast.snap.json",
      JSON.stringify(entries, null, 2,) + "\n",
    );
  });
});
