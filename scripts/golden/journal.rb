#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# journal.rb — golden de Journal/JournalEntry (Fase 16.19).
#
# Oracle: monta um Project mínimo (2 tasks raiz + 1 sub-task, 2 resources),
# insere 6 JournalEntry com alertLevel/autor/flags/summary/details e, para
# cada `journalMode`, chama `Journal#to_rti` e extrai o texto plano do
# RichTextIntermediate (`rti.to_s`).
#
# O texto plano cobre, de uma vez, a **seleção** (quais entradas cada modo
# inclui), a **ordem** (date/alert/seqno) e a **renderização** de
# `JournalEntry#to_rText` (alert, property, propertyid, headline, date,
# author, flags, summary, details).
#
# Tolerância do lado TS: whitespace colapsado (`\s+` → espaço), a mesma do
# golden de RichText (Fase 12.19) — o `textBlockFormat` reflui parágrafos.
#
# Fixture reproduzível no TS (ver `journal_golden_test.ts`):
#   projeto p1, start 2026-01-01, end 2026-01-31, timeFormat %Y-%m-%d
#   tasks    t1 "Design", t1_1 "Design Child" (filha), t2 "Build"
#   recursos alice, bob
#   entradas (headline, data, propriedade, alerta, autor, flags):
#     Kickoff       2026-01-05  t1   0  alice  —
#     Risk Found    2026-01-10  t1   2  bob    risk
#     Child Update  2026-01-12  t1_1 1  alice  —
#     Build Late    2026-01-15  t2   1  bob    late
#     Global Note   2026-01-18  —    0  —      —
#     Secret Note   2026-01-28  t2   1  bob    secret
#   summary/details só em `Risk Found` ("Summary line" / "Details block").
#
# Serializa { cases: [ { description, mode, property, start, end, attributes,
# selfContained, hideFlags, expected } ] }.
#
# @see docs/taskjuggler/lib/taskjuggler/Journal.rb
# @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.19)

$LOAD_PATH.unshift(File.expand_path("../../docs/taskjuggler/lib", __dir__))
require "json"
require "taskjuggler/TaskJuggler"

TJ = TaskJuggler

TJ::TjTime.setTimeZone("UTC")

# Atributos do journal no formato "todos" (o default do TJP para relatórios).
FULL = %w[
  alert property propertyid headline date author flags summary details
].freeze

# Subconjunto mínimo: só headline e data.
COMPACT = %w[headline date].freeze

# Formatação de data estável entre fusos (o golden usa UTC de qualquer forma).
TIME_FORMAT = "%Y-%m-%d"

# Ordenação default do TaskJuggler (`JournalEntryList#initialize`).
SORTING = [[:date, 1], [:alert, 1], [:seqno, 1]].freeze

def tj(date)
  TJ::TjTime.new(date)
end

def richtext_rti(markup)
  TJ::RichText.new(markup).generateIntermediateFormat
end

# Monta o projeto/entradas do golden. Uma fixture nova por caso mantém o
# oracle livre de estado de ordenação entre chamadas.
def build_fixture
  project = TJ::Project.new("p1", "Golden Journal", "1.0")
  project["start"] = tj("2026-01-01")
  project["end"] = tj("2026-01-31")
  project["timeFormat"] = TIME_FORMAT

  t1 = TJ::Task.new(project, "t1", "Design", nil)
  t1_1 = TJ::Task.new(project, "t1_1", "Design Child", t1)
  t2 = TJ::Task.new(project, "t2", "Build", nil)
  alice = TJ::Resource.new(project, "alice", "Alice", nil)
  bob = TJ::Resource.new(project, "bob", "Bob", nil)

  journal = project["journal"]

  TJ::JournalEntry.new(journal, tj("2026-01-05"), "Kickoff", t1).author = alice

  risk = TJ::JournalEntry.new(journal, tj("2026-01-10"), "Risk Found", t1)
  risk.alertLevel = 2
  risk.author = bob
  risk.flags = ["risk"]
  risk.summary = richtext_rti("Summary line")
  risk.details = richtext_rti("Details block")

  TJ::JournalEntry.new(journal, tj("2026-01-12"), "Child Update", t1_1)
                     .author = alice

  late = TJ::JournalEntry.new(journal, tj("2026-01-15"), "Build Late", t2)
  late.alertLevel = 1
  late.author = bob
  late.flags = ["late"]

  TJ::JournalEntry.new(journal, tj("2026-01-18"), "Global Note", nil)

  secret = TJ::JournalEntry.new(journal, tj("2026-01-28"), "Secret Note", t2)
  secret.alertLevel = 1
  secret.author = bob
  secret.flags = ["secret"]

  {
    project: project,
    journal: journal,
    tasks: { "t1" => t1, "t1_1" => t1_1, "t2" => t2 },
    resources: { "alice" => alice, "bob" => bob }
  }
