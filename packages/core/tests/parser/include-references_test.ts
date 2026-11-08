/**
 * Leitura estática de `include`s (Fase 24 — tarefa 24.3.6).
 *
 * A CLI monta `request.files` com o fechamento completo antes de `execute`;
 * estes testes cobrem a varredura que descobre os arquivos incluídos sem
 * abrir nada.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli.md §5.1
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  includeKeywords,
  scanIncludeReferences,
} from "../../src/parser/include-references.ts";

describe("includeKeywords (24.3.6)", () => {
  it("inclui o canônico e os sinônimos registrados", () => {
    const keywords = includeKeywords();
    assertEquals(keywords.includes("include",), true,);
    assertEquals(keywords.includes("incluir",), true,);
  });
});

describe("scanIncludeReferences (24.3.6)", () => {
  it("captura o caminho de um include simples", () => {
    assertEquals(
      scanIncludeReferences('include "common.tji"\n',),
      ["common.tji",],
    );
  });

  it("aceita indentação (include dentro do projeto)", () => {
    assertEquals(
      scanIncludeReferences('  include "sub/extra.tji"\n',),
      ["sub/extra.tji",],
    );
  });

  it("aceita o sinônimo localizado do pt-BR", () => {
    assertEquals(
      scanIncludeReferences('incluir "comum.tji"\n',),
      ["comum.tji",],
    );
  });

  it("ignora comentários e linhas sem include", () => {
    const text = [
      '# include "comentado.tji"',
      'task t1 "X" { effort 1d } # include "inline.tji"',
      'include "real.tji" # trailing',
      "",
    ].join("\n",);
    assertEquals(scanIncludeReferences(text,), ["real.tji",],);
  });

  it("mantém a ordem e não deduplica (o chamador decide)", () => {
    const text = 'include "a.tji"\ninclude "b.tji"\ninclude "a.tji"\n';
    assertEquals(scanIncludeReferences(text,), ["a.tji", "b.tji", "a.tji",],);
  });

  it("não confunde um identificador parecido com include", () => {
    assertEquals(scanIncludeReferences('includes "x.tji"\n',), [],);
  });
});
