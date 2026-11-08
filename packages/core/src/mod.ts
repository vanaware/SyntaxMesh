/**
 * @syntaxmesh/core
 *
 * O Core e independente de DOM, Preact, BeerCSS, IndexedDB, OPFS
 * e de globals de navegador.
 */

import { VERSION, } from "./version.ts";

export const CORE_VERSION = VERSION;

// Metadados da aplicação (nome, versão) — fonte das seções `version`/`help`
// do envelope e do cabeçalho da CLI (Fase 24).
export * from "./app-config.ts";

// Export time module
export * from "./time/mod.ts";
// Export calendar module
export * from "./calendar/working-hours.ts";
// Export format module
export * from "./format/real-format.ts";
// Export compat
export * from "./compat.ts";
// Export scheduling module
export * from "./scheduling/mod.ts";
// Export model module
export * from "./model/mod.ts";
// Export attributes module
export * from "./attributes/mod.ts";
// Export utils module
export * from "./utils/mod.ts";

// Fase 18 — contratos de I/O injetáveis (ADR 037): FileStore/KeyValueStore
export * from "./interfaces/mod.ts";

// Fase 18 — time sheets (TimeSheetRecord/TimeSheet/TimeSheets)
export * from "./timesheet/mod.ts";

// Fase 18 — time/status sheets: EmailMessage e SheetHandlerBase (ADR 036/037)
export * from "./sheets/mod.ts";

// Phase 6 exports (re-export from sub-modules)
export * from "./time/scoreboard-bits.ts";
export * from "./scheduling/limits.ts";
export * from "./scheduling/shift-assignments.ts";
export * from "./utils/project-object-id.ts";

// Phase 8 exports (re-export from finance module)
export * from "./finance/mod.ts";

// 9.9.14 — export TaskJuggler
export { TaskJuggler, } from "./taskjuggler.ts";
// Fase 24 — provedor de conteúdo injetado (ADR 034)
export type { FileContentProvider, } from "./taskjuggler.ts";
// Fase 24 — `execute(request) → ExecutionResult` (envelope JSON, ADR 034) +
// normalização de caminhos. Lib pública: tipos de dados puros (adendo §3.6).
export * from "./execution/mod.ts";

// Fase 10 — lexer e parser (port de TextParser/*)
export * from "./lexer/mod.ts";
export * from "./parser/mod.ts";

// Fase 10 — i18n (extensão SyntaxMesh — ADR 023)
export {
  CANONICAL_KEYWORDS,
  type CanonicalKeyword,
  type CanonicalUnit,
  en,
  es,
  globalRegistry,
  type LanguageDefinition,
  LanguageRegistry,
  ptBR,
} from "./i18n/mod.ts";
export { SourceFileInfo, } from "./source-file-info.ts";

// Fase 11 — expressões lógicas (Logical*) e Query
export * from "./logic/logical-operation.ts";
export * from "./logic/logical-attribute.ts";
export * from "./logic/logical-flag.ts";
export * from "./logic/logical-function.ts";
export * from "./logic/logical-expression.ts";
export * from "./logic/type-guards.ts";
// Exportação explícita para não conflitar com a interface `Query` mínima de
// `account-scenario.ts` (re-exportada via `export *` do modelo).
export { Query, type QueryParams, } from "./query/query.ts";
export * from "./query/custom-data.ts";
export * from "./query/simple-query-expander.ts";

// Fase 14 — relatórios (formato intermediário + geração no browser, ADR 027)
export * from "./reports/mod.ts";

// Fase 14.22 — o pincel SVG mínimo (`painter-min.ts`) foi apagado em 17.15;
// `ChartPlotter` agora desenha com o Painter real do Bloco D abaixo.

// Fase 17 (17.7) — Painter real: Color / Points / SVGSupport (ADR 038)
export * from "./painter/mod.ts";

// Fase 17 (17.12) — Bloco A: XMLElement/XMLDocument reais. O re-export estava
// bloqueado por `reports/xml-node.ts` (duplicata mínima com os mesmos nomes),
// apagado nesta tarefa; `msp-xml-re.ts` e `niku-report.ts` migram para cá.
export * from "./xml/mod.ts";

// Fase 17 (17.13) — Bloco B: HTMLDocument/HTMLElements reais. A casca mínima
// `richtext/html-shell.ts` (`createHtmlShell`/`HtmlShell`) foi substituída por
// este `HTMLDocument` e apagada; o re-export estava bloqueado até aqui (ADR 038).
export * from "./html/mod.ts";

// Fase 15 — Gantt (HTML+CSS puro, ADR 028)
export * from "./gantt/mod.ts";
export * from "./chart-plotter.ts";
