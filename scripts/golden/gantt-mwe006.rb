#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# Golden 15.13 — extrai a geometria do Gantt chart dos relatórios de
# docs/Learning/mwe006/tutorial.tjp usando o tj3 Ruby real (via gantt-common).
# Saída: um caso no formato de `gantt.golden.json` (capturado por
# generate_golden.ts). Logs vão para stderr.

require_relative 'gantt-common'
require 'json'

case_data = GanttGolden.case_for('docs/Learning/mwe006/tutorial.tjp')
puts JSON.generate(case_data)
