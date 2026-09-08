// Arquivo: monorepo/ui/src/stores/contatosStore.ts
import { signal, computed } from "@preact/signals";
import {
  listarContatos,
  salvarContato,
  serializarPublicKeyVapid,
  buscarProfile,
  removerContatoPorHash,
  listarHandshakes,
  removerHandshake,
  salvarHandshake,
  buscarContatoPorChave,
  gerarId
} from "@loco/utils/db";
import type { Contato, Handshake } from "@loco/utils/interfaces";
import { addDebugLog } from "@loco/utils/debug";
import { gerarContatoProprio } from "@loco/utils/db";
import { ExpurgarMensagens } from "@loco/service-worker/handshakes/mensagem";
import { ExpurgarHandshakesContato } from "@loco/service-worker/handshakes/contato";
import { ExpurgarHandshakesProfile } from "@loco/service-worker/handshakes/profile";
import { EventBus } from "@loco/utils/eventbus";

export type { Contato };

export const isCarregandoContatos = signal<boolean>(false);
export const contatosRaw = signal<Contato[]>([]);

export const contatosComHash = computed(() => {
  return contatosRaw.value.map((contato) => ({
    contato,
    hash: contato.id,
  }));
});

export const contatosMap = computed(() => {
  const map = new Map<string, Contato>();
  for (const c of contatosRaw.value) {
    map.set(c.id, c);
  }
  return map;
});

export async function carregarContatos(): Promise<void> {
  isCarregandoContatos.value = true;
  try {
    const listaCompleta = await listarContatos();
    const lista = listaCompleta.filter(c => c.me !== 'deleted');
    const profile = await buscarProfile();
    
    if (profile) {
      const contatoProprio = await gerarContatoProprio(profile);
      if (contatoProprio) {
        const indexExistente = lista.findIndex(c => c.id === contatoProprio.id);
        if (indexExistente >= 0) {
          lista[indexExistente] = contatoProprio;
        } else {
          lista.push(contatoProprio);
        }
      }
    }
    contatosRaw.value = lista;
  } catch (err) {
    addDebugLog("error", "STORE:CONTATO", "Erro ao carregar contatos do IndexedDB", err);
  } finally {
    isCarregandoContatos.value = false;
    }
}

let isContatosListenerInitialized = false;

export async function initContatosStore(): Promise<void> {
  await carregarContatos();
  
  if (!isContatosListenerInitialized) {
    isContatosListenerInitialized = true;
    // ✅ ARQUITETURA: Escuta o EventBus em vez do Service Worker diretamente
    EventBus.on('sw:notify:contact-updated', () => {
      addDebugLog("info", "STORE:CONTATO", "Evento de atualização de contato recebido via EventBus. Recarregando...");
      carregarContatos();
    });
  }
}

export async function adicionarContato(contato: Contato): Promise<void> {
  try {
    const atual = contatosRaw.value;
    const index = atual.findIndex(c => c.id === contato.id);
    if (index >= 0) {
      const novaLista = [...atual];
      novaLista[index] = contato;
      contatosRaw.value = novaLista;
    } else {
      contatosRaw.value = [...atual, contato];
    }
    await salvarContato(contato);
    addDebugLog("success", "STORE:CONTATO", `Contato salvo em disco: ${contato.name}`);
  } catch (err) {
    addDebugLog("error", "STORE:CONTATO", `Erro ao persistir contato ${contato.id}`, err);
    throw err;
  }
}

