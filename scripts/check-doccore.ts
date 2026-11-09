/**
 * check-doccore — garante que o `doc-core` (Fase 22, 22.1b) continue **puro**.
 *
 * O subpacote `@vanaware/syntaxmesh/doc-core` (`packages/core/src/docgen/`) é
 * consumido por extensão/VSCode, CLI e PWA: devolve **dados** (texto e mapas de
 * arquivo) e nunca toca o ambiente. Este gate falha se aparecer:
 *
 * - qualquer uso de `Deno.*` (FS, argv, terminal, exit);
 * - qualquer import de `node:` ou de `npm:`/`jsr:` de runtime;
 * - `process.`/`globalThis.Deno`.
 *
 * `import type` de outros módulos do core é permitido — o gate é sobre
 * ambiente, não sobre acoplamento.
 *
 * Uso: `deno task check:doccore` (entra no `deno task tests`).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.1b
 */
import { walkSync, } from "@std/fs";
import { resolve, } from "@std/path";

const ROOT = resolve(import.meta.dirname!, "..", "packages/core/src/docgen",);

/** Padrões proibidos dentro do `doc-core`, com o motivo do gate. */
const FORBIDDEN: Array<{ re: RegExp; reason: string }> = [
  {
    // `Deno.<ident>` e não a prosa "… runs on Deno." dos capítulos.
    re: /\bDeno\.[A-Za-z_$]/,
    reason: "Deno.* (ambiente) não existe no doc-core",
  },
  {
    re: /from\s+["']node:/,
    reason: "import de 'node:*' não existe no doc-core",
  },
  {
    re: /\bprocess\.(env|argv|exit|cwd)/,
    reason: "process.* não existe no doc-core",
  },
];

interface Violation {
  file: string;
  line: number;
  snippet: string;
  reason: string;
}

const violations: Violation[] = [];
for (
  const entry of walkSync(ROOT, { exts: [".ts",], includeDirs: false, },)
) {
  const lines = Deno.readTextFileSync(entry.path,).split("\n",);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Comentários e imports de tipo não executam nada.
    if (/^\s*(\/\/|\*|\/\*)/.test(line,)) continue;
    for (const rule of FORBIDDEN) {
      if (rule.re.test(line,)) {
        violations.push({
          file: entry.path,
          line: i + 1,
          snippet: line.trim(),
          reason: rule.reason,
        },);
      }
    }
  }
}

if (violations.length === 0) {
  console.log("check:doccore OK — o doc-core não toca o ambiente.",);
} else {
  console.error(
    `check:doccore FALHOU — ${violations.length} uso(s) de ambiente no doc-core:`,
  );
  for (const v of violations) {
    const rel = v.file.replace(`${ROOT}/`, "",);
    console.error(`  ${rel}:${v.line}  ${v.snippet}  (${v.reason})`,);
  }
  Deno.exit(1,);
}
