/**
 * Public Gantt module (phase 15).
 *
 * Faithful port of the Ruby reports
 * `Gantt*.rb`/`CollisionDetector.rb`/`HTMLGraphics.rb`. The chart is pure
 * HTML+CSS (ADR 028) and plugs into `TableReport` through the `SpecialCell`
 * contract (the `chart` column).
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
