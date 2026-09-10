/// <reference lib="deno.ns" />

// ============================================================================
// 📝 Parser — Analisador sintático para SyntaxMesh
// ============================================================================

import { EOF, type LanguageDefinition, Lexer, type Token, } from "../lexer/lexer.ts";
import { ENGLISH, PORTUGUESE, } from "../language/definitions.ts";
import {
  type AvailabilityNode,
  type CalendarNode,
  type DateNode,
  type DurationNode,
  type EffortNode,
  type LanguageDirectiveNode,
  type ProjectNode,
  type ResourceNode,
  type ScenarioNode,
  type StatusNode,
  type TaskNode,
  type WorkingHoursNode,
} from "../ast/ast.ts";

export interface ParseResult {
  ast: ProjectNode | null;
  errors: string[];
  warnings: string[];
  language: string;
}

export class Parser {
  private tokens: Token[];
  private current: number;
  private errors: string[];
  private warnings: string[];
  private currentLanguage: LanguageDefinition;
  private unitMap: Record<string, string> = {};

  constructor(input: string, language: LanguageDefinition = ENGLISH,) {
    const lexer = new Lexer(input, language,);
    const lexResult = lexer.tokenize();
    this.tokens = lexResult.tokens;
    this.current = 0;
    this.errors = lexResult.errors;
    this.warnings = [];
    this.currentLanguage = language;

    for (const [unitType, unitValues,] of Object.entries(language.units,)) {
      for (const unitValue of unitValues) {
        this.unitMap[unitValue.toLowerCase()] = unitType;
      }
    }
  }

