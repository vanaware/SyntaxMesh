/**
 * 26.9.3/26.9.4 — Regression snapshot de diagnostics (F21 wave 1).
 *
 * Fixa as mensagens (id + texto) e a exceção de parse de cada fixture do
 * grupo `syntax-errors` do corpus (26.1). O baseline é o comportamento
 * ATUAL do port; o golden e2e segue comparando contra o tj3 separadamente.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.9)
 */
import { assert, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { parseProject, } from "../parser/parse-helper.ts";
import { assertSnapshot, } from "./snapshot-io.ts";

const REPO_ROOT = new URL("../../../../", import.meta.url,).pathname;

interface CorpusManifest {
  groups: { id: string; fixtures: { id: string; path: string }[] }[];
}

describe("Diagnostics regression snapshot (26.9.4)", () => {
  it("mensagens de cada fixture syntax-errors batem com o baseline", () => {
    const manifest = JSON.parse(
      Deno.readTextFileSync(`${REPO_ROOT}tests/fixtures/corpus.json`,),
    ) as CorpusManifest;
    const group = manifest.groups.find((g,) => g.id === "syntax-errors");
    assert(group !== undefined, "grupo syntax-errors ausente do corpus",);
    assert(group.fixtures.length > 0, "grupo syntax-errors vazio",);

    const entries: Record<string, unknown> = {};
    for (const fixture of group.fixtures) {
      const text = Deno.readTextFileSync(REPO_ROOT + fixture.path,);
      const out = parseProject(text,);
      entries[fixture.id] = {
        threw: out.threw === null ? null : out.threw.constructor.name,
        messages: out.messages.map((m,) => ({ id: m.id, text: m.text, })),
      };
    }
    assertSnapshot(
      "diagnostics.snap.json",
      JSON.stringify(entries, null, 2,) + "\n",
    );
  });
});
