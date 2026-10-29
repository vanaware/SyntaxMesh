/**
 * check-stubs — valida a política de stubs (Fase 11-Gaps, 11.G.A.5 / ADR 032).
 *
 * Regra: todo `throw new NotYetImplementedError(...)` em `packages/core/src/`
 * deve ter, nas 3 linhas anteriores, um comentário no padrão:
 *
 *   // Ancorado: Fase <N> — <razão>
 *
 * O gate `gate:phase-13` roda este script; se houver stub não-ancorado, ele
 * falha com exit != 0.
 *
 * Uso: `deno task check:stubs`.
 */
import { walkSync, } from "@std/fs";
import { resolve, } from "@std/path";

const ANCHOR_RE = /^\s*\/\/\s*Ancorado:\s*Fase\s+\S+\s+—\s+\S/;
const NYI_RE = /NotYetImplementedError\s*\(/;
const ROOT = resolve(import.meta.dirname!, "..", "packages/core/src",);

interface Violation {
  file: string;
  line: number;
  snippet: string;
}

function checkFile(path: string,): Violation[] {
  const src = Deno.readTextFileSync(path,);
  const lines = src.split("\n",);
  const violations: Violation[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // ignora imports/class defs/doc comments
    if (/^\s*(\/\/|\*|\/\*)/.test(line,)) continue;
    if (!NYI_RE.test(line,)) continue;
    if (!/throw\s+new\s+NotYetImplementedError/.test(line,)) continue;
    // varre até 3 linhas acima procurando `// Ancorado: Fase N — …`
    let anchored = false;
    for (let j = Math.max(0, i - 3,); j < i; j++) {
      if (ANCHOR_RE.test(lines[j]!,)) {
        anchored = true;
        break;
      }
    }
    if (!anchored) {
      violations.push({ file: path, line: i + 1, snippet: line.trim(), },);
    }
  }
  return violations;
}

const violations: Violation[] = [];
for (
  const entry of walkSync(ROOT, { exts: [".ts",], includeDirs: false, },)
) {
  violations.push(...checkFile(entry.path,),);
}

if (violations.length === 0) {
  console.log(`check:stubs OK — todos os stubs anotados.`,);
} else {
  console.error(
    `check:stubs FALHOU — ${violations.length} stub(s) sem '// Ancorado: Fase N — <razão>':`,
  );
  for (const v of violations) {
    const rel = v.file.replace(ROOT + "/", "",);
    console.error(`  ${rel}:${v.line}  ${v.snippet}`,);
  }
  Deno.exit(1,);
}
