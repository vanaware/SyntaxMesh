#!/usr/bin/env deno run --allow-read --allow-write

/**
 * Gera `template.golden.json` (Fase 23, 23.7.2).
 *
 * Runner TS puro (sem oracle tj3): `template` é extensão TS-only (ADR 033),
 * então o golden é o snapshot da própria implementação — determinístico e
 * idempotente byte-a-byte (`template_golden_test.ts` re-gera e compara).
 *
 * Arquivo único (`template.golden.json`) com as cinco seções: expansão básica,
 * matriz de argumentos, composição, macros no corpo e erros do §5.
 *
 * Usage: deno task golden:generate:template
 */

import { buildTemplateGolden, } from "./template-expansion-snapshot.ts";

const outputPath = new URL("./template.golden.json", import.meta.url,);

const json = JSON.stringify(buildTemplateGolden(), null, 2,) + "\n";
await Deno.writeTextFile(outputPath, json,);
console.info(`Wrote ${outputPath.pathname} (${json.length} bytes)`,);
