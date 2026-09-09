/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Report Filters — Filtros de relatório
// ============================================================================

import type { Report, ReportFilter } from "../model/mod.ts";

/**
 * Aplica filtros a uma lista de linhas de relatório
 */
export function applyFilters(report: Report, rows: unknown[]): unknown[] {
  let result = rows;

  for (const filter of report.filters) {
    result = result.filter((row) => {
      const value = (row as Record<string, unknown>)[filter.field];
      return matchesFilter(value, filter);
    });
  }

  return result;
}

/**
 * Verifica se um valor corresponde a um filtro
 */
function matchesFilter(
  value: unknown,
  filter: ReportFilter,
): boolean {
  switch (filter.operator) {
    case "eq":
      return value === filter.value;
    case "neq":
      return value !== filter.value;
    case "gt":
      return typeof value === "number" && typeof filter.value === "number"
        ? value > filter.value
        : false;
    case "lt":
      return typeof value === "number" && typeof filter.value === "number"
        ? value < filter.value
        : false;
    case "contains":
      return typeof value === "string" &&
        typeof filter.value === "string"
        ? value.includes(filter.value)
        : false;
    default:
      return true;
  }
}