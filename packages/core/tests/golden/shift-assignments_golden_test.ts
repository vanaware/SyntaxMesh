import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { ShiftAssignments, } from "../../src/scheduling/shift-assignments.ts";
import { ShiftAssignment, } from "../../src/scheduling/shift-assignments.ts";
import { Shift, } from "../../src/model/shift.ts";
import { WorkingHours, } from "../../src/calendar/working-hours.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { MockProject, } from "../model/mock-project.ts";

/**
 * Golden test runner for ShiftAssignments compatibility cases.
 *
 * Reads cases from `shift-assignments.golden.json` and executes each case against the
 * current ShiftAssignments implementation, comparing the actual output to the
 * expected value recorded in the golden file.
 */

interface GoldenCase {
  description: string;
  method: string;
  input: {
    index?: number;
    assignments?: unknown;
  };
  expected: unknown;
}

interface GoldenFile {
  version: string;
  description: string;
  generated_at: string;
  cases: GoldenCase[];
}

function loadGoldenFile(): GoldenFile {
  // Read the golden file relative to this test file's directory
  const path = new URL("./shift-assignments.golden.json", import.meta.url,);
  const content = Deno.readTextFileSync(path,);
  return JSON.parse(content,) as GoldenFile;
}

function setupShiftAssignments(project?: MockProject): ShiftAssignments {
  const p = project ?? new MockProject(1,);

  // Setup project attributes as in the Ruby script
  p.set("start", TjTime.fromDate(new Date("2026-01-01T00:00:00Z")));
  p.set("end", TjTime.fromDate(new Date("2026-01-08T00:00:00Z")));
  p.set("scheduleGranularity", 3600);

  // Create shift with working hours Monday 9-17
  const shift = new Shift(p, "shift1", "Shift 1", null);
  const wh = new WorkingHours(3600, p.get("start") as Date, p.get("end") as Date,);
  wh.setWorkingHours(1, [[9 * 3600, 17 * 3600]]);
  shift.setForScenario("workinghours", wh, 0);

  // Create ShiftAssignments with 2 assignments
  const assignments = new ShiftAssignments();
  assignments.project = p;

  // Assignment 1: Monday 9-17 (index 9)
  const interval1 = new TimeInterval(
    TjTime.fromDate(new Date("2026-01-05T09:00:00Z")),
    TjTime.fromDate(new Date("2026-01-05T17:00:00Z")),
  );
  assignments.addAssignment(new ShiftAssignment(shift.scenarioData(0), interval1));

  // Assignment 2: Tuesday 10-18 (index 10)
  const interval2 = new TimeInterval(
    TjTime.fromDate(new Date("2026-01-06T10:00:00Z")),
    TjTime.fromDate(new Date("2026-01-06T18:00:00Z")),
  );
  assignments.addAssignment(new ShiftAssignment(shift.scenarioData(0), interval2));

  return assignments;
}

function runCase(c: GoldenCase,): void {
  // Execute the test based on method
  switch (c.method) {
    case "getSbSlot": {
      const assignments = setupShiftAssignments();
      const actual = assignments.getSbSlot(c.input.index!);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "assigned?": {
      const assignments = setupShiftAssignments();
      const actual = assignments.assigned(c.input.index!);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "onShift?": {
      const assignments = setupShiftAssignments();
      const actual = assignments.onShift(c.input.index!);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "timeOff?": {
      const assignments = setupShiftAssignments();
      const actual = assignments.timeOff(c.input.index!);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "onLeave?": {
      const assignments = setupShiftAssignments();
      const actual = assignments.onLeave(c.input.index!);
      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    case "hashKey": {
      const assignments = setupShiftAssignments();
      const assignments2 = setupShiftAssignments(assignments.project as MockProject); // Use same project for identical instances
      const assignments3 = setupShiftAssignments(); // Different project

      // Remove one assignment from assignments3 to make it different
      assignments3.assignments.pop();

      let actual: boolean;
      if (c.description.includes("identical")) {
        // Identical instances: same project, same assignments
        actual = assignments.hashKey() === assignments2.hashKey();
      } else {
        // Different instances: different assignments
        actual = assignments.hashKey() === assignments3.hashKey();
      }

      assertEquals(
        actual,
        c.expected,
        `Golden case "${c.description}" failed for method ${c.method}`,
      );
      break;
    }
    default:
      throw new Error(`Unknown method in golden file: ${c.method}`,);
  }
}

describe("ShiftAssignments golden tests", () => {
  const golden = loadGoldenFile();

  for (const c of golden.cases) {
    it(`${c.method}: ${c.description}`, () => {
      runCase(c,);
    });
  }
});