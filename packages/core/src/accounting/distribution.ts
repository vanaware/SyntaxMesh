/**
 * Unified temporal distribution of costs (#6a) and `timebasis` resolution
 * (#6) — phase 10 complement, block C2.
 *
 * This module is the single source of the cross-cutting rule that connects
 * `timebasis` to the `charge` and `material` calculations: it defines whether
 * the temporal distribution counts calendar days (`duration`) or working days
 * (`length`).
 *
 * `timebasis` does **not** change scheduling — it is exclusive to cost
 * calculation (complement2 §1.2 principle 1).
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento2.md (§2–§5)
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (block C2)
 */
import { type Task, } from "../model/task.ts";
import { type ProjectLike, } from "../model/project-like.ts";

/** Canonical timebasis value (complement2 §2.2). */
export type Timebasis = "duration" | "length";

/**
 * Normalises a timebasis value (which may be an alias) to the canonical one.
 * `calendar` → `duration`; `working` → `length`. Unknown or null values return
 * null (the parser reports `illegal_timebasis`, C3.4.3).
 */
export function normalizeTimebasis(
  v: string | null | undefined,
): Timebasis | null {
  switch (v) {
    case "duration":
    case "calendar":
      return "duration";
    case "length":
    case "working":
      return "length";
    default:
      return null;
  }
}

/**
 * Resolution rule for the effective `timebasis` (complement2 §2.4), applied per
 * task, in order:
 *
 * 1. task `length` > 0 → `length` (implicit, beats everything).
 * 2. task `duration` > 0 → `duration` (implicit).
 * 3. explicit task `timebasis` → the explicit value (normalised).
 * 4. project `timebasis` → the project value.
 * 5. none of the above → default `duration` (TJ compatibility).
 */
export function resolveTimebasis(
  task: Task,
  scIdx: number,
  project: ProjectLike,
): Timebasis {
  const scenario = task.scenarioData(scIdx,);
  if ((scenario.a("length",) as number) > 0) return "length";
  if ((scenario.a("duration",) as number) > 0) return "duration";
  const explicit = normalizeTimebasis(
    scenario.a("timebasis",) as string | null,
  );
  if (explicit) return explicit;
  const fromProject = normalizeTimebasis(
    project.get("timebasis",) as string | null,
  );
  if (fromProject) return fromProject;
  return "duration";
}

/**
 * Context for the distribution calculations (§3.3–§3.4). The sources of
 * `isWorkingCalendarDay` and `leaves` are the task shift when present, or else
 * the project (complement2 §2.7) — RESOURCE leaves never enter (property 5:
 * charge/material are task-centric).
 */
export interface DistributionContext {
  /** Resolved timebasis of the task (resolvedTimebasis). */
  timebasis: Timebasis;
  /** Calendar working day (shift/project workinghours, no leaves). */
  isWorkingCalendarDay: (day: Date,) => boolean;
  /** Closed leave intervals [start, end] (shift/project). */
  leaves: Array<{ start: Date; end: Date }>;
  /** project.weekStartsMonday — defines the start of the week (perweek). */
  weekStartsMonday: boolean;
  /** Working hours per day (project.dailyworkinghours) — for perhour. */
  workingHoursPerDay: number;
}

/** Period-dependent modifiers (§3.2). */
export type PeriodModifier = "perhour" | "perday" | "perweek" | "permonth";

const MS_DAY = 86400000;

/** UTC midnight of a Date (day arithmetic closed in UTC). */
function dayStart(d: Date,): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),);
}

/** Closed days between start and end (inclusive), in 1-day UTC steps. */
function* eachDay(start: Date, end: Date,): Generator<number> {
  const s = dayStart(start,);
  const e = dayStart(end,);
  for (let t = s; t <= e; t += MS_DAY) yield t;
}

function dayFromDate(ms: number,): Date {
  return new Date(ms,);
}

/** Day covered by some leave (closed intervals). */
export function inLeaves(
  ms: number,
  leaves: Array<{ start: Date; end: Date }>,
): boolean {
  for (const l of leaves) {
    if (ms >= dayStart(l.start,) && ms <= dayStart(l.end,)) return true;
  }
  return false;
}

/**
 * Eligible days covered by the interval (§5, formal definitions):
 * `duration`: any day; `length`: a calendar working day AND not covered by a
 * leave.
 */
export function countEligibleDays(
  start: Date,
  end: Date,
  ctx: DistributionContext,
): number {
  let n = 0;
  for (const ms of eachDay(start, end,)) {
    if (ctx.timebasis === "duration") {
      n++;
    } else if (
      ctx.isWorkingCalendarDay(dayFromDate(ms,),) && !inLeaves(ms, ctx.leaves,)
    ) {
      n++;
    }
  }
  return n;
}

/**
 * Covered working hours (§3.4.2): calendar working days minus leaves, times the
 * working hours per day. `perhour` is always working hours, regardless of
 * timebasis (property 8).
 */
export function countWorkingHours(
  start: Date,
  end: Date,
  isWorkingCalendarDay: (day: Date,) => boolean,
  hoursPerDay: number,
  leaves: Array<{ start: Date; end: Date }> = [],
): number {
  let n = 0;
  for (const ms of eachDay(start, end,)) {
    const d = dayFromDate(ms,);
    if (isWorkingCalendarDay(d,) && !inLeaves(ms, leaves,)) n += hoursPerDay;
  }
  return n;
}

