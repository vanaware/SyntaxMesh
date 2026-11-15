/**
 * Benchmark de parse (F21¹, 26.11.1).
 *
 * Mede o `ProjectFileParser` sobre projetos sintéticos de 100 e 1000 tarefas.
 * O source é construído fora do loop para isolar o custo de parse.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.11)
 */
import { buildSource, parseSource, } from "./workloads.ts";

const src100 = buildSource(100,);
const src1000 = buildSource(1000,);

Deno.bench({ name: "parse_100", group: "parse", }, () => {
  parseSource(src100,);
},);

Deno.bench({ name: "parse_1000", group: "parse", }, () => {
  parseSource(src1000,);
},);
