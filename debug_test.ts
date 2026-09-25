import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase, type AttributeMode, } from "./packages/core/src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "./packages/core/src/attributes/attribute-definition.ts";
import { AttributeType, } from "./packages/core/src/attributes/attribute-type.ts";
import { type AttributeContainer, } from "./packages/core/src/attributes/attribute-container.ts";
import { type PropertyLike, } from "./packages/core/src/model/property-like.ts";
import { MockContainer, } from "./packages/core/tests/attributes/mock-container.ts";
import { StringAttribute, } from "./packages/core/src/attributes/scalar/string-attribute.ts";
import { IntegerAttribute, } from "./packages/core/src/attributes/scalar/integer-attribute.ts";
import { FloatAttribute, } from "./packages/core/src/attributes/scalar/float-attribute.ts";
import { BooleanAttribute, } from "./packages/core/src/attributes/scalar/boolean-attribute.ts";
import { SymbolAttribute, } from "./packages/core/src/attributes/scalar/symbol-attribute.ts";
import { DateAttribute, } from "./packages/core/src/attributes/scalar/date-attribute.ts";
import { DurationAttribute, } from "./packages/core/src/attributes/scalar/duration-attribute.ts";
import { PropertyAttribute, } from "./packages/core/src/attributes/reference/property-attribute.ts";
import { AccountAttribute, } from "./packages/core/src/attributes/reference/account-attribute.ts";
import { ReferenceAttribute, } from "./packages/core/src/attributes/reference/reference-attribute.ts";
import { FlagListAttribute, } from "./packages/core/src/attributes/list/flag-list-attribute.ts";
import { SymbolListAttribute, } from "./packages/core/src/attributes/list/symbol-list-attribute.ts";
import { ScenarioListAttribute, } from "./packages/core/src/attributes/list/scenario-list-attribute.ts";
import { NodeListAttribute, } from "./packages/core/src/attributes/list/node-list-attribute.ts";
import { ResourceListAttribute, } from "./packages/core/src/attributes/list/resource-list-attribute.ts";
import { TaskListAttribute, } from "./packages/core/src/attributes/list/task-list-attribute.ts";
import { DependencyListAttribute, } from "./packages/core/src/attributes/dependency/dependency-list-attribute.ts";
import { TaskDepListAttribute, } from "./packages/core/src/attributes/dependency/task-dep-list-attribute.ts";
import { ChargeListAttribute, } from "./packages/core/src/attributes/financial/charge-list-attribute.ts";
import { ChargeSetListAttribute, } from "./packages/core/src/attributes/financial/charge-set-list-attribute.ts";
import { AccountCreditListAttribute, } from "./packages/core/src/attributes/financial/account-credit-list-attribute.ts";
import { AllocationAttribute, } from "./packages/core/src/attributes/allocation/allocation-attribute.ts";
import { BookingListAttribute, } from "./packages/core/src/attributes/allocation/booking-list-attribute.ts";
import { LogicalExpressionAttribute, } from "./packages/core/src/attributes/logical/logical-expression-attribute.ts";
import { LogicalExpressionListAttribute, } from "./packages/core/src/attributes/logical/logical-expression-list-attribute.ts";
import { TimeIntervalListAttribute, } from "./packages/core/src/attributes/time-interval/time-interval-list-attribute.ts";
import { LeaveListAttribute, } from "./packages/core/src/attributes/time-interval/leave-list-attribute.ts";
import { LeaveAllowanceListAttribute, } from "./packages/core/src/attributes/time-interval/leave-allowance-list-attribute.ts";
import { LimitsAttribute, } from "./packages/core/src/attributes/time-interval/limits-attribute.ts";
import { ShiftAssignmentsAttribute, } from "./packages/core/src/attributes/time-interval/shift-assignments-attribute.ts";
import { WorkingHoursAttribute, } from "./packages/core/src/attributes/time-interval/working-hours-attribute.ts";
import { RealFormatAttribute, } from "./packages/core/src/attributes/format/real-format-attribute.ts";
import { ColumnListAttribute, } from "./packages/core/src/attributes/format/column-list-attribute.ts";
import { FormatListAttribute, } from "./packages/core/src/attributes/format/format-list-attribute.ts";
import { SortListAttribute, } from "./packages/core/src/attributes/format/sort-list-attribute.ts";
import { JournalSortListAttribute, } from "./packages/core/src/attributes/format/journal-sort-list-attribute.ts";
import { RichTextAttribute, } from "./packages/core/src/attributes/rich/rich-text-attribute.ts";
import { DefinitionListAttribute, } from "./packages/core/src/attributes/rich/definition-list-attribute.ts";

