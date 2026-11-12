/**
 * Testes do `getSemanticTokens` (22.1.13): legend estável, encoding delta,
 * fixture TJP completa e ordenação/round-trip. Inclui os casos tolerantes
 * (string/comment não fechados, `#` dentro de string).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  encodeSemanticTokens,
  getSemanticTokens,
  type PositionedToken,
  tokenize,
} from "../../src/lsp/semantic-tokens.ts";
import { SEMANTIC_TOKEN_TYPES, } from "../../src/lsp/capabilities.ts";
import type { AnalysisResult, } from "../../src/lsp/analyze.ts";

/** Análise sintética só com o texto (o parse não importa para os tokens). */
function analysisOf(text: string,): AnalysisResult {
  return {
    uri: "file:///a.tjp",
    text,
    version: 1,
    locale: "en",
    project: null,
    messages: [],
    ok: true,
  };
}

/** Decodifica o formato delta de volta para posições absolutas. */
function decode(data: number[],): PositionedToken[] {
  const tokens: PositionedToken[] = [];
  let line = 0;
  let character = 0;
  for (let i = 0; i < data.length; i += 5) {
    const deltaLine = data[i]!;
    const deltaStart = data[i + 1]!;
    line += deltaLine;
    character = deltaLine === 0 ? character + deltaStart : deltaStart;
    tokens.push({
      line,
      character,
      length: data[i + 2]!,
      type: SEMANTIC_TOKEN_TYPES[data[i + 3]!]!,
    },);
    assertEquals(data[i + 4], 0,); // sem modificadores no v1
  }
  return tokens;
}

describe("getSemanticTokens (22.1.13)", () => {
  it("legend: índices dos tipos batem com a ordem do contrato", () => {
    const data = getSemanticTokens(
      analysisOf('task t "Nome" {\n  effort 2\n}\n',),
    );
    const tokens = decode(data,);
    // task → keyword (índice 0), t → identifier (1), "Nome" → string (2),
    // effort → keyword, 2 → number (3).
    assertEquals(tokens[0], {
      line: 0,
      character: 0,
      length: 4,
      type: "keyword",
    },);
    assertEquals(tokens[1]!.type, "identifier",);
    assertEquals(tokens[1]!.length, 1,); // "t"
    assertEquals(tokens[2]!.type, "string",);
    assertEquals(tokens[2]!.length, 6,); // '"Nome"'
    assertEquals(tokens[3]!.type, "keyword",); // effort
    assertEquals(tokens[4]!.type, "number",);
    assertEquals(tokens[4]!.length, 1,); // "2"
  });

  it("encoding delta: mesma linha acumula, linha nova zera o caractere", () => {
    const tokens: PositionedToken[] = [
      { line: 0, character: 0, length: 4, type: "keyword", },
      { line: 0, character: 5, length: 1, type: "identifier", },
      { line: 2, character: 3, length: 2, type: "number", },
      { line: 2, character: 6, length: 1, type: "comment", },
    ];
    assertEquals(encodeSemanticTokens(tokens,), [
      0,
      0,
      4,
      0,
      0,
      0,
      5,
      1,
      1,
      0,
      2,
      3,
      2,
      3,
      0,
      0,
      3,
      1,
      5,
      0,
    ],);
    assertEquals(encodeSemanticTokens([],), [],);
  });

  it("fixture TJP: keywords, ids, strings, números, datas e comentários", () => {
    const text = [
      "# comentário de linha",
      'project prj "Probe" "1.0" 2026-01-01 - 2026-12-31 {',
      "  // outro comentário",
      "  /* bloco */",
      "}",
      'task t "Task" {',
      "  effort 2.5d",
      "  start 2026-02-01-10:00",
      "}",
      "",
    ].join("\n",);
    const tokens = tokenize(text,);
    const first = tokens[0]!;
    assertEquals(first.type, "comment",);
    assertEquals(first.line, 0,);
    assertEquals(first.character, 0,);
    // Linha 1: project(keyword) prj(id) "Probe"(string) "1.0"(string)
    // 2026-01-01(date) - 2026-12-31(date) {
    const line1 = tokens.filter((t,) => t.line === 1);
    assertEquals(
      line1.map((t,) => t.type),
      ["keyword", "identifier", "string", "string", "date", "date",],
    );
    assertEquals(line1[4]!.character, 26,); // posição exata da data
    // effort 2.5d → keyword + float + keyword "d" (unidade canônica).
    const line6 = tokens.filter((t,) => t.line === 6);
    assertEquals(
      line6.map((t,) => [t.type, t.length,]),
      [["keyword", 6,], ["number", 3,], ["keyword", 1,],],
    );
    // Data com hora continua um único token DATE.
    const line7 = tokens.filter((t,) => t.line === 7);
    assertEquals(line7[1]!.type, "date",);
    assertEquals(line7[1]!.length, "2026-02-01-10:00".length,);
    // Comentários de linha e de bloco presentes.
    assertEquals(tokens.filter((t,) => t.type === "comment").length, 3,);
  });

  it("ordenação: tokens em ordem de fonte e round-trip do delta", () => {
    const text = 'task a "A" {\n  depends b\n}\nresource r "R" {\n}\n';
    const data = getSemanticTokens(analysisOf(text,),);
    assertEquals(data.length % 5, 0,);
    const tokens = decode(data,);
    assertEquals(tokens, tokenize(text,),);
    // Deltas de linha nunca negativos; na mesma linha, caractere crescente.
    for (let i = 5; i < data.length; i += 5) {
      const sameLine = data[i] === 0;
      if (sameLine) {
        assertEquals(data[i + 1]! >= 0, true,);
      }
    }
  });

  it("tolerante: `#` dentro de string não vira comentário; não fechados", () => {
    const tokens = tokenize('note "a # b"\nunterminated "abc',);
    assertEquals(tokens[0]!.type, "keyword",); // note
    assertEquals(tokens[1]!.type, "string",); // "a # b" inteiro
    assertEquals(tokens[1]!.length, 7,);
    // String sem fechamento vai até o fim do texto, sem lançar.
    assertEquals(tokens[2]!.type, "identifier",); // "unterminated"
    assertEquals(tokens[3]!.type, "string",);
    assertEquals(tokens[3]!.length, 4,); // '"abc'
    // Comentário de bloco não fechado também não lança.
    const block = tokenize("/* aberto",);
    assertEquals(block, [
      { line: 0, character: 0, length: 9, type: "comment", },
    ],);
  });

  it("hora, float e id absoluto têm spans exatos", () => {
    const tokens = tokenize("start 10:30\nx prj.t1 0.5",);
    assertEquals(tokens[1], {
      line: 0,
      character: 6,
      length: 5,
      type: "number",
    },);
    // ABSOLUTE_ID vira um token só (identifier).
    assertEquals(tokens[3], {
      line: 1,
      character: 2,
      length: 6,
      type: "identifier",
    },);
    assertEquals(tokens[4]!.type, "number",); // 0.5
    assertEquals(tokens[4]!.length, 3,);
  });
});
