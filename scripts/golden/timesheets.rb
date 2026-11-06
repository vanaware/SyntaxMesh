#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# timesheets.rb — golden de time sheets (Fase 18.15).
#
# Oracle: sobe um projeto real com o tj3 (parse + schedule), monta folhas de
# ponto (`TimeSheet` + `TimeSheetRecord`) a partir de um spec JSON e roda ou
# `TimeSheet#check` ou `TimeSheet#warnOnDelta`, serializando **duas** coisas:
#
#   expected.messages — as mensagens do MessageHandler (id + texto), que é o
#                       contrato observável das duas operações;
#   expected.sheets   — o estado da folha (total de slots, records, `work`,
#                       `remaining`, `expectedEnd` e o status), para o port
#                       provar que interpretou o spec igual ao Ruby.
#
# O `work` do spec é declarado em **dias** (`workDays`) ou em **percentual**
# (`workPercent`) e convertido pelos helpers do próprio `TimeSheet`
# (`daysToSlots`/`percentToSlots`) nos dois lados — nenhum número de slots é
# hard-coded no golden.
#
# Fixture (espelhada em `timesheet_golden_test.ts`, o mesmo TJP do
# `tests/timesheet/fixture.ts`):
#   projeto prj, 2026-01-01..2026-12-31, now 2026-01-01, workinghours mon-fri
#   9:00-17:00, cenário `plan` como tracking scenario
#   recursos dev (eficiência 1) e idle (efficiency 0)
#   tasks    effortTask (effort 10d, allocate dev)
#            durationTask (start 2026-02-02, duration 3d, allocate dev)
#
# Divergência documentada (lado TS): `ts_res_end_delta` interpola a data do
# fim esperado; o Ruby usa `TjTime#to_s` sem formato (`2026-02-10-00:00-+0000`)
# e o port usa `toString()` (`2026-02-10`). O teste normaliza datas nas
# mensagens dos dois lados (`@@DATE@@`); o resto do texto é comparado
# integralmente.
#
# Serializa `{ cases: [ { description, kind, sheets, expected } ] }`.
#
# @see docs/taskjuggler/lib/taskjuggler/TimeSheets.rb
# @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.15)
$LOAD_PATH.unshift(File.expand_path('../../docs/taskjuggler/lib', __dir__))
require 'json'
require 'tempfile'
require 'taskjuggler/TaskJuggler'

TJ = TaskJuggler

TJ::TjTime.setTimeZone('UTC')
ENV['TASKJUGGLER_DATA_PATH'] =
  File.expand_path('../../docs/taskjuggler', __dir__) + ':'

DATE = '%Y-%m-%d'

FIXTURE = <<~TJP
  project prj "Time Sheet Test" "1.0" 2026-01-01 - 2026-12-31 {
    timezone "UTC"
    timeformat "%Y-%m-%d"
    now 2026-01-01
    workinghours mon - fri 9:00 - 17:00
    scenario plan "Plan" {
    }
    trackingscenario plan
  }

  resource dev "Developer"
  resource idle "Idle Resource" {
    efficiency 0
  }

  task effortTask "Effort Task" {
    effort 10d
    allocate dev
  }

  task durationTask "Duration Task" {
    start 2026-02-02
    duration 3d
    allocate dev
  }
TJP

# O port é não-fatal: `error(...)` só acumula a mensagem e o delta de
# `errors` sinaliza a falha. O `MessageHandler` do Ruby, com `trapSetup`,
# levanta `TjRuntimeError` no **primeiro** erro e aborta o resto do `check`.
# Como o golden compara a lista completa de mensagens, desarmamos o raise
# (o contador de erros continua sendo incrementado normalmente).
module NonFatalErrors
  def addMessage(type, id, message, sfi = nil, line = nil, data = nil,
                 scenario = nil)
    super
  rescue TJ::TjRuntimeError
    nil
  end
end

TJ::MessageHandlerInstance.prepend(NonFatalErrors)

def date(str)
  TJ::TjTime.new(str)
end

def richtext(markup)
  TJ::RichText.new(markup).generateIntermediateFormat
end

# Zera o handler para um cenário isolado. `reset` zera `outputLevel` e
# **limpa** o hash de `trapSetup` (por isso ele é rearmado aqui, senão o
# primeiro `error(...)` chamaria `exit 1` em vez de contar).
def reset_handler
  mh = TJ::MessageHandlerInstance.instance
  mh.reset
  mh.outputLevel = :none
  mh.trapSetup = true
  mh
end

# Sobe o projeto da fixture uma única vez: as duas operações exercitadas
# (`check` e `warnOnDelta`) só leem o cenário agendado.
def build_project
  file = Tempfile.new(['timesheets', '.tjp'])
  file.write(FIXTURE)
  file.close

  reset_handler

  tj = TJ.new
  raise 'parse da fixture falhou' unless tj.parse([file.path])
  raise 'schedule da fixture falhou' unless tj.schedule

  tj.project
