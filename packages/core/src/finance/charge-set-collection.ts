import { TjArgumentError, } from "../attributes/errors.ts";
import { type Account, } from "../model/account.ts";
import { type CostType, } from "../model/account.ts";
import { ChargeSet, } from "./charge-set.ts";

/**
 * Coleção de charge sets para Task, Resource e Material.
 *
 * Substitui o chargeset singular do TaskJuggler por um modelo que suporta
 * múltiplos chargesets por propriedade, com validação por top-level account.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb
 */
export class ChargeSetCollection {
  private sets: Map<Account, ChargeSet>; // key = top-level account (master)

  constructor() {
    this.sets = new Map();
  }

  /**
   * Retorna o master (top-level account) do primeiro charge set na coleção.
   * Retorna null se a coleção está vazia.
   */
  get master(): Account | null {
    const firstEntry = this.sets.values().next();
    if (firstEntry.done) {
      return null;
    }
    return firstEntry.value.master;
  }

  /**
   * Adiciona um charge set à coleção.
   *
   * Regras:
   * - O set deve ter um master (charge set não vazio)
   * - Apenas um set por top-level account
   * - Todos os membros devem pertencer ao mesmo top-level account
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
   * Retorna o charge set para um top-level account específico.
   */
  forTop(top: Account,): ChargeSet | null {
    return this.sets.get(top,) ?? null;
  }

  /**
   * Resolve um charge set por tipo de custo.
   *
   * Para um determinado tipo (task, resource, material), retorna o charge set
   * apropriado. Quando chamado sem fonte, usa o primeiro (único) charge set
   * da coleção. Quando chamado com fonte, usa o chargeset da entidade
   * correspondente (task/resource/material).
   */
  forType(
    type: CostType,
    source?: { task?: unknown; resource?: unknown; material?: unknown },
  ): ChargeSet | null {
    switch (type) {
      case "task":
        // task_charge usa o chargeset da tarefa
        if (source?.task) {
          const task = source.task as unknown as {
            chargeset: ChargeSetCollection;
          };
          const master = task.chargeset.master;
          if (master === null) return null;
          return task.chargeset.forTop(master,);
        }
        // Sem fonte: usar o primeiro chargeset da coleção
        return this.first();
      case "resource":
        // resource_effort usa o chargeset da origem (resource)
        if (source?.resource) {
          const resource = source.resource as unknown as {
            chargeset: ChargeSetCollection;
          };
          const master = resource.chargeset.master;
          if (master === null) return null;
          return resource.chargeset.forTop(master,);
        }
        // Sem fonte: usar o primeiro chargeset da coleção
        return this.first();
      case "material":
        // material_usage usa o chargeset da origem (material)
        if (source?.material) {
          const material = source.material as unknown as {
            chargeset: ChargeSetCollection;
          };
          const master = material.chargeset.master;
          if (master === null) return null;
          return material.chargeset.forTop(master,);
        }
        // Sem fonte: usar o primeiro chargeset da coleção
        return this.first();
      default:
        return null;
    }
  }

  /**
   * Retorna o primeiro charge set na coleção (ou null se vazia).
   */
  private first(): ChargeSet | null {
    const firstEntry = this.sets.values().next();
    if (firstEntry.done) {
      return null;
    }
    return firstEntry.value;
  }

  /**
   * Retorna todos os charge sets na coleção.
   */
  all(): Iterable<ChargeSet> {
    return this.sets.values();
  }

  /**
   * Verifica se a coleção está vazia.
   */
  empty(): boolean {
    return this.sets.size === 0;
  }

  /**
   * Retorna o número de charge sets na coleção.
   */
  size(): number {
    return this.sets.size;
  }
}
