/**
 * Enumerador de tipos de atributos do TaskJuggler.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeDefinition.rb
 */

/**
 * Tipos de atributos suportados pelo TaskJuggler.
 *
 * Cada tipo corresponde a uma subclasse em `Attributes.rb`.
 */
export enum AttributeType {
  // Escalares
  String = "string",
  Integer = "integer",
  Float = "number",
  Boolean = "boolean",
  Symbol = "symbol",
  Date = "date",
  Duration = "duration",

  // Referência
  Property = "property",
  Account = "account",
  Reference = "reference",

  // Listas primitivas
  FlagList = "flaglist",
  SymbolList = "symbollist",
  ScenarioList = "scenarios",
  NodeList = "node",
  ResourceList = "resourcelist",
  TaskList = "tasklist",

  // Dependências
  DependencyList = "dependencylist",
  TaskDepList = "taskdeplist",

  // Financeiro
  ChargeList = "charge",
  ChargeSetList = "chargeset",
  AccountCreditList = "credits",

  // Alocação e booking
  Allocation = "allocation",
  BookingList = "bookinglist",

  // Expressões lógicas
  LogicalExpression = "logicalexpressions",
  LogicalExpressionList = "logicalexpressionslist",

  // Tempo complexo
  TimeIntervalList = "intervallist",
  LeaveList = "leave",
  LeaveAllowanceList = "leaveallowance",
  Limits = "limits",
  ShiftAssignments = "shifts",
  WorkingHours = "workinghours",

  // Formatação
  RealFormat = "realformat",
  ColumnList = "columns",
  FormatList = "formatlist",
  SortList = "sorting",
  JournalSortList = "journalsorting",

  // Ricos
  RichText = "richtext",
  DefinitionList = "definitionlist",
}