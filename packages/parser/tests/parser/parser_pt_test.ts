import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, fail, } from "@std/assert";
import { Parser, } from "../../src/parser/parser.ts";
import { PORTUGUESE, } from "../../src/language/definitions.ts";

describe("Portuguese Parser", () => {
  it("should parse a simple project", () => {
    const input = `projeto "Meu Projeto" {
      tarefa "Tarefa 1" {
        duração 5 dias
      }
    }`;

    const parser = new Parser(input, PORTUGUESE,);
    const ast = parser.parse();

    // The AST is the project node itself
    if (ast.ast) {
      assertEquals(ast.ast.type, "Project",);
      assertEquals(ast.ast.name, "Meu Projeto",);
      assertEquals(ast.ast.tasks.length, 1,);
      const task0 = ast.ast.tasks[0];
      assert(task0 !== undefined,);
      assertEquals(task0.name, "Tarefa 1",);
      assert(task0.duration !== undefined,);
      assertEquals(task0.duration.value, 5,);
      assertEquals(task0.duration.unit, "days",);
    } else {
      fail("Expected ast.ast to be defined",);
    }
  });

  it("should handle dependencies", () => {
    const input = `projeto "Dependências" {
      tarefa "A" {}
      tarefa "B" {
        depende A
      }
    }`;

    const parser = new Parser(input, PORTUGUESE,);
    const ast = parser.parse();

    // The AST is the project node itself
    if (ast.ast) {
      assertEquals(ast.ast.tasks.length, 2,);
      const task1 = ast.ast.tasks[1];
      assert(task1 !== undefined,);
      assertEquals(task1.dependencies.length, 1,);
      assertEquals(task1.dependencies[0], "a",); // Identificadores são normalizados para minúsculas
    } else {
      fail("Expected ast.ast to be defined",);
    }
  });

  it("should parse resource definitions", () => {
    const input = `projeto "Recursos" {
      recurso "João" {
        categoria person
        capacidade 100
      }
    }`;

    const parser = new Parser(input, PORTUGUESE,);
    const ast = parser.parse();

    // The AST is the project node itself
    if (ast.ast) {
      assertEquals(ast.ast.resources.length, 1,);
      const resource0 = ast.ast.resources[0];
      assert(resource0 !== undefined,);
      assertEquals(resource0.name, "João",);
      assertEquals(resource0.capacity, 100,);
    } else {
      fail("Expected ast.ast to be defined",);
    }
  });
});
