/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Report Columns — Construtores de colunas padronizadas
// ============================================================================

import type { ReportColumn, } from '../model/mod.ts';

/**
 * Coluna padrão "Name"
 */
export function nameColumn(): ReportColumn {
  return {
    id: 'name',
    label: 'Name',
    field: 'name',
  };
}

/**
 * Coluna padrão "Start"
 */
export function startColumn(): ReportColumn {
  return {
    id: 'start',
    label: 'Start',
    field: 'startDate',
    formatter: (value: unknown,) => {
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      return String(value ?? '',);
    },
  };
}

/**
 * Coluna padrão "End"
 */
export function endColumn(): ReportColumn {
  return {
    id: 'end',
    label: 'End',
    field: 'endDate',
    formatter: (value: unknown,) => {
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      return String(value ?? '',);
    },
  };
}

/**
 * Retorna lista de colunas padrão para relatório de tarefas
 */
export function defaultColumns(): ReportColumn[] {
  return [nameColumn(), startColumn(), endColumn(),];
}
