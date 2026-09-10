/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Report Model — Estruturas de relatório
// ============================================================================

/**
 * Coluna de relatório
 */
export interface ReportColumn {
  id: string;
  label: string;
  field: string;
  formatter?: (value: unknown,) => string;
}

/**
 * Filtro de relatório
 */
export interface ReportFilter {
  id: string;
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
  value: unknown;
}

/**
 * Relatório básico
 */
export interface Report {
  id: string;
  name: string;
  columns: ReportColumn[];
  filters: ReportFilter[];
  rows: ReportRow[];
}

/**
 * Linha de relatório
 */
export interface ReportRow {
  id: string;
  values: Record<string, unknown>;
}

/**
 * Cria um novo relatório vazio
 */
export function createReport(name: string,): Report {
  return {
    id: crypto.randomUUID(),
    name,
    columns: [],
    filters: [],
    rows: [],
  };
}
