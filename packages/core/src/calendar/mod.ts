/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Calendar — Configurações de calendário e dias úteis
// ============================================================================

/**
 * Dias da semana (0=Domingo, 1=Segunda, ..., 6=Sábado)
 */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Configuração de calendário padrão (Segunda a Sexta, 8h-18h)
 */
export interface CalendarConfig {
  name: string;
  workingDays: Weekday[];
  workingHours: WorkingHours;
  holidays: Date[];
}

/**
 * Horário de trabalho diário
 */
export interface WorkingHours {
  start: number; // hora decimal (ex: 8.5 = 8:30)
  end: number; // hora decimal (ex: 18.5 = 18:30)
}

/**
 * Calendário padrão: Segunda a Sexta, 8h às 18h
 */
export const DEFAULT_CALENDAR: CalendarConfig = {
  name: "padrao",
  workingDays: [1, 2, 3, 4, 5], // Segunda a Sexta
  workingHours: { start: 8, end: 18 },
  holidays: [],
};

/**
 * Verifica se um dia é útil
 */
export function isWorkingDay(date: Date, config: CalendarConfig): boolean {
  const dayOfWeek = date.getDay();
  if (!config.workingDays.includes(dayOfWeek as Weekday)) {
    return false;
  }
  for (const holiday of config.holidays) {
    if (isSameDay(date, holiday)) {
      return false;
    }
  }
  return true;
}

/**
 * Compara duas datas por dia/mês/ano
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}