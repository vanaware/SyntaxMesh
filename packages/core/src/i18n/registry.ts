/**
 * LanguageRegistry — language registry of the TJP language (a SyntaxMesh
 * extension; it does not exist in the original TaskJuggler).
 *
 * Keeps `synonym → canonical` indexes per language. Resolution is
 * case-sensitive and exact: only IDs identical to the registered synonym are
 * translated. Languages other than `en` have an implicit fallback to the
 * English canonical form.
 *
 * @see ADR 023 (keyword i18n)
 * @see docs/syntaxmesh/04-linguagem-multilingue.md
 */
import type { CanonicalUnit, LanguageDefinition, } from "./types.ts";

/** Registry of languages and of their keyword/unit synonyms. */
export class LanguageRegistry {
  /** Registered languages by id (equivalent of Ruby `@languages`). */
  private languages: Map<string, LanguageDefinition> = new Map();
  /** langId → (synonym → canonical keyword). */
  private keywordIndex: Map<string, Map<string, string>> = new Map();
  /** langId → (synonym → canonical unit). */
  private unitIndex: Map<string, Map<string, string>> = new Map();

  /**
   * Registers a language and builds its indexes. Registering twice with the
   * same id replaces the previous one. Duplicate synonyms within the same
   * language pointing to different canonicals throw an Error.
   *
   * @param lang Language definition to register.
   * @throws Error When a synonym maps to two different canonicals.
   */
  register(lang: LanguageDefinition,): void {
    this.languages.set(lang.id, lang,);
    const kw = new Map<string, string>();
    for (const [canonical, synonyms,] of Object.entries(lang.keywords,)) {
      this.addMapping(kw, canonical, canonical, lang.id,);
      for (const syn of synonyms) {
        this.addMapping(kw, syn, canonical, lang.id,);
      }
    }
    this.keywordIndex.set(lang.id, kw,);

    const un = new Map<string, string>();
    for (const [canonical, synonyms,] of Object.entries(lang.units,)) {
      this.addMapping(un, canonical, canonical, lang.id,);
      for (const syn of synonyms) {
        this.addMapping(un, syn, canonical, lang.id,);
      }
    }
    this.unitIndex.set(lang.id, un,);
  }

  /**
   * Adds one `from → to` pair, rejecting conflicting duplicates.
   *
   * @param index Index of the language being built.
   * @param from Synonym being registered.
   * @param to Canonical form the synonym maps to.
   * @param langId Id of the language being registered.
   * @throws Error When the synonym already maps to another canonical.
   */
  private addMapping(
    index: Map<string, string>,
    from: string,
    to: string,
    langId: string,
  ): void {
    const existing = index.get(from,);
    if (existing !== undefined && existing !== to) {
      throw new Error(
        `Sinônimo '${from}' colide em '${langId}': mapeia para ` +
          `'${existing}' e '${to}'.`,
      );
    }
    index.set(from, to,);
  }

  /**
   * Returns the language definition, or null when not registered.
   *
   * @param id Language id.
   * @returns The definition, or `null`.
   */
  get(id: string,): LanguageDefinition | null {
    return this.languages.get(id,) ?? null;
  }

  /**
   * All registered languages, in registration order.
   *
   * @returns The registered definitions.
   */
  all(): LanguageDefinition[] {
    return [...this.languages.values(),];
  }

  /**
   * Resolves a token text `word` to the canonical keyword of the `langId`
   * language. Fallback: if the language does not translate it, the English
   * canonical form is tried. Returns null when nothing matches (the token stays
   * an ID).
   *
   * @param word Token text as written in the source file.
   * @param langId Language of the source file.
   * @returns The canonical keyword, or `null`.
   */
  resolve(word: string, langId: string,): string | null {
    const hit = this.keywordIndex.get(langId,)?.get(word,);
    if (hit !== undefined) {
      return hit;
    }
    return this.keywordIndex.get("en",)?.get(word,) ?? null;
  }

  /**
   * Resolves a local duration unit to its canonical form.
   *
   * @param unit Unit text as written in the source file.
   * @param langId Language of the source file.
   * @returns The canonical unit, or `null`.
   */
  resolveUnit(unit: string, langId: string,): CanonicalUnit | null {
    const hit = this.unitIndex.get(langId,)?.get(unit,);
    if (hit !== undefined) {
      return hit as CanonicalUnit;
    }
    const en = this.unitIndex.get("en",)?.get(unit,);
    return (en as CanonicalUnit | undefined) ?? null;
  }

  /**
   * True when `word` is a unit registered in the language itself (without the
   * English fallback). The scanner uses this so that valid English literals in
   * other contexts are not corrupted (e.g. `loadunit days` in a pt-BR file must
   * not become 'd').
   *
   * @param word Unit text to test.
   * @param langId Language of the source file.
   * @returns Whether the unit belongs to that language.
   */
  hasUnitInLanguage(word: string, langId: string,): boolean {
    return this.unitIndex.get(langId,)?.has(word,) ?? false;
  }

  /**
   * Complete `synonym → canonical` map of the language, merged with the
   * English fallback (the language wins on overlap).
   *
   * @param langId Language whose map is requested.
   * @returns The merged synonym map.
   */
  canonicalizeKeywords(langId: string,): Map<string, string> {
    const merged = new Map(this.keywordIndex.get("en",),);
    const own = this.keywordIndex.get(langId,);
    if (own) {
      for (const [syn, canonical,] of own) {
        merged.set(syn, canonical,);
      }
    }
    return merged;
  }
}
