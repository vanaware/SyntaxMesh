// src/utils/opfs-utils.ts
import { addDebugLog } from "@loco/utils/debug";
import { APP_VERSION } from "@loco/utils/config";

let opfsWorker: Worker | null = null;
let messageIdCounter = 0;

// Mapa para resolver as promises quando o worker responder
const pendingRequests = new Map<number, { resolve: Function, reject: Function }>();

function getOpfsWorker(): Worker {
  if (!opfsWorker) {
    // 🔥 ARQUITETURA [Cache-Busting]: Garante a versão do Build
    opfsWorker = new Worker(`/opfs.worker.js?v=${APP_VERSION}`);
    
    opfsWorker.onmessage = (event: MessageEvent) => {
      const { id, status, error, file, fileName } = event.data;
      
      const request = pendingRequests.get(id);
      if (request) {
        pendingRequests.delete(id);
        if (status === 'SUCCESS') {
          // Resolve a promise com o arquivo ou true/fileName dependendo da ação
          request.resolve(file || fileName || true);
        } else {
          request.reject(new Error(error));
        }
      }
    };

    opfsWorker.onerror = (err) => {
      addDebugLog("error", "OPFS_WORKER", "Erro fatal na thread do OPFS", err.message);
    };
  }
  return opfsWorker;
}

/**
 * Envia uma mensagem para o Worker e retorna uma Promise que resolve com a resposta.
 */
function execOpfsWorkerAction(action: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = ++messageIdCounter;
    pendingRequests.set(id, { resolve, reject });
    
    const worker = getOpfsWorker();
    worker.postMessage({ action, id, payload });
  });
}

/**
 * Salva um Blob no Origin Private File System (OPFS) via Background Worker.
 */
export async function salvarNoOPFS(chatHash: string, fileName: string, blob: Blob): Promise<boolean> {
  try {
    await execOpfsWorkerAction('OPFS_SALVAR', { chatHash, fileName, blob });
    addDebugLog("success", "OPFS", `Arquivo ${fileName} salvo no OPFS (Chat: ${chatHash.substring(0,6)}...).`);
    return true;
  } catch (error: any) {
    addDebugLog("error", "OPFS", `Erro do Worker ao salvar ${fileName}: ${error.message}`);
    return false;
  }
}

/**
 * Lê um arquivo do OPFS via Background Worker.
 */
export async function lerDoOPFS(chatHash: string, fileName: string): Promise<File | null> {
  try {
    const file = await execOpfsWorkerAction('OPFS_LER', { chatHash, fileName });
    return file as File;
  } catch (error: any) {
    // É comum tentar ler algo que não existe, apenas avisa silenciosamente
    addDebugLog("warn", "OPFS", `Arquivo ${fileName} não encontrado no OPFS.`);
    return null;
  }
}

/**
 * Exclui um único arquivo do OPFS via Background Worker.
 */
export async function excluirDoOPFS(chatHash: string, fileName: string): Promise<boolean> {
  try {
    await execOpfsWorkerAction('OPFS_EXCLUIR_ARQUIVO', { chatHash, fileName });
    addDebugLog("info", "OPFS", `Arquivo ${fileName} removido do OPFS.`);
    return true;
  } catch (error: any) {
    addDebugLog("error", "OPFS", `Worker falhou ao excluir ${fileName}: ${error.message}`);
    return false;
  }
}

/**
 * Exclui toda a pasta de mídias de um Contato Específico do OPFS.
 */
export async function excluirTodoChatDoOPFS(chatHash: string): Promise<boolean> {
  try {
    await execOpfsWorkerAction('OPFS_EXCLUIR_CHAT_INTEIRO', { chatHash });
    addDebugLog("info", "OPFS", `Pasta de mídia do Chat ${chatHash.substring(0,6)}... expurgada.`);
    return true;
  } catch (error: any) {
    addDebugLog("error", "OPFS", `Worker falhou ao expurgar pasta do Chat: ${error.message}`);
    return false;
  }
}