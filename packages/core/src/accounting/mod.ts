/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Accounting — Custos e cálculos financeiros
// ============================================================================

/**
 * Taxa horária de um recurso
 */
export interface CostRate {
  rate: number; // valor por hora
  currency: string; // código ISO 4217 (ex: "BRL", "USD")
}

/**
 * Custo acumulado de uma tarefa
 */
export interface TaskCost {
  laborCost: number; // custo com mão-de-obra
  materialCost: number; // custo com materiais
  totalCost: number; // custo total
}

/**
 * Calcula o custo baseado em esforço e taxa horária
 */
export function calculateLaborCost(
  effortDays: number,
  hourlyRate: number,
  hoursPerDay: number = 8,
): number {
  const totalHours = effortDays * hoursPerDay;
  return totalHours * hourlyRate;
}

/**
 * Calcula o custo total da tarefa
 */
export function calculateTotalCost(
  laborCost: number,
  materialCost: number = 0,
): TaskCost {
  return {
    laborCost,
    materialCost,
    totalCost: laborCost + materialCost,
  };
}