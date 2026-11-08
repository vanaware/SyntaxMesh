/**
 * `output-policy.ts` — despacho das seções do envelope (Fase 24 — 24.5).
 *
 * Única dona da decisão de **destino** (adendo §4): um relatório com
 * `stdout: true` é impresso no terminal com delimitador
 * `--- <name> [<format>] ---`; sem `stdout` vira arquivo `{name}.{ext}` no
 * `outputDir` ecoado. As demais seções (`check`, `listReports`, `version`,
 * `help`, `freeze`, `man`, `sheet`) também são despachadas aqui para que a
 * política viva num só lugar (plano §11 ponto 9).
 *
 * O core nunca decide destino, não sanitiza nome e não toca em disco (adendo
 * §3.5): tudo o que este módulo consome é dado do envelope. A E/S entra por
 * injeção (`OutputPolicyIo`), então não há disco, `Deno` nem `process` aqui.
 *
 * Política de erro (adendo §4.4): `reports[].errors` não-vazio — ou `ok: false`
 * — **aborta** o despacho inteiro. Nada é impresso nem gravado parcialmente; o
 * `exitCode` do envelope já carrega o 1 e o consumidor só reporta.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §4
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.5)
 */
import type {
  ExecutionResult,
  ReportJsonEntry,
  ReportsJson,
} from "@vanaware/syntaxmesh";

/** E/S da política — subconjunto injetável de `io.ts`. */
export interface OutputPolicyIo {
  /** Escreve uma linha em `stdout`. */
  print: (text: string,) => void;
  /** Grava conteúdo UTF-8 (sobrescreve). */
  write: (path: string, content: string,) => Promise<void>;
  /** Cria diretório recursivamente. */
  mkpath: (dir: string,) => Promise<void>;
  /** Copia um arquivo (assets do HTML). */
  copy: (from: string, to: string,) => Promise<void>;
  /** Lista nomes de um diretório (vazio quando é arquivo). */
  listDir: (path: string,) => Promise<string[]>;
  /** `true` quando o caminho é diretório (arquivo/ausente ⇒ `false`). */
  isDir: (path: string,) => Promise<boolean>;
  /** Existência de arquivo ou diretório. */
  exists: (path: string,) => Promise<boolean>;
}

/** Assets auxiliares que o HTML não-selfcontained referencia. */
export interface AssetOptions {
  /** Raiz onde vivem os subdiretórios/arquivos declarados. */
  root: string;
  /** Subdiretórios a copiar (default: `css/` e `icons/`). */
  dirs?: string[];
  /** Arquivos isolados a copiar (default: `scripts/wz_tooltip.js`). */
  files?: string[];
}

/** Opções do despacho. */
export interface OutputPolicyOptions {
  /** E/S injetada. */
  io: OutputPolicyIo;
  /** Assets do HTML; ausente desliga a cópia (24.5.16). */
  assets?: AssetOptions | null;
  /** Reporta um erro de relatório (reporter da CLI). */
  onError?: ((text: string,) => void) | null;
}

/** Resultado do despacho. */
export interface OutputPolicyOutcome {
  /** Relatórios impressos no terminal. */
  printed: number;
  /** Caminhos gravados, na ordem de produção. */
  written: string[];
  /** Assets copiados (destino). */
  assets: string[];
  /** `true` quando a política abortou por erro (nada foi produzido). */
  aborted: boolean;
}

/**
 * Sufixo por formato — espelha a tabela do plano §5.5 ponto 1.
 *
 * Só entram os formatos cujo sufixo difere do id; os demais usam o próprio id.
 * `ctags` não tem sufixo (o core grava o nome puro).
 */
const FORMAT_EXTENSIONS: Record<string, string> = {
  csv: "csv",
  html: "html",
  json: "json",
  markdown: "md",
  iCal: "ics",
  mspxml: "xml",
  niku: "xml",
  tjp: "tjp",
  ctags: "",
};

/** Subdiretórios de assets referenciados pelo HTML (24.5.16). */
const DEFAULT_ASSET_DIRS = ["css", "icons",];
/** Arquivos isolados referenciados pelo HTML (24.5.16). */
const DEFAULT_ASSET_FILES = ["scripts/wz_tooltip.js",];

