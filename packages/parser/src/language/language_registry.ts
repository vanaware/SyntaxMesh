export class LanguageRegistry {
  private static instance: LanguageRegistry;
  private languages = new Map<string, LanguageDefinition>();
  private defaultLanguageId: string | null = null;

  private constructor() {}

  static getInstance(): LanguageRegistry {
    if (!LanguageRegistry.instance) {
      LanguageRegistry.instance = new LanguageRegistry();
    }
    return LanguageRegistry.instance;
  }

  register(language: LanguageDefinition): void {
    this.languages.set(language.id, language);
    if (!this.defaultLanguageId) {
      this.defaultLanguageId = language.id;
    }
  }

  getLanguage(id: string): LanguageDefinition | undefined {
    return this.languages.get(id);
  }

  setDefault(id: string): void {
    if (this.languages.has(id)) {
      this.defaultLanguageId = id;
    }
  }

  getDefault(): LanguageDefinition {
    const lang = this.languages.get(this.defaultLanguageId || 'en');
    if (!lang) {
      throw new Error('No language registered');
    }
    return lang;
  }
}

export interface LanguageDefinition {
  id: string;
  name: string;
  keywords: Record<string, string[]>;
  units: Record<string, string[]>;
}