interface GoldenCase {
  description: string;
  method: string;
  type: string;
  input: { value: unknown } | null;
  expected: unknown;
  mode?: 0 | 1 | 2;
  inherit?: boolean;
}

interface GoldenFile {
  version: string;
  description: string;
  generated_at: string;
  cases: GoldenCase[];
}

function loadGoldenFile(): GoldenFile {
  const path = new URL("./packages/core/tests/golden/attributes.golden.json", import.meta.url,);
  const content = Deno.readTextFileSync(path,);
  return JSON.parse(content,) as GoldenFile;
}

function runCase(c: GoldenCase,): void {
  if (c.mode !== undefined) {
    AttributeBase.setMode(c.mode as AttributeMode,);
  }

  const container = new MockContainer();
  const property = { id: "test.attr", name: "Test Attr", };

  const attributeClass = getAttributeClass(c.type,) as new (
    property: PropertyLike,
    type: AttributeDefinition<unknown>,
    container: AttributeContainer,
  ) => AttributeBase<unknown>;

  const type = new AttributeDefinition(
    c.type.toLowerCase(),
    c.type,
    getAttributeType(c.type,),
    c.input?.value ?? null,
  );

  const attr = new attributeClass(property, type, container,);

  if (c.input?.value !== undefined) {
    attr.set(c.input.value as never,);
  }

  switch (c.method) {
    case "to_tjp":
      const actual = attr.to_tjp();
      console.log(`\n=== ${c.description} ===`);
      console.log(`Expected: ${JSON.stringify(c.expected)}`);
      console.log(`Actual:   ${JSON.stringify(actual)}`);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,);
      break;
    case "to_s":
      const actual_s = attr.to_s();
      console.log(`\n=== ${c.description} ===`);
      console.log(`Expected: ${JSON.stringify(c.expected)}`);
      console.log(`Actual:   ${JSON.stringify(actual_s)}`);
      assertEquals(
        actual_s,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,);
      break;
    case "to_tjp_mode":
      const actual_mode = attr.to_tjp();
      console.log(`\n=== ${c.description} ===`);
      console.log(`Expected: ${JSON.stringify(c.expected)}`);
      console.log(`Actual:   ${JSON.stringify(actual_mode)}`);
      assertEquals(
        actual_mode,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,);
      break;
    case "to_tjp_inherit":
      const actual_inherit = attr.to_tjp();
      console.log(`\n=== ${c.description} ===`);
      console.log(`Expected: ${JSON.stringify(c.expected)}`);
      console.log(`Actual:   ${JSON.stringify(actual_inherit)}`);
      assertEquals(
        actual_inherit,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,);
      break;
    case ":throws":
      assertThrows(
        () => {
          if (c.method === "to_tjp") {
            attr.to_tjp();
          } else if (c.method === "to_s") {
            attr.to_s();
          }
        },
        Error,
        `Golden case "${c.description}" should throw for method ${c.method}`,);
      break;
    default:
      throw new Error(`Unknown method in golden file: ${c.method}`);
  }
}

function getAttributeClass(type: string,): unknown {
  const typeMap: Record<string, unknown> = {
    "String": StringAttribute,
    "Integer": IntegerAttribute,
    "Float": FloatAttribute,
    "Boolean": BooleanAttribute,
    "Symbol": SymbolAttribute,
    "Date": DateAttribute,
    "Duration": DurationAttribute,
    "Property": PropertyAttribute,
    "Account": AccountAttribute,
    "Reference": ReferenceAttribute,
    "FlagList": FlagListAttribute,
    "SymbolList": SymbolListAttribute,
    "ScenarioList": ScenarioListAttribute,
    "NodeList": NodeListAttribute,
    "ResourceList": ResourceListAttribute,
    "TaskList": TaskListAttribute,
    "DependencyList": DependencyListAttribute,
    "TaskDepList": TaskDepListAttribute,
    "ChargeList": ChargeListAttribute,
    "ChargeSetList": ChargeSetListAttribute,
    "AccountCreditList": AccountCreditListAttribute,
    "Allocation": AllocationAttribute,
    "BookingList": BookingListAttribute,
    "LogicalExpression": LogicalExpressionAttribute,
    "LogicalExpressionList": LogicalExpressionListAttribute,
    "TimeIntervalList": TimeIntervalListAttribute,
    "LeaveList": LeaveListAttribute,
    "LeaveAllowanceList": LeaveAllowanceListAttribute,
    "Limits": LimitsAttribute,
    "ShiftAssignments": ShiftAssignmentsAttribute,
    "WorkingHours": WorkingHoursAttribute,
    "RealFormat": RealFormatAttribute,
    "ColumnList": ColumnListAttribute,
    "FormatList": FormatListAttribute,
    "SortList": SortListAttribute,
    "JournalSortList": JournalSortListAttribute,
    "RichText": RichTextAttribute,
    "DefinitionList": DefinitionListAttribute,
  };

  const cls = typeMap[type];
  if (!cls) {
    throw new Error(`Unknown attribute type: ${type}`);
  }
  return cls;
}

function getAttributeType(type: string,): AttributeType {
  const typeMap: Record<string, AttributeType> = {
    "String": AttributeType.String,
    "Integer": AttributeType.Integer,
    "Float": AttributeType.Float,
    "Boolean": AttributeType.Boolean,
    "Symbol": AttributeType.Symbol,
    "Date": AttributeType.Date,
    "Duration": AttributeType.Duration,
    "Property": AttributeType.Property,
    "Account": AttributeType.Account,
    "Reference": AttributeType.Reference,
    "FlagList": AttributeType.FlagList,
    "SymbolList": AttributeType.SymbolList,
    "ScenarioList": AttributeType.ScenarioList,
    "NodeList": AttributeType.NodeList,
    "ResourceList": AttributeType.ResourceList,
    "TaskList": AttributeType.TaskList,
    "DependencyList": AttributeType.DependencyList,
    "TaskDepList": AttributeType.TaskDepList,
    "ChargeList": AttributeType.ChargeList,
    "ChargeSetList": AttributeType.ChargeSetList,
    "AccountCreditList": AttributeType.AccountCreditList,
    "Allocation": AttributeType.Allocation,
    "BookingList": AttributeType.BookingList,
    "LogicalExpression": AttributeType.LogicalExpression,
    "LogicalExpressionList": AttributeType.LogicalExpressionList,
    "TimeIntervalList": AttributeType.TimeIntervalList,
    "LeaveList": AttributeType.LeaveList,
    "LeaveAllowanceList": AttributeType.LeaveAllowanceList,
    "Limits": AttributeType.Limits,
    "ShiftAssignments": AttributeType.ShiftAssignments,
    "WorkingHours": AttributeType.WorkingHours,
    "RealFormat": AttributeType.RealFormat,
    "ColumnList": AttributeType.ColumnList,
    "FormatList": AttributeType.FormatList,
    "SortList": AttributeType.SortList,
    "JournalSortList": AttributeType.JournalSortList,
    "RichText": AttributeType.RichText,
    "DefinitionList": AttributeType.DefinitionList,
  };

  const attrType = typeMap[type];
  if (!attrType) {
    throw new Error(`Unknown attribute type: ${type}`);
  }
  return attrType;
}

describe("Attribute golden tests", () => {
  const golden = loadGoldenFile();

  for (const c of golden.cases) {
    it(`${c.method}: ${c.description}`, () => {
      runCase(c,);
    });
  }
});