import { describe, it } from "@std/testing/bdd";
import { assertEquals } from "@std/assert";
import { AttributeDefinition } from "../../src/attributes/attribute-definition.ts";
import { AttributeType } from "../../src/attributes/attribute-type.ts";
import { MockProject } from "../model/mock-project.ts";

/**
 * Golden test runner for AttributeDefinitions.
 *
 * Reads cases from `attribute-definitions.golden.json` and compares each
 * AttributeDefinition from the Ruby TaskJuggler gem against the TypeScript
 * implementation.
 *
 * The golden JSON contains 160 cases across 6 PropertySets (scenarios, shifts,
 * accounts, resources, tasks, reports). Each case has: id, name, objClass,
 * inheritedFromParent, inheritedFromProject, scenarioSpecific, default, userDefined.
 *
 * The TS implementation uses AttributeType enum instead of objClass strings,
 * so we map Ruby class names to AttributeType values for comparison.
 */

interface GoldenCase {
  id: string;
  name: string;
  objClass: string;
  inheritedFromParent: boolean;
  inheritedFromProject: boolean;
  scenarioSpecific: boolean;
  default: unknown;
  userDefined: boolean;
}

interface GoldenFile {
  version: string;
  description: string;
  generated_at: string;
  cases: GoldenCase[];
}

/**
 * Maps Ruby objClass names (e.g. "TaskJuggler::StringAttribute") to
 * AttributeType enum values.
 */
const rubyClassToType: Record<string, AttributeType> = {
  "TaskJuggler::StringAttribute": AttributeType.String,
  "TaskJuggler::IntegerAttribute": AttributeType.Integer,
  "TaskJuggler::FloatAttribute": AttributeType.Float,
  "TaskJuggler::BooleanAttribute": AttributeType.Boolean,
  "TaskJuggler::SymbolAttribute": AttributeType.Symbol,
  "TaskJuggler::DateAttribute": AttributeType.Date,
  "TaskJuggler::DurationAttribute": AttributeType.Duration,
  "TaskJuggler::PropertyAttribute": AttributeType.Property,
  "TaskJuggler::AccountAttribute": AttributeType.Account,
  "TaskJuggler::ReferenceAttribute": AttributeType.Reference,
  "TaskJuggler::FlagListAttribute": AttributeType.FlagList,
  "TaskJuggler::SymbolListAttribute": AttributeType.SymbolList,
  "TaskJuggler::ScenarioListAttribute": AttributeType.ScenarioList,
  "TaskJuggler::NodeListAttribute": AttributeType.NodeList,
  "TaskJuggler::ResourceListAttribute": AttributeType.ResourceList,
  "TaskJuggler::TaskListAttribute": AttributeType.TaskList,
  "TaskJuggler::DependencyListAttribute": AttributeType.DependencyList,
  "TaskJuggler::TaskDepListAttribute": AttributeType.TaskDepList,
  "TaskJuggler::ChargeListAttribute": AttributeType.ChargeList,
  "TaskJuggler::ChargeSetListAttribute": AttributeType.ChargeSetList,
  "TaskJuggler::AccountCreditListAttribute": AttributeType.AccountCreditList,
  "TaskJuggler::AllocationAttribute": AttributeType.Allocation,
  "TaskJuggler::BookingListAttribute": AttributeType.BookingList,
  "TaskJuggler::LogicalExpressionAttribute": AttributeType.LogicalExpression,
  "TaskJuggler::LogicalExpressionListAttribute": AttributeType.LogicalExpressionList,
  "TaskJuggler::TimeIntervalListAttribute": AttributeType.TimeIntervalList,
  "TaskJuggler::LeaveListAttribute": AttributeType.LeaveList,
  "TaskJuggler::LeaveAllowanceListAttribute": AttributeType.LeaveAllowanceList,
  "TaskJuggler::LimitsAttribute": AttributeType.Limits,
  "TaskJuggler::ShiftAssignmentsAttribute": AttributeType.ShiftAssignments,
  "TaskJuggler::WorkingHoursAttribute": AttributeType.WorkingHours,
  "TaskJuggler::RealFormatAttribute": AttributeType.RealFormat,
  "TaskJuggler::ColumnListAttribute": AttributeType.ColumnList,
  "TaskJuggler::FormatListAttribute": AttributeType.FormatList,
  "TaskJuggler::SortListAttribute": AttributeType.SortList,
  "TaskJuggler::JournalSortListAttribute": AttributeType.JournalSortList,
  "TaskJuggler::RichTextAttribute": AttributeType.RichText,
  "TaskJuggler::DefinitionListAttribute": AttributeType.DefinitionList,
};

/**
 * Extracts the short class name from a Ruby objClass string.
 * e.g. "TaskJuggler::StringAttribute" → "StringAttribute"
 */
function shortClassName(objClass: string): string {
  return objClass.split("::").pop() ?? objClass;
}

/**
 * Converts a TS AttributeDefinition to the golden format for comparison.
 */
function toGolden(ad: AttributeDefinition<unknown>): GoldenCase {
  return {
    id: ad.id,
    name: ad.name,
    objClass: `TaskJuggler::${AttributeDefinition.attributeTypeClass(ad.type)}`,
    inheritedFromParent: ad.inheritedFromParent,
    inheritedFromProject: ad.inheritedFromProject,
    scenarioSpecific: ad.isScenarioAttribute,
    default: ad.defaultValue,
    userDefined: ad.userDefined,
  };
}

