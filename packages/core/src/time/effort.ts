/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Effort — Representação e cálculo de esforço
// ============================================================================

import { type Duration, toHours } from "./duration.ts";

/**
 * Representação canônica de esforço
 */
export interface Effort {
  value: number; // valor numérico
  unit: "hours" | "days" | "weeks"; // unidade de medida
  resourceCount: number; // número de recursos alocados
}

/**
 * Converte string para Effort (ex: "8h", "2d", "1w")
 */
export function parseEffort(input: string): Effort {
  const match = input.trim().match(/^(\d+)([hdw])$/i);
  if (!match) {
    throw new Error(`Formato de esforço inválido: ${input}. Use formato como "8h", "2d", "1w"`);
  }

  const value = parseInt(match[1], 10);
  const unitChar = match[2].toLowerCase();

  let unit: "hours" | "days" | "weeks";
  switch (unitChar) {
    case "h":
      unit = "hours";
      break;
    case "d":
      unit = "days";
      break;
    case "w":
      unit = "weeks";
      break;
    default:
      throw new Error(`Unidade de esforço não suportada: ${unitChar}`);
  }

  return { value, unit, resourceCount: 1 };
}

/**
 * Converte Effort para horas totais
 */
export function toTotalHours(effort: Effort): number {
  let hoursPerUnit: number;
  switch (effort.unit) {
    case "hours":
      hoursPerUnit = 1;
      break;
    case "days":
      hoursPerUnit = 8; // 8 horas por dia útil
      break;
    case "weeks":
      hoursPerUnit = 40; // 40 horas por semana útil
      break;
  }
  return effort.value * hoursPerUnit * effort.resourceCount;
}

/**
 * Converte Duration para Effort
 */
export function durationToEffort(
  duration: Duration,
  resourceCount: number = 1,
): Effort {
  const hours = toHours(duration);
  return {
    value: hours,
    unit: "hours",
    resourceCount,
  };
}

/**
 * Formata Effort como string legível
 */
export function formatEffort(effort: Effort): string {
  const unitMap: Record<"hours" | "days" | "weeks", string> = {
    hours: "h",
    days: "d",
    weeks: "w",
  };
  return `${effort.value}${unitMap[effort.unit]} × ${effort.resourceCount} recurso(s)`;
}

/**
 * Valida se um esforço é válido (valor positivo)
 */
export function validateEffort(effort: Effort): boolean {
  return effort.value > 0 && effort.resourceCount > 0;
}