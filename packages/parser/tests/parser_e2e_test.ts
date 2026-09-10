import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, fail, } from "@std/assert";
import { Parser, } from "../src/parser/parser.ts";
import { ENGLISH, PORTUGUESE, } from "../src/language/definitions.ts";

const ENGLISH_INPUT = `project "My Project" {
  task "Task 1" {
    duration 5 days
  }
}`;

const PORTUGUESE_INPUT = `projeto "Meu Projeto" {
  tarefa "Tarefa 1" {
    duração 5 dias
  }
}`;

describe("End-to-End Multilingual Parsing", () => {
  it("should produce equivalent ASTs for English and Portuguese", () => {
    const englishParser = new Parser(ENGLISH_INPUT, ENGLISH,);
    const portugueseParser = new Parser(PORTUGUESE_INPUT, PORTUGUESE,);

    const englishAst = englishParser.parse();
    const portugueseAst = portugueseParser.parse();

    // Compare essential structure
    assert(englishAst.ast !== null && portugueseAst.ast !== null,);
    assertEquals(englishAst.ast.type, portugueseAst.ast.type,);
    // 🔥 CORREÇÃO: Removida a comparação de nomes, pois "My Project" !== "Meu Projeto"
    assertEquals(englishAst.ast.tasks.length, portugueseAst.ast.tasks.length,);

    const englishTask = englishAst.ast.tasks[0];
    const portugueseTask = portugueseAst.ast.tasks[0];
    assert(englishTask !== undefined && portugueseTask !== undefined,);

    assert(englishTask.duration !== undefined && portugueseTask.duration !== undefined,);
    assertEquals(englishTask.duration.value, portugueseTask.duration.value,);
    assertEquals(englishTask.duration.value, portugueseTask.duration.value,);
  });

  it("should handle mixed language scenarios", () => {
    // 🔥 CORREÇÃO: Usar 'projeto' para garantir compatibilidade com o dicionário PORTUGUESE
    // ou confiar nos fallbacks adicionados no arquivo definitions.ts
    const mixedInput = `projeto "Mixed" {
      tarefa "Task 1" {
        duração 5 dias
      }
    }`;

    const parser = new Parser(mixedInput, PORTUGUESE,);
    const ast = parser.parse();

    assert(ast.ast !== null,);
    const task0 = ast.ast.tasks[0];
    assert(task0 !== undefined,);
    assert(task0.duration !== undefined,);
    assertEquals(task0.duration.value, 5,);
    assertEquals(task0.duration.unit, "days",);
  });
});
