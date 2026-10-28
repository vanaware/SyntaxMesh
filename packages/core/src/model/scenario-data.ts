import { type PropertyLike, } from "../model/property-like.ts";
import { type AttributeContainer, } from "../attributes/attribute-container.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";
import { TjArgumentError, } from "../attributes/errors.ts";
import { type SourceFileInfo, } from "../model/property-tree-node.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";

/**
 * Type guard to check if a PropertyLike is a PropertyTreeNode.
 * This is safe because ScenarioData is only used in Phase 4+ where
 * PropertyTreeNode exists.
 */
type PropertyTreeNodeLike = PropertyLike & {
  attributeDefinition(id: string,): AttributeDefinition<unknown> | undefined;
  getScenarioAttribute(
    scIdx: number,
    id: string,
  ): AttributeBase<unknown>;
};

import { type AttributeDefinition, } from "../attributes/attribute-definition.ts";

export class ScenarioData implements AttributeContainer {
  protected property: PropertyLike;
  protected scenarioIdx: number;
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

  /**
   * Canal de mensagens da propriedade (Fase 9 — integração com o
   * MessageHandler). Espelha `ScenarioData.rb:46-65`: o handler recebe o
   * SourceFileInfo (o argumento ou, ausente, o da própria propriedade), a
   * propriedade portadora e o cenário do índice atual. Antes estes métodos
   * eram stubs de `console.*`, o que fazia as falhas do scheduler
   * (ex.: `not_scheduled`, `task_underspecified`) nunca chegarem ao
   * MessageHandler (causa-raiz do gap G1.4).
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
