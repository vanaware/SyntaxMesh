/**
 * `MemoryFileStore` — implementação de `FileStore` em memória (ADR 037).
 *
 * Existe para o **caminho de dados** da Fase 24 (grupo 5, 24.2.32): os apps de
 * sheet e as checagens de folha continuam a usar a interface `FileStore`
 * (rebaixada, não revogada), mas o `execute` injeta esta implementação semeada
 * com `request.files` — nada toca disco nem terminal, e o resultado sai como
 * **dado** (`snapshot()`).
 *
 * A semântica espelha o que os handlers esperam de um disco (a mesma do
 * `fakeOpfs()` dos testes da Fase 18), com uma diferença deliberada: `write`
 * **cria os diretórios-pai ausentes**, porque aqui não existe permissão de SO a
 * validar e o único efeito de rejeitar seria ruído no caminho de dados.
 * - `mkdir` é idempotente e cria os ancestrais;
 * - `list` devolve os **basenames** das entradas (arquivos e subdiretórios);
 * - `delete` rejeita quando o arquivo não existe.
 *
 * Não é o armazenamento da PWA: a Fase 19 (ADR 030) traz o provedor
 * persistente (`@vanaware/workerdb`). Este store é efêmero por definição.
 *
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.5
 */
import type { FileStore, } from "./file-store.ts";

/** Arquivo de entrada do store (mesma forma de `request.files`). */
export interface MemoryStoreFile {
  path: string;
  content: string;
}

/**
 * Semente do store: mapa `caminho → conteúdo`. Chaves terminadas em `/` criam
 * o diretório vazio (a pasta de folhas de um período, por exemplo).
 */
export type MemoryStoreSeed = Record<string, string>;

/** Normaliza um caminho relativo (sem `./`, sem barra final, sem `//`). */
export function normalizeStorePath(path: string,): string {
  const trimmed = path.replace(/^\.\//u, "",).replace(/\/+$/u, "",);
  return trimmed.replace(/\/{2,}/gu, "/",);
}

/** Diretório-pai de um caminho (`""` no nível raiz). */
function parentOf(path: string,): string {
  const idx = path.lastIndexOf("/",);
  return idx < 0 ? "" : path.slice(0, idx,);
}

/** Primeiro segmento de um caminho relativo — a entrada direta do diretório. */
function firstSegment(path: string,): string {
  const idx = path.indexOf("/",);
  return idx < 0 ? path : path.slice(0, idx,);
}

/**
 * Store em memória compatível com `FileStore`.
 *
 * Uso típico no caminho de dados:
 *
 * ```ts
 * const store = new MemoryFileStore({ "templates/x.tji": template, });
 * await app.run({ project, fileStore: store, rawEmail, },);
 * const files = store.toFiles(); // dado, não disco
 * ```
 */
export class MemoryFileStore implements FileStore {
  /** Conteúdo por caminho normalizado. */
  private readonly files = new Map<string, string>();
  /** Diretórios existentes (inclui a raiz `""`). */
  private readonly dirs = new Set<string>(["",],);

  constructor(seed: MemoryStoreSeed | MemoryStoreFile[] = {},) {
    const entries: [string, string,][] = Array.isArray(seed,)
      ? seed.map((file,) => [file.path, file.content,] as [string, string,])
      : Object.entries(seed,);
    for (const [path, content,] of entries) {
      if (path.endsWith("/",)) {
        this.mkdirSync(path,);
      } else {
        this.writeSync(path, content,);
      }
    }
  }

  /** Conteúdo UTF-8 do arquivo; rejeita se ele não existir. */
  // Síncrono por dentro: o `async` casa a assinatura de `FileStore` (ADR 037).
  // deno-lint-ignore require-await
  async read(path: string,): Promise<string> {
    const key = normalizeStorePath(path,);
    const content = this.files.get(key,);
    if (content === undefined) {
      throw new Error(`ENOENT: ${path}`,);
    }
    return content;
  }

  /** Grava (cria ou sobrescreve) o arquivo, criando os ancestrais. */
  // deno-lint-ignore require-await
  async write(path: string, content: string,): Promise<void> {
    this.writeSync(path, content,);
  }

  /** Remove o arquivo; rejeita se ele não existir. */
  // deno-lint-ignore require-await
  async delete(path: string,): Promise<void> {
    const key = normalizeStorePath(path,);
    if (!this.files.delete(key,)) {
      throw new Error(`ENOENT: ${path}`,);
    }
  }

  /** Basenames das entradas do diretório (arquivos e subdiretórios). */
  // deno-lint-ignore require-await
  async list(dir: string,): Promise<string[]> {
    const key = normalizeStorePath(dir,);
    if (!this.dirs.has(key,)) {
      throw new Error(`ENOENT: directory ${dir} does not exist`,);
    }
    const prefix = key === "" ? "" : `${key}/`;
    const names = new Set<string>();
    for (const path of this.files.keys()) {
      if (!path.startsWith(prefix,)) continue;
      names.add(firstSegment(path.slice(prefix.length,),),);
    }
    for (const path of this.dirs) {
      if (path === "" || path === key || !path.startsWith(prefix,)) continue;
      names.add(firstSegment(path.slice(prefix.length,),),);
    }
    return [...names,].sort();
  }

  /** `true` se o caminho existir (arquivo ou diretório). */
  // deno-lint-ignore require-await
  async exists(path: string,): Promise<boolean> {
    const key = normalizeStorePath(path,);
    return this.files.has(key,) || this.dirs.has(key,);
  }

  /** Cria o diretório (idempotente, com os ancestrais). */
  // deno-lint-ignore require-await
  async mkdir(path: string,): Promise<void> {
    this.mkdirSync(path,);
  }

  /** Cópia dos arquivos como lista ordenada — a saída **dado** do store. */
  toFiles(): MemoryStoreFile[] {
    return [...this.files.entries(),]
      .sort(([a,], [b,],) => a < b ? -1 : a > b ? 1 : 0)
      .map(([path, content,],) => ({ path, content, }));
  }

  /** Snapshot `caminho → conteúdo` (dado puro, sem instâncias). */
  snapshot(): MemoryStoreSeed {
    return Object.fromEntries(this.files,);
  }

  /** Grava criando os diretórios-pai (usado pela semente). */
  private writeSync(path: string, content: string,): void {
    const key = normalizeStorePath(path,);
    const parent = parentOf(key,);
    if (!this.dirs.has(parent,)) this.mkdirSync(parent,);
    this.files.set(key, content,);
  }

  /** Cria o diretório e todos os ancestrais. */
  private mkdirSync(path: string,): void {
    const key = normalizeStorePath(path,);
    if (key === "") return;
    const parts = key.split("/",);
    for (let i = 1; i <= parts.length; i++) {
      this.dirs.add(parts.slice(0, i,).join("/",),);
    }
  }
}