end

# Resolve um id serializável ("t1", "alice", …) na entidade da fixture.
def resolve(fixture, id)
  return nil if id.nil?

  fixture[:tasks][id] || fixture[:resources][id]
end

$cases = []

# Registra um caso: roda `Journal#to_rti` e guarda o texto plano resultante.
def tc(desc, mode:, property: nil, attributes: FULL, self_contained: false,
       hide_flags: [], start_date: "2026-01-01", end_date: "2026-01-31")
  fixture = build_fixture
  hide = if hide_flags.empty?
           nil
         else
           TJ::LogicalExpression.new(TJ::LogicalFlag.new(hide_flags.first))
         end

  query = TJ::Query.new(
    "project" => fixture[:project],
    "property" => resolve(fixture, property),
    "start" => tj(start_date),
    "end" => tj(end_date),
    "journalMode" => mode,
    "scenarioIdx" => 0,
    "journalAttributes" => attributes,
    "sortJournalEntries" => SORTING,
    "selfContained" => self_contained,
    "hideJournalEntry" => hide,
    "timeFormat" => TIME_FORMAT
  )
  fixture[:journal].to_rti(query)
  rti = query.instance_variable_get(:@rti)
  raise "to_rti devolveu nil para '#{desc}'" if rti.nil?

  $cases << {
    description: desc,
    mode: mode.to_s,
    property: property,
    start: start_date,
    end: end_date,
    attributes: attributes,
    selfContained: self_contained,
    hideFlags: hide_flags,
    expected: rti.to_s
  }
end

# --- Mode :journal ---
tc("journal com propriedade t1 mostra Kickoff e Risk Found",
   mode: :journal, property: "t1")
tc("journal sem propriedade inclui a entrada global e a de t2",
   mode: :journal, property: nil)
tc("journal com autor alice usa entriesByResource",
   mode: :journal, property: "alice")
tc("journal com alerta self-contained usa fcol no lugar do ícone",
   mode: :journal, property: "t1", self_contained: true)
tc("journal com hideJournalEntry remove a entrada com flag secret",
   mode: :journal, property: nil, hide_flags: ["secret"])
tc("journal com atributos compactos mostra só headline e data",
   mode: :journal, property: nil, attributes: COMPACT)

# --- Mode :journal_sub ---
tc("journal_sub inclui as sub-tasks de t1",
   mode: :journal_sub, property: "t1")
tc("journal_sub com atributos compactos",
   mode: :journal_sub, property: "t1", attributes: COMPACT)

# --- Mode :status_up ---
tc("status_up sem propriedade usa as últimas entradas por task raiz",
   mode: :status_up, property: nil)
tc("status_up com propriedade t1",
   mode: :status_up, property: "t1")
tc("status_up com a sub-task t1_1",
   mode: :status_up, property: "t1_1", attributes: COMPACT)

# --- Mode :status_down / :status_dep ---
tc("status_down sem propriedade inclui sub-tasks",
   mode: :status_down, property: nil)
tc("status_down com propriedade t1 mantém a entrada de alerta maior do pai",
   mode: :status_down, property: "t1")
tc("status_dep com propriedade t1 (sem dependências) coincide com status_down",
   mode: :status_dep, property: "t1")

# --- Mode :alerts_down / :alerts_dep ---
tc("alerts_down sem propriedade filtra pelo maior nível de alerta",
   mode: :alerts_down, property: nil)
tc("alerts_down com propriedade t1",
   mode: :alerts_down, property: "t1")
tc("alerts_dep com propriedade t2 filtra pelo maior nível",
   mode: :alerts_dep, property: "t2")

puts({ cases: $cases }.to_json)
