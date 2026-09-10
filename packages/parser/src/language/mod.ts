/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Language — Registro de idiomas e keywords canônicas
// ============================================================================

/**
 * Definição de um idioma suportado
 */
export interface LanguageDefinition {
  id: string;
  name: string;
  keywords: Record<string, string[]>;
}

/**
 * Palavras-chave canônicas do sistema
 */
export type CanonicalKeyword =
  | "project"
  | "task"
  | "resource"
  | "depends"
  | "effort"
  | "duration"
  | "report"
  | "language";

/**
 * Registo central de idiomas
 */
export class LanguageRegistry {
  private languages: Map<string, LanguageDefinition> = new Map();

  /**
   * Registra um novo idioma no registo
   */
  register(language: LanguageDefinition,): void {
    this.languages.set(language.id, language,);
  }

  /**
   * Obtém a definição de um idioma pelo ID
   */
  get(id: string,): LanguageDefinition | undefined {
    return this.languages.get(id,);
  }

  /**
   * Resolve uma keyword para sua forma canônica
   */
  resolve(languageId: string, word: string,): CanonicalKeyword | null {
    const lang = this.languages.get(languageId,);
    if (!lang) return null;

    for (const [canonical, variants,] of Object.entries(lang.keywords,)) {
      if (variants.includes(word.toLowerCase(),)) {
        return canonical as CanonicalKeyword;
      }
    }
    return null;
  }

  /**
   * Lista todos os IDs de idiomas registrados
   */
  listIds(): string[] {
    return Array.from(this.languages.keys(),);
  }
}

/**
 * Configuração padrão com inglês, português e espanhol
 */
export function createDefaultLanguages(): LanguageRegistry {
  const registry = new LanguageRegistry();

  registry.register({
    id: "en",
    name: "English",
    keywords: {
      project: ["project",],
      task: ["task",],
      resource: ["resource",],
      depends: ["depends",],
      effort: ["effort",],
      duration: ["duration",],
      report: ["report",],
      language: ["language",],
    },
  },);

  registry.register({
    id: "pt-BR",
    name: "Português (Brasil)",
    keywords: {
      project: ["projeto",],
      task: ["tarefa",],
      resource: ["recurso",],
      depends: ["depende",],
      effort: ["esforço",],
      duration: ["duração",],
      report: ["relatório",],
      language: ["idioma",],
    },
  },);

  registry.register({
    id: "es",
    name: "Español",
    keywords: {
      project: ["proyecto",],
      task: ["tarea",],
      resource: ["recurso",],
      depends: ["depende",],
      effort: ["esfuerzo",],
      duration: ["duración",],
      report: ["informe",],
      language: ["lenguaje",],
    },
  },);

  return registry;
}
