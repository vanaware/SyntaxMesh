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
  SheetSection,
} from "@vanaware/syntaxmesh";
import { imageRefs, } from "./images.ts";

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
  /**
   * Raiz dos caminhos relativos da seção `sheet` (o `-d/--directory` do app,
   * `""` = diretório corrente). Os nomes do envelope são relativos a ela.
   */
  sheetBaseDir?: string;
  /**
   * Raiz onde os caminhos relativos de imagem são **lidos** (default `""` = o
   * diretório de trabalho do processo, de onde o master foi lido). A imagem é
   * copiada para ao lado da saída preservando a referência; o texto do
   * relatório nunca é reescrito (24.10.8).
   */
  imageDir?: string;
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
 * Copia para ao lado do relatório as imagens relativas que ele cita (24.10.8).
 *
 * O `src` do HTML/Markdown já é o caminho relativo correto em relação ao
 * arquivo de saída; o que falta é o arquivo existir ali. Referências externas
 * (`http(s)://`, `data:`), caminhos absolutos e caminhos com segmento `..` ficam
 * de fora — nenhuma leitura fora da raiz de imagens (adendo §4.3). Origem igual
 * ao destino é ignorada.
 */
async function copyReportImages(
  io: OutputPolicyIo,
  options: OutputPolicyOptions,
  format: { format: string; content: string },
  reportPath: string,
  created: Set<string>,
  written: string[],
): Promise<void> {
  if (format.format !== "html" && format.format !== "markdown") return;
  const root = options.imageDir ?? "";
  const destDir = dirOf(reportPath,);
  for (const ref of imageRefs(format.content, format.format,)) {
    const from = joinPath(root, ref,);
    const to = joinPath(destDir, ref,);
    if (from === to) continue;
    if (!(await io.exists(from,))) continue;
    const dir = dirOf(to,);
    if (dir !== "" && !created.has(dir,)) {
      await io.mkpath(dir,);
      created.add(dir,);
    }
    await io.copy(from, to,);
    written.push(to,);
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
      await copyReportImages(
        io,
        options,
        format,
        path,
        created,
        outcome.assets,
      );
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
    // O conteúdo do `man` termina em `\n`; `print` já fecha a linha.
    io.print(trimTrailingNewline(sections.man.content,),);
    printed++;
  }
  return printed;
}

/** Grava um caminho criando o diretório-pai uma única vez por despacho. */
async function writeWithDir(
  io: OutputPolicyIo,
  created: Set<string>,
  path: string,
  contents: string,
): Promise<void> {
  const dir = dirOf(path,);
  if (dir !== "" && !created.has(dir,)) {
    await io.mkpath(dir,);
    created.add(dir,);
  }
  await io.write(path, contents,);
}

/**
 * Despacha a seção `freeze` (24.9.4/24.9.5).
 *
 * O core devolve os dois artefatos (`-header.tji` e `-bookings.tji`) com o
 * nome derivado do master; gravar é desta política, como no `tj3`. O Ruby
 * trunca os dois arquivos (`File.open(…, 'w')`), então um `-bookings.tji`
 * vazio **é** gravado — pular o artefato vazio deixaria em disco o conteúdo de
 * um freeze anterior.
 */
async function dispatchFreeze(
  result: ExecutionResult,
  io: OutputPolicyIo,
  outcome: OutputPolicyOutcome,
  created: Set<string>,
): Promise<void> {
  const freeze = result.results.freeze;
  if (freeze === undefined) return;
  for (const file of freeze.files) {
    await writeWithDir(io, created, file.fileName, file.contents,);
    outcome.written.push(file.fileName,);
  }
}

