/**
 * Resolução de referências de imagem em Markdown (Adendo 13.14, #5 RDO).
 *
 * `![alt](ref)` distingue **URL externa** (`http(s)://`, `//`, `data:` — passa
 * intacta) de **caminho relativo**. Caminhos relativos resolvem **OPFS primeiro**
 * via um `ImageStore` injetado (Fase 19 `image-store`); na ausência dele (ou
 * quando a imagem não existe no store), faz fallback para os `dataDirs` do
 * projeto. O core é independente de DOM (ADR 001): este módulo devolve um
 * **descritor** de resolução; a conversão em `Blob`/`objectURL` offline é
 * responsabilidade da camada de render (UI / Fase 19).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown-tarefas.md (13.14)
 * @see docs/syntaxmesh/fases/fase-19-storage.md (image-store)
 */

/**
 * Contrato mínimo do armazém de imagens (implementado na Fase 19 via OPFS).
 * Mantido propositalmente pequeno para o core não depender de storage.
 */
export interface ImageStore {
  /** `true` se a imagem existe no armazém sob `path` relativo. */
  has(path: string,): Promise<boolean>;
  /**
   * Devolve um `src` utilizável offline (data URI ou objectURL) para `path`,
   * ou `null` se indisponível. A UI é livre para ignorar e usar `dataDirs`.
   */
  resolve(path: string,): Promise<string | null>;
}

/** Origem determinada para uma referência de imagem. */
export type ImageOrigin = "external" | "opfs" | "dataDir" | "unresolved";

/** Resultado da resolução de uma referência de imagem. */
export interface ResolvedImage {
  /** Referências originais (para diagnóstico). */
  readonly ref: string;
  /** Texto alternativo (`![alt](...)`), preservado. */
  readonly alt: string | null;
  /** Onde a imagem foi resolvida. */
  readonly origin: ImageOrigin;
  /** `src` pronto para uso (URL externa, objectURL/data URI do store ou caminho). */
  readonly src: string;
}

/** Regex de referência externa: esquema http(s), data:, ou relativa de protocolo. */
const EXTERNAL_RE = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?\/\//;
const DATA_RE = /^data:/i;

/**
 * `true` se `ref` é uma URL externa (esquema explícito, protocol-relative `//`
 * ou `data:`). Tais referências passam intactas, sem resolução OPFS/dataDirs.
 */
export function isExternalImageRef(ref: string,): boolean {
  return EXTERNAL_RE.test(ref,) || DATA_RE.test(ref,);
}

/** Opções de resolução de caminho relativo. */
export interface ResolveOptions {
  /** Armazém OPFS injetado (Fase 19). Opcional. */
  store?: ImageStore | null;
  /** Diretórios de dados do projeto (fallback). Caminhos relativos a eles. */
  dataDirs?: readonly string[];
  /** Texto alternativo da imagem (`alt`). */
  alt?: string | null;
}

/**
 * Resolve uma referência de imagem (`![alt](ref)`).
 *
 * - Externa → `origin: "external"`, `src === ref` (intacta).
 * - Relativa com `store` e imagem presente → `origin: "opfs"`, `src` do store.
 * - Relativa ausente no store (ou sem store) com `dataDirs` → tenta o primeiro
 *   diretório; `origin: "dataDir"`.
 * - Sem store e sem `dataDirs` → `origin: "unresolved"`, `src === ref` cru.
 */
export async function resolveImageRef(
  ref: string,
  options: ResolveOptions = {},
): Promise<ResolvedImage> {
  const alt = options.alt ?? null;

  if (isExternalImageRef(ref,)) {
    return { ref, alt, origin: "external", src: ref, };
  }

  // OPFS primeiro quando há store injetado.
  const store = options.store;
  if (store) {
    if (await store.has(ref,)) {
      const resolved = await store.resolve(ref,);
      if (resolved !== null) {
        return { ref, alt, origin: "opfs", src: resolved, };
      }
    }
  }

  // Fallback: dataDirs do projeto.
  const dirs = options.dataDirs ?? [];
  if (dirs.length > 0) {
    return { ref, alt, origin: "dataDir", src: joinDir(dirs[0]!, ref,), };
  }

  return { ref, alt, origin: "unresolved", src: ref, };
}

/** Junta diretório e caminho sem duplicar separadores. */
function joinDir(dir: string, path: string,): string {
  const cleanDir = dir.endsWith("/",) ? dir.slice(0, -1,) : dir;
  const cleanPath = path.startsWith("/",) ? path.slice(1,) : path;
  return `${cleanDir}/${cleanPath}`;
}
