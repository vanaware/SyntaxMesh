/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Report Export — Exportadores CSV e JSON
// ============================================================================

import type { Report, ReportRow, } from '../model/mod.ts';

/**
 * Exporta relatório para formato CSV
 */
export function exportToCSV(report: Report,): string {
  const headers = report.columns.map((col,) => col.label);
  const lines = [headers.join(',',),];

  for (const row of report.rows) {
    const values = report.columns.map((col,) => {
      const value = row.values[col.field];
      return escapeCsvValue(String(value ?? '',),);
    },);
    lines.push(values.join(',',),);
  }

  return lines.join('\n',);
}

/**
 * Escapa um valor para CSV (tratar vírgulas e aspas)
 */
function escapeCsvValue(value: string,): string {
  if (value.includes(',',) || value.includes('"',) || value.includes('\n',)) {
    return `"${value.replace(/"/g, '""',)}"`;
  }
  return value;
}

/**
 * Exporta relatório para formato JSON
 */
export function exportToJson(report: Report,): string {
  const data = {
    name: report.name,
    columns: report.columns.map((col,) => ({
      id: col.id,
      label: col.label,
      field: col.field,
    })),
    rows: report.rows.map((row,) => row.values),
  };

  return JSON.stringify(data, null, 2,);
}
