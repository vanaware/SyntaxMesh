import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { TaskScenario, } from "./task-scenario.ts";
import type { Booking, } from "../scheduling/booking.ts";
import { ChargeSetCollection, } from "../finance/charge-set-collection.ts";

export class Task extends PropertyTreeNode {
  private chargeset_: ChargeSetCollection;

  constructor(
    project: ProjectLike,
    id: string | null,
    name: string,
    parent: Task | null,
  ) {
    super(project.tasks, id, name, parent,);
    project.addTask(this,);
    this.chargeset_ = new ChargeSetCollection();
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new TaskScenario(this, i, this.getScenarioAttributes(i,),);
    }
  }

  override scenarioData(scIdx: number,): TaskScenario {
    return this.data[scIdx]! as TaskScenario;
  }

  /**
   * Registra um booking no cenário indicado (Ruby TaskScenario#addBooking).
   * Bookings valem apenas para o cenário onde foram definidos.
   */
  addBooking(scIdx: number, booking: Booking,): void {
    const list = this.scenarioData(scIdx,).a("booking",) as Booking[] | null;
    if (list) list.push(booking,);
  }

  /**
   * Retorna o charge set da tarefa.
   */
  get chargeset(): ChargeSetCollection {
    return this.chargeset_;
  }

  /**
   * Define o charge set da tarefa.
   */
  set chargeset(value: ChargeSetCollection,) {
    this.chargeset_ = value;
  }

  /**
   * Modo de precedência do chargeset da tarefa.
   *
   * - `'default'` (padrão): regra 2 (origin_chargeset) é aplicada normalmente.
   * - `'force'`: regra 2 é ignorada; o motor cai diretamente na regra 3
   *   (task_chargeset_fallback) ou regra 4 (project_default).
   *
   * Apenas Task possui `chargesetMode`. Resource e Material não têm.
   */
  chargesetMode: "default" | "force" = "default";
}
