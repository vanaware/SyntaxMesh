import { type PropertyLike, } from "./property-like.ts";
import { type AttributeContainer, } from "../attributes/attribute-container.ts";
import { AttributeDefinition, } from "../attributes/attribute-definition.ts";
import { AttributeType, } from "../attributes/attribute-type.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type MessageHandlerLike, } from "./message-handler-like.ts";
import { AttributeBase, } from "../attributes/attribute-base.ts";
import { AttributeOverwrite, TjArgumentError, } from "../attributes/errors.ts";
import { TjInternalError, } from "./errors.ts";
import { ScenarioData, } from "./scenario-data.ts";
import { PropertySet, } from "./property-set.ts";
export { PropertySet, };

export class PropertyTreeNode implements PropertyLike, AttributeContainer {
  readonly propertySet: PropertySet;
  readonly project: ProjectLike;
  readonly subId: string;
  readonly id: string;
  readonly name: string;
  readonly sequenceNo: number;
  readonly children: PropertyTreeNode[];
  readonly adoptees: PropertyTreeNode[];
  readonly stepParents: PropertyTreeNode[];
  sourceFileInfo: SourceFileInfo | null;
  data: ScenarioData[];
  private _level: number;

  attributes: Map<string, AttributeBase<unknown>>;
  scenarioAttributes: Array<Map<string, AttributeBase<unknown>>>;
  private _parent: PropertyTreeNode | null;
  private _idProvided: boolean;
  private _values: Map<string, unknown>;

  constructor(
    propertySet: PropertySet,
    id: string | null,
    name: string,
    parent: PropertyTreeNode | null,
  ) {
    this.propertySet = propertySet;
    this.project = propertySet.project;
    this.name = name;
    this.children = [];
    this.adoptees = [];
    this.stepParents = [];
    this.sourceFileInfo = null;
    this.data = Array.from(
      { length: this.project.scenarioCount },
      (_, i) => new ScenarioData(this, i, new Map()),
    );
    this.attributes = new Map();
    this.scenarioAttributes = Array.from(
      { length: this.project.scenarioCount },
      () => new Map(),
    );
    this._level = -1;
    this._parent = parent;
    this._idProvided = id !== null;
    this._values = new Map();

    let resolvedId: string;
    if (id === null) {
      if (parent) {
        resolvedId = parent.fullId + '.' + name;
      } else {
        const tag = this.constructor.name.replace(/TaskJuggler::/, '');
        resolvedId = '_' + tag + '_' + (propertySet.items + 1).toString();
      }
    } else {
      resolvedId = id;
    }

    if (id !== null) {
      // Handle hierarchical IDs like Ruby: split at last '.'
      if (!propertySet.flatNamespace && id.includes('.')) {
        const lastDotIndex = id.lastIndexOf('.');
        this.subId = id.substring(lastDotIndex + 1);
        // Try to set parent from propertySet if parent is still null
        if (parent === null) {
          const parentId = id.substring(0, lastDotIndex);
          const parentNode = propertySet.get(parentId);
          if (parentNode) {
            this._parent = parentNode;
          }
        }
      } else {
        this.subId = id;
      }
    } else if (!propertySet.flatNamespace && resolvedId.includes('.')) {
      this.subId = resolvedId.substring(resolvedId.lastIndexOf('.') + 1);
    } else {
      this.subId = resolvedId;
    }

    this.id = this.fullId;
    this.sequenceNo = this.propertySet.items + 1;

    if (parent) {
      parent.addChild(this);
    }
    propertySet.addProperty(this);
  }

  get parent(): PropertyTreeNode | null {
    return this._parent;
  }

  get level(): number {
    if (this._level === -1) {
      let lvl = 0;
      let current: PropertyTreeNode | null = this._parent;
      while (current) {
        lvl++;
        current = current._parent;
      }
      this._level = lvl;
    }
    return this._level;
  }

  get fullId(): string {
    if (this.propertySet.flatNamespace) {
      return this.subId;
    }
    let result = this.subId;
    let current: PropertyTreeNode | null = this._parent;
    while (current) {
      result = current.subId + '.' + result;
      current = current._parent;
    }
    return result;
  }

