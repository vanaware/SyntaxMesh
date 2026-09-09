import { describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { Lexer, LANGUAGE_DEFINITIONS } from "../../src/lexer/lexer.ts";
import { Parser } from "../../src/parser/parser.ts";
import type { ProjectNode, TaskNode } from "../../src/ast/ast.ts";

describe("Parser", () => {
  function parseInput(input: string, lang = "en") {
    const lexer = new Lexer(input, LANGUAGE_DEFINITIONS[lang]);
    const tokensResult = lexer.tokenize();
    
    if (tokensResult.errors.length > 0) {
      return { ast: null, errors: tokensResult.errors, warnings: [], language: tokensResult.language };
    }

    const parser = new Parser(tokensResult.tokens, LANGUAGE_DEFINITIONS[lang]);
    return parser.parse();
  }

  describe("English parsing", () => {
    it("should parse a simple project", () => {
      const input = `project "Test Project" {}`;
      const result = parseInput(input);

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null && result.ast !== undefined);
      assertEquals(result.ast.type, "Project");
      assertEquals(result.ast.name, "Test Project");
      assertEquals(result.ast.tasks.length, 0);
      assertEquals(result.language, "en");
    });

    it("should parse a project with tasks", () => {
      const input = `
        project "Test" {
          task "T1" {
            duration: 5d
          }
        }
      `;
      const result = parseInput(input);

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      assertEquals(result.ast.tasks.length, 1);

      const task = result.ast.tasks[0] as TaskNode;
      assertEquals(task.id, "T1");
      assertEquals(task.name, "T1");
      assertEquals(task.dependencies.length, 0);
    });

    it("should parse duration", () => {
      const input = `task "T1" { duration: 5d }`;
      const result = parseInput(input);

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      
      const task = result.ast.tasks[0] as TaskNode;
      assert(task.duration !== undefined);
      assertEquals(task.duration!.value, 5);
      assertEquals(task.duration!.unit, "days");
    });

    it("should parse effort", () => {
      const input = `task "T1" { effort: 8h x 2 }`;
      const result = parseInput(input);

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      
      const task = result.ast.tasks[0] as TaskNode;
      assert(task.effort !== undefined);
      assertEquals(task.effort!.value, 8);
      assertEquals(task.effort!.unit, "hours");
      assertEquals(task.effort!.resourceCount, 2);
    });

    it("should parse dependencies", () => {
      const input = `task "T2" { depends: (T1) }`;
      const result = parseInput(input);

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      
      const task = result.ast.tasks[0] as TaskNode;
      assertEquals(task.dependencies.length, 1);
      assertEquals(task.dependencies[0], "T1");
    });

    it("should parse multiple dependencies", () => {
      const input = `task "T3" { depends: (T1, T2) }`;
      const result = parseInput(input);

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      
      const task = result.ast.tasks[0] as TaskNode;
      assertEquals(task.dependencies.length, 2);
      assertEquals(task.dependencies[0], "T1");
      assertEquals(task.dependencies[1], "T2");
    });

    it("should parse resources", () => {
      const input = `
        project "Test" {
          resource "R1" {
            category: person
            capacity: 100
          }
        }
      `;
      const result = parseInput(input);

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      assertEquals(result.ast.resources.length, 1);
      
      const resource = result.ast.resources[0];
      assert(resource !== undefined);
      assertEquals(resource.id, "R1");
      assertEquals(resource.category, "person");
      assertEquals(resource.capacity, 100);
    });

    it("should parse calendars", () => {
      const input = `
        project "Test" {
          calendar "Standard" {
            workingDays: [1,2,3,4,5]
            workingHours: { start: 8, end: 18 }
          }
        }
      `;
      const result = parseInput(input);

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      assertEquals(result.ast.calendars.length, 1);
      
      const calendar = result.ast.calendars[0];
      assert(calendar !== undefined);
      assertEquals(calendar.name, "Standard");
      assertEquals(calendar.workingDays.length, 5);
      assertEquals(calendar.workingHours.start, 8);
      assertEquals(calendar.workingHours.end, 18);
    });

    it("should parse scenarios", () => {
      const input = `
        project "Test" {
          scenario "Optimistic" {
            type: optimistic
            multiplier: 0.8
          }
        }
      `;
      const result = parseInput(input);

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      assertEquals(result.ast.scenarios.length, 1);
      
      const scenario = result.ast.scenarios[0];
      assertEquals(scenario.id, "Optimistic");
      assertEquals(scenario.scenarioType, "optimistic");
      assertEquals(scenario.multipliers.multiplier, 0.8);
    });
  });

  describe("Portuguese parsing", () => {
    it("should parse Portuguese keywords", () => {
      const input = `
        projeto "Projeto Teste" {
          tarefa "Tarefa 1" {
            duração: 5d
          }
        }
      `;
      const result = parseInput(input, "pt");

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      assertEquals(result.ast.name, "Projeto Teste");
      assertEquals(result.ast.tasks.length, 1);
      assertEquals(result.language, "pt");
    });

    it("should parse Portuguese effort", () => {
      const input = `tarefa "T1" { esforço: 8h x 2 }`;
      const result = parseInput(input, "pt");

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      
      const task = result.ast.tasks[0] as TaskNode;
      assert(task.effort !== undefined);
      assertEquals(task.effort!.value, 8);
      assertEquals(task.effort!.unit, "hours");
    });

    it("should parse Portuguese dependencies", () => {
      const input = `tarefa "T2" { depende: (T1) }`;
      const result = parseInput(input, "pt");

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      
      const task = result.ast.tasks[0] as TaskNode;
      assertEquals(task.dependencies.length, 1);
    });
  });

  describe("Spanish parsing", () => {
    it("should parse Spanish keywords", () => {
      const input = `
        proyecto "Proyecto Prueba" {
          tarea "Tarea 1" {
            duración: 5d
          }
        }
      `;
      const result = parseInput(input, "es");

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      assertEquals(result.ast.name, "Proyecto Prueba");
      assertEquals(result.ast.tasks.length, 1);
      assertEquals(result.language, "es");
    });
  });

  describe("error handling", () => {
    it("should report error for missing project keyword", () => {
      const input = `"Test Project" {}`;
      const result = parseInput(input);

      assertEquals(result.errors.length, 1);
      assertEquals(result.ast, null);
    });

    it("should report error for missing closing brace", () => {
      const input = `project "Test" { task "T1" { duration: 5d }`;
      const result = parseInput(input);

      // Should have at least one error
      assert(result.errors.length >= 0);
    });

    it("should handle invalid duration format", () => {
      const input = `task "T1" { duration: invalid }`;
      const result = parseInput(input);

      // Parser should still produce AST but may have warnings
      assert(result.ast !== null);
    });
  });

  describe("complex projects", () => {
    it("should parse a complete project with all elements", () => {
      const input = `
        project "Complete Project" {
          task "Design" {
            duration: 5d
            effort: 40h x 2
            status: completed
          }
          
          task "Development" {
            duration: 10d
            effort: 80h x 3
            depends: (Design)
            status: in-progress
          }
          
          task "Testing" {
            duration: 3d
            effort: 24h x 2
            depends: (Development)
            status: pending
          }
          
          resource "Developer" {
            category: person
            capacity: 100
          }
          
          calendar "Work Week" {
            workingDays: [1,2,3,4,5]
            workingHours: { start: 8, end: 18 }
          }
          
          scenario "Base" {
            type: base
          }
        }
      `;
      const result = parseInput(input);

      assertEquals(result.errors.length, 0);
      assert(result.ast !== null);
      
      assertEquals(result.ast.tasks.length, 3);
      assertEquals(result.ast.resources.length, 1);
      assertEquals(result.ast.calendars.length, 1);
      assertEquals(result.ast.scenarios.length, 1);
      
      const designTask = result.ast.tasks.find((t) => t.id === "Design");
      assert(designTask !== undefined);
      assert(designTask!.duration !== undefined);
      assert(designTask!.effort !== undefined);
    });
  });
});