ensure
  file&.unlink
end

PROJECT = build_project

# Valor de `work` do spec: dias (`workDays`) ou percentual (`workPercent`),
# convertidos pelos helpers do próprio `TimeSheet`.
def work_value(sheet, spec)
  if spec.key?('workPercent')
    sheet.percentToSlots(spec['workPercent'] / 100.0)
  else
    sheet.daysToSlots(spec['workDays'])
  end
end

# `JournalEntry` de status: alertLevel numérico + summary/details opcionais.
def build_status(sheet, target, spec)
  property = target.is_a?(TJ::Task) ? target : sheet.resource
  entry = TJ::JournalEntry.new(PROJECT['journal'], sheet.interval.end,
                               spec['headline'] || '', property)
  entry.alertLevel = spec['alertLevel'] || 0
  entry.summary = richtext(spec['summary']) if spec['summary']
  entry.details = richtext(spec['details']) if spec['details']
  entry
end

# Reconstrói uma `TimeSheet` a partir do spec do golden.
def build_sheet(spec)
  resource = PROJECT.resource(spec['resource'])
  interval = TJ::TimeInterval.new(date(spec['start']), date(spec['end']))
  sheet = TJ::TimeSheet.new(resource, interval, spec['scenarioIdx'] || 0)

  spec['records'].each do |rec|
    # `newtask` cria um registro apontando para um id que ainda não existe.
    target = rec['newtask'] || PROJECT.task(rec['task'])
    record = TJ::TimeSheetRecord.new(sheet, target)
    record.name = rec['name'] if rec['name']
    record.work = work_value(sheet, rec) if rec.key?('workDays') ||
                                           rec.key?('workPercent')
    record.remaining = sheet.daysToSlots(rec['remainingDays']) if
      rec.key?('remainingDays')
    record.expectedEnd = date(rec['expectedEnd']) if rec['expectedEnd']
    record.status = build_status(sheet, target, rec['status']) if
      rec['status']
  end
  sheet
end

# Estado observável da folha (o port precisa reproduzir isto byte a byte).
def snapshot(sheet)
  # `@records` também é ivar puro no Ruby (`def <<` é o único acesso).
  records = sheet.instance_variable_get(:@records)
  {
    'resource' => sheet.resource.id,
    'start' => sheet.interval.start.to_s(DATE),
    'end' => sheet.interval.end.to_s(DATE),
    # `@percentageUsed` não tem `attr_reader` no Ruby (só os helpers o usam).
    'percentageUsed' => sheet.instance_variable_get(:@percentageUsed),
    'totalSlots' => records.sum { |r| r.work.to_i },
    'records' => records.map do |r|
      {
        'task' => r.task.is_a?(TJ::Task) ? r.task.fullId : r.task,
        'work' => r.work,
        'remaining' => r.remaining,
        'expectedEnd' => r.expectedEnd && r.expectedEnd.to_s(DATE),
        'status' => r.status && {
          'alertLevel' => r.status.alertLevel,
          'headline' => r.status.headline
        }
      }
    end
  }
end

$cases = []

# Registra um caso: monta as folhas, roda a operação e guarda o resultado.
def tc(desc, kind:, sheets:)
  mh = reset_handler

  built = sheets.map { |spec| build_sheet(spec) }
  built.each { |sheet| kind == 'check' ? sheet.check : sheet.warnOnDelta }

  messages = mh.messages.map do |m|
    { 'type' => m.type.to_s, 'id' => m.id, 'message' => m.message }
  end

  $cases << {
    'description' => desc,
    'kind' => kind,
    'sheets' => sheets,
    'expected' => {
      'messages' => messages,
      'sheets' => built.map { |sheet| snapshot(sheet) }
    }
  }
end

# ---------------------------------------------------------------------------
# Specs reaproveitados
# ---------------------------------------------------------------------------

# Janela de 28 dias a partir de 2026-01-01: 160 slots (20 dias úteis).
JAN = { 'resource' => 'dev', 'start' => '2026-01-01', 'end' => '2026-01-29' }.freeze

# Status verde típico de um registro completo.
GREEN = { 'alertLevel' => 0, 'headline' => 'Progresso normal' }.freeze

def sheet(records, overrides = {})
  [JAN.merge(overrides).merge('records' => records)]
end

# ---------------------------------------------------------------------------
# TimeSheet#check
# ---------------------------------------------------------------------------

tc('folha completa e coerente passa sem mensagens',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 20,
                    'remainingDays' => 0, 'status' => GREEN }]))

tc('work declarado em percentual usa percentToSlots e marca percentageUsed',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workPercent' => 100,
                    'remainingDays' => 0,
                    'status' => GREEN }]))

