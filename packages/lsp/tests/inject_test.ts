/**
 * Unit tests of the pure build-injection helpers (22.10.2). BDD +
 * `@std/assert`; no filesystem, no bundler — every helper is a pure
 * function of strings, so the version/shebang contract is unit-testable.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.10.2
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, assertThrows, } from "@std/assert";
import {
  injectVersion,
  readVersion,
  SHEBANG,
  withShebang,
} from "../scripts/inject.ts";

describe("readVersion", () => {
  it("extracts the version from a commented deno.jsonc", () => {
    const jsonc = `{
  // root workspace configuration
  "version": "1.2.3-abc",
  "exports": "./mod.ts"
}`;
    assertEquals(readVersion(jsonc,), "1.2.3-abc",);
  });

  it("tolerates whitespace around the colon", () => {
    assertEquals(readVersion(`{"version"  :  "0.0.2"}`,), "0.0.2",);
  });

  it("throws when the version field is absent", () => {
    assertThrows(() => readVersion(`{ "name": "x" }`,), Error, "version",);
  });
});

describe("injectVersion", () => {
  it("prepends the __APP_VERSION__ constant and keeps the source intact", () => {
    const source = `console.log(typeof __APP_VERSION__);\n`;
    const injected = injectVersion(source, "9.9.9",);
    assertEquals(
      injected,
      `const __APP_VERSION__ = "9.9.9";\n${source}`,
    );
  });

  it("JSON-escapes the version string", () => {
    const injected = injectVersion("", 'a"b\\c',);
    assertStringIncludes(injected, `const __APP_VERSION__ = "a\\"b\\\\c";`,);
  });
});

describe("withShebang", () => {
  it("prepends the deno shebang as the very first line", () => {
    const out = withShebang("const x = 1;\n",);
    assertEquals(out, `${SHEBANG}\nconst x = 1;\n`,);
    assertEquals(
      SHEBANG,
      "#!/usr/bin/env -S deno run --allow-read --allow-env",
    );
  });

  it("composes with injectVersion: shebang first, constant second", () => {
    const out = withShebang(injectVersion("body\n", "0.0.2",),);
    const lines = out.split("\n",);
    assertEquals(lines[0], SHEBANG,);
    assertEquals(lines[1], `const __APP_VERSION__ = "0.0.2";`,);
    assertEquals(lines[2], "body",);
  });
});
