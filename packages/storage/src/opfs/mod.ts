/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Storage OPFS — Wrapper para Origin Private File System
// ============================================================================

/**
 * Operações básicas de arquivo no OPFS
 */
export interface OpfsFileHandle {
  name: string;
  size: number;
  lastModified: Date;
}

/**
 * Interface para operações de arquivo no OPFS
 */
export interface OpfsStore {
  readFile(path: string): Promise<Blob>;
  writeFile(path: string, data: Blob): Promise<void>;
  deleteFile(path: string): Promise<void>;
  listFiles(directory?: string): Promise<OpfsFileHandle[]>;
}

/**
 * Cria uma instância de armazenamento em OPFS
 */
export async function createStore(): Promise<OpfsStore | null> {
  // TODO: Implementar integração real com Web FS API
  // Por enquanto, retorna null indicando que OPFS não está disponível
  return null;
}

/**
 * Verifica se o OPFS está disponível no ambiente atual
 */
export function isOpfsAvailable(): boolean {
  // @ts-ignore - FileSystemHandle pode não estar definido em todos os ambientes
  return typeof window !== "undefined" &&
    "showDirectoryPicker" in window ||
    "credentials" in navigator;
}