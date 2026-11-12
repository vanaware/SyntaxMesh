/**
 * Golden do `SyntaxReference` vs oracle Ruby (22.1b.2.14/2.15).
 *
 * O fixture é o snapshot do `SyntaxReference.rb` real (`all` com 266 keywords,
 * `internalReferences`). A gramática portada é um **subset reescrito** (170
 * keywords, textos `p.doc` novos em inglês — entrega 2026-11-08), então a
 * comparação é uma **projeção do subset**, não igualdade byte a byte:
 *
 * - `all()` do port: ordenado, sem duplicatas, e o vocabulário compartilhado
 *   com o Ruby (interseção) fica pinado como regressão;
 * - `internalReferences()`: toda entrada do port deve existir no Ruby com o
 *   mesmo valor. O port hoje não tem referências internas: os textos reescritos
 *   usam código (`''''kw''''`) em vez de links `[[kw]]` (⚠️ ADAPTAÇÃO
 *   registrada na entrega de 2026-11-08).
 *
 * Os textos `to_s` das 12 keywords do mesmo fixture são comparados em
 * `keyword-documentation_golden_test.ts` (22.1b.3.22).
 *
 * @see scripts/golden/syntax-reference.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco D
 */
import { assert, assertEquals, } from "@std/assert";
import { before, describe, it, } from "@std/testing/bdd";
import { SyntaxReference, } from "../../src/docgen/syntax-reference.ts";

interface SyntaxReferenceGolden {
  version: number;
  all: string[];
  texts: Array<{ keyword: string; text: string }>;
  internalReferences: Record<string, string[]>;
}

function loadGolden(): SyntaxReferenceGolden {
  return JSON.parse(
    Deno.readTextFileSync(
      new URL("./fixtures/syntax-reference.golden.json", import.meta.url,),
    ),
  );
}

describe("SyntaxReference — golden vs oracle Ruby (22.1b.2.15)", () => {
  const golden = loadGolden();
  let reference: SyntaxReference;
  before(() => {
    reference = new SyntaxReference();
  },);

  it("all() é ordenado, sem duplicatas e cobre o índice de keywords", () => {
    const all = reference.all();
    assertEquals(all, [...all,].sort(),);
    assertEquals(new Set(all,).size, all.length,);
    assertEquals(all, [...reference.keywords.keys(),].sort(),);
  });

  it("o vocabulário compartilhado com o Ruby está presente (subset)", () => {
    const tsAll = new Set(reference.all(),);
    const intersection = golden.all.filter((keyword,) => tsAll.has(keyword,));
    // Pin de regressão: 139 keywords compartilhadas na entrega 2026-11-11.
    // Mudou a gramática? Revalide o subset e atualize o pin com evidência.
    assertEquals(intersection.length, 139,);
    // As 12 keywords dos textos existem nas duas gramáticas.
    for (const { keyword, } of golden.texts) {
      assert(tsAll.has(keyword,), `${keyword} ausente no port`,);
      assert(golden.all.includes(keyword,), `${keyword} ausente no Ruby`,);
    }
  });

  it("internalReferences() projeta o oracle (mesmas chaves e valores)", () => {
    const references = reference.internalReferences();
    for (const [keyword, refs,] of Object.entries(references,)) {
      assertEquals(
        refs,
        golden.internalReferences[keyword],
        `referências de ${keyword} divergem do oracle`,
      );
    }
    // ⚠️ ADAPTAÇÃO: os textos reescritos não usam [[kw]]; o port não tem
    // referências internas hoje. O Ruby tem 5 entradas — quando os links
    // voltarem aos textos, a projeção acima passa a exercitá-las.
    assertEquals(Object.keys(references,).length, 0,);
    assertEquals(Object.keys(golden.internalReferences,).length, 5,);
  });
});
