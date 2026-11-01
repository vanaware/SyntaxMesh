#!/usr/bin/env deno run --allow-read --allow-write

/**
 * Gera `reports-extensions.golden.json` (14C.0.12).
 *
 * Runner TS puro (sem oracle tj3): as extensões do Fase 14 Complemento
 * (json/table, picture html, galeria, índices do Journal, fixture base) não
 * existem no TaskJuggler Ruby, então o golden é o próprio snapshot desta
 * implementação — determinístico e idempotente byte-a-byte (o teste
 * `reports-extensions_golden_test.ts` re-gera e compara).
 *
 * Usage: deno task golden:generate:extensions
 */

import { buildExtensionSnapshot, } from "./extension-snapshot.ts";

const outputPath = new URL(
  "./reports-extensions.golden.json",
  import.meta.url,
);

const json = JSON.stringify(buildExtensionSnapshot(), null, 2,) + "\n";
await Deno.writeTextFile(outputPath, json,);
console.info(`Wrote ${outputPath.pathname} (${json.length} bytes)`,);