tc('tarefa de esforço sem remaining dispara ts_no_remaining',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 20,
                    'status' => GREEN }]))

tc('tarefa de duração sem end esperado dispara ts_no_expected_end',
   kind: 'check',
   sheets: sheet([{ 'task' => 'durationTask', 'workDays' => 20,
                    'status' => GREEN }]))

tc('trabalho de um dia ou mais sem status dispara ts_no_status_work',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 20,
                    'remainingDays' => 0 }]))

tc('status com headline vazia dispara ts_no_headline',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 20,
                    'remainingDays' => 0,
                    'status' => { 'alertLevel' => 0, 'headline' => '' } }]))

tc('status com o summary default dispara ts_default_summary',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 20,
                    'remainingDays' => 0,
                    'status' => { 'alertLevel' => 0, 'headline' => 'Ok',
                                   'summary' => "A summary text\n" } }]))

tc('alerta elevado sem summary nem details dispara ts_alert1_more_details',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 20,
                    'remainingDays' => 0,
                    'status' => { 'alertLevel' => 1, 'headline' => 'Atrasado' } }]))

tc('alerta alto sem details dispara ts_alert2_more_details',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 20,
                    'remainingDays' => 0,
                    'status' => { 'alertLevel' => 2, 'headline' => 'Crítico',
                                   'summary' => 'Resumo' } }]))

tc('alerta 1 com summary e alerta 2 com details passam',
   kind: 'check',
   sheets: sheet([
                    { 'task' => 'effortTask', 'workDays' => 20,
                      'remainingDays' => 0,
                      'status' => { 'alertLevel' => 1, 'headline' => 'Atrasado',
                                    'summary' => 'Resumo' } },
                    { 'task' => 'durationTask', 'workDays' => 0,
                      'expectedEnd' => '2026-02-04',
                      'status' => { 'alertLevel' => 2, 'headline' => 'Crítico',
                                    'summary' => 'Resumo',
                                    'details' => 'Detalhes' } }
                  ]))

tc('total reportado abaixo do período dispara ts_work_too_low',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 4,
                    'remainingDays' => 40, 'status' => GREEN }]))

tc('total reportado acima do período dispara ts_work_too_high',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 30,
                    'remainingDays' => 0, 'status' => GREEN }]))

tc('recurso sem horas de trabalho reportando esforço dispara ts_work_not_null',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 4,
                    'remainingDays' => 40, 'status' => GREEN }],
                 { 'resource' => 'idle' }))

tc('newtask sem remaining nem end dispara ts_no_rem_or_end',
   kind: 'check',
   sheets: sheet([{ 'newtask' => 'nt1', 'name' => 'Tarefa nova',
                    'workDays' => 4 }]))

tc('duas folhas são checadas de forma independente',
   kind: 'check',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 20,
                    'remainingDays' => 0, 'status' => GREEN }]) +
           sheet([{ 'task' => 'effortTask', 'workDays' => 4,
                    'remainingDays' => 40, 'status' => GREEN }]))

# ---------------------------------------------------------------------------
# TimeSheet#warnOnDelta
# ---------------------------------------------------------------------------

tc('trabalho e remaining abaixo do plano disparam os dois deltas',
   kind: 'warnOnDelta',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 4,
                    'remainingDays' => 40 }]))

tc('trabalho acima do plano dispara ts_res_work_delta',
   kind: 'warnOnDelta',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 20,
                    'remainingDays' => 0 }]))

tc('remaining diferente do plano dispara ts_res_remain_delta',
   kind: 'warnOnDelta',
   sheets: sheet([{ 'task' => 'effortTask', 'workDays' => 10,
                    'remainingDays' => 5 }]))

tc('tarefa de duração com end posterior ao plano dispara ts_res_end_delta',
   kind: 'warnOnDelta',
   sheets: sheet([{ 'task' => 'durationTask', 'workDays' => 0,
                    'expectedEnd' => '2026-02-10' }]))

tc('tarefa de duração com o end do plano não gera mensagem de end',
   kind: 'warnOnDelta',
   sheets: sheet([{ 'task' => 'durationTask', 'workDays' => 0,
                    'expectedEnd' => '2026-02-05' }]))

tc('newtask gera ts_res_new_task com o effort restante',
   kind: 'warnOnDelta',
   sheets: sheet([{ 'newtask' => 'nt1', 'name' => 'Tarefa nova',
                    'workDays' => 4, 'remainingDays' => 6 }]))

tc('registro pessoal (sem tarefa) é ignorado pelo warnOnDelta',
   kind: 'warnOnDelta',
   sheets: sheet([{ 'workDays' => 20, 'remainingDays' => 0 }]))

puts({ 'cases' => $cases }.to_json)
