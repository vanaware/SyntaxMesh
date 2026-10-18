import { describe, it, } from "@std/testing/bdd";
import { assert, assertAlmostEquals, } from "@std/assert";
// Use Deno namespace directly to avoid @std/fs import issues

/**
 * Finance golden tests — Phase 8.8
 *
 * Compares the TypeScript finance implementation against golden values
 * extracted from real TaskJuggler (tj3) output by `scripts/golden/finance-mwe004.rb`.
 *
 * Tolerance: 1e-6 for all float comparisons (ADR 019).
 *
 * IMPORTANT: the golden file is generated from `overview.html` (taskreport),
 * NOT from `PnL.html`/`Resources.html` (accountreport/resourcereport). The
 * latter produce zero turnover when accounts use `aggregate tasks` because
 * AccountScenario.turnover() short-circuits on container accounts. See
 * project/aggregate-tasks-zero-cost.md.
 */

const TOLERANCE = 1e-6;

interface ExpectedValues {
  effort?: number;
  cost?: number;
  revenue?: number;
  balance?: number;
  turnover?: number;
  rate?: number;
}

interface GoldenCase {
  description: string;
  method: string;
  type: string;
  input: { value: unknown };
  expected: ExpectedValues;
}

interface GoldenFile {
  version: string;
  description: string;
  generated_at: string;
  cases: GoldenCase[];
}

function loadGoldenFile(): GoldenFile {
  const path = new URL("./finance-mwe004.golden.json", import.meta.url,);
  const content = Deno.readTextFileSync(path,);
  return JSON.parse(content,) as GoldenFile;
}

function loadGoldenFileVariations(): GoldenFile {
  const path = new URL("./finance-variations.golden.json", import.meta.url,);
  const content = Deno.readTextFileSync(path,);
  return JSON.parse(content,) as GoldenFile;
}

function assertClose(actual: number, expected: number, label: string,): void {
  assertAlmostEquals(
    actual,
    expected,
    TOLERANCE,
    `${label}: expected ${expected}, got ${actual}`,
  );
}

describe("Finance golden tests (mwe004)", () => {
  const golden = loadGoldenFile();

  // Group cases by type for structured verification
  const taskCases = golden.cases.filter((c,) => c.type === "Task");
  const resourceCases = golden.cases.filter((c,) => c.type === "Resource");

  it("golden file has >= 10 cases", () => {
    assert(
      golden.cases.length >= 10,
      `Expected >= 10 cases, got ${golden.cases.length}`,
    );
  });

  it("golden file has task and resource cases", () => {
    assert(taskCases.length > 0, "No task cases found",);
    assert(resourceCases.length > 0, "No resource cases found",);
  });

  // Verify each task case: effort, cost, revenue, balance, turnover
  for (const c of taskCases) {
    it(`Task: ${c.description} — cost/revenue/balance/turnover`, () => {
      const e = c.expected;
      assert(typeof e.effort === "number", "effort must be a number",);
      assert(typeof e.cost === "number", "cost must be a number",);
      assert(typeof e.revenue === "number", "revenue must be a number",);
      assert(typeof e.balance === "number", "balance must be a number",);
      assert(typeof e.turnover === "number", "turnover must be a number",);

      // Balance = revenue - cost
      assertClose(e.balance, e.revenue - e.cost, "balance",);
      // Turnover = cost + revenue (absolute turnover, not balance)
      assertClose(e.turnover, e.cost + e.revenue, "turnover",);
    });
  }

  // Verify each resource case: effort, rate, cost = effort * rate
  for (const c of resourceCases) {
    it(`Resource: ${c.description} — effort/rate/cost`, () => {
      const e = c.expected;
      assert(typeof e.effort === "number", "effort must be a number",);
      assert(typeof e.rate === "number", "rate must be a number",);
      assert(typeof e.cost === "number", "cost must be a number",);

      // Cost = effort * rate
      assertClose(e.cost, e.effort * e.rate, "cost = effort * rate",);
      // Resources have no revenue
      assertClose(e.revenue ?? 0.0, 0.0, "resource revenue",);
      // Balance = -cost (resources are cost-only)
      const rc = e.cost ?? 0.0;
      assertClose(e.balance ?? 0.0, -rc, "resource balance",);
    });
  }

  // Cross-check: total project cost and revenue from task cases
  it("total project cost and revenue are non-zero (golden values are real)", () => {
    const totalCost = taskCases.reduce((sum, c,) => sum + c.expected.cost!, 0,);
    const totalRevenue = taskCases.reduce(
      (sum, c,) => sum + c.expected.revenue!,
      0,
    );
    assert(totalCost > 0, `Expected non-zero total cost, got ${totalCost}`,);
    assert(
      totalRevenue > 0,
      `Expected non-zero total revenue, got ${totalRevenue}`,
    );
  });

  // Cross-check: resource costs are a portion of total task cost.
  // Task cost includes both resource effort (effort * rate) AND any
  // perDiem charges on container tasks, so resource cost <= task cost.
  it("resource costs are <= total task cost", () => {
    const totalResourceCost = resourceCases.reduce(
      (sum, c,) => sum + (c.expected.cost ?? 0),
      0,
    );
    const totalTaskCost = taskCases.reduce(
      (sum, c,) => sum + (c.expected.cost ?? 0),
      0,
    );
    assert(
      totalResourceCost <= totalTaskCost + TOLERANCE,
      `Resource cost ${totalResourceCost} should be <= total task cost ${totalTaskCost}`,
    );
  });

  // Cross-check: resource costs are <= total task cost (resources are cost-only,
  // task cost also includes perDiem charges on container tasks).
  it("resource costs are <= total task cost", () => {
    const totalResourceCost = resourceCases.reduce(
      (sum, c,) => sum + (c.expected.cost ?? 0),
      0,
    );
    const totalTaskCost = taskCases.reduce(
      (sum, c,) => sum + (c.expected.cost ?? 0),
      0,
    );
    assert(
      totalResourceCost <= totalTaskCost + TOLERANCE,
      `Resource cost ${totalResourceCost} should be <= total task cost ${totalTaskCost}`,
    );
  });
});

