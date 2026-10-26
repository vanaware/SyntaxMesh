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

// Phase 8 exports (re-export from finance module)
export * from "./finance/mod.ts";

// 9.9.14 — export TaskJuggler
export { TaskJuggler, } from "./taskjuggler.ts";

// Fase 10 — lexer e parser (port de TextParser/*)
export * from "./lexer/mod.ts";
export * from "./parser/mod.ts";

// Fase 10 — i18n (extensão SyntaxMesh — ADR 023)
export {
  CANONICAL_KEYWORDS,
  type CanonicalKeyword,
  type CanonicalUnit,
  en,
  es,
  globalRegistry,
  type LanguageDefinition,
  LanguageRegistry,
  ptBR,
} from "./i18n/mod.ts";
export { SourceFileInfo, } from "./source-file-info.ts";
