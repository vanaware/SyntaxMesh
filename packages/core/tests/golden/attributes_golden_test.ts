import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase, type AttributeMode, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { type AttributeContainer, } from "../../src/attributes/attribute-container.ts";
import { type PropertyLike, } from "../../src/model/property-like.ts";
import { MockContainer, } from "../attributes/mock-container.ts";
import { StringAttribute, } from "../../src/attributes/scalar/string-attribute.ts";
import { IntegerAttribute, } from "../../src/attributes/scalar/integer-attribute.ts";
import { FloatAttribute, } from "../../src/attributes/scalar/float-attribute.ts";
import { BooleanAttribute, } from "../../src/attributes/scalar/boolean-attribute.ts";
import { SymbolAttribute, } from "../../src/attributes/scalar/symbol-attribute.ts";
import { DateAttribute, } from "../../src/attributes/scalar/date-attribute.ts";
import { DurationAttribute, } from "../../src/attributes/scalar/duration-attribute.ts";
import { PropertyAttribute, } from "../../src/attributes/reference/property-attribute.ts";
import { AccountAttribute, } from "../../src/attributes/reference/account-attribute.ts";
import { ReferenceAttribute, } from "../../src/attributes/reference/reference-attribute.ts";
import { FlagListAttribute, } from "../../src/attributes/list/flag-list-attribute.ts";
import { SymbolListAttribute, } from "../../src/attributes/list/symbol-list-attribute.ts";
import { ScenarioListAttribute, } from "../../src/attributes/list/scenario-list-attribute.ts";
import { NodeListAttribute, } from "../../src/attributes/list/node-list-attribute.ts";
import { ResourceListAttribute, } from "../../src/attributes/list/resource-list-attribute.ts";
import { TaskListAttribute, } from "../../src/attributes/list/task-list-attribute.ts";
import { DependencyListAttribute, } from "../../src/attributes/dependency/dependency-list-attribute.ts";
import { TaskDepListAttribute, } from "../../src/attributes/dependency/task-dep-list-attribute.ts";
import { ChargeListAttribute, } from "../../src/attributes/financial/charge-list-attribute.ts";
import { ChargeSetListAttribute, } from "../../src/attributes/financial/charge-set-list-attribute.ts";
import { AccountCreditListAttribute, } from "../../src/attributes/financial/account-credit-list-attribute.ts";
import { AllocationAttribute, } from "../../src/attributes/allocation/allocation-attribute.ts";
import { BookingListAttribute, } from "../../src/attributes/allocation/booking-list-attribute.ts";
import { LogicalExpressionAttribute, } from "../../src/attributes/logical/logical-expression-attribute.ts";
import { LogicalExpressionListAttribute, } from "../../src/attributes/logical/logical-expression-list-attribute.ts";
import { TimeIntervalListAttribute, } from "../../src/attributes/time-interval/time-interval-list-attribute.ts";
import { LeaveListAttribute, } from "../../src/attributes/time-interval/leave-list-attribute.ts";
import { LeaveAllowanceListAttribute, } from "../../src/attributes/time-interval/leave-allowance-list-attribute.ts";
import { LimitsAttribute, } from "../../src/attributes/time-interval/limits-attribute.ts";
import { ShiftAssignmentsAttribute, } from "../../src/attributes/time-interval/shift-assignments-attribute.ts";
import { WorkingHoursAttribute, } from "../../src/attributes/time-interval/working-hours-attribute.ts";
import { RealFormatAttribute, } from "../../src/attributes/format/real-format-attribute.ts";
import { ColumnListAttribute, } from "../../src/attributes/format/column-list-attribute.ts";
import { FormatListAttribute, } from "../../src/attributes/format/format-list-attribute.ts";
import { SortListAttribute, } from "../../src/attributes/format/sort-list-attribute.ts";
import { JournalSortListAttribute, } from "../../src/attributes/format/journal-sort-list-attribute.ts";
import { RichTextAttribute, } from "../../src/attributes/rich/rich-text-attribute.ts";
import { DefinitionListAttribute, } from "../../src/attributes/rich/definition-list-attribute.ts";

/**
 * Golden test runner for Attribute compatibility cases.
 *
 * Reads cases from `attributes.golden.json` and executes each case against the
 * current Attribute implementations, comparing the actual output to the
 * expected value recorded in the golden file.
 */

