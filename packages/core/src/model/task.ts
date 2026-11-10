import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { TaskScenario, } from "./task-scenario.ts";
import { type Resource, } from "./resource.ts";
import { type TimeInterval, } from "../time/time-interval.ts";
import type { Booking, } from "../scheduling/booking.ts";
import type { ChargeBooking, } from "./charge-booking.ts";
import { ChargeSetCollection, } from "../finance/charge-set-collection.ts";

/**
 * A task — the unit of work the scheduler plans.
 *
 * Tasks form a hierarchy and may be leaf tasks (scheduled by the engine) or
 * containers (rolled up from their children). All time, effort and cost
 * attributes live in the per-scenario {@link TaskScenario} objects, so the same
 * task can have different dates and values in each scenario.
 */
export class Task extends PropertyTreeNode {
  private chargeset_: ChargeSetCollection;
  /**
   * Charge bookings that already produced a `CostEvent` during turnover
   * (14C.15.4). Compared by identity: bookings are immutable and turnover may run
   * several times within the same parse.
   */
  private readonly emittedChargeBookings = new Set<ChargeBooking>();

  /**
   * Creates a task and registers it in the project.
   *
   * Every scenario gets its own `TaskScenario`.
   *
   * @param project Project that owns the task.
   * @param id Explicit id, or `null` to derive one from the parent path.
   * @param name Human-readable name.
   * @param parent Parent task, or `null` at the root of the hierarchy.
   */
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

  /**
   * Typed access to the scenario data of this task.
   *
   * @param scIdx Scenario index.
   * @returns The `TaskScenario` of that scenario.
   */
  override scenarioData(scIdx: number,): TaskScenario {
    return this.data[scIdx]! as TaskScenario;
  }

  /**
   * Appends a booking to the given scenario (Ruby `TaskScenario#addBooking`).
   *
   * Bookings only apply to the scenario they were declared in.
   *
   * @param scIdx Scenario index.
   * @param booking Booking to append.
   */
  addBooking(scIdx: number, booking: Booking,): void {
    const list = this.scenarioData(scIdx,).a("booking",) as Booking[] | null;
    if (list) list.push(booking,);
  }

  /**
   * Charge bookings (`booking charge …`, Extra Addendum §12.3) of this task in
   * scenario `scIdx` — declared on the task itself, on a resource or on a
   * material.
   *
   * @param scIdx Scenario index.
   */
  chargeBookings(scIdx: number,): ChargeBooking[] {
    return (this.getForScenario("chargebookings", scIdx,) ??
      []) as ChargeBooking[];
  }

  /**
   * Whether the charge booking already produced its `CostEvent` (idempotent
   * emission).
   *
   * @param booking Charge booking to test.
   */
  chargeBookingEmitted(booking: ChargeBooking,): boolean {
    return this.emittedChargeBookings.has(booking,);
  }

  /**
   * Marks `booking` as already emitted.
   *
   * @param booking Charge booking to record.
   */
  markChargeBookingEmitted(booking: ChargeBooking,): void {
    this.emittedChargeBookings.add(booking,);
  }

  /**
   * Resources assigned to this task in scenario `scIdx`.
   *
   * For containers this is the union of the children; for leaves it is the
   * `assignedresources` attribute filled in by the scheduler. The finer
   * `Resource#allocated?` filtering is not ported in phase 7 — the attribute
   * already reflects the resources with effective bookings after scheduling.
   *
   * @param scIdx Scenario index.
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:assignedResources
   */
  assignedResources(scIdx: number,): Resource[] {
    if (this.container()) {
      const list: Resource[] = [];
      for (const kid of this.kids()) {
        for (const r of (kid as Task).assignedResources(scIdx,)) {
          if (!list.includes(r,)) list.push(r,);
        }
      }
      return list;
    }
    return (this.getForScenario("assignedresources", scIdx,) as Resource[]) ??
      [];
  }

  /**
   * Whether the resource is allocated to this task (or to one of its children)
   * over `interval`. Delegates to the scenario
   * (`TaskScenario#hasResourceAllocated`), like Ruby's `method_missing` proxy.
   *
   * @param scIdx Scenario index.
   * @param interval Interval to test.
   * @param resource Resource to test.
   * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:hasResourceAllocated?
   */
  hasResourceAllocated(
    scIdx: number,
    interval: TimeInterval,
    resource: Resource,
  ): boolean {
    return this.scenarioData(scIdx,).hasResourceAllocated(interval, resource,);
  }

  /**
   * Charge sets attached to the task.
   */
  get chargeset(): ChargeSetCollection {
    return this.chargeset_;
  }

  /**
   * Replaces the charge sets attached to the task.
   *
   * @param value New charge set collection.
   */
  set chargeset(value: ChargeSetCollection,) {
    this.chargeset_ = value;
  }

  /**
   * Precedence mode of the task charge set.
   *
   * - `'default'` (the default): rule 2 (`origin_chargeset`) applies normally.
   * - `'force'`: rule 2 is skipped and the engine falls straight through to rule
   *   3 (`task_chargeset_fallback`) or rule 4 (`project_default`).
   *
   * Only `Task` has a `chargesetMode`; `Resource` and `Material` do not.
   */
  chargesetMode: "default" | "force" = "default";

  /**
   * Model-level validation of `timebasis` (phase 10 complement C2.3).
   *
   * Milestones do not accept an explicit timebasis (`complemento2` §2.6, error
   * `timebasis_not_supported`). The full overspecification rule
   * (`task_overspecified`) is enforced by the parser (C3.4.3).
   *
   * @param value Time basis requested for the task, or `null`.
   * @throws {Error} When a milestone declares an explicit timebasis.
   */
  validateTimebasis(value: string | null,): void {
    if (
      value != null &&
      this.scenarioData(0,).a("milestone",) === true
    ) {
      throw new Error(
        `timebasis_not_supported: Milestone task '${this.id}' cannot have 'timebasis'.`,
      );
    }
  }
}
