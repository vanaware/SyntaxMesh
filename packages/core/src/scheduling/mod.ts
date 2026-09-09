/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Scheduling — Motor básico de agendamento
// ============================================================================

import type { Task, Project } from "../mod.ts";

/**
 * Resultado do scheduler após calcular cronograma
 */
export interface ScheduleResult {
  tasks: ScheduledTask[];
  errors: string[];
}

/**
 * Tarefa com datas calculadas
 */
export interface ScheduledTask extends Task {
  startDate: Date;
  endDate: Date;
  slack: number; // folga em horas
}

/**
 * Executa o scheduler básico sobre um projeto
 */
export function schedule(project: Project): ScheduleResult {
  const results: ScheduledTask[] = [];
  const errors: string[] = [];

  // Ordena tarefas topologicamente
  const sortedTasks = topologicalSort(project.tasks);

  for (const task of sortedTasks) {
    try {
      const scheduledTask = calculateTaskSchedule(task, project.tasks);
      results.push(scheduledTask);
    } catch (error) {
      if (error instanceof Error) {
        errors.push(`${task.name}: ${error.message}`);
      }
    }
  }

  return { tasks: results, errors };
}

/**
 * Ordena tarefas em ordem topológica (dependências primeiro)
 */
function topologicalSort(tasks: Task[]): Task[] {
  const visited = new Set<string>();
  const result: Task[] = [];

  function visit(task: Task): void {
    if (visited.has(task.id)) return;
    visited.add(task.id);

    for (const depId of task.dependencies) {
      const dep = tasks.find((t) => t.id === depId);
      if (dep) visit(dep);
    }

    result.push(task);
  }

  for (const task of tasks) {
    visit(task);
  }

  return result;
}

/**
 * Calcula datas individuais de uma tarefa
 */
function calculateTaskSchedule(
  task: Task,
  allTasks: Task[],
): ScheduledTask {
  // Versão simplificada — no futuro implementará calendário completo
  const startDate = task.start || new Date();
  const days = parseDurationToDays(task.duration || "1d");

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  return {
    ...task,
    startDate,
    endDate,
    slack: 0,
  };
}

/**
 * Converte duração como string ("10d", "5h") para dias
 */
function parseDurationToDays(duration: string): number {
  const match = duration.match(/^(\d+)([dhms])$/);
  if (!match) return 1;

  const value = parseInt(match[1] ?? "1", 10);
  const unit = match[2];

  switch (unit) {
    case "d":
      return value;
    case "h":
      return value / 8; // considera 8h = 1 dia
    case "w":
      return value * 5; // considera 5 dias = 1 semana
    case "m":
      return value * 30;
    default:
      return 1;
  }
}