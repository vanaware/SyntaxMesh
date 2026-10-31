#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# Golden 14.23 — extrai o formato intermediário dos relatórios de
# docs/Learning/mwe002/tutorial.tjp usando o tj3 Ruby real (via reports-common).
# Saída: um caso no formato de `reports.golden.json` (capturado por
# generate_golden.ts). Logs vão para stderr.

require_relative 'reports-common'
require 'json'

case_data = ReportsGolden.case_for('docs/Learning/mwe002/tutorial.tjp')
puts JSON.generate(case_data)
