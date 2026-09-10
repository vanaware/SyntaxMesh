import { describe, it } from '@std/testing/bdd';
import { assertEquals } from '@std/assert';
import { Parser } from '../src/parser/parser.ts';
import { ENGLISH, PORTUGUESE } from '../src/language/definitions.ts';

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

describe('End-to-End Multilingual Parsing', () => {
  it('should produce equivalent ASTs for English and Portuguese', () => {
    const englishParser = new Parser(ENGLISH_INPUT, ENGLISH);
    const portugueseParser = new Parser(PORTUGUESE_INPUT, PORTUGUESE);

    const englishAst = englishParser.parse();
    const portugueseAst = portugueseParser.parse();

    // Compare essential structure
    assertEquals(englishAst.type, portugueseAst.type);
    assertEquals(englishAst.name, portugueseAst.name);
    assertEquals(englishAst.tasks.length, portugueseAst.tasks.length);
    
    const englishTask = englishAst.tasks[0];
    const portugueseTask = portugueseAst.tasks[0];
    
    assertEquals(englishTask.name, portugueseTask.name);
    assertEquals(englishTask.duration.value, portugueseTask.duration.value);
    // Note: The unit will be normalized to canonical form (e.g., 'day' for both)
    // We're testing that the duration value is correctly parsed
    assertEquals(englishTask.duration.value, portugueseTask.duration.value);
  });

  it('should handle mixed language scenarios', () => {
    const mixedInput = `project "Mixed" {
      tarefa "Task 1" {
        duração 5 dias
      }
    }`;

    const parser = new Parser(mixedInput, PORTUGUESE);
    const ast = parser.parse();

    assertEquals(ast.tasks[0].duration.value, 5);
    // The unit should be normalized to canonical form
    assertEquals(ast.tasks[0].duration.unit, 'day');
  });
});