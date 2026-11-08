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
 * provisória (24.4 — `reporter.ts`) e o despacho de `reports`/`freeze`/
 * `sheet`/`man` pertence a 24.5/24.9/24.10.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli.md §5.1/§5.2/§5.3
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.3)
 */

import {
  AppConfig,
  execute,
  type ExecutionInputFile,
  type ExecutionRequest,
  normalizeInputPath,
  OPTION_SPECS,
  type OptionSpec,
  scanIncludeReferences,
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
  print,
  printerr,
  readText,
  writeText,
} from "./io.ts";
import {
  CliUsageError,
  notAvailableLabel,
  parseArgs,
  type RendererOptions,
  resolveExit,
} from "./options.ts";
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
 * Sem anotação de retorno: o tipo do Cliffy carrega o registro de opções no
 * genérico, e estreitá-lo à classe base `Command` quebra o encadeamento.
 */
export function buildCommand() {
  const command = new Command()
    .name(AppConfig.appName,)
    .version(AppConfig.version,)
    .description(
      "Project management, simplified. Runs a TaskJuggler-compatible " +
        "project file (.smx; .tjp accepted for compatibility).",
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
// Configuração (24.3.11)
// ---------------------------------------------------------------------------

/**
 * Lê o YAML de `--config` para `request.configContent`.
 *
 * Ancorado: Fase 24 — 24.3.11. A leitura entra agora; a **aplicação** do YAML
 * depende do porte completo de `Tj3Config` (hoje só o `initTj3Config` com
 * valores fixos), então o conteúdo viaja no request e no eco `options` mas
 * ainda não muda o comportamento. Aviso explícito em `stderr` para o usuário
 * nunca achar que a configuração valeu.
 */
async function applyConfig(
  configFile: string | null,
  request: ExecutionRequest,
  io: CliIo,
): Promise<number | null> {
  if (configFile === null) return null;
  try {
    request.configContent = await io.read(configFile,);
  } catch {
    io.printerr(`Cannot open configuration file '${configFile}'.`,);
    return 1;
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
 * Relativa a este módulo: `packages/cli/src/cli.ts` → raiz do repositório.
 * Quando a distribuição não trouxer os assets ao lado do binário, a cópia é
 * silenciosamente pulada (`dispatchReports` só copia o que existe).
 */
function assetRoot(): string {
  return new URL("../../../", import.meta.url,).pathname;
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

  // Ajuda humana de argv fica com o Cliffy (plano §5.2, ponto 8).
  if (request.help === true) {
    io.print(await helpText(),);
    return 0;
  }

  const configExit = await applyConfig(configFile, request, io,);
  if (configExit !== null) return configExit;

  if (request.entry !== undefined) {
    const closure = await collectInputFiles(request.entry, io.read,);
    if (closure.files.length === 0) {
      io.printerr(`Cannot open file '${request.entry}'.`,);
      return 1;
    }
    request.files = closure.files;
  }

  // **Uma** chamada: o core roda parse → schedule → relatórios.
  const result = await execute(request,);
  const reporter = makeReporter(renderer, io,);
  reporter.report(result.messages,);
  await dispatchSections(result, {
    io: outputIo(io,),
    assets: { root: assetRoot(), },
    onError: (text: string,) => reporter.error(text,),
  },);
  // Resumo do projeto (conveniência in-process — envelope é o contrato).
  reporter.summary(lastSummaryLines(),);
  return resolveExit(result,);
}

if (isEntrypoint(import.meta.url,)) {
  exit(await main(args,),);
}
