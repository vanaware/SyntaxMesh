// src/worker/p2p-transfer.worker.ts
/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { salvarNoOPFS } from "./opfs-utils.ts";

// 1. Carrega o motor nativo (Vendor Asset) de forma síncrona.
importScripts('/webtorrent.min.js');

const WebTorrentEngine = (self as any).WebTorrent;
let client: any = null;

const urlParams = new URLSearchParams(self.location.search);
const WORKER_VERSION = urlParams.get('v') || 'desconhecida';

self.postMessage({ 
  type: 'P2P_LOG', 
  payload: `[WORKER-BOOT] ⚙️ Web Worker Dedicado inicializado (Versão: ${WORKER_VERSION})` 
});

function getClient(): any {
  if (!client) {
    if (!WebTorrentEngine) {
      self.postMessage({ type: 'P2P_ERROR', payload: "Motor WebTorrent não foi carregado via importScripts." });
      return null;
    }
    
    client = new WebTorrentEngine();
    client.on('error', (err: any) => {
      self.postMessage({ type: 'P2P_ERROR', payload: `Erro fatal no motor: ${err.message}` });
    });
  }
  return client;
}

self.addEventListener('message', async (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'P2P_PING_VERSION') {
    self.postMessage({ 
      type: 'P2P_PONG_VERSION', 
      payload: { version: WORKER_VERSION, activeClient: !!client } 
    });
    return;
  }

  if (type === 'P2P_START_SEED') {
    self.postMessage({ type: 'P2P_LOG', payload: `[WORKER v${WORKER_VERSION}] 📥 Pedido de Seed recebido: ${payload.file.name}` });
    
    const wt = getClient();
    if (!wt) return;
    
    const file = payload.file;
    
    wt.seed(file, (torrent: any) => {
      self.postMessage({ type: 'P2P_SEED_READY', payload: { magnetURI: torrent.magnetURI } });
      
      torrent.on('wire', (_wire: any, addr: string) => {
        self.postMessage({ type: 'P2P_LOG', payload: `[WORKER v${WORKER_VERSION}] 🔗 Novo peer P2P conectado: ${addr}` });
      });
    });
  }

  if (type === 'P2P_START_DOWNLOAD') {
    self.postMessage({ type: 'P2P_LOG', payload: `[WORKER v${WORKER_VERSION}] 📥 Comando de Download recebido. Buscando na rede P2P...` });
    
    const wt = getClient();
    if (!wt) return;
    
    const torrent = wt.add(payload.magnetURI);

    torrent.on('infoHash', () => {
      self.postMessage({ type: 'P2P_LOG', payload: `[WORKER v${WORKER_VERSION}] 🔎 InfoHash reconhecido. Buscando metadados...` });
    });

    torrent.on('metadata', () => {
      self.postMessage({ type: 'P2P_LOG', payload: `[WORKER v${WORKER_VERSION}] 📄 Metadados baixados! Transferindo blocos...` });
    });

    torrent.on('warning', (err: any) => {
      self.postMessage({ type: 'P2P_LOG', payload: `[WORKER v${WORKER_VERSION}] ⚠️ Aviso: ${err.message}` });
    });

    torrent.on('noPeers', (announceType: string) => {
      self.postMessage({ type: 'P2P_LOG', payload: `[WORKER v${WORKER_VERSION}] 📡 Nenhum peer encontrado via: ${announceType}` });
    });

    torrent.on('download', () => {
      self.postMessage({
        type: 'P2P_PROGRESS',
        payload: {
          progress: Math.round(torrent.progress * 100),
          downloadSpeed: torrent.downloadSpeed,
          numPeers: torrent.numPeers
        }
      });
    });

    torrent.on('done', () => {
      self.postMessage({ type: 'P2P_LOG', payload: `[WORKER v${WORKER_VERSION}] ✅ Download concluído na RAM. Salvando no OPFS...` });
      
      const file = torrent.files[0];
      if (file) {
        file.getBlob(async (err: any, blob: Blob | undefined) => {
          if (err || !blob) {
            self.postMessage({ type: 'P2P_ERROR', payload: "Erro ao extrair Blob do Torrent no Worker." });
            return;
          }
          
          // 🔥 CORREÇÃO DA TIPAGEM: Assinatura nova exige ChatHash!
          const sucesso = await salvarNoOPFS("p2p_transfer_sandbox", file.name, blob);
          if (sucesso) {
            self.postMessage({ 
              type: 'P2P_DOWNLOAD_COMPLETE', 
              payload: { fileName: file.name } 
            });
          } else {
            self.postMessage({ type: 'P2P_ERROR', payload: "Falha ao gravar arquivo no OPFS." });
          }
        });
      }
    });
  }

  if (type === 'P2P_STOP') {
    self.postMessage({ type: 'P2P_LOG', payload: `[WORKER v${WORKER_VERSION}] 🛑 Comando de parada recebido.` });
    if (client) {
      client.destroy((_err: any) => {
        client = null;
        self.postMessage({ type: 'P2P_STOPPED' });
      });
    } else {
      self.postMessage({ type: 'P2P_STOPPED' });
    }
  }
});