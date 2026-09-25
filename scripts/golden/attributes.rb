#!/usr/bin/env ruby
# frozen_string_literal: true

require "json"

$golden_cases = []

def tc(desc, method, type, input, expected, *args)
  h = {
    description: desc,
    method: method,
    type: type,
    input: input,
    expected: expected,
  }

  # Extract options from last argument if it's a hash
  if args.last.is_a?(Hash)
    opts = args.last
    h[:mode] = opts[:mode] if opts[:mode]
    h[:inherit] = opts[:inherit] if opts[:inherit]
  end

  $golden_cases << h
end

# --- StringAttribute ---
tc("StringAttribute to_tjp com texto simples",
   "to_tjp", "String",
   { value: "hello" }, "text \"hello\"")
tc("StringAttribute to_tjp com texto vazio",
   "to_tjp", "String",
   { value: "" }, "text \"\"")
tc("StringAttribute to_s com texto",
   "to_s", "String",
   { value: "hello" }, "hello")

# --- IntegerAttribute ---
tc("IntegerAttribute to_tjp com valor positivo",
   "to_tjp", "Integer",
   { value: 42 }, "integer 42")
tc("IntegerAttribute to_tjp com zero",
   "to_tjp", "Integer",
   { value: 0 }, "integer 0")
tc("IntegerAttribute to_s com valor",
   "to_s", "Integer",
   { value: 42 }, "42")

# --- FloatAttribute ---
tc("FloatAttribute to_tjp com valor",
   "to_tjp", "Float",
   { value: 3.14 }, "number 3.14")
tc("FloatAttribute to_s com valor",
   "to_s", "Float",
   { value: 3.14 }, "3.14")

# --- BooleanAttribute ---
tc("BooleanAttribute to_tjp com true",
   "to_tjp", "Boolean",
   { value: true }, "boolean yes")
tc("BooleanAttribute to_tjp com false",
   "to_tjp", "Boolean",
   { value: false }, "boolean no")
tc("BooleanAttribute to_s com true",
   "to_s", "Boolean",
   { value: true }, "yes")
tc("BooleanAttribute to_s com false",
   "to_s", "Boolean",
   { value: false }, "no")

# --- SymbolAttribute ---
tc("SymbolAttribute to_tjp com símbolo",
   "to_tjp", "Symbol",
   { value: "active" }, "symbol active")
tc("SymbolAttribute to_s com símbolo",
   "to_s", "Symbol",
   { value: "active" }, "active")

# --- DateAttribute ---
tc("DateAttribute to_tjp com data",
   "to_tjp", "Date",
   { value: "2026-01-15" }, "date 2026-01-15")
tc("DateAttribute to_s com data",
   "to_s", "Date",
   { value: "2026-01-15" }, "2026-01-15")

# --- DurationAttribute ---
tc("DurationAttribute to_tjp com duração",
   "to_tjp", "Duration",
   { value: 3600 }, "duration 1h")
tc("DurationAttribute to_s com duração",
   "to_s", "Duration",
   { value: 3600 }, "1h")

# --- FlagListAttribute ---
tc("FlagListAttribute to_tjp com flags",
   "to_tjp", "FlagList",
   { value: ["a", "b"] }, "flags a, b")
tc("FlagListAttribute to_s com flags",
   "to_s", "FlagList",
   { value: ["a", "b"] }, "a, b")

# --- SymbolListAttribute ---
tc("SymbolListAttribute to_tjp com símbolos",
   "to_tjp", "SymbolList",
   { value: ["x", "y"] }, "symbollist x, y")
tc("SymbolListAttribute to_s com símbolos",
   "to_s", "SymbolList",
   { value: ["x", "y"] }, "x, y")

# --- ScenarioListAttribute ---
tc("ScenarioListAttribute to_tjp com cenários",
   "to_tjp", "ScenarioList",
   { value: ["s1", "s2"] }, "scenarios s1, s2")
tc("ScenarioListAttribute to_s com cenários",
   "to_s", "ScenarioList",
   { value: ["s1", "s2"] }, "s1, s2")

# --- ResourceListAttribute ---
tc("ResourceListAttribute to_tjp com recursos",
   "to_tjp", "ResourceList",
   { value: [{ fullId: "r1" }, { fullId: "r2" }] }, "resourcelist r1, r2")
tc("ResourceListAttribute to_s com recursos",
   "to_s", "ResourceList",
   { value: [{ fullId: "r1" }, { fullId: "r2" }] }, "r1, r2")

# --- TaskListAttribute ---
tc("TaskListAttribute to_tjp com tarefas",
   "to_tjp", "TaskList",
   { value: [{ fullId: "t1" }, { fullId: "t2" }] }, "tasklist t1, t2")
tc("TaskListAttribute to_s com tarefas",
   "to_s", "TaskList",
   { value: [{ fullId: "t1" }, { fullId: "t2" }] }, "t1, t2")

