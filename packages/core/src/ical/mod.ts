/**
 * Bloco C da Fase 17 — gerador iCalendar RFC 5545 (`ICalendar.rb`).
 *
 * Desde 17.14 o mínimo `reports/i-calendar.ts` está apagado e estes nomes
 * alimentam o pacote: `reports/mod.ts` re-exporta daqui (com o alias
 * `Journal as ICalJournal`, pois `Journal` no topo é o modelo ADR 029) e
 * `src/mod.ts` expõe o bloco via `reports/mod.ts` (ADR 038).
 *
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 */

export * from "./component.ts";
export * from "./event.ts";
export * from "./i-calendar.ts";
export * from "./journal.ts";
export * from "./person.ts";
export * from "./todo.ts";
