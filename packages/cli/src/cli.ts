/**
 * `cli.ts` — ponto de entrada da CLI (ADR 034).
 *
 * Camada burra por contrato (plano §3): traduz `argv` em um
 * `ExecutionRequest`, lê o projeto e o fechamento de `include`s, chama
 * `core.execute` **uma vez** e despacha o envelope. Nenhuma regra de
 * linguagem, pipeline ou agendamento vive aqui.
 *
 * Fluxo único do plano §5.1 (adendo v2/v2.1):
 *
 *   argv → `parseArgs` → `io.readText` (master + fechamento de `include`s)
 *        → `request.files` → **uma** chamada `core.execute(request)`
 *        → mensagens → seções do envelope → `exit(result.exitCode)`
 *
 * Estado atual (24.3): a tradução de flags, o fechamento de `include`s e a
 * chamada única de `execute` estão entregues. A apresentação das mensagens é
 * provisória (24.4 — `reporter.ts`) e o despacho das seções mora em
 * `output-policy.ts` (24.5); `parsed.sheetFile`/`messageFile`/`sheetDir` são
 * as leituras pedidas pelo argv (24.9/24.10).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli.md §5.1/§5.2/§5.3
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.3/24.9/24.10)
 */

import {
  AppConfig,
  execute,
  type ExecutionInputFile,
  type ExecutionRequest,
  type ExecutionResult,
  normalizeInputPath,
  OPTION_SPECS,
  type OptionSpec,
  scanIncludeReferences,
  type SheetAppName,
} from "@vanaware/syntaxmesh";
import {
  args,
  Command,
  copy,
  exists,
  exit,
  isDir,
  isEntrypoint,
  isTty,
  listDir,
  mkpath,
  modulePath,
  print,
  printerr,
  readStdin,
  readText,
  writeText,
} from "./io.ts";
import {
  CliUsageError,
  notAvailableLabel,
  parseArgs,
  type ParsedArgs,
  type RendererOptions,
  resolveExit,
} from "./options.ts";
import { parse as parseYaml, } from "@std/yaml";
import { dispatchSections, type OutputPolicyIo, } from "./output-policy.ts";
import { Reporter, } from "./reporter.ts";
import { lastSummaryLines, } from "./summary.ts";

/** E/S da CLI — injetável nos testes (nenhum mock global). */
export interface CliIo {
  /** Lê um arquivo UTF-8 (`io.readText` no runtime real). */
  read: (path: string,) => Promise<string>;
  /** Escreve uma linha em `stdout`. */
  print: (text: string,) => void;
  /** Escreve uma linha em `stderr`. */
  printerr: (text: string,) => void;
  /** Lê o `stdin` inteiro (`--from -`; default: `io.readStdin`). */
  readStdin?: () => Promise<string>;
  /** Lista um diretório (default: `io.listDir`). */
  listDir?: (path: string,) => Promise<string[]>;
  /** `true` quando o caminho é diretório (default: `io.isDir`). */
  isDir?: (path: string,) => Promise<boolean>;
}

/** Implementação de E/S do processo (`io.ts`). */
export const defaultIo: CliIo = {
  read: readText,
  print,
  printerr,
};

// ---------------------------------------------------------------------------
// Comando Cliffy — ajuda humana de argv (plano §5.2 ponto 8)
// ---------------------------------------------------------------------------

/** `100` → `--report <id:string>` no formato de flags do Cliffy. */
function flagSpec(spec: OptionSpec,): string {
  const long = `--${spec.name}`;
  const flags = spec.short === null ? long : `-${spec.short}, ${long}`;
  if (spec.type === "boolean" || spec.argument === null) return flags;
  // Cliffy exige o tipo quando o argumento tem nome; `<id>` → `<id:string>`.
  return `${flags} ${spec.argument.replace(/^<([^>:]+)>$/, "<$1:string>",)}`;
}

