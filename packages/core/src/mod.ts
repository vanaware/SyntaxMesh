/**
 * @syntaxmesh/core
 *
 * Placeholder - implementacao em andamento (Fase 1).
 * O Core e independente de DOM, Preact, BeerCSS, IndexedDB, OPFS
 * e de globals de navegador.
 */

export const CORE_VERSION = "0.0.0-placeholder";

// Export time module
export * from "./time/mod.ts";
// Export calendar module
export * from "./calendar/working-hours.ts";
// Export format module
export * from "./format/real-format.ts";
// Export compat
export * from "./compat.ts";
// Export scheduling module
export * from "./scheduling/mod.ts";
// Export model module
export * from "./model/mod.ts";
// Export attributes module
export * from "./attributes/mod.ts";
// Export utils module
export * from "./utils/mod.ts";

// Phase 6 exports (re-export from sub-modules)
export * from "./time/scoreboard-bits.ts";
export * from "./scheduling/limits.ts";
export * from "./scheduling/shift-assignments.ts";
export * from "./utils/project-object-id.ts";
