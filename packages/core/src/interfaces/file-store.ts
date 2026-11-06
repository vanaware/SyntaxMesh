/**
 * `FileStore` — contrato de sistema de arquivos assíncrono do core (ADR 037).
 *
 * O core é independente de DOM/Storage (ADR 001/003): não conhece OPFS,
 * IndexedDB, `Deno.*` nem `node:fs`. Quem precisa ler/escrever arquivos — os
 * sheet handlers (Fase 18), o storage da PWA (Fase 19) e a CLI (Fase 24) —
 * recebe uma implementação desta interface por injeção.
 *
 * A interface é **estrutural**: qualquer objeto com a forma abaixo a satisfaz
 * (sem `implements`). Todos os métodos são assíncronos porque OPFS não oferece
 * escrita síncrona.
 *
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 */
export interface FileStore {
  /** Conteúdo UTF-8 do arquivo; rejeita se ele não existir. */
  read(path: string,): Promise<string>;
  /** Grava (cria ou sobrescreve) o arquivo com conteúdo UTF-8. */
  write(path: string, content: string,): Promise<void>;
  /** Remove o arquivo; rejeita se ele não existir. */
  delete(path: string,): Promise<void>;
  /**
   * Nomes das **entradas** de um diretório (arquivos **e** subdiretórios),
   * sem recursão — como `readdir`.
   *
   * A forma dos nomes é do provedor (basename ou caminho completo); os
   * consumidores do core só comparam sufixos e basenames. Devolver também os
   * subdiretórios é o que permite ao `StatusSheetSender` descobrir as pastas
   * de período `TimeSheets/<data>` (18.10).
   */
  list(dir: string,): Promise<string[]>;
  /** `true` se o caminho existir (arquivo ou diretório). */
  exists(path: string,): Promise<boolean>;
  /** Cria o diretório (idempotente). */
  mkdir(path: string,): Promise<void>;
}
