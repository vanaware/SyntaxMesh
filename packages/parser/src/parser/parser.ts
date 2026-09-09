/// <reference lib="deno.ns" />

// ============================================================================
// 📝 Parser — Analisador sintático para SyntaxMesh
// ============================================================================

import { type Token, EOF, Lexer, type LanguageDefinition, LANGUAGE_DEFINITIONS } from "../lexer/lexer.ts";
import {
  type ProjectNode,
  type TaskNode,
  type ResourceNode,
  type CalendarNode,
  type ScenarioNode,
  type EffortNode,
  type DurationNode,
  type DateNode,
  type StatusNode,
  type AvailabilityNode,
  type WorkingHoursNode,
  type LanguageDirectiveNode,
} from "../ast/ast.ts";

/**
 * Resultado do parsing
 */
export interface ParseResult {
  ast: ProjectNode | null;
  errors: string[];
  warnings: string[];
  language: string;
}

/**
 * Parser para SyntaxMesh
 */
export class Parser {
  private tokens: Token[];
  private current: number;
  private errors: string[];
  private warnings: string[];
  private currentLanguage: LanguageDefinition;

  constructor(tokens: Token[], language: LanguageDefinition = LANGUAGE_DEFINITIONS.en) {
    this.tokens = tokens;
    this.current = 0;
    this.errors = [];
    this.warnings = [];
    this.currentLanguage = language;
  }

  /**
   * Executa o parsing completo
   */
  parse(): ParseResult {
    // Verifica se há diretiva de idioma
    let languageCode = "en";

    if (this.peek().type === "LANGUAGE") {
      const langDirective = this.parseLanguageDirective();
      if (langDirective) {
        languageCode = langDirective.languageCode;
        const def = LANGUAGE_DEFINITIONS[langDirective.languageCode];
        if (def) {
          this.currentLanguage = def;
        }
      }
    }

    // Espera por PROJECT
    if (this.check("PROJECT")) {
      const project = this.parseProject();
      return {
        ast: project,
        errors: this.errors,
        warnings: this.warnings,
        language: languageCode,
      };
    }

    this.error("Esperado 'project' no início do arquivo");
    return {
      ast: null,
      errors: this.errors,
      warnings: this.warnings,
      language: languageCode,
    };
  }

  /**
   * Consume o token atual e avança
   */
  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  /**
   * Verifica se chegou ao fim dos tokens
   */
  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  /**
   * Retorna o token atual
   */
  private peek(): Token {
    return this.tokens[this.current];
  }

  /**
   * Retorna o token anterior
   */
  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  /**
   * Verifica se o token atual é do tipo esperado
   */
  private check(...types: string[]): boolean {
    return types.includes(this.peek().type);
  }

  /**
   * Verifica se o token atual corresponde a um tipo específico
   */
  private match(...types: string[]): Token | undefined {
    for (const type of types) {
      if (this.check(type)) {
        return this.advance();
      }
    }
    return undefined;
  }

  /**
   * Consome um token do tipo esperado ou lança erro
   */
  private expect(type: string, message: string): Token {
    if (this.check(type)) {
      return this.advance();
    }
    this.error(message);
    return this.peek();
  }

  /**
   * Registra um erro
   */
  private error(message: string): void {
    const token = this.peek();
    this.errors.push(`Linha ${token.line}, coluna ${token.column}: ${message}`);
  }

  /**
   * Registra um aviso
   */
  private warn(message: string): void {
    const token = this.peek();
    this.warnings.push(`Linha ${token.line}, coluna ${token.column}: ${message}`);
  }

  /**
   * Parseia diretiva de idioma
   */
  private parseLanguageDirective(): LanguageDirectiveNode | null {
    this.expect("LANGUAGE", "Esperado 'language'");

    const languageCode = this.expect("IDENTIFIER", "Esperado código do idioma").value;
    this.expect("COLON", "Esperado ':' após código do idioma");

    const languageName = this.expect("STRING", "Esperado nome do idioma entre aspas").value;

    return {
      type: "LanguageDirective",
      languageCode,
      languageName,
      position: 0,
      line: 1,
      column: 1,
    };
  }

