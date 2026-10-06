import { ScenarioData, } from "./scenario-data.ts";
import { ShiftAssignments, } from "../scheduling/shift-assignments.ts";
import { WorkingHours, } from "../calendar/working-hours.ts";

/**
 * Lista exata de atributos pré-carregados pelo ResourceScenario do Ruby
 * (ResourceScenario.rb, linhas 42–56).
 */
export const RESOURCE_SCENARIO_ATTRS: string[] = [
  "alloctdeffort",
  "chargeset",
  "criticalness",
  "directreports",
  "duties",
  "efficiency",
  "effort",
  "limits",
  "managers",
  "rate",
  "reports",
  "shifts",
  "leaves",
  "leaveallowances",
  "workinghours",
];

export class ResourceScenario extends ScenarioData {
  /**
   * Returns true if the resource is available at the time specified by
   * _sbIdx_.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:available?
   */
  available(sbIdx: number): boolean {
    // TODO: Implement scoreboard and limits check
    return true;
  }

  /**
   * Returns true if the resource is booked for a tasks at the time specified by
   * _sbIdx_.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:booked?
   */
  booked?(sbIdx: number): boolean {
    // TODO: Implement scoreboard check
    return false;
  }

  /**
   * Return the Task that this resource is booked for at the time specified
   * by _sbIdx_. If not booked to a task, nil is returned.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:bookedTask
   */
  bookedTask(sbIdx: number): any {
    // TODO: Implement scoreboard check
    return null;
  }

  /**
   * Book the slot indicated by the scoreboard index +sbIdx+ for Task +task+.
   * If +force+ is true, overwrite the existing booking for this slot. The
   * method returns true if the slot was available.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:book
   */
  book(sbIdx: number, task: any, force: boolean = false): boolean {
    // TODO: Implement booking logic
    return true;
  }

  /**
   * Register the user provided bookings with the Resource scoreboards. A
   * booking describes the assignment of a Resource to a certain Task for a
   * specified TimeInterval.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:bookBooking
   */
  bookBooking(sbIdx: number, booking: any): boolean {
    // TODO: Implement booking logic
    return true;
  }

  /**
   * Returns the number of leave days for the period described by _startIdx_
   * and _endIdx_ for the given _type_ of leave.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getLeave
   */
  getLeave(startIdx: number, endIdx: number, type: any): number {
    // TODO: Implement leave calculation
    return 0;
  }

  /**
   * Returns the work of the resource (and its children) weighted by their
   * efficiency. If _task_ is provided, only the work for this task and all
   * its sub tasks are being counted.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getEffectiveWork
   */
  getEffectiveWork(startIdx: number, endIdx: number, task: any = null): number {
    // TODO: Implement effective work calculation
    return 0;
  }

  /**
   * Returns the allocated accumulated time of this resource and its children.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getAllocatedTime
   */
  getAllocatedTime(startIdx: number, endIdx: number, task: any = null): number {
    // TODO: Implement allocated time calculation
    return 0;
  }

  /**
   * Return the unallocated work time (in seconds) of the resource and its
   * children.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getEffectiveFreeTime
   */
  getEffectiveFreeTime(startIdx: number, endIdx: number): number {
    // TODO: Implement free time calculation
    return 0;
  }

  /**
   * Return the unallocated work of the resource and its children weighted by
   * their efficiency.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getEffectiveFreeWork
   */
  getEffectiveFreeWork(startIdx: number, endIdx: number): number {
    // TODO: Implement free work calculation
    return 0;
  }

  /**
   * Return the number of working days that are blocked by leaves.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getTimeOffDays
   */
  getTimeOffDays(startIdx: number, endIdx: number): number {
    // TODO: Implement time off days calculation
    return 0;
  }

  /**
   * Returns the first booked slot index for this resource.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:firstBookedSlot
   */
  getMinSlot(): number | null {
    // TODO: Implement min slot calculation
    return null;
  }

  /**
   * Returns the last booked slot index for this resource.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:lastBookedSlot
   */
  getMaxSlot(): number | null {
    // TODO: Implement max slot calculation
    return null;
  }
}