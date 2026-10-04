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

  constructor(ptn: PropertyTreeNode, parent: PropertyTreeNode) {
    this._ptn = ptn;
    this.parent = parent;
    this.index = parent.children.indexOf(ptn);
    this.tree = this.findTreeRoot(ptn, parent);
    this.levelCache = this.calculateLevel();
  }

  private findTreeRoot(ptn: PropertyTreeNode, parent: PropertyTreeNode): PropertyTreeNode {
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
      result = current.subId + '.' + result;
      current = current.parents()[0] as PropertyTreeNode | null;
    }
    return result;
  }

  get(attribute: string): unknown {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      return this._ptn.get(attribute);
    }
    return undefined;
  }

  set(attribute: string, value: unknown): void {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      this._ptn.set(attribute, value);
    }
  }

  getForScenario(attribute: string, scIdx: number): unknown {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      return this._ptn.getForScenario(attribute, scIdx);
    }
    return undefined;
  }

  setForScenario(attribute: string, value: unknown, scIdx: number): void {
    if (this.index >= 0 && this.tree.children[this.index] === this._ptn) {
      this._ptn.setForScenario(attribute, value, scIdx);
    }
  }

  get level(): number {
    return this.levelCache;
  }

  isChildOf(ancestor: PropertyTreeNode): boolean {
    let current: PropertyTreeNode | null = this.parent;
    while (current) {
      if (current === ancestor) {
        return true;
      }
      current = current.parents()[0] as PropertyTreeNode | null;
    }
    return false;
  }

  getIndicies(): number[] {
    const indices: number[] = [];
    let current: PropertyTreeNode | null = this._ptn;
    while (current) {
      const parent = current.parents()[0];
      if (parent && parent.propertySet.knownAttribute('index')) {
        const index = parent.get('index');
        if (index !== null && index !== undefined && index !== 0) {
          indices.unshift(index as number);
        }
      }
      current = current.parents()[0] as PropertyTreeNode | null;
    }
    return indices;
  }

  ptn(): PropertyTreeNode {
    return this._ptn;
  }

  getStoredValue(attributeId: string): unknown {
    return this._ptn.getStoredValue(attributeId);
  }

  setStoredValue(attributeId: string, value: unknown): void {
    this._ptn.setStoredValue(attributeId, value);
  }

  scenarioData(scIdx: number): ScenarioData {
    return this._ptn.scenarioData(scIdx);
  }
}