// Quick debug: run golden cases and print failures
import { loadGoldenFile, runCase } from "../../packages/core/tests/golden/attributes_golden_test.ts";

const golden = loadGoldenFile();
for (const c of golden.cases) {
  try {
    runCase(c);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Values are not equal") || msg.includes("should throw")) {
      console.log(`FAIL: ${c.method}: ${c.description}`);
      console.log(`  expected: ${JSON.stringify(c.expected)}`);
      // Print actual by running again with try/catch inside
    }
  }
}
