import type { Task, } from "./task.ts";
import type { Resource, } from "./resource.ts";
import type { Material, } from "./material.ts";
import type { TjTime, } from "../time/tj-time.ts";
import {
  isTemporalTail,
  legacyTail,
  valueInPeriod,
} from "./booking-period.ts";
import type { BookingTail, } from "./booking-period.ts";

/**
 * Booking de **charge** (Adendo Extra §12.3, 14C.15.4).
 *
 * `booking charge [<descrição>] [value] <montante> on <data>` registra um
 * gasto realizado (ou estornado, quando o montante é negativo) **de uma
 * tarefa**, na data informada. Quem declara pode ser a própria tarefa (sem
 * referência — o dinheiro é dela), um recurso ou um material (a referência é
 * a tarefa) — o dono da referência chama-se `owner` aqui e é `null` na forma
 * da tarefa (revisão 2026-11-02: a referência de recurso **não** é aceita; o
 * booking de charge não consome esforço e não tem ponta de recurso). A
 * `description` é um texto livre opcional (operação/identificação do gasto).
 *
 * O booking vive no atributo de cenário `chargebookings` da **tarefa**, porque
 * o dinheiro é da tarefa: a conta de destino é o chargeset dela (regra 3 de
 * `resolveAccount`) senão a conta default do projeto (regra 4), exatamente
 * como um `charge` declarado no corpo da tarefa.
 *
 * Fonte única de verdade do booking de charge: o órfão `ExtendedBooking`
 * (Fase 8.1, genérico `effort|charge|material` que nada no parser usava) foi
 * removido em 2026-11-02 — esforço e material já têm `Booking` e
 * `MaterialBooking`; o charge vive exclusivamente aqui. Ver plano §13.7.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §13.3
 */
export class ChargeBooking {
  /** Dono da referência: recurso ou material (null na forma da tarefa). */
  readonly owner: Resource | Material | null;
  /**
   * ID ou nome da tarefa dona do gasto — reservado quando a tarefa é
   * declarada depois do booking (referência futura).
   */
  readonly taskRef: string | null;
  /** Tarefa resolvida (null enquanto a referência é futura). */
  task: Task | null;
  /** Montante na moeda do projeto; negativo = estorno. */
  readonly amount: number;
  /** Âncora do booking: início do primeiro intervalo (data em `on <data>`). */
  readonly date: TjTime;
  /** Período + modifier (Onda D3): tail legado quando só a data existe. */
  readonly tail: BookingTail;
  /** Texto livre opcional identificando o gasto (Adendo Extra §12.3). */
  readonly description: string | null;

  constructor(
    owner: Resource | Material | null,
    taskRef: string | null,
    amount: number,
    date: TjTime,
    task: Task | null = null,
    description: string | null = null,
    tail?: BookingTail,
  ) {
    if (taskRef === null && task === null) {
      throw new Error("Charge booking needs a task reference",);
    }
    this.owner = owner;
    this.taskRef = taskRef;
    this.amount = amount;
    this.tail = tail ?? legacyTail(date,);
    this.date = this.tail.intervals[0]!.start;
    this.task = task;
    this.description = description;
  }

  /** O booking expressa algo além do ponto legado `on <data>`? (Onda D3) */
  isTemporal(): boolean {
    return isTemporalTail(this.tail,);
  }

  /**
   * Parte do montante que cai no período fechado `[start, end]` sob o
   * modifier do tail (Onda D3). Sem período ⇒ valor cheio; booking legado ⇒
   * valor cheio quando o ponto está no período, 0 fora.
   */
  amountInPeriod(start: TjTime | null, end: TjTime | null,): number {
    return valueInPeriod(this.amount, this.tail, start, end,);
  }

  /** Resolve a referência futura contra o projeto (true quando ligada). */
  resolveTask(project: { task(id: string,): Task | null },): boolean {
    if (this.task) return true;
    if (this.taskRef === null) return false;
    const task = project.task(this.taskRef,);
    if (!task) return false;
    this.task = task;
    return true;
  }

  /** Cópia profunda imutável — devolve `this`, como os demais bookings. */
  deepClone(): this {
    return this;
  }
}
