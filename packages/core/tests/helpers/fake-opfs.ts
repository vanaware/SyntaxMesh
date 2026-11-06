/**
 * `fakeOpfs()` — `FileStore` em memória para os testes do core.
 *
 * O plano original da Fase 18 previa `fakeOpfs()` exportado por
 * `@syntaxmesh/worker-db`, mas esse pacote só existe a partir da Fase 19. Até
 * lá, este fake (com o mesmo contrato do ADR 037) serve aos testes e prova a
 * conformidade **estrutural** da interface: o core aceita qualquer objeto com
 * a forma de `FileStore`, sem dependência nominal.
 *
 * Semântica (espelha o que o Ruby espera do disco):
 * - `write` exige que o diretório-pai exista (como `File.open`), senão rejeita.
 * - `mkdir` é idempotente e cria os ancestrais.
 * - `list` devolve os **basenames** das entradas do diretório (arquivos e
 *   subdiretórios), como `readdir`.
 * - `delete` rejeita se o arquivo não existir (como `File.delete`).
 *
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 */
// O fake é síncrono por dentro; o `async` existe só para casar a assinatura
// assíncrona do `FileStore` real (ADR 037) sem devolver promessas à mão.
// deno-lint-ignore-file require-await
import type { FileStore, } from "../../src/interfaces/file-store.ts";

/** Normaliza um caminho relativo (sem `./`, sem barra final, sem `//`). */
export function normalizePath(path: string,): string {
  const trimmed = path.replace(/^\.\//u, "",).replace(/\/+$/u, "",);
  return trimmed.replace(/\/{2,}/gu, "/",);
}

/** Diretório-pai de um caminho ("" no nível raiz). */
function dirName(path: string,): string {
  const idx = path.lastIndexOf("/",);
  return idx < 0 ? "" : path.slice(0, idx,);
}

/**
 * Store em memória compatível com `FileStore`.
 *
 * @param seed arquivos/diretórios iniciais (`{ "a/b.txt": "conteúdo" }`).
 *   Chaves terminadas em `/` são criadas como diretórios vazios.
 */
export function fakeOpfs(
  seed: Record<string, string> = {},
): FileStore & { files: Map<string, string>; dirs: Set<string> } {
  const files = new Map<string, string>();
  const dirs = new Set<string>(["",],);

  const store = {
    files,
    dirs,
    async read(path: string,): Promise<string> {
      const key = normalizePath(path,);
      const content = files.get(key,);
      if (content === undefined) {
        throw new Error(`ENOENT: ${path}`,);
      }
      return content;
    },
    async write(path: string, content: string,): Promise<void> {
      const key = normalizePath(path,);
      const parent = dirName(key,);
      if (!dirs.has(parent,)) {
        throw new Error(`ENOENT: directory ${parent} does not exist`,);
      }
      files.set(key, content,);
    },
    async delete(path: string,): Promise<void> {
      const key = normalizePath(path,);
      if (!files.delete(key,)) {
        throw new Error(`ENOENT: ${path}`,);
      }
    },
    async list(dir: string,): Promise<string[]> {
      const key = normalizePath(dir,);
      if (!dirs.has(key,)) {
        throw new Error(`ENOENT: directory ${dir} does not exist`,);
      }
      const prefix = key === "" ? "" : `${key}/`;
      const names = new Set<string>();
      for (const file of files.keys()) {
        if (!file.startsWith(prefix,)) continue;
        const rest = file.slice(prefix.length,);
        if (rest.includes("/",)) continue;
        names.add(rest,);
      }
      // Subdiretórios imediatos também são entradas (`readdir`).
      for (const entry of dirs) {
        if (entry === key || !entry.startsWith(prefix,)) continue;
        const rest = entry.slice(prefix.length,);
        if (rest === "" || rest.includes("/",)) continue;
        names.add(rest,);
      }
      return [...names,].sort();
    },
    async exists(path: string,): Promise<boolean> {
      const key = normalizePath(path,);
      return files.has(key,) || dirs.has(key,);
    },
    async mkdir(path: string,): Promise<void> {
      const key = normalizePath(path,);
      if (key === "") return;
      let current = "";
      for (const part of key.split("/",)) {
        current = current === "" ? part : `${current}/${part}`;
        dirs.add(current,);
      }
    },
  };
  for (const [path, content,] of Object.entries(seed,)) {
    if (path.endsWith("/",)) {
      // Diretório vazio inicial.
      const parts = normalizePath(path,).split("/",);
      let current = "";
      for (const part of parts) {
        current = current === "" ? part : `${current}/${part}`;
        dirs.add(current,);
      }
    } else {
      // Arquivo inicial: cria os ancestrais automaticamente (seed é setup).
      const key = normalizePath(path,);
      const parts = dirName(key,) === "" ? [] : dirName(key,).split("/",);
      let current = "";
      for (const part of parts) {
        current = current === "" ? part : `${current}/${part}`;
        dirs.add(current,);
      }
      files.set(key, content,);
    }
  }
  return store;
}
