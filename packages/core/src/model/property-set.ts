import { type ProjectLike, } from "./project-like.ts";
import { type PropertyTreeNode, } from "./property-tree-node.ts";
import { AttributeDefinition, } from "../attributes/attribute-definition.ts";
import { AttributeType, } from "../attributes/attribute-type.ts";
import { TjArgumentError, } from "../attributes/errors.ts";
import { ScenarioData, } from "./scenario-data.ts";

/**
 * An ordered collection of properties of the same kind, plus the attribute
 * dictionary that describes them.
 *
 * A project owns one set per entity kind (`tasks`, `resources`, `accounts`,
 * `shifts`, `reports`, `materials`, `scenarios`). The set is both a registry
 * (id → node, via `get`) and a plain list (declaration order, via `each` and
 * `toArray`), and it is the place where attribute definitions are registered —
 * always before the first property is added.
 */
export class PropertySet {
  /** Project the set belongs to. */
  readonly _project: ProjectLike;
  /**
   * When `true`, ids are used verbatim instead of being composed with the
   * parent path.
   */
  readonly _flatNamespace: boolean;
  private _properties: PropertyTreeNode[];
  private _propertyMap: Map<string, PropertyTreeNode>;
  private _attributeDefinitions: Map<string, AttributeDefinition<unknown>>;

  /**
   * Creates an empty set and registers the three attributes every property has:
   * `id`, `name` and `seqno`.
   *
   * @param project Project the set belongs to.
   * @param flatNamespace Whether ids bypass hierarchical composition.
   * @throws {TjArgumentError} When `project` is `null`/`undefined`.
   */
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

  /** Project the set belongs to. */
  get project(): ProjectLike {
    return this._project;
  }

  /** Whether ids are flat (no parent path composition). */
  get flatNamespace(): boolean {
    return this._flatNamespace;
  }

  /** Number of properties currently in the set. */
  get items(): number {
    return this._properties.length;
  }

  /**
   * Registers an attribute definition for the whole set.
   *
   * @param attrDef Definition to register.
   * @throws {TjArgumentError} When a property was already added — definitions
   *   must be complete before the usage starts.
   */
  addAttributeType(attrDef: AttributeDefinition<unknown>,): void {
    if (this._properties.length > 0) {
      throw new TjArgumentError(
        "Attribute types must be defined before properties are added.",
      );
    }
    this._attributeDefinitions.set(attrDef.id, attrDef,);
  }

  /**
   * Iterates the attribute definitions.
   *
   * With a callback the definitions are visited in registration order; without
   * one the caller receives an iterator, which is what the `for…of` form used
   * by the parser and the report engine relies on.
   */
  eachAttributeDefinition(
    callback?: (attrDef: AttributeDefinition<unknown>,) => void,
  ): void | IterableIterator<AttributeDefinition<unknown>> {
    if (callback) {
      this._attributeDefinitions.forEach((value,) => callback(value,));
      return;
    }
    return this._attributeDefinitions.values()[Symbol.iterator]();
  }

  /** Whether `id` is a registered attribute of this set. */
  knownAttribute(id: string,): boolean {
    return this._attributeDefinitions.has(id,);
  }

  /**
   * Whether `id` holds a per-scenario value.
   *
   * Besides the registered definitions this also accepts the dynamic
   * `query_<id>` handler spread by `ScenarioData`, which the report engine uses
   * to expose computed columns as scenario attributes.
   */
  scenarioSpecific?(id: string,): boolean {
    if (this._attributeDefinitions.has(id,)) {
      return this._attributeDefinitions.get(id,)!.isScenarioAttribute;
    } else if (this._properties.length > 0) {
      const property = this._properties[0]!;
      if (
        property.data[0] &&
        property.data[0].a("query_" + id,) !== undefined
      ) {
        return true;
      }
    }
    return false;
  }

  /** Whether `id` falls back to the project value when not set locally. */
  inheritedFromProject?(id: string,): boolean {
    if (!this._attributeDefinitions.has(id,)) {
      return false;
    }
    return this._attributeDefinitions.get(id,)!.inheritedFromProject;
  }

  /** Whether `id` is inherited from the parent property. */
  inheritedFromParent?(id: string,): boolean {
    if (!this._attributeDefinitions.has(id,)) {
      return false;
    }
    return this._attributeDefinitions.get(id,)!.inheritedFromParent;
  }

