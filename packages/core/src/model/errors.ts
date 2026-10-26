/**
 * Erro de execução — aborta o processamento.
 *
 * Equivalente ao `TjRuntimeError` do Ruby (MessageHandler.rb l.25): é erro
 * de programação / abort imediato. NÃO é pego pelo `catch` de
 * TextParser#parse (que só trata `TjError` ≈ TjException); propaga até o
 * topo, onde o driver o trata como falha do parse.
 */
export class TjRuntimeError extends Error {
  constructor(message: string,) {
    super(message,);
    this.name = "TjRuntimeError";
  }
}

/**
 * Erro base para erros de parse recuperáveis (≈ `TjException` do Ruby):
 * `TextParser#parse` captura e loga como `critical('parse', ...)`.
 */
export class TjError extends TjRuntimeError {
  constructor(message: string,) {
    super(message,);
    this.name = "TjError";
  }
}

/**
 * Erro de argumento inválido — usado para validação de parâmetros.
 */
export class TjArgumentError extends TjRuntimeError {
  constructor(message: string,) {
    super(message,);
    this.name = "TjArgumentError";
  }
}

/**
 * Erro interno — usado para situações impossíveis.
 */
export class TjInternalError extends TjRuntimeError {
  constructor(message: string,) {
    super(message,);
    this.name = "TjInternalError";
  }
}

/**
 * Erro quando um atributo tenta sobrescrever um valor já definido.
 */
export class AttributeOverwrite extends TjArgumentError {
  constructor(attributeId: string,) {
    super(`Attribute '${attributeId}' já está definido`,);
    this.name = "AttributeOverwrite";
  }
}

/**
 * Erro para métodos que dependem de fases futuras.
 */
export class NotYetImplementedError extends TjRuntimeError {
  constructor(phase: string, method: string,) {
    super(`O método '${method}' depende da Fase ${phase}`,);
    this.name = "NotYetImplementedError";
  }
}
