/**
 * Types of the language registry (SyntaxMesh extension — ADR 023).
 *
 * The core only knows canonical keywords (English). Each language supplies
 * local synonyms; the scanner normalizes synonym → canonical BEFORE the FSM,
 * keeping the token type unchanged ("ID").
 *
 * @see docs/syntaxmesh/04-linguagem-multilingue.md
 */
import type { CanonicalKeyword, } from "./canonical.ts";

/** Canonical duration units used in i18n resolutions. */
export type CanonicalUnit =
  | "minute"
  | "hour"
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year";

/** Full definition of a language of the TJP language. */
export interface LanguageDefinition {
  /** Identifier of the language (e.g. 'en', 'pt-BR', 'es'). */
  id: string;
  /** Human-readable name of the language. */
  name: string;
  /** canonical → local synonyms (including the canonical itself when equal). */
  keywords: Partial<Record<CanonicalKeyword, string[]>>;
  /** canonical unit → synonyms (e.g. day → ['d', 'dia', 'dias']). */
  units: Partial<Record<CanonicalUnit, string[]>>;
}
