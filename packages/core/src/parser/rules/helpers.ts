/**
 * TjpSyntaxRules rule registration helpers.
 *
 * `rule()` replaces Ruby's `def rule_X ... end`: it reuses the existing Rule
 * (registered through newRule) and clears the placeholder patterns before
 * redefining it. `ensurePlaceholders()` creates egg rules for references not
 * implemented yet during the incremental development of sub-phases 10.11–10.14
 * — in the final state no placeholders remain.
 */
import type { ProjectFileParser, } from "../project-file-parser.ts";
import type { Rule, } from "../rule.ts";

/** Defines (or redefines) the `name` rule with the patterns of `body`. */
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
 * Creates placeholder rules for `!name` references to rules of blocks not
 * registered yet. Iterates until the transitive closure. The placeholder has a
 * single pattern with an unreachable literal token (`<placeholder>`) — it
 * closes the reference chain without contributing transitions (nor eof, which
 * would collide with the `!optionalRule .` patterns of the real rules).
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
        // Unreachable literal token: the scanner never produces an ID/LITERAL
        // with this text, and checkRule only validates variables/references.
        parser.pattern([`_<placeholder:${name}>`,], null,);
      },);
      created.push(name,);
    }
  }
}
