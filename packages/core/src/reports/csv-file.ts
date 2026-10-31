/**
 * CSVFile — parser/serializador CSV leve (Fase 14.1).
 *
 * Port fiel de `reports/CSVFile.rb`. O Ruby usa sua própria classe (evita a
 * `CSV` da stdlib, que mudou entre 1.8 e 1.9). Usado pelos relatórios (saída
 * `to_csv`) e, no futuro, pelas time sheets (Fase 18).
 *
 * **Adaptação browser (ADR 027):** `write` não toca disco — para `'.'` é no-op
 * (a string já está disponível via `to_s()`); para outro nome, emite warning.
 * `read` exige um `FileStore` (Fase 19) — sem ele, lança `NotYetImplementedError`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/reports/CSVFile.rb
 * @see docs/syntaxmesh/fases/fase-14-relatorios.md (14.1)
 */

import { MessageHandlerInstance, } from "../message-handler.ts";
import { NotYetImplementedError, } from "../model/errors.ts";

/** Máquina de estados do `parse` (espelha os símbolos do Ruby). */
type ParseState =
  | "startOfRecord"
  | "startOfField"
  | "inQuotedField"
  | "quoteInQuotedField"
  | "inUnquotedField"
  | "fieldEnd"
  | "recordEnd";

/** regex de número inteiro com sinal (Ruby `/^[-+]?\d+$/`). */
const INTEGER_RE = /^[-+]?\d+$/;
/** regex de número float/exponencial com sinal. */
const FLOAT_RE = /^[-+]?\d*\.?\d+([eE][-+]?\d+)?$/;

export class CSVFile {
  data: unknown[][] | null;
  private separator: string;
  private quote: string;

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
   * Escreve a tabela como CSV. No browser não há filesystem: `'.'` é no-op (o
   * conteúdo está em `to_s()`); qualquer outro nome gera um warning.
   */
  write(fileName: string,): void {
    if (fileName === ".") return;
    MessageHandlerInstance.instance.warning(
      "csv_write_noop",
      `CSVFile.write('${fileName}') é no-op no browser; use to_s()`,
      null,
    );
  }

  /** Lê de arquivo — requer `FileStore` (Fase 19). */
  read(_fileName: string,): unknown[][] {
    // Ancorado: Fase 19 — leitura CSV depende do FileStore (workerdb).
    throw new NotYetImplementedError("19", "CSVFile.read",);
  }

  /** Serializa a tabela para string CSV ( Ruby `to_s`). */
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
   * Converte uma string CSV em Array de Arrays (máquina de estados fiel ao
   * Ruby). Números não-citados viram `number`; campos citados ficam `string`.
   */
  parse(str: string,): unknown[][] {
    const data: unknown[][] = [];
    let state: ParseState = "startOfRecord";
    let fields: unknown[] = [];
    let field: string | null = null;
    let quoted = false;

    // Garante que a entrada termina com fim de registro.
    if (!str.endsWith("\n",)) str += "\n";

    // Se não há separador definido, tenta detectá-lo.
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
   * Converte string em tipo nativo (número) quando possível; mantém o resto.
   * Port de `CSVFile.strToNative`.
   */
  static strToNative(str: string | null,): unknown {
    if (str === null) return null;
    if (INTEGER_RE.test(str,)) return parseInt(str, 10,);
    if (FLOAT_RE.test(str,)) return parseFloat(str,);
    return str;
  }

  /** Envolve um campo em aspas ( Ruby `marshal`). */
  private marshal(field: unknown,): string {
    if (field === null || field === undefined) return "";
    if (typeof field === "number") return field.toString();
    const f = String(field,).replace(
      new RegExp(this.quote, "g",),
      this.quote + this.quote,
    );
    return this.quote + f + this.quote;
  }

  /** Converte um campo lido para tipo nativo ( Ruby `unMarshal`). */
  private unMarshal(field: string | null, quoted: boolean,): unknown {
    if (quoted || field === null) return field;
    return CSVFile.strToNative(field,);
  }

  /** Heurística de separador: o mais frequente entre tab, `;` e `:`. */
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
