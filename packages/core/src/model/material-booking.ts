import type { Material, } from "./material.ts";
import type { Task, } from "./task.ts";
import type { ProjectLike, } from "./project-like.ts";
import type { TjTime, } from "../time/tj-time.ts";
import type { MaterialAllocation, } from "./material-allocation.ts";

/**
 * Consumo **realizado** de um material: uma quantidade consumida em uma data
 * (factual, não distribuída) com preço unitário próprio.
 *
 * Fase 14 Complemento (14C.11.3, adendo §10): o `booking` complementa a
 * `MaterialAllocation` — a alocação descreve o consumo *planejado* (dividido
 * no tempo pelo modificador), o booking registra o consumo *real* de um dia.
 *
 * Precedência do preço unitário efetivo (`unitPriceFor`), do mais específico
 * ao mais geral: booking → alocação de tarefa → material.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §11.4
 */
export class MaterialBooking {
  readonly material: Material;
  readonly quantity: number;
  /** Preço unitário real do booking (opcional: cai para alocação/material). */
  readonly unitPrice?: number;
  readonly date: TjTime;
  /** ID da tarefa dona do consumo (o objeto pode não existir no parse). */
  readonly taskId: string;
  /**
   * Tarefa resolvida. `null` enquanto a declaração da tarefa não foi lida —
   * o `booking` no corpo do material pode preceder o `task` que ele referencia
   * (referência futura). `Project#flushPendingBookings()` resolve depois.
   */
  task: Task | null;

  constructor(
    material: Material,
    taskId: string,
    quantity: number,
    date: TjTime,
    unitPrice?: number,
    task: Task | null = null,
  ) {
    if (quantity < 0) {
      throw new Error("Material booking quantity cannot be negative",);
    }
    this.material = material;
    this.taskId = taskId;
    this.quantity = quantity;
    this.date = date;
    this.unitPrice = unitPrice;
    this.task = task;
  }

  /**
   * Preço unitário efetivo: o do booking → o da alocação informada → o do
   * material (`unitprice` do bloco).
   */
  unitPriceFor(allocation?: MaterialAllocation | null,): number {
    if (this.unitPrice !== undefined) return this.unitPrice;
    if (allocation?.unitPrice !== undefined) return allocation.unitPrice;
    return this.material.unitPriceValue();
  }

  /** Custo do booking: quantidade × preço efetivo. */
  cost(allocation?: MaterialAllocation | null,): number {
    return this.quantity * this.unitPriceFor(allocation,);
  }

  /**
   * Resolve a tarefa a partir do projeto (referência futura). Devolve `true`
   * quando a tarefa passa a existir.
   */
  resolveTask(project: ProjectLike,): boolean {
    if (this.task !== null) return true;
    const task = project.task(this.taskId,);
    if (!task) return false;
    this.task = task;
    return true;
  }

  /** Cópia profunda imutável (mesmo contrato das demais alocações). */
  deepClone(): this {
    return this;
  }
}
