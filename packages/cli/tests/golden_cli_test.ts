/**
 * Golden da CLI contra o `tj3` real (24.7.4/24.7.6/24.7.7/24.7.8).
 *
 * O oráculo é `scripts/golden/cli-tj3.rb`: roda o TaskJuggler Ruby sobre o
 * **subset** de fixtures que o port também processa e grava, por caso, o que é
 * observável de fora. Este teste roda a **CLI de verdade** (subprocesso, argv e
 * disco reais) sobre os mesmos fixtures e compara:
 *
 * - **código de saída** e **inventário de artefatos** (caminhos relativos
 *   ordenados) — 24.7.4;
 * - **resíduo de stdout**: tudo o que o `tj3` imprime e não é UI é mensagem;
 *   depois de filtrar o resumo do projeto (24.4.5) o stdout tem de ficar vazio
 *   dos dois lados — 24.7.4;
 * - **primeira mensagem** dos fixtures de erro, depois da normalização de
 *   caminho/ruído numérico — 24.7.8;
 * - **conteúdo dos artefatos** nos fixtures de paridade: CSV byte a byte
 *   (24.7.6) e HTML por DOM canônico (24.7.7).
 *
 * O que fica **fora** da comparação tem âncora e justificativa em
 * `./golden/known_divergences.md`; nada é ignorado em silêncio.
 *
 * Regenerar: `deno task golden:generate` (ou `golden:generate:ruby`).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.7)
 * @see scripts/golden/cli-tj3.rb
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { join, relative, } from "node:path";
import { canonicalDom, firstDifference, } from "./golden/canonical-dom.ts";

/** Raiz do repositório: os caminhos do golden são relativos a ela. */
const ROOT = new URL("../../../", import.meta.url,).pathname;
/** `src/cli.ts` do pacote. */
const CLI = new URL("../src/cli.ts", import.meta.url,).pathname;
/** Golden gerado pelo `scripts/golden/cli-tj3.rb`. */
const GOLDEN = new URL("./golden/cli-tj3.golden.json", import.meta.url,);

/** Um caso do golden. */
interface GoldenCase {
  /** `mwe001`, `Account`, `bad_include`, `parity-csv-tasks`… */
  id: string;
  /** Caminho do fixture relativo à raiz. */
  path: string;
  kind: "project" | "errors" | "parity";
  compare: "artifacts" | "exact" | "dom";
  exit: number;
  /** Caminhos relativos, ordenados, de tudo que foi gravado. */
  artifacts: string[];
  messages: string[];
  firstMessage: string | null;
  /** Resíduo de stdout depois de tirar banner/progresso/resumo. */
  stdout: string[];
  stderr: string[];
  /** Conteúdo dos artefatos, por caminho relativo (só em `exact`/`dom`). */
  outputs?: Record<string, string>;
}

/** Conteúdo do golden, carregado uma vez. */
const golden = JSON.parse(
  await Deno.readTextFile(GOLDEN,),
) as { cases: GoldenCase[] };

// --- normalização (espelho de `scripts/golden/cli-tj3.rb`) -----------------

/** Números com 6+ casas decimais são ruído de ponto flutuante. */
const FLOAT_NOISE = /-?\d+\.\d{6,}/g;
/** Caminhos de origem citados em mensagens (`docs/…`, `packages/…`). */
const REPO_PATH = /(?:docs|packages)\/[\w./-]+/g;
/** `file:line: Tipo: texto` ou `Tipo: texto`. */
const MESSAGE_LINE = /^(?:.*?:\d+: )?(?:Fatal|Error|Warning|Info|Debug): /;
/** Linhas do resumo do projeto que a CLI imprime e o `tj3` não (24.4.5). */
const CLI_NOISE = [
  /^Project .* v.*$/,
  /^ {2}(?:timezone|period|tasks|cost): /,
];

/** Normaliza caminho e ruído numérico de uma mensagem. */
function normalizeMessage(text: string,): string {
  return text.replaceAll(REPO_PATH, "<PATH>",).replaceAll(
    FLOAT_NOISE,
    "<NUM>",
  );
}

