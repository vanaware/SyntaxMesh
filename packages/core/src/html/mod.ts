/**
 * Bloco B da Fase 17 — geração HTML (`HTMLElements` e `HTMLDocument`).
 *
 * O `export *` no `src/mod.ts` top-level foi aberto em **17.13**, quando a
 * casca mínima `richtext/html-shell.ts` foi substituída por este `HTMLDocument`
 * real e `createHtmlShell`/`HtmlShell` deixaram de existir (ADR 038).
 *
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 */

export * from "./html-document.ts";
export * from "./html-elements.ts";
