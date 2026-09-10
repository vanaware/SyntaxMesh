import { describe, it } from '@std/testing/bdd';
import { assertEquals } from '@std/assert';
import { Parser } from '../../src/parser/parser.ts';
import { PORTUGUESE } from '../../src/language/definitions.ts';

describe('Portuguese Parser', () => {
  it('should parse a simple project', () => {
    const input = `projeto "Meu Projeto" {
      tarefa "Tarefa 1" {
        duração 5 dias
      }
    }`;
    
    const parser = new Parser(input, PORTUGUESE);
    const ast = parser.parse();
    
    // The AST is the project node itself
    if (ast.ast) {
      assertEquals(ast.ast.type, 'Project');
      assertEquals(ast.ast.name, 'Meu Projeto');
      assertEquals(ast.ast.tasks.length, 1);
      assertEquals(ast.ast.tasks[0].name, 'Tarefa 1');
      assertEquals(ast.ast.tasks[0].duration.value, 5);
      assertEquals(ast.ast.tasks[0].duration.unit, 'day');
    } else {
      fail('Expected ast.ast to be defined');
    }
  });

  it('should handle dependencies', () => {
    const input = `projeto "Dependências" {
      tarefa "A" {}
      tarefa "B" {
        depende A
      }
    }`;

    const parser = new Parser(input, PORTUGUESE);
    const ast = parser.parse();

    // The AST is the project node itself
    if (ast.ast) {
      assertEquals(ast.ast.tasks.length, 2);
      assertEquals(ast.ast.tasks[1].dependencies.length, 1);
      assertEquals(ast.ast.tasks[1].dependencies[0].target, 'A');
    } else {
      fail('Expected ast.ast to be defined');
    }
  });

  it('should parse resource definitions', () => {
    const input = `projeto "Recursos" {
      recurso "João" {
        disponibilidade 8 horas
      }
    }`;

    const parser = new Parser(input, PORTUGUESE);
    const ast = parser.parse();

    // The AST is the project node itself
    if (ast.ast) {
      assertEquals(ast.ast.resources.length, 1);
      assertEquals(ast.ast.resources[0].name, 'João');
      assertEquals(ast.ast.resources[0].availability.value, 'full-time');
    } else {
      fail('Expected ast.ast to be defined');
    }
  });
});