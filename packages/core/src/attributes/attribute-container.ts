/**
 * Interface for the container that stores attribute values.
 *
 * The value of an attribute never lives in `AttributeBase` itself — it is
 * always stored in an `AttributeContainer`. That allows inheritance and
 * scenarios without copying data.
 *
 * Implementations:
 * - `PropertyTreeNode` (phase 4) for non-scoped attributes
 * - `ScenarioData` (phase 7) for scenario-specific attributes
 */
export interface AttributeContainer {
  /**
   * Gets the stored value of an attribute.
   *
   * @param attributeId - Attribute ID (e.g. "effort")
   * @returns The stored value, or `undefined` when not defined
   */
  getStoredValue(attributeId: string,): unknown;

  /**
   * Stores a value for an attribute.
   *
   * @param attributeId - Attribute ID (e.g. "effort")
   * @param value - Value to be stored
   */
  setStoredValue(attributeId: string, value: unknown,): void;
}