  // Debug method
  _debugFullId(): string {
    return `subId=${this.subId}, _parent=${this._parent?.id ?? 'null'}, _idProvided=${this._idProvided}`;
  }

  logicalId(): string {
    return this.fullId;
  }

  root(): PropertyTreeNode {
    let current: PropertyTreeNode = this;
    const parent = current.parents()[0];
    if (parent) {
      return parent.root();
    }
    return current;
  }

  ancestors(includeStepParents: boolean = false): PropertyTreeNode[] {
    const nodes: PropertyTreeNode[] = [];
    if (includeStepParents) {
      this.parents().forEach(parent => {
        nodes.push(parent);
        nodes.push(...parent.ancestors(true));
      });
    } else {
      const parent = this.parents()[0];
      if (parent) {
        nodes.push(parent);
        nodes.push(...parent.ancestors(false));
      }
    }
    return nodes;
  }

  isChildOf(ancestor: PropertyTreeNode): boolean {
    const parent = this.parents()[0];
    if (parent === ancestor) {
      return true;
    }
    if (parent) {
      return parent.isChildOf(ancestor);
    }
    return false;
  }

  leaf(): boolean {
    return this.children.length === 0 && this.adoptees.length === 0;
  }

  container(): boolean {
    return this.children.length > 0 || this.adoptees.length > 0;
  }

  kids(): PropertyTreeNode[] {
    return [...this.children, ...this.adoptees];
  }

  parents(): PropertyTreeNode[] {
    const result: PropertyTreeNode[] = [];
    if (this._parent) {
      result.push(this._parent);
    }
    result.push(...this.stepParents);
    return result;
  }

  all(): PropertyTreeNode[] {
    const result: PropertyTreeNode[] = [this];
    this.kids().forEach(child => {
      result.push(...child.all());
    });
    return result;
  }

  allLeaves(withoutSelf: boolean = false): PropertyTreeNode[] {
    const result: PropertyTreeNode[] = [];
    if (this.leaf()) {
      if (!withoutSelf) {
        result.push(this);
      }
    } else {
      this.kids().forEach(child => {
        result.push(...child.allLeaves());
      });
    }
    return result;
  }

  getBSIndicies(): number[] {
    const indices: number[] = [];
    let current: PropertyTreeNode | null = this;
    while (current) {
      const parent = current._parent as PropertyTreeNode | null;
      if (parent) {
        indices.unshift(parent.levelSeqNo(current));
      } else {
        indices.unshift(this.propertySet.levelSeqNo(current));
      }
      current = parent;
    }
    return indices;
  }

  getIndicies(): number[] {
    const indices: number[] = [];
    let current: PropertyTreeNode | null = this;
    while (current) {
      const parent = current.parents()[0];
      if (parent) {
        const index = parent.get('index');
        if (index !== null && index !== undefined && index !== 0) {
          indices.unshift(index as number);
        }
      }
      current = current._parent;
    }
    return indices;
  }

  levelSeqNo(node: PropertyTreeNode): number {
    return this.children.indexOf(node) + 1;
  }

  addChild(child: PropertyTreeNode): void {
    this.children.push(child);
  }

  removeReferences(property: PropertyTreeNode): void {
    const index = this.children.indexOf(property);
    if (index !== -1) {
      this.children.splice(index, 1);
    }
    const adopteeIndex = this.adoptees.indexOf(property);
    if (adopteeIndex !== -1) {
      this.adoptees.splice(adopteeIndex, 1);
    }
    const stepParentIndex = this.stepParents.indexOf(property);
    if (stepParentIndex !== -1) {
      this.stepParents.splice(stepParentIndex, 1);
    }
  }

  getStoredValue(attributeId: string): unknown {
    return this._values.get(attributeId) ?? null;
  }

  setStoredValue(attributeId: string, value: unknown): void {
    this._values.set(attributeId, value);
  }

