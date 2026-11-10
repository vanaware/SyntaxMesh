/**
 * Phase 17 block A — XML structure (`XMLElement` and `XMLDocument`).
 *
 * The re-export in the top-level `src/mod.ts` only happens in 17.12, once
 * `reports/xml-node.ts` (a minimal duplicate with the same five names) is
 * migrated and deleted. Until then this `mod.ts` is the entry point of the
 * block.
 *
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 */

export * from "./xml-document.ts";
export * from "./xml-element.ts";
