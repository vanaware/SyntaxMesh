/**
 * LogicalExpression — raiz da árvore de uma expressão lógica (Fase 11.4).
 *
 * Port fiel de `LogicalExpression.rb`. Envolve uma `LogicalOperation` e o
 * contexto de avaliação (`query`). A avaliação retorna sempre um booleano:
 * `true`/`false`/string passam conforme a regra do Ruby; números usam
 * `!== 0` (em TJP 'não-zero' é … comparado a zero).
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalExpression.rb
 */
import { TjError, } from "../model/errors.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { Query, } from "../query/query.ts";
import type { LogicalOperation, } from "./logical-operation.ts";

/** Expressão lógica: raiz de uma árvore de `LogicalOperation`. */
export class LogicalExpression {
  readonly operation: LogicalOperation;
  readonly sourceFileInfo: SourceFileInfo | null;
  /** Contexto de avaliação; preenchido por `eval`. */
  query: Query | null = null;

  constructor(
    op: LogicalOperation,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    this.operation = op;
    this.sourceFileInfo = sourceFileInfo;
  }

  /** Avalia a expressão contra `query`, normalizando o resultado para booleano. */
  eval(query: Query,): boolean {
    this.query = query;
    const res = this.operation.eval(this,);
    if (typeof res === "boolean") return res;
    if (typeof res === "string") return res.length > 0;
    // Números/null: em TJP só 0 (e false) significam "falso".
    return (res as unknown) !== 0;
  }

  /** Dump textual. Com `query` mostra valores; sem, mostra nomes. */
  to_s(query: Query | null = null,): string {
    const body = this.operation.to_s(query,);
    return this.sourceFileInfo === null
      ? body
      : `${String(this.sourceFileInfo,)} ${body}`;
  }

  toString(): string {
    return this.operation.toString();
  }

  /** Erro interno chamado pelas `LogicalOperation` durante a avaliação. */
  error(text: string,): never {
    throw new TjError(
      `${this.to_s()}\nLogical expression error: ${text}`,
    );
  }
}
