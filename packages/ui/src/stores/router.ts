// src/utils/router.ts
import { signal, computed, effect } from "@preact/signals";
import {
  contatoSelecionado,
  contatoCompartilharHash,
  showAdvanced,
  currentMobileView,
  sharePayload
} from "./state.ts";

export const currentHash = signal<string>(globalThis.location?.hash || "");

if (typeof globalThis !== "undefined" && globalThis.addEventListener) {
  globalThis.addEventListener("hashchange", () => {
    currentHash.value = globalThis.location.hash;
  });
}

export function navigate(hash: string) {
  if (typeof globalThis !== "undefined") {
    globalThis.location.hash = hash;
  }
}

// 🔥 ARQUITETURA: Signal dedicado para a Pasta Selecionada no roteamento
export const pastaSelecionada = signal<string | null>(null);

effect(() => {
  const hash = currentHash.value;

  // Reset states genéricos
  contatoSelecionado.value = '';
  contatoCompartilharHash.value = null;
  showAdvanced.value = false;
  pastaSelecionada.value = null; // Reseta a pasta por padrão

  if (hash.startsWith('#chat=')) {
    contatoSelecionado.value = hash.substring(6);
    currentMobileView.value = 'chat';
    sharePayload.value = null;
  } else if (hash.startsWith('#detail=')) {
    contatoCompartilharHash.value = hash.substring(8);
    currentMobileView.value = 'chat';
    sharePayload.value = null;
  } else if (hash === '#advanced') {
    showAdvanced.value = true;
    currentMobileView.value = 'chat';
    sharePayload.value = null;
  } else if (hash.startsWith('#labs')) {
    // 🔥 ARQUITETURA: Roteamento Master/Detail para o Labs
    const id = hash.includes('=') ? hash.substring(6) : null;
    pastaSelecionada.value = id;
    currentMobileView.value = id ? 'chat' : 'list';
    sharePayload.value = null;
  } else if (hash === '#profile') {
    currentMobileView.value = 'chat';
  } else if (hash === '#logout' || hash === '#settings') {
    currentMobileView.value = 'chat';
    sharePayload.value = null;
  } else if (hash.startsWith('#share')) {
    currentMobileView.value = 'chat';
    if (hash.includes('=')) {
      sharePayload.value = hash.substring(hash.indexOf('=') + 1);
    }
  } else {
    currentMobileView.value = 'list';
    sharePayload.value = null;
  }
});

export const activeView = computed(() => {
  const hash = currentHash.value;
  if (hash.startsWith('#chat=')) return 'chat';
  if (hash.startsWith('#detail=')) return 'detail';
  if (hash === '#advanced') return 'advanced';
  if (hash.startsWith('#labs')) return 'labs'; // Trata #labs e #labs=123 da mesma forma
  if (hash === '#profile') return 'profile';
  if (hash === '#logout') return 'logout';
  if (hash.startsWith('#share')) return 'share';
  if (hash === '#settings') return 'settings';
  return 'home';
});