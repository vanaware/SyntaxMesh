import { type PropertyTreeNode, } from "./property-tree-node.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type AttributeContainer, } from "../attributes/attribute-container.ts";
import { ScenarioData, } from "./scenario-data.ts";

export class PTNProxy implements AttributeContainer {
  private readonly _ptn: PropertyTreeNode;
  private readonly parent: PropertyTreeNode;
  private readonly index: number;
  private readonly tree: PropertyTreeNode;
  private readonly levelCache: number;

  constructor(ptn: PropertyTreeNode, parent: PropertyTreeNode,) {
    this._ptn = ptn;
    this.parent = parent;
    this.index = parent.children.indexOf(ptn,);
    this.tree = this.findTreeRoot(ptn, parent,);
    this.levelCache = this.calculateLevel();
  }

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

  private calculateLevel(): number {
    let level = 1;
    let current: PropertyTreeNode | null = this.parent;
    while (current) {
      level++;
      current = current.parents()[0] as PropertyTreeNode | null;
    }
    return level;
  }

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

  get(attribute: string,): unknown {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      return this._ptn.get(attribute,);
    }
    return undefined;
  }

  set(attribute: string, value: unknown,): void {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      this._ptn.set(attribute, value,);
    }
  }

  getForScenario(attribute: string, scIdx: number,): unknown {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      return this._ptn.getForScenario(attribute, scIdx,);
    }
    return undefined;
  }

  setForScenario(attribute: string, value: unknown, scIdx: number,): void {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      this._ptn.setForScenario(attribute, value, scIdx,);
    }
  }

  get level(): number {
    return this.levelCache;
  }

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
   * `index` do nó real seguido dos `index` dos ancestrais adotados, da raiz
   * para o nó (Ruby `PTNProxy#getIndicies`). O proxy delega `get("index")` ao
   * nó real, como o `method_missing` do Ruby.
   */
  getIndicies(): Array<number | null> {
    const indices: Array<number | null> = [];
    const own = this.get("index",);
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

  ptn(): PropertyTreeNode {
    return this._ptn;
  }

  getStoredValue(attributeId: string,): unknown {
    return this._ptn.getStoredValue(attributeId,);
  }

  setStoredValue(attributeId: string, value: unknown,): void {
    this._ptn.setStoredValue(attributeId, value,);
  }

  scenarioData(scIdx: number,): ScenarioData {
    return this._ptn.scenarioData(scIdx,);
  }
}
