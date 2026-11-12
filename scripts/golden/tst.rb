#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# scripts/golden/tst.rb -- Golden do TernarySearchTree (Fase 22, 22.1b.1.11).
#
# Usa o `TernarySearchTree.rb` real como oracle: insere ~30 keywords TJP em
# duas ordens (sequencial e construtor de array, que balanceia), exercitando
# `find` exato e por prefixo (`partialMatch`), `to_a`, `length`, `maxDepth`,
# `balanced` e `balance!`. O resultado é escrito em
# `packages/core/tests/docgen/fixtures/tst-cases.golden.json` e consumido por
# `tests/utils/ternary_search_tree_test.ts`.
#
# Decisões de fidelidade:
#   * `find` devolve `nil` quando não encontra (exato ou prefixo) — o JSON
#     carrega `null`; o port TS devolve `null` da mesma forma.
#   * `maxDepth` só é comparado em árvores não vazias: o Ruby devolve `nil`
#     para árvore vazia (`[].max`), o port devolve 0 (adaptação registrada).
#   * A ordem de `to_a`/`collect` é alfabética (smaller → equal → larger).

$LOAD_PATH.unshift(File.expand_path("../../docs/taskjuggler/lib", __dir__))
require "taskjuggler/TernarySearchTree"
require "json"

KEYWORDS = %w[
  account accountreport allocate balance booking chargeset chart
  currency depends duration effort end export extend format
  include journal length limits macro material milestone note
  priority project purge report resource resourcereport scenario
].freeze

EXACT_QUERIES = (KEYWORDS + %w[zzz tas accountreports]).freeze

PARTIAL_QUERIES = %w[
  a ac account accountreport b bo c ch char currency d de du
  e ef eff end ex exp export extend f fo format i in include
  j jo journal l le len length limits m ma mac macro mat material
  milestone n no note p pr pri priority pro project purge
  r re rep report res resource resourcereport s sc scenario z zz
].freeze

def snapshot(tree)
  { "toArray" => tree.to_a, "length" => tree.length, "maxDepth" => tree.maxDepth }
end

# 1. Inserção sequencial (ordem da lista, sem balanceamento).
sequential = TaskJuggler::TernarySearchTree.new
KEYWORDS.each { |kw| sequential.insert(kw) }

# 2. Construtor com array (sortForBalancedTree antes de inserir).
from_array = TaskJuggler::TernarySearchTree.new(KEYWORDS)

# 3. Busca exata (nil → null).
exact_find = EXACT_QUERIES.map do |q|
  { "query" => q, "result" => from_array.find(q) }
end

# 4. Busca por prefixo (partialMatch = true; nil → null).
partial_find = PARTIAL_QUERIES.map do |q|
  { "query" => q, "result" => from_array.find(q, true) }
end

# 5. `balanced` (nova árvore) e `balance!` (in-place na sequencial).
balanced = from_array.balanced
before_balance = snapshot(sequential)
sequential.balance!
after_balance = snapshot(sequential)

out = {
  "version" => 1,
  "keywords" => KEYWORDS,
  "sequential" => before_balance,
  "arrayConstructor" => snapshot(from_array),
  "exactFind" => exact_find,
  "partialFind" => partial_find,
  "balanced" => { "toArray" => balanced.to_a, "maxDepth" => balanced.maxDepth },
  "balanceInPlace" => after_balance,
}

puts JSON.pretty_generate(out)