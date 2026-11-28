/**
 * Generated-bundle purity regressions (22.12.21). The scanner operates on the
 * actual JavaScript artifacts, so comments, strings and source-map payloads must
 * not create false positives while executable runtime globals still fail.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, } from "@std/assert";
import {
  type BundleViolation,
  scanBrowserBundle,
} from "../../src/web/bundle-purity.ts";

const FILE = "dist/extension.web.js";

/** Scans one inline bundle fixture with a stable diagnostic filename. */
function scan(text: string,): BundleViolation[] {
  return scanBrowserBundle(FILE, text,);
}

/** Returns the sole violation, failing the test when the count is wrong. */
function only(text: string,): BundleViolation {
  const violations = scan(text,);
  assertEquals(violations.length, 1,);
  return violations[0]!;
}

describe("generated Web-bundle purity scanner", () => {
  it("accepts guarded host capabilities and non-executable mentions", () => {
    const text = [
      'import { workspace, } from "vscode";',
      "const g = globalThis;",
      "if (g.Deno?.readTextFileSync) g.Deno.readTextFileSync(file);",
      "if (globalThis.Deno?.stdin) globalThis.Deno.readFileSync(0);",
      'const label = "Deno.readTextFileSync process.env node:fs";',
      'const prefix = file.startsWith("node:");',
      'const isWindows = typeof process === "object" && process && process.platform === "win32";',
    ].join("\n",);

    assertEquals(scan(text,), [],);
  });

  it("flags unbound Deno member access with file, line and snippet", () => {
    const text = [
      "const first = 1;",
      "const bytes = Deno.readTextFileSync(path);",
    ].join("\n",);
    const violation = only(text,);

    assertEquals(violation.file, FILE,);
    assertEquals(violation.line, 2,);
    assertEquals(
      violation.snippet,
      "const bytes = Deno.readTextFileSync(path);",
    );
    assertStringIncludes(violation.reason, "unbound Deno",);
  });

  it("flags optional unbound Deno access", () => {
    const violation = only('const env = Deno?.env.get("HOME");',);
    assertEquals(violation.line, 1,);
    assertStringIncludes(violation.reason, "unbound Deno",);
  });

  it("flags every node: import form without flagging ordinary strings", () => {
    const fixtures = [
      'import { readFile, } from "node:fs/promises";',
      'import "node:fs";',
      'const fs = import("node:fs");',
      'export { readFile, } from "node:fs";',
    ];
    for (const text of fixtures) {
      const violation = only(text,);
      assertStringIncludes(violation.reason, "node:* import",);
    }
  });

  it("flags node: require and require.resolve calls", () => {
    for (
      const text of [
        'const fs = require("node:fs");',
        'const path = require.resolve("node:path");',
      ]
    ) {
      const violation = only(text,);
      assertStringIncludes(violation.reason, "node:* require",);
    }
  });

  it("ignores comments between import tokens", () => {
    const violation = only(
      'import/* comment */{ readFile, }from/* comment */"node:fs";',
    );
    assertStringIncludes(violation.reason, "node:* import",);
  });

  it("flags unsafe process properties in direct, optional and bracket forms", () => {
    for (
      const text of [
        "const home = process.env.HOME;",
        "const args = process.argv.slice(2);",
        "process.exit(1);",
        "const cwd = process.cwd();",
        "const home = process?.env.HOME;",
        'const home = process["env"].HOME;',
      ]
    ) {
      const violation = only(text,);
      assertStringIncludes(violation.reason, "process.",);
    }
  });

  it("allows only the known guarded minimatch platform capability check", () => {
    assertEquals(
      scan(
        'const isWindows = typeof process === "object" && process && process.platform === "win32";',
      ),
      [],
    );

    const violation = only(
      'const isWindows = typeof process === "object" && process && process.platform === "win32"; const home = process.env.HOME;',
    );
    assertStringIncludes(violation.reason, "process.env",);
  });

  it("rejects arbitrary process.platform access", () => {
    const violation = only(
      'const separator = process.platform === "win32" ? "\\\\" : "/";',
    );
    assertStringIncludes(violation.reason, "process.platform",);
  });

  it("ignores line comments, block comments and source-map payloads", () => {
    const text = [
      "// Deno.readTextFileSync(path);",
      "//# sourceMappingURL=data:application/json;base64,RGVuby5yZWFkVGV4dEZpbGU=",
      '/* require("node:fs"); process.exit(1); */',
      "const safe = true;",
    ].join("\n",);

    assertEquals(scan(text,), [],);
  });

  it("ignores template text but scans executable interpolations", () => {
    assertEquals(
      scan("const text = `Deno.readTextFileSync process.env node:fs`;",),
      [],
    );

    const processViolation = only("const text = `${process.env.HOME}`;",);
    assertStringIncludes(processViolation.reason, "process.env",);

    const denoViolation = only(
      "const text = `${Deno.readTextFileSync(path)}`;",
    );
    assertStringIncludes(denoViolation.reason, "unbound Deno",);
  });

  it("returns violations in source order", () => {
    const text = [
      'import { readFile, } from "node:fs";',
      "const safe = true;",
      "const home = process.env.HOME;",
      "const bytes = Deno.readTextFileSync(path);",
    ].join("\n",);
    const violations = scan(text,);

    assertEquals(violations.map((violation,) => violation.line), [1, 3, 4,],);
    assertStringIncludes(violations[0]!.reason, "node:* import",);
    assertStringIncludes(violations[1]!.reason, "process.env",);
    assertStringIncludes(violations[2]!.reason, "unbound Deno",);
  });
});
