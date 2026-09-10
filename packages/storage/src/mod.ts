/// <reference lib="deno.ns" />

// ============================================================================
// 📦 @syntaxmesh/storage - Camada de Persistência
// ============================================================================
// Este módulo gerencia a persistência local usando IndexedDB, OPFS e arquivos.
// O Storage não deve contaminar o Core - Core permanece sempre em memória.
//
// ARQUITETURA: Storage não pode contaminar Core. Fluxo de dados:
// Browser ↔ Storage ↔ Core Model ↔ Scheduler
// Core nunca importa idb-keyval, OPFS, localStorage etc.
//
// O restante do código não deve depender diretamente desta biblioteca,
// usando em vez disso o wrapper @syntaxmesh/worker-db para isolamento.
export * from './indexeddb/mod.ts';
export * from './opfs/mod.ts';
export * from './projects/mod.ts';

// ============================================================================
// Configurações de persistência
// ============================================================================

/**
 * Interface genérica para armazenamento chave-valor
 */
export interface KeyValueStore {
  get<T,>(key: string,): Promise<T | undefined>;
  set<T,>(key: string, value: T,): Promise<void>;
  del(key: string,): Promise<void>;
  keys(): Promise<string[]>;
}

/**
 * Configuração de armazenamento
 */
export interface StorageConfig {
  databaseName: string;
  storePrefix: string;
  useOPFS: boolean;
  backupEnabled: boolean;
}

/**
 * Projeto armazenado com metadados
 */
export interface StoredProject {
  id: string;
  name: string;
  data: unknown; // Core model serialized
  lastModified: Date;
  version: string;
}