/** Caracteres inválidos em nome de arquivo (adendo §4.3). */
const INVALID_NAME_CHARS = /[\\?%*:|"<>]/g;

/** Extensão de arquivo de um formato. */
export function extensionOf(format: string,): string {
  return Object.hasOwn(FORMAT_EXTENSIONS, format,)
    ? FORMAT_EXTENSIONS[format]!
    : format;
}

/**
 * Sanitiza o nome do relatório para uso como arquivo.
 *
 * Descarta componentes de caminho (defesa simples contra `../`), substitui os
 * caracteres inválidos por `_` e apara as pontas. Nome vazio cai em `report`.
 */
export function sanitizeFileName(name: string,): string {
  const segments = name.split("/",).filter((part,) =>
    part !== "" && part !== "." && part !== ".."
  );
  const last = segments.length === 0 ? "" : segments[segments.length - 1]!;
  const trimmed = last.replace(INVALID_NAME_CHARS, "_",).trim();
  return trimmed === "" ? "report" : trimmed;
}

/** `{name}.{ext}` — nome puro quando o formato não tem sufixo. */
export function fileNameFor(name: string, format: string,): string {
  const base = sanitizeFileName(name,);
  const ext = extensionOf(format,);
  return ext === "" ? base : `${base}.${ext}`;
}

/** Delimitador de impressão (`--- <name> [<format>] ---`). */
export function delimiterFor(name: string, format: string,): string {
  return `--- ${name} [${format}] ---`;
}

/** Diretório de um caminho já normalizado com `/` (ou `""` na raiz). */
function dirOf(path: string,): string {
  const index = path.lastIndexOf("/",);
  if (index < 0) return "";
  return index === 0 ? "/" : path.slice(0, index,);
}

/** Junta diretório e nome sem barra dupla (só `/`, como o envelope). */
function joinPath(dir: string, name: string,): string {
  if (dir === "" || dir === ".") return name;
  if (dir === "/") return `/${name}`;
  return `${dir.replace(/\/+$/, "",)}/${name}`;
}

/** Conteúdo sem a quebra de linha final dupla na impressão. */
function trimTrailingNewline(content: string,): string {
  return content.endsWith("\n",) ? content.slice(0, -1,) : content;
}

/** `stdout` explícito ou nome `.` (convenção do `tj3`: imprime no terminal). */
function goesToStdout(entry: ReportJsonEntry,): boolean {
  return entry.stdout || entry.name === ".";
}

/** Erros da seção, já com o nome do relatório no prefixo. */
function reportErrors(section: ReportsJson,): string[] {
  const errors: string[] = [];
  for (const entry of section.reports) {
    for (const text of entry.errors) errors.push(`${entry.name}: ${text}`,);
  }
  return errors;
}

/** Copia recursivamente um diretório de assets para o destino. */
async function copyTree(
  io: OutputPolicyIo,
  from: string,
  to: string,
  created: Set<string>,
  written: string[],
): Promise<void> {
  if (!(await io.exists(from,))) return;
  if (!(await io.isDir(from,))) {
    // Folha: arquivo. O diretório de destino é criado uma vez só.
    const dir = dirOf(to,);
    if (dir !== "" && !created.has(dir,)) {
      await io.mkpath(dir,);
      created.add(dir,);
    }
    await io.copy(from, to,);
    written.push(to,);
    return;
  }
  for (const name of await io.listDir(from,)) {
    await copyTree(
      io,
      joinPath(from, name,),
      joinPath(to, name,),
      created,
      written,
    );
  }
}

/**
 * Despacha a seção `reports` (adendo §4.2/§4.3).
 *
 * Com qualquer erro de relatório a função **aborta antes de produzir** — sem
 * saída parcial (adendo §4.4) — e devolve `aborted: true`.
 */
export async function dispatchReports(
  section: ReportsJson,
  options: OutputPolicyOptions,
): Promise<OutputPolicyOutcome> {
  const { io, } = options;
  const outcome: OutputPolicyOutcome = {
    printed: 0,
    written: [],
    assets: [],
    aborted: false,
  };

  const errors = reportErrors(section,);
  if (errors.length > 0 || !section.ok) {
    const messages = errors.length > 0
      ? errors
      : ["Reports failed; no output was produced.",];
    for (const text of messages) options.onError?.(text,);
    outcome.aborted = true;
    return outcome;
  }

  const baseDir = section.outputDir ?? "";
  const created = new Set<string>();
  let wantsAssets = false;

  for (const entry of section.reports) {
    if (goesToStdout(entry,)) {
      for (const format of entry.formats) {
        io.print(delimiterFor(entry.name, format.format,),);
        io.print(trimTrailingNewline(format.content,),);
      }
      outcome.printed++;
      continue;
    }
    for (const format of entry.formats) {
      const path = joinPath(baseDir, fileNameFor(entry.name, format.format,),);
      const dir = dirOf(path,);
      if (dir !== "" && !created.has(dir,)) {
        await io.mkpath(dir,);
        created.add(dir,);
      }
      await io.write(path, format.content,);
      outcome.written.push(path,);
      if (format.format === "html" && !entry.selfcontained) wantsAssets = true;
    }
  }

  const assets = options.assets;
  if (wantsAssets && assets !== undefined && assets !== null) {
    for (const name of assets.dirs ?? DEFAULT_ASSET_DIRS) {
      const from = joinPath(assets.root, name,);
      const to = joinPath(baseDir, name,);
      await copyTree(io, from, to, created, outcome.assets,);
    }
    // Arquivos isolados (o `scripts/` do repo guarda ferramentas de build,
    // não só o `wz_tooltip.js` que o HTML carrega).
    for (const name of assets.files ?? DEFAULT_ASSET_FILES) {
      const from = joinPath(assets.root, name,);
      if (!(await io.exists(from,))) continue;
      const to = joinPath(baseDir, name,);
      const dir = dirOf(to,);
      if (dir !== "" && !created.has(dir,)) {
        await io.mkpath(dir,);
        created.add(dir,);
      }
      await io.copy(from, to,);
      outcome.assets.push(to,);
    }
  }

  return outcome;
}

/** Imprime a representação estruturada de uma seção simples. */
function printSection(
  io: OutputPolicyIo,
  result: ExecutionResult,
): number {
  let printed = 0;
  const sections = result.results;
  if (sections.version !== undefined) {
    io.print(`${sections.version.name} ${sections.version.version}`,);
    printed++;
  }
  if (sections.check !== undefined) {
    io.print(
      sections.check.valid ? "Syntax check passed." : "Syntax check failed.",
    );
    printed++;
  }
  for (const report of sections.listReports ?? []) {
    io.print(`${report.name} (${report.type})`,);
    printed++;
  }
  if (sections.man !== undefined && sections.man.content !== "") {
    io.print(sections.man.content,);
    printed++;
  }
  return printed;
}

/**
 * Despacha **todas** as seções do envelope na ordem do adendo §4.1.
 *
 * `freeze` só grava quando o core já devolveu conteúdo (o desancoramento é da
 * 24.9); `sheet` é produzida pelos apps da 24.10. A forma é estável para que
 * essas subfases só preencham o conteúdo, sem mexer na política.
 */
export async function dispatchSections(
  result: ExecutionResult,
  options: OutputPolicyOptions,
): Promise<OutputPolicyOutcome> {
  const { io, } = options;
  const outcome: OutputPolicyOutcome = {
    printed: 0,
    written: [],
    assets: [],
    aborted: false,
  };

  outcome.printed += printSection(io, result,);

  const freeze = result.results.freeze;
  if (freeze !== undefined && freeze.contents !== "") {
    const dir = dirOf(freeze.fileName,);
    if (dir !== "") await io.mkpath(dir,);
    await io.write(freeze.fileName, freeze.contents,);
    outcome.written.push(freeze.fileName,);
  }

  const reports = result.results.reports;
  if (reports !== undefined) {
    const dispatched = await dispatchReports(reports, options,);
    outcome.printed += dispatched.printed;
    outcome.written.push(...dispatched.written,);
    outcome.assets.push(...dispatched.assets,);
    outcome.aborted = dispatched.aborted;
  }

  return outcome;
}
