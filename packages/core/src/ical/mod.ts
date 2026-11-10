/**
 * Block C of Phase 17 — iCalendar RFC 5545 generator (`ICalendar.rb`).
 *
 * Since 17.14 the minimal `reports/i-calendar.ts` is gone and these names feed
 * the package: `reports/mod.ts` re-exports from here (with the alias
 * `Journal as ICalJournal`, because top-level `Journal` is the ADR 029 model)
 * and `src/mod.ts` exposes the block through `reports/mod.ts` (ADR 038).
 *
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 */

export * from "./component.ts";
export * from "./event.ts";
export * from "./i-calendar.ts";
export * from "./journal.ts";
export * from "./person.ts";
export * from "./todo.ts";
