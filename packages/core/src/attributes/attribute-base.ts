/**
 * Abstract base class for every TaskJuggler attribute.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb (whole file)
 */

import { type PropertyLike, } from "../model/property-like.ts";
import { type AttributeContainer, } from "./attribute-container.ts";
import { type AttributeDefinition, } from "./attribute-definition.ts";
import { deepClone, } from "../utils/deep-clone.ts";
import { AttributeOverwrite, } from "./errors.ts";

/**
 * Global modes for the behaviour of `set()` and `inherit()`.
 *
 * @see 014-attribute-mode-global.md
 */
export type AttributeMode = 0 | 1 | 2;

/**
 * Abstract base class for all attributes.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb
 */
export abstract class AttributeBase<T,> {
  /**
   * Global mode that influences `set()` and `inherit()`.
   *
   * @see 014-attribute-mode-global.md
   */
  private static _mode: AttributeMode = 0;

  /** Current global attribute mode. */
  static get mode(): AttributeMode {
    return AttributeBase._mode;
  }

  /**
   * Replaces the global attribute mode.
   *
   * @param mode New mode: 0 = provided, 1 = inherited, 2 = computed.
   * @throws Error When the mode is not 0, 1 or 2.
   */
  static setMode(mode: AttributeMode,): void {
    if (mode !== 0 && mode !== 1 && mode !== 2) {
      throw new Error(`Modo inválido: ${mode}. Deve ser 0, 1 ou 2.`,);
    }
    AttributeBase._mode = mode;
  }

  /**
   * Property that contains this attribute.
   */
  protected readonly property: PropertyLike;

  /**
   * Type definition of this attribute (holds id, name, default, etc.).
   */
  protected readonly type: AttributeDefinition<T>;

  /**
   * Container that stores the value of this attribute.
   */
  protected readonly container: AttributeContainer;

  /**
   * If `true`, the value was provided explicitly (by the user).
   */
  public provided: boolean = false;

  /**
   * If `true`, the value was inherited (parent/project).
   */
  public inherited: boolean = false;

  /**
   * Value stored locally (avoids recursion).
   */
  protected _value: T | null = null;

  /**
   * Ruby `initialize(property, type, container)`.
   *
   * @param property Property that owns the attribute.
   * @param type Type definition of the attribute.
   * @param container Container that stores the value.
   */
  constructor(
    property: PropertyLike,
    type: AttributeDefinition<T>,
    container: AttributeContainer,
  ) {
    this.property = property;
    this.type = type;
    this.container = container;
    this.reset();
  }

  /**
   * Resets the attribute to its default state.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:reset
   */
  reset(): void {
    this.inherited = false;
    this.provided = false;
    this._value = this.type.defaultValue;
    this.container.setStoredValue(
      this.type.id,
      deepClone(this.type.defaultValue,),
    );
  }

  /**
   * Inherits a value from the parent or the project.
   *
   * @param value Value to inherit.
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:inherit
   */
  inherit(value: T,): void {
    this.inherited = true;
    this._value = deepClone(value,);
    this.container.setStoredValue(this.type.id, deepClone(value,),);
  }

  /**
   * Sets a value for the attribute.
   *
   * @param value Value to store.
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:set
   */
  set(value: T,): void {
    switch (AttributeBase.mode) {
      case 0: // provided
        this.provided = true;
        break;
      case 1: // inherited
        this.inherited = true;
        break;
      case 2: // computed
        // no flag is marked
        break;
    }
    this._value = value;
    this.container.setStoredValue(this.type.id, value,);
  }

  /**
   * Gets the current value of the attribute.
   *
   * @returns The stored value, or `null` when unset.
   */
  get(): T | null {
    return this.container.getStoredValue(this.type.id,) as T | null;
  }

  /**
   * Gets the value as `unknown` (for serialization).
   */
  get value(): unknown {
    return this.container.getStoredValue(this.type.id,);
  }

  /**
   * Attribute type id for TJP serialization.
   *
   * Subclasses define `static readonly tjpId`. This getter exposes it through
   * the instance without repeating the class name.
   */
  protected get tjpId(): string {
    return (this.constructor as unknown as { tjpId: string }).tjpId;
  }

  /**
   * Gets the attribute id.
   */
  get id(): string {
    return this.type.id;
  }

  /**
   * Gets the attribute name.
   */
  get name(): string {
    return this.type.name;
  }

  /**
   * Checks whether the attribute is nil (null, undefined or empty array).
   *
   * @returns Whether the value is considered nil.
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:nil?
   */
  isNil(): boolean {
    const val = this.container.getStoredValue(this.type.id,);
    return val === null || val === undefined ||
      (Array.isArray(val,) && val.length === 0);
  }

  /**
   * Checks whether the attribute is a list.
   *
   * @returns Always `false` in the base class.
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:isList?
   */
  isList(): boolean {
    return false;
  }

  /**
   * Converts the value to a string.
   *
   * Ruby: `get.to_s` (AttributeBase.rb l.134-136). The text depends on the
   * **type of the value stored in Ruby**, not on the attribute: a `5d` duration
   * becomes a `Float` of slots and comes out as `144000.0`, while an integer
   * `3600` comes out as `3600` (`attributes.golden.json`). JS `Number` does not
   * carry that distinction, so the port keeps the plain numeric text — report
   * formatting comes from `Query#scaleDuration`/`scaleLoad` (with
   * `numberFormat`).
   *
   * @returns The value as text, or an empty string when unset.
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_s
   */
  to_s(): string {
    const val = this.container.getStoredValue(this.type.id,);
    return val === null ? "" : String(val,);
  }

  /**
   * Converts the value to a number.
   *
   * @returns The numeric value, or 0 when unset.
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_num
   */
  to_num(): number {
    const val = this.container.getStoredValue(this.type.id,);
    if (val === null) {
      return 0;
    }
    return Number(val,);
  }

  /**
   * Converts the value to a sorting string.
   *
   * @returns The value as text, or an empty string when unset.
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_sort
   */
  to_sort(): string {
    const val = this.container.getStoredValue(this.type.id,);
    if (val === null) {
      return "";
    }
    return String(val,);
  }

  /**
   * Converts the value to RTI (Rich Text Intermediate).
   *
   * Faithful to Ruby: only rich-text values are RTI; the others return `null`
   * (the caller — `Query.to_rti`, used by the reports — falls back to `to_s`).
   *
   * @param _query Query context (unused; kept for the Ruby signature).
   * @returns The RTI value, or `null` for non-rich-text values.
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_rti
   */
  to_rti(_query?: unknown,): unknown {
    const val = this.get();
    // Duck-typing faithful to Ruby's `is_a?(RichTextIntermediate)`: the RTI
    // carries the `richText` marker (same detection used in RichTextAttribute).
    return typeof val === "object" && val !== null && "richText" in val
      ? val
      : null;
  }

  /**
   * Converts the value to TJP (TaskJuggler format).
   *
   * Faithful port of Ruby `AttributeBase#to_tjp` (`@type.id + " " + get.to_s`).
   * Subclasses with non-scalar payloads (lists, allocations, rich text, time
   * intervals, formats, references, bookings) override to render their own
   * syntax; the base is the fallback for scalar attributes whose value already
   * stringifies through `to_s()`.
   *
   * @returns The value serialized as TJP.
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:to_tjp
   */
  to_tjp(): string {
    const value = this.get();
    return `${this.type.id} ${
      value === null || value === undefined ? "" : String(value,)
    }`;
  }

  /**
   * Returns an escaped string representation.
   *
   * @param str Text to quote; defaults to `to_s()`.
   * @returns The quoted text, using the `-8<-`/`->8-` block form when it spans
   *   several lines.
   * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb:quotedString
   */
  quotedString(str?: string,): string {
    const s = str ?? this.to_s();
    if (s.includes("\n",)) {
      return `-8<-\n${s}\n->8-`;
    }
    return `"${s.replace(/"/g, '\\"',)}"`;
  }
}
