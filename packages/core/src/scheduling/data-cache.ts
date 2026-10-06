/**
 * DataCache — cache de dados global do TaskJuggler.
 *
 * Classe singleton que armazena e recupera valores indexados por uma chave.
 * O cache tem capacidade limitada. Quando a capacidade máxima é atingida,
 * uma certa porcentagem das entradas menos acessadas é removida.
 *
 * Propósito principal: armazenar valores caros de computar que podem ser
 * necessários em várias ocasiões durante a execução do programa.
 *
 * Fonte Ruby: `docs/taskjuggler/lib/taskjuggler/DataCache.rb`
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
   * Retorna a instância singleton do DataCache.
   */
  static get instance(): DataCache {
    if (!DataCache._instance) {
      DataCache._instance = new DataCache();
    }
    return DataCache._instance;
  }

  /**
   * Redimensiona o cache.
   *
   * @param size — capacidade máxima do cache (padrão: 100000).
   */
  resize(size: number = 100000): void {
    this.highWaterMark = size;
    this.lowWaterMark = size * 0.9;
  }

  /**
   * Limpa completamente o cache. Os contadores de estatísticas permanecem
   * intactos, mas todos os valores de dados são perdidos.
   */
  flush(): void {
    this.entries.clear();
  }

  /**
   * Retorna ou computa um valor armazenado no cache.
   *
   * @param args — argumentos que identificam unambiguamente a entrada de dados.
   * @param fn — função que computa o valor se não estiver no cache.
   * @returns O valor armazenado ou computado.
   */
  cached<T>(args: unknown[], fn: () => T): T {
    const keyJson = this.argsToJson(args);
    const key = this.hashFromJson(keyJson);
    if (this.entries.has(key)) {
      const entry = this.entries.get(key)!;
      if (entry.jsonKey !== keyJson) {
        // Duas args diferentes produzem a mesma chave hash. Isso deve ser
        // um evento muito raro!
        this.collisions += 1;
        return fn();
      }
      this.hits += 1;
      return entry.value() as T;
    }
    this.misses += 1;
    return this.store(fn(), args, keyJson, key) as T;
  }

  /**
   * Reseta o cache e todos os contadores de estatísticas.
   *
   * Útil para isolar testes unitários, já que o DataCache é um singleton.
   */
  reset(): void {
    this.entries.clear();
    this.stores = 0;
    this.hits = 0;
    this.misses = 0;
    this.collisions = 0;
  }

  /**
   * Retorna as estatísticas do cache como string.
   */
  toString(): string {
    return `Entries: ${this.entries.size}   Stores: ${this.stores}   Collisions: ${this.collisions}
Hits: ${this.hits}   Misses: ${this.misses}
Hit Rate: ${this.hits * 100.0 / (this.hits + this.misses)}%`;
  }

  /**
   * Retorna o número de entradas no cache.
   */
  get entryCount(): number {
    return this.entries.size;
  }

  /**
   * Retorna o número de hits no cache.
   */
  get hitCount(): number {
    return this.hits;
  }

  /**
   * Retorna o número de misses no cache.
   */
  get missCount(): number {
    return this.misses;
  }

  /**
   * Retorna o número de colisões no cache.
   */
  get collisionCount(): number {
    return this.collisions;
  }

  private argsToJson(args: unknown[]): string {
    return JSON.stringify(args, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  }

  private hashFromJson(json: string): number {
    let hash = 0;
    for (let i = 0; i < json.length; i++) {
      const char = json.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // converte para int32
    }
    return hash;
  }

  private store(value: unknown, unhashedKey: unknown[], jsonKey: string, key: number): unknown {
    this.stores += 1;

    if (this.entries.size >= this.highWaterMark) {
      // Quantas entradas precisamos excluir para chegar ao low watermark?
      const toDelete = this.entries.size - this.lowWaterMark;
      let deleted = 0;
      const keysToDelete: number[] = [];
      for (const [k, entry] of this.entries) {
        // Contagens de hits envelhecem com cada limpeza.
        entry.hits -= 1;
        if (entry.hits <= 0 && deleted < toDelete) {
          keysToDelete.push(k);
          deleted++;
        }
      }
      for (const k of keysToDelete) {
        this.entries.delete(k);
      }
    }

    this.entries.set(key, new DataCacheEntry(unhashedKey, jsonKey, value));
    return value;
  }
}

/**
 * Entrada do DataCache. Armazena um valor e um contador de acessos.
 * O contador pode ser lido e escrito externamente.
 */
class DataCacheEntry {
  readonly unhashedKey: unknown[];
  readonly jsonKey: string;
  hits: number = 1;

  constructor(unhashedKey: unknown[], jsonKey: string, private _value: unknown) {
    this.unhashedKey = unhashedKey;
    this.jsonKey = jsonKey;
    // O contador de acessos é definido como 1 para aumentar a chance de que
    // não seja removido imediatamente.
  }

  /**
   * Retorna o valor e aumenta o contador de acessos em 1.
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
