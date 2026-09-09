import { describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { Lexer, LANGUAGE_DEFINITIONS } from "../../src/lexer/lexer.ts";
import { type Token, EOF } from "../../src/lexer/token.ts";

describe("Lexer", () => {
  describe("tokenize", () => {
    it("should tokenize a simple project in English", () => {
      const input = `
        project "Test Project" {
          task "Task 1" {
            duration: 5d
          }
        }
      `;

      const lexer = new Lexer(input, LANGUAGE_DEFINITIONS.en);
      const result = lexer.tokenize();

      assertEquals(result.errors.length, 0);
      assertEquals(result.language, "en");
      assert(result.tokens !== null && result.tokens.length > 0);
      const tokens = result.tokens;
      assert(tokens.length > 0);
      assertEquals(tokens[tokens.length - 1].type, "EOF");
    });

    it("should tokenize keywords", () => {
      const input = `project "Test" { task "T1" {} }`;
      const lexer = new Lexer(input, LANGUAGE_DEFINITIONS.en);
      const result = lexer.tokenize();

      const types = result.tokens.map((t) => t.type);
      assert(types.includes("PROJECT"));
      assert(types.includes("TASK"));
    });

    it("should tokenize numbers", () => {
      const input = `duration: 5d effort: 8h x 2`;
      const lexer = new Lexer(input, LANGUAGE_DEFINITIONS.en);
      const result = lexer.tokenize();

      const numberTokens = result.tokens.filter((t) => t.type === "NUMBER");
      assertEquals(numberTokens.length, 3);
      assert(numberTokens.length > 0);
      assertEquals((numberTokens[0] as Token).value, "5");
      assertEquals(numberTokens[1].value, "8");
      assertEquals(numberTokens[2].value, "2");
    });

    it("should tokenize strings", () => {
      const input = `project "My Project" task "Task One"`;
      const lexer = new Lexer(input, LANGUAGE_DEFINITIONS.en);
      const result = lexer.tokenize();

      const stringTokens = result.tokens.filter((t) => t.type === "STRING");
      assertEquals(stringTokens.length, 2);
      assert(stringTokens.length > 0);
      assertEquals(stringTokens[0].value, "My Project");
      assertEquals(stringTokens[1].value, "Task One");
    });

    it("should tokenize time units", () => {
      const input = `5d 8h 2w 30m`;
      const lexer = new Lexer(input, LANGUAGE_DEFINITIONS.en);
      const result = lexer.tokenize();

      const unitTokens = result.tokens.filter((t) => t.type === "TIME_UNIT");
      assertEquals(unitTokens.length, 4);
      assert(unitTokens.length > 0);
      assertEquals(unitTokens[0].value, "d");
      assertEquals(unitTokens[1].value, "h");
      assertEquals(unitTokens[2].value, "w");
      assertEquals(unitTokens[3].value, "m");
    });

    it("should skip whitespace", () => {
      const input = `   project    "Test"   `;
      const lexer = new Lexer(input, LANGUAGE_DEFINITIONS.en);
      const result = lexer.tokenize();

      // Should not have extra tokens for whitespace
      const nonWhitespaceTokens = result.tokens.filter(
        (t) => t.type !== "EOF",
      );
      assertEquals(nonWhitespaceTokens.length, 3); // project, string, EOF
    });

    it("should handle comments", () => {
      const input = `# This is a comment\nproject "Test" # inline comment`;
      const lexer = new Lexer(input, LANGUAGE_DEFINITIONS.en);
      const result = lexer.tokenize();

      assertEquals(result.errors.length, 0);
      assert(result.tokens.some((t) => t.type === "PROJECT"));
    });
  });

  describe("Portuguese language", () => {
    it("should tokenize Portuguese keywords", () => {
      const input = `
        projeto "Projeto Teste" {
          tarefa "Tarefa 1" {
            duração: 5d
          }
        }
      `;

      const lexer = new Lexer(input, LANGUAGE_DEFINITIONS.pt);
      const result = lexer.tokenize();

      assertEquals(result.errors.length, 0);
      assertEquals(result.language, "pt");

      const types = result.tokens.map((t) => t.type);
      assert(types.includes("PROJECT"));
      assert(types.includes("TASK"));
      assert(types.includes("DURATION"));
    });

    it("should recognize Portuguese time units", () => {
      const input = `horas: 8 dias: 5 semanas: 2`;
      const lexer = new Lexer(input, LANGUAGE_DEFINITIONS.pt);
      const result = lexer.tokenize();

      const unitTokens = result.tokens.filter((t) => t.type === "TIME_UNIT");
      assertEquals(unitTokens.length, 3);
    });
  });

  describe("Spanish language", () => {
    it("should tokenize Spanish keywords", () => {
      const input = `
        proyecto "Proyecto Prueba" {
          tarea "Tarea 1" {
            duración: 5d
          }
        }
      `;

      const lexer = new Lexer(input, LANGUAGE_DEFINITIONS.es);
      const result = lexer.tokenize();

      assertEquals(result.errors.length, 0);
      assertEquals(result.language, "es");

      const types = result.tokens.map((t) => t.type);
      assert(types.includes("PROJECT"));
      assert(types.includes("TASK"));
      assert(types.includes("DURATION"));
    });
  });

  describe("position tracking", () => {
    it("should track line and column positions", () => {
      const input = `project "Test"\ntask "T1"`;
      const lexer = new Lexer(input, LANGUAGE_DEFINITIONS.en);
      const result = lexer.tokenize();

      const projectToken = result.tokens.find((t) => t.value === "project");
      const stringToken = result.tokens.find((t) => t.value === "Test");
      const taskToken = result.tokens.find((t) => t.value === "t1");

      assert(projectToken);
      assertEquals(projectToken.line, 1);
      assertEquals(projectToken.column, 0);

      assert(stringToken);
      assertEquals(stringToken.line, 1);

      assert(taskToken);
      assertEquals(taskToken.line, 2);
    });
  });
});
