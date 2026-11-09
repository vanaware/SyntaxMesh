/**
 * lint-doc — gate de documentação da API pública (`deno doc --lint`), em ratchet.
 *
 * O `deno task lint:doc:all` original chamava `deno task --members lint:doc` e
 * nenhum membro definia a task, então o composite `deno task tests` parava aqui
 * sem medir nada. Rodar `deno doc --lint` cru também não fecha: o barril do
 * core expõe ~1.700 símbolos herdados do port e o `missing-jsdoc` acusa cada um
 * deles — documentação de *usuário* neste projeto é o manual do `doc-core`
 * (F22), não o JSDoc de símbolo interno.
 *
 * O gate mede o que é de fato corrigível e impede regressão:
 *
 * - **contagem por diagnóstico e por pacote** (teto em `lint-doc-baseline.json`);
 *   adicionar símbolo público sem JSDoc (ou com tipo privado na assinatura)
 *   estoura o teto e falha;
 * - **piso zero** para pacotes sem dívida — `server`, `ui`, `service-worker` e
 *   as entradas pequenas não podem ganhar diagnóstico novo;
 * - **entrada quebrada** (módulo exportado que não existe, erro de sintaxe)
 *   falha sempre: o `deno doc` sai sem diagnóstico e o erro cru é propagado.
 *
 * Uso (a partir do diretório do membro, que define as entradas do seu mapa
 * `exports`):
 *
 * ```sh
 * deno task lint:doc          # verifica o teto
 * deno task lint:doc:update   # refaz o teto com a contagem atual
 * ```
 *
 * @see docs/syntaxmesh/decisoes/041-gate-lint-doc.md
 */
const BASELINE_URL = new URL("./lint-doc-baseline.json", import.meta.url,);

/** Diagnóstico emitido pelo `deno doc --lint` (uma linha `error[...]` + `-->`). */
interface Diagnostic {
  code: string;
  file: string;
  line: number;
}

/** Contagem por código de diagnóstico; a chave é o nome do código. */
type Counts = Record<string, number>;

/** Teto por pacote: `{ core: { "missing-jsdoc": 1548 } }`. */
type Baseline = Record<string, Counts>;

const HEADER = /^error\[([a-z-]+)\]:/;
const LOCATION = /^\s+-->\s+(.+):(\d+):\d+$/;
/** `deno doc` colore a saída mesmo com stderr em pipe; a cor não é medição. */
// deno-lint-ignore no-control-regex -- ESC é o próprio marcador de cor
const ANSI = /\u001b\[[0-9;]*m/g;

interface Options {
  update: boolean;
  packageName: string | null;
  entries: string[];
}

/** Lê os argumentos: `[--update] [--package <nome>] <entrada>…`. */
function parseOptions(args: string[],): Options {
  const options: Options = { update: false, packageName: null, entries: [], };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--update") {
      options.update = true;
    } else if (arg === "--package") {
      options.packageName = args[++i] ?? null;
    } else {
      options.entries.push(arg,);
    }
  }
  return options;
}

/**
 * Nome do pacote medido.
 *
 * A task roda com `cwd` no diretório do membro, então o próprio `cwd` já
 * identifica o pacote; `--package` existe para rodar de outro lugar.
 */
function packageNameOf(cwd: string, override: string | null,): string {
  if (override !== null) return override;
  return cwd.split(/[\\/]/,).filter((part,) => part !== "").at(-1,) ?? "root";
}

/** Executa `deno doc --lint` e devolve a saída combinada. */
async function runDocLint(
  cwd: string,
  entries: string[],
): Promise<{ code: number; output: string }> {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["doc", "--lint", ...entries,],
    cwd,
    // `NO_COLOR` mantém a saída legível no log; o parser tolera a cor de
    // qualquer forma (ver `ANSI`).
    env: { NO_COLOR: "1", },
    stdout: "piped",
    stderr: "piped",
  },);
  const result = await command.output();
  const decoder = new TextDecoder();
  const output = decoder.decode(result.stdout,) +
    decoder.decode(result.stderr,);
  return { code: result.code, output, };
}

/** Extrai os diagnósticos da saída do `deno doc --lint`. */
function parseDiagnostics(output: string,): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  let code: string | null = null;
  for (const raw of output.split("\n",)) {
    const line = raw.replace(ANSI, "",);
    const header = HEADER.exec(line,);
    if (header !== null) {
      code = header[1]!;
      continue;
    }
    if (code === null) continue;
    const location = LOCATION.exec(line,);
    if (location === null) continue;
    diagnostics.push({
      code,
      file: location[1]!,
      line: Number.parseInt(location[2]!, 10,),
    },);
    code = null;
  }
  return diagnostics;
}

