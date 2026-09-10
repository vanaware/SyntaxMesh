/// <reference lib="deno.ns" />

// ============================================================================
// 📦 @syntaxmesh/report - Motor de Relatórios
// ============================================================================
// Este módulo gerencia a geração de relatórios em vários formatos:
// - HTML (tabelas, Gantt charts)
// - CSV
// - JSON
// - Markdown
//
// Estrutura: Report model + builders + filters + export
// Não contém lógica de UI - consome Core Model e Parser AST.
export * from './model/mod.ts';
export * from './filters/mod.ts';
export * from './columns/mod.ts';
export * from './gantt/mod.ts';
export * from './html/mod.ts';
export * from './export/csv-json.ts';