  attribute(id: string): AttributeBase<unknown> {
    let attr = this.attributes.get(id);
    if (attr === undefined) {
      const aDef = this.attributeDefinition(id);
      if (!aDef) {
        throw new TjArgumentError(`Unknown attribute '${id}'`);
      }
      if (aDef.isScenarioAttribute) {
        throw new TjArgumentError(`Attribute '${id}' é específico de cenário`);
      }
      attr = new aDef.objClass(this, aDef, this);
      this.attributes.set(id, attr);
    }
    return attr!;
  }

  private scenarioAttribute(scIdx: number, id: string): AttributeBase<unknown> {
    let attr = this.scenarioAttributes[scIdx]?.get(id);
    if (attr === undefined) {
      const aDef = this.attributeDefinition(id);
      if (!aDef) {
        throw new TjArgumentError(`Unknown attribute '${id}'`);
      }
      if (!aDef.isScenarioAttribute) {
        throw new TjArgumentError(`Attribute '${id}' não é específico de cenário`);
      }
      if (!this.data[scIdx]) {
        throw new TjInternalError("ScenarioData must be initialized before scenario-specific attributes");
      }
      attr = new aDef.objClass(this, aDef, this.data[scIdx]);
      if (!this.scenarioAttributes[scIdx]) {
        this.scenarioAttributes[scIdx] = new Map();
      }
      this.scenarioAttributes[scIdx].set(id, attr);
    }
    return attr!;
  }

  get(id: string): unknown {
    return this.attribute(id).get();
  }

  getAttribute(id: string, scIdx?: number): AttributeBase<unknown> {
    if (scIdx !== undefined) {
      return this.scenarioAttribute(scIdx, id);
    }
    return this.attribute(id);
  }

  /**
   * Acesso público ao atributo de cenário (para uso interno do ScenarioData).
   * Cria o AttributeBase se ainda não existir.
   */
  getScenarioAttribute(scIdx: number, id: string): AttributeBase<unknown> {
    return this.scenarioAttribute(scIdx, id);
  }

  /**
   * Retorna o Map de atributos de cenário para um scIdx (uso interno).
   */
  protected getScenarioAttributes(scIdx: number): Map<string, AttributeBase<unknown>> {
    if (!this.scenarioAttributes[scIdx]) {
      this.scenarioAttributes[scIdx] = new Map();
    }
    return this.scenarioAttributes[scIdx];
  }

  getForScenario(id: string, scIdx: number): unknown {
    return this.scenarioAttribute(scIdx, id).get();
  }

  set(id: string, value: unknown): void {
    const attr = this.attribute(id);
    const overwrite = attr.provided && !attr.isList();
    attr.set(value as never);
    if (overwrite) {
      throw new AttributeOverwrite(id);
    }
  }

  setForScenario(id: string, value: unknown, scIdx: number): void {
    if (scIdx === undefined) {
      this.set(id, value);
      return;
    }
    const attr = this.scenarioAttribute(scIdx, id);
    let overwrite = attr.provided && !attr.isList();
    if (AttributeBase.mode === 0) {
      const scenario = this.project.scenario(scIdx);
      if (scenario) {
        const allScenarios = (scenario as any).all ? (scenario as any).all() : [scenario];
        allScenarios.forEach((sc: any) => {
          const scenarioIdx = this.project.scenarioIdx(sc.fullId);
          if (scenarioIdx !== undefined) {
            const scenarioAttr = this.scenarioAttribute(scenarioIdx, id);
            if (scenarioIdx === scIdx) {
              if (scenarioAttr.provided && !scenarioAttr.isList()) {
                overwrite = true;
              }
              scenarioAttr.set(value as never);
            } else {
              scenarioAttr.inherit(value as never);
            }
          }
        });
      }
    } else {
      attr.set(value as never);
    }
    if (overwrite) {
      throw new AttributeOverwrite(id);
    }
  }

  provided(id: string, scIdx?: number): boolean {
    if (scIdx !== undefined) {
      const attr = this.scenarioAttributes[scIdx]?.get(id);
      return attr ? attr.provided : false;
    }
    const attr = this.attributes.get(id);
    return attr ? attr.provided : false;
  }

