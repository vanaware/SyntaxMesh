/**
 * Benchmark de diagnósticos LSP (F21², 26.31.1).
 *
 * Mede o `analyzeDocument` (lsp-core) sobre projetos sintéticos de 100 e 1000
 * tarefas — o mesmo workload do `parse_bench`, agora pelo ponto de entrada dos
 * serviços de linguagem (parse + snapshot de mensagens, sem scheduling). O
 * source é construído fora do loop para isolar o custo de análise.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.31)
 */
import { analyzeDocument, } from "../packages/core/src/lsp/mod.ts";
import { buildSource, } from "./workloads.ts";

/** URI fixo: o `analyzeDocument` usa-o como nome de arquivo dos diagnósticos. */
const URI = "file:///bench/lsp.tjp";
const src100 = buildSource(100,);
const src1000 = buildSource(1000,);

Deno.bench({ name: "lsp_diagnostics_100", group: "lsp", }, () => {
  analyzeDocument(URI, src100, {},);
},);

Deno.bench({ name: "lsp_diagnostics_1000", group: "lsp", }, () => {
  analyzeDocument(URI, src1000, {},);
},);
