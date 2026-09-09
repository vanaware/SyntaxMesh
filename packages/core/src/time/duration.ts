/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Duration — Representação e cálculo de durações
// ============================================================================

/**
 * Unidades de tempo suportadas
 */
export type TimeUnit = "minutes" | "hours" | "days" | "weeks" | "months";

/**
 * Representação canônica de duração
 */
export interface Duration {
  value: number;
  unit: TimeUnit;
}

/**
 * Converte string para Duration (ex: "8h", "2d", "1w")
 */
export function parseDuration(input: string): Duration {
  const match = input.trim().match(/^(\d+)([mhdw])$/i);
  if (!match) {
    throw new Error(`Formato de duração inválido: ${input}. Use formato como "8h", "2d", "1w"`);
  }

  const value = parseInt(match[1], 10);
  const unitChar = match[2].toLowerCase();

  let unit: TimeUnit;
  switch (unitChar) {
    case "m":
      unit = "minutes";
      break;
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
      throw new Error(`Unidade de tempo não suportada: ${unitChar}`);
  }

  return { value, unit };
}

/**
 * Converte Duration para horas
 */
export function toHours(duration: Duration): number {
  switch (duration.unit) {
    case "minutes":
      return duration.value / 60;
    case "hours":
      return duration.value;
    case "days":
      return duration.value * 8; // 8 horas por dia útil
    case "weeks":
      return duration.value * 40; // 40 horas por semana útil
    case "months":
      return duration.value * 160; // 160 horas por mês útil (20 dias)
  }
}

/**
 * Converte Duration para dias
 */
export function toDays(duration: Duration): number {
  switch (duration.unit) {
    case "minutes":
      return duration.value / (60 * 8);
    case "hours":
      return duration.value / 8;
    case "days":
      return duration.value;
    case "weeks":
      return duration.value * 5; // 5 dias úteis por semana
    case "months":
      return duration.value * 20; // 20 dias úteis por mês
  }
}

/**
 * Formata Duration como string legível
 */
export function formatDuration(duration: Duration): string {
  const unitMap: Record<TimeUnit, string> = {
    minutes: "min",
    hours: "h",
    days: "d",
    weeks: "w",
    months: "m",
  };
  return `${duration.value}${unitMap[duration.unit]}`;
}

/**
 * Valida se uma duração é válida (valor positivo)
 */
export function validateDuration(duration: Duration): boolean {
  return duration.value > 0;
}