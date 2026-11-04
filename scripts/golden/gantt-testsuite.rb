#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# Golden 15.13 — percorre os relatórios do TestSuite do TaskJuggler Ruby real
# (tj3) que têm coluna `chart` e extrai a geometria do Gantt, no mesmo envelope
# `{ 'cases' => [...] }` dos scripts `gantt-mweNNN.rb`.
#
# Diretório coberto: HTML-Reports — é a fonte da verdade de layout do Gantt no
# TJ (depArrows.tjp exercita o roteador com dezenas de dependências, Sorting.tjp
# a ordem das linhas, IsOngoing.tjp a linha do `now`). Arquivos sem coluna
# `chart` simplesmente devolvem `charts: []`; arquivos que o tj3 não consegue
# parsear/agendar retornam com 'error' no caso (não abortam o golden).

require_relative 'gantt-common'
require 'json'

DIRS = %w[
  docs/taskjuggler/test/TestSuite/HTML-Reports
].freeze

files = DIRS.flat_map { |d| GanttGolden.tjp_dir(d) }
$stderr.puts "gantt-testsuite: #{files.length} arquivos"
puts JSON.generate(GanttGolden.cases_for_list(files))
