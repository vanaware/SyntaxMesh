/**
 * Helpers de registro de regras TjpSyntaxRules.
 *
 * `rule()` substitui o `def rule_X ... end` do Ruby: reaproveita a Rule
 * existente (registro via newRule) e limpa padrões de placeholder antes
 * de redefinir. `ensurePlaceholders()` cria regras-ovo para referências
 * ainda não implementadas durante o desenvolvimento incremental das
 * subfases 10.11–10.14 — no estado final não sobram placeholders.
 */
import type { ProjectFileParser, } from "../project-file-parser.ts";
import type { Rule, } from "../rule.ts";

/** Define (ou redefine) a regra `name` com os padrões de `body`. */
export function rule(
  parser: ProjectFileParser,
  name: string,
  body: () => void,
): Rule {
  const existing = parser.rules.get(name,);
  if (existing) {
    existing.patterns.length = 0;
    existing.flushCache();
  }
  parser.newRule(name, body,);
  return parser.rules.get(name,)!;
}

/**
 * Cria regras placeholder para referências `!nome` a regras de blocos ainda
 * não registrados. Itera até o fecho transitivo. O placeholder tem um único
 * padrão com um token literal inalcançável (`<placeholder>`) — fecha a cadeia
 * de referências sem contribuir transições (nem eof, que colidiria com
 * padrões `!regraOpcional .` das regras reais).
 */
export function ensurePlaceholders(parser: ProjectFileParser,): string[] {
  const created: string[] = [];
  for (;;) {
    const missing = new Set<string>();
    for (const ruleObj of parser.rules.values()) {
      for (const pat of ruleObj.patterns) {
        for (const [type, name,] of pat.tokens) {
          if (type === "reference" && !parser.rules.has(name,)) {
            missing.add(name,);
          }
        }
      }
    }
    if (missing.size === 0) return created;
    for (const name of missing) {
      parser.newRule(name, () => {
        // Token literal inalcançável: o scanner nunca produz um ID/LITERAL
        // com esse texto, e checkRule só valida variáveis/referências.
        parser.pattern([`_<placeholder:${name}>`,], null,);
      },);
      created.push(name,);
    }
  }
}
