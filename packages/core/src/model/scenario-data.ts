import { type PropertyLike, } from "../model/property-like.ts";
import { type MessageHandlerLike, } from "../model/message-handler-like.ts";
import { type AttributeContainer, } from "../attributes/attribute-container.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";
import { TjArgumentError, } from "../attributes/errors.ts";

export class ScenarioData implements AttributeContainer {
  private property: PropertyLike;
  private scenarioIdx: number;
  private attributes: Map<string, AttributeBase<unknown>>;
  private _values: Map<string, unknown>;

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

  getProperty(): PropertyLike {
    return this.property;
  }

  getScenarioIdx(): number {
    return this.scenarioIdx;
  }

  getAttributes(): Map<string, AttributeBase<unknown>> {
    return this.attributes;
  }

  getStoredValue(attributeId: string,): unknown {
    return this._values.get(attributeId,) ?? null;
  }

  setStoredValue(attributeId: string, value: unknown,): void {
    this._values.set(attributeId, value,);
  }

  a(attributeName: string,): unknown {
    const attr = this.attributes.get(attributeName,);
    if (!attr) {
      return null;
    }
    return attr.get();
  }

  error(
    id: string,
    text: string,
    sfi?: string,
    property?: PropertyLike,
  ): void {
    // TODO: Implement MessageHandler integration
    console.error(`[${id}] ${text}`,);
  }

  warning(
    id: string,
    text: string,
    sfi?: string,
    property?: PropertyLike,
  ): void {
    // TODO: Implement MessageHandler integration
    console.warn(`[${id}] ${text}`,);
  }

  info(id: string, text: string, sfi?: string, property?: PropertyLike,): void {
    // TODO: Implement MessageHandler integration
    console.log(`[${id}] ${text}`,);
  }

  deepClone(): this {
    return this;
  }

  /**
   * Pré-carrega atributos de cenário, criando cada AttributeBase
   * se ainda não existir. Usado pelos *Scenario constructors
   * (ADR 016) para replicar o comportamento do Ruby.
   */
  preloadAttributes(ids: string[],): void {
    for (const id of ids) {
      const aDef = (this.property as any).attributeDefinition(id,);
      if (!aDef) {
        throw new TjArgumentError(`Unknown attribute '${id}'`,);
      }
      const attr = (this.property as any).getScenarioAttribute(
        this.scenarioIdx,
        id,
      );
      this.attributes.set(id, attr,);
    }
  }
}