  /** Whether `id` was declared by the user (and not by the built-in schema). */
  userDefined?(id: string,): boolean {
    if (!this._attributeDefinitions.has(id,)) {
      return false;
    }
    return this._attributeDefinitions.get(id,)!.userDefined;
  }

  /** Whether `id` accumulates values instead of replacing them. */
  listAttribute?(id: string,): boolean {
    const ad = this._attributeDefinitions.get(id,);
    return ad !== undefined && ad.isList;
  }

  /** Default value of `id`, or `undefined` when it is not registered. */
  defaultValue(id: string,): unknown {
    const ad = this._attributeDefinitions.get(id,);
    return ad !== undefined ? ad.defaultValue : undefined;
  }

  /** Display name of `id` (used as the column header), if registered. */
  attributeName(id: string,): string | undefined {
    const ad = this._attributeDefinitions.get(id,);
    return ad !== undefined ? ad.name : undefined;
  }

  /** Declared type of `id`, if registered. */
  attributeType(id: string,): AttributeType | undefined {
    const ad = this._attributeDefinitions.get(id,);
    return ad !== undefined ? ad.type : undefined;
  }

  /**
   * Registers a property in the set and keeps its per-scenario arrays in sync
   * with the project's scenario count.
   *
   * Scenarios may be created after some properties already exist (a scenario
   * declared later in the file), so the `data` and `scenarioAttributes` arrays
   * are extended in place instead of being replaced.
   */
  addProperty(prop: PropertyTreeNode,): void {
    this._propertyMap.set(prop.id, prop,);
    this._properties.push(prop,);

    // Resize data and scenarioAttributes arrays for the added property
    // to match the current project scenarioCount
    const scenarioCount = this._project.scenarioCount;
    if (scenarioCount > 0) {
      // Ensure data array has correct length
      if (prop.data.length !== scenarioCount) {
        const newData = Array.from(
          { length: scenarioCount, },
          (_, i,) => prop.data[i] ?? new ScenarioData(prop, i, new Map(),),
        );
        prop.data = newData;
      }

      // Ensure scenarioAttributes array has correct length
      if (prop.scenarioAttributes.length !== scenarioCount) {
        const newScenarioAttributes = Array.from(
          { length: scenarioCount, },
          (_, i,) => prop.scenarioAttributes[i] ?? new Map(),
        );
        prop.scenarioAttributes = newScenarioAttributes;
      }
    }
  }

  /**
   * Removes a property (given as node or id) together with its whole subtree.
   *
   * Every other property drops its references to the removed nodes first, so
   * adoptions and step-parent links do not keep dangling objects alive.
   *
   * @param prop Node or id to remove.
   * @returns The removed node.
   */
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

  /** Empties the set and its id index; attribute definitions are kept. */
  clearProperties(): void {
    this._properties = [];
    this._propertyMap.clear();
  }

  /** Property with the given id, or `undefined` when the set has none. */
  get(id: string,): PropertyTreeNode | undefined {
    return this._propertyMap.get(id,);
  }

  /**
   * Recomputes the `bsi` attribute (dotted structural index) of every property.
   *
   * `bsi` is the sort key of the implicit "tree order": two nodes compare by
   * their path of positions, so children stay right after their parent.
   */
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
      p.force("bsi", bsi,);
    },);
  }

  /**
   * 1-based position of a top-level property in the set.
   *
   * @throws {Error} When the property is not a top-level item of this set.
   */
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

  /** Depth of the deepest property, plus one (so an empty set is `1`). */
  maxDepth(): number {
    let md = 0;
    this._properties.forEach((p,) => {
      if (p.level > md) {
        md = p.level;
      }
    },);
    return md + 1;
  }

  /** Whether the set holds no property at all. */
  empty(): boolean {
    return this._properties.length === 0;
  }

  /** Number of properties without a parent (the roots of the hierarchy). */
  topLevelItems(): number {
    let items = 0;
    this._properties.forEach((p,) => {
      if (!p.parents()[0]) {
        items++;
      }
    },);
    return items;
  }

  /** Visits every property in declaration order. */
  each(fn: (value: PropertyTreeNode,) => void,): void {
    this._properties.forEach(fn,);
  }

  /** Snapshot of the properties, in declaration order. */
  toArray(): PropertyTreeNode[] {
    return [...this._properties,];
  }

  /** Attribute definition registered under `id`, if any. */
  attributeDefinition(id: string,): AttributeDefinition<unknown> | undefined {
    return this._attributeDefinitions.get(id,);
  }
}
