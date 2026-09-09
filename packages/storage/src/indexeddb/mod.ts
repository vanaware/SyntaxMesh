/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Storage IndexedDB — Wrapper para IndexedDB via @syntaxmesh/worker-db
// ============================================================================

/**
 * Operações básicas de IndexedDB abstraídas
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * Factory que cria uma instância de armazenamento em IndexedDB
 * Usa @syntaxmesh/worker-db internamente para isolar o acesso
 */
export async function createStore(
  dbName: string,
  storeName: string,
): Promise<KeyValueStore> {
  // TODO: Implementar integração real com @syntaxmesh/worker-db
  // Por enquanto, retorna um stub que lança erro se chamado
  const notImplemented = (): never => {
    throw new Error("IndexedDB não implementado — requer ambiente browser");
  };

  return {
    get: () => Promise.resolve(undefined),
    set: () => Promise.resolve(),
    del: () => Promise.resolve(),
    keys: () => Promise.resolve([]),
  };
}