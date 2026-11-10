/**
 * TjpSyntaxRules — `booking charge` (Adendo Extra §12.3, 14C.15.4–15.7).
 *
 * Accepted forms, in the three origins (task, resource and material). The
 * `<description>` is optional free text and `value` is optional (C15):
 *
 * ```tjp
 * task t "T" { booking charge ["<description>"] [value] <amount> on <date> }
 * resource r "R" { booking charge <task> ["<description>"] [value] <amount> on <date> }
 * material m "M" { booking charge <task> ["<description>"] [value] <amount> on <date> }
 * ```
 *
 * In the task body there is **no** resource reference (revision 2026-11-02): a
 * charge booking consumes no effort — the other end of the relation is the task
 * that owns the block. A resource is only mandatory in the effort booking
 * (`booking <resource> <interval>`, TjpSyntaxRules.rb:6001).
 *
 * The amount goes into the `chargebookings` scenario attribute of the **task**
 * that owns the expense — the declaring side is merely the other end of the
 * relation. The task reference may be a forward reference (the task comes after
 * the block): it goes into the `Project.pendingBookings` queue, the same one
 * used by material bookings (14C.11.5).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §13.3
 */
import type { Project, } from "../../model/project.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { ChargeBooking, } from "../../model/charge-booking.ts";
import { legacyTail, } from "../../model/booking-period.ts";
import type {
  BookingModifier,
  BookingTail,
} from "../../model/booking-period.ts";
import type { Material, } from "../../model/material.ts";
import { Resource, } from "../../model/resource.ts";
import { Task, } from "../../model/task.ts";
import type { TjTime, } from "../../time/tj-time.ts";
import type { TimeInterval, } from "../../time/time-interval.ts";
import { rule, } from "./helpers.ts";

const asProp = (parser: ProjectFileParser,): NonNullable<
  ProjectFileParser["property"]
> => parser.property!;

/** Appends the booking to the task's `chargebookings` scenario attribute. */
export function appendChargeBooking(
  parser: ProjectFileParser,
  task: Task,
  booking: ChargeBooking,
): void {
  const current = (task.getForScenario(
    "chargebookings",
    parser.scenarioIdx,
  ) ?? []) as ChargeBooking[];
  task.setForScenario(
    "chargebookings",
    current.concat([booking,],),
    parser.scenarioIdx,
  );
}

/** Resolves a task reference by ID and then by name. */
export function resolveTaskRef(
  project: Project,
  ref: string,
): Task | null {
  const byId = project.task(ref,);
  if (byId) return byId;
  let found: Task | null = null;
  project.tasks.each((node,) => {
    if (!(node instanceof Task)) return;
    if (node.name === ref) found = node;
  },);
  return found;
}

/**
 * Registers the `booking charge` rules: task reference (ID or name, with
 * forward reference), optional description ($STRING) and the three headers, one
 * per origin. `value` is optional (Adendo Extra §12.3) and the amount accepts a
 * sign (reversal), as in the material stock booking.
 *
 * Wave D3: the temporal end is the shared `bookingPeriodTail` rule —
 * `on <date>` (legacy, single point) or `<modifier> <intervals>` /
 * `<intervals>` (calendar-based distribution). Also used by the material/stock
 * bookings.
 */
