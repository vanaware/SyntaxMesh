/**
 * Barrel do pacote i18n (extensão SyntaxMesh — ADR 023).
 *
 * Expõe `globalRegistry` já populado com en, pt-BR e es. Scanner e parser
 * usam este registro por padrão; testes podem criar instâncias isoladas.
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

/** Registro padrão com os três idiomas suportados. */
export const globalRegistry: LanguageRegistry = new LanguageRegistry();
globalRegistry.register(en,);
globalRegistry.register(ptBR,);
globalRegistry.register(es,);
