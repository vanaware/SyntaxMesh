import { TjArgumentError, } from "../time/tj-time.ts";
import { compat, rubyRound, } from "../compat.ts";
// RUBY-COMPAT: uses rubyRound (Category B) for negative number rounding

/**
 * RealFormat — number formatter configurable through the TJP `numberformat`
 * directive (signs, thousands and fraction separators, fraction digits).
 */
export class RealFormat {
  /** String placed before a negative number. */
  readonly signPrefix: string;
  /** String placed after a negative number. */
  readonly signSuffix: string;
  /** Separator inserted every three integer digits, or `""`. */
  readonly thousandsSeparator: string;
  /** Separator between the integer and the fraction digits. */
  readonly fractionSeparator: string;
  /** Number of digits kept after the fraction separator. */
  readonly fractionDigits: number;

  /**
   * Creates the formatter from a tuple or copies another one.
   *
   * @param args The five format settings in order, or a formatter to copy.
   * @throws TjArgumentError When the tuple does not hold exactly five values.
   */
  constructor(args: [string, string, string, string, number,] | RealFormat,) {
    if (Array.isArray(args,)) {
      if (args.length !== 5) {
        throw new TjArgumentError(`Bad number of parameters ${args.length}`,);
      }
      [
        this.signPrefix,
        this.signSuffix,
        this.thousandsSeparator,
        this.fractionSeparator,
        this.fractionDigits,
      ] = args;
    } else {
      this.signPrefix = args.signPrefix;
      this.signSuffix = args.signSuffix;
      this.thousandsSeparator = args.thousandsSeparator;
      this.fractionSeparator = args.fractionSeparator;
      this.fractionDigits = args.fractionDigits;
    }
  }

  /**
   * Formats a number with the configured separators and digits.
   *
   * @param number Value to format.
   * @returns The formatted number, with the sign markers when negative.
   */
  format(number: number,): string {
    const rounded = compat.keepRubyBugs
      ? rubyRound(number * (10 ** this.fractionDigits),)
      : Math.round(number * (10 ** this.fractionDigits),);
    const negate = rounded < 0;
    const absNumber = negate ? -rounded : rounded;
    const intNumber = absNumber.toString();
    if (intNumber.length <= this.fractionDigits) {
      const padded = "0".repeat(this.fractionDigits - intNumber.length + 1,) +
        intNumber;
      return this.buildResult(padded, negate,);
    }

    const intPart = this.fractionDigits > 0
      ? intNumber.slice(0, -this.fractionDigits,)
      : intNumber;
    const fracPart = this.fractionDigits > 0
      ? this.fractionSeparator + intNumber.slice(-this.fractionDigits,)
      : "";

    let out: string;
    if (this.thousandsSeparator === "") {
      out = intPart;
    } else {
      out = "";
      for (let i = 1; i <= intPart.length; i++) {
        out = intPart[intPart.length - i] + out;
        if (i % 3 === 0 && i < intPart.length) {
          out = this.thousandsSeparator + out;
        }
      }
    }
    out += fracPart;
    if (negate) {
      out = this.signPrefix + out + this.signSuffix;
    }
    return out;
  }

  /**
   * Formats a digit string that is shorter than the fraction width.
   *
   * @param padded Digits left-padded with zeros.
   * @param negate Whether the number is negative.
   * @returns The formatted number, with the sign markers when negative.
   */
  private buildResult(padded: string, negate: boolean,): string {
    const fracPart = this.fractionDigits > 0
      ? this.fractionSeparator + padded.slice(-this.fractionDigits,)
      : "";
    const intPart = this.fractionDigits > 0
      ? padded.slice(0, -this.fractionDigits,)
      : padded;

    let out: string;
    if (this.thousandsSeparator === "") {
      out = intPart;
    } else {
      out = "";
      for (let i = 1; i <= intPart.length; i++) {
        out = intPart[intPart.length - i] + out;
        if (i % 3 === 0 && i < intPart.length) {
          out = this.thousandsSeparator + out;
        }
      }
    }
    out += fracPart;
    if (negate) {
      out = this.signPrefix + out + this.signSuffix;
    }
    return out;
  }

  /**
   * Renders the settings the way the TJP `numberformat` directive writes them.
   *
   * @returns The five quoted settings separated by spaces.
   */
  to_s(): string {
    return [
      this.signPrefix,
      this.signSuffix,
      this.thousandsSeparator,
      this.fractionSeparator,
      this.fractionDigits,
    ]
      .map((s,) => `"${s}"`)
      .join(" ",);
  }
}
