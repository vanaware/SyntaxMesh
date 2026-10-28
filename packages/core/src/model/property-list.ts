import { PropertyTreeNode, } from "./property-tree-node.ts";
import { PropertySet, } from "./property-set.ts";
import { SourceFileInfo, } from "../source-file-info.ts";

export class PropertyList<T extends PropertyTreeNode = PropertyTreeNode,> {
  private items: T[];
  readonly propertySet: PropertySet;
  private sortingLevels: number;
  private sortingCriteria: string[];
  private sortingUp: boolean[];
  private scenarioIdx: number[];

  constructor(arg: PropertySet | PropertyList<T>, copyItems: boolean = true,) {
    // Estado de ordenação começa zerado; o ramo de `PropertyList` pode
    // herdá-lo da lista-fonte logo abaixo (fiel a `resetSorting` do Ruby).
    this.sortingLevels = 0;
    this.sortingCriteria = [];
    this.sortingUp = [];
    this.scenarioIdx = [];

    // Ruby `PropertyList#initialize` (PropertyList.rb:37-39): os itens vêm
    // SEMPRE de `arg.to_ary` quando `copyItems` é true. Para um `PropertySet`
    // isso é o array plano de propriedades (`@properties.dup`); para outra
    // `PropertyList` é a cópia dos seus itens. Ausente esta linha o
    // `PropertyList(set)` ficava vazio e o scheduler não via nenhuma
    // task/recurso (causa-raiz da não-colocação de datas — Fase 7).
    this.items = copyItems ? (arg.toArray() as T[]) : [];

    if (arg instanceof PropertySet) {
      this.propertySet = arg;
      // Ruby: `resetSorting; addSortingCriteria('seqno', true, -1); sort!`.
      // Toda `PropertySet` define o atributo `seqno`, então o critério é
      // sempre válido e garante uma ordem determinística pré-escalonamento.
      this.addSortingCriteria("seqno", true, -1,);
      this.sort();
    } else {
      // Cria a partir de outra `PropertyList`: copia o estado de ordenação.
      this.propertySet = arg.propertySet;
      this.sortingCriteria = [...arg.sortingCriteria,];
      this.sortingUp = [...arg.sortingUp,];
      this.scenarioIdx = [...arg.scenarioIdx,];
      this.sortingLevels = arg.sortingLevels;
    }
  }

  toArray(): T[] {
    return [...this.items,];
  }

  length(): number {
    return this.items.length;
  }

  get(index: number,): T | undefined {
    return this.items[index];
  }

  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }

  includes(node: T,): boolean {
    return this.items.includes(node,);
  }

  find(predicateOrNode: ((item: T,) => boolean) | T,): T | null {
    if (typeof predicateOrNode === "function") {
      return this.items.find(predicateOrNode as (item: T,) => boolean,) ?? null;
    }
    const index = this.items.indexOf(predicateOrNode,);
    return index >= 0 ? this.items[index] ?? null : null;
  }

  push(...items: T[]): number {
    return this.items.push(...items,);
  }

  append(list: PropertyList<T> | T[],): void {
    if (list instanceof PropertyList) {
      this.items.push(...list.items,);
    } else {
      this.items.push(...list,);
    }
  }

  delete(index: number,): void {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1,);
    }
  }

  deleteIf(predicate: (item: T,) => boolean,): void {
    const indices = this.items
      .map((item, index,) => ({ item, index, }))
      .filter(({ item, },) => predicate(item,))
      .map(({ index, },) => index)
      .sort((a, b,) => b - a);

    indices.forEach((index,) => {
      this.items.splice(index, 1,);
    },);
  }

  unique(): void {
    const seen = new Set<string>();
    this.items = this.items.filter((item,) => {
      const id = item.id;
      if (seen.has(id,)) {
        return false;
      }
      seen.add(id,);
      return true;
    },);
  }

  clear(): void {
    this.items = [];
  }

  includeAdopted(): void {
    const allItems: T[] = [];
    this.items.forEach((item,) => {
      allItems.push(item,);
      allItems.push(...(item.adoptees as unknown as T[]),);
    },);
    this.items = allItems;
  }

  checkForDuplicates(sfi: SourceFileInfo,): void {
    const seen = new Set<string>();
    this.items.forEach((item,) => {
      if (seen.has(item.id,)) {
        throw new Error(`Duplicate property ID: ${item.id}`,);
      }
      seen.add(item.id,);
    },);
  }

  setSorting(modes: Array<[string, boolean, number,]>,): void {
    this.sortingCriteria = [];
    this.sortingUp = [];
    this.scenarioIdx = [];

    modes.forEach(([criteria, up, scIdx,],) => {
      this.addSortingCriteria(criteria, up, scIdx,);
    },);
  }

  addSortingCriteria(criteria: string, up: boolean, scIdx: number,): void {
    if (
      !this.propertySet.knownAttribute(criteria,) &&
      !this.hasQuery(criteria, scIdx,)
    ) {
      throw new Error(`Unknown attribute or query: ${criteria}`,);
    }

    if (this.scenarioSpecific(criteria, scIdx,) && scIdx === -1) {
      throw new Error(`Scenario-specific attribute requires scenario index`,);
    }

    this.sortingCriteria.push(criteria,);
    this.sortingUp.push(up,);
    this.scenarioIdx.push(scIdx,);
    this.sortingLevels++;
  }

  resetSorting(): void {
    this.sortingCriteria = [];
    this.sortingUp = [];
    this.scenarioIdx = [];
    this.sortingLevels = 0;
  }

  treeMode(): boolean {
    return this.sortingCriteria.length > 0 &&
      this.sortingCriteria[0] === "tree";
  }

  sort(): void {
    if (this.treeMode()) {
      this.sortTreeMode();
    } else {
      this.sortInternal();
    }
  }

  private sortTreeMode(): void {
    if (this.sortingLevels > 1) {
      this.removeFirstCriteria();
      this.sortInternal();
      this.index();
      this.indexTree();
      this.addFirstCriteria();
      this.sortInternal();
    } else {
      this.sortInternal();
    }
  }

  private removeFirstCriteria(): void {
    if (this.sortingCriteria.length > 0) {
      this.sortingCriteria.shift();
      this.sortingUp.shift();
      this.scenarioIdx.shift();
      this.sortingLevels--;
    }
  }

  private addFirstCriteria(): void {
    if (this.sortingCriteria.length === 0) {
      this.sortingCriteria.unshift("tree",);
      this.sortingUp.unshift(true,);
      this.scenarioIdx.unshift(-1,);
      this.sortingLevels++;
    }
  }

  private sortInternal(): void {
    this.items.sort((a, b,) => {
      for (let i = 0; i < this.sortingCriteria.length; i++) {
        const criteria = this.sortingCriteria[i]!;
        const up = this.sortingUp[i];
        const scIdx = this.scenarioIdx[i];

        let aValue: unknown, bValue: unknown;

        if (this.scenarioSpecific(criteria, scIdx!,)) {
          aValue = a.getForScenario(criteria, scIdx!,);
          bValue = b.getForScenario(criteria, scIdx!,);
        } else {
          aValue = a.get(criteria,);
          bValue = b.get(criteria,);
        }

        if (aValue === bValue) {
          continue;
        }

        if (aValue === null || aValue === undefined) {
          return up ? 1 : -1;
        }
        if (bValue === null || bValue === undefined) {
          return up ? -1 : 1;
        }

        if (typeof aValue === "string" && typeof bValue === "string") {
          const comparison = aValue.localeCompare(bValue,);
          return up ? comparison : -comparison;
        }

        if (typeof aValue === "number" && typeof bValue === "number") {
          return up ? aValue - bValue : bValue - aValue;
        }

        const aStr = String(aValue,);
        const bStr = String(bValue,);
        const comparison = aStr.localeCompare(bStr,);
        return up ? comparison : -comparison;
      }

      return 0;
    },);
  }

  index(): void {
    this.items.forEach((item, index,) => {
      item.set("index", index + 1,);
    },);
  }

  private indexTree(): void {
    this.items.forEach((item, index,) => {
      const bsIdcs = item.getBSIndicies();
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
      item.force("bsi", bsi,);
    },);
  }

  itemIndex(item: T,): number {
    return this.items.indexOf(item,);
  }

  private hasQuery(criteria: string, scIdx: number,): boolean {
    return false;
  }

  private scenarioSpecific(criteria: string, scIdx: number,): boolean {
    return this.propertySet.scenarioSpecific?.(criteria,) || false;
  }
}