  /**
   * Parseia um projeto
   */
  private parseProject(): ProjectNode {
    this.expect("PROJECT", "Esperado 'project'");
    this.expect("LBRACE", "Esperado '{' após 'project'");

    const name = this.expect("STRING", "Esperado nome do projeto entre aspas").value;
    
    const tasks: TaskNode[] = [];
    const resources: ResourceNode[] = [];
    const calendars: CalendarNode[] = [];
    const scenarios: ScenarioNode[] = [];

    while (!this.check("RBRACE") && !this.isAtEnd()) {
      if (this.check("TASK")) {
        tasks.push(this.parseTask());
      } else if (this.check("RESOURCE")) {
        resources.push(this.parseResource());
      } else if (this.check("CALENDAR")) {
        calendars.push(this.parseCalendar());
      } else if (this.check("SCENARIO")) {
        scenarios.push(this.parseScenario());
      } else {
        this.advance(); // Pula token desconhecido
      }
    }

    this.expect("RBRACE", "Esperado '}' fechando o projeto");

    return {
      type: "Project",
      language: this.currentLanguage.code,
      name,
      tasks,
      resources,
      calendars,
      scenarios,
      position: 0,
      line: 1,
      column: 1,
    };
  }

  /**
   * Parseia uma tarefa
   */
  private parseTask(): TaskNode {
    this.expect("TASK", "Esperado 'task'");
    this.expect("LBRACE", "Esperado '{' após 'task'");

    const id = this.expect("IDENTIFIER", "Esperado ID da tarefa").value;
    const name = this.expect("STRING", "Esperado nome da tarefa entre aspas").value;

    const dependencies: string[] = [];
    let effort: EffortNode | undefined;
    let duration: DurationNode | undefined;
    let status: StatusNode | undefined;

    while (!this.check("RBRACE") && !this.isAtEnd()) {
      if (this.check("DURATION")) {
        duration = this.parseDuration();
      } else if (this.check("EFFORT")) {
        effort = this.parseEffort();
      } else if (this.check("DEPENDS")) {
        dependencies.push(...this.parseDependencies());
      } else if (this.check("STATUS")) {
        status = this.parseStatus();
      } else {
        this.advance();
      }
    }

    this.expect("RBRACE", "Esperado '}' fechando a tarefa");

    return {
      type: "Task",
      id,
      name,
      duration,
      effort,
      dependencies,
      position: 0,
      line: 1,
      column: 1,
    };
  }

  /**
   * Parseia duração
   */
  private parseDuration(): DurationNode {
    this.expect("DURATION", "Esperado 'duration'");
    this.expect("COLON", "Esperado ':' após 'duration'");

    const valueToken = this.expect("NUMBER", "Esperado número para duração").value;
    const unitToken = this.expect("TIME_UNIT", "Esperado unidade de tempo").value;

    // Mapeia unidade abreviada para canônica
    const unitMap: Record<string, "minutes" | "hours" | "days" | "weeks" | "months"> = {
      m: "minutes",
      h: "hours",
      d: "days",
      w: "weeks",
      mo: "months",
    };

    const unit = unitMap[unitToken.toLowerCase()] || "hours";

    return {
      type: "Duration",
      value: parseFloat(valueToken),
      unit,
      position: 0,
      line: 1,
      column: 1,
    };
  }