/** Descrição da ajuda; flags adiadas citam a subfase dona (em inglês). */
function descriptionOf(spec: OptionSpec,): string {
  return spec.deferred === undefined
    ? spec.description
    : `${spec.description} (not yet available: ${notAvailableLabel(spec,)})`;
}

/**
 * Definição do comando para a ajuda humana.
 *
 * **Fonte única**: as opções saem de `OPTION_SPECS` (core), a mesma lista da
 * seção `help` do envelope — nunca duas tabelas divergentes (plano §5.2,
 * ponto 8). O parsing de argv é do `parseArgs` puro, não do Cliffy.
 *
 * Sem anotação de retorno própria: o tipo de retorno é o **próprio**
 * encadeamento do Cliffy (o genérico carrega as flags declaradas). Estreitá-lo
 * para `Command`, para `ReturnType<typeof …>` ou para um generic escrito à mão
 * não compila / vira outro diagnóstico de `deno doc --lint` — a dívida está
 * assumida no teto do `lint:doc` (ADR 041).
 */
export function buildCommand() {
  const command = new Command()
    .name(AppConfig.appName,)
    .version(AppConfig.version,)
    .description(
      "Project management, simplified. Runs a TaskJuggler-compatible " +
        "project file (.smx; .tjp accepted for compatibility). " +
        "Use 'syntaxmesh man [<keyword>...]' for the documentation " +
        "(--format text|html|smx; --output-dir for the html manual).",
    )
    .arguments("<file:string>",)
    .option("--silent", "Suppress informational output.",)
    .option("--no-color", "Disable colored output.",);

  for (const spec of OPTION_SPECS) {
    // `--help`/`--version` são do próprio Cliffy.
    if (spec.name === "help" || spec.name === "version") continue;
    command.option(flagSpec(spec,), descriptionOf(spec,),);
  }
  return command;
}

/** ANSI SGR — removido da ajuda quando `--no-color`. */
// `String.fromCharCode` em vez de escape no literal: o valor de controle não
// aparece na fonte (regra `no-control-regex`).
const ESCAPE = String.fromCharCode(0x1b,);
const ANSI_SGR = new RegExp(`${ESCAPE}\\[[0-9;]*m`, "g",);

/** Ajuda humana em texto puro (English-first — plano §1.7). */
export async function helpText(): Promise<string> {
  return (await buildCommand().getHelp()).replace(ANSI_SGR, "",);
}

// ---------------------------------------------------------------------------
// Fechamento de `include`s (plano §5.1)
// ---------------------------------------------------------------------------

/** Arquivos lidos para o request, com os que não puderam ser abertos. */
export interface InputClosure {
  /** Master + `include`s, com `path` canônico (`normalizeInputPath`). */
  files: ExecutionInputFile[];
  /**
   * Caminhos pedidos que a CLI não conseguiu ler. Um master ausente é fatal
   * (a CLI sai antes do `execute`); um `include` ausente vira `bad_include`
   * no core, fiel ao `tj3`.
   */
  missing: string[];
}

/** `File.dirname` posix, como o `SourceFileInfo.dirname()` do core. */
function dirnameOf(path: string,): string {
  const index = path.lastIndexOf("/",);
  if (index < 0) return ".";
  if (index === 0) return "/";
  return path.slice(0, index,);
}

/** Caminho do `include` relativo ao arquivo que o declara. */
function resolveIncludePath(from: string, reference: string,): string {
  if (reference.startsWith("/",)) return normalizeInputPath(reference,);
  return normalizeInputPath(`${dirnameOf(from,)}/${reference}`,);
}

/**
 * Lê o master e fecha transitivamente todos os `include`s.
 *
 * A ordem segue a descoberta (master primeiro, depois os includes em ordem de
 * aparição); caminhos repetidos entram uma única vez, o que também corta
 * ciclos antes do parser — a recursão continua sendo erro do core.
 */
export async function collectInputFiles(
  entry: string,
  read: (path: string,) => Promise<string> = readText,
): Promise<InputClosure> {
  const files: ExecutionInputFile[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  const pending: string[] = [normalizeInputPath(entry,),];

  while (pending.length > 0) {
    const path = pending.shift()!;
    if (seen.has(path,)) continue;
    seen.add(path,);

    let content: string;
    try {
      content = await read(path,);
    } catch {
      missing.push(path,);
      continue;
    }
    files.push({ path, content, },);

    for (const reference of scanIncludeReferences(content,)) {
      const resolved = resolveIncludePath(path, reference,);
      if (!seen.has(resolved,)) pending.push(resolved,);
    }
  }

  return { files, missing, };
}

// ---------------------------------------------------------------------------
// Leituras dos apps de sheet (24.10)
// ---------------------------------------------------------------------------

/**
 * Árvores do diretório de trabalho que os apps de sheet leem (Fase 18).
 *
 * Só elas são varridas: a raiz inteira pode ser o repositório, e o app nunca
 * abre nada fora dos templates e das folhas que ele mesmo escreve.
 */
const SHEET_TREES = [
  "TimeSheetTemplates",
  "TimeSheets",
  "StatusSheetTemplates",
  "StatusSheets",
];

/** Junta diretório e nome sem barra dupla (`.` e `""` são a raiz). */
function joinDisk(dir: string, name: string,): string {
  if (dir === "" || dir === ".") return name;
  return `${dir.replace(/\/+$/u, "",)}/${name}`;
}

/**
 * Lê uma árvore de folhas recursivamente como **dados** (24.10).
 *
 * O `path` do resultado é relativo à raiz (`TimeSheets/2026-05-18/dev.tji`),
 * a mesma chave do `MemoryFileStore` — o core nunca vê caminho de disco. O que
 * não puder ser lido fica fora do seed: o app reporta a folha ausente.
 */
async function collectTree(
  diskDir: string,
  relDir: string,
  files: ExecutionInputFile[],
  io: CliIo,
): Promise<void> {
  let names: string[];
  try {
    names = await (io.listDir ?? listDir)(diskDir,);
  } catch {
    return;
  }
  for (const name of names) {
    const disk = joinDisk(diskDir, name,);
    const rel = relDir === "" ? name : `${relDir}/${name}`;
    if (await (io.isDir ?? isDir)(disk,)) {
      await collectTree(disk, rel, files, io,);
      continue;
    }
    try {
      files.push({ path: rel, content: await io.read(disk,), },);
    } catch {
      // Arquivo ilegível (binário/permissão): fora do seed, sem inventar dado.
    }
  }
}

/** Fechamento de leitura dos apps de sheet a partir do diretório de trabalho. */
export async function collectSheetFiles(
  root: string,
  io: CliIo = defaultIo,
): Promise<ExecutionInputFile[]> {
  const files: ExecutionInputFile[] = [];
  for (const tree of SHEET_TREES) {
    await collectTree(joinDisk(root, tree,), tree, files, io,);
  }
  return files;
}

/** Desfecho das leituras pedidas pelo argv. */
interface ReadOutcome {
  /** `1` quando um arquivo pedido não pôde ser lido; `null` segue o fluxo. */
  exit: number | null;
  /** Raiz dos caminhos relativos do app de sheet (`-d`, default `""`). */
  sheetRoot: string;
}

/**
 * Materializa em `appOptions` o que o argv aponta como **arquivo** (24.10).
 *
 * `--check-time-sheet`/`--check-status-sheet` viram `sheetContent` (dado),
 * `--from` vira `rawMessage` (arquivo ou stdin) e o diretório de trabalho é
 * varrido para o seed do app. A CLI lê; o core só recebe valor.
 */
async function applyReads(
  parsed: ParsedArgs,
  request: ExecutionRequest,
  io: CliIo,
): Promise<ReadOutcome> {
  const appOptions = request.appOptions ?? {};
  const sheetRoot = parsed.sheetDir ?? "";

  if (parsed.sheetFile !== null) {
    try {
      appOptions.sheetContent = await io.read(parsed.sheetFile,);
    } catch {
      io.printerr(`Cannot open file '${parsed.sheetFile}'.`,);
      return { exit: 1, sheetRoot, };
    }
    appOptions.sheetFile = parsed.sheetFile;
  }

  if (parsed.messageFile !== null) {
    try {
      appOptions.rawMessage = parsed.messageFile === "-"
        ? await (io.readStdin ?? readStdin)()
        : await io.read(parsed.messageFile,);
    } catch {
      io.printerr(
        `Cannot read the email message from '${parsed.messageFile}'.`,
      );
      return { exit: 1, sheetRoot, };
    }
  }

  const app = request.app;
  if (app !== undefined && app !== "check-ts" && app !== "check-ss") {
    const files = await collectSheetFiles(sheetRoot, io,);
    if (files.length > 0) appOptions.files = files;
  }

  request.appOptions = Object.keys(appOptions,).length === 0
    ? undefined
    : appOptions;
  return { exit: null, sheetRoot, };
}

// ---------------------------------------------------------------------------
// Configuração (24.3.11)
// ---------------------------------------------------------------------------

/** `true` para os cinco apps de email da F18 (a config do `tj3` é deles). */
function isEmailSheetApp(app: SheetAppName | undefined,): boolean {
  return app !== undefined && app !== "check-ts" && app !== "check-ss";
}

/**
 * Lê o YAML de `--config` (24.3.11).
 *
 * Os apps de sheet precisam da configuração **já parseada** (`appOptions.config`,
 * o `RuntimeConfig` do Ruby — ADR 037), então para eles o YAML entra no
 * request como objeto. No restante do pipeline a **aplicação** continua
 * ancorada na 24.3.11: o texto viaja no request e um aviso explícito em
 * `stderr` impede o usuário de achar que a configuração valeu.
 */
async function applyConfig(
  configFile: string | null,
  request: ExecutionRequest,
  io: CliIo,
): Promise<number | null> {
  if (configFile === null) return null;
  let content: string;
  try {
    content = await io.read(configFile,);
  } catch {
    io.printerr(`Cannot open configuration file '${configFile}'.`,);
    return 1;
  }
  request.configContent = content;

  if (isEmailSheetApp(request.app,)) {
    let config: Record<string, unknown>;
    try {
      config = (parseYaml(content,) ?? {}) as Record<string, unknown>;
    } catch {
      io.printerr(`Cannot parse configuration file '${configFile}'.`,);
      return 1;
    }
    request.appOptions = { ...(request.appOptions ?? {}), config, };
    return null;
  }

  io.printerr(
    "Warning: the YAML configuration is read but not applied yet " +
      "(phase 24 — task 24.3.11).",
  );
  return null;
}

// ---------------------------------------------------------------------------
// Apresentação (24.4) e seções estruturadas
// ---------------------------------------------------------------------------

/**
 * Reporter do envelope com as opções de render efetivas.
 *
 * `--no-color` desliga o ANSI, assim como um `stdout` que não é terminal
 * (pipe/redirecionamento) — a saída nunca chega colorida num arquivo.
 */
function makeReporter(renderer: RendererOptions, io: CliIo,): Reporter {
  return new Reporter({
    silent: renderer.silent,
    color: renderer.color && isTty(),
    out: io.print,
    err: io.printerr,
  },);
}

/**
 * E/S real do despacho do envelope (24.5).
 *
 * A política recebe só a fronteira de `io.ts`: ela decide **onde** cada
 * conteúdo vai, nunca como o disco funciona.
 */
function outputIo(io: CliIo,): OutputPolicyIo {
  return {
    print: io.print,
    write: writeText,
    mkpath,
    copy,
    listDir,
    isDir,
    exists,
  };
}

/**
 * Raiz dos assets auxiliares do HTML (`css/`, `icons/`, `scripts/`).
 *
 * Relativa a este módulo: `packages/cli/src/cli.ts` → `<repo>/assets/`. A
 * pasta existe separada porque o layout **de origem** é também o layout de
 * **destino**: o HTML referencia `css/tjreport.css`, `icons/task.png` e
 * `scripts/wz_tooltip.js`, então copiar `assets/<nome>` para
 * `<saída>/<nome>` mantém as referências válidas sem reescrever o relatório.
 *
 * Quando a distribuição não trouxer os assets ao lado do binário, a cópia é
 * silenciosamente pulada (`dispatchReports` só copia o que existe).
 */
function assetRoot(): string {
  return modulePath(import.meta.url, "../../../assets/",);
}

// ---------------------------------------------------------------------------
// Fluxo único
// ---------------------------------------------------------------------------

/**
 * Executa a CLI com os argumentos dados e devolve o `exitCode`.
 *
 * Exportada (em vez de rodar só sob `import.meta.main`) para permitir teste
 * unitário e um único entrypoint nos runtimes Deno/Bun/Node. A E/S é
 * injetável para os testes não dependerem de processo/disco.
 */
export async function main(
  argv: readonly string[],
  io: CliIo = defaultIo,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs(argv,);
  } catch (error) {
    if (error instanceof CliUsageError) {
      io.printerr(error.message,);
      io.printerr("Try 'syntaxmesh --help' for more information.",);
      return 1;
    }
    throw error;
  }

  const { request, renderer, configFile, } = parsed;

  // `man`: a cor da saída textual é decisão do renderer (TTY + `--no-color`),
  // nunca do disco — o request carrega só o booleano.
  if (request.man !== undefined) {
    request.man.color = renderer.color && isTty();
  }

  /** Apresenta o envelope e traduz o exit (caminho único de saída). */
  const finish = async (
    result: ExecutionResult,
    sheetRoot: string,
  ): Promise<number> => {
    const reporter = makeReporter(renderer, io,);
    reporter.report(result.messages,);
    await dispatchSections(result, {
      io: outputIo(io,),
      assets: { root: assetRoot(), },
      sheetBaseDir: sheetRoot,
      onError: (text: string,) => reporter.error(text,),
    },);
    // Resumo do projeto (conveniência in-process — envelope é o contrato).
    reporter.summary(lastSummaryLines(),);
    return resolveExit(result,);
  };

  // Ajuda humana de argv fica com o Cliffy (plano §5.2, ponto 8).
  if (request.help === true) {
    io.print(await helpText(),);
    return 0;
  }

  // `--version` responde e sai **antes de qualquer leitura**
  // (`Tj3AppBase#on_tail`): não abre master, `--config` nem folhas — com
  // arquivos na linha de comando o nome deles nem precisa existir.
  if (request.version === true) {
    return await finish(await execute(request,), "",);
  }

  const configExit = await applyConfig(configFile, request, io,);
  if (configExit !== null) return configExit;

  // Leituras pedidas pelo argv (24.9/24.10): folha a checar, mensagem recebida
  // e o seed do diretório de trabalho dos apps de sheet.
  const reads = await applyReads(parsed, request, io,);
  if (reads.exit !== null) return reads.exit;

  if (request.entry !== undefined) {
    const closure = await collectInputFiles(request.entry, io.read,);
    if (closure.files.length === 0) {
      io.printerr(`Cannot open file '${request.entry}'.`,);
      return 1;
    }
    request.files = closure.files;
  }

  // **Uma** chamada: o core roda parse → schedule → relatórios.
  return await finish(await execute(request,), reads.sheetRoot,);
}

if (isEntrypoint(import.meta.url,)) {
  exit(await main(args,),);
}
