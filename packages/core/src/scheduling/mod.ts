/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Scheduling — Motor completo de agendamento
// ============================================================================

import type { Task, Project, Duration } from "../mod.ts";
import { detectCycles, type CycleDetectionResult } from "./cycle-detection.ts";
import { parseDuration, toDays } from "../time/duration.ts";

/**
 * Resultado do scheduler após calcular cronograma
 */
export interface ScheduleResult {
  tasks: ScheduledTask[];
  errors: string[];
  warnings: string[];
  hasCycles: boolean;
  cycles: string[][];
}

/**
 * Tarefa com datas calculadas
 */
export interface ScheduledTask extends Task {
  startDate: Date;
  endDate: Date;
  slack: number; // folga em horas
  isCritical: boolean; // se está no caminho crítico
}

/**
 * Executa o scheduler completo sobre um projeto
 */
export function schedule(project: Project): ScheduleResult {
  const results: ScheduledTask[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Detecta ciclos primeiro
  const cycleResult = detectCycles(project.tasks);
  if (cycleResult.hasCycle) {
    for (const cycle of cycleResult.cycles) {
      errors.push(`Ciclo detectado nas dependências: ${formatCycle(cycle)}`);
    }
  }

  // 2. Ordena tarefas topologicamente (se não houver ciclos)
  let sortedTasks: Task[] = [];
  if (!cycleResult.hasCycle) {
    try {
      sortedTasks = topologicalSort(project.tasks);
    } catch (error) {
      if (error instanceof Error) {
        errors.push(`Erro na ordenação topológica: ${error.message}`);
      }
    }
  }

  // 3. Calcula o cronograma
  const taskMap = new Map<string, ScheduledTask>();
  const startDate = project.startDate || new Date();

  for (const task of sortedTasks) {
    try {
      const scheduledTask = calculateTaskSchedule(task, taskMap, startDate);
      taskMap.set(task.id, scheduledTask);
      results.push(scheduledTask);
    } catch (error) {
      if (error instanceof Error) {
        errors.push(`${task.name}: ${error.message}`);
      }
    }
  }

  // 4. Calcula folga e caminho crítico
  if (results.length > 0 && !cycleResult.hasCycle) {
    calculateSlackAndCriticalPath(results, taskMap);
  }

  return {
    tasks: results,
    errors,
    warnings,
    hasCycles: cycleResult.hasCycle,
    cycles: cycleResult.cycles,
  };
}

/**
 * Ordena tarefas em ordem topológica (dependências primeiro)
 */
function topologicalSort(tasks: Task[]): Task[] {
  const visited = new Set<string>();
  const tempMark = new Set<string>();
  const result: Task[] = [];
  const taskMap = new Map(tasks.map((task) => [task.id, task]));

  function visit(taskId: string): void {
    if (tempMark.has(taskId)) {
      throw new Error(`Ciclo detectado durante ordenação topológica envolvendo a tarefa ${taskId}`);
    }
    if (visited.has(taskId)) return;

    tempMark.add(taskId);
    const task = taskMap.get(taskId);
    if (task) {
      for (const depId of task.dependencies || []) {
        visit(depId);
      }
    }
    tempMark.delete(taskId);
    visited.add(taskId);
    result.push(taskMap.get(taskId)!);
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      visit(task.id);
    }
  }

  return result;
}

/**
 * Calcula datas individuais de uma tarefa
 */
function calculateTaskSchedule(
  task: Task,
  taskMap: Map<string, ScheduledTask>,
  projectStartDate: Date,
): ScheduledTask {
  let startDate = task.start || projectStartDate;

  // Se tem dependências, a data de início é o máximo das datas de término das dependências
  if (task.dependencies && task.dependencies.length > 0) {
    let maxEndDate = new Date(startDate);
    for (const depId of task.dependencies) {
      const depTask = taskMap.get(depId);
      if (depTask && depTask.endDate > maxEndDate) {
        maxEndDate = depTask.endDate;
      }
    }
    startDate = maxEndDate;
  }

  // Calcula data de término baseado na duração
  let durationDays = 1;
  if (task.duration) {
    try {
      const durationObj = parseDuration(task.duration);
      durationDays = toDays(durationObj);
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`Duração inválida para tarefa ${task.name}: ${error.message}`);
      }
    }
  }

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Math.max(1, durationDays));

  return {
    ...task,
    startDate,
    endDate,
    slack: 0,
    isCritical: false,
  };
}

/**
 * Calcula folga e identifica caminho crítico
 */
function calculateSlackAndCriticalPath(
  tasks: ScheduledTask[],
  taskMap: Map<string, ScheduledTask>,
): void {
  // Encontra a data de término do projeto (máximo das datas de término das tarefas sem sucessoras)
  let projectEndDate = new Date(0);
  for (const task of tasks) {
    if (!hasSuccessors(task.id, tasks)) {
      if (task.endDate > projectEndDate) {
        projectEndDate = task.endDate;
      }
    }
  }

  // Calcula folga para cada tarefa
  for (const task of tasks) {
    let minSuccessorStart = projectEndDate;
    for (const successor of tasks) {
      if (successor.dependencies?.includes(task.id)) {
        if (successor.startDate < minSuccessorStart) {
          minSuccessorStart = successor.startDate;
        }
      }
    }
    task.slack = (minSuccessorStart.getTime() - task.endDate.getTime()) / (1000 * 60 * 60);
    task.isCritical = Math.abs(task.slack) < 0.1; // Considera como crítico se folga < 0.1 horas
  }
}

/**
 * Verifica se uma tarefa tem sucessoras
 */
function hasSuccessors(taskId: string, tasks: ScheduledTask[]): boolean {
  for (const task of tasks) {
    if (task.dependencies?.includes(taskId)) {
      return true;
    }
  }
  return false;
}

/**
 * Formata um ciclo para exibição legível
 */
function formatCycle(cycle: string[]): string {
  return cycle.join(" → ");
}