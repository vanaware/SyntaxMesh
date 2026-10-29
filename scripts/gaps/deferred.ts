/**
 * gaps/deferred — falha se sobrou algum teste com a tag
 * `// Gate: fase-11-logical-gaps` (Fase 11-Gaps, Bloco K / 11.G.G.4.2).
 *
 * O Bloco K varre os testes deferidos pela Fase 12 e remove a tag. Este
 * script é uma verificação de sanity do gate: `test:deferred` precisa passar
 * para que o `gate:phase-13` complete.
 */
import { walkSync, } from "@std/fs";
import { resolve, } from "@std/path";

const ROOT = resolve(
  import.meta.dirname!,
  "..",
  "..",
  "packages/core/tests",
);

const TAG = /\/\/\s*Gate:\s*fase-11-logical-gaps/;

const hits: Array<{ file: string; line: number }> = [];
for (
  const entry of walkSync(ROOT, { exts: [".ts",], includeDirs: false, },)
) {
  const lines = Deno.readTextFileSync(entry.path,).split("\n",);
  lines.forEach((l, i,) => {
    if (TAG.test(l,)) hits.push({ file: entry.path, line: i + 1, },);
  },);
}

if (hits.length === 0) {
  console.log("test:deferred OK — nenhum teste marcado com Gate pendente.",);
} else {
  console.error(
    `test:deferred FALHOU — ${hits.length} teste(s) ainda com tag Gate:`,
  );
  for (const h of hits) {
    const rel = h.file.replace(ROOT + "/", "",);
    console.error(`  ${rel}:${h.line}`,);
  }
  Deno.exit(1,);
}
