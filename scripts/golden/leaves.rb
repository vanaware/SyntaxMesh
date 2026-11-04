#!/usr/bin/env ruby
# frozen_string_literal: true
# encoding: UTF-8
#
# leaves.rb — golden de Leave/LeaveList/LeaveAllowanceList (Fase 16.19).
#
# Oracle: exercita `Leave::Types` (índice de cada tipo), `Leave#typeIdx`,
# `Leave#to_s` (com e sem motivo), a ordem de inserção da `LeaveList` e
# `LeaveAllowanceList#balance` (janela `[startDate, endDate)`, com provisões
# negativas de expiração e tipos misturados), além dos `ArgumentError` de
# tipo inválido.
#
# Serializa `{ cases: [ { description, method, input, expected, error } ] }`.
# `input` é reconstruível no TS:
#   typeIdx    { type }                                    → expected: número
#   to_s       { type, start, end, reason }                 → expected: string
#   order      { leaves: [ { type, start, end } ] }          → expected: [índices]
#   balance    { allowances: [ { type, date, slots } ],      → expected: número
#                type, start, end }
#   error      idem a `to_s`/`balance`, com `error` preenchido.
#
# Fuso UTC: `TjTime#to_s`/`Interval#to_s` embutem o offset na data; o golden
# fixa UTC e o teste TS chama `TjTime.setTimeZone("UTC")`.
#
# @see docs/taskjuggler/lib/taskjuggler/LeaveList.rb
# @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.19)

$LOAD_PATH.unshift(File.expand_path("../../docs/taskjuggler/lib", __dir__))
require "json"
require "taskjuggler/TaskJuggler"

TJ = TaskJuggler

TJ::TjTime.setTimeZone("UTC")

def tj(date)
  TJ::TjTime.new(date)
end

def interval(start_date, end_date)
  # `TimeInterval` (e não `Interval`): só ele define `to_s`; o parser do TJP
  # também produz `TimeInterval` para licenças (`Leave#to_s` interpola o
  # intervalo).
  TJ::TimeInterval.new(tj(start_date), tj(end_date))
end

$cases = []

# Registra um caso já calculado.
def add_case(desc, method, input, expected)
  $cases << {
    description: desc,
    method: method,
    input: input,
    expected: expected,
    error: nil
  }
end

# Registra um caso que deve levantar erro; guarda a mensagem.
def add_error_case(desc, method, input)
  yield
  raise "caso '#{desc}' deveria levantar erro"
rescue ArgumentError => e
  $cases << {
    description: desc,
    method: method,
    input: input,
    expected: nil,
    error: e.message
  }
end

# --- Leave::Types / typeIdx ---
TJ::Leave::Types.each do |type, idx|
  add_case("typeIdx de #{type} é #{idx}", "typeIdx", { type: type.to_s }, idx)
end

# --- Leave#to_s ---
add_case(
  "to_s sem motivo mantém os dois espaços do Ruby",
  "to_s",
  { type: "annual", start: "2026-01-05", end: "2026-01-06", reason: nil },
  TJ::Leave.new(:annual, interval("2026-01-05", "2026-01-06")).to_s
)
add_case(
  "to_s com motivo entre aspas",
  "to_s",
  { type: "sick", start: "2026-02-01", end: "2026-02-02", reason: "gripe" },
  TJ::Leave.new(:sick, interval("2026-02-01", "2026-02-02"), "gripe").to_s
)
add_case(
  "to_s de ausência de vários dias",
  "to_s",
  { type: "unpaid", start: "2026-03-01", end: "2026-03-11", reason: "licença" },
  TJ::Leave.new(:unpaid, interval("2026-03-01", "2026-03-11"), "licença").to_s
)

# --- LeaveList preserve a ordem de inserção ---
order_types = %w[holiday annual unemployed]
order_list = TJ::LeaveList.new
order_types.each do |type|
  order_list << TJ::Leave.new(type.to_sym, interval("2026-04-01", "2026-04-02"))
end
add_case(
  "LeaveList preserva a ordem de inserção",
  "order",
  {
    leaves: order_types.map do |type|
      { type: type, start: "2026-04-01", end: "2026-04-02" }
    end
  },
  order_list.map(&:typeIdx)
)

# --- LeaveAllowanceList#balance ---
# Provisões: 5 dias de férias em 01-01, -2 de expiração em 06-01,
# 3 dias de licença médica em 03-01 e 4 de banco de horas em 04-01.
allowances = TJ::LeaveAllowanceList.new
allowances << TJ::LeaveAllowance.new(:annual, tj("2026-01-01"), 5.0)
allowances << TJ::LeaveAllowance.new(:annual, tj("2026-06-01"), -2.0)
allowances << TJ::LeaveAllowance.new(:sick, tj("2026-03-01"), 3.0)
allowances << TJ::LeaveAllowance.new(:annual, tj("2026-04-01"), 4.0)

allowances_json = [
  { type: "annual", date: "2026-01-01", slots: 5.0 },
  { type: "annual", date: "2026-06-01", slots: -2.0 },
  { type: "sick", date: "2026-03-01", slots: 3.0 },
  { type: "annual", date: "2026-04-01", slots: 4.0 }
]

def balance_case(desc, allowances, allowances_json, type, start_date, end_date)
  add_case(
    desc,
    "balance",
    {
      allowances: allowances_json,
      type: type,
      start: start_date,
      end: end_date
    },
    allowances.balance(type.to_sym, tj(start_date), tj(end_date))
  )
end

balance_case("balance de annual no ano soma provisões e expiração",
             allowances, allowances_json, "annual", "2026-01-01", "2027-01-01")
balance_case("balance de sick no ano ignora outros tipos",
             allowances, allowances_json, "sick", "2026-01-01", "2027-01-01")
balance_case("balance de annual no 1º trimestre exclui a expiração de junho",
             allowances, allowances_json, "annual", "2026-01-01", "2026-04-01")
balance_case("balance de annual na janela [04-01, 05-01) inclui a data inicial",
             allowances, allowances_json, "annual", "2026-04-01", "2026-05-01")
balance_case("balance de annual na janela [01-01, 04-01) exclui a data final",
             allowances, allowances_json, "annual", "2026-01-01", "2026-04-01")
balance_case("balance de tipo sem provisões é 0",
             allowances, allowances_json, "holiday", "2026-01-01", "2027-01-01")

# --- Erros de tipo inválido ---
add_error_case(
  "Leave com tipo inválido levanta ArgumentError",
  "to_s",
  { type: "bogus", start: "2026-01-05", end: "2026-01-06", reason: nil }
) { TJ::Leave.new(:bogus, interval("2026-01-05", "2026-01-06")) }

add_error_case(
  "balance com tipo inválido levanta ArgumentError",
  "balance",
  {
    allowances: allowances_json,
    type: "bogus",
    start: "2026-01-01",
    end: "2027-01-01"
  }
) { allowances.balance(:bogus, tj("2026-01-01"), tj("2027-01-01")) }

puts({ cases: $cases }.to_json)
