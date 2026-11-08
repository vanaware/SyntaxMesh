#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# ical.rb — golden de ICalendar/Component/Todo/Event/Journal + foldLines
# (Fase 17.16).
#
# Oracle: monta documentos com a API real do Ruby e grava o `to_s` completo
# (envelope + componentes já dobrados, com CRLF). O teste Deno
# (`ical_golden_test.ts`) constrói a mesma estrutura com o port de `src/ical/`
# (17.5/17.6) e compara byte-a-byte, com DUAS normalizações documentadas:
#   1. line endings (convenção geral dos goldens);
#   2. o valor de DTSTAMP — hora da serialização, não determinística na
#      natureza — é congelado aqui (`ICAL_FROZEN_NOW`) e substituído por
#      `DTSTAMP:@@NOW@@` nos dois lados do teste. A linha DTSTAMP tem
#      26 bytes (< 75), então nunca é dobrada e a substituição é segura.
#
# Determinismo adicional: fuso fixo (mesmo padrão dos goldens de reports —
# o teste TS chama `TjTime.setTimeZone(c.spec.tz)` antes de montar as datas),
# `creationDate`/`lastModified` fixados em '2026-01-01' e o AppConfig
# (packageName/softwareName/version) igualado aos defaults do port
# (`packages/core/src/app-config.ts`) para PRODID e UID saírem byte-idênticos.
#
# Casos (11): envelope vazio; Todo default (DUE + PERCENT-COMPLETE:-1); Todo
# 100% (COMPLETED); Event default (PRIORITY:1/DTEND/TRANSP); Journal puro;
# DESCRIPTION com escapes RFC (`;,"\\` +
# newline real → `\n` literal); DESCRIPTION vazio (truthy do Ruby);
# RELATED-TO; ORGANIZER + 2 ATTENDEE; dobra ASCII > 75 octetos; dobra UTF-8
# multibyte (Categoria C: reset da contagem sem somar o espaço); ordem
# todos → events → journals no documento misto.
#
# @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb
# @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.16)

$LOAD_PATH.unshift(File.expand_path("../../docs/taskjuggler/lib", __dir__))
require "json"
require "taskjuggler/ICalendar"
require "taskjuggler/TjTime"

ICalendar = TaskJuggler::ICalendar
Todo = TaskJuggler::ICalendar::Todo
Event = TaskJuggler::ICalendar::Event
Journal = TaskJuggler::ICalendar::Journal
TjTime = TaskJuggler::TjTime

ICALENDAR_TZ = 'Europe/Berlin'
TaskJuggler::TjTime.setTimeZone(ICALENDAR_TZ)

# Relógio da serialização (DTSTAMP) congelado para o golden ser byte-idempotente
# (regra 5 do README) — mesmo precedente do `FROZEN_NOW` do gantt golden. O
# teste TS ainda normaliza DTSTAMP: o port não tem seam de relógio e emite o
# `now()` real.
ICAL_FROZEN_NOW = '2026-01-04'
class TaskJuggler::TjTime
  alias_method :__golden_init, :initialize
  def initialize(t = nil)
    __golden_init(t || ICAL_FROZEN_NOW)
  end
end

# Igualado aos defaults do port para PRODID/UID byte-idênticos.
#
# A versão vem de `packages/core/src/version.ts` — a **fonte única** do port
# (`AppConfig.version` e o atributo `version` de `Project` derivam dela). Fixar
# um literal aqui deixava o golden para trás a cada bump: em `0.0.0` o script
# regerava PRODID/UID divergentes do que o teste compara (24.6.6).
PORT_VERSION = File.read(
  File.expand_path('../../packages/core/src/version.ts', __dir__)
).match(/VERSION\s*=\s*"([^"]+)"/)[1]

AppConfig.packageName = "@vanaware/syntaxmesh"
AppConfig.softwareName = "SyntaxMesh"
AppConfig.version = PORT_VERSION

$cases = []

def add(id, kind, spec, expected)
  $cases << { "id" => id, "kind" => kind,
              "spec" => spec.merge("tz" => ICALENDAR_TZ),
              "expected" => expected }
end

D0 = TjTime.new("2026-01-01")
D1 = TjTime.new("2026-01-08")