export async function importarNovoContato(dadosBasicos: Omit<Contato, 'me' | 'createdAt' | 'updatedAt'>): Promise<void> {
  const novoContato: Contato = {
    ...dadosBasicos,
    me: 'none',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  await adicionarContato(novoContato);
  addDebugLog("info", "STORE:CONTATO", `Novo contato (${novoContato.name}) importado. Status de sincronia inicializado como 'none'.`);
}

export function adicionarOuAtualizarContato(contato: Contato): void {
  adicionarContato(contato).catch((err) => {
    addDebugLog("error", "STORE:CONTATO", "Falha assíncrona ao adicionar/atualizar contato", err);
  });
}

export async function rebaixarConfiancaContatos(): Promise<void> {
  try {
    const atual = contatosRaw.value;
    if (atual.length === 0) return;
    
    let mudouAlgum = false;
    const novaLista = atual.map(c => {
      if (c.me === 'trusted' || c.me === 'saved') {
        mudouAlgum = true;
        return { ...c, me: 'none' as const, updatedAt: Date.now() };
      }
      return c;
    });

    if (!mudouAlgum) return;

    contatosRaw.value = novaLista;
    Promise.all(novaLista.map(c => salvarContato(c))).catch(err => {
      addDebugLog("error", "STORE:CONTATO", "Falha ao persistir rebaixamento no IndexedDB", err);
    });
    
    addDebugLog("info", "STORE:CONTATO", `Status 'me' rebaixado para 'none' em contatos salvos para forçar o Piggybacking.`);
  } catch (err) {
    addDebugLog("error", "STORE:CONTATO", "Erro crítico ao rebaixar confiança dos contatos", err);
  }
}

export async function removerContatoPorPublicKey(vapidPublicKey: JsonWebKey): Promise<void> {
  try {
    const hash = await serializarPublicKeyVapid(vapidPublicKey);
    await removerContatoCompletamente(hash);
  } catch (err) {
    addDebugLog("error", "STORE:CONTATO", "Erro ao remover contato por chave pública", err);
  }
}

export async function removerContatoCompletamente(hash: string, notificarRemoto = true): Promise<void> {
  try {
    addDebugLog("warn", "STORE:CONTATO", `Iniciando EXPURGO DE DADOS TOTAL para o contato ${hash}`);
    
    contatosRaw.value = contatosRaw.value.filter(c => c.id !== hash);
    
    await ExpurgarMensagens(hash, false);
    await ExpurgarHandshakesContato(hash);
    await ExpurgarHandshakesProfile(hash);
    
    const handshakes = await listarHandshakes();
    for (const h of handshakes) {
      if (h.aud === hash) await removerHandshake(h.id);
    }

    const contatoExistente = await buscarContatoPorChave(hash);
    if (notificarRemoto && contatoExistente) {
      contatoExistente.me = 'deleted';
      await salvarContato(contatoExistente);
      
      const handshakeDelecao: Handshake = {
        id: gerarId(),
        aud: hash,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        out: {
          status: 'pendente',
          tentativas: 0,
          rotas: { contato: { removerContato: true } }
        }
      };
      await salvarHandshake(handshakeDelecao);
      
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg.active) reg.active.postMessage({ type: 'PROCESSAR_FILA_HANDSHAKE' });
      }
    } else {
      await removerContatoPorHash(hash);
    }
  } catch (err) {
    addDebugLog("error", "STORE:CONTATO", "Erro catastrófico ao expurgar contato e histórico", err);
    throw err;
  }
}

export async function homologarContatoPorPublicKey(vapidPublicKey: JsonWebKey): Promise<void> {
  try {
    const hash = await serializarPublicKeyVapid(vapidPublicKey);
    const atual = contatosRaw.value;
    const index = atual.findIndex(c => c.id === hash);
    
    if (index >= 0 && atual[index]) {
      const contatoAtual = atual[index];
      const contatoModificado: Contato = { ...contatoAtual, trusted: true, updatedAt: Date.now() };
      const novaLista = [...atual];
      novaLista[index] = contatoModificado;
      contatosRaw.value = novaLista;
      await salvarContato(contatoModificado);
    }
  } catch (err) {
    addDebugLog("error", "STORE:CONTATO", "Erro ao homologar contato", err);
  }
}

export function atualizarStatusVerificacaoContato(id: string, meStatus: Contato["me"]): void {
  const atual = contatosRaw.value;
  const index = atual.findIndex(c => c.id === id);
  
  if (index >= 0 && atual[index]) {
    const contatoAtual = atual[index];
    const contatoModificado: Contato = { ...contatoAtual, me: meStatus, updatedAt: Date.now() };
    const novaLista = [...atual];
    novaLista[index] = contatoModificado;
    contatosRaw.value = novaLista;
    
    salvarContato(contatoModificado).catch(err => {
      addDebugLog("error", "STORE:CONTATO", `Erro ao atualizar status do contato ${id}`, err);
    });
  }
}