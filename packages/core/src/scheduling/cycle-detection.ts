/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Cycle Detection — Detecção de ciclos em dependências de tarefas
// ============================================================================

import type { Task } from "../mod.ts";

/**
 * Resultado da detecção de ciclos
 */
export interface CycleDetectionResult {
  hasCycle: boolean;
  cycles: string[][]; // Array de ciclos, cada ciclo é um array de IDs de tarefas
}

/**
 * Detecta ciclos em um grafo de dependências de tarefas
 */
export function detectCycles(tasks: Task[]): CycleDetectionResult {
  const graph = buildDependencyGraph(tasks);
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  for (const taskId of Object.keys(graph)) {
    if (!visited.has(taskId)) {
      const cyclePath: string[] = [];
      if (dfsDetectCycle(taskId, graph, visited, recursionStack, cyclePath)) {
        cycles.push([...cyclePath]);
      }
    }
  }

  return {
    hasCycle: cycles.length > 0,
    cycles,
  };
}

/**
 * Constrói o grafo de dependências a partir das tarefas
 */
function buildDependencyGraph(tasks: Task[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {};

  for (const task of tasks) {
    graph[task.id] = task.dependencies || [];
  }

  return graph;
}

/**
 * DFS para detecção de ciclos
 */
function dfsDetectCycle(
  taskId: string,
  graph: Record<string, string[]>,
  visited: Set<string>,
  recursionStack: Set<string>,
  cyclePath: string[],
): boolean {
  visited.add(taskId);
  recursionStack.add(taskId);
  cyclePath.push(taskId);

  for (const neighborId of graph[taskId] || []) {
    if (!visited.has(neighborId)) {
      if (dfsDetectCycle(neighborId, graph, visited, recursionStack, cyclePath)) {
        return true;
      }
    } else if (recursionStack.has(neighborId)) {
      // Encontrou um ciclo - adiciona o nó que completa o ciclo
      cyclePath.push(neighborId);
      return true;
    }
  }

  // Remove o nó atual do caminho se não encontrou ciclo
  cyclePath.pop();
  recursionStack.delete(taskId);
  return false;
}

/**
 * Formata um ciclo para exibição legível
 */
export function formatCycle(cycle: string[]): string {
  return cycle.join(" → ");
}