# --- DependencyListAttribute ---
tc("DependencyListAttribute to_tjp com dependências",
   "to_tjp", "DependencyList",
   { value: [{ task: { fullId: "d1" } }] }, "dependencylist d1")
tc("DependencyListAttribute to_s com dependências",
   "to_s", "DependencyList",
   { value: [{ task: { fullId: "d1" } }] }, "d1")

# --- TaskDepListAttribute ---
tc("TaskDepListAttribute to_tjp com dependências",
   "to_tjp", "TaskDepList",
   { value: [[{ fullId: "t1" }, { fullId: "d1" }]] }, "taskdeplist t1 d1")
tc("TaskDepListAttribute to_s com dependências",
   "to_s", "TaskDepList",
   { value: [[{ fullId: "t1" }, { fullId: "d1" }]] }, "t1 d1")

# --- ChargeListAttribute ---
tc("ChargeListAttribute to_tjp com charges",
   "to_tjp", "ChargeList",
   { value: [{ amount: 100 }] }, "charge 100")
tc("ChargeListAttribute to_s com charges",
   "to_s", "ChargeList",
   { value: [{ amount: 100 }] }, "100")

# --- ChargeSetListAttribute ---
tc("ChargeSetListAttribute to_tjp com chargeSet",
   "to_tjp", "ChargeSetList",
   { value: [{ to_s: -> { "cs1" } }] }, "chargeset cs1")
tc("ChargeSetListAttribute to_s com chargeSet",
   "to_s", "ChargeSetList",
   { value: [{ to_s: -> { "cs1" } }] }, "cs1")

# --- AccountCreditListAttribute ---
tc("AccountCreditListAttribute to_tjp com credits",
   "to_tjp", "AccountCreditList",
   { value: [{ amount: 50 }] }, "credits 50")
tc("AccountCreditListAttribute to_s com credits",
   "to_s", "AccountCreditList",
   { value: [{ amount: 50 }] }, "50")

# --- AllocationAttribute ---
tc("AllocationAttribute to_tjp com alocação",
   "to_tjp", "Allocation",
   { value: { mode: 0, mandatory: true, persistent: false } }, "allocation")
tc("AllocationAttribute to_s com alocação",
   "to_s", "Allocation",
   { value: { mode: 0, mandatory: true, persistent: false } }, "TODO")

# --- BookingListAttribute ---
tc("BookingListAttribute to_tjp lança",
   "to_tjp", "BookingList",
   { value: [{ booking: "b1" }] }, :throws)
tc("BookingListAttribute to_s com booking",
   "to_s", "BookingList",
   { value: [{ booking: "b1" }] }, "TODO")

# --- LogicalExpressionAttribute ---
tc("LogicalExpressionAttribute to_tjp lança",
   "to_tjp", "LogicalExpression",
   { value: "expr" }, :throws)
tc("LogicalExpressionAttribute to_s com expr",
   "to_s", "LogicalExpression",
   { value: "expr" }, "TODO")

# --- LogicalExpressionListAttribute ---
tc("LogicalExpressionListAttribute to_tjp lança",
   "to_tjp", "LogicalExpressionList",
   { value: ["expr1"] }, :throws)
tc("LogicalExpressionListAttribute to_s com expr",
   "to_s", "LogicalExpressionList",
   { value: ["expr1"] }, "expr1")

# --- TimeIntervalListAttribute ---
tc("TimeIntervalListAttribute to_tjp com intervalos",
   "to_tjp", "TimeIntervalList",
   { value: [{ to_s: -> { "1h-2h" } }, { to_s: -> { "3h-4h" } }] }, "intervallist 1h-2h, 3h-4h")
tc("TimeIntervalListAttribute to_s com intervalos",
   "to_s", "TimeIntervalList",
   { value: [{ to_s: -> { "1h-2h" } }, { to_s: -> { "3h-4h" } }] }, "1h-2h, 3h-4h")

# --- LeaveListAttribute ---
tc("LeaveListAttribute to_tjp com feriados",
   "to_tjp", "LeaveList",
   { value: ["2026-01-01", "2026-02-01"] }, "leaves 2026-01-01,\n2026-02-01")
tc("LeaveListAttribute to_s com feriados",
   "to_s", "LeaveList",
   { value: ["2026-01-01", "2026-02-01"] }, "2026-01-01, 2026-02-01")

# --- LeaveAllowanceListAttribute ---
tc("LeaveAllowanceListAttribute to_tjp lança",
   "to_tjp", "LeaveAllowanceList",
   { value: ["la1"] }, :throws)
tc("LeaveAllowanceListAttribute to_s com allowance",
   "to_s", "LeaveAllowanceList",
   { value: ["la1"] }, "la1")

