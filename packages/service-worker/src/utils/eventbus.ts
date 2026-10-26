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