/** Week start (UTC ms) containing `ms`, according to weekStartsMonday. */
function weekStartMs(ms: number, weekStartsMonday: boolean,): number {
  const d = new Date(ms,);
  const wd = d.getUTCDay(); // 0=dom
  const offset = weekStartsMonday ? (wd + 6) % 7 : wd;
  return ms - offset * MS_DAY;
}

/** First day of the month of `ms` (UTC). */
function monthStartMs(ms: number,): number {
  const d = new Date(ms,);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1,);
}

/** Last day of the month of `ms` (UTC, ms of the day). */
function monthEndMs(ms: number,): number {
  const d = new Date(monthStartMs(ms,),);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0,);
}

/**
 * Unified formula (§3.4/§3.6): for each period P (week or month) that
 * intersects the interval, `amount × (numerator(P) / denominator(P))`, with
 * denominator = calendar days (`duration`) or calendar working days without
 * leaves (`length`); numerator = days of the period covered by the task
 * (`duration`) or eligible days covered (`length`).
 */
function perPeriodFormula(
  amount: number,
  start: Date,
  end: Date,
  ctx: DistributionContext,
  periodOf: (ms: number,) => number,
  periodEnd: (ms: number,) => number,
): number {
  let total = 0;
  const seen = new Set<number>();
  for (const ms of eachDay(start, end,)) {
    const p = periodOf(ms,);
    if (seen.has(p,)) continue;
    seen.add(p,);
    const pEnd = periodEnd(p,);
    // Numerator and denominator of period P.
    let num = 0;
    let den = 0;
    for (let t = p; t <= pEnd; t += MS_DAY) {
      const covered = t >= dayStart(start,) && t <= dayStart(end,);
      if (ctx.timebasis === "duration") {
        den++;
        if (covered) num++;
      } else {
        const working = ctx.isWorkingCalendarDay(dayFromDate(t,),);
        if (working) {
          den++;
          if (covered && !inLeaves(t, ctx.leaves,)) num++;
        }
      }
    }
    if (den > 0) total += (amount * num) / den;
  }
  return total;
}

/**
 * Total value of a period modifier over the task interval. `perhour` does not
 * depend on timebasis; `perday` is a direct count; `perweek` and `permonth` use
 * the proportional formula per period (§3.4.3/§3.4.4).
 */
export function perPeriod(
  modifier: PeriodModifier,
  amount: number,
  start: Date,
  end: Date,
  ctx: DistributionContext,
): number {
  switch (modifier) {
    case "perhour":
      return amount * countWorkingHours(
        start,
        end,
        ctx.isWorkingCalendarDay,
        ctx.workingHoursPerDay,
        ctx.leaves,
      );
    case "perday":
      return amount * countEligibleDays(start, end, ctx,);
    case "perweek":
      return perPeriodFormula(
        amount,
        start,
        end,
        ctx,
        (ms,) => weekStartMs(ms, ctx.weekStartsMonday,),
        (p,) => p + 6 * MS_DAY,
      );
    case "permonth":
      return perPeriodFormula(
        amount,
        start,
        end,
        ctx,
        monthStartMs,
        monthEndMs,
      );
  }
}

/**
 * `distributed` (§3.4.5): splits the total evenly across the covered eligible
 * days. The distributed total is always `total` (property 9); the last day
 * absorbs the rounding remainder so the sum closes exactly.
 */
export function distributeDays(
  total: number,
  start: Date,
  end: Date,
  ctx: DistributionContext,
): number[] {
  const days: number[] = [];
  for (const ms of eachDay(start, end,)) {
    const eligible = ctx.timebasis === "duration" ||
      (ctx.isWorkingCalendarDay(dayFromDate(ms,),) &&
        !inLeaves(ms, ctx.leaves,));
    if (eligible) days.push(ms,);
  }
  if (days.length === 0) return [];
  const per = total / days.length;
  const out = days.map(() => per);
  // The last day absorbs the remainder (decision §10.1).
  const sum = out.reduce((a, b,) => a + b, 0,);
  out[out.length - 1]! += total - sum;
  return out;
}

/**
 * `distribution { fractions }` (§3.4.6): splits the covered eligible days into
 * N consecutive blocks (N = fractions) and applies `fraction × total` per
 * block, evenly across the days of the block. Non-divisible days: the
 * REMAINDER goes to the last block (decision §10.1 — absorbed by the last
 * part). The sum of the values is always `total` (property 9; sum of the
 * fractions = 1.0 validated in phase 8.1).
 */
export function distributeFractions(
  total: number,
  fractions: number[],
  start: Date,
  end: Date,
  ctx: DistributionContext,
): number[] {
  const eligible: number[] = [];
  for (const ms of eachDay(start, end,)) {
    const ok = ctx.timebasis === "duration" ||
      (ctx.isWorkingCalendarDay(dayFromDate(ms,),) &&
        !inLeaves(ms, ctx.leaves,));
    if (ok) eligible.push(ms,);
  }
  const n = fractions.length;
  if (eligible.length === 0 || n === 0) return [];
  const base = Math.floor(eligible.length / n,);
  // Blocks: n-1 of size `base`; the last one absorbs the remainder.
  const out: number[] = [];
  for (let b = 0; b < n; b++) {
    const size = b === n - 1 ? eligible.length - base * (n - 1) : base;
    const blockTotal = fractions[b]! * total;
    const perDay = size > 0 ? blockTotal / size : 0;
    for (let i = 0; i < size; i++) out.push(perDay,);
  }
  // Closes the rounding: the last day absorbs the difference.
  const sum = out.reduce((a, b,) => a + b, 0,);
  out[out.length - 1]! += total - sum;
  return out;
}
