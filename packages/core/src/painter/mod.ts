/**
 * Phase 17 block D — Painter (SVG): geometric and color utilities.
 *
 * `Element`, `Group`, `Primitives`, `BasicShapes`, `Text`, `Painter` and the
 * font metrics arrived in 17.8–17.11. In 17.15 the minimal
 * `src/painter-min.ts` was deleted and `ChartPlotter` migrated to this real
 * Painter (ADR 038); the names here do not collide with anything, so the
 * re-export in the top-level `src/mod.ts` has been active since 17.7.
 *
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 */

export * from "./basic-shapes.ts";
export * from "./color.ts";
export * from "./element.ts";
export * from "./font-data.ts";
export * from "./font-metrics-data.ts";
export * from "./font-metrics.ts";
export * from "./group.ts";
export * from "./painter.ts";
export * from "./points.ts";
export * from "./primitives.ts";
export * from "./svg-support.ts";
export * from "./text.ts";
