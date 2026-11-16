/**
 * Headless LSP integration over stdio (F21², 26.29.2–26.29.5).
 *
 * Drives the **real** standalone server (`src/mod.ts --stdio`) through the
 * reusable framed client (`./stdio-client.ts`, 26.29.1) — no VS Code. Covers
 * the §5 surface the 22.9.5 smoke did not: document sync (full + incremental)
 * with diagnostics, completion/definition/references (single and cross-file
 * workspace), document/workspace symbols, semantic tokens, and diagnostics on
 * a real corpus error fixture. Expectations mirror the lsp-core unit smoke
 * (`core/tests/lsp/lsp-smoke_test.ts`, 22.1.16) over the real transport.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.29)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5/§11
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { didOpen, nextDiagnostics, openSession, } from "./stdio-client.ts";

/** Diagnostic shape projected by the server (structural subset). */
interface Diagnostic {
  range: { start: { line: number; character: number } };
  severity: number;
  source: string;
  message: string;
}

/** Location shape returned by definition/references. */
interface Location {
  uri: string;
  range: { start: { line: number; character: number } };
}

const URI = "file:///integration.tjp";
/** Realistic fixture: project + resource + two tasks (effort/allocate/depends). */
const TEXT = `project prj "Smoke" "1.0" 2026-01-01 - 2026-12-31 {
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

/** Cross-file pair: `dev` is declared in A and referenced from B. */
const A_URI = "file:///a.tjp";
const B_URI = "file:///b.tjp";
const TEXT_A = `project prj "A" "1.0" 2026-01-01 - 2026-12-31 {
}
resource dev "Developer" {
}
task build "Build" {
  effort 5d
  allocate dev
}
`;
const TEXT_B = `project prj2 "B" "1.0" 2026-01-01 - 2026-12-31 {
}
task extra "Extra" {
  allocate dev
}
`;

describe("LSP document sync over stdio (26.29.2)", () => {
  it("didChange incremental then full publishes diagnostics; didClose clears", async () => {
    const { client, } = await openSession();
    try {
      await didOpen(client, URI, TEXT,);
      assertEquals((await nextDiagnostics(client,)).diagnostics, [],);

      // Incremental range edit: insert an invalid attribute inside `build`.
      await client.notify("textDocument/didChange", {
        textDocument: { uri: URI, version: 2, },
        contentChanges: [{
          range: {
            start: { line: 5, character: 0, },
            end: { line: 5, character: 0, },
          },
          text: "  bogusattr 42\n",
        },],
      },);
      const changed = await nextDiagnostics(client,);
      assertEquals(changed.uri, URI,);
      assert(changed.diagnostics.length > 0,);
      assertEquals(
        (changed.diagnostics[0] as Diagnostic).source,
        "syntaxmesh",
      );

      // Full replacement back to the valid text clears the diagnostics.
      await client.notify("textDocument/didChange", {
        textDocument: { uri: URI, version: 3, },
        contentChanges: [{ text: TEXT, },],
      },);
      assertEquals((await nextDiagnostics(client,)).diagnostics, [],);

      // didClose clears diagnostics and the document stops answering.
      await client.notify("textDocument/didClose", {
        textDocument: { uri: URI, },
      },);
      const closed = await nextDiagnostics(client,);
      assertEquals(closed.uri, URI,);
      assertEquals(closed.diagnostics, [],);
      const hover = await client.request("textDocument/hover", {
        textDocument: { uri: URI, },
        position: { line: 4, character: 1, },
      },);
      assertEquals(hover.result, null,);

      assertEquals(await client.shutdown(), 0,);
    } finally {
      await client.close();
    }
  });
});

describe("LSP navigation over stdio (26.29.3)", () => {
  it("completion/definition/references answer on the open document", async () => {
    const { client, } = await openSession();
    try {
      await didOpen(client, URI, TEXT,);
      await nextDiagnostics(client,);

      // completion inside `depends build` (line 9) offers the defined name.
      const completion = await client.request("textDocument/completion", {
        textDocument: { uri: URI, },
        position: { line: 9, character: 12, },
      },);
      const items = completion.result as { label: string; kind: number }[];
      const build = items.find((i,) => i.label === "build");
      assert(build !== undefined,);
      assertEquals(build!.kind, 18,); // Reference: a defined name.

      // definition of `dev` in `allocate dev` (line 6) → declaration line 2.
      const definition = await client.request("textDocument/definition", {
        textDocument: { uri: URI, },
        position: { line: 6, character: 12, },
      },);
      const def = definition.result as Location;
      assertEquals(def.uri, URI,);
      assertEquals(def.range.start.line, 2,);

      // references of `dev` include at least the declaration.
      const references = await client.request("textDocument/references", {
        textDocument: { uri: URI, },
        position: { line: 6, character: 12, },
        context: { includeDeclaration: true, },
      },);
      assert((references.result as Location[]).length >= 1,);

      assertEquals(await client.shutdown(), 0,);
    } finally {
      await client.close();
    }
  });

  it("definition/references reach across two open documents", async () => {
    const { client, } = await openSession();
    try {
      await didOpen(client, A_URI, TEXT_A,);
      await nextDiagnostics(client,);
      await didOpen(client, B_URI, TEXT_B,);
      await nextDiagnostics(client,);

      // `dev` referenced in B (line 3) resolves to its declaration in A.
      const definition = await client.request("textDocument/definition", {
        textDocument: { uri: B_URI, },
        position: { line: 3, character: 12, },
      },);
      const def = definition.result as Location;
      assertEquals(def.uri, A_URI,);
      assertEquals(def.range.start.line, 2,);

      // references aggregate the whole workspace (both files).
      const references = await client.request("textDocument/references", {
        textDocument: { uri: B_URI, },
        position: { line: 3, character: 12, },
        context: { includeDeclaration: true, },
      },);
      const uris = new Set(
        (references.result as Location[]).map((r,) => r.uri),
      );
      assert(uris.has(A_URI,),);
      assert(uris.has(B_URI,),);

      assertEquals(await client.shutdown(), 0,);
    } finally {
      await client.close();
    }
  });
});

describe("LSP symbols and tokens over stdio (26.29.4)", () => {
  it("documentSymbol/workspaceSymbol/semanticTokens answer", async () => {
    const { client, } = await openSession();
    try {
      await didOpen(client, URI, TEXT,);
      await nextDiagnostics(client,);

      const docSymbol = await client.request("textDocument/documentSymbol", {
        textDocument: { uri: URI, },
      },);
      const symbols = docSymbol.result as {
        name: string;
        children?: unknown[];
      }[];
      assertEquals(symbols.length, 1,);
      assertEquals(symbols[0]!.name, "prj",);
      assertEquals(symbols[0]!.children?.length, 3,);

      const wsSymbol = await client.request("workspace/symbol", {
        query: "bu",
      },);
      assert(
        (wsSymbol.result as { name: string }[]).some((s,) =>
          s.name === "build"
        ),
      );

      const tokens = await client.request("textDocument/semanticTokens/full", {
        textDocument: { uri: URI, },
      },);
      const data = (tokens.result as { data: number[] }).data;
      assert(data.length > 0,);
      assertEquals(data.length % 5, 0,); // five integers per token.

      assertEquals(await client.shutdown(), 0,);
    } finally {
      await client.close();
    }
  });
});

describe("LSP diagnostics on the real corpus (26.29.5)", () => {
  it("a syntax-errors fixture publishes error diagnostics; stdout stays pure", async () => {
    // Read the committed corpus manifest and take the first syntax-error
    // fixture (referenced in place, like the engine e2e suites).
    const root = new URL("../../../", import.meta.url,);
    const manifest = JSON.parse(
      await Deno.readTextFile(new URL("tests/fixtures/corpus.json", root,),),
    ) as {
      groups: { id: string; fixtures: { id: string; path: string }[] }[];
    };
    const group = manifest.groups.find((g,) => g.id === "syntax-errors");
    assert(group !== undefined,);
    const fixture = group!.fixtures[0]!;
    const text = await Deno.readTextFile(new URL(fixture.path, root,),);

    const { client, } = await openSession();
    try {
      const uri = "file:///corpus-error.tjp";
      await didOpen(client, uri, text,);
      const published = await nextDiagnostics(client,);
      assertEquals(published.uri, uri,);
      assert(published.diagnostics.length > 0,);
      const first = published.diagnostics[0] as Diagnostic;
      assertEquals(first.source, "syntaxmesh",);
      assert(first.severity === 1 || first.severity === 2,);
      assert(first.message.length > 0,);
      assert(first.range.start.line >= 0,);
      assert(first.range.start.character >= 0,);

      assertEquals(await client.shutdown(), 0,);
      // stdout carried nothing but frames: no trailing log byte.
      assertEquals((await client.remaining()).byteLength, 0,);
    } finally {
      await client.close();
    }
  });
});
