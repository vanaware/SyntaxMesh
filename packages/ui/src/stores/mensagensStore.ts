// Arquivo: monorepo/ui/src/stores/mensagensStore.ts
import { signal, batch } from '@preact/signals';
import { listarChatPaginado, salvarChat, buscarChat, removerChat } from '@loco/utils/db';
import { ExpurgarMensagens } from '@loco/service-worker/handshakes/mensagem';
import type { Chat } from '@loco/utils/interfaces';
import { contatoSelecionado } from './state.ts';
import { EventBus } from '@loco/utils/eventbus'; // 🔥 NOVO: Importar o EventBus

export const mensagensAtivas = signal<Chat[]>([]);
export const hasMoreMessages = signal<boolean>(true);
export const isFetchingMensagens = signal<boolean>(false);

const PAGE_SIZE = 30;
let currentOffset = 0;

// 🔥 NOVO: Flag para garantir que o listener do EventBus seja registrado apenas uma vez na vida do app
let isChatUpdateListenerInitialized = false;

export function limparMemoriaChat() {
  batch(() => {
    mensagensAtivas.value = [];
    hasMoreMessages.value = true;
    isFetchingMensagens.value = false;
    currentOffset = 0;
  });
}

export async function inicializarChat(contatoHash: string) {
  limparMemoriaChat();
  await carregarMaisMensagens(contatoHash);

  // 🔥 NOVO: Conectar o EventBus à lógica que já existe na sua store
  if (!isChatUpdateListenerInitialized) {
    isChatUpdateListenerInitialized = true;
    
    EventBus.on('sw:notify:chat-updated', async ({ chatId }) => {
      // processarAtualizacaoDeStatusDB já sabe:
      // 1. Buscar a mensagem atualizada no IndexedDB
      // 2. Se for do contato ativo, atualizar o Signal (via atualizarOuAdicionarChatAtivo)
      // 3. Se foi apagada ou é 'ALL_PURGED', remover do Signal
      await processarAtualizacaoDeStatusDB(chatId);
    });
  }
}

export async function carregarMaisMensagens(contatoHash: string) {
  if (isFetchingMensagens.value || !hasMoreMessages.value) return;
  isFetchingMensagens.value = true;
  try {
    const novas = await listarChatPaginado(contatoHash, PAGE_SIZE, currentOffset);
    if (contatoHash !== contatoSelecionado.value) {
      return;
    }
    batch(() => {
      if (novas.length < PAGE_SIZE) {
        hasMoreMessages.value = false;
      }
      if (novas.length > 0) {
        currentOffset += novas.length;
        const unificadas = [...novas, ...mensagensAtivas.value];
        mensagensAtivas.value = unificadas.sort((a, b) => a.createdAt - b.createdAt);
      }
    });
  } finally {
    isFetchingMensagens.value = false;
  }
}

export async function atualizarOuAdicionarChatAtivo(chat: Chat) {
  if (chat.contatoHash === contatoSelecionado.value) {
    const atual = mensagensAtivas.value;
    const index = atual.findIndex(m => m.id === chat.id);
    if (index !== -1) {
      const nova = [...atual];
      nova[index] = chat;
      mensagensAtivas.value = nova;
    } else {
      mensagensAtivas.value = [...atual, chat];
      currentOffset += 1;
    }
  }
  await salvarChat(chat);
}

export async function processarAtualizacaoDeStatusDB(chatId: string) {
  const chatAtualizado = await buscarChat(chatId);
  if (chatAtualizado) {
    await atualizarOuAdicionarChatAtivo(chatAtualizado);
  } else {
    const atual = mensagensAtivas.value;
    const existe = atual.some(m => m.id === chatId || chatId === 'ALL_PURGED');
    if (existe) {
      batch(() => {
        mensagensAtivas.value = chatId === 'ALL_PURGED' ? [] : atual.filter(m => m.id !== chatId);
        currentOffset = chatId === 'ALL_PURGED' ? 0 : Math.max(0, currentOffset - 1);
      });
    }
  }
}

export async function excluirMensagem(msgId: string, contatoHash: string) {
  if (contatoSelecionado.value === contatoHash) {
    batch(() => {
      mensagensAtivas.value = mensagensAtivas.value.filter(m => m.id !== msgId);
      currentOffset = Math.max(0, currentOffset - 1);
    });
  }
  
  const msgLocal = await buscarChat(msgId);
  const deveAvisarRemoto = msgLocal && msgLocal.handshake !== 'self';
  
  await removerChat(msgId, contatoHash);
  
  if (deveAvisarRemoto && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active) {
        reg.active.postMessage({
          type: 'CRIAR_HANDSHAKE_OUT',
          payload: {
            rotasModulo: 'mensagem',
            params: { function: 'excluirMensagem', contato: contatoHash, msgId: msgId }
          }
        });
      }
    } catch (e) {
      console.warn("Falha ao enviar handshake de exclusão remota", e);
    }
  }
}

export async function limparTodoHistorico(contatoHash: string) {
  if (contatoSelecionado.value === contatoHash) {
    limparMemoriaChat();
  }
  await ExpurgarMensagens(contatoHash, true);
}

export async function initMensagensStore() {}