  inherited(id: string, scIdx?: number): boolean {
    if (scIdx !== undefined) {
      const attr = this.scenarioAttributes[scIdx]?.get(id);
      return attr ? attr.inherited : false;
    }
    const attr = this.attributes.get(id);
    return attr ? attr.inherited : false;
  }

  modified(id: string, scIdx?: number): boolean {
    if (scIdx !== undefined) {
      const attr = this.scenarioAttributes[scIdx]?.get(id);
      return attr ? (attr.provided || attr.inherited) : false;
    }
    const attr = this.attributes.get(id);
    return attr ? (attr.provided || attr.inherited) : false;
  }

  attributeDefinition(id: string): AttributeDefinition<unknown> | undefined {
    return this.propertySet.attributeDefinition(id);
  }

  scenarioData(scIdx: number): ScenarioData {
    return this.data[scIdx]!;
  }

  adopt(property: PropertyTreeNode): void {
    if (property === this) {
      throw new TjArgumentError("A property cannot adopt itself");
    }
    const allOfRoot = this.root().all();
    for (const leaf of property.allLeaves()) {
      if (allOfRoot.includes(leaf)) {
        throw new TjArgumentError(
          `The task '${leaf.fullId}' has already been adopted`,
        );
      }
    }
    this.adoptees.push(property);
    property.getAdopted(this);
  }

  getAdopted(property: PropertyTreeNode): void {
    if (this.stepParents.includes(property)) {
      return;
    }
    this.stepParents.push(property);
  }

  inheritAttributes(): void {
    this.propertySet.eachAttributeDefinition((attrDef) => {
      if (attrDef.isScenarioAttribute || !attrDef.inheritedFromParent) {
        return;
      }
      const aId = attrDef.id;
      const parent = this.parents()[0];
      if (parent) {
        if (parent.provided(aId) || parent.inherited(aId)) {
          this.attribute(aId).inherit(parent.get(aId) as never);
        }
      } else if (attrDef.inheritedFromProject) {
        const projectVal = this.project.get(aId);
        if (projectVal !== undefined) {
          this.attribute(aId).inherit(projectVal as never);
        }
      }
    });

    this.propertySet.eachAttributeDefinition((attrDef) => {
      if (!attrDef.isScenarioAttribute || !attrDef.inheritedFromParent) {
        return;
      }
      const aId = attrDef.id;
      for (let scIdx = 0; scIdx < this.project.scenarioCount; scIdx++) {
        const parent = this.parents()[0];
        if (parent) {
          if (parent.provided(aId, scIdx) || parent.inherited(aId, scIdx)) {
            this.scenarioAttribute(scIdx, aId).inherit(
              parent.getForScenario(aId, scIdx) as never,
            );
          }
        } else if (attrDef.inheritedFromProject) {
          const projectVal = this.project.get(aId);
          if (projectVal !== undefined && this.scenarioAttributes[scIdx]?.has(aId)) {
            this.scenarioAttribute(scIdx, aId).inherit(projectVal as never);
          }
        }
      }
    });
  }

  backupAttributes(): [Map<string, AttributeBase<unknown>>, Array<Map<string, AttributeBase<unknown>>>] {
    return [
      new Map(this.attributes),
      this.scenarioAttributes.map(m => new Map(m)),
    ];
  }

  restoreAttributes(
    backup: [Map<string, AttributeBase<unknown>>, Array<Map<string, AttributeBase<unknown>>>],
  ): void {
    this.attributes.clear();
    this.scenarioAttributes.forEach(m => m.clear());
    backup[0].forEach((value, key) => {
      this.attributes.set(key, value);
    });
    backup[1].forEach((map, scIdx) => {
      map.forEach((value, key) => {
        if (!this.scenarioAttributes[scIdx]) {
          this.scenarioAttributes[scIdx] = new Map();
        }
        this.scenarioAttributes[scIdx].set(key, value);
      });
    });
  }
}

export interface SourceFileInfo {
  file: string;
  line: number;
}