import { type PropertyTreeNode, } from "./property-tree-node.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type AttributeContainer, } from "../attributes/attribute-container.ts";
import { ScenarioData, } from "./scenario-data.ts";

/**
 * Read/write view of a property as seen from a different parent.
 *
 * The Ruby `PTNProxy` exists for report queries that walk an entity from
 * outside its own tree: the proxy carries the path (parent, index, root) so
 * `logicalId`, `level`, `getIndicies` and `isChildOf` answer relative to that
 * vantage point, while the attribute access is still forwarded to the real
 * node. Forwarding only happens while the node is still a child of its original
 * parent at that index — once the tree changes the proxy stops reading and
 * writing rather than mutating a node it no longer describes.
 */
export class PTNProxy implements AttributeContainer {
  private readonly _ptn: PropertyTreeNode;
  private readonly parent: PropertyTreeNode;
  private readonly index: number;
  private readonly tree: PropertyTreeNode;
  private readonly levelCache: number;

  /**
   * Creates a proxy for `ptn` under `parent`.
   *
   * Both the level and the tree root are computed once here, because they are
   * queried far more often than the hierarchy changes.
   *
   * @param ptn Node being proxied.
   * @param parent Parent the node is observed from.
   */
  constructor(ptn: PropertyTreeNode, parent: PropertyTreeNode,) {
    this._ptn = ptn;
    this.parent = parent;
    this.index = parent.children.indexOf(ptn,);
    this.tree = this.findTreeRoot(ptn, parent,);
    this.levelCache = this.calculateLevel();
  }

  /** Root of the hierarchy that contains the proxied node. */
  private findTreeRoot(
    ptn: PropertyTreeNode,
    parent: PropertyTreeNode,
  ): PropertyTreeNode {
    let current: PropertyTreeNode = ptn;
    while (current.parents()[0]) {
      current = current.parents()[0] as PropertyTreeNode;
    }
    return current;
  }

  /** Depth of the proxied node, counting from its parent up to the root. */
  private calculateLevel(): number {
    let level = 1;
    let current: PropertyTreeNode | null = this.parent;
    while (current) {
      level++;
      current = current.parents()[0] as PropertyTreeNode | null;
    }
    return level;
  }

  /** Id of the proxied node as a path relative to the proxy's parent. */
  logicalId(): string {
    if (this._ptn.propertySet.flatNamespace) {
      return this._ptn.id;
    }
    let result = this._ptn.subId;
    let current: PropertyTreeNode | null = this.parent;
    while (current) {
      result = current.subId + "." + result;
      current = current.parents()[0] as PropertyTreeNode | null;
    }
    return result;
  }

  /** Value of a scenario-independent attribute, forwarded to the node. */
  get(attribute: string,): unknown {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      return this._ptn.get(attribute,);
    }
    return undefined;
  }

  /** Writes a scenario-independent attribute on the node. */
  set(attribute: string, value: unknown,): void {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      this._ptn.set(attribute, value,);
    }
  }

  /** Value of an attribute in a given scenario, forwarded to the node. */
  getForScenario(attribute: string, scIdx: number,): unknown {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      return this._ptn.getForScenario(attribute, scIdx,);
    }
    return undefined;
  }

  /** Writes an attribute of a given scenario on the node. */
  setForScenario(attribute: string, value: unknown, scIdx: number,): void {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      this._ptn.setForScenario(attribute, value, scIdx,);
    }
  }

  /** Depth of the proxied node, cached at construction time. */
  get level(): number {
    return this.levelCache;
  }

  /** Whether the proxied node descends from `ancestor`. */
  isChildOf(ancestor: PropertyTreeNode,): boolean {
    let current: PropertyTreeNode | null = this.parent;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      current = current.parents()[0] as PropertyTreeNode | null;
    }
    return false;
  }

  /**
   * `index` values of the proxied node and of its ancestors, root first.
   *
   * The proxy delegates `get("index")` to the real node, as the Ruby
   * `method_missing` does. Nodes without the `index` attribute (test doubles,
   * for instance) contribute `null` instead of raising `TjArgumentError`.
   */
  getIndicies(): Array<number | null> {
    const indices: Array<number | null> = [];
    // Same tolerance as `PropertyTreeNode#getIndicies`: nodes without the
    // `index` attribute (e.g. the tests' `TestProperty`) contribute `null`
    // instead of blowing up `TjArgumentError` when delegating `get('index')`.
    const own = this.ptn().attributeDefinition("index",)
      ? this.get("index",)
      : null;
    indices.push(typeof own === "number" ? own : null,);
    let current = this.parent as PropertyTreeNode | null;
    while (current) {
      const index = current.attributeDefinition("index",)
        ? current.get("index",)
        : null;
      indices.unshift(typeof index === "number" ? index : null,);
      current = (current.parents()[0] as PropertyTreeNode | undefined) ?? null;
    }
    return indices;
  }

  /** Real node behind the proxy (Ruby `PTNProxy#ptn`). */
  ptn(): PropertyTreeNode {
    return this._ptn;
  }

  /** Raw value stored outside the attribute layer. */
  getStoredValue(attributeId: string,): unknown {
    return this._ptn.getStoredValue(attributeId,);
  }

  /** Stores a value outside the attribute layer. */
  setStoredValue(attributeId: string, value: unknown,): void {
    this._ptn.setStoredValue(attributeId, value,);
  }

  /** Scenario data of the proxied node. */
  scenarioData(scIdx: number,): ScenarioData {
    return this._ptn.scenarioData(scIdx,);
  }
}
