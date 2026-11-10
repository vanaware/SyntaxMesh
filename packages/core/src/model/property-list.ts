import { PropertyTreeNode, } from "./property-tree-node.ts";
import { PropertySet, } from "./property-set.ts";
import { SourceFileInfo, } from "../source-file-info.ts";
import type { Query, } from "../query/query.ts";
import type { AttributeType, } from "../attributes/attribute-type.ts";

/** Value with its own comparison (Ruby `<=>`), such as `TjTime`. */
type ComparableValue = { compareTo: (other: ComparableValue,) => number };

/**
 * A sortable, mutable list of properties.
 *
 * A `PropertySet` is the registry of everything declared in a project; a
 * `PropertyList` is a working selection of those properties with its own sort
 * state. Reports build one, apply the `sort`/`sortTasks` criteria, and iterate
 * the result; the scheduler uses them to walk tasks and resources in a stable
 * order.
 *
 * Sorting supports any number of criteria, each with its own direction and
 * scenario index, plus the special `tree` criterion which keeps parents above
 * their children.
 */
export class PropertyList<T extends PropertyTreeNode = PropertyTreeNode,> {
  private items: T[];
  /** Set the listed properties come from. */
  readonly propertySet: PropertySet;
  private sortingLevels: number;
  private sortingCriteria: string[];
  private sortingUp: boolean[];
  private scenarioIdx: number[];
  // Ruby's `attr_accessor :query` (PropertyList.rb). Kept for the table reports
  // (phase 14.12); the current `sort()` does not resolve criteria through it.
  /** Query the list is being built for, when there is one. */
  query: Query | null = null;

  /**
   * Creates a list from a property set or from another list.
   *
   * From a set the list starts with every property of the set, in declaration
   * order, and is immediately sorted by `seqno` — the default criterion of
   * TaskJuggler. From another list it copies both the items and the sort state,
   * which is how a report derives a sub-selection without losing the criteria.
   *
   * @param arg Set or list to start from.
   * @param copyItems When `false` the item array starts empty.
   */
  constructor(arg: PropertySet | PropertyList<T>, copyItems: boolean = true,) {
    // The sort state starts empty; the `PropertyList` branch may inherit it
    // from the source list right below (faithful to Ruby's `resetSorting`).
    this.sortingLevels = 0;
    this.sortingCriteria = [];
    this.sortingUp = [];
    this.scenarioIdx = [];

    // Ruby `PropertyList#initialize` (PropertyList.rb:37-39): the items ALWAYS
    // come from `arg.to_ary` when `copyItems` is true. For a `PropertySet`
    // that is the flat property array (`@properties.dup`); for another
    // `PropertyList` it is a copy of its items. Without this line
    // `PropertyList(set)` stayed empty and the scheduler saw no task/resource
    // (root cause of the dates never being placed — phase 7).
    this.items = copyItems ? (arg.toArray() as T[]) : [];

    if (arg instanceof PropertySet) {
      this.propertySet = arg;
      // Ruby: `resetSorting; addSortingCriteria('seqno', true, -1); sort!`.
      // Every `PropertySet` defines the `seqno` attribute, so the criterion is
      // always valid and guarantees a deterministic pre-scheduling order.
      this.addSortingCriteria("seqno", true, -1,);
      this.sort();
    } else {
      // Built from another `PropertyList`: copies the sort state.
      this.propertySet = arg.propertySet;
      this.sortingCriteria = [...arg.sortingCriteria,];
      this.sortingUp = [...arg.sortingUp,];
      this.scenarioIdx = [...arg.scenarioIdx,];
      this.sortingLevels = arg.sortingLevels;
    }
  }

  /** Snapshot of the items, in their current order. */
  toArray(): T[] {
    return [...this.items,];
  }

  /** Number of items in the list. */
  length(): number {
    return this.items.length;
  }

  /** Item at `index`, or `undefined` when out of range. */
  get(index: number,): T | undefined {
    return this.items[index];
  }

  /** Iterates the items in their current order. */
  [Symbol.iterator](): Iterator<T> {
    return this.items[Symbol.iterator]();
  }

  /** Whether `node` is in the list (by identity). */
  includes(node: T,): boolean {
    return this.items.includes(node,);
  }

  /**
   * Finds an item either by predicate or by identity.
   *
   * @param predicateOrNode Test to apply, or the node to look for.
   * @returns The matching item, or `null`.
   */
  find(predicateOrNode: ((item: T,) => boolean) | T,): T | null {
    if (typeof predicateOrNode === "function") {
      return this.items.find(predicateOrNode as (item: T,) => boolean,) ?? null;
    }
    const index = this.items.indexOf(predicateOrNode,);
    return index >= 0 ? this.items[index] ?? null : null;
  }

  /** Appends items and returns the new length. */
  push(...items: T[]): number {
    return this.items.push(...items,);
  }

  /** Appends every item of another list or of a plain array. */
  append(list: PropertyList<T> | T[],): void {
    if (list instanceof PropertyList) {
      this.items.push(...list.items,);
    } else {
      this.items.push(...list,);
    }
  }

  /** Removes the item at `index`; out-of-range indices are ignored. */
  delete(index: number,): void {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1,);
    }
  }

  /** Removes every item that satisfies `predicate`. */
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

  /** Removes duplicate entries, keeping the first occurrence of each id. */
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

  /** Removes every item from the list. */
  clear(): void {
    this.items = [];
  }

  /** Inlines the adoptees of every item right after their owner. */
  includeAdopted(): void {
    const allItems: T[] = [];
    this.items.forEach((item,) => {
      allItems.push(item,);
      allItems.push(...(item.adoptees as unknown as T[]),);
    },);
    this.items = allItems;
  }

  /**
   * Throws when two items share an id.
   *
   * @param sfi Source location reported in the (fatal) error message.
   * @throws {Error} When a duplicate id is found.
   */
  checkForDuplicates(sfi: SourceFileInfo,): void {
    const seen = new Set<string>();
    this.items.forEach((item,) => {
      if (seen.has(item.id,)) {
        throw new Error(`Duplicate property ID: ${item.id}`,);
      }
      seen.add(item.id,);
    },);
  }

  /**
   * Replaces the whole sort state.
   *
   * @param modes One `[criteria, up, scenarioIdx]` triple per level, most
   *   significant first.
   */
  setSorting(modes: Array<[string, boolean, number,]>,): void {
    this.sortingCriteria = [];
    this.sortingUp = [];
    this.scenarioIdx = [];

    modes.forEach(([criteria, up, scIdx,],) => {
      this.addSortingCriteria(criteria, up, scIdx,);
    },);
  }

  /**
   * Appends one sort level.
   *
   * @param criteria Attribute name, `query_*` name, or `tree`.
   * @param up `true` for ascending, `false` for descending.
   * @param scIdx Scenario to read scenario-specific attributes from; `-1` when
   *   the attribute is scenario independent.
   * @throws {Error} When the criterion is unknown, or when a scenario-specific
   *   attribute is used without a scenario index.
   */
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

  /** Drops every sort criterion, leaving the items untouched. */
  resetSorting(): void {
    this.sortingCriteria = [];
    this.sortingUp = [];
    this.scenarioIdx = [];
    this.sortingLevels = 0;
  }

  /** Whether the first criterion is the special `tree` mode. */
  treeMode(): boolean {
    return this.sortingCriteria.length > 0 &&
      this.sortingCriteria[0] === "tree";
  }

  /** Type of the `id` attribute in the list's property set, if declared. */
  attributeType(id: string,): AttributeType | undefined {
    return this.propertySet.attributeType(id,);
  }

  /**
   * Ruby's public `scenarioSpecific?(attr)`: whether `id` holds per-scenario
   * values. (The private sorting predicate answers the same question for a
   * given scenario index.)
   */
  attributeIsScenarioSpecific(id: string,): boolean {
    return this.propertySet.scenarioSpecific?.(id,) ?? false;
  }

  /**
   * Sorts the list, in tree mode when the first criterion is `tree` and in flat
   * mode otherwise, then recomputes the `index` attribute in the final order.
   *
   * `MspXmlRE` depends on those indices to derive the 1..n UIDs of tasks and
   * resources, so the recalculation is part of sorting, not an extra step.
   */
  sort(): void {
    if (this.treeMode()) {
      this.sortTreeMode();
    } else {
      this.sortInternal();
    }
    // Ruby (PropertyList.rb:sort!): after sorting, the 'index' attributes are
    // recomputed in the final order. `MspXmlRE` relies on this to derive the
    // UIDs (1..n) of tasks/resources.
    this.index();
  }

  /**
   * Tree-mode sorting (Ruby `PropertyList#sort!`).
   *
   * The `tree` criterion is removed, the flat list is sorted by the remaining
   * criteria, that order is propagated to the `tree` attribute (through
   * `index` → `indexTree`) and the list is sorted by `tree`. The final re-sort
   * is what guarantees "parent before children, siblings in the order of the
   * other criteria"; without it the list stays in the flat order (by `start`,
   * for instance) and the tree structure is lost.
   */
  private sortTreeMode(): void {
    this.removeFirstCriteria();
    this.sortInternal();
    this.index();
    this.indexTree();
    this.addFirstCriteria();
    this.sortInternal();
  }

  /** Removes the most significant sort level. */
  private removeFirstCriteria(): void {
    if (this.sortingCriteria.length > 0) {
      this.sortingCriteria.shift();
      this.sortingUp.shift();
      this.scenarioIdx.shift();
      this.sortingLevels--;
    }
  }

  /** Puts the `tree` criterion back as the most significant level. */
  private addFirstCriteria(): void {
    this.sortingCriteria.unshift("tree",);
    this.sortingUp.unshift(true,);
    this.scenarioIdx.unshift(-1,);
    this.sortingLevels++;
  }

  /**
   * Comparator applying every sort level in turn.
   *
   * Values are compared by type: strings with `localeCompare`, numbers by
   * subtraction, and objects exposing `compareTo` (such as `TjTime`) through
   * that method — comparing a timestamp as text would tie tasks that start on
   * the same day at different hours and change the report order.
   */
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

        // Comparable objects (`TjTime` and derivatives): Ruby uses
        // `aVal <=> bVal`. Without this the string fallback would compare only
        // the date part of a `TjTime`, tying tasks that start on the same day
        // at different hours — and the tie-break ended up changing the report
        // order.
        const aCmp = aValue as unknown as ComparableValue;
        const bCmp = bValue as unknown as ComparableValue;
        if (
          typeof aCmp.compareTo === "function" &&
          typeof bCmp.compareTo === "function"
        ) {
          const comparison = aCmp.compareTo(bCmp,);
          return up ? comparison : -comparison;
        }

        const aStr = String(aValue,);
        const bStr = String(bValue,);
        const comparison = aStr.localeCompare(bStr,);
        return up ? comparison : -comparison;
      }

      return 0;
    },);
  }

  /**
   * Stores the 1-based position of every item in the `index` attribute.
   *
   * Items without an `index` definition (test doubles, for instance) are
   * skipped instead of raising `TjArgumentError` every time the list is sorted.
   */
  index(): void {
    this.items.forEach((item, index,) => {
      // `index` is defined on Task/Resource (and the derivatives used by the
      // reports); nodes without the attribute (e.g. the `TestProperty` of the
      // tests) are skipped instead of raising `TjArgumentError` while sorting.
      if (!item.attributeDefinition("index",)) return;
      // Ruby uses `force`: the index is recomputed on every sort.
      item.force("index", index + 1,);
    },);
  }

  /**
   * Propagates the current list order to the `tree` attribute.
   *
   * The `index` of the item and of each ancestor is concatenated as a 6-digit
   * field (Ruby `PropertyList#indexTree`), so sorting by `tree` puts every
   * parent before its children while keeping siblings in the current order.
   */
  private indexTree(): void {
    this.items.forEach((item,) => {
      let tree = "";
      for (const idx of item.getIndicies()) {
        // Ruby: `nil.to_s` → "" → zero-padded.
        tree += String(idx ?? "",).padStart(6, "0",);
      }
      item.force("tree", tree,);
    },);
  }

  /** Position of `item` in the list, or `-1` when absent. */
  itemIndex(item: T,): number {
    return this.items.indexOf(item,);
  }

  /**
   * Whether `criteria` names a `query_*` handler.
   *
   * Always `false` today: the Ruby code accepts report queries as sort
   * criteria, but `sort()` still resolves criteria through attributes only.
   * The hook exists so callers can be validated against the final behaviour.
   */
  private hasQuery(criteria: string, scIdx: number,): boolean {
    return false;
  }

  /** Whether `criteria` holds per-scenario values in this list's property set. */
  private scenarioSpecific(criteria: string, scIdx: number,): boolean {
    return this.propertySet.scenarioSpecific?.(criteria,) || false;
  }
}
