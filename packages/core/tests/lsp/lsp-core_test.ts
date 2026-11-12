/**
 * Testes do workspace `lsp-core` (22.1.2/22.1.4): o subpath export resolve e
 * o gate de pureza `check:lspcore` aceita o que deve e falha no que não deve.
 *
 * O caso negativo do gate é exercitado sobre a função pura
 * `findLspViolations` — nenhum arquivo proibido é escrito em disco.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.1
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
// Import do subpath publicado (workspace self-reference): prova o wiring do
// `"./lsp-core"` em `packages/core/deno.jsonc` (22.1.2).
import * as lspCore from "@vanaware/syntaxmesh/lsp-core";
import {
  findLspViolations,
  LSP_FORBIDDEN,
} from "../../../../scripts/check-lspcore.ts";

describe("lsp-core subpath export (22.1.2)", () => {
  it("o subpath @vanaware/syntaxmesh/lsp-core resolve", () => {
    // O barril ainda não tem exports de runtime (os serviços chegam no
    // P2.4); o que importa é o módulo resolver sem puxar transporte.
    assertEquals(typeof lspCore, "object",);
  });

  it("o barril não vaza para o módulo raiz (decisão 22.1b.7.3)", async () => {
    const root = await import("@vanaware/syntaxmesh");
    assert(!("LspTypes" in root),);
    assert(!("registerLspServer" in root),);
  });
});

describe("check:lspcore — gate de pureza (22.1.4)", () => {
  it("código puro passa: tipos LSP + imports relativos do core", () => {
    const text = [
      'import type { Diagnostic, } from "vscode-languageserver-types";',
      'import { TaskJuggler, } from "../mod.ts";',
      'import { syntaxReference, } from "../docgen/mod.ts";',
      "export function noop(): number {",
      "  return 1;",
      "}",
    ].join("\n",);
    assertEquals(findLspViolations("pure.ts", text,), [],);
  });

  it("comentários citando os módulos proibidos não contam", () => {
    const text = [
      "// o runtime vscode-languageserver fica fora do lsp-core",
      " * Deno.stdin é transporte do hospedeiro",
      'import type { Position, } from "vscode-languageserver-types";',
    ].join("\n",);
    assertEquals(findLspViolations("prose.ts", text,), [],);
  });

  it("caso negativo: runtime vscode-languageserver falha", () => {
    const text =
      'import { createConnection, } from "npm:vscode-languageserver";';
    const violations = findLspViolations("bad.ts", text,);
    assertEquals(violations.length, 1,);
    assertEquals(violations[0]!.line, 1,);
    assert(violations[0]!.reason.includes("vscode-languageserver",),);
  });

  it("caso negativo: vscode-languageclient falha", () => {
    const text = 'import { LanguageClient, } from "vscode-languageclient";';
    assertEquals(findLspViolations("bad.ts", text,).length, 1,);
  });

  it("caso negativo: API vscode falha", () => {
    const text = 'import * as vscode from "vscode";';
    assertEquals(findLspViolations("bad.ts", text,).length, 1,);
  });

  it("caso negativo: node:* falha", () => {
    const text = 'import { readFileSync, } from "node:fs";';
    assertEquals(findLspViolations("bad.ts", text,).length, 1,);
  });

  it("caso negativo: Deno.stdin/stdout falham", () => {
    const text = [
      "const input = Deno.stdin;",
      "const output = Deno.stdout;",
    ].join("\n",);
    assertEquals(findLspViolations("bad.ts", text,).length, 2,);
  });

  it("caso negativo: import dinâmico do runtime também falha", () => {
    const text = 'const lib = await import("vscode-languageserver");';
    assertEquals(findLspViolations("bad.ts", text,).length, 1,);
  });

  it("todas as famílias proibidas têm regra registrada", () => {
    // Uma regra por família do plano §5.1 (transporte, API, node, stdio).
    assertEquals(LSP_FORBIDDEN.length, 5,);
  });
});
