/**
 * Fase 24 (24.2.18) — auditoria de pureza do pipeline de relatórios.
 *
 * O core não é dono de I/O: desde a ADR 027 (e consolidado na ADR 034), o
 * pipeline de relatórios só produz **texto em memória**. Quem decide imprimir
 * no terminal ou gravar `{name}.{ext}` é o consumidor (CLI `output-policy.ts`,
 * PWA). Este teste é um grep estático no mesmo espírito do `check-stubs`:
 * falha se um módulo do pipeline voltar a falar com disco/terminal.
 *
 * O segundo bloco audita `packages/core/src` inteiro e exige que as únicas
 * ocorrências sejam as já conhecidas e listadas — assim a lista de exceções não
 * apodrece em silêncio (arquivo novo ⇒ teste vermelho).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §5.2
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { walkSync, } from "@std/fs";
import { join, relative, resolve, } from "@std/path";

const SRC = resolve(import.meta.dirname!, "../../src",);

/** Acessos proibidos no pipeline (disco, terminal, processo). */
const FORBIDDEN: Array<[string, RegExp,]> = [
  ["node:fs", /\bnode:fs\b/,],
  ["node:process", /\bnode:process\b/,],
  ["process.stdout/stderr", /\bprocess\.(?:stdout|stderr)\b/,],
  [
    "Deno I/O",
    /\bDeno\.(?:readFileSync|readTextFileSync|writeFileSync|writeTextFileSync|openSync|open|create|stdout|stderr|stdin)\b/,
  ],
  ["console.*", /\bconsole\.(?:log|error|warn|debug|info)\b/,],
];

/**
 * Sinks legados conscientes do core, fora do pipeline de relatórios: `Log`
 * (renderer da UI/Fase 16), o wrapper de `console` (16.14), o leitor de stdin
 * dos `.tji` e o `listReports` legado do `Project` (que a seção da Fase 24 não
 * usa). Qualquer arquivo fora desta lista é violação.
 */
const LEGACY_SINKS = new Set([
  "log.ts",
  "utils/std-io-wrapper.ts",
  "lexer/stream-handle.ts",
  "lexer/scanner.ts",
  "model/project.ts",
],);

/** Linhas de comentário não executam nada — o audit as ignora. */
const COMMENT_RE = /^\s*(?:\/\/|\*|\/\*)/;

interface Hit {
  file: string;
  line: number;
  needle: string;
  text: string;
}

/** Varre um conjunto de arquivos e devolve as ocorrências proibidas. */
function scan(paths: Iterable<string>,): Hit[] {
  const hits: Hit[] = [];
  for (const path of paths) {
    const lines = Deno.readTextFileSync(path,).split("\n",);
    const rel = relative(SRC, path,).replaceAll("\\", "/",);
    for (let i = 0; i < lines.length; i++) {
      const text = lines[i]!;
      if (COMMENT_RE.test(text,)) continue;
      for (const [needle, re,] of FORBIDDEN) {
        if (re.test(text,)) {
          hits.push({ file: rel, line: i + 1, needle, text: text.trim(), },);
        }
      }
    }
  }
  return hits;
}

/** Arquivos `.ts` sob um diretório (recursivo). */
function tsFiles(root: string,): string[] {
  return [...walkSync(root, { exts: [".ts",], includeDirs: false, },),].map(
    (entry,) => entry.path,
  );
}

describe("pureza do pipeline de relatórios (24.2.18)", () => {
  it("model/report.ts, reports/**, execution/** e a fachada não tocam I/O", () => {
    const scope = [
      join(SRC, "model", "report.ts",),
      join(SRC, "taskjuggler.ts",),
      ...tsFiles(join(SRC, "reports",),),
      ...tsFiles(join(SRC, "execution",),),
    ];
    const hits = scan(scope,);
    assertEquals(
      hits.map((h,) => `${h.file}:${h.line} ${h.needle} — ${h.text}`),
      [],
    );
  });

  it("as únicas ocorrências no core são os sinks legados listados", () => {
    const hits = scan(tsFiles(SRC,),);
    const offenders = new Set(hits.map((h,) => h.file),);

    for (const file of offenders) {
      assert(
        LEGACY_SINKS.has(file,),
        `${file} acessa disco/terminal e não está em LEGACY_SINKS`,
      );
    }

    // A lista não pode virar ficção: cada exceção declarada existe de fato.
    for (const file of LEGACY_SINKS) {
      assert(
        offenders.has(file,),
        `${file} não acessa mais I/O — remova de LEGACY_SINKS`,
      );
    }
  });

  it("`generate()` só serializa em memória (sem escrita no dispatch)", () => {
    const source = Deno.readTextFileSync(join(SRC, "model", "report.ts",),);
    // A coleta por formato é um único `outputs.set(...)` no loop de dispatch.
    const sets = source.match(/this\.outputs\.set\(/g,) ?? [];
    assertEquals(sets.length, 1,);
    assert(source.includes("this.outputs.clear()",),);
  });
});