/**
 * Despacha a seção `man` no formato `html` (24.9.1–24.9.3).
 *
 * O core devolve o manual inteiro como mapa `nome → conteúdo` (capítulos,
 * uma página por keyword, `toc.html`, `alphabet.html`, `navbar.html`,
 * `index.html` e a folha de estilos). Gravar é desta política: tudo vai para
 * o `--output-dir` (default: diretório corrente, como o `-d` do `tj3man`).
 *
 * No formato `text`/`smx` não há arquivo nenhum — `content` já foi impresso por
 * {@link printSection}.
 */
async function dispatchMan(
  result: ExecutionResult,
  io: OutputPolicyIo,
  outcome: OutputPolicyOutcome,
  created: Set<string>,
): Promise<void> {
  const man = result.results.man;
  if (man === undefined || man.files.length === 0) return;
  const base = result.options.outputDir ?? "";
  for (const file of man.files) {
    const path = joinPath(base, file.name,);
    await writeWithDir(io, created, path, file.contents,);
    outcome.written.push(path,);
  }
}

/** Nome do `outbox/*.eml` de uma mensagem (`001-dev@example.com.eml`). */
function emlName(index: number, to: string,): string {
  const seq = String(index + 1,).padStart(3, "0",);
  return `outbox/${seq}-${sanitizeFileName(to,)}.eml`;
}

/**
 * Despacha a seção `sheet` (24.10.1–24.10.4).
 *
 * Sem SMTP (ADR 036), a entrega vira dado: o texto de diagnóstico/resumo vai
 * para o terminal, cada mensagem vira `outbox/*.eml` e os arquivos que o app
 * criou (templates, folhas) são gravados sob o diretório de trabalho. Anexos
 * já estão entre esses arquivos — são **dados recebidos**, não um segundo
 * destino.
 */
async function dispatchSheet(
  section: SheetSection,
  options: OutputPolicyOptions,
  outcome: OutputPolicyOutcome,
  created: Set<string>,
): Promise<void> {
  const { io, } = options;
  const text = section.reportText ?? section.summaryText ?? section.emailText;
  if (text !== undefined && text !== "") {
    io.print(trimTrailingNewline(text,),);
    outcome.printed++;
  }

  const base = options.sheetBaseDir ?? "";
  const write = async (name: string, contents: string,): Promise<void> => {
    const path = joinPath(base, name,);
    await writeWithDir(io, created, path, contents,);
    outcome.written.push(path,);
  };

  for (const file of section.files ?? []) {
    await write(file.name, file.contents,);
  }
  const emails = section.emails ?? [];
  for (const [index, email,] of emails.entries()) {
    await write(emlName(index, email.to,), email.text,);
  }
}

/**
 * Despacha **todas** as seções do envelope na ordem do adendo §4.1.
 *
 * `freeze` grava os dois artefatos que o core devolveu (24.9); `sheet` é a
 * saída dos apps da F18 (24.10) e só é produzida quando a execução deu certo
 * (adendo §4.4: nada de saída parcial em nome de uma execução que falhou).
 * Os relatórios seguem a mesma regra dentro de `dispatchReports`.
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

  // Diretórios já criados neste despacho (freeze, man e sheet compartilham).
  const created = new Set<string>();
  await dispatchFreeze(result, io, outcome, created,);
  await dispatchMan(result, io, outcome, created,);

  const sheet = result.results.sheet;
  if (sheet !== undefined) {
    if (result.ok) {
      await dispatchSheet(sheet, options, outcome, created,);
    } else {
      // Diagnóstico já foi do reporter; um app que falhou não entrega email.
      outcome.aborted = true;
    }
  }

  const reports = result.results.reports;
  if (reports !== undefined) {
    const dispatched = await dispatchReports(reports, options,);
    outcome.printed += dispatched.printed;
    outcome.written.push(...dispatched.written,);
    outcome.assets.push(...dispatched.assets,);
    // Monotônico: um aborto anterior (sheet com falha) não é "desabortado"
    // por um despacho de relatórios que correu bem.
    outcome.aborted = outcome.aborted || dispatched.aborted;
  }

  return outcome;
}
