export interface LanguageDefinition {
  id: string;
  name: string;
  keywords: Record<string, string[]>;
  units: Record<string, string[]>;
}