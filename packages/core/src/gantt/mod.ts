/**
 * Módulo público do Gantt (Fase 15).
 *
 * Porta fiel dos reports Ruby `Gantt*.rb`/`CollisionDetector.rb`/`HTMLGraphics.rb`.
 * O chart é HTML+CSS puro (ADR 028) e se pluga em `TableReport` pelo contrato
 * `SpecialCell` (coluna `chart`).
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md
 * @see docs/syntaxmesh/fases/fase-15-gantt.md
 */
export * from "./html-graphics.ts";
export * from "./collision-detector.ts";
export * from "./gantt-router.ts";
export * from "./gantt-task-bar.ts";
export * from "./gantt-milestone.ts";
export * from "./gantt-container.ts";
export * from "./gantt-load-stack.ts";
export * from "./gantt-header-scale-item.ts";
export * from "./gantt-header.ts";
export * from "./gantt-line.ts";
export * from "./gantt-chart.ts";
