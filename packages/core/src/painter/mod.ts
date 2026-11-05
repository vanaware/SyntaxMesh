/**
 * Bloco D da Fase 17 — Painter (SVG): utilitários geométricos e de cor.
 *
 * `Element`, `Group`, `Primitives`, `BasicShapes`, `Text`, `Painter` e as
 * métricas de fonte chegaram em 17.8–17.11. Em 17.15 o mínimo
 * `src/painter-min.ts` foi apagado e `ChartPlotter` migrou para este Painter
 * real (ADR 038); os nomes daqui não colidem com nada, então o re-export no
 * `src/mod.ts` top-level está ativo desde a 17.7.
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
