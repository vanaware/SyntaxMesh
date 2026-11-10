/**
 * Percentage value marker produced by the parser (`work 50%`).
 *
 * Ruby distinguishes `Integer` (direct slots) from `Float` (fraction 0.0–1.0)
 * with `is_a?(Integer)` in `TimeSheetRecord#work=` (TimeSheets.rb l.53-60). In
 * TypeScript every number is a `number`, so the parser marks the percentage
 * case explicitly: without it `work 100%` (fraction `1.0`) would be
 * indistinguishable from `work 1h` (1 slot) and the total of the period would
 * come out wrong.
 *
 * `valueOf()` returns the fraction, so accidental arithmetic usages stay
 * correct.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TimeSheets.rb
 */
export class Percent {
  /**
   * Creates the marker.
   *
   * @param fraction Fraction of a slot (0.0–1.0).
   */
  constructor(readonly fraction: number,) {}

  /**
   * Numeric value of the marker (the fraction itself).
   *
   * @returns The fraction, so arithmetic keeps working.
   */
  valueOf(): number {
    return this.fraction;
  }

  /**
   * Default string conversion required by the JS runtime.
   *
   * @returns The fraction as a string.
   */
  toString(): string {
    return String(this.fraction,);
  }
}