export function registerBookingRules(p: ProjectFileParser,): void {
  // Booking distribution modifiers: same literals as the material allocation
  // (`materialAllocationModifierKeyword`), a single vocabulary (wave D).
  rule(p, "bookingModifierKeyword", () => {
    p.pattern(["_onstart",], () => "onstart",);
    p.descr("Book the whole amount on the first day of the interval.",);
    p.pattern(["_onend",], () => "onend",);
    p.descr("Book the whole amount on the last day of the interval.",);
    p.pattern(["_perhour",], () => "perhour",);
    p.descr("Book the amount for every hour of the interval.",);
    p.pattern(["_perday",], () => "perday",);
    p.descr("Book the amount for every day of the interval.",);
    p.pattern(["_perweek",], () => "perweek",);
    p.descr("Book the amount for every week of the interval.",);
    p.pattern(["_permonth",], () => "permonth",);
    p.descr("Book the amount for every month of the interval.",);
    p.pattern(["_distributed",], () => "distributed",);
    p.descr("Spread the amount over the days of the interval.",);
    p.arg(0, "modifier", "How the amount is distributed over the intervals.",);
  },);

  /**
   * Temporal tail of a booking (wave D3). Three forms, with disjoint initial
   * tokens (an FSM requirement):
   *
   * - `on <date>` — legacy: one-day degenerate tail (`onstart`),
   *   `isTemporal() === false`, consumers keep the old path.
   * - `<modifier> <intervals>` — explicit distribution.
   * - `<intervals>` — no modifier: `distributed` (the allocation default).
   */
  rule(p, "bookingPeriodTail", () => {
    p.pattern(["_on", "!date",], function (this: ProjectFileParser,): unknown {
      return legacyTail(this.val[1] as TjTime,);
    },);
    p.pattern(
      ["!bookingModifierKeyword", "!valIntervals",],
      function (this: ProjectFileParser,): unknown {
        const intervals = (this.val[1] ?? []) as TimeInterval[];
        if (intervals.length === 0) return null;
        return {
          modifier: this.val[0] as BookingModifier,
          intervals,
        } satisfies BookingTail;
      },
    );
    p.pattern(["!valIntervals",], function (this: ProjectFileParser,): unknown {
      const intervals = (this.val[0] ?? []) as TimeInterval[];
      if (intervals.length === 0) return null;
      return {
        modifier: "distributed" as BookingModifier,
        intervals,
      } satisfies BookingTail;
    },);
    p.arg(0, "period", "`on <date>` or `<modifier> <interval>[, …]`.",);
  },);

  rule(p, "chargeBookingTaskRef", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      return String(this.val[0],);
    },);
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      return String(this.val[0],);
    },);
    p.arg(0, "task", "The ID or name of a task.",);
  },);

  /**
   * Optional description of the expense (`$STRING`). In the task body it is the
   * only textual argument; in the resource/material origins it comes **after**
   * the task reference (Adendo Extra §12.3, revision 2026-11-02).
   */
  rule(p, "chargeBookingDescription", () => {
    p.optional();
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      return String(this.val[0],);
    },);
  },);

  // `booking charge ["<description>"] [value] <amount> <temporal-tail>` — task
  // body: no resource reference (the owner of the expense is the task itself).
  rule(p, "taskChargeBookingHeader", () => {
    p.pattern(
      [
        "_charge",
        "!chargeBookingDescription",
        "!bookingValueKeyword",
        "!signedNumber",
        "!bookingPeriodTail",
      ],
      function (this: ProjectFileParser,): unknown {
        addChargeBooking(
          this,
          null,
          asProp(this,) as unknown as Task,
          null,
          Number(this.val[3],),
          this.val[4] as BookingTail | null,
          this.val[1] as string | null,
        );
        return null;
      },
    );
    p.doc(
      "booking.charge",
      "Book a real expense (or, with a negative amount, a reversal) against " +
        "the task. The description and the `value` keyword are optional. The " +
        "period is `on <date>` or `<modifier> <interval>[, …]` (wave D3).",
    );
    p.arg(1, "description", "Free-text label for the charge.",);
    p.arg(3, "value", "The amount booked (negative reverses).",);
    p.arg(4, "period", "When the charge falls (point or distributed).",);
  },);

  // `booking charge <task> ["<description>"] [value] <amount> <tail>` —
  // resource body.
  rule(p, "resourceChargeBookingHeader", () => {
    p.pattern(
      [
        "_charge",
        "!chargeBookingTaskRef",
        "!chargeBookingDescription",
        "!bookingValueKeyword",
        "!signedNumber",
        "!bookingPeriodTail",
      ],
      chargeBookingFromOrigin,
    );
    p.arg(1, "task", "The ID or name of the task carrying the charge.",);
    p.arg(2, "description", "Free-text label for the charge.",);
  },);

  // Same in the material body (14C.15.7).
  rule(p, "materialChargeBookingHeader", () => {
    p.pattern(
      [
        "_charge",
        "!chargeBookingTaskRef",
        "!chargeBookingDescription",
        "!bookingValueKeyword",
        "!signedNumber",
        "!bookingPeriodTail",
      ],
      chargeBookingFromOrigin,
    );
    p.arg(1, "task", "The ID or name of the task carrying the charge.",);
    p.arg(2, "description", "Free-text label for the charge.",);
  },);
}

/**
 * Action shared by the `booking charge` headers declared by a resource or a
 * material: the reference is the **task** and may be a forward reference (the
 * project's pending queue, 14C.15.7); the block owner is `owner`. The
 * description (index 2) is optional; the temporal tail is index 5 (wave D3).
 */
function chargeBookingFromOrigin(this: ProjectFileParser,): unknown {
  const owner = asProp(this,) as unknown as Resource | Material;
  const ref = String(this.val[1],);
  const task = resolveTaskRef(this.project!, ref,);
  if (!task) {
    this.error(
      "unknown_task",
      `Unknown task ${ref}`,
      this.sourceFileInfo[0] ?? null,
    );
  }
  addChargeBooking(
    this,
    owner,
    task,
    task ? null : ref,
    Number(this.val[4],),
    this.val[5] as BookingTail | null,
    this.val[2] as string | null,
  );
  return null;
}

/**
 * Creates the `ChargeBooking` and appends it to the owning task (when already
 * declared) or to the project's forward-reference queue (14C.15.7). `taskRef`
 * is the ID/name while the reference is still unresolved; `task` once it is.
 * The `tail` (wave D3) is the period with a modifier; without a tail the
 * constructor degenerates the legacy point from the start of the first interval.
 */
export function addChargeBooking(
  parser: ProjectFileParser,
  owner: Resource | Material | null,
  task: Task | null,
  taskRef: string | null,
  amount: number,
  tail: BookingTail | null,
  description: string | null = null,
): void {
  if (!tail) return;
  const date = tail.intervals[0]!.start;
  const booking = new ChargeBooking(
    owner,
    task ? task.fullId : taskRef,
    amount,
    date,
    task,
    description,
    tail,
  );
  if (task) {
    appendChargeBooking(parser, task, booking,);
    return;
  }
  parser.project!.pendingBookings.push({
    booking,
    scenarioIdx: parser.scenarioIdx,
    attrId: "chargebookings",
  },);
}
