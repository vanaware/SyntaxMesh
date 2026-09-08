// packages/utils/src/eventbus/mod.ts
// exportado como @syntaxmesh/utils/eventbus

/**
 * Barramento de Eventos Interno do Loco.
 * Substitui a necessidade de espalhar addEventListener customizados pela aplicação.
 * Garante tipagem estrita entre emissores e receptores.
 * 
 * IMPORTANTE: Este é o contrato único. Se um arquivo tenta emitir um evento que não está aqui,
 * o TypeScript irá falhar, protegendo a aplicação de erros de digitação ou eventos órfãos.
 */
type EventMap = {
  // ==========================================
  // 1. COMUNICAÇÃO SW -> UI (Notificações de Estado)
  // ==========================================
  'sw:notify:pong-version': { version: string };


  // ==========================================
  // 2. EVENTOS DE REDE E CONECTIVIDADE
  // ==========================================
  'syntaxmesh:network:online': void;
  'syntaxmesh:network:offline': void;
  'syntaxmesh:network:sync-completed': { syncedCount: number };

  // ==========================================
  // 3. EVENTOS DE HANDSHAKE E SW (Internos / Entrada)
  // ==========================================
  'syntaxmesh:sw:ready': void;
  'syntaxmesh:sw:message-received': { type: string; payload: unknown };

  // ==========================================
  // 4. EVENTOS DE UI E NAVEGAÇÃO
  // ==========================================
  'syntaxmesh:ui:route-changed': { path: string; params: Record<string, string> };
  'syntaxmesh:ui:theme-changed': { theme: 'light' | 'dark' };
  'syntaxmesh:ui:config-updated': { key: string; value: unknown };

  // ==========================================
  // 5. EVENTOS DE CICLO DE VIDA DO APP
  // ==========================================
  'syntaxmesh:app:backgrounded': void;
  'syntaxmesh:app:foregrounded': void;
};

type EventCallback<T> = (payload: T) => void;

class EventBusImpl {
  private listeners = new Map<keyof EventMap, Set<EventCallback<any>>>();

  /**
   * Assina um evento interno.
   * Retorna uma função de cleanup para remover o listener (evita vazamentos).
   */
  on<K extends keyof EventMap>(
    event: K, 
    callback: EventCallback<EventMap[K]>
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    const callbacks = this.listeners.get(event)!;
    callbacks.add(callback);

    // Retorna função de unsubscribe
    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  /**
   * Emite um evento interno.
   */
  emit<K extends keyof EventMap>(
    event: K, 
    ...args: EventMap[K] extends void ? [] : [EventMap[K]]
  ): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const payload = args[0];
      for (const callback of callbacks) {
        try {
          callback(payload);
        } catch (error) {
          console.error(`[EventBus] Erro no listener do evento '${String(event)}':`, error);
        }
      }
    }
  }
}

// Instância Singleton
export const EventBus = new EventBusImpl();

/**
 * Hook utilitário para Preact (usar dentro de componentes).
 * Garante que o listener seja removido automaticamente quando o componente desmontar.
 */
export function useEvent<K extends keyof EventMap>(
  event: K,
  callback: EventCallback<EventMap[K]>
) {
  // A implementação real do useEffect será feita na camada de UI.
  // Aqui apenas retornamos a função de cleanup do EventBus.
  return EventBus.on(event, callback);
}