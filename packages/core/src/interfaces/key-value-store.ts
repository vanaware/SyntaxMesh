/**
 * `KeyValueStore` — contrato de armazenamento chave/valor do core (ADR 037).
 *
 * Par da `FileStore`: o core declara a forma e quem implementa (worker-db na
 * PWA, Fase 19/20; adaptador da CLI, Fase 24) decide o meio físico. Não é
 * consumido pelos sheets da Fase 18 — existe aqui para que o diretório
 * `interfaces/` descreva de uma vez os dois acessos de persistência do core.
 *
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 */
export interface KeyValueStore {
  /** Valor serializável associado à chave, ou `undefined` se ausente. */
  get<T,>(key: string,): Promise<T | undefined>;
  /** Associa `value` à chave (cria ou sobrescreve). */
  set<T,>(key: string, value: T,): Promise<void>;
  /** Remove a chave (no-op se ausente). */
  del(key: string,): Promise<void>;
  /** Todas as chaves conhecidas. */
  keys(): Promise<string[]>;
}
