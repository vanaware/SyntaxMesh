/**
 * Phase 17 block B — HTML generation (`HTMLElements` and `HTMLDocument`).
 *
 * The `export *` in the top-level `src/mod.ts` was opened in **17.13**, when
 * the minimal `richtext/html-shell.ts` shell was replaced by this real
 * `HTMLDocument` and `createHtmlShell`/`HtmlShell` ceased to exist (ADR 038).
 *
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 */

export * from "./html-document.ts";
export * from "./html-elements.ts";
