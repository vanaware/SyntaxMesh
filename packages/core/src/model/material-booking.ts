import type { Material, } from "./material.ts";
import type { Task, } from "./task.ts";
import type { ProjectLike, } from "./project-like.ts";
import type { TjTime, } from "../time/tj-time.ts";
import type { MaterialAllocation, } from "./material-allocation.ts";
import {
  isTemporalTail,
  legacyTail,
  tailOverlaps,
  valueInPeriod,
} from "./booking-period.ts";
import type { BookingTail, } from "./booking-period.ts";

/**
 * Consumo **realizado** de um material: uma quantidade consumida em uma data
 * (factual, não distribuída) com preço unitário próprio.
 *
 * Fase 14 Complemento (14C.11.3, adendo §10): o `booking` complementa a
 * `MaterialAllocation` — a alocação descreve o consumo *planejado* (dividido
 * no tempo pelo modificador), o booking registra o consumo *real* de um dia.
 *
 * Fase 14 Complemento (14C.13.1, Adendo Extra §12): dois papéis do mesmo
 * verbo. Com tarefa (`taskId` presente) o booking é consumo realizado e a
 * quantidade é **sempre positiva**. Sem tarefa (`taskId === null`) o booking é
 * movimento de **estoque**: entrada (positiva) ou saída/estorno (negativa) —
 * único caso em que quantidade negativa é admitida.
 *
 * Precedência do preço unitário efetivo (`unitPriceFor`), do mais específico
 * ao mais geral: booking → alocação de tarefa → material.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §11.4, §13.1
 */
export class MaterialBooking {
  readonly material: Material;
  readonly quantity: number;
  /** Preço unitário real do booking (opcional: cai para alocação/material). */
  readonly unitPrice?: number;
  /** Âncora do booking: início do primeiro intervalo (data em `on <data>`). */
  readonly date: TjTime;
  /** Período + modifier (Onda D3): tail legado quando só a data existe. */
  readonly tail: BookingTail;
  /**
   * ID da tarefa dona do consumo; `null` nos bookings de estoque (sem tarefa,
   * 14C.13.1). O objeto pode ainda não existir no parse (referência futura).
   */
  readonly taskId: string | null;
  /**
   * Tarefa resolvida. `null` enquanto a declaração da tarefa não foi lida —
   * o `booking` no corpo do material pode preceder o `task` que ele referencia
   * (referência futura). `Project#flushPendingBookings()` resolve depois.
   */
  task: Task | null;

  constructor(
    material: Material,
    taskId: string | null,
    quantity: number,
    date: TjTime,
    unitPrice?: number,
    task: Task | null = null,
    tail?: BookingTail,
  ) {
    // Quantidade negativa só faz sentido como saída de estoque (sem tarefa).
    if (quantity < 0 && taskId !== null) {
      throw new Error(
        "Material booking quantity cannot be negative for a task",
      );
    }
    this.material = material;
    this.taskId = taskId;
    this.quantity = quantity;
    this.tail = tail ?? legacyTail(date,);
    this.date = this.tail.intervals[0]!.start;
    this.unitPrice = unitPrice;
    this.task = task;
  }

  /** O booking expressa algo além do ponto legado `on <data>`? (Onda D3) */
  isTemporal(): boolean {
    return isTemporalTail(this.tail,);
  }

  /** Algum intervalo do tail cruza o período fechado `[start, end]`? */
  overlapsPeriod(start: TjTime | null, end: TjTime | null,): boolean {
    return tailOverlaps(this.tail, start, end,);
  }

  /**
   * Parte da quantidade que cai no período fechado `[start, end]` sob o
   * modifier do tail (Onda D3). Legado/sem período ⇒ quantidade cheia.
   */
  quantityInPeriod(start: TjTime | null, end: TjTime | null,): number {
    return valueInPeriod(this.quantity, this.tail, start, end,);
  }

  /** Booking de estoque (movimento de entrada/saída sem tarefa, 14C.13.1). */
  isInventory(): boolean {
    return this.taskId === null;
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
   * Custo do booking restringido ao período fechado `[start, end]` (Onda D3):
   * quantidade distribuída pelo modifier × preço efetivo.
   */
  costInPeriod(
    start: TjTime | null,
    end: TjTime | null,
    allocation?: MaterialAllocation | null,
  ): number {
    return this.quantityInPeriod(start, end,) * this.unitPriceFor(allocation,);
  }

  /**
   * Resolve a tarefa a partir do projeto (referência futura). Devolve `true`
   * quando a tarefa passa a existir — ou quando o booking é de estoque (sem
   * tarefa para resolver, 14C.13.1).
   */
  resolveTask(project: ProjectLike,): boolean {
    if (this.taskId === null) return true;
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
