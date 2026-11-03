import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { ResourceScenario, } from "./resource-scenario.ts";
import { ChargeSetCollection, } from "../finance/charge-set-collection.ts";
import { type Task, } from "./task.ts";
import { type Booking, } from "../scheduling/booking.ts";
import { type TimeInterval, } from "../time/time-interval.ts";
import { NotYetImplementedError, } from "./errors.ts";
import type { ResourceScenarioQuery, } from "./resource-scenario.ts";

export class Resource extends PropertyTreeNode {
  private chargeset_: ChargeSetCollection;

  constructor(
    project: ProjectLike,
    id: string | null,
    name: string,
    parent: Resource | null,
  ) {
    super(project.resources, id, name, parent,);
    project.addResource(this,);
    this.chargeset_ = new ChargeSetCollection();
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new ResourceScenario(
        this,
        i,
        this.getScenarioAttributes(i,),
      );
    }
  }

  override scenarioData(scIdx: number,): ResourceScenario {
    return this.data[scIdx]! as ResourceScenario;
  }

  /**
   * Retorna o charge set do recurso.
   */
  get chargeset(): ChargeSetCollection {
    return this.chargeset_;
  }

  /**
   * Define o charge set do recurso.
   */
  set chargeset(value: ChargeSetCollection,) {
    this.chargeset_ = value;
  }

  /**
   * Retorna o esforço já alocado (booked effort) para o cenário dado.
   *
   * Corresponde a `ResourceScenario#bookedEffort` do Ruby.
   */
  bookedEffort(scIdx: number,): number {
    return this.scenarioData(scIdx,).bookedEffort();
  }

  /**
   * Retorna os bookings do recurso no cenário `scIdx`, opcionalmente limitados
   * ao intervalo `iv`. Hash por tarefa quando `hashByTask`, senão array plano.
   *
   * Envolve `ResourceScenario#getBookings` (Ruby delega via method_missing).
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getBookings
   */
  getBookings(
    scIdx: number,
    iv: TimeInterval | null = null,
    hashByTask = true,
  ): Map<Task, Booking> | Booking[] {
    return this.scenarioData(scIdx,).getBookings(iv, hashByTask,);
  }

  /**
   * O recurso (ou um dos seus filhos) está alocado a `task` no intervalo `iv`?
   * Delega ao cenário, como o `method_missing` do Ruby.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:allocated?
   */
  allocated(
    scIdx: number,
    iv: TimeInterval,
    task: Task | null = null,
  ): boolean {
    return this.scenarioData(scIdx,).allocated(iv, task,);
  }

  /**
   * Painel de status das tarefas sob responsabilidade deste recurso (Ruby
   * `Resource#query_dashboard`, l.45-47).
   */
  // Ancorado: Fase 15 — dashboard exige trackingscenario + alertas correntes.
  query_dashboard(_query: ResourceScenarioQuery,): void {
    throw new NotYetImplementedError("15", "Resource#query_dashboard",);
  }
}
