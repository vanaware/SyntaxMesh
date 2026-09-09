/// <reference lib="deno.ns" />

// ============================================================================
// 📦 @syntaxmesh/core - Motor de Planejamento Puro
// ============================================================================
// Este módulo fornece as estruturas de modelo e lógica de processamento
// independente de DOM, armazenamento ou interface de usuário.
//
// ARQUITETURA: Core não pode importar DOM, Preact, BeerCSS, IndexedDB, OPFS.
export * from "./model/mod.ts";
export * from "./calendar/mod.ts";
export * from "./scheduling/mod.ts";
export * from "./accounting/mod.ts";
export * from "./resources/mod.ts";
export * from "./scenarios/mod.ts";
export * from "./expressions/mod.ts";
export * from "./validation/mod.ts";
export * from "./time/duration.ts";
export * from "./time/effort.ts";

// ============================================================================
// Tipos principais do Core
// ============================================================================

export interface Project {
  id: string;
  name: string;
  tasks: Task[];
  resources: Resource[];
  scenarios: Scenario[];
  calendar: CalendarConfig;
  startDate?: Date;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  effort?: Effort;
  duration?: Duration;
  dependencies: string[]; // IDs de tarefas dependentes
  successors?: string[]; // IDs de tarefas sucessoras
  predecessors?: string[]; // IDs de tarefas predecessoras
  start?: Date;
  end?: Date;
  status?: "pending" | "in-progress" | "completed";
}

export interface Resource {
  id: string;
  name: string;
  capacity: number; // 0.0 a 1.0 (porcentagem disponível)
  availability: Availability;
}

export interface Scenario {
  id: string;
  name: string;
  tasks: string[]; // IDs de tarefas afetadas
  multipliers: Record<string, number>;
}

export interface CalendarConfig {
  workingDays: number[]; // 0=Domingo, 1=Segunda, etc.
  workingHours: { start: number; end: number }; // em horas decimais
  holidays: Date[];
}

// Tipos auxiliares
export type Effort = string; // ex: "10d", "5h", "2w"
export type Duration = string; // ex: "10d", "5h", "2w"

export type Availability = "full-time" | "part-time" | "custom";