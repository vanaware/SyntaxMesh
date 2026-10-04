import { type PropertyLike, } from "../model/property-like.ts";
import { type MessageHandlerLike, } from "../model/message-handler-like.ts";
import { type AttributeContainer, } from "../attributes/attribute-container.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";
import { TjArgumentError, } from "../attributes/errors.ts";

export class ScenarioData implements AttributeContainer {
  private property: PropertyLike;
  private scenarioIdx: number;
  private attributes: Map<string, unknown>;

  constructor(property: PropertyLike, scenarioIdx: number, attributes: Map<string, unknown>) {
    this.property = property;
    this.scenarioIdx = scenarioIdx;
    // Use a separate Map for attribute values to avoid conflict with scenarioAttributes
    this.attributes = new Map();
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

  /**
   * TODO Fase 8: turnover completo.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb:turnover
   */
  turnover(startIdx: number, endIdx: number): number {
    throw new Error("NotYetImplementedError: Fase 8 - turnover");
  }

  /**
   * Pré-carrega atributos de cenário, criando cada AttributeBase
   * se ainda não existir. Usado pelos *Scenario constructors
   * (ADR 016) para replicar o comportamento do Ruby.
   */
  preloadAttributes(ids: string[]): void {
    for (const id of ids) {
      const aDef = (this.property as any).attributeDefinition(id);
      if (!aDef) {
        throw new TjArgumentError(`Unknown attribute '${id}'`);
      }
      (this.property as any).getScenarioAttribute(this.scenarioIdx, id);
    }
  }
}