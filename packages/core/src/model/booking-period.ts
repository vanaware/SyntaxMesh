/**
 * Wave D3 — temporal booking
 * (fase-14-c-onda-d-booking-sintaxe-nomenclatura.md §3.D3).
 *
 * A **charge** or **material** booking (stock included) is no longer pinned to a
 * single date and instead carries a **period** (a list of intervals) plus a
 * **modifier** that spreads the value over that period — the same vocabulary
 * used by allocation/planning
 * (`onstart`/`onend`/`perhour`/`perday`/`perweek`/`permonth`/`distributed`).
 *
 * Deliberate difference from `ExtendedCharge`/`distribution.ts`: a booking is a
 * **real** fact (money spent / material moved on calendar dates), not a forecast
 * over the task working schedule. The distribution is calendar-based (calendar
 * days covered by the intervals, with an exclusive end as in the parser),
 * without a `DistributionContext`. The *grammar* parser is shared (same
 * modifier literals); the math lives here, as the single source for charge,
 * material and stock.
 *
 * Compatibility: `on <date>` becomes a degenerate one-day interval with the
 * `onstart` modifier (`.isTemporal() === false`), and the consumers treat the
 * legacy booking exactly as before (same date filter, full value).
 */
import { TjTime, } from "../time/tj-time.ts";
import { TimeInterval, } from "../time/time-interval.ts";

/**
 * Distribution vocabulary of a booking (the same literals used by allocation).
 */
export type BookingModifier =
  | "onstart"
  | "onend"
  | "perhour"
  | "perday"
  | "perweek"
  | "permonth"
  | "distributed";

/** Period + modifier of a booking (charge or material/stock). */
export interface BookingTail {
  /** How the value is spread over `intervals`. */
  modifier: BookingModifier;
  /** Periods the booking covers. */
  intervals: TimeInterval[];
}

const DAY_SECONDS = 86400;

/**
 * Calendar day index (UTC midnight) covering an instant.
 *
 * All day arithmetic uses these integer indices — the same basis as the
 * day-by-day iteration of `distribution.ts`.
 */
function dayIdx(t: TjTime,): number {
  return Math.floor(t.toSeconds() / DAY_SECONDS,);
}

/**
 * Legacy tail built from `on <date>`: a one-day interval with the `onstart`
 * modifier — `isTemporalTail` returns `false` and the consumers keep the old
 * path (same point, full value).
 *
 * @param date Date of the legacy `on` clause.
 */
export function legacyTail(date: TjTime,): BookingTail {
  return {
    modifier: "onstart",
    intervals: [new TimeInterval(date, date.sameTimeNextDay(),),],
  };
}

/**
 * Day range covered by an interval under the parser convention: end
 * **exclusive** (`[start, end)`). This way `d + 24h` (naked date) covers 1 day
 * and `A - B` (end at `B 00:00`) covers A through B−1 — the same reading the
 * export uses when it re-emits `end − 1s`.
 */
function ivDayRange(interval: TimeInterval,): [number, number,] {
  const lo = Math.floor(interval.start.toSeconds() / DAY_SECONDS,);
  const hi = Math.floor((interval.end.toSeconds() - 1) / DAY_SECONDS,);
  return [lo, hi,];
}

/** Days covered by the interval (0 when empty). */
function daysOf(interval: TimeInterval,): number {
  const [lo, hi,] = ivDayRange(interval,);
  return hi >= lo ? hi - lo + 1 : 0;
}

/**
 * Days of overlap between `intervals` (exclusive end) and the closed period
 * `[start, end]` (inclusive on both ends).
 *
 * A missing half of the period does not clip the interval: without `start` the
 * floor is the interval start itself; without `end` the ceiling is the interval
 * end.
 *
 * @param intervals Periods of the booking.
 * @param start Period start, or `null` for no lower bound.
 * @param end Period end, or `null` for no upper bound.
 */
export function overlapDays(
  intervals: TimeInterval[],
  start: TjTime | null,
  end: TjTime | null,
): number {
  const pLo = start === null ? -Infinity : dayIdx(start,);
  const pHi = end === null ? Infinity : dayIdx(end,);
  let days = 0;
  for (const iv of intervals) {
    const [lo, hi,] = ivDayRange(iv,);
    const a = Math.max(lo, pLo,);
    const b = Math.min(hi, pHi,);
    if (a <= b) days += b - a + 1;
  }
  return days;
}

/**
 * Whether any interval crosses the closed period `[start, end]`.
 *
 * @param tail Booking period.
 * @param start Period start, or `null` for no lower bound.
 * @param end Period end, or `null` for no upper bound.
 */
export function tailOverlaps(
  tail: BookingTail,
  start: TjTime | null,
  end: TjTime | null,
): boolean {
  return overlapDays(tail.intervals, start, end,) > 0;
}

/**
 * Whether the tail expresses anything beyond the legacy point
 * (`on <date>` ≡ a punctual onstart).
 *
 * Consumers use this to keep the old path untouched.
 *
 * @param tail Booking period.
 */
export function isTemporalTail(tail: BookingTail,): boolean {
  if (tail.modifier !== "onstart") return true;
  return tail.intervals.some((iv,) => daysOf(iv,) > 1);
}

/**
 * Part of `value` that falls inside the closed period `[start, end]` under the
 * modifier.
 *
 * Without a period the full value is returned. A legacy booking (punctual
 * onstart) returns the full value when the point is inside the period and 0
 * outside — consistent with the old filter.
 *
 * @param value Amount booked.
 * @param tail Booking period.
 * @param start Period start, or `null` for the full value.
 * @param end Period end, or `null` for the full value.
 */
export function valueInPeriod(
  value: number,
  tail: BookingTail,
  start: TjTime | null,
  end: TjTime | null,
): number {
  if (start === null || end === null) return value;
  const days = overlapDays(tail.intervals, start, end,);
  if (days === 0) return 0;
  const pLo = dayIdx(start,);
  const pHi = dayIdx(end,);
  switch (tail.modifier) {
    case "onstart": {
      // Full value if the first covered day of any interval falls in the
      // period.
      const hit = tail.intervals.some((iv,) => {
        const [lo,] = ivDayRange(iv,);
        return lo >= pLo && lo <= pHi;
      },);
      return hit ? value : 0;
    }
    case "onend": {
      // Full value if the last covered day of any interval falls in the
      // period (exclusive end ⇒ the covered day is `end − 1s`).
      const hit = tail.intervals.some((iv,) => {
        const [, hi,] = ivDayRange(iv,);
        return hi >= pLo && hi <= pHi;
      },);
      return hit ? value : 0;
    }
    case "perday":
      return value * days;
    case "perhour":
      return value * 24 * days;
    case "perweek":
      return value * days / 7;
    case "permonth":
      return value * days / 30;
    case "distributed": {
      const total = tail.intervals.reduce((sum, iv,) => sum + daysOf(iv,), 0,);
      return total <= 0 ? 0 : value * days / total;
    }
  }
}