# --- LimitsAttribute ---
tc("LimitsAttribute to_tjp lança NotYetImplementedError",
   "to_tjp", "Limits",
   { value: nil }, :throws)
tc("LimitsAttribute to_s lança",
   "to_s", "Limits",
   { value: nil }, :throws)

# --- ShiftAssignmentsAttribute ---
tc("ShiftAssignmentsAttribute to_tjp com atribuições",
   "to_tjp", "ShiftAssignments",
   { value: { assignments: [{ shiftScenario: { property: { fullId: "shift1" } }, interval: "1h-2h" }] } }, "shifts shift1 1h-2h")
tc("ShiftAssignmentsAttribute to_s com atribuições",
   "to_s", "ShiftAssignments",
   { value: { assignments: [{ shiftScenario: { property: { fullId: "shift1" } }, interval: "1h-2h" }] } }, "shift1 1h-2h")

# --- WorkingHoursAttribute ---
tc("WorkingHoursAttribute to_tjp com horários",
   "to_tjp", "WorkingHours",
   { value: { getWorkingHours: ->(day) { day == 0 ? [[0, 3600]] : [] } } }, "workinghours sun 1:00 - 2:00\nworkinghours mon off\nworkinghours tue off\nworkinghours wed off\nworkinghours thu off\nworkinghours fri off\nworkinghours sat off")
tc("WorkingHoursAttribute to_s com horários",
   "to_s", "WorkingHours",
   { value: { getWorkingHours: ->(day) { day == 0 ? [[0, 3600]] : [] } } }, "sun 1:00 - 2:00")

# --- RealFormatAttribute ---
tc("RealFormatAttribute to_tjp com formato",
   "to_tjp", "RealFormat",
   { value: "0.00" }, "realformat 0.00")
tc("RealFormatAttribute to_s com formato",
   "to_s", "RealFormat",
   { value: "0.00" }, "0.00")

# --- ColumnListAttribute ---
tc("ColumnListAttribute to_tjp com colunas",
   "to_tjp", "ColumnList",
   { value: ["col1", "col2"] }, "columns col1, col2")
tc("ColumnListAttribute to_s com colunas",
   "to_s", "ColumnList",
   { value: ["col1", "col2"] }, "TODO")

# --- FormatListAttribute ---
tc("FormatListAttribute to_tjp com formatos",
   "to_tjp", "FormatList",
   { value: ["pdf", "html"] }, "formatlist pdf, html")
tc("FormatListAttribute to_s com formatos",
   "to_s", "FormatList",
   { value: ["pdf", "html"] }, "pdf, html")

# --- SortListAttribute ---
tc("SortListAttribute to_tjp com sorting",
   "to_tjp", "SortList",
   { value: ["name"] }, "sorting name")
tc("SortListAttribute to_s com sorting",
   "to_s", "SortList",
   { value: ["name"] }, "name")

# --- JournalSortListAttribute ---
tc("JournalSortListAttribute to_tjp com journalSorting",
   "to_tjp", "JournalSortList",
   { value: ["journal1"] }, "journalsorting journal1")
tc("JournalSortListAttribute to_s com journalSorting",
   "to_s", "JournalSortList",
   { value: ["journal1"] }, "journal1")

# --- RichTextAttribute ---
tc("RichTextAttribute to_tjp com richText",
   "to_tjp", "RichText",
   { value: { richText: { inputText: "hello" }, to_s: -> { "hello" } } }, "richtext \"hello\"")
tc("RichTextAttribute to_s com richText",
   "to_s", "RichText",
   { value: { richText: { inputText: "hello" }, to_s: -> { "hello" } } }, "hello")

# --- DefinitionListAttribute ---
tc("DefinitionListAttribute to_tjp com definitions",
   "to_tjp", "DefinitionList",
   { value: ["def1", "def2"] }, "definitionlist def1, def2")
tc("DefinitionListAttribute to_s com definitions",
   "to_s", "DefinitionList",
   { value: ["def1", "def2"] }, "def1, def2")

# --- Mode tests ---
tc("mode 0 (provided) — StringAttribute",
   "to_tjp_mode", "String",
   { value: "test", mode: 0 }, "text \"test\"")
tc("mode 1 (inherited) — StringAttribute",
   "to_tjp_mode", "String",
   { value: "test", mode: 1 }, "text \"test\"")
tc("mode 2 (computed) — StringAttribute",
   "to_tjp_mode", "String",
   { value: "test", mode: 2 }, "text \"test\"")

# --- Inherit test ---
tc("inherit — StringAttribute herda valor",
   "to_tjp_inherit", "String",
   { value: "inherited", inherit: true }, "text \"inherited\"")

# Generate the JSON output
output = {
  version: "1.0",
  description: "Golden test cases for Attribute attributes (Phase 3)",
  generated_at: Time.now.utc.to_s,
  cases: $golden_cases,
}

puts JSON.pretty_generate(output)
