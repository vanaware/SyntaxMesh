/**
 * Erros específicos do sistema de atributos do TaskJuggler.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb (raise ArgumentError, RuntimeError)
 */

/**
 * Erro base para todos os erros do sistema de atributos.
 */
export class TjError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TjError";
  }
}

/**
 * Erro de argumento inválido — usado para validação de parâmetros.
 */
export class TjArgumentError extends TjError {
  constructor(message: string) {
    super(message);
    this.name = "TjArgumentError";
  }
}

/**
 * Erro de execução — usado para falhas durante a execução normal.
 */
export class TjRuntimeError extends TjError {
  constructor(message: string) {
    super(message);
    this.name = "TjRuntimeError";
  }
}

/**
 * Erro quando um atributo tenta sobrescrever um valor já definido.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb (raise AttributeOverwrite)
 */
export class AttributeOverwrite extends TjRuntimeError {
  constructor(attributeId: string) {
    super(`Attribute '${attributeId}' já está definido`);
    this.name = "AttributeOverwrite";
  }
}

/**
 * Erro para métodos que dependem de fases futuras.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb (raise NotYetImplementedError)
 */
export class NotYetImplementedError extends TjRuntimeError {
  constructor(phase: string, method: string) {
    super(`O método '${method}' depende da Fase ${phase}`);
    this.name = "NotYetImplementedError";
  }
}