/// <reference lib="deno.ns" />

// ============================================================================
// 🌳 AST — Estrutura de árvore sintática abstrata
// ============================================================================

/**
 * Tipo base para todos os nós da AST
 */
export interface ASTNode {
  type: string;
  position?: number;
  line?: number;
  column?: number;
}

/**
 * Projeto completo
 */
export interface ProjectNode extends ASTNode {
  type: "Project";
  language: string;
  name: string;
  description?: string;
  tasks: TaskNode[];
  resources: ResourceNode[];
  calendars: CalendarNode[];
  scenarios: ScenarioNode[];
}

/**
 * Declaração de idioma
 */
export interface LanguageDirectiveNode extends ASTNode {
  type: "LanguageDirective";
  languageCode: string;
  languageName: string;
}

/**
 * Tarefa do projeto
 */
export interface TaskNode extends ASTNode {
  type: "Task";
  id: string;
  name: string;
  description?: string;
  effort?: EffortNode;
  duration?: DurationNode;
  dependencies: string[];
  predecessors?: string[];
  successors?: string[];
  start?: DateNode;
  end?: DateNode;
  status?: StatusNode;
}

/**
 * Recurso do projeto
 */
export interface ResourceNode extends ASTNode {
  type: "Resource";
  id: string;
  name: string;
  category: "person" | "equipment" | "material";
  capacity?: number; // 0 a 100
  costPerHour?: number;
  availability?: AvailabilityNode;
}

/**
 * Calendário de trabalho
 */
export interface CalendarNode extends ASTNode {
  type: "Calendar";
  name: string;
  workingDays: number[]; // 0=Domingo, 1=Segunda, etc.
  workingHours: WorkingHoursNode;
  holidays: DateNode[];
}

/**
 * Horário de trabalho diário
 */
export interface WorkingHoursNode extends ASTNode {
  type: "WorkingHours";
  start: number; // hora decimal (ex: 8.5 = 8:30)
  end: number; // hora decimal
}

/**
 * Cenário comparativo
 */
export interface ScenarioNode extends ASTNode {
  type: "Scenario";
  id: string;
  name: string;
  scenarioType: "base" | "optimistic" | "pessimistic";
  description?: string;
  multipliers: Record<string, number>;
}

/**
 * Nó de esforço
 */
export interface EffortNode extends ASTNode {
  type: "Effort";
  value: number;
  unit: "hours" | "days" | "weeks";
  resourceCount: number;
}

/**
 * Nó de duração
 */
export interface DurationNode extends ASTNode {
  type: "Duration";
  value: number;
  unit: "minutes" | "hours" | "days" | "weeks" | "months";
}

/**
 * Nó de data
 */
export interface DateNode extends ASTNode {
  type: "Date";
  value: string; // ISO string ou expressão
}

/**
 * Nó de status
 */
export interface StatusNode extends ASTNode {
  type: "Status";
  value: "pending" | "in-progress" | "completed";
}

/**
 * Disponibilidade de recurso
 */
export interface AvailabilityNode extends ASTNode {
  type: "Availability";
  value: "full-time" | "part-time" | "custom";
}

/**
 * Expressão aritmética
 */
export interface ExpressionNode extends ASTNode {
  type: "Expression";
  left: number | ExpressionNode;
  operator: "+" | "-" | "*" | "/";
  right: number | ExpressionNode;
}

/**
 * Referência a outra tarefa
 */
export interface TaskReferenceNode extends ASTNode {
  type: "TaskReference";
  taskId: string;
}

/**
 * Lista de dependências
 */
export interface DependencyList extends ASTNode {
  type: "DependencyList";
  taskIds: string[];
}

/**
 * Unidade de tempo (para parsing)
 */
export interface TimeUnitNode extends ASTNode {
  type: "TimeUnit";
  abbreviation: string;
  canonical: string;
}
