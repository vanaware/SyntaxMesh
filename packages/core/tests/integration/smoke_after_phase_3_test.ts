import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
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

describe("Smoke test after Phase 3", () => {
  beforeEach(() => {
    AttributeBase.setMode(0,);
  },);

  it("imports @syntaxmesh/core and creates AttributeBase", () => {
    const container = new MockContainer();
    const property: PropertyLike = { id: "test", name: "Test", };
    const type = new AttributeDefinition(
      "string",
      "String",
      AttributeType.String,
      "hello",
    );
    const attr = new StringAttribute(property, type, container,);
    assertEquals(attr.get(), "hello",);
    assertEquals(attr.to_s(), "hello",);
    assertEquals(attr.to_tjp(), 'text "hello"',);
  });

  it("imports all attribute types", () => {
    const types = [
      StringAttribute,
      IntegerAttribute,
      FloatAttribute,
      BooleanAttribute,
      SymbolAttribute,
      DateAttribute,
      DurationAttribute,
      PropertyAttribute,
      AccountAttribute,
      ReferenceAttribute,
      FlagListAttribute,
      SymbolListAttribute,
      ScenarioListAttribute,
      NodeListAttribute,
      ResourceListAttribute,
      TaskListAttribute,
      DependencyListAttribute,
      TaskDepListAttribute,
      ChargeListAttribute,
      ChargeSetListAttribute,
      AccountCreditListAttribute,
      AllocationAttribute,
      BookingListAttribute,
      LogicalExpressionAttribute,
      LogicalExpressionListAttribute,
      TimeIntervalListAttribute,
      LeaveListAttribute,
      LeaveAllowanceListAttribute,
      LimitsAttribute,
      ShiftAssignmentsAttribute,
      WorkingHoursAttribute,
      RealFormatAttribute,
      ColumnListAttribute,
      FormatListAttribute,
      SortListAttribute,
      JournalSortListAttribute,
      RichTextAttribute,
      DefinitionListAttribute,
    ];

    for (const cls of types) {
      assertEquals(typeof cls, "function", `Missing ${cls.name}`,);
    }
  });
});
