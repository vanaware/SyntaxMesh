/**
 * LogicalExpression / LogicalOperation — valor mínimo (Fase 10).
 *
 * O parser constrói essas árvores para defaults de relatório (hideTask,
 * hideResource, ...) e para as regras `!logicalExpression` /
 * `!flagLogicalExpression` (subfase 10.14). A avaliação real (`eval`) chega
 * na Fase 11 (motor de queries); aqui guardamos apenas a estrutura para que
 * as defaults dos relatórios sejam comparáveis nos testes de parsing.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalExpression.rb
 * @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb
 */
import type { SourceFileInfo, } from "../source-file-info.ts";

/** Nó de operação de uma expressão lógica (valor bruto, sem avaliação). */
export class LogicalOperation {
  operand1: unknown;
  operand2: unknown;
  operator: string | null;

  constructor(
    opnd1: unknown,
    operator: string | null = null,
    opnd2: unknown = null,
  ) {
    this.operand1 = opnd1;
    this.operator = operator;
    this.operand2 = opnd2;
  }

  toString(): string {
    if (this.operator === null) return String(this.operand1,);
    if (this.operator === "~") return `~${String(this.operand1,)}`;
    return `${String(this.operand1,)} ${this.operator} ${
      String(this.operand2,)
    }`;
  }
}

/** Expressão lógica: raiz de uma árvore de LogicalOperation. */
export class LogicalExpression {
  readonly operation: LogicalOperation;
  readonly sourceFileInfo: SourceFileInfo | null;

  constructor(
    op: LogicalOperation,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    this.operation = op;
    this.sourceFileInfo = sourceFileInfo;
  }

  toString(): string {
    return this.operation.toString();
  }
}

/**
 * Folha de operando: atributo de propriedade (cenario.attributo).
 * Port minimo de LogicalAttribute.rb (avaliacao chega na Fase 11).
 */
export class LogicalAttribute {
  constructor(
    readonly attribute: string,
    readonly scenario: unknown,
  ) {}
  toString(): string {
    return this.attribute;
  }
}

/** Folha de operando: flag declarada. Port minimo de LogicalFlag.rb. */
export class LogicalFlag {
  constructor(readonly flagName: string,) {}
  toString(): string {
    return this.flagName;
  }
}

/**
 * Folha de operando: chamada de funcao (nome + argumentos).
 * Port minimo de LogicalFunction.rb — sem validacao de aridade
 * (setArgumentsAndCheck e da Fase 11); o parser apenas registra.
 */
export class LogicalFunction {
  args: unknown[] = [];
  constructor(readonly functionName: string,) {}
  setArguments(args: unknown[],): void {
    this.args = args;
  }
  toString(): string {
    return `${this.functionName}(${this.args.join(", ",)})`;
  }
}
