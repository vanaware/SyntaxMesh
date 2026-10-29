> **AI INSTRUCTION:** 
> O texto abaixo contém experimentos e código da área de @workerDB/service-worker
> Each file starts with a title indicating its exact relative path (e.g., `## File: src/main.ts`).
> Whenever suggesting changes, clearly indicate which file should be modified based on these paths and provide the complete new code for the file.

---

# Exported Context from Project SyntaxMesh [v0.0.2-mtvrt8od] - Mode: SW

Automatically generated at: 2026-10-28T21:19:03.408Z

---

## File: `packages/service-worker/deno.jsonc`

```json
{
  "name": "@syntaxmesh/service-worker",
  "compilerOptions": {
    "lib": [
      "dom",
      "dom.iterable",
      "dom.asynciterable",
      "esnext",
      "deno.ns",
      "webworker"
    ],
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true
  },
  "imports": {
    "@std/assert": "jsr:@std/assert@^1",
    "@std/fs": "jsr:@std/fs@^1",
    "@std/http": "jsr:@std/http@^1",
    "@std/path": "jsr:@std/path@^1",
    "idb-keyval": "https://esm.sh/idb-keyval@6.2.1",
    "fflate": "https://esm.sh/fflate@0.8.2?target=es2022",
    "fake-indexeddb": "https://esm.sh/fake-indexeddb@6.2.5?bundle",
    "fake-indexeddb/auto": "https://esm.sh/fake-indexeddb@6.2.5/auto?bundle"
  },
  "tasks": {
    "test": "deno test --allow-env --allow-net --allow-read --allow-write tests/",
    "check": "deno check src/**/*.ts tests/**/*.ts",
    "build": "deno run --allow-import --allow-read --allow-write --allow-env --allow-net --env-file --unstable-bundle ../esbuild.ts sw",
    "tests": "deno task check && deno task test"
  },
  "exports": {
    ".": "./src/mod.ts",
    "./utils": "./src/utils/mod.ts",
    "./handshakes/contato": "./src/handshakes/hand-contato.ts",
    "./handshakes/sdp": "./src/handshakes/hand-sdp.ts",
    "./handshakes/profile": "./src/handshakes/hand-profile.ts",
    "./handshakes/mensagem": "./src/handshakes/hand-mensagem.ts"
  }
}

```

---

## File: `packages/service-worker/src/mod.ts`

```ts
export * from "./utils/mod.ts";

```

---

## File: `packages/service-worker/src/service-worker.ts`

```ts
// monorepo/service-worker/src/service-worker.ts
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { initializeSwEventAdapter, } from "./sw/event-adapter.ts";
import { APP_VERSION, } from "./utils/config.ts";

console.log(
  `[SW] 🌌 Service Worker orquestrador carregado (v${APP_VERSION}).`,
);

// Inicializa a Fronteira de Eventos.
// Toda a lógica de addEventListener, roteamento de fetch, message, push, etc.
// agora vive dentro do event-adapter.ts.
initializeSwEventAdapter();

```

---

## File: `packages/service-worker/src/sw/cache.ts`

