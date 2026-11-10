/**
 * Enumerator of the TaskJuggler attribute types.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeDefinition.rb
 */

/**
 * Attribute types supported by TaskJuggler.
 *
 * Each type corresponds to a subclass in `Attributes.rb`.
 */
export enum AttributeType {
  // Scalars
  String = "string",
  Integer = "integer",
  Float = "number",
  Boolean = "boolean",
  Symbol = "symbol",
  Date = "date",
  Duration = "duration",

  // Reference
  Property = "property",
  Account = "account",
  Reference = "reference",

  // Primitive lists
  FlagList = "flaglist",
  SymbolList = "symbollist",
  ScenarioList = "scenarios",
  NodeList = "node",
  ResourceList = "resourcelist",
  TaskList = "tasklist",

  // Dependencies
  DependencyList = "dependencylist",
  TaskDepList = "taskdeplist",

  // Financial
  ChargeList = "charge",
  ChargeSetList = "chargeset",
  AccountCreditList = "credits",

  // Allocation and booking
  Allocation = "allocation",
  BookingList = "bookinglist",

  // Logical expressions
  LogicalExpression = "logicalexpressions",
  LogicalExpressionList = "logicalexpressionslist",

  // Complex time
  TimeIntervalList = "intervallist",
  LeaveList = "leave",
  LeaveAllowanceList = "leaveallowance",
  Limits = "limits",
  ShiftAssignments = "shifts",
  WorkingHours = "workinghours",

  // Formatting
  RealFormat = "realformat",
  ColumnList = "columns",
  FormatList = "formatlist",
  SortList = "sorting",
  JournalSortList = "journalsorting",

  // Rich content
  RichText = "richtext",
  /**
   * SyntaxMesh extension (ADR 039): `markdown` in `extend`. Same contract as
   * `RichText`; the dialect only matters for reprinting the declaration.
   */
  Markdown = "markdown",
  DefinitionList = "definitionlist",
}
