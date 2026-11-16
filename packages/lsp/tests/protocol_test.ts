/**
 * Real stdio protocol smoke of the standalone LSP server (22.9.5) — the P6
 * exit criterion: an external editor can drive the server without VS Code.
 *
 * Spawns `deno run src/mod.ts --stdio` and speaks Content-Length-framed
 * JSON-RPC: initialize → capabilities, didOpen → publishDiagnostics, hover,
 * shutdown/exit. The frame parser is strict: any byte on stdout that is not
 * a JSON-RPC frame fails the test (plan §7 — stdout is the protocol channel,
 * logs go to stderr).
 *
 * The framing/client harness lives in `./stdio-client.ts` (F21², 26.29.1) so
 * the wave-2 integration suites reuse it; this file keeps the CLI surface
 * smoke and the full `initialize` capabilities contract.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §4.2/§7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.9.5
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.29.1)
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { APP_VERSION, } from "@vanaware/syntaxmesh/version";
import {
  didOpen,
  nextDiagnostics,
  openSession,
  runCli,
  withTimeout,
} from "./stdio-client.ts";

/** Document URI used by the session (in-memory; no file is read). */
const URI = "file:///protocol.tjp";
/** Same realistic fixture as the lsp-core smoke (22.1.16). */
const TEXT = `project prj "Protocol" "1.0" 2026-01-01 - 2026-12-31 {
}
resource dev "Developer" {
}
task build "Build" {
  effort 5d
  allocate dev
}
task ship "Ship" {
  depends build
}
`;

describe("standalone LSP protocol over stdio (22.9.5)", () => {
  it("prints usage on --help and exits 0", async () => {
    const out = await withTimeout(runCli(["--help",],), 30_000, "--help",);
    assertEquals(out.code, 0,);
    assertStringIncludes(new TextDecoder().decode(out.stdout,), "--stdio",);
  });

  it("rejects unknown flags on stderr with exit 1 and empty stdout", async () => {
    const out = await withTimeout(runCli(["--bogus",],), 30_000, "--bogus",);
    assertEquals(out.code, 1,);
    assertEquals(new TextDecoder().decode(out.stdout,), "",);
    assertStringIncludes(new TextDecoder().decode(out.stderr,), "--bogus",);
  });

  it("prints the version banner on --version and exits 0", async () => {
    const out = await withTimeout(
      runCli(["--version",],),
      30_000,
      "--version",
    );
    assertEquals(out.code, 0,);
    // Same source as the CLI banner: APP_VERSION is build-injected and ""
    // from source — the assertion never hardcodes a version (22.10.1).
    assertEquals(
      new TextDecoder().decode(out.stdout,),
      `SyntaxMesh language server ${APP_VERSION}\n`,
    );
    assertEquals(new TextDecoder().decode(out.stderr,), "",);
  });

  it("serves initialize → didOpen → hover → shutdown/exit", async () => {
    const { client, capabilities, } = await openSession();
    try {
      // initialize: the full §5 capabilities contract, over the real
      // transport (26.29.1 extends the 22.9.5 subset to every provider).
      assertEquals(capabilities["textDocumentSync"], 2,);
      assertEquals(capabilities["hoverProvider"], true,);
      assertEquals(capabilities["completionProvider"], {},);
      assertEquals(capabilities["definitionProvider"], true,);
      assertEquals(capabilities["referencesProvider"], true,);
      assertEquals(capabilities["documentSymbolProvider"], true,);
      assertEquals(capabilities["workspaceSymbolProvider"], true,);
      const semantic = capabilities["semanticTokensProvider"] as {
        legend: { tokenTypes: string[]; tokenModifiers: string[] };
        full: boolean;
      };
      assert(semantic !== undefined,);
      assertEquals(semantic.full, true,);
      assertEquals(semantic.legend.tokenTypes, [
        "keyword",
        "identifier",
        "string",
        "number",
        "date",
        "comment",
      ],);
      assertEquals(semantic.legend.tokenModifiers, [],);

      // didOpen of a valid project publishes empty diagnostics.
      await didOpen(client, URI, TEXT,);
      const diag = await nextDiagnostics(client,);
      assertEquals(diag.uri, URI,);
      assertEquals(diag.diagnostics, [],);

      // hover over the `task` keyword (line 4, column 1) → Markdown.
      const hover = await client.request("textDocument/hover", {
        textDocument: { uri: URI, },
        position: { line: 4, character: 1, },
      },);
      const hoverResult = hover.result as {
        contents: { kind: string; value: string };
      } | null;
      assert(hoverResult !== null,);
      assertEquals(hoverResult!.contents.kind, "markdown",);

      // shutdown/exit: a well-behaved server leaves with code 0.
      assertEquals(await client.shutdown(), 0,);

      // stdout carried nothing but frames: no trailing log byte.
      assertEquals((await client.remaining()).byteLength, 0,);
    } finally {
      await client.close();
    }
  });
});
