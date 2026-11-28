/**
 * Unit + regression tests of the pure browser-graph purity scanner (22.8.1).
 * BDD + `@std/assert`, no `vscode` runtime. The regression walks the real
 * `src/` tree (minus the Node-only bootstraps) so any new environment
 * dependency in the Web graph fails `deno test` (plan §9.2/§9.3).
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  NODE_ONLY_BOOTSTRAPS,
  scanBrowserSource,
} from "../../src/web/purity.ts";

/** Recursively yields `.ts` paths relative to `base` (no trailing slash). */
function* walkTs(dir: string, base: string,): Generator<string> {
  for (const entry of Deno.readDirSync(dir,)) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      yield* walkTs(full, base,);
    } else if (entry.isFile && entry.name.endsWith(".ts",)) {
      yield full.slice(base.length + 1,);
    }
  }
}

describe("web purity scanner", () => {
  it("accepts browser-safe source", () => {
    const text = [
      'import { workspace, } from "vscode";',
      "const id = crypto.randomUUID();",
      "export const n = 1;",
    ].join("\n",);
    assertEquals(scanBrowserSource(text,), [],);
  });

  it("flags a node: import with its line number", () => {
    const text = 'import { readFileSync, } from "node:fs";';
    const violations = scanBrowserSource(text,);
    assertEquals(violations.length, 1,);
    assertEquals(violations[0]!.line, 1,);
    assertEquals(violations[0]!.snippet, text,);
  });

  it("flags a node: require", () => {
    const violations = scanBrowserSource('const fs = require("node:fs");',);
    assertEquals(violations.length, 1,);
  });

  it("flags process.* and Deno.* usage", () => {
    assertEquals(scanBrowserSource("const e = process.env.HOME;",).length, 1,);
    assertEquals(
      scanBrowserSource("const t = Deno.readTextFileSync(p);",).length,
      1,
    );
  });

  it("allows host capabilities probed through a bound global object", () => {
    const text = [
      "const g = globalThis;",
      "if (g.Deno?.readTextFileSync) g.Deno.readTextFileSync(file);",
      'const isWindows = typeof process === "object" && process && process.platform === "win32";',
    ].join("\n",);
    assertEquals(scanBrowserSource(text,), [],);
  });

  it("skips comment lines that only mention the patterns", () => {
    const text = [
      '// never import from "node:fs" here',
      "/**",
      " * Deno.readTextFileSync is forbidden",
      " */",
      "/* process.env is unavailable */",
      "export const ok = true;",
    ].join("\n",);
    assertEquals(scanBrowserSource(text,), [],);
  });

  it("lists the four Node-only source modules", () => {
    assertEquals(
      [...NODE_ONLY_BOOTSTRAPS,].sort(),
      [
        "client/node.ts",
        "console/pty.ts",
        "extension.node.ts",
        "server/node.ts",
      ],
    );
  });

  it("keeps the real Web source graph free of environment dependencies", () => {
    const src = `${import.meta.dirname}/../../src`;
    const offenders: string[] = [];
    for (const rel of walkTs(src, src,)) {
      if (NODE_ONLY_BOOTSTRAPS.includes(rel,)) continue;
      const text = Deno.readTextFileSync(`${src}/${rel}`,);
      for (const v of scanBrowserSource(text,)) {
        offenders.push(`${rel}:${v.line} ${v.reason}`,);
      }
      // §9.3: no direct IndexedDB/OPFS reliance (unstable origin on Web).
      if (/indexedDB|navigator\.storage\.getDirectory/.test(text,)) {
        offenders.push(`${rel} direct IndexedDB/OPFS`,);
      }
    }
    assertEquals(offenders, [],);
  });
});
