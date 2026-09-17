/**
 * Mock container para testes do sistema de atributos.
 *
 * Implementa `AttributeContainer` usando um Map interno.
 * Retorna `null` se o atributo não estiver definido.
 */

import { type AttributeContainer } from "../../src/attributes/attribute-container.ts";

/**
 * Container mock para testes.
 *
 * Usa um `Map<string, unknown>` interno.
 * Retorna `null` se o atributo não estiver definido.
 */
export class MockContainer implements AttributeContainer {
  private readonly store = new Map<string, unknown>();

  getStoredValue(attributeId: string): unknown {
    return this.store.get(attributeId) ?? null;
  }

  setStoredValue(attributeId: string, value: unknown): void {
    this.store.set(attributeId, value);
  }

  /**
   * Retorna o Map interno (para verificações em testes).
   */
  getStore(): Map<string, unknown> {
    return this.store;
  }
}