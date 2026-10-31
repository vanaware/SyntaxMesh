#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# Golden 14.23 — percorre o corpus de relatórios do TestSuite do TaskJuggler
# Ruby real (tj3) e extrai o formato intermediário de cada relatório, no mesmo
# envelope `{ 'cases' => [...] }` dos scripts `reports-mweNNN.rb`.
#
# Diretórios cobertos (fonte da verdade de comportamento de reports):
#   ReportGenerator/Correct  — dispatch por typeSpec + geração
#   HTML-Reports             — tabelas HTML, calendários, sorting, UDA, journal
#   CSV-Reports              — saída CSV, headcount/efficiency/FTE, targets
#
# Arquivos que o tj3 não consegue parsear/agendar retornam com 'error' no caso
# (não abortam o golden). Logs vão para stderr; só o JSON vai para stdout.

require_relative 'reports-common'
require 'json'

DIRS = %w[
  docs/taskjuggler/test/TestSuite/ReportGenerator/Correct
  docs/taskjuggler/test/TestSuite/HTML-Reports
  docs/taskjuggler/test/TestSuite/CSV-Reports
].freeze

files = DIRS.flat_map { |d| ReportsGolden.tjp_dir(d) }
$stderr.puts "reports-syntax-correct: #{files.length} arquivos"
puts JSON.generate(ReportsGolden.cases_for_list(files))
