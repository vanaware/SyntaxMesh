/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Report HTML — Exportador de relatório para HTML
// ============================================================================

import type { Report } from "../model/mod.ts";

/**
 * Exporta relatório completo para página HTML
 */
export function exportToHtml(report: Report): string {
  let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(report.name)}</title>
  <style>
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #4CAF50; color: white; }
    tr:nth-child(even) { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>${escapeHtml(report.name)}</h1>
  <table>
    <thead>
      <tr>
        ${report.columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join("\n        ")}
      </tr>
    </thead>
    <tbody>
`;

  for (const row of report.rows) {
    html += `      <tr>\n`;
    for (const col of report.columns) {
      const value = row.values[col.field];
      const display = col.formatter ? col.formatter(value) : String(value ?? "");
      html += `        <td>${escapeHtml(display)}</td>\n`;
    }
    html += `      </tr>\n`;
  }

  html += `    </tbody>
  </table>
</body>
</html>`;

  return html;
}

/**
 * Escapa caracteres HTML para segurança
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}