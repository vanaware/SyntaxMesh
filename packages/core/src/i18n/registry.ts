/**
 * LanguageRegistry — registro de idiomas da linguagem TJP (extensão
 * SyntaxMesh; não existe no TaskJuggler original).
 *
 * Mantém índices `sinônimo → canônico` por idioma. A resolução é
 * case-sensitive e exata: só traduz IDs idênticos ao sinônimo registrado.
 * Idiomas não-`en` têm fallback implícito para o canônico inglês.
 *
 * @see ADR 023 (i18n de keywords)
 * @see docs/syntaxmesh/04-linguagem-multilingue.md
 */
import type { CanonicalUnit, LanguageDefinition, } from "./types.ts";

export class LanguageRegistry {
  /** Idiomas registrados por id (Ruby @languages equivalente). */
  private languages: Map<string, LanguageDefinition> = new Map();
  /** langId → (sinônimo → keyword canônico). */
  private keywordIndex: Map<string, Map<string, string>> = new Map();
  /** langId → (sinônimo → unidade canônica). */
  private unitIndex: Map<string, Map<string, string>> = new Map();

  /**
   * Registra um idioma e constrói seus índices. Registrer duas vezes com o
   * mesmo id substitui o anterior. Sinônimos duplicados dentro do mesmo
   * idioma apontando para canônicos diferentes lançam Error.
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

  /** Retorna a definição do idioma ou null se não registrado. */
  get(id: string,): LanguageDefinition | null {
    return this.languages.get(id,) ?? null;
  }

  /** Todos os idiomas registrados, na ordem de registro. */
  all(): LanguageDefinition[] {
    return [...this.languages.values(),];
  }

  /**
   * Resolve um texto de token `word` para o keyword canônico do idioma
   * `langId`. Fallback: se o idioma não traduz, tenta o inglês (canônico).
   * Retorna null se nada casa (o token permanece ID).
   */
  resolve(word: string, langId: string,): string | null {
    const hit = this.keywordIndex.get(langId,)?.get(word,);
    if (hit !== undefined) {
      return hit;
    }
    return this.keywordIndex.get("en",)?.get(word,) ?? null;
  }

  /** Resolve uma unidade de duração local para a forma canônica. */
  resolveUnit(unit: string, langId: string,): CanonicalUnit | null {
    const hit = this.unitIndex.get(langId,)?.get(unit,);
    if (hit !== undefined) {
      return hit as CanonicalUnit;
    }
    const en = this.unitIndex.get("en",)?.get(unit,);
    return (en as CanonicalUnit | undefined) ?? null;
  }

  /**
   * True quando `word` é unidade registrada no próprio idioma (sem o
   * fallback inglês). O scanner usa isto para não corromper literais
   * ingleses válidos em outros contextos (ex.: `loadunit days` num
   * arquivo pt-BR não pode virar 'd').
   */
  hasUnitInLanguage(word: string, langId: string,): boolean {
    return this.unitIndex.get(langId,)?.has(word,) ?? false;
  }

  /**
   * Mapa completo sinônimo → canônico do idioma, mesclado com o fallback
   * inglês (o idioma tem prioridade em caso de sobreposição).
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
