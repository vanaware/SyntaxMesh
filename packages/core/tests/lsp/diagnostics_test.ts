/**
 * Testes do `toDiagnostics` (22.1.8): severidades, conversão de posição
 * 1-based → 0-based e mensagens sem `sourceFileInfo`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { toDiagnostics, } from "../../src/lsp/diagnostics.ts";
import type { AnalysisResult, } from "../../src/lsp/analyze.ts";
import { Message, } from "../../src/message.ts";
import { SourceFileInfo, } from "../../src/source-file-info.ts";

/** Análise sintética só com as mensagens dadas (o parse não importa aqui). */
function analysisWith(messages: Message[],): AnalysisResult {
  return {
    uri: "file:///a.tjp",
    text: "",
    version: 1,
    locale: "en",
    project: null,
    messages,
    ok: messages.length === 0,
  };
}

describe("toDiagnostics (22.1.8)", () => {
  it("error vira Diagnostic de severidade Error com source e code", () => {
    const analysis = analysisWith([
      new Message(
        "error",
        "no_reduce",
        "Unexpected token",
        new SourceFileInfo("file:///a.tjp", 2, 3,),
      ),
    ],);
    const diagnostics = toDiagnostics(analysis,);
    assertEquals(diagnostics.length, 1,);
    assertEquals(diagnostics[0]!.severity, 1,);
    assertEquals(diagnostics[0]!.source, "syntaxmesh",);
    assertEquals(diagnostics[0]!.code, "no_reduce",);
    assertEquals(diagnostics[0]!.message, "Unexpected token",);
  });

  it("warning vira Warning; info/debug ficam fora", () => {
    const analysis = analysisWith([
      new Message("warning", "w_id", "A warning",),
      new Message("info", "i_id", "Info",),
      new Message("debug", "d_id", "Debug",),
      new Message("fatal", "f_id", "Fatal",),
    ],);
    const diagnostics = toDiagnostics(analysis,);
    assertEquals(diagnostics.length, 2,);
    assertEquals(diagnostics[0]!.severity, 2,);
    // fatal compartilha a severidade de error.
    assertEquals(diagnostics[1]!.severity, 1,);
  });

  it("posição 1-based do engine vira 0-based do protocolo (com clamp)", () => {
    const analysis = analysisWith([
      new Message(
        "error",
        "e1",
        "x",
        new SourceFileInfo("file:///a.tjp", 5, 7,),
      ),
      // O engine às vezes reporta coluna 0 — não pode virar -1.
      new Message(
        "error",
        "e2",
        "y",
        new SourceFileInfo("file:///a.tjp", 4, 0,),
      ),
    ],);
    const diagnostics = toDiagnostics(analysis,);
    assertEquals(diagnostics[0]!.range.start, { line: 4, character: 6, },);
    assertEquals(diagnostics[0]!.range.end, { line: 4, character: 6, },);
    assertEquals(diagnostics[1]!.range.start, { line: 3, character: 0, },);
  });

  it("sem sourceFileInfo o diagnóstico cai no início do arquivo", () => {
    const analysis = analysisWith([
      new Message("error", "no_sfi", "Sem localização",),
    ],);
    const diagnostics = toDiagnostics(analysis,);
    assertEquals(diagnostics[0]!.range.start, { line: 0, character: 0, },);
  });
});
