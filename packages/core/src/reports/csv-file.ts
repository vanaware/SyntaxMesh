/**
 * CSVFile — lightweight CSV parser/serializer (phase 14.1).
 *
 * Faithful port of `reports/CSVFile.rb`. Ruby uses its own class (avoiding the
 * stdlib `CSV`, which changed between 1.8 and 1.9). It backs the reports (`to_csv`
 * output) and, later on, the time sheets (phase 18).
 *
 * **Browser adaptation (ADR 027):** `write` never touches the disk — for `'.'`
 * it is a no-op (the string is already available through `to_s()`); for any
 * other name it emits a warning. `read` requires a `FileStore` (phase 19) and
 * throws `NotYetImplementedError` without one.
 *
 * @see docs/taskjuggler/lib/taskjuggler/reports/CSVFile.rb
 * @see docs/syntaxmesh/fases/fase-14-relatorios.md (14.1)
 */

import { MessageHandlerInstance, } from "../message-handler.ts";
import { NotYetImplementedError, } from "../model/errors.ts";

/** State machine of `parse` (mirrors the Ruby symbols). */
type ParseState =
  | "startOfRecord"
  | "startOfField"
  | "inQuotedField"
  | "quoteInQuotedField"
  | "inUnquotedField"
  | "fieldEnd"
  | "recordEnd";

/** Signed integer literal (Ruby `/^[-+]?\d+$/`). */
const INTEGER_RE = /^[-+]?\d+$/;
/** Signed float/exponential literal. */
const FLOAT_RE = /^[-+]?\d*\.?\d+([eE][-+]?\d+)?$/;

/**
 * A CSV table held in memory, with a parser and a serializer.
 */
export class CSVFile {
  /** Parsed/serialized rows; `null` for an empty table. */
  data: unknown[][] | null;
  private separator: string;
  private quote: string;

  /**
   * Creates a CSV table.
   *
   * @param data Initial rows, or `null` for an empty table.
   * @param separator Field separator; must be a single char other than `.` and
   *   `"`.
   * @param quote Quoting character.
   * @throws Error When the separator or the quote is illegal.
   */
  constructor(
    data: unknown[][] | null = null,
    separator = ";",
    quote = '"',
  ) {
    this.data = data;
    if (separator === "." || separator === '"') {
      throw new Error(`Illegal separator: ${separator}`,);
    }
    if (separator.length > 1) {
      throw new Error(`Illegal separator: ${separator}`,);
    }
    this.separator = separator;
    if (quote === ".") throw new Error(`Illegal quote: ${quote}`,);
    this.quote = quote;
  }

  /**
   * Writes the table as CSV. There is no filesystem in the browser: `'.'` is a
   * no-op (the content is in `to_s()`); any other name raises a warning.
   *
   * @param fileName Target file name, or `'.'` for standard output.
   */
  write(fileName: string,): void {
    if (fileName === ".") return;
    MessageHandlerInstance.instance.warning(
      "csv_write_noop",
      `CSVFile.write('${fileName}') is a no-op in the browser; use to_s()`,
      null,
    );
  }

  /**
   * Reads from a file — requires a `FileStore` (phase 19).
   *
   * @param _fileName Source file name.
   * @throws NotYetImplementedError Always, until phase 19 provides a file store.
   */
  read(_fileName: string,): unknown[][] {
    // Ancorado: Fase 19 — CSV reading depends on the FileStore (workerdb).
    throw new NotYetImplementedError("19", "CSVFile.read",);
  }

  /** Serializes the table to a CSV string (Ruby `to_s`). */
  to_s(): string {
    if (!this.separator) throw new Error("No seperator defined.",);
    let s = "";
    for (const line of this.data ?? []) {
      let first = true;
      for (const field of line) {
        if (first) {
          first = false;
        } else {
          s += this.separator;
        }
        s += this.marshal(field,);
      }
      s += "\n";
    }
    return s;
  }

