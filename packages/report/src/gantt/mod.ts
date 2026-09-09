/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Report Gantt — Modelo de gráfico Gantt
// ============================================================================

/**
 * Tarefa para renderização no Gantt
 */
export interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
  duration: number; // em dias
  progress: number; // 0 a 100 (%)
  children?: GanttTask[];
}

/**
 * Escala temporal do Gantt
 */
export type GanttScale = "day" | "week" | "month";

/**
 * Configuração do gráfico Gantt
 */
export interface GanttConfig {
  scale: GanttScale;
  width: number;
  heightPerRow: number;
  tasks: GanttTask[];
}

/**
 * Converte configuração Gantt em SVG base
 */
export function generateGanttSvg(config: GanttConfig): string {
  const totalHeight = config.tasks.length * config.heightPerRow + 40;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${config.width}" height="${totalHeight}">
  <rect width="100%" height="100%" fill="white"/>
  <!-- TODO: Implementar renderização completa do Gantt -->
</svg>`;
}