/** Agrupa os diagnósticos por código. */
function countByCode(diagnostics: Diagnostic[],): Counts {
  const counts: Counts = {};
  for (const diagnostic of diagnostics) {
    counts[diagnostic.code] = (counts[diagnostic.code] ?? 0) + 1;
  }
  return counts;
}

/** Ordena as chaves para a saída ficar estável entre execuções. */
function sortedKeys(counts: Counts,): string[] {
  return Object.keys(counts,).sort();
}

/** Carrega o teto; arquivo ausente significa "todo mundo em zero". */
async function readBaseline(): Promise<Baseline> {
  try {
    const text = await Deno.readTextFile(BASELINE_URL,);
    return JSON.parse(text,) as Baseline;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return {};
    throw error;
  }
}

/** Grava o teto ordenado (pacote → código), com newline final. */
async function writeBaseline(baseline: Baseline,): Promise<void> {
  const ordered: Baseline = {};
  for (const name of Object.keys(baseline,).sort()) {
    const counts = baseline[name]!;
    const entry: Counts = {};
    for (const code of sortedKeys(counts,)) entry[code] = counts[code]!;
    ordered[name] = entry;
  }
  await Deno.writeTextFile(
    BASELINE_URL,
    `${JSON.stringify(ordered, null, 2,)}\n`,
  );
}

/** Uma linha de contagem: `missing-jsdoc 1548/1548`. */
function countLine(code: string, actual: number, ceiling: number,): string {
  const state = actual > ceiling
    ? "ACIMA"
    : actual < ceiling
    ? "abaixo"
    : "no teto";
  return `  ${code.padEnd(22,)}${String(actual,).padStart(5,)}/${
    String(ceiling,)
      .padEnd(5,)
  }${state}`;
}

const options = parseOptions(Deno.args,);
if (options.entries.length === 0) {
  console.error("lint:doc — informe ao menos uma entrada (ex.: src/mod.ts).",);
  Deno.exit(2,);
}

const cwd = Deno.cwd();
const name = packageNameOf(cwd, options.packageName,);
const { code, output, } = await runDocLint(cwd, options.entries,);
const diagnostics = parseDiagnostics(output,);
const counts = countByCode(diagnostics,);

if (code !== 0 && diagnostics.length === 0) {
  // Sem diagnóstico reconhecido: entrada inexistente, erro de tipo, import
  // quebrado. Não é dívida de documentação — é o gate dizendo que não mediu.
  console.error(`lint:doc — 'deno doc --lint' não mediu '${name}':`,);
  const lines = output.replace(ANSI, "",).trim().split("\n",);
  console.error(lines.slice(-40,).join("\n",),);
  Deno.exit(1,);
}

const baseline = await readBaseline();

if (options.update) {
  baseline[name] = counts;
  await writeBaseline(baseline,);
  console.log(
    `lint:doc — teto de '${name}' atualizado (${diagnostics.length}).`,
  );
  Deno.exit(0,);
}

const ceiling = baseline[name] ?? {};
const codes = [...new Set([...sortedKeys(counts,), ...sortedKeys(ceiling,),],),]
  .sort();
const regressions = codes.filter((entry,) =>
  (counts[entry] ?? 0) > (ceiling[entry] ?? 0)
);
const stale = codes.filter((entry,) =>
  (counts[entry] ?? 0) < (ceiling[entry] ?? 0)
);

console.log(`lint:doc — ${name} (${options.entries.join(" ",)})`,);
for (const entry of codes) {
  console.log(countLine(entry, counts[entry] ?? 0, ceiling[entry] ?? 0,),);
}

if (regressions.length > 0) {
  console.error(`\nlint:doc FALHOU — ${name} passou do teto:`,);
  for (const entry of regressions) {
    console.error(
      `  ${entry}: ${counts[entry] ?? 0} > ${ceiling[entry] ?? 0}`,
    );
    // Só o local é acionável: os arquivos com mais diagnósticos deste código.
    const byFile = new Map<string, number>();
    for (const diagnostic of diagnostics) {
      if (diagnostic.code !== entry) continue;
      byFile.set(diagnostic.file, (byFile.get(diagnostic.file,) ?? 0) + 1,);
    }
    const worst = [...byFile,].sort((a, b,) => b[1] - a[1]).slice(0, 5,);
    for (const [file, total,] of worst) {
      console.error(`    ${file.replace(`${cwd}/`, "",)} (${total})`,);
    }
  }
  console.error(
    "\nDocumente o símbolo novo (ou torne o tipo público) e, se a dívida for" +
      "\naceita de propósito, reescreva o teto com `deno task lint:doc:update`.",
  );
  Deno.exit(1,);
}

if (stale.length > 0) {
  const detail = stale
    .map((entry,) => `${entry} ${ceiling[entry]}→${counts[entry] ?? 0}`)
    .join(", ",);
  console.log(
    `lint:doc — dívida caiu (${detail}); aperte o teto com` +
      " `deno task lint:doc:update`.",
  );
}
