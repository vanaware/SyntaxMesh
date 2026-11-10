/**
 * Barrel of the i18n package (SyntaxMesh extension — ADR 023).
 *
 * Exposes `globalRegistry` already populated with en, pt-BR and es. The
 * scanner and the parser use this registry by default; tests may create
 * isolated instances.
 */
import { LanguageRegistry, } from "./registry.ts";
import { en, } from "./en.ts";
import { ptBR, } from "./pt-BR.ts";
import { es, } from "./es.ts";

export type { CanonicalKeyword, } from "./canonical.ts";
export { CANONICAL_KEYWORDS, } from "./canonical.ts";
export type { CanonicalUnit, LanguageDefinition, } from "./types.ts";
export { LanguageRegistry, } from "./registry.ts";
export { en, } from "./en.ts";
export { ptBR, } from "./pt-BR.ts";
export { es, } from "./es.ts";

/** Default registry with the three supported languages. */
export const globalRegistry: LanguageRegistry = new LanguageRegistry();
globalRegistry.register(en,);
globalRegistry.register(ptBR,);
globalRegistry.register(es,);
