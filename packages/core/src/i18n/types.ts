/**
 * Tipos do registro de idiomas (extensão SyntaxMesh — ADR 023).
 *
 * O Core só conhece keywords canônicos (inglês). Cada idioma fornece
 * sinônimos locais; o scanner normaliza sinônimo → canônico ANTES do FSM,
 * mantendo o tipo de token inalterado ("ID").
 *
 * @see docs/syntaxmesh/04-linguagem-multilingue.md
 */
import type { CanonicalKeyword, } from "./canonical.ts";

/** Unidades canônicas de duração usadas em resoluções i18n. */
export type CanonicalUnit =
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

/** Definição completa de um idioma da linguagem TJP. */
export interface LanguageDefinition {
  /** Identificador do idioma (ex.: 'en', 'pt-BR', 'es'). */
  id: string;
  /** Nome legível do idioma. */
  name: string;
  /** canonical → sinônimos locais (incluindo o próprio canônico quando igual). */
  keywords: Partial<Record<CanonicalKeyword, string[]>>;
  /** unidade canônica → sinônimos (ex.: day → ['d', 'dia', 'dias']). */
  units: Partial<Record<CanonicalUnit, string[]>>;
}