  parse(): ParseResult {
    if (this.peek().type === "LANGUAGE") {
      const langDirective = this.parseLanguageDirective();
      if (langDirective) {
        this.warn("Directiva de idioma não suportada no momento. Usando idioma padrão.",);
      }
    }

    if (this.check("PROJECT",)) {
      const project = this.parseProject();
      return {
        ast: project,
        errors: this.errors,
        warnings: this.warnings,
        language: this.currentLanguage.id,
      };
    }

    this.error("Esperado 'project' no início do arquivo",);
    return {
      ast: null,
      errors: this.errors,
      warnings: this.warnings,
      language: this.currentLanguage.id,
    };
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current++;
    }
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === "EOF";
  }

  private peek(): Token {
    const token = this.tokens[this.current];
    if (!token) throw new Error("Unexpected end of input",);
    return token;
  }

  private previous(): Token {
    const token = this.tokens[this.current - 1];
    if (!token) throw new Error("Unexpected previous token",);
    return token;
  }

  private check(...types: string[]): boolean {
    return types.includes(this.peek().type,);
  }

  private match(...types: string[]): Token | undefined {
    for (const type of types) {
      if (this.check(type,)) {
        return this.advance();
      }
    }
    return undefined;
  }

  private expect(type: string, message: string,): Token {
    if (this.check(type,)) {
      return this.advance();
    }
    this.error(message,);
    return this.peek();
  }

  private error(message: string,): void {
    const token = this.peek();
    this.errors.push(`Linha ${token.line}, coluna ${token.column}: ${message}`,);
  }

  private warn(message: string,): void {
    const token = this.peek();
    this.warnings.push(`Linha ${token.line}, coluna ${token.column}: ${message}`,);
  }

  private parseLanguageDirective(): LanguageDirectiveNode | null {
    this.expect("LANGUAGE", "Esperado 'language'",);
    const languageCode = this.expect("IDENTIFIER", "Esperado código do idioma",).value;
    this.expect("COLON", "Esperado ':' após código do idioma",);
    const languageName = this.expect("STRING", "Esperado nome do idioma entre aspas",).value;

    return {
      type: "LanguageDirective",
      languageCode,
      languageName,
      position: 0,
      line: 1,
      column: 1,
    };
  }

  private parseProject(): ProjectNode {
    this.expect("PROJECT", "Esperado 'project'",);
    const name = this.expect("STRING", "Esperado nome do projeto entre aspas",).value;
    this.expect("LBRACE", "Esperado '{' após nome do projeto",);

    const tasks: TaskNode[] = [];
    const resources: ResourceNode[] = [];
    const calendars: CalendarNode[] = [];
    const scenarios: ScenarioNode[] = [];

    while (!this.check("RBRACE",) && !this.isAtEnd()) {
      if (this.check("TASK",)) {
        tasks.push(this.parseTask(),);
      } else if (this.check("RESOURCE",)) {
        resources.push(this.parseResource(),);
      } else if (this.check("CALENDAR",)) {
        calendars.push(this.parseCalendar(),);
      } else if (this.check("SCENARIO",)) {
        scenarios.push(this.parseScenario(),);
      } else {
        this.advance();
      }
    }

    this.expect("RBRACE", "Esperado '}' fechando o projeto",);

    return {
      type: "Project",
      language: this.currentLanguage.id,
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

  private parseTask(): TaskNode {
    this.expect("TASK", "Esperado 'task'",);

    let id: string;
    let name: string;

    if (this.check("STRING",)) {
      name = this.advance().value;
      id = name.replace(/\s+/g, "_",).toLowerCase();
      this.expect("LBRACE", "Esperado '{' após nome da tarefa",);
    } else {
      this.expect("LBRACE", "Esperado '{' após 'task'",);
      id = this.expect("IDENTIFIER", "Esperado ID da tarefa",).value;
      name = this.expect("STRING", "Esperado nome da tarefa entre aspas",).value;
    }

    const dependencies: string[] = [];
    let effort: EffortNode | undefined;
    let duration: DurationNode | undefined;
    let status: StatusNode | undefined;

    while (!this.check("RBRACE",) && !this.isAtEnd()) {
      if (this.check("DURATION",)) {
        duration = this.parseDuration();
      } else if (this.check("EFFORT",)) {
        effort = this.parseEffort();
      } else if (this.check("DEPENDS",)) {
        dependencies.push(...this.parseDependencies(),);
      } else if (this.check("STATUS",)) {
        status = this.parseStatus();
      } else {
        this.advance();
      }
    }

    this.expect("RBRACE", "Esperado '}' fechando a tarefa",);

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

  private parseDuration(): DurationNode {
    this.expect("DURATION", "Esperado 'duration'",);
    this.expect("COLON", "Esperado ':' após 'duration'",);

    const valueToken = this.expect("NUMBER", "Esperado número para duração",).value;
    const unitToken = this.expect("TIME_UNIT", "Esperado unidade de tempo",).value;

    const canonicalUnit = this.unitMap[unitToken.toLowerCase()] || "hours";

    let finalUnit: "minutes" | "hours" | "days" | "weeks" | "months" = "days";
    if (canonicalUnit === "day") finalUnit = "days";
    else if (canonicalUnit === "hour") finalUnit = "hours";
    else if (canonicalUnit === "minute") finalUnit = "minutes";
    else if (canonicalUnit === "week") finalUnit = "weeks";
    else if (canonicalUnit === "month") finalUnit = "months";

    return {
      type: "Duration",
      value: parseFloat(valueToken,),
      unit: finalUnit,
      position: 0,
      line: 1,
      column: 1,
    };
  }

  private parseEffort(): EffortNode {
    this.expect("EFFORT", "Esperado 'effort'",);
    this.expect("COLON", "Esperado ':' após 'effort'",);

    const valueToken = this.expect("NUMBER", "Esperado número para esforço",).value;
    const unitToken = this.expect("TIME_UNIT", "Esperado unidade de tempo",).value;

    const unitMap: Record<string, "hours" | "days" | "weeks"> = {
      h: "hours",
      d: "days",
      w: "weeks",
    };
    const unit = unitMap[unitToken.toLowerCase()] || "hours";

    let resourceCount = 1;
    // 🔥 CORREÇÃO: Aceita tanto '*' (MULTIPLY) quanto 'x'/'X' (IDENTIFIER) como multiplicador
    if (
      this.check("MULTIPLY",) ||
      (this.check("IDENTIFIER",) && this.peek().value.toLowerCase() === "x")
    ) {
      this.advance();
      const countToken = this.expect("NUMBER", "Esperado número de recursos",).value;
      resourceCount = parseInt(countToken, 10,);
    }

    return {
      type: "Effort",
      value: parseFloat(valueToken,),
      unit,
      resourceCount,
      position: 0,
      line: 1,
      column: 1,
    };
  }

  private parseDependencies(): string[] {
    this.expect("DEPENDS", "Esperado 'depends'",);
    const taskIds: string[] = [];

    if (this.check("COLON",)) {
      this.advance();
      if (this.check("LPAREN",)) {
        this.advance();
        while (!this.check("RPAREN",) && !this.isAtEnd()) {
          const taskId = this.expect("IDENTIFIER", "Esperado ID de tarefa",).value;
          taskIds.push(taskId,);
          if (!this.check("RPAREN",)) {
            this.expect("COMMA", "Esperado ',' ou ')'",);
          }
        }
        this.expect("RPAREN", "Esperado ')' fechando dependências",);
        return taskIds;
      }
    }

    while (
      !this.check("RBRACE",) && !this.isAtEnd() && !this.check("DURATION",) &&
      !this.check("EFFORT",) && !this.check("STATUS",)
    ) {
      if (this.check("IDENTIFIER",)) {
        const taskId = this.advance().value;
        taskIds.push(taskId,);
        if (this.check("COMMA",)) {
          this.advance();
        } else {
          break;
        }
      } else {
        break;
      }
    }

    return taskIds;
  }

  private parseStatus(): StatusNode {
    this.expect("STATUS", "Esperado 'status'",);
    this.expect("COLON", "Esperado ':' após 'status'",);
    const statusValue = this.expect("IDENTIFIER", "Esperado status",).value;
    const validStatuses: ("pending" | "in-progress" | "completed")[] = [
      "pending",
      "in-progress",
      "completed",
    ];

    if (!validStatuses.includes(statusValue as any,)) {
      this.warn(`Status inválido: ${statusValue}. Usando 'pending'`,);
      return { type: "Status", value: "pending", position: 0, line: 1, column: 1, };
    }

    return {
      type: "Status",
      value: statusValue as "pending" | "in-progress" | "completed",
      position: 0,
      line: 1,
      column: 1,
    };
  }

  private parseResource(): ResourceNode {
    this.expect("RESOURCE", "Esperado 'resource'",);
    const name = this.expect("STRING", "Esperado nome do recurso entre aspas",).value;
    this.expect("LBRACE", "Esperado '{' após nome do recurso",);

    const id = name.replace(/\s+/g, "_",).toLowerCase();

    let category: "person" | "equipment" | "material" = "person";
    let capacity: number | undefined;
    let costPerHour: number | undefined;

    while (!this.check("RBRACE",) && !this.isAtEnd()) {
      if (this.check("IDENTIFIER",)) {
        const key = this.advance().value;
        this.expect("COLON", `Esperado ':' após '${key}'`,);

        if (key === "categoria" || key === "category") {
          const catValue = this.expect("IDENTIFIER", "Esperado categoria",).value;
          if (["person", "equipment", "material",].includes(catValue,)) {
            category = catValue as "person" | "equipment" | "material";
          }
        } else if (key === "capacidade" || key === "capacity") {
          capacity = parseFloat(this.expect("NUMBER", "Esperado número",).value,);
        } else if (key === "custoHora" || key === "costPerHour") {
          costPerHour = parseFloat(this.expect("NUMBER", "Esperado número",).value,);
        } else {
          this.advance();
        }
      } else {
        this.advance();
      }
    }

    this.expect("RBRACE", "Esperado '}' fechando recurso",);

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

  private parseCalendar(): CalendarNode {
    this.expect("CALENDAR", "Esperado 'calendar'",);
    this.expect("LBRACE", "Esperado '{' após 'calendar'",);
    const name = this.expect("STRING", "Esperado nome do calendário entre aspas",).value;

    let workingDays: number[] = [];
    const workingHours: WorkingHoursNode = {
      type: "WorkingHours",
      start: 8,
      end: 18,
      position: 0,
      line: 1,
      column: 1,
    };
    const holidays: DateNode[] = [];

    while (!this.check("RBRACE",) && !this.isAtEnd()) {
      if (this.check("IDENTIFIER",)) {
        // 🔥 CORREÇÃO CRÍTICA: Usar advance() para consumir e obter o valor da chave
        const key = this.advance().value;
        this.expect("COLON", `Esperado ':' após '${key}'`,);

        if (key === "workingDays") {
          this.expect("LBRACKET", "Esperado '['",);
          while (!this.check("RBRACKET",) && !this.isAtEnd()) {
            const day = parseInt(this.expect("NUMBER", "Esperado dia",).value, 10,);
            workingDays.push(day,);
            if (!this.check("RBRACKET",)) {
              this.expect("COMMA", "Esperado ',' ou ']'",);
            }
          }
          this.expect("RBRACKET", "Esperado ']'",);
        } else if (key === "workingHours") {
          this.expect("LBRACE", "Esperado '{'",);
          while (!this.check("RBRACE",) && !this.isAtEnd()) {
            const hourKey = this.expect("IDENTIFIER", "Esperado 'start' ou 'end'",).value;
            this.expect("COLON", "Esperado ':'",);
            const hourValue = parseFloat(this.expect("NUMBER", "Esperado número",).value,);

            if (hourKey === "start") workingHours.start = hourValue;
            else if (hourKey === "end") workingHours.end = hourValue;

            if (!this.check("RBRACE",)) {
              this.expect("COMMA", "Esperado ',' ou '}'",);
            }
          }
          this.expect("RBRACE", "Esperado '}'",);
        } else {
          this.advance();
        }
      } else {
        this.advance();
      }
    }

    this.expect("RBRACE", "Esperado '}' fechando calendário",);

    if (workingDays.length === 0) {
      workingDays = [1, 2, 3, 4, 5,];
    }

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

  private parseScenario(): ScenarioNode {
    this.expect("SCENARIO", "Esperado 'scenario'",);

    let id: string;
    let name: string;

    if (this.check("STRING",)) {
      name = this.advance().value;
      id = name.replace(/\s+/g, "_",).toLowerCase();
      this.expect("LBRACE", "Esperado '{' após nome do cenário",);
    } else {
      this.expect("LBRACE", "Esperado '{' após 'scenario'",);
      id = this.expect("IDENTIFIER", "Esperado ID do cenário",).value;
      name = this.expect("STRING", "Esperado nome do cenário entre aspas",).value;
    }

    let scenarioType: "base" | "optimistic" | "pessimistic" = "base";
    const multipliers: Record<string, number> = {};

    while (!this.check("RBRACE",) && !this.isAtEnd()) {
      if (this.check("IDENTIFIER",)) {
        const key = this.advance().value;
        this.expect("COLON", `Esperado ':' após '${key}'`,);

        if (key === "type" || key === "tipo") {
          const typeValue = this.expect("IDENTIFIER", "Esperado tipo",).value;
          if (["base", "optimistic", "pessimistic",].includes(typeValue,)) {
            scenarioType = typeValue as "base" | "optimistic" | "pessimistic";
          }
        } else if (key === "multiplier" || key === "multiplicador") {
          multipliers.multiplier = parseFloat(this.expect("NUMBER", "Esperado número",).value,);
        } else {
          this.advance();
        }
      } else {
        this.advance();
      }
    }

    this.expect("RBRACE", "Esperado '}' fechando cenário",);

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
