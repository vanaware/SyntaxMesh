import { TjArgumentError, } from "../time/tj-time.ts";
import { compat, rubyRound, } from "../compat.ts";
// RUBY-COMPAT: uses rubyRound (Category B) for negative number rounding

export class RealFormat {
  readonly signPrefix: string;
  readonly signSuffix: string;
  readonly thousandsSeparator: string;
  readonly fractionSeparator: string;
  readonly fractionDigits: number;

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
