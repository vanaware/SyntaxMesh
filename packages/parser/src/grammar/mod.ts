/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Grammar — Definição gramatical do .tjp
// ============================================================================

/**
 * Regra gramatical que define uma estrutura válida do .tjp
 */
export interface GrammarRule {
  name: string;
  pattern: RegExp;
  description: string;
}

/**
 * Regras básicas da gramatura TaskJuggler-inspired
 */
export const GRAMMAR_RULES: Record<string, GrammarRule> = {
  project: {
    name: "project",
    pattern: /^project\s+"([^"]+)"\s*\{/,
    description: "Declaração de projeto com nome entre aspas",
  },
  task: {
    name: "task",
    pattern: /^task\s+"([^"]+)"\s*\{/,
    description: "Declaração de tarefa com nome entre aspas",
  },
  resource: {
    name: "resource",
    pattern: /^resource\s+"([^"]+)"\s*\{/,
    description: "Declaração de recurso com nome entre aspas",
  },
  effort: {
    name: "effort",
    pattern: /^effort\s+(\d+[dhms])\s*$/,
    description: "Declaração de esforço (ex: 10d, 5h)",
  },
  duration: {
    name: "duration",
    pattern: /^duration\s+(\d+[dhms])\s*$/,
    description: "Declaração de duração (ex: 10d, 5h)",
  },
  depends: {
    name: "depends",
    pattern: /^depends\s+"([^"]+)"\s*$/,
    description: 'Dependência de tarefa (ex: depends "Tarefa A")',
  },
};

/**
 * Verifica se uma linha corresponde a alguma regra gramatical
 */
export function matchLine(line: string,): GrammarRule | null {
  for (const rule of Object.values(GRAMMAR_RULES,)) {
    if (rule.pattern.test(line,)) {
      return rule;
    }
  }
  return null;
}