/**
 * Collects all AttributeDefinitions from all 6 PropertySets of a MockProject,
 * sorted alphabetically by id (matching Ruby's eachAttributeDefinition sort).
 */
function collectAllAttributeDefinitions(project: MockProject): GoldenCase[] {
  const result: GoldenCase[] = [];
  const propertySets = [
    project.scenarios,
    project.shifts,
    project.accounts,
    project.resources,
    project.tasks,
    project.reports,
  ];

  for (const ps of propertySets) {
    ps.eachAttributeDefinition((ad) => {
      result.push(toGolden(ad));
    });
  }

  // Sort by id to match Ruby's @attributeDefinitions.sort.each
  result.sort((a, b) => a.id.localeCompare(b.id));
  return result;
}

function loadGoldenFile(): GoldenFile {
  const path = new URL("./attribute-definitions.golden.json", import.meta.url);
  const content = Deno.readTextFileSync(path);
  return JSON.parse(content) as GoldenFile;
}

/**
 * Groups an array of cases by their `id`. Within each group, insertion
 * order is preserved. The same id can be registered in several
 * PropertySets (e.g. `id`, `name`, `seqno`, `bsi`, `index`, `flags`),
 * and the order within a group follows the PropertySet iteration order,
 * which is identical in the Ruby golden generator and the TS collector.
 */
function groupById<T extends { id: string }>(cases: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const c of cases) {
    let group = map.get(c.id);
    if (!group) {
      group = [];
      map.set(c.id, group);
    }
    group.push(c);
  }
  return map;
}

describe("AttributeDefinitions golden tests", () => {
  const golden = loadGoldenFile();
  const project = new MockProject();
  const tsDefinitions = collectAllAttributeDefinitions(project);

  const goldenById = groupById(golden.cases);
  const tsById = groupById(tsDefinitions);

  // Report ids that differ between golden and TS (for diagnostics only).
  const missingInTs: string[] = [];
  const extraInTs: string[] = [];
  for (const id of goldenById.keys()) {
    if (!tsById.has(id)) missingInTs.push(id);
  }
  for (const id of tsById.keys()) {
    if (!goldenById.has(id)) extraInTs.push(id);
  }
  if (missingInTs.length > 0 || extraInTs.length > 0) {
    console.log("Missing in TS:", missingInTs);
    console.log("Extra in TS:", extraInTs);
  }

  // The golden file and TS implementation must have the same number of cases
  assertEquals(
    tsDefinitions.length,
    golden.cases.length,
    `Case count mismatch: TS has ${tsDefinitions.length}, golden has ${golden.cases.length}`,
  );

  // Iterate golden cases in order, but compare within id groups so that
  // duplicate ids across PropertySets are matched positionally inside their
  // own group rather than against unrelated cases at the same global index.
  const usedTsIndices = new Set<number>();

  for (let gi = 0; gi < golden.cases.length; gi++) {
    const expected = golden.cases[gi]!;
    const group = tsById.get(expected.id);
    if (!group) {
      throw new Error(`No TS cases for id '${expected.id}'`);
    }

    // Find the next unused TS case within this id group.
    let actual: GoldenCase | undefined;
    for (const candidate of group) {
      const idx = tsDefinitions.indexOf(candidate);
      if (!usedTsIndices.has(idx)) {
        actual = candidate;
        usedTsIndices.add(idx);
        break;
      }
    }
    if (!actual) {
      throw new Error(
        `Ran out of TS cases for id '${expected.id}' (group size ${group.length})`,
      );
    }

    it(`case ${gi}: ${expected.id}`, () => {
      // Verify name matches
      assertEquals(actual.name, expected.name, `name mismatch for ${expected.id}`);

      // Verify objClass matches (Ruby class name vs TS attributeTypeClass)
      const expectedType = rubyClassToType[expected.objClass];
      if (expectedType === undefined) {
        throw new Error(`Unknown Ruby objClass: ${expected.objClass}`);
      }
      assertEquals(
        shortClassName(actual.objClass),
        AttributeDefinition.attributeTypeClass(expectedType),
        `objClass mismatch for ${expected.id}: expected ${expected.objClass}`,
      );

      // Verify inheritedFromParent
      assertEquals(
        actual.inheritedFromParent,
        expected.inheritedFromParent,
        `inheritedFromParent mismatch for ${expected.id}`,
      );

      // Verify inheritedFromProject
      assertEquals(
        actual.inheritedFromProject,
        expected.inheritedFromProject,
        `inheritedFromProject mismatch for ${expected.id}`,
      );

      // Verify scenarioSpecific (TS isScenarioAttribute vs Ruby scenarioSpecific)
      assertEquals(
        actual.scenarioSpecific,
        expected.scenarioSpecific,
        `scenarioSpecific mismatch for ${expected.id}`,
      );

      // Verify default value
      assertEquals(
        actual.default,
        expected.default,
        `default mismatch for ${expected.id}`,
      );

      // Verify userDefined
      assertEquals(
        actual.userDefined,
        expected.userDefined,
        `userDefined mismatch for ${expected.id}`,
      );
    });
  }
});
