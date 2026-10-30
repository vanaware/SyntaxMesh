/**
 * Snapshot tests do Markdown (Fase 13.12).
 *
 * Lê `markdown-snapshots.json` (gerado por `generate_snapshots.ts`) e congela as
 * saídas de cada fixture. Para cada entrada valida `to_tagged` e `to_markdown`;
 * quando `to_s`/`to_html` foram registrados (fixtures sem handler de função
 * pendente), valida-os também. `assertEquals` produz diff na falha (13.12.8).
 *
 * Grupos garantem cobertura mínima (13.12.2–13.12.5): ≥ 5 por grupo.
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown-tarefas.md (13.12)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MarkdownFactory, } from "../../../src/markdown/factory.ts";

interface Snapshot {
  name: string;
  group: string;
  input: string;
  to_tagged: string;
  to_markdown: string;
  to_s?: string;
  to_html?: string;
}

const DATA = JSON.parse(
  Deno.readTextFileSync(
    new URL("./markdown-snapshots.json", import.meta.url,),
  ),
) as { snapshots: Snapshot[] };

const factory = new MarkdownFactory(null,);

function snapshotFor(input: string,): Snapshot {
  const rti = factory.create(input,);
  const result: Snapshot = {
    name: "",
    group: "",
    input,
    to_tagged: rti.to_tagged(),
    to_markdown: rti.to_markdown(),
  };
  try {
    result.to_s = rti.to_s();
    const html = rti.to_html();
    result.to_html = html ? html.toHTML() : undefined;
  } catch {
    // Query não registrada: to_s/to_html indisponíveis.
  }
  return result;
}

describe("Markdown snapshots (13.12)", () => {
  it("há pelo menos 20 fixtures (13.12)", () => {
    assert(
      DATA.snapshots.length >= 20,
      `expected >= 20, got ${DATA.snapshots.length}`,
    );
  });

  for (const group of ["simple", "extensions", "html", "misc",]) {
    it(`grupo '${group}' tem >= 5 fixtures (13.12.2-5)`, () => {
      const count = DATA.snapshots.filter((s,) => s.group === group).length;
      assert(count >= 5, `group ${group}: expected >= 5, got ${count}`,);
    });
  }

  for (const fixture of DATA.snapshots) {
    describe(fixture.name, () => {
      it("to_tagged congelado", () => {
        const actual = snapshotFor(fixture.input,);
        assertEquals(actual.to_tagged, fixture.to_tagged,);
      });
      it("to_markdown congelado (13.12.7)", () => {
        const actual = snapshotFor(fixture.input,);
        assertEquals(actual.to_markdown, fixture.to_markdown,);
      });
      // to_s / to_html só quando registrados no snapshot.
      if (fixture.to_s !== undefined) {
        it("to_s congelado (13.12.7)", () => {
          const actual = snapshotFor(fixture.input,);
          assertEquals(actual.to_s, fixture.to_s,);
        });
      }
      if (fixture.to_html !== undefined) {
        it("to_html congelado (13.12.7)", () => {
          const actual = snapshotFor(fixture.input,);
          assertEquals(actual.to_html, fixture.to_html,);
        });
      }
    },);
  }

  it("divergência produz diff legível (13.12.8)", () => {
    // Sanidade: uma entrada conhecida deve diferir de um valor errado.
    const actual = snapshotFor("# Hello",);
    let threw = false;
    try {
      assertEquals(actual.to_markdown, "# WRONG",);
    } catch {
      threw = true;
    }
    assert(threw, "assertEquals deve lançar com diff na divergência",);
  });
});
