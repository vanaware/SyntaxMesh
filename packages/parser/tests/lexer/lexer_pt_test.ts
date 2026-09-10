import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { Lexer, } from "../../src/lexer/lexer.ts";
import { PORTUGUESE, } from "../../src/language/definitions.ts";
import type { Token, } from "../../src/lexer/token.ts";

describe("Portuguese Lexer", () => {
  it("should tokenize project keyword", () => {
    const lexer = new Lexer('projeto "Meu Projeto"', PORTUGUESE,);
    const lexResult = lexer.tokenize();
    const tokens = lexResult.tokens;
    assertEquals(tokens[0]?.type, "PROJECT",);
    assertEquals(tokens[0]?.value, "projeto",);
  });

  it("should tokenize task keyword", () => {
    const lexer = new Lexer('tarefa "Minha Tarefa"', PORTUGUESE,);
    const lexResult = lexer.tokenize();
    const tokens = lexResult.tokens;
    assertEquals(tokens[0]?.type, "TASK",);
    assertEquals(tokens[0]?.value, "tarefa",);
  });

  it("should handle mixed case keywords", () => {
    const lexer = new Lexer('PROJETO "Teste"', PORTUGUESE,);
    const lexResult = lexer.tokenize();
    const tokens = lexResult.tokens;
    assertEquals(tokens[0]?.type, "PROJECT",);
    assertEquals(tokens[0]?.value, "projeto",);
  });

  it("should tokenize duration units", () => {
    const lexer = new Lexer("duração 5 dias", PORTUGUESE,);
    const lexResult = lexer.tokenize();
    const tokens = lexResult.tokens;
    assertEquals(tokens[0]?.type, "DURATION",);
    assertEquals(tokens[1]?.type, "NUMBER",);
    assertEquals(tokens[2]?.type, "TIME_UNIT",);
    assertEquals(tokens[2]?.value, "dias",);
  });
});
