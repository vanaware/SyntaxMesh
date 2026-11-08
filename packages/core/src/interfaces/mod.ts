/**
 * Barrel do diretório `interfaces/` — contratos de I/O injetáveis do core.
 *
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 */
export type { FileStore, } from "./file-store.ts";
export type { KeyValueStore, } from "./key-value-store.ts";
export {
  MemoryFileStore,
  type MemoryStoreFile,
  type MemoryStoreSeed,
  normalizeStorePath,
} from "./memory-file-store.ts";