```ts
// src/sw/cache.ts
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;
declare const __GENERATED_ASSETS__: string[];

import { APP_VERSION, } from "../utils/config.ts";

const CACHE_NAME = `syntaxmesh-proto-cache-v${APP_VERSION}`;
const ASSETS_TO_CACHE: string[] = typeof __GENERATED_ASSETS__ !== "undefined"
  ? __GENERATED_ASSETS__
  : [];

/**
 * Handler de instalação do Service Worker.
 * Exportado para ser orquestrado pelo service-worker.ts principal.
 */
export function handleInstall(event: ExtendableEvent,): void {
  console.log("[SW-CACHE] 🛠️ Instalando novo Service Worker...",);
  event.waitUntil(
    caches.open(CACHE_NAME,).then((cache,) => {
      console.log(
        "[SW-CACHE] 📦 Armazenando assets essenciais no cache local...",
      );
      return Promise.all(
        ASSETS_TO_CACHE.map((url,) => {
          return cache.add(url,).catch((err,) => {
            console.error(
              `[SW-CACHE] ❌ Falha ao cachear recurso: ${url}`,
              err,
            );
          },);
        },),
      );
    },).then(() => self.skipWaiting()),
  );
}

/**
 * Handler de ativação do Service Worker.
 * Exportado para ser orquestrado pelo service-worker.ts principal.
 */
export function handleActivate(event: ExtendableEvent,): void {
  console.log(
    "[SW-CACHE] ✨ Ativando Service Worker e limpando caches antigos...",
  );
  event.waitUntil(
    caches.keys().then((cacheNames,) => {
      return Promise.all(
        cacheNames.map((cache,) => {
          if (cache !== CACHE_NAME) {
            console.log(`[SW-CACHE] 🗑️ Removendo cache obsoleto: ${cache}`,);
            return caches.delete(cache,);
          }
        },),
      );
    },).then(() => self.clients.claim()),
  );
}

/**
 * Lógica de fetch para cache (Network-First com fallback para Cache).
 * Exportada para ser orquestrada pelo service-worker.ts principal.
 */
export async function handleCacheFetch(
  event: FetchEvent,
): Promise<Response | undefined> {
  // Ignora métodos que não sejam GET
  if (event.request.method !== "GET") {
    return undefined;
  }

  // Ignora requisições externas à origem ou rotas de API
  if (
    !event.request.url.startsWith(self.location.origin,) ||
    event.request.url.includes("/api/",)
  ) {
    return undefined;
  }

  try {
    // Tenta buscar da rede primeiro
    const networkResponse = await fetch(event.request,);

    // Se for bem-sucedido, clona e salva no cache
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      const cache = await caches.open(CACHE_NAME,);
      await cache.put(event.request, responseClone,);
    }

    return networkResponse;
  } catch (err) {
    // Fallback Offline
    console.log(
      `[SW-CACHE] 🔌 Usuário Offline. Servindo do cache: ${event.request.url}`,
    );
    const cache = await caches.open(CACHE_NAME,);
    const cachedResponse = await cache.match(event.request,);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response(
      "Você está offline e este recurso não foi mapeado no cache.",
      {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", },
      },
    );
  }
}

```

---

## File: `packages/service-worker/src/sw/event-adapter.ts`

```ts
// monorepo/service-worker/src/sw/event-adapter.ts
/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import EventBus from "../utils/eventbus.ts";
import { APP_VERSION, } from "../utils/config.ts";
import { addDebugLog, } from "../utils/debug.ts";

// === HANDLERS NATIVOS EXISTENTES (INFRAESTRUTURA) ===
import { handleActivate, handleCacheFetch, handleInstall, } from "./cache.ts";

/**
 * Inicializa a Fronteira de Eventos do Service Worker.
 * Este é o ÚNICO ponto onde addEventListener nativos devem ser registrados no SW.
 */
export function initializeSwEventAdapter() {
  addDebugLog(
    `[SW-ADAPTER] 🌌 Inicializando Adaptador de Eventos do SW (v${APP_VERSION}).`,
  );

  // ==========================================
  // 1. LIFECYCLE EVENTS
  // ==========================================
  self.addEventListener("install", (event,) => {
    handleInstall(event,);
  },);

  self.addEventListener("activate", (event,) => {
    handleActivate(event,);
  },);

  // ==========================================
  // 2. FETCH EVENT
  // ==========================================
  self.addEventListener("fetch", (event: FetchEvent,) => {
    const cachePromise = handleCacheFetch(event,);
    event.respondWith(
      cachePromise.then((response,) => {
        if (response) return response;
        return fetch(event.request,);
      },),
    );
  },);

  // ==========================================
  // 3. MESSAGE EVENT (A MÁGICA DO EVENTBUS)
  // ==========================================
  self.addEventListener("message", (event: ExtendableMessageEvent,) => {
    if (!event.data) return;
    const { type, payload, } = event.data;

    if (type === "PING_SW_VERSION") {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          type: "PONG_SW_VERSION",
          version: APP_VERSION,
        },);
      }
      return;
    }
  },);

  self.addEventListener("online", (event: Event,) => {
    // ✅ Chave exata do EventMap
    EventBus.emit("syntaxmesh:network:online",);
    //handleOnline(event,);
  },);

  self.addEventListener("offline", (event: Event,) => {
    // ✅ Chave exata do EventMap
    EventBus.emit("syntaxmesh:network:offline",);
  },);

  addDebugLog(
    `[SW-ADAPTER] ✅ Adaptador de Eventos inicializado e listeners nativos acoplados.`,
  );
}

/**
 * Helper para broadcast de mensagens para todas as janelas/abas do app.
 */
async function broadcastToClients(message: unknown,) {
  if (
    typeof self !== "undefined" && self.clients &&
    typeof self.clients.matchAll === "function"
  ) {
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    },);
    clients.forEach((client,) => client.postMessage(message,));
  }
}

```