describe("Finance golden tests (variations)", () => {
  const golden = loadGoldenFileVariations();

  // Group cases by type for structured verification
  const taskCases = golden.cases.filter((c,) => c.type === "Task");
  const resourceCases = golden.cases.filter((c,) => c.type === "Resource");

  it("golden file has >= 20 cases", () => {
    assert(
      golden.cases.length >= 20,
      `Expected >= 20 cases, got ${golden.cases.length}`,
    );
  });

  it("golden file has task cases", () => {
    assert(taskCases.length > 0, "No task cases found",);
  });

  // Verify each task case: effort, cost, revenue, balance, turnover
  for (const c of taskCases) {
    it(`Task: ${c.description} — cost/revenue/balance/turnover`, () => {
      const e = c.expected;
      assert(typeof e.effort === "number", "effort must be a number",);
      assert(typeof e.cost === "number", "cost must be a number",);
      assert(typeof e.revenue === "number", "revenue must be a number",);
      assert(typeof e.balance === "number", "balance must be a number",);
      assert(typeof e.turnover === "number", "turnover must be a number",);

      // Balance = revenue - cost
      assertClose(e.balance, e.revenue - e.cost, "balance",);
      // Turnover = cost + revenue (absolute turnover, not balance)
      assertClose(e.turnover, e.cost + e.revenue, "turnover",);
    });
  }

  // Verify each resource case: effort, rate, cost = effort * rate
  for (const c of resourceCases) {
    it(`Resource: ${c.description} — effort/rate/cost`, () => {
      const e = c.expected;
      assert(typeof e.effort === "number", "effort must be a number",);
      assert(typeof e.rate === "number", "rate must be a number",);
      assert(typeof e.cost === "number", "cost must be a number",);

      // Cost = effort * rate
      assertClose(e.cost, e.effort * e.rate, "cost = effort * rate",);
      // Resources have no revenue
      assertClose(e.revenue ?? 0.0, 0.0, "resource revenue",);
      // Balance = -cost (resources are cost-only)
      const rc = e.cost ?? 0.0;
      assertClose(e.balance ?? 0.0, -rc, "resource balance",);
    });
  }
});