  /**
   * Parses a CSV string into an array of arrays (state machine faithful to
   * Ruby). Unquoted numbers become `number`; quoted fields stay `string`.
   *
   * @param str CSV text to parse.
   * @returns The parsed rows (also stored in {@link CSVFile.data}).
   * @throws Error On an unexpected character or an unterminated quoted cell.
   */
  parse(str: string,): unknown[][] {
    const data: unknown[][] = [];
    let state: ParseState = "startOfRecord";
    let fields: unknown[] = [];
    let field: string | null = null;
    let quoted = false;

    // Guarantees the input ends with a record terminator.
    if (!str.endsWith("\n",)) str += "\n";

    // Without a defined separator, try to detect one.
    if (!this.separator) this.separator = this.detectSeparator(str,);

    let line = 1;
    const chars = Array.from(str,);
    let i = 0;
    while (i < chars.length) {
      const c = chars[i] as string;
      let redo = false;

      switch (state) {
        case "startOfRecord":
          fields = [];
          state = "startOfField";
          redo = true;
          break;

        case "startOfField":
          field = "";
          quoted = false;
          if (c === this.quote) {
            state = "inQuotedField";
            quoted = true;
          } else if (c === this.separator || c === "\n") {
            field = null;
            state = "fieldEnd";
            redo = true;
          } else {
            field += c;
            state = "inUnquotedField";
          }
          break;

        case "inQuotedField":
          if (c === this.quote) {
            state = "quoteInQuotedField";
          } else {
            field = (field ?? "") + c;
            if (c === "\n") line++;
          }
          break;

        case "quoteInQuotedField":
          if (c === this.quote) {
            field = (field ?? "") + c;
            state = "inQuotedField";
          } else if (c === this.separator || c === "\n") {
            state = "fieldEnd";
            redo = true;
          } else {
            throw new Error(
              `Line ${line}: Unexpected character ${c} in cell: ${field}`,
            );
          }
          break;

        case "inUnquotedField":
          if (c === this.separator || c === "\n") {
            state = "fieldEnd";
            redo = true;
          } else {
            field = (field ?? "") + c;
          }
          break;

        case "fieldEnd":
          fields.push(this.unMarshal(field, quoted,),);
          if (c === "\n") {
            state = "recordEnd";
            redo = true;
          } else {
            state = "startOfField";
          }
          break;

        case "recordEnd":
          data.push(fields,);
          state = "startOfRecord";
          line++;
          break;
      }

      if (!redo) i++;
    }

    if (state !== "startOfRecord") {
      if (state === "inQuotedField") {
        throw new Error(`Line ${line}: Unterminated quoted cell: ${field}`,);
      }
      throw new Error(`Line ${line}: CSV error in state ${state}: ${field}`,);
    }

    this.data = data;
    return data;
  }

  /**
   * Converts a string into a native value (number) when possible; keeps the
   * rest as is. Port of `CSVFile.strToNative`.
   *
   * @param str Raw field text, or `null`.
   * @returns The parsed number, the original string, or `null`.
   */
  static strToNative(str: string | null,): unknown {
    if (str === null) return null;
    if (INTEGER_RE.test(str,)) return parseInt(str, 10,);
    if (FLOAT_RE.test(str,)) return parseFloat(str,);
    return str;
  }

  /** Wraps a field in quotes (Ruby `marshal`). */
  private marshal(field: unknown,): string {
    if (field === null || field === undefined) return "";
    if (typeof field === "number") return field.toString();
    const f = String(field,).replace(
      new RegExp(this.quote, "g",),
      this.quote + this.quote,
    );
    return this.quote + f + this.quote;
  }

  /** Converts a read field to a native value (Ruby `unMarshal`). */
  private unMarshal(field: string | null, quoted: boolean,): unknown {
    if (quoted || field === null) return field;
    return CSVFile.strToNative(field,);
  }

  /** Separator heuristic: the most frequent among tab, `;` and `:`. */
  private detectSeparator(str: string,): string {
    let best: string | null = null;
    let bestCount = 0;
    for (const c of ["\t", ";", ":",]) {
      const count = str.split(c,).length - 1;
      if (best === null || count > bestCount) {
        best = c;
        bestCount = count;
      }
    }
    return best ?? ";";
  }
}