def new_ical(tag = "proj")
  ical = ICalendar.new(tag)
  ical.creationDate = D0
  ical.lastModified = D0
  ical
end

# ——— envelope ———

add("empty_doc", "document", { "components" => [] }, new_ical.to_s)

# ——— VTODO ———

add("todo_default", "component", { "type" => "VTODO", "percent" => -1 },
    (lambda do
       ical = new_ical("t1")
       todo = Todo.new(ical, ical.uid + "-task1", 'Task um', D0, D1)
       ical.to_s
     end).call)

add("todo_completed", "component", { "type" => "VTODO", "percent" => 100 },
    (lambda do
       ical = new_ical("t2")
       todo = Todo.new(ical, ical.uid + "-task2", 'Feita', D0, D1)
       todo.percentComplete = 100
       ical.to_s
     end).call)

add("todo_desc_escapes", "component", { "type" => "VTODO", "desc" => true },
    (lambda do
       ical = new_ical("t3")
       todo = Todo.new(ical, ical.uid + "-task3", 'Esc; ap,"s', D0, D1)
       todo.description = "line1\nline2; col, on \\ bar"
       todo.relatedTo = "other-uid-TODO"
       ical.to_s
     end).call)

add("todo_empty_description", "component",
    { "type" => "VTODO", "desc" => "" },
    (lambda do
       ical = new_ical("t4")
       todo = Todo.new(ical, ical.uid + "-task4", 'Vazia', D0, D1)
       todo.description = ''
       ical.to_s
     end).call)

add("todo_organizer_attendees", "component",
    { "type" => "VTODO", "people" => 3 },
    (lambda do
       ical = new_ical("t5")
       todo = Todo.new(ical, ical.uid + "-task5", 'Gente', D0, D1)
       todo.setOrganizer('Chefe', 'chefe@ex.com')
       todo.addAttendee('Ana', 'ana@ex.com')
       todo.addAttendee('Bob', 'bob@ex.com')
       ical.to_s
     end).call)

# ——— VEVENT ———

add("event_default", "component", { "type" => "VEVENT" },
    (lambda do
       ical = new_ical("e1")
       Event.new(ical, ical.uid + "-task10", 'Reunião', D0, D1)
       ical.to_s
     end).call)

# `event_priority` não é possível via API pública do Ruby: `Event` não tem
# `attr_accessor :priority` (só `Todo` tem — e o `priority` do `Todo` nem é
# serializado, esquisitice Category B replicada no port). O PRIORITY:1 fixo do
# Event já sai no `event_default`.

# ——— VJOURNAL ———

add("journal_basic", "component", { "type" => "VJOURNAL" },
    (lambda do
       ical = new_ical("j1")
       Journal.new(ical, ical.uid + "-task20", 'Nota 2026-01', D0)
       ical.to_s
     end).call)

# ——— foldLines ———

add("fold_ascii", "fold", { "summary" => "ASCII longo" },
    (lambda do
       ical = new_ical("f1")
       summary = 'X' * 90
       Todo.new(ical, ical.uid + "-task30", summary, D0, D1)
       ical.to_s
     end).call)

add("fold_utf8", "fold", { "summary" => "40x é (2 bytes cada)" },
    (lambda do
       ical = new_ical("f2")
       Todo.new(ical, ical.uid + "-task31", 'é' * 40, D0, D1)
       ical.to_s
     end).call)

# ——— documento misto: ordem todos → events → journals ———

add("mixed_order", "document",
    { "todos" => 2, "events" => 2, "journals" => 1 },
    (lambda do
       ical = new_ical("m1")
       # Cria intercalado para provar que a serialização reordena por tipo.
       Journal.new(ical, ical.uid + "-j0", 'J0', D0)
       Event.new(ical, ical.uid + "-e0", 'E0', D0, D1)
       Todo.new(ical, ical.uid + "-t0", 'T0', D0, D1)
       Todo.new(ical, ical.uid + "-t1", 'T1', D0, D1)
       Event.new(ical, ical.uid + "-e1", 'E1', D0, D1)
       ical.to_s
     end).call)

puts JSON.generate({ "cases" => $cases })
