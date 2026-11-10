import type { Material, } from "./material.ts";

/**
 * A component of a composite material (Extra Addendum §12.2, 14C.14.1).
 *
 * `material "Cement" 420` inside the block of `material "Concrete"` declares
 * that **one** cubic metre of concrete consumes 420 kg of cement. The quantity
 * is always **per unit of the composite material**, never the project total.
 *
 * The unit price of the material owning the components stops being declared and
 * becomes computed: `Σ component.quantity × component.unitPrice()`, recursively
 * (a component may itself be composite).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §13.2
 */
export class MaterialComponent {
  /** Material consumed by the composite. */
  readonly material: Material;
  /** Quantity consumed per unit of the composite material. */
  readonly quantity: number;

  /**
   * Creates a component.
   *
   * @param material Material consumed by the composite.
   * @param quantity Quantity consumed per unit of the composite; must not be
   *   negative.
   * @throws {Error} When `quantity` is negative.
   */
  constructor(material: Material, quantity: number,) {
    if (quantity < 0) {
      throw new Error("Material component quantity cannot be negative",);
    }
    this.material = material;
    this.quantity = quantity;
  }

  /**
   * Cost of this component for **one** unit of the composite material.
   *
   * Uses the effective unit price of the component (declared explicitly or
   * computed from the component's own components).
   */
  cost(): number {
    return this.quantity * this.material.unitPriceValue();
  }

  /** Immutable deep copy — returns `this`, like the other allocations. */
  deepClone(): this {
    return this;
  }
}

/**
 * The components of a material live in the scenario attribute
 * `materialcomponents` (14C.14.2) and are only queried for pricing — which is
 * why `MaterialComponent` keeps no reference to the owning material.
 */
