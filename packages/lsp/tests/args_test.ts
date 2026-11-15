/**
 * Unit tests of the pure CLI argument parser (22.9.2, 22.10.1). BDD +
 * `@std/assert`; no transport, no process — `parseArgs` is a pure function
 * of `string[]`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.9.2
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.10.1
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertStringIncludes, } from "@std/assert";
import { parseArgs, USAGE, } from "../src/args.ts";

describe("parseArgs", () => {
  it("defaults to stdio when no arguments are given", () => {
    assertEquals(parseArgs([],), { mode: "stdio", },);
  });

  it("accepts --stdio explicitly", () => {
    assertEquals(parseArgs(["--stdio",],), { mode: "stdio", },);
  });

  it("recognizes --help", () => {
    assertEquals(parseArgs(["--help",],), { mode: "help", },);
  });

  it("recognizes -h", () => {
    assertEquals(parseArgs(["-h",],), { mode: "help", },);
  });

  it("recognizes --version", () => {
    assertEquals(parseArgs(["--version",],), { mode: "version", },);
  });

  it("recognizes -V", () => {
    assertEquals(parseArgs(["-V",],), { mode: "version", },);
  });

  it("lets version win when combined with --stdio", () => {
    assertEquals(parseArgs(["--stdio", "--version",],), { mode: "version", },);
  });

  it("lets help win over version", () => {
    assertEquals(parseArgs(["--version", "--help",],), { mode: "help", },);
  });

  it("lets help win when combined with --stdio", () => {
    assertEquals(parseArgs(["--stdio", "--help",],), { mode: "help", },);
  });

  it("rejects unknown flags with the flag in the message", () => {
    const parsed = parseArgs(["--socket",],);
    assertEquals(parsed.mode, "error",);
    assertStringIncludes(parsed.message ?? "", "--socket",);
  });

  it("rejects positional arguments", () => {
    const parsed = parseArgs(["project.tjp",],);
    assertEquals(parsed.mode, "error",);
    assertStringIncludes(parsed.message ?? "", "project.tjp",);
  });

  it("reports the first offending argument only", () => {
    const parsed = parseArgs(["--stdio", "--bogus", "--other",],);
    assertEquals(parsed.mode, "error",);
    assertStringIncludes(parsed.message ?? "", "--bogus",);
  });
});

describe("USAGE", () => {
  it("documents every supported flag", () => {
    assertStringIncludes(USAGE, "--stdio",);
    assertStringIncludes(USAGE, "--help",);
    assertStringIncludes(USAGE, "-h",);
    assertStringIncludes(USAGE, "--version",);
    assertStringIncludes(USAGE, "-V",);
  });
});
