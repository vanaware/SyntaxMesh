// src/worker/opfs.worker.ts
/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

const ROOT_DIR_NAME = "loco_media_files";

/**
 * Função interna para garantir a existência do diretório raiz e do chat.
 */
async function getChatDirectory(chatHash: string): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  const mediaRoot = await root.getDirectoryHandle(ROOT_DIR_NAME, { create: true });
  // Cria uma sub-pasta exclusiva para o Chat/Contato
  const chatDir = await mediaRoot.getDirectoryHandle(chatHash, { create: true });
  return chatDir;
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { action, id, payload } = event.data;

  try {
    if (action === 'OPFS_SALVAR') {
      const { chatHash, fileName, blob } = payload;
      
      const chatDir = await getChatDirectory(chatHash);
      const fileHandle = await chatDir.getFileHandle(fileName, { create: true });
      
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      self.postMessage({ id, status: 'SUCCESS', fileName });
    }
    
    else if (action === 'OPFS_LER') {
      const { chatHash, fileName } = payload;
      
      const chatDir = await getChatDirectory(chatHash);
      const fileHandle = await chatDir.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      
      self.postMessage({ id, status: 'SUCCESS', file });
    }
    
    else if (action === 'OPFS_EXCLUIR_ARQUIVO') {
      const { chatHash, fileName } = payload;
      
      const chatDir = await getChatDirectory(chatHash);
      await chatDir.removeEntry(fileName);
      
      self.postMessage({ id, status: 'SUCCESS' });
    }
    
    else if (action === 'OPFS_EXCLUIR_CHAT_INTEIRO') {
      const { chatHash } = payload;
      
      const root = await navigator.storage.getDirectory();
      const mediaRoot = await root.getDirectoryHandle(ROOT_DIR_NAME, { create: true });
      
      // Deleta a pasta do chat com tudo dentro (recursive)
      await mediaRoot.removeEntry(chatHash, { recursive: true });
      
      self.postMessage({ id, status: 'SUCCESS' });
    }

    else {
      throw new Error(`Ação desconhecida do Worker OPFS: ${action}`);
    }
    
  } catch (error: any) {
    self.postMessage({ id, status: 'ERROR', error: error.message });
  }
});