interface GoldenCase {
  description: string;
  method: string;
  type: string;
  input: { value: unknown; mode?: 0 | 1 | 2; inherit?: boolean } | null;
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
  // Read the golden file relative to this test file's directory
  const path = new URL("./attributes.golden.json", import.meta.url,);
  const content = Deno.readTextFileSync(path,);
  const data = JSON.parse(content,) as GoldenFile;
  // Rehydrate proc markers so values behave like the Ruby objects that
  // produced the golden contract. JSON loses prototypes and functions, so
  // markers such as `to_s` and `getWorkingHours` are restored as callables.
  for (const c of data.cases) {
    if (c.input?.value) {
      c.input.value = rehydrate(c.input.value,) as never;
    }
  }
  return data;
}

/**
 * Rehydrates a value, restoring `to_s`/`getWorkingHours` proc markers into
 * callable functions so attribute implementations can invoke them.
 */
function rehydrate(value: unknown,): unknown {
  if (Array.isArray(value,)) {
    return value.map((v,) => rehydrate(v,),);
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj,)) {
      out[k] = rehydrate(v,);
    }
    if (typeof out.to_s === "string" && out.to_s.startsWith("#<Proc")) {
      const marker = out.to_s as string;
      const match = marker.match(/#<Proc:0x[0-9a-f]+ scripts\/golden\/attributes\.rb:(\d+) \(lambda\)>/,);
      const line = match ? Number.parseInt(match[1] ?? "", 10) : 0;
      out.to_s = () => procTo_s(line,);
    }
    if (typeof out.getWorkingHours === "string" && out.getWorkingHours.startsWith("#<Proc")) {
      out.getWorkingHours = (day: number,) => procGetWorkingHours(day,);
    }
    return out;
  }
  return value;
}

/**
 * Maps a proc marker line from `scripts/golden/attributes.rb` to the string
 * that the corresponding lambda returns.
 */
function procTo_s(line: number,): string {
  switch (line) {
    case 162:
      return "cs1";
    case 165:
      return "cs1";
    case 210:
      return "1h-2h";
    case 213:
      return "3h-4h";
    case 298:
      return "hello";
    case 301:
      return "hello";
    default:
      return "";
  }
}

/**
 * Maps the working-hours proc marker to its interval array.
 */
function procGetWorkingHours(day: number,): [number, number][] {
  return day === 0 ? [[0, 3600]] : [];
}

function runCase(c: GoldenCase,): void {
  // Set mode if specified (from input.value.mode for mode tests)
  if (c.input?.mode !== undefined) {
    AttributeBase.setMode(c.input.mode as AttributeMode,);
  }

  // Create container and property
  const container = new MockContainer();
  const property = { id: "test.attr", name: "Test Attr", };

  // Get the attribute class based on type
  const attributeClass = getAttributeClass(c.type,) as new (
    property: PropertyLike,
    type: AttributeDefinition<unknown>,
    container: AttributeContainer,
  ) => AttributeBase<unknown>;

  // Create attribute definition
  const type = new AttributeDefinition(
    c.type.toLowerCase(),
    c.type,
    getAttributeType(c.type,),
    c.input?.value ?? null,
  );

  // Create attribute instance
  const attr = new attributeClass(property, type, container,);

  // Set value if input has value
  if (c.input?.value !== undefined) {
    if (c.input.inherit) {
      attr.inherit(c.input.value as never,);
    } else {
      attr.set(c.input.value as never,);
    }
  }

  // Run the test based on method
  switch (c.method) {
    case "to_tjp": {
      if (c.expected === "throws") {
        assertThrows(() => attr.to_tjp(), Error, `Golden case "${c.description}" should throw`);
      } else {
        const actual = attr.to_tjp();
        assertEquals(actual, c.expected, `Golden case "${c.description}" failed for method ${c.method}`);
      }
      break;
    }
    case "to_s": {
      if (c.expected === "throws") {
        assertThrows(() => attr.to_s(), Error, `Golden case "${c.description}" should throw`);
      } else {
        const actual_s = attr.to_s();
        assertEquals(actual_s, c.expected, `Golden case "${c.description}" failed for method ${c.method}`);
      }
      break;
    }
    case "to_tjp_mode": {
      // This is a special test for mode
      const actual_mode = attr.to_tjp();
      assertEquals(
        actual_mode,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "to_tjp_inherit": {
      // This is a special test for inherit
      const actual_inherit = attr.to_tjp();
      assertEquals(
        actual_inherit,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case ":throws": {
      // Expect an exception
      assertThrows(
        () => {
          if (c.method === "to_tjp") {
            attr.to_tjp();
          } else if (c.method === "to_s") {
            attr.to_s();
          }
        },
        Error,
        `Golden case "${c.description}" should throw for method ${c.method}`,
      );
      break;
    }
    default:
      throw new Error(`Unknown method in golden file: ${c.method}`);
  }
}

function getAttributeClass(type: string,): unknown {
  // Map type names to actual classes
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
  // Map type names to AttributeType enum values
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