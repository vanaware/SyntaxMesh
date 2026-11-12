#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# scripts/golden/syntax-reference.rb -- Golden do SyntaxReference (Fase 22,
# 22.1b.2.14/2.15 + 22.1b.3.22).
#
# Usa o `SyntaxReference.rb` real como oracle: `all` (lista ordenada),
# `to_s` (ANSI desligado) de keywords representativas e `internalReferences`.
# O resultado é escrito em
# `packages/core/tests/docgen/fixtures/syntax-reference.golden.json` e
# consumido por `tests/docgen/syntax-reference_golden_test.ts` (lista +
# referências) e `tests/docgen/keyword-documentation_golden_test.ts` (textos).
#
# Decisões de fidelidade:
#   * `Term::ANSIColor.coloring = false` explícito: o `to_s` do Ruby usa
#     `blue`/`bold` do term-ansicolor; o port TS compara com `toText(false)`.
#   * A gramática portada é um SUBSET reescrito (170 keywords × 266 do Ruby;
#     textos `p.doc` novos em inglês — entrega 2026-11-08). O golden é o
#     snapshot do oracle Ruby; o teste TS projeta o subset e compara a
#     ESTRUTURA do `to_s` (seções/ordem), não os bytes do texto reescrito.
#   * `report`/`journal`/`booking` não são keywords documentadas no Ruby
#     (o `to_s` do SyntaxReference devolve '' e escreve em $stderr); ficam
#     fora da lista. `booking.material`/`note` existem nos dois.

$LOAD_PATH.unshift(File.expand_path("../../docs/taskjuggler/lib", __dir__))
require "taskjuggler/SyntaxReference"
require "term/ansicolor"
require "json"

Term::ANSIColor.coloring = false

# Keywords representativas presentes nas DUAS gramáticas: entidades, atributos
# herdados, blocos opcionais, seeAlso e níveis de suporte variados.
KEYWORDS = %w[
  project task resource account scenario shift
  depends allocate effort duration length priority
].freeze

reference = TaskJuggler::SyntaxReference.new

texts = KEYWORDS.map do |keyword|
  { "keyword" => keyword, "text" => reference.to_s(keyword) }
end

out = {
  "version" => 1,
  "all" => reference.all,
  "texts" => texts,
  "internalReferences" => reference.internalReferences,
}

puts JSON.pretty_generate(out)