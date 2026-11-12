/**
 * check-lspcore — garante que o `lsp-core` (Fase 22, 22.1) continue **puro**.
 *
 * O subpacote `@vanaware/syntaxmesh/lsp-core` (`packages/core/src/lsp/`) é
 * consumido pela extensão desktop, pelo worker web e pelo servidor stdio
 * standalone: devolve **dados** do protocolo LSP e nunca abre transporte.
 * Este gate falha se aparecer (plano §5.1, tarefa 22.1.4):
 *
 * - import do runtime `vscode-languageserver` ou `vscode-languageclient`
 *   (os **tipos** `vscode-languageserver-types` são permitidos);
 * - import da API `vscode`;
 * - import de `node:*`;
 * - `Deno.stdin`/`Deno.stdout` (transporte é do hospedeiro).
 *
 * A detecção é uma função pura exportada ({@link findLspViolations}) para
 * que o caso negativo seja testável sem escrever arquivo proibido no disco.
 *
 * Uso: `deno task check:lspcore` (entra no `deno task tests`).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.1
 * @see scripts/check-doccore.ts (gate irmão do doc-core)
 */
import { walkSync, } from "@std/fs";
import { resolve, } from "@std/path";

const ROOT = resolve(import.meta.dirname!, "..", "packages/core/src/lsp",);

/** Uma violação de fronteira encontrada pelo gate. */
export interface LspViolation {
  /** Caminho absoluto do arquivo infrator. */
  file: string;
  /** Linha (1-based) da ocorrência. */
  line: number;
  /** Conteúdo da linha, sem espaços nas bordas. */
  snippet: string;
  /** Motivo da proibição. */
  reason: string;
}

/** Padrões proibidos dentro do `lsp-core`, com o motivo do gate. */
export const LSP_FORBIDDEN: Array<{ re: RegExp; reason: string }> = [
  {
    // `vscode-languageserver-types` é a única exceção (só tipos).
    re:
      /(?:from\s+|import\s*\(\s*)["'](?:npm:|jsr:)?vscode-languageserver(?!-types)/,
    reason: "runtime 'vscode-languageserver' não existe no lsp-core",
  },
  {
    re: /(?:from\s+|import\s*\(\s*)["'](?:npm:|jsr:)?vscode-languageclient/,
    reason: "runtime 'vscode-languageclient' não existe no lsp-core",
  },
  {
    re: /(?:from\s+|import\s*\(\s*)["'](?:npm:|jsr:)?vscode["']/,
    reason: "API 'vscode' não existe no lsp-core",
  },
  {
    re: /(?:from\s+|import\s*\(\s*)["']node:/,
    reason: "import de 'node:*' não existe no lsp-core",
  },
  {
    re: /\bDeno\.(stdin|stdout)\b/,
    reason: "Deno.stdin/stdout (transporte) não existe no lsp-core",
  },
];

/**
 * Varre um texto-fonte e devolve as violações de fronteira do `lsp-core`.
 * Linhas de comentário são ignoradas (prosa não executa nada).
 *
 * @param file caminho do arquivo (usado só no relatório).
 * @param text conteúdo completo do arquivo.
 * @returns as violações na ordem das linhas; vazio quando o arquivo é puro.
 */
export function findLspViolations(file: string, text: string,): LspViolation[] {
  const violations: LspViolation[] = [];
  const lines = text.split("\n",);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*(\/\/|\*|\/\*)/.test(line,)) continue;
    for (const rule of LSP_FORBIDDEN) {
      if (rule.re.test(line,)) {
        violations.push({
          file,
          line: i + 1,
          snippet: line.trim(),
          reason: rule.reason,
        },);
      }
    }
  }
  return violations;
}

/** Entry point do gate: varre `src/lsp/` e falha com a lista de violações. */
function main(): void {
  const violations: LspViolation[] = [];
  for (
    const entry of walkSync(ROOT, { exts: [".ts",], includeDirs: false, },)
  ) {
    violations.push(
      ...findLspViolations(entry.path, Deno.readTextFileSync(entry.path,),),
    );
  }
  if (violations.length === 0) {
    console.log("check:lspcore OK — o lsp-core não abre transporte.",);
  } else {
    console.error(
      `check:lspcore FALHOU — ${violations.length} violação(ões) de fronteira no lsp-core:`,
    );
    for (const v of violations) {
      const rel = v.file.replace(`${ROOT}/`, "",);
      console.error(`  ${rel}:${v.line}  ${v.snippet}  (${v.reason})`,);
    }
    Deno.exit(1,);
  }
}

if (import.meta.main) main();
