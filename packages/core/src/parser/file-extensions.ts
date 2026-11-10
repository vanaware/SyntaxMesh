/**
 * File extensions accepted by the parser (phase 24, 24.2.36).
 *
 * Decision of 2026-11-07 (plan §1.6): SyntaxMesh adopts **`.smx`** as the
 * native extension for projects and sheets. The TaskJuggler forms (`.tjp`,
 * `.tji`) remain accepted for compatibility — `.tjp`/`.tji` in new material
 * are allowed as legacy only, never generated.
 *
 * This module lives outside `project-file-parser.ts` because the grammar rules
 * (`rules/project.ts`) also need the same names, and importing the parser from
 * the rules would create a cycle (`parser → rules → parser`).
 *
 * ⚠️ **Validated** deviation from rule zero (ADR 011): Ruby required `.tjp`
 * and `.tji`. The ADR 037 addendum records the decision (24.2.35).
 */

/** Extensions accepted for the project **master** file. */
export const PROJECT_FILE_EXTENSIONS = [".tjp", ".smx",] as const;

/** Extensions accepted for an **included** file (`include "…"`). */
export const INCLUDE_FILE_EXTENSIONS = [".tji", ".smx",] as const;

/** `true` when the name ends with one of the given extensions. */
function hasExtension(
  fileName: string,
  extensions: readonly string[],
): boolean {
  return extensions.some((ext,) => fileName.endsWith(ext,));
}

/** `true` when the name has one of the master-file extensions. */
export function isProjectFileName(fileName: string,): boolean {
  return hasExtension(fileName, PROJECT_FILE_EXTENSIONS,);
}

/** `true` when the name has one of the include-file extensions. */
export function isIncludeFileName(fileName: string,): boolean {
  return hasExtension(fileName, INCLUDE_FILE_EXTENSIONS,);
}

/** Human-readable list of the extensions (`'.tjp' or '.smx'`). */
export function formatExtensionList(extensions: readonly string[],): string {
  return extensions.map((ext,) => `'${ext}'`).join(" or ",);
}
