/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Core Model — Estruturas de domínio do planejamento
// ============================================================================

/**
 * Identificador canônico de esforço e duração (ex: "10d", "5h", "2w")
 */
export type Effort = string;
export type Duration = string;

/**
 * Interface básica para um identificador único do projeto
 */
export interface ProjectId {
  value: string;
}

/**
 * Cria um novo ID para projeto
 */
export function createProjectId(): ProjectId {
  return {
    value: crypto.randomUUID(),
  };
}

/**
 * Tarefa do planejamento.
 */
export interface Task {
  id: string;
  name: string;
  description?: string;
  effort?: Effort;
  duration?: Duration;
  dependencies: string[];
  start?: Date;
  end?: Date;
  status?: "pending" | "in-progress" | "completed";
}

/**
 * Representa um projeto com nome e metadados básicos
 */
export interface Project {
  id: ProjectId;
  name: string;
  description?: string;
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cria uma nova instância de Projeto
 */
export function createProject(name: string, description?: string): Project {
  const now = new Date();
  return {
    id: createProjectId(),
    name,
    description,
    tasks: [],
    createdAt: now,
    updatedAt: now,
  };
}