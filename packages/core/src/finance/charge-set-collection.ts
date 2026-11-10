import { TjArgumentError, } from "../attributes/errors.ts";
import { type Account, } from "../model/account.ts";
import { type CostType, } from "../model/account.ts";
import { ChargeSet, } from "./charge-set.ts";

/**
 * Collection of charge sets for Task, Resource and Material.
 *
 * Replaces TaskJuggler's singular chargeset with a model that supports
 * multiple chargesets per property, validated per top-level account.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb
 */
export class ChargeSetCollection {
  private sets: Map<Account, ChargeSet>; // key = top-level account (master)

  constructor() {
    this.sets = new Map();
  }

  /**
   * Returns the master (top-level account) of the first charge set in the
   * collection, or null when the collection is empty.
   */
  get master(): Account | null {
    const firstEntry = this.sets.values().next();
    if (firstEntry.done) {
      return null;
    }
    return firstEntry.value.master;
  }

  /**
   * Adds a charge set to the collection.
   *
   * Rules:
   * - The set must have a master (non-empty charge set)
   * - Only one set per top-level account
   * - Every member must belong to the same top-level account
   */
  add(set: ChargeSet,): void {
    const top = set.master;
    if (top === null) {
      throw new TjArgumentError("chargeset vazio",);
    }
    if (this.sets.has(top,)) {
      throw new TjArgumentError(
        `já existe chargeset para top-level ${top.id}`,
      );
    }
    this.sets.set(top, set,);
  }

  /**
   * Returns the charge set for a specific top-level account.
   */
  forTop(top: Account,): ChargeSet | null {
    return this.sets.get(top,) ?? null;
  }

  /**
   * Resolves a charge set by cost type.
   *
   * For a given type (task, resource, material) it returns the appropriate
   * charge set. When called without a source it uses the first (only) charge
   * set of the collection. When called with a source it uses the chargeset of
   * the corresponding entity (task/resource/material).
   */
  forType(
    type: CostType,
    source?: { task?: unknown; resource?: unknown; material?: unknown },
  ): ChargeSet | null {
    switch (type) {
      case "task":
        // task_charge uses the task chargeset
        if (source?.task) {
          const task = source.task as unknown as {
            chargeset: ChargeSetCollection;
          };
          const master = task.chargeset.master;
          if (master === null) return null;
          return task.chargeset.forTop(master,);
        }
        // No source: use the first chargeset of the collection
        return this.first();
      case "resource":
        // resource_effort uses the chargeset of the source (resource)
        if (source?.resource) {
          const resource = source.resource as unknown as {
            chargeset: ChargeSetCollection;
          };
          const master = resource.chargeset.master;
          if (master === null) return null;
          return resource.chargeset.forTop(master,);
        }
        // No source: use the first chargeset of the collection
        return this.first();
      case "material":
        // material_usage uses the chargeset of the source (material)
        if (source?.material) {
          const material = source.material as unknown as {
            chargeset: ChargeSetCollection;
          };
          const master = material.chargeset.master;
          if (master === null) return null;
          return material.chargeset.forTop(master,);
        }
        // No source: use the first chargeset of the collection
        return this.first();
      default:
        return null;
    }
  }

  /**
   * Returns the first charge set in the collection (or null when empty).
   */
  private first(): ChargeSet | null {
    const firstEntry = this.sets.values().next();
    if (firstEntry.done) {
      return null;
    }
    return firstEntry.value;
  }

  /**
   * Returns every charge set in the collection.
   */
  all(): Iterable<ChargeSet> {
    return this.sets.values();
  }

  /**
   * Tells whether the collection is empty.
   */
  empty(): boolean {
    return this.sets.size === 0;
  }

  /**
   * Returns the number of charge sets in the collection.
   */
  size(): number {
    return this.sets.size;
  }
}