---

## File: `packages/service-worker/src/sw/mod.ts`

```ts
// reservado para futuras exportações

```

---

## File: `packages/service-worker/src/utils/config.ts`

```ts
// monorepo/service-worker/src/utils/config.ts
// Substituto local de @syntaxmesh/utils/config (pacote removido na simplificação de arquitetura).
// Versão do app — mantida em sincronia com a versão raiz do projeto (deno.jsonc).

export const APP_VERSION = "0.0.2-mtvrt8od";

```

---

## File: `packages/service-worker/src/utils/debug.ts`

```ts
// monorepo/service-worker/src/utils/debug.ts
// Substituto local de @syntaxmesh/utils/debug (pacote removido na simplificação de arquitetura).
// Log simples para depuração — o código real do SW ainda não foi desenvolvido.

/**
 * Registra uma mensagem de debug no console.
 * Assinatura compatível com a utilidade original:
 *   addDebugLog(message: string)
 *   addDebugLog(level: string, module: string, message: string)
 */
export function addDebugLog(
  arg1: string,
  arg2?: string,
  arg3?: string,
): void {
  let message: string;
  if (arg2 !== undefined && arg3 !== undefined) {
    // addDebugLog(level, module, message)
    message = `[${arg2}] ${arg3}`;
  } else {
    // addDebugLog(message)
    message = arg1;
  }
  console.debug(`[SW-DEBUG] ${message}`,);
}

```

---

## File: `packages/service-worker/src/utils/eventbus.ts`

```ts
// monorepo/service-worker/src/utils/eventbus.ts
// Substituto local de @syntaxmesh/utils/eventbus (pacote removido na simplificação de arquitetura).
// Event bus simples para comunicação interna — o código real do SW ainda não foi desenvolvido.

export type EventCallback = (data?: unknown,) => void;

export class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback,): void {
    if (!this.listeners.has(event,)) {
      this.listeners.set(event, new Set(),);
    }
    this.listeners.get(event,)!.add(callback,);
  }

  off(event: string, callback: EventCallback,): void {
    const set = this.listeners.get(event,);
    set?.delete(callback,);
  }

  emit(event: string, data?: unknown,): void {
    const set = this.listeners.get(event,);
    set?.forEach((callback,) => callback(data,));
  }
}

const eventBus = new EventBus();
export default eventBus;

```

---

## File: `packages/service-worker/src/utils/mod.ts`

