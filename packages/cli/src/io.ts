/**
 * `io.ts` — fronteira única de runtime da CLI (ADR 034 §3).
 *
 * Regras desta camada:
 *  - **Todo** acesso a filesystem, processo, `argv` e terminal passa por aqui.
 *  - **Zero** ramificação de runtime para arquivos: `node:fs/promises` é
 *    suportado nativamente por Deno, Node e Bun.
 *  - A única ramificação restante é `args`/`exit` (uma linha cada), mantida
 *    para permitir injeção nos testes.
 *  - Sem `any`: o acesso ao global usa a interface tipada {@link RuntimeGlobals}
 *    (mesma convenção do lexer do core).
 *
 * @see docs/syntaxmesh/decisoes/034-cli-multiruntime.md
 */

import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir, } from "node:os";
import { join, resolve, } from "node:path";
import { pathToFileURL, } from "node:url";

// Reexport de Cliffy na mesma fronteira: os demais módulos do pacote nunca
// importam de `@cliffy/*` diretamente (24.1.8).
export { Command, } from "@cliffy/command";

/** Nome do runtime em execução. */
export type RuntimeName = "deno" | "bun" | "node";

/**
 * Shape mínimo dos globais de runtime lidos pela CLI. Tipado para evitar
 * `any` em `src/` — estende-se aqui quando um novo global for necessário.
 */
export interface RuntimeGlobals {
  Deno?: {
    args: string[];
    mainModule?: string;
    exit: (code?: number,) => never;
    stdout?: { isTerminal?: () => boolean };
  };
  Bun?: Record<string, unknown>;
  process?: {
    argv: string[];
    exit: (code?: number,) => never;
    stdout?: { isTTY?: boolean };
  };
}

/** Detecta o runtime a partir dos globais. */
export function detectRuntime(g: RuntimeGlobals,): RuntimeName {
  if (g.Deno) return "deno";
  if (g.Bun) return "bun";
  return "node";
}

/**
 * Normaliza `argv` para o runtime corrente.
 *
 * É a **única** ramificação de entrada do pacote: mantida por testabilidade
 * (os testes passam um objeto de globais fake em vez de um processo real).
 */
export function resolveArgs(g: RuntimeGlobals,): string[] {
  if (g.Deno) return [...g.Deno.args,];
  const argv = g.process?.argv ?? [];
  return argv.slice(2,);
}

/**
 * Responde se o módulo de `metaUrl` é o ponto de entrada do processo.
 *
 * `import.meta.main` só existe no Deno/Bun; em Node e nos bundles o teste é
 * feito comparando o `argv[1]` com a URL do módulo. Uma única função para os
 * três runtimes evita um segundo entrypoint (ADR 034 §2).
 */
export function isEntrypoint(
  metaUrl: string,
  g: RuntimeGlobals = globals,
): boolean {
  if (g.Deno) return g.Deno.mainModule === metaUrl;
  const entry = g.process?.argv[1];
  if (!entry) return false;
  return pathToFileURL(resolve(entry,),).href === metaUrl;
}

/** Globais do processo corrente, sem `any`. */
export const globals: RuntimeGlobals = globalThis as unknown as RuntimeGlobals;

/**
 * `stdout` é um terminal?
 *
 * Em pipe/redirecionamento o reporter **não** emite ANSI (24.4.2). Deno e Node
 * expõem a mesma informação por nomes diferentes; a sonda é a última
 * ramificação de runtime além de `args`/`exit`.
 */
export function isTty(g: RuntimeGlobals = globals,): boolean {
  if (g.Deno) return g.Deno.stdout?.isTerminal?.() ?? false;
  return g.process?.stdout?.isTTY === true;
}

/** Runtime em execução (diagnóstico/log). */
export const runtime: RuntimeName = detectRuntime(globals,);

/** Argumentos da linha de comando, normalizados. */
export const args: string[] = resolveArgs(globals,);

// ---------------------------------------------------------------------------
// Arquivos e diretórios — sempre `node:fs/promises`, sem ramificação.
// ---------------------------------------------------------------------------

/** Lê um arquivo como UTF-8. */
export const readText = (path: string,): Promise<string> =>
  readFile(path, "utf8",);

/** Escreve um arquivo UTF-8 (sobrescreve). */
export const writeText = (path: string, data: string,): Promise<void> =>
  writeFile(path, data, "utf8",);

/**
 * Lê um arquivo binário (imagens de relatório, anexos).
 *
 * Normaliza para `Uint8Array`: o `readFile` do Node/Deno devolve `Buffer`,
 * subtipo que não compara por igualdade profunda com `Uint8Array` — a
 * superfície da CLI fica estável nos três runtimes.
 */
export async function readBytes(path: string,): Promise<Uint8Array> {
  return new Uint8Array(await readFile(path,),);
}

/** Copia um arquivo, preservando os bytes. */
export const copy = (from: string, to: string,): Promise<void> =>
  copyFile(from, to,);

/**
 * `exists` — true quando o caminho existe (arquivo ou diretório).
 *
 * Implementado com `stat` e **não** com `access`: no shim `node:fs` do Deno,
 * `access()` resolve o `uid` do processo e passa a exigir `--allow-sys`, o que
 * quebraria a CLI sob as permissões mínimas de `deno task cli`.
 */
export async function exists(path: string,): Promise<boolean> {
  try {
    await stat(path,);
    return true;
  } catch {
    return false;
  }
}

/** `mkdir -p`. */
export async function mkpath(path: string,): Promise<void> {
  await mkdir(path, { recursive: true, },);
}

/** Diretório temporário único com prefixo. */
export const mktemp = (prefix: string,): Promise<string> =>
  mkdtemp(join(tmpdir(), prefix,),);

/** Lista um diretório (nomes simples). */
export const listDir = (path: string,): Promise<string[]> => readdir(path,);

/**
 * `true` quando o caminho existe e é diretório.
 *
 * `readdir` num arquivo lança `ENOTDIR` (e, no shim do Deno, chega a exigir
 * `--allow-sys`), então a distinção arquivo/diretório precisa de um `stat`
 * explícito na fronteira — nunca de tratamento de exceção no consumidor.
 */
export async function isDir(path: string,): Promise<boolean> {
  try {
    return (await stat(path,)).isDirectory();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Terminal — `console` existe nativamente nos três runtimes.
// ---------------------------------------------------------------------------

/** Escreve uma linha em `stdout`. */
export function print(text: string,): void {
  console.log(text,);
}

/** Escreve uma linha em `stderr`. */
export function printerr(text: string,): void {
  console.error(text,);
}

// ---------------------------------------------------------------------------
// Processo
// ---------------------------------------------------------------------------

/**
 * Encerra o processo com o código dado.
 *
 * A CLI chama isto com o `exitCode` do envelope de `execute` — o core nunca
 * encerra processo (ADR 034 §7). O parâmetro de globais é injetável apenas
 * para teste (um `exit` real mata o runner).
 */
export function exit(code = 0, g: RuntimeGlobals = globals,): never {
  if (g.Deno) g.Deno.exit(code,);
  g.process?.exit(code,);
  throw new Error("unreachable",);
}
