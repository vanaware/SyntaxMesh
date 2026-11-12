/**
 * Golden do `KeywordDocumentation.toText` vs `to_s` Ruby (22.1b.3.22).
 *
 * Usa os textos de 12 keywords do fixture `syntax-reference.golden.json`
 * (oracle `SyntaxReference.rb` real, ANSI desligado dos dois lados). A
 * gramática portada é um **subset reescrito** (textos `p.doc` novos em inglês),
 * então a comparação byte a byte do original vira **paridade estrutural** com
 * três projeções documentadas (⚠️ ADAPTAÇÃO, subset reescrito 2026-11-08):
 *
 * 1. **Seções**: mesma ordem; o port pode omitir apenas `See also:` (a
 *    gramática portada não declara os mesmos links — ex.: `effort`/`duration`).
 * 2. **Cabeçalho**: `Keyword:     <kw>` idêntico, salvo o sufixo
 *    ` (List Attribute)` que o Ruby marca via PropertySet e o port não detecta
 *    para `depends`/`allocate`.
 * 3. **Context**: mesma lista, salvo o contexto `properties` que só existe na
 *    gramática Ruby (ex.: `task` → `properties, task, supplement.task`).
 *
 * O conteúdo de `Purpose:`/`Syntax:`/`Arguments:` é texto reescrito e fica
 * fora da comparação — a estrutura (seções, ordem, cabeçalho, contextos) é o
 * contrato de regressão.
 *
 * @see scripts/golden/syntax-reference.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco E
 */
import { assert, assertEquals, } from "@std/assert";
import { before, describe, it, } from "@std/testing/bdd";
import { SyntaxReference, } from "../../src/docgen/syntax-reference.ts";

interface KeywordTextGolden {
  version: number;
  all: string[];
  texts: Array<{ keyword: string; text: string }>;
  internalReferences: Record<string, string[]>;
}

function loadGolden(): KeywordTextGolden {
  return JSON.parse(
    Deno.readTextFileSync(
      new URL("./fixtures/syntax-reference.golden.json", import.meta.url,),
    ),
  );
}

const SECTION_LABELS = [
  "Keyword:",
  "Warning:",
  "Purpose:",
  "Syntax:",
  "Arguments:",
  "Context:",
  "Attributes:",
  "See also:",
];

/** Rótulos das seções, na ordem em que aparecem no texto. */
function sections(text: string,): string[] {
  return text
    .split("\n",)
    .filter((line,) => SECTION_LABELS.some((label,) => line.startsWith(label,)))
    .map((line,) => line.split(/\s{2,}/,)[0]!);
}

/** Lista de contextos da linha `Context:` (`Global scope` → lista vazia). */
function contextList(text: string,): string[] {
  const line = text.split("\n",).find((l,) => l.startsWith("Context:",));
  if (line === undefined) return [];
  const value = line.slice("Context:".length,).trim();
  return value === "Global scope" ? [] : value.split(", ",);
}

describe("KeywordDocumentation.toText — golden vs oracle Ruby (22.1b.3.22)", () => {
  const golden = loadGolden();
  let reference: SyntaxReference;
  before(() => {
    reference = new SyntaxReference();
  },);

  for (const { keyword, text: rubyText, } of golden.texts) {
    describe(`keyword ${keyword}`, () => {
      it("mesmas seções na mesma ordem (See also: pode faltar no subset)", () => {
        const tsText = reference.toText(keyword, false,);
        const rubySections = sections(rubyText,);
        const tsSections = sections(tsText,);
        // Projeção 1: única omissão tolerada é `See also:`.
        const expected = rubySections.filter(
          (section,) =>
            section !== "See also:" || tsSections.includes("See also:",),
        );
        assertEquals(tsSections, expected,);
        // O núcleo estrutural está sempre presente.
        for (
          const label of [
            "Keyword:",
            "Purpose:",
            "Syntax:",
            "Arguments:",
            "Context:",
            "Attributes:",
          ]
        ) {
          assert(tsSections.includes(label,), `seção ${label} ausente`,);
        }
      });

      it("cabeçalho idêntico (salvo o sufixo List Attribute do Ruby)", () => {
        const tsHeader = reference.toText(keyword, false,).split("\n",)[0]!;
        const rubyHeader = rubyText.split("\n",)[0]!;
        // Projeção 2: o port não marca depends/allocate como list attribute.
        assertEquals(tsHeader, rubyHeader.replace(" (List Attribute)", "",),);
      });

      it("contextos idênticos (salvo o contexto properties do Ruby)", () => {
        const tsContext = contextList(reference.toText(keyword, false,),);
        // Projeção 3: `properties` só existe na gramática Ruby.
        const rubyContext = contextList(rubyText,).filter(
          (context,) => context !== "properties",
        );
        assertEquals(tsContext, rubyContext,);
      });
    });
  }

  it("nenhum texto do port carrega ANSI com color desligado", () => {
    for (const { keyword, } of golden.texts) {
      const text = reference.toText(keyword, false,);
      assert(!text.includes("\x1b[",), `${keyword} com ANSI`,);
      assert(text.length > 0, `${keyword} vazio`,);
    }
  });
});