/** Linhas de stdout que não são UI (deveriam ser vazias). */
function residue(stdout: string,): string[] {
  return stdout.split("\n",).map((line,) => line.replaceAll("\r", "",))
    .filter((line,) => line.trim() !== "")
    .filter((line,) => !CLI_NOISE.some((noise,) => noise.test(line,)))
    .map((line,) => line.trimEnd());
}

/** Primeira linha de mensagem do `MessageHandler` no stderr. */
function firstMessageLine(stderr: string,): string | null {
  for (const line of stderr.split("\n",)) {
    if (MESSAGE_LINE.test(line,)) return line.trimEnd();
  }
  return null;
}

// --- execução -------------------------------------------------------------

/** Resultado de uma execução real da CLI. */
interface CliRun {
  code: number;
  out: string;
  err: string;
  /** Diretório de saída (temporário) da execução. */
  dir: string;
}

/**
 * Roda a CLI sobre o fixture com `--output-dir` num temporário.
 *
 * `cwd` é a raiz do repositório: os caminhos do golden são relativos a ela e
 * é o mesmo `chdir` que o oráculo Ruby usa, então as mensagens citam o
 * fixture da mesma forma.
 */
async function runCli(kase: GoldenCase,): Promise<CliRun> {
  const dir = await Deno.makeTempDir({ prefix: `golden-${kase.id}-`, },);
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      CLI,
      kase.path,
      "--output-dir",
      dir,
    ],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  },);
  const output = await command.output();
  const decoder = new TextDecoder();
  return {
    code: output.code,
    out: decoder.decode(output.stdout,),
    err: decoder.decode(output.stderr,),
    dir,
  };
}

/** Caminhos relativos, ordenados, de tudo que foi gravado sob `dir`. */
function inventory(dir: string,): string[] {
  const found: string[] = [];
  const walk = (current: string,): void => {
    for (const entry of Deno.readDirSync(current,)) {
      const full = join(current, entry.name,);
      if (entry.isDirectory) walk(full,);
      else if (entry.isFile) found.push(relative(dir, full,),);
    }
  };
  walk(dir,);
  return found.sort();
}

// --- casos ----------------------------------------------------------------

describe("golden CLI × tj3 (24.7.4)", () => {
  for (const kase of golden.cases) {
    it(`${kase.id} (${kase.kind}): exit, artefatos e stdout`, async () => {
      const run = await runCli(kase,);
      try {
        const detail = run.out + run.err;
        assertEquals(run.code, kase.exit, `exit: ${detail}`,);
        assertEquals(
          inventory(run.dir,),
          kase.artifacts,
          `artefatos: ${detail}`,
        );
        // Resíduo: qualquer linha que não seja UI e não seja mensagem.
        assertEquals(residue(run.out,), kase.stdout, "resíduo de stdout",);

        // 24.7.8 — localização da primeira mensagem nos fixtures de erro.
        if (kase.kind === "errors") {
          const first = firstMessageLine(run.err,);
          assertEquals(
            first === null ? null : normalizeMessage(first,),
            kase.firstMessage,
            `primeira mensagem: ${detail}`,
          );
        }

        // 24.7.6 — CSV byte a byte.
        if (kase.compare === "exact") {
          for (const [name, expected,] of Object.entries(kase.outputs ?? {},)) {
            assertEquals(
              Deno.readTextFileSync(join(run.dir, name,),),
              expected,
              `${name} byte a byte`,
            );
          }
        }

        // 24.7.7 — HTML por DOM canônico.
        if (kase.compare === "dom") {
          for (const [name, expected,] of Object.entries(kase.outputs ?? {},)) {
            assertEquals(
              firstDifference(
                canonicalDom(expected,),
                canonicalDom(Deno.readTextFileSync(join(run.dir, name,),),),
              ),
              "identical",
              `${name} por DOM canônico`,
            );
          }
        }
      } finally {
        Deno.removeSync(run.dir, { recursive: true, },);
      }
    });
  }
});
