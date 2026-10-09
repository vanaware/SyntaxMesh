import { type ProjectLike, } from "./project-like.ts";
import { type PropertyTreeNode, } from "./property-tree-node.ts";
import { AttributeDefinition, } from "../attributes/attribute-definition.ts";
import { AttributeType, } from "../attributes/attribute-type.ts";
import { TjArgumentError, } from "../attributes/errors.ts";

export class PropertySet {
  readonly _project: ProjectLike;
  readonly _flatNamespace: boolean;
  private _properties: PropertyTreeNode[];
  private _propertyMap: Map<string, PropertyTreeNode>;
  private _attributeDefinitions: Map<string, AttributeDefinition<unknown>>;

  constructor(project: ProjectLike, flatNamespace: boolean,) {
    if (project === null || project === undefined) {
      throw new TjArgumentError("project parameter may not be NIL",);
    }
    this._project = project;
    this._flatNamespace = flatNamespace;
    this._properties = [];
    this._propertyMap = new Map();
    this._attributeDefinitions = new Map();

    // Add base attributes
    this.addAttributeType(
      new AttributeDefinition(
        "id",
        "ID",
        AttributeType.String,
        "",
        false,
        false,
        false,
        false,
      ),
    );
    this.addAttributeType(
      new AttributeDefinition(
        "name",
        "Name",
        AttributeType.String,
        "",
        false,
        false,
        false,
        false,
      ),
    );
    this.addAttributeType(
      new AttributeDefinition(
        "seqno",
        "Seq. No",
        AttributeType.Integer,
        0,
        false,
        false,
        false,
        false,
      ),
    );
  }

  get project(): ProjectLike {
    return this._project;
  }

  get flatNamespace(): boolean {
    return this._flatNamespace;
  }

  get items(): number {
    return this._properties.length;
  }

  addAttributeType(attrDef: AttributeDefinition<unknown>,): void {
    if (this._properties.length > 0) {
      throw new TjArgumentError(
        "Attribute types must be defined before properties are added.",
      );
    }
    this._attributeDefinitions.set(attrDef.id, attrDef,);
  }

  eachAttributeDefinition(
    callback?: (attrDef: AttributeDefinition<unknown>,) => void,
  ): void | IterableIterator<AttributeDefinition<unknown>> {
    if (callback) {
      this._attributeDefinitions.forEach((value,) => callback(value,));
      return;
    }
    return this._attributeDefinitions.values()[Symbol.iterator]();
  }

  knownAttribute(id: string,): boolean {
    return this._attributeDefinitions.has(id,);
  }

  scenarioSpecific?(id: string,): boolean {
    if (this._attributeDefinitions.has(id,)) {
      return this._attributeDefinitions.get(id,)!.isScenarioAttribute;
    } else if (this._properties.length > 0) {
      const property = this._properties[0]!;
      if (
        property.data[0] &&
        property.data[0].a("query_" + id) !== undefined
      ) {
        return true;
      }
    }
    return false;
  }

  inheritedFromProject?(id: string,): boolean {
    if (!this._attributeDefinitions.has(id,)) {
      return false;
    }
    return this._attributeDefinitions.get(id,)!.inheritedFromProject;
  }

  inheritedFromParent?(id: string,): boolean {
    if (!this._attributeDefinitions.has(id,)) {
      return false;
    }
    return this._attributeDefinitions.get(id,)!.inheritedFromParent;
  }

  userDefined?(id: string,): boolean {
    if (!this._attributeDefinitions.has(id,)) {
      return false;
    }
    return this._attributeDefinitions.get(id,)!.userDefined;
  }

  listAttribute?(id: string,): boolean {
    const ad = this._attributeDefinitions.get(id,);
    return ad !== undefined && ad.isList;
  }

  defaultValue(id: string,): unknown {
    const ad = this._attributeDefinitions.get(id,);
    return ad !== undefined ? ad.defaultValue : undefined;
  }

  attributeName(id: string,): string | undefined {
    const ad = this._attributeDefinitions.get(id,);
    return ad !== undefined ? ad.name : undefined;
  }

  attributeType(id: string,): AttributeType | undefined {
    const ad = this._attributeDefinitions.get(id,);
    return ad !== undefined ? ad.type : undefined;
  }

  addProperty(prop: PropertyTreeNode,): void {
    this._propertyMap.set(prop.id, prop,);
    this._properties.push(prop,);
  }

  removeProperty(prop: PropertyTreeNode | string,): PropertyTreeNode {
    let property: PropertyTreeNode;
    if (typeof prop === "string") {
      property = this._propertyMap.get(prop,)!;
    } else {
      property = prop;
    }

    this._properties.forEach((p,) => {
      p.removeReferences(property,);
    },);

    while (property.children.length > 0) {
      const child = property.children[0];
      if (child) {
        this.removeProperty(child,);
      } else {
        break;
      }
    }

    this._properties = this._properties.filter((p,) => p !== property);
    this._propertyMap.delete(property.id,);

    const parent = property.parents()[0];
    if (parent) {
      const idx = parent.children.indexOf(property,);
      if (idx !== -1) {
        parent.children.splice(idx, 1,);
      }
    }

    return property;
  }

  clearProperties(): void {
    this._properties = [];
    this._propertyMap.clear();
  }

  get(id: string,): PropertyTreeNode | undefined {
    return this._propertyMap.get(id,);
  }

  index(): void {
    this._properties.forEach((p,) => {
      const bsIdcs = p.getBSIndicies();
      let bsi = "";
      let first = true;
      bsIdcs.forEach((idx,) => {
        if (first) {
          first = false;
        } else {
          bsi += ".";
        }
        bsi += idx.toString();
      },);
      p.set("bsi", bsi,);
    },);
  }

  levelSeqNo(property: PropertyTreeNode,): number {
    let seqNo = 1;
    for (const p of this._properties) {
      if (!p.parent) {
        if (p === property) {
          return seqNo;
        }
        seqNo++;
      }
    }
    throw new Error("Fatal Error: Unknown property " + property.id,);
  }

  maxDepth(): number {
    let md = 0;
    this._properties.forEach((p,) => {
      if (p.level > md) {
        md = p.level;
      }
    },);
    return md + 1;
  }

  empty(): boolean {
    return this._properties.length === 0;
  }

  topLevelItems(): number {
    let items = 0;
    this._properties.forEach((p,) => {
      if (!p.parents()[0]) {
        items++;
      }
    },);
    return items;
  }

  each(fn: (value: PropertyTreeNode,) => void,): void {
    this._properties.forEach(fn,);
  }

  toArray(): PropertyTreeNode[] {
    return [...this._properties,];
  }

  attributeDefinition(id: string,): AttributeDefinition<unknown> | undefined {
    return this._attributeDefinitions.get(id,);
  }
}
