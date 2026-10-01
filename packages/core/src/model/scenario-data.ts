import { type PropertyLike, } from "../model/property-like.ts";
import { type MessageHandlerLike, } from "../model/message-handler-like.ts";
import { type AttributeContainer, } from "../attributes/attribute-container.ts";

export class ScenarioData implements AttributeContainer {
  private property: PropertyLike;
  private scenarioIdx: number;
  private attributes: Map<string, unknown>;

  constructor(property: PropertyLike, scenarioIdx: number, attributes: Map<string, unknown>) {
    this.property = property;
    this.scenarioIdx = scenarioIdx;
    this.attributes = attributes;
  }

  getProperty(): PropertyLike {
    return this.property;
  }

  getScenarioIdx(): number {
    return this.scenarioIdx;
  }

  getAttributes(): Map<string, unknown> {
    return this.attributes;
  }

  getStoredValue(attributeId: string): unknown {
    return this.attributes.get(attributeId);
  }

  setStoredValue(attributeId: string, value: unknown): void {
    this.attributes.set(attributeId, value);
  }

  a(attributeName: string): unknown {
    return this.attributes.get(attributeName);
  }

  error(id: string, text: string, sfi?: string, property?: PropertyLike): void {
    // TODO: Implement MessageHandler integration
    console.error(`[${id}] ${text}`);
  }

  warning(id: string, text: string, sfi?: string, property?: PropertyLike): void {
    // TODO: Implement MessageHandler integration
    console.warn(`[${id}] ${text}`);
  }

  info(id: string, text: string, sfi?: string, property?: PropertyLike): void {
    // TODO: Implement MessageHandler integration
    console.log(`[${id}] ${text}`);
  }

  deepClone(): this {
    return this;
  }
}