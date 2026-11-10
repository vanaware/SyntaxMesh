import { TjArgumentError, } from "../attributes/errors.ts";
import { ShiftAssignments, } from "./shift-assignments.ts";
import { Resource, } from "../model/resource.ts";

/**
 * Candidate selection modes used when allocating resources.
 *
 * Mirrors Ruby's `Allocation#setSelectionMode`:
 * 0 : 'order'        — selects in list order
 * 1 : 'minallocated' — selects the candidate least likely to be allocated
 * 2 : 'minloaded'    — selects the candidate with the lowest allocated load
 * 3 : 'maxloaded'    — selects the candidate with the highest allocated load
 * 4 : 'random'       — selects a random candidate
 *
 * Ruby source: `docs/taskjuggler/lib/taskjuggler/Allocation.rb`
 */
export enum SelectionMode {
  /** Selects candidates in declaration order. */
  Order = 0,
  /** Selects the candidate least likely to be allocated. */
  MinAllocated = 1,
  /** Selects the candidate with the lowest allocated load. */
  MinLoaded = 2,
  /** Selects the candidate with the highest allocated load. */
  MaxLoaded = 3,
  /** Selects a random candidate. */
  Random = 4,
}

/**
 * Describes how resources are allocated to a task.
 *
 * Each `Allocation` holds a non-empty list of candidate resources. For every
 * time slot, a candidate is selected when one is available. `selectionMode`
 * controls the order in which resources are checked for availability; the first
 * available one wins.
 *
 * Ruby source: `docs/taskjuggler/lib/taskjuggler/Allocation.rb`
 */
export class Allocation {
  /** Resources eligible for this allocation, in declaration order. */
  readonly candidates: Resource[];
  /** Strategy used to order the candidates on every slot. */
  selectionMode: SelectionMode;
  /** `true` when every candidate must be allocated at once. */
  atomic: boolean;
  /** `true` when the chosen candidate stays locked for later slots. */
  persistent: boolean;
  /** `true` when the allocation must always produce a booking. */
  mandatory: boolean;
  /** Shifts the allocation is restricted to, or `null` for any shift. */
  shifts: ShiftAssignments | null;
  /** Candidate locked by a previous `persistent` selection. */
  lockedResource: Resource | null;
  /** Cached candidate order, valid while `MinAllocated` is not persistent. */
  protected staticCandidates: Resource[] | null;

  /**
   * Creates an allocation.
   *
   * @param candidates Non-empty list of eligible resources.
   * @param selectionMode Strategy used to order the candidates.
   * @param persistent `true` to keep the chosen candidate locked.
   * @param mandatory `true` to require a booking on every slot.
   * @param atomic `true` to allocate every candidate at once.
   * @throws TjArgumentError When `candidates` is empty.
   */
  constructor(
    candidates: Resource[],
    selectionMode: SelectionMode = SelectionMode.MinAllocated,
    persistent: boolean = false,
    mandatory: boolean = false,
    atomic: boolean = false,
  ) {
    if (candidates.length === 0) {
      throw new TjArgumentError(
        "Allocation candidates list must contain at least one resource",
      );
    }
    this.candidates = candidates;
    this.selectionMode = selectionMode;
    this.atomic = atomic;
    this.persistent = persistent;
    this.mandatory = mandatory;
    this.shifts = null;
    this.lockedResource = null;
    this.staticCandidates = null;
  }

  /**
   * Sets the selection mode by name.
   *
   * @param str One of `order`, `minallocated`, `minloaded`, `maxloaded`,
   * `random`.
   * @throws TjArgumentError When the mode is not recognised.
   */
  setSelectionMode(str: string,): void {
    const modes = [
      "order",
      "minallocated",
      "minloaded",
      "maxloaded",
      "random",
    ];
    const idx = modes.indexOf(str,);
    if (idx === -1) {
      throw new TjArgumentError(`Unknown selection mode ${str}`,);
    }
    this.selectionMode = idx as SelectionMode;
  }

  /**
   * Appends another candidate to the candidate list.
   *
   * @param candidate Resource to add.
   */
  addCandidate(candidate: Resource,): void {
    this.candidates.push(candidate,);
  }

  /**
   * Tells whether the allocation is usable at a scoreboard index.
   *
   * @param sbIdx Scoreboard slot index.
   * @returns `true` when no shifts are defined or the defined shifts are active
   * at `sbIdx`.
   */
  onShift(sbIdx: number,): boolean {
    if (this.shifts) {
      return this.shifts.onShift(sbIdx,);
    }
    return true;
  }

  /**
   * Returns the candidate list ordered according to `selectionMode`.
   *
   * For `MinAllocated` with `!persistent` the ordered list is cached in
   * `staticCandidates`.
   *
   * @param scenarioIdx Index of the scenario used to read `criticalness` and
   * `bookedEffort`.
   * @returns The candidates in the order they must be tried.
   * @throws TjArgumentError When the selection mode is unknown.
   */
  candidatesList(scenarioIdx: number = 0,): Resource[] {
    // Return the cached static list when it already exists.
    if (this.staticCandidates) {
      return this.staticCandidates;
    }

    // Declaration order or undefined scenarioIdx: return as is.
    if (this.selectionMode === SelectionMode.Order) {
      return this.candidates;
    }

    // Random: shuffle with Math.random.
    if (this.selectionMode === SelectionMode.Random) {
      const shuffled = [...this.candidates,];
      shuffled.sort(() => Math.random() - 0.5);
      return shuffled;
    }

    // Minallocated / MinLoaded / MaxLoaded: sort by criticalness or bookedEffort.
    const list = [...this.candidates,].sort((x, y,) => {
      if (this.selectionMode === SelectionMode.MinAllocated) {
        if (this.persistent) {
          // For persistent resources, bookedEffort is the primary criterion.
          const cmp = x.bookedEffort(scenarioIdx,) -
            y.bookedEffort(scenarioIdx,);
          if (cmp !== 0) {
            return cmp;
          }
          // Break ties with criticalness.
          const xCrit =
            x.scenarioData(scenarioIdx,).a("criticalness",) as number ?? 0;
          const yCrit =
            y.scenarioData(scenarioIdx,).a("criticalness",) as number ?? 0;
          return xCrit - yCrit;
        }
        // For non-persistent resources, use criticalness.
        const xCrit =
          x.scenarioData(scenarioIdx,).a("criticalness",) as number ?? 0;
        const yCrit =
          y.scenarioData(scenarioIdx,).a("criticalness",) as number ?? 0;
        return xCrit - yCrit;
      }
      if (this.selectionMode === SelectionMode.MinLoaded) {
        return x.bookedEffort(scenarioIdx,) - y.bookedEffort(scenarioIdx,);
      }
      if (this.selectionMode === SelectionMode.MaxLoaded) {
        return y.bookedEffort(scenarioIdx,) - x.bookedEffort(scenarioIdx,);
      }
      throw new TjArgumentError(
        `Unknown selection mode ${this.selectionMode}`,
      );
    },);

    // Cache only for MinAllocated && !persistent.
    if (this.selectionMode === SelectionMode.MinAllocated && !this.persistent) {
      this.staticCandidates = list;
    }

    return list;
  }
}
