import type { Task, } from "./task.ts";
import type { Resource, } from "./resource.ts";
import type { Material, } from "./material.ts";
import type { TjTime, } from "../time/tj-time.ts";

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
 * Diferente de `ExtendedBooking` (Fase 8.1, modelo órfão que nada no parser
 * usava): este é o modelo canônico da gramática nova e fica isolado dele, cf.
 * a pendência registrada no plano §13.7.
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
  readonly date: TjTime;
  /** Texto livre opcional identificando o gasto (Adendo Extra §12.3). */
  readonly description: string | null;

  constructor(
    owner: Resource | Material | null,
    taskRef: string | null,
    amount: number,
    date: TjTime,
    task: Task | null = null,
    description: string | null = null,
  ) {
    if (taskRef === null && task === null) {
      throw new Error("Charge booking needs a task reference",);
    }
    this.owner = owner;
    this.taskRef = taskRef;
    this.amount = amount;
    this.date = date;
    this.task = task;
    this.description = description;
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
