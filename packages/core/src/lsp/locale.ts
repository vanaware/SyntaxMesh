/**
 * `locale.ts` — language resolution of a document (22.1.6).
 *
 * The `language "..."` directive of the file is **sovereign** (plan §12):
 * the extension never overrides it. v1 of the extension always consumes
 * English help/manual regardless of the resolved locale; the signature keeps
 * the locale for the post-Fase 21 multilingual addendum.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (resolveLocale)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { detectLanguage, } from "../parser/project-file-parser.ts";

/** Locales supported by the language (normalized, lower-case). */
export type Locale = "pt-br" | "en" | "es";

/**
 * Resolves the locale of a document from its `language "..."` directive.
 *
 * @param uri document URI — kept in the signature for the contract; v1
 * resolves from the text alone (the directive is sovereign).
 * @param text full document text.
 * @returns `"pt-br"`, `"es"` or `"en"`; unknown/absent directives default to
 * `"en"`.
 */
export function resolveLocale(uri: string, text: string,): Locale {
  const declared = detectLanguage(text,);
  if (declared === null) return "en";
  const code = declared.toLowerCase().replace("_", "-",);
  if (code.startsWith("pt",)) return "pt-br";
  if (code === "es" || code.startsWith("es-",)) return "es";
  return "en";
}