```ts
// monorepo/service-worker/src/utils/mod.ts
import { addDebugLog, } from "./debug.ts";
import { APP_VERSION, } from "./config.ts";
import EventBus from "./eventbus.ts";

let uiAdapterInitialized = false;

/**
 * Inicializa a Fronteira de Eventos da UI (Main Thread).
 * Traduz postMessage do SW e eventos nativos do Window para o EventBus da UI.
 */
export function initializeUiEventAdapter() {
  if (uiAdapterInitialized) {
    return;
  }
  uiAdapterInitialized = true;

  addDebugLog(`[UI-ADAPTER] 🌌 Inicializando Adaptador de Eventos da UI.`,);

  // 1. Traduz postMessage do SW -> EventBus da UI
  navigator.serviceWorker.addEventListener(
    "message",
    (event: MessageEvent,) => {
      if (!event.data) return;
      const { type, payload, } = event.data;

      addDebugLog(`[UI-ADAPTER] 📬 postMessage recebido do SW: type=${type}`,);

      if (type === "PONG_SW_VERSION") {
        EventBus.emit("sw:notify:pong-version", { version: payload.version, },);
      }
    },
  );

  // 2. Traduz eventos de rede nativos -> EventBus da UI
  globalThis.addEventListener("online", () => {
    addDebugLog(`[UI-ADAPTER] 🟢 Rede online detectada.`,);
    EventBus.emit("syntaxmesh:network:online",);
  },);

  globalThis.addEventListener("offline", () => {
    addDebugLog(`[UI-ADAPTER] 🔴 Rede offline detectada.`,);
    EventBus.emit("syntaxmesh:network:offline",);
  },);
  // 3. Traduz ciclo de vida da janela -> EventBus
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      EventBus.emit("syntaxmesh:app:backgrounded",);
    } else if (document.visibilityState === "visible") {
      EventBus.emit("syntaxmesh:app:foregrounded",);
    }
  },);

  addDebugLog(
    "✅ EventAdapter da UI inicializado e ouvindo fronteiras nativas.",
  );
}

/**
 * Registra o Service Worker e inicializa o EventAdapter da UI.
 */
export async function registrarServiceWorker(): Promise<
  ServiceWorkerRegistration
> {
  addDebugLog("📡 Verificando suporte ao Service Worker...",);
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker não é suportado neste navegador.",);
  }

  let basePath = globalThis.location.pathname;
  if (basePath.split("/",).pop()?.includes(".",)) {
    basePath = basePath.substring(0, basePath.lastIndexOf("/",) + 1,);
  } else if (!basePath.endsWith("/",)) {
    basePath += "/";
  }

  addDebugLog(`⏳ Registrando Service Worker no escopo: ${basePath}`,);

  try {
    const registration = await navigator.serviceWorker.register(
      `${basePath}service-worker.js?v=${APP_VERSION}`,
      { scope: basePath, },
    );

    if (!registration) {
      throw new Error("Service Worker registration retornou null/undefined",);
    }

    addDebugLog("✅ Service Worker registrado, aguardando ready...",);
    const readyReg = await navigator.serviceWorker.ready;

    // 🔥 Inicializa o EventAdapter da UI assim que o SW estiver pronto
    initializeUiEventAdapter();

    // Checagem Introspectiva de Versão (App vs SW)
    if (readyReg.active) {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event,) => {
        if (event.data && event.data.type === "PONG_SW_VERSION") {
          const swVersion = event.data.version;
          if (swVersion !== APP_VERSION) {
            addDebugLog(
              "warn",
              "SYSTEM",
              `⚠️ Inconsistência de Versão! App v${APP_VERSION} vs SW v${swVersion}.`,
            );
          } else {
            addDebugLog(
              "info",
              "SYSTEM",
              `🔒 Match de versão: App e SW em v${APP_VERSION}.`,
            );
          }
        }
      };
      readyReg.active.postMessage({ type: "PING_SW_VERSION", }, [
        channel.port2,
      ],);
    }

    return readyReg;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err,);
    addDebugLog("❌ Erro ao registrar Service Worker: " + errorMessage,);
    throw new Error(`Falha ao registrar Service Worker: ${errorMessage}`,);
  }
}

```

---

