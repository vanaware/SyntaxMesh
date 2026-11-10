/**
 * `KeyValueStore` — key/value storage contract of the core (ADR 037).
 *
 * Counterpart of `FileStore`: the core declares the shape and whoever
 * implements it (worker-db in the PWA, phases 19/20; CLI adapter, phase 24)
 * decides the physical medium. It is not consumed by the phase 18 sheets — it
 * exists here so that the `interfaces/` directory describes both persistence
 * accesses of the core in one place.
 *
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 */
export interface KeyValueStore {
  /** Serializable value associated with the key, or `undefined` if absent. */
  get<T,>(key: string,): Promise<T | undefined>;
  /** Associates `value` with the key (creates or overwrites). */
  set<T,>(key: string, value: T,): Promise<void>;
  /** Removes the key (no-op if absent). */
  del(key: string,): Promise<void>;
  /** All known keys. */
  keys(): Promise<string[]>;
}