  /**
   * Parseia esforço
   */
  private parseEffort(): EffortNode {
    this.expect("EFFORT", "Esperado 'effort'");
    this.expect("COLON", "Esperado ':' após 'effort'");

    const valueToken = this.expect("NUMBER", "Esperado número para esforço").value;
    const unitToken = this.expect("TIME_UNIT", "Esperado unidade de tempo").value;

    // Mapeia unidade abreviada para canônica
    const unitMap: Record<string, "hours" | "days" | "weeks"> = {
      h: "hours",
      d: "days",
      w: "weeks",
    };

    const unit = unitMap[unitToken.toLowerCase()] || "hours";

    // Verifica se tem recurso count (ex: "8h x 2")
    let resourceCount = 1;
    if (this.check("MULTIPLY")) {
      this.advance();
      const countToken = this.expect("NUMBER", "Esperado número de recursos").value;
      resourceCount = parseInt(countToken, 10);
    }

    return {
      type: "Effort",
      value: parseFloat(valueToken),
      unit,
      resourceCount,
      position: 0,
      line: 1,
      column: 1,
    };
  }

  /**
   * Parseia dependências
   */
  private parseDependencies(): string[] {
    this.expect("DEPENDS", "Esperado 'depends'");
    this.expect("COLON", "Esperado ':' após 'depends'");
    this.expect("LPAREN", "Esperado '(' após 'depends'");

    const taskIds: string[] = [];

    while (!this.check("RPAREN") && !this.isAtEnd()) {
      const taskId = this.expect("IDENTIFIER", "Esperado ID de tarefa").value;
      taskIds.push(taskId);

      if (!this.check("RPAREN")) {
        this.expect("COMMA", "Esperado ',' ou ')'");
      }
    }

    this.expect("RPAREN", "Esperado ')' fechando dependências");

    return taskIds;
  }

  /**
   * Parseia status
   */
  private parseStatus(): StatusNode {
    this.expect("STATUS", "Esperado 'status'");
    this.expect("COLON", "Esperado ':' após 'status'");

    const statusValue = this.expect("IDENTIFIER", "Esperado status").value;

    const validStatuses: ("pending" | "in-progress" | "completed")[] = ["pending", "in-progress", "completed"];
    
    if (!validStatuses.includes(statusValue as any)) {
      this.warn(`Status inválido: ${statusValue}. Usando 'pending'`);
      return {
        type: "Status",
        value: "pending",
        position: 0,
        line: 1,
        column: 1,
      };
    }

    return {
      type: "Status",
      value: statusValue as "pending" | "in-progress" | "completed",
      position: 0,
      line: 1,
      column: 1,
    };
  }

  /**
   * Parseia um recurso
   */
  private parseResource(): ResourceNode {
    this.expect("RESOURCE", "Esperado 'resource'");
    this.expect("LBRACE", "Esperado '{' após 'resource'");

    const id = this.expect("IDENTIFIER", "Esperado ID do recurso").value;
    const name = this.expect("STRING", "Esperado nome do recurso entre aspas").value;

    let category: "person" | "equipment" | "material" = "person";
    let capacity: number | undefined;
    let costPerHour: number | undefined;

    while (!this.check("RBRACE") && !this.isAtEnd()) {
      if (this.check("IDENTIFIER")) {
        const key = this.previous().value;
        this.expect("COLON", `Esperado ':' após '${key}'`);

        if (key === "category") {
          const catValue = this.expect("IDENTIFIER", "Esperado categoria").value;
          if (["person", "equipment", "material"].includes(catValue)) {
            category = catValue as "person" | "equipment" | "material";
          }
        } else if (key === "capacity") {
          capacity = parseFloat(this.expect("NUMBER", "Esperado número").value);
        } else if (key === "costPerHour") {
          costPerHour = parseFloat(this.expect("NUMBER", "Esperado número").value);
        } else {
          this.advance();
        }
      } else {
        this.advance();
      }
    }

    this.expect("RBRACE", "Esperado '}' fechando recurso");

    return {
      type: "Resource",
      id,
      name,
      category,
      capacity,
      costPerHour,
      position: 0,
      line: 1,
      column: 1,
    };
  }

  /**
   * Parseia um calendário
   */
  private parseCalendar(): CalendarNode {
    this.expect("CALENDAR", "Esperado 'calendar'");
    this.expect("LBRACE", "Esperado '{' após 'calendar'");

    const name = this.expect("STRING", "Esperado nome do calendário entre aspas").value;

    const workingDays: number[] = [1, 2, 3, 4, 5]; // Padrão: Seg-Sex
    const workingHours: WorkingHoursNode = {
      type: "WorkingHours",
      start: 8,
      end: 18,
      position: 0,
      line: 1,
      column: 1,
    };
    const holidays: DateNode[] = [];

    while (!this.check("RBRACE") && !this.isAtEnd()) {
      if (this.check("IDENTIFIER")) {
        const key = this.previous().value;
        this.expect("COLON", `Esperado ':' após '${key}'`);

        if (key === "workingDays") {
          // Parseia array de dias [1,2,3,4,5]
          this.expect("LBRACKET", "Esperado '['");
          while (!this.check("RBRACKET") && !this.isAtEnd()) {
            const day = parseInt(this.expect("NUMBER", "Esperado dia").value, 10);
            workingDays.push(day);
            if (!this.check("RBRACKET")) {
              this.expect("COMMA", "Esperado ',' ou ']'");
            }
          }
          this.expect("RBRACKET", "Esperado ']'");
        } else if (key === "workingHours") {
          // Parseia {start: 8, end: 18}
          this.expect("LBRACE", "Esperado '{'");
          while (!this.check("RBRACE") && !this.isAtEnd()) {
            const hourKey = this.expect("IDENTIFIER", "Esperado 'start' ou 'end'").value;
            this.expect("COLON", "Esperado ':'");
            const hourValue = parseFloat(this.expect("NUMBER", "Esperado número").value);
            
            if (hourKey === "start") {
              workingHours.start = hourValue;
            } else if (hourKey === "end") {
              workingHours.end = hourValue;
            }
            
            if (!this.check("RBRACE")) {
              this.expect("COMMA", "Esperado ',' ou '}'");
            }
          }
          this.expect("RBRACE", "Esperado '}'");
        } else {
          this.advance();
        }
      } else {
        this.advance();
      }
    }

    this.expect("RBRACE", "Esperado '}' fechando calendário");

    return {
      type: "Calendar",
      name,
      workingDays,
      workingHours,
      holidays,
      position: 0,
      line: 1,
      column: 1,
    };
  }

  /**
   * Parseia um cenário
   */
  private parseScenario(): ScenarioNode {
    this.expect("SCENARIO", "Esperado 'scenario'");
    this.expect("LBRACE", "Esperado '{' após 'scenario'");

    const id = this.expect("IDENTIFIER", "Esperado ID do cenário").value;
    const name = this.expect("STRING", "Esperado nome do cenário entre aspas").value;

    let scenarioType: "base" | "optimistic" | "pessimistic" = "base";
    const multipliers: Record<string, number> = {};

    while (!this.check("RBRACE") && !this.isAtEnd()) {
      if (this.check("IDENTIFIER")) {
        const key = this.previous().value;
        this.expect("COLON", `Esperado ':' após '${key}'`);

        if (key === "type") {
          const typeValue = this.expect("IDENTIFIER", "Esperado tipo").value;
          if (["base", "optimistic", "pessimistic"].includes(typeValue)) {
            scenarioType = typeValue as "base" | "optimistic" | "pessimistic";
          }
        } else if (key !== "id" && key !== "name") {
          // Trata como multiplicador
          const value = parseFloat(this.expect("NUMBER", "Esperado número").value);
          multipliers[key] = value;
        } else {
          this.advance();
        }
      } else {
        this.advance();
      }
    }

    this.expect("RBRACE", "Esperado '}' fechando cenário");

    return {
      type: "Scenario",
      id,
      name,
      scenarioType,
      multipliers,
      position: 0,
      line: 1,
      column: 1,
    };
  }
}
