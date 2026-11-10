/**
 * DataCache — global data cache for TaskJuggler.
 *
 * Singleton class that stores and retrieves values indexed by a key. The cache
 * has a bounded capacity: once the maximum is reached, a percentage of the
 * least-accessed entries is dropped.
 *
 * Main purpose: hold expensive-to-compute values that may be needed several
 * times while the program runs.
 *
 * Ruby source: `docs/taskjuggler/lib/taskjuggler/DataCache.rb`
 *
 * @see {@link https://docs.taskjuggler.org/en/latest/scheduler.html#data-cache}
 */
export class DataCache {
  private static _instance: DataCache;

  private entries: Map<number, DataCacheEntry> = new Map();
  private highWaterMark: number = 100000;
  private lowWaterMark: number = 90000;
  private stores: number = 0;
  private hits: number = 0;
  private misses: number = 0;
  private collisions: number = 0;

  private constructor() {
    this.resize();
    this.flush();
  }

  /**
   * Returns the singleton `DataCache` instance.
   *
   * @returns The shared cache, created on first access.
   */
  static get instance(): DataCache {
    if (!DataCache._instance) {
      DataCache._instance = new DataCache();
    }
    return DataCache._instance;
  }

  /**
   * Resizes the cache.
   *
   * @param size Maximum cache capacity (default: 100000).
   */
  resize(size: number = 100000,): void {
    this.highWaterMark = size;
    this.lowWaterMark = size * 0.9;
  }

  /**
   * Empties the cache completely.
   *
   * The statistics counters are untouched, but every stored value is lost.
   */
  flush(): void {
    this.entries.clear();
  }

  /**
   * Returns a cached value, computing and storing it when it is missing.
   *
   * @param args Arguments that unambiguously identify the data entry.
   * @param fn Function that computes the value on a cache miss.
   * @returns The cached or freshly computed value.
   */
  cached<T,>(args: unknown[], fn: () => T,): T {
    const keyJson = this.argsToJson(args,);
    const key = this.hashFromJson(keyJson,);
    if (this.entries.has(key,)) {
      const entry = this.entries.get(key,)!;
      if (entry.jsonKey !== keyJson) {
        // Two different args produced the same hash key. This should be a
        // very rare event!
        this.collisions += 1;
        return fn();
      }
      this.hits += 1;
      return entry.value() as T;
    }
    this.misses += 1;
    return this.store(fn(), args, keyJson, key,) as T;
  }

  /**
   * Clears the cache and resets every statistics counter.
   *
   * Useful to isolate unit tests, since the `DataCache` is a singleton.
   */
  reset(): void {
    this.entries.clear();
    this.stores = 0;
    this.hits = 0;
    this.misses = 0;
    this.collisions = 0;
  }

  /**
   * Renders the cache statistics as a string.
   *
   * @returns Entry, store, hit, miss and collision counters with the hit rate.
   */
  toString(): string {
    return `Entries: ${this.entries.size}   Stores: ${this.stores}   Collisions: ${this.collisions}
Hits: ${this.hits}   Misses: ${this.misses}
Hit Rate: ${this.hits * 100.0 / (this.hits + this.misses)}%`;
  }

  /**
   * Number of entries currently held by the cache.
   *
   * @returns The current entry count.
   */
  get entryCount(): number {
    return this.entries.size;
  }

  /**
   * Number of cache hits so far.
   *
   * @returns The hit counter.
   */
  get hitCount(): number {
    return this.hits;
  }

  /**
   * Number of cache misses so far.
   *
   * @returns The miss counter.
   */
  get missCount(): number {
    return this.misses;
  }

  /**
   * Number of hash collisions so far.
   *
   * @returns The collision counter.
   */
  get collisionCount(): number {
    return this.collisions;
  }

  /**
   * Serialises the cache arguments, falling back to strings for bigints.
   *
   * @param args Arguments that identify the entry.
   * @returns The canonical JSON key.
   */
  private argsToJson(args: unknown[],): string {
    return JSON.stringify(
      args,
      (_key, value,) => typeof value === "bigint" ? value.toString() : value,
    );
  }

  /**
   * Hashes a JSON key with the classic djb2-style 32-bit accumulator.
   *
   * @param json Canonical JSON key.
   * @returns A signed 32-bit hash.
   */
  private hashFromJson(json: string,): number {
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i,);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // convert to int32
    }
    return hash;
  }

  /**
   * Stores a value under the given key, evicting cold entries when the cache is
   * at the high water mark.
   *
   * @param value Value to store.
   * @param unhashedKey Original arguments of the entry.
   * @param jsonKey Canonical JSON key of the entry.
   * @param key Hashed key used as the map index.
   * @returns The stored value.
   */
  private store(
    value: unknown,
    unhashedKey: unknown[],
    jsonKey: string,
    key: number,
  ): unknown {
    this.stores += 1;

    if (this.entries.size >= this.highWaterMark) {
      // How many entries must be evicted to reach the low watermark?
      const toDelete = this.entries.size - this.lowWaterMark;
      let deleted = 0;
      const keysToDelete: number[] = [];
      for (const [k, entry,] of this.entries) {
        // Hit counts age with every cleanup.
        entry.hits -= 1;
        if (entry.hits <= 0 && deleted < toDelete) {
          keysToDelete.push(k,);
          deleted++;
        }
      }
      for (const k of keysToDelete) {
        this.entries.delete(k,);
      }
    }

    this.entries.set(key, new DataCacheEntry(unhashedKey, jsonKey, value,),);
    return value;
  }
}

/**
 * Entry of the `DataCache`. Holds a value and an access counter.
 * The counter can be read and written externally.
 */
class DataCacheEntry {
  readonly unhashedKey: unknown[];
  readonly jsonKey: string;
  hits: number = 1;

  constructor(
    unhashedKey: unknown[],
    jsonKey: string,
    private _value: unknown,
  ) {
    this.unhashedKey = unhashedKey;
    this.jsonKey = jsonKey;
    // The access counter starts at 1 to reduce the chance of an immediate
    // eviction.
  }

  /**
   * Returns the value and increments the access counter by one.
   *
   * @returns The stored value.
   */
  value(): unknown {
    if (this.hits <= 0) {
      this.hits = 1;
    } else {
      this.hits += 1;
    }
    return this._value;
  }
}
