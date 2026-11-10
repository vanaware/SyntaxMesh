import { type PropertyLike, } from "../model/property-like.ts";
import { type AttributeContainer, } from "../attributes/attribute-container.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";
import { TjArgumentError, } from "../attributes/errors.ts";
import { type SourceFileInfo, } from "../model/property-tree-node.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";

/**
 * Role a `PropertyLike` has to play to serve as the owner of a `ScenarioData`.
 *
 * A property tree node qualifies; the guard keeps the base class usable with
 * lighter stand-ins as long as they can resolve attribute definitions.
 */
type PropertyTreeNodeLike = PropertyLike & {
  attributeDefinition(id: string,): AttributeDefinition<unknown> | undefined;
  getScenarioAttribute(
    scIdx: number,
    id: string,
  ): AttributeBase<unknown>;
};

import { type AttributeDefinition, } from "../attributes/attribute-definition.ts";

/**
 * Per-scenario state of a property.
 *
 * Every model entity keeps one `ScenarioData` per declared scenario. The class
 * is the base of `TaskScenario`, `ResourceScenario`, `AccountScenario` and the
 * rest: it holds the attribute objects that belong to the scenario, a side map
 * of raw values, and the scenario's own diagnostic channel. Scenario-specific
 * values therefore never collide with the scenario-independent ones stored on
 * the node itself.
 */
export class ScenarioData implements AttributeContainer {
  /** Property this scenario state belongs to. */
  protected property: PropertyLike;
  /** Index of the scenario this instance represents. */
  protected scenarioIdx: number;
  private attributes: Map<string, AttributeBase<unknown>>;
  private _values: Map<string, unknown>;

  /**
   * Creates the scenario state for a property.
   *
   * The attribute map passed in is kept by reference when the owning node
   * already has one for this scenario; otherwise a fresh map is created.
   *
   * @param property Property the state belongs to.
   * @param scenarioIdx Index of the scenario.
   * @param attributes Scenario attribute map of the property (accepted for API
   *   parity; the instance keeps its own map for lazily created attributes).
   */
  constructor(
    property: PropertyLike,
    scenarioIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    this.property = property;
    this.scenarioIdx = scenarioIdx;
    // Use a separate Map for attribute values to avoid conflict with scenarioAttributes
    this.attributes = new Map();
    this._values = new Map();
  }

  /** Property this scenario state belongs to. */
  getProperty(): PropertyLike {
    return this.property;
  }

  /** Index of the scenario this instance represents. */
  getScenarioIdx(): number {
    return this.scenarioIdx;
  }

  /** Attribute objects created for (or pre-loaded into) this scenario. */
  getAttributes(): Map<string, AttributeBase<unknown>> {
    return this.attributes;
  }

  /** Raw value stored outside the attribute layer, or `null`. */
  getStoredValue(attributeId: string,): unknown {
    return this._values.get(attributeId,) ?? null;
  }

  /** Stores a value outside the attribute layer. */
  setStoredValue(attributeId: string, value: unknown,): void {
    this._values.set(attributeId, value,);
  }

  /**
   * Value of an already created scenario attribute (the Ruby `a` helper).
   *
   * Returns `null` — instead of creating the attribute — when it has not been
   * materialised yet, which is what the scheduler expects while probing.
   */
  a(attributeName: string,): unknown {
    const attr = this.attributes.get(attributeName,);
    if (!attr) {
      return null;
    }
    return attr.get();
  }

  /**
   * Assembles the arguments the message handler needs.
   *
   * Mirrors `ScenarioData.rb:46-65`: the handler receives the source file info
   * (the given one, or the property's own when omitted), the carrying property
   * and the scenario at the current index. These methods used to be `console.*`
   * stubs, which is why scheduler failures (`not_scheduled`,
   * `task_underspecified`) never reached the message handler (root cause of gap
   * G1.4).
   */
  private messageArgs(
    sfi?: string | SourceFileInfo | null,
    property?: PropertyLike,
  ): [SourceFileInfo | null, unknown, unknown,] {
    const prop = (property ?? this.property) as PropertyLike & {
      sourceFileInfo?: SourceFileInfo | null;
      project?: { scenario?: (idx: number,) => unknown };
    };
    const effectiveSfi = (typeof sfi === "object" ? sfi : null) ??
      prop.sourceFileInfo ?? null;
    const scenario = prop.project?.scenario?.(this.scenarioIdx,) ?? null;
    return [effectiveSfi, property ?? this.property, scenario,];
  }

  /**
   * Reports an error in this scenario's context.
   *
   * @param id Message id (stable, translated by the message handler).
   * @param text Message text.
   * @param sfi Source location, or the property's own when omitted.
   * @param property Property the message is about.
   */
  error(
    id: string,
    text: string,
    sfi?: string | SourceFileInfo | null,
    property?: PropertyLike,
  ): void {
    const [effSfi, prop, scenario,] = this.messageArgs(sfi, property,);
    MessageHandlerInstance.instance.error(
      id,
      text,
      effSfi,
      null,
      prop,
      scenario as never,
    );
  }

  /**
   * Reports a warning in this scenario's context.
   *
   * @param id Message id.
   * @param text Message text.
   * @param sfi Source location, or the property's own when omitted.
   * @param property Property the message is about.
   */
  warning(
    id: string,
    text: string,
    sfi?: string | SourceFileInfo | null,
    property?: PropertyLike,
  ): void {
    const [effSfi, prop, scenario,] = this.messageArgs(sfi, property,);
    MessageHandlerInstance.instance.warning(
      id,
      text,
      effSfi,
      null,
      prop,
      scenario as never,
    );
  }

  /**
   * Reports an informational message in this scenario's context.
   *
   * @param id Message id.
   * @param text Message text.
   * @param sfi Source location, or the property's own when omitted.
   * @param property Property the message is about.
   */
  info(
    id: string,
    text: string,
    sfi?: string | SourceFileInfo | null,
    property?: PropertyLike,
  ): void {
    const [effSfi, prop, scenario,] = this.messageArgs(sfi, property,);
    MessageHandlerInstance.instance.info(
      id,
      text,
      effSfi,
      null,
      prop,
      scenario as never,
    );
  }

  /**
   * Returns the instance itself: scenario data is identity state, never copied.
   *
   * The values it holds belong to one node in one scenario; a copy would be a
   * second, diverging source of truth.
   */
  deepClone(): this {
    return this;
  }

  /**
   * Materialises scenario attributes up front.
   *
   * Creates each `AttributeBase` if it does not exist yet. The `*Scenario`
   * constructors use it (ADR 016) to replicate the eager instantiation the Ruby
   * implementation performs at initialisation time.
   *
   * @param ids Attribute names to pre-load.
   * @throws {TjArgumentError} When one of the names is not a known attribute.
   */
  preloadAttributes(ids: string[],): void {
    for (const id of ids) {
      // Cast to PropertyTreeNode to access attributeDefinition and getScenarioAttribute
      const propertyTreeNode = this.property as PropertyTreeNodeLike;
      const aDef = propertyTreeNode.attributeDefinition(id,);
      if (!aDef) {
        throw new TjArgumentError(`Unknown attribute '${id}'`,);
      }
      const attr = propertyTreeNode.getScenarioAttribute(
        this.scenarioIdx,
        id,
      );
      this.attributes.set(id, attr,);
    }
  }
}
