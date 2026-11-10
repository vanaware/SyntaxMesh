/**
 * Error raised when processing must abort.
 *
 * The equivalent of Ruby's `TjRuntimeError` (MessageHandler.rb l.25): it signals
 * a programming error or an immediate abort. It is deliberately **not** caught
 * by `TextParser#parse`, which only handles `TjError` (≈ `TjException`); it
 * propagates to the top, where the driver reports a failed parse.
 */
export class TjRuntimeError extends Error {
  /**
   * Creates the error.
   *
   * @param message Human-readable description.
   */
  constructor(message: string,) {
    super(message,);
    this.name = "TjRuntimeError";
  }
}

/**
 * Base class of recoverable parse errors (≈ Ruby's `TjException`).
 *
 * `TextParser#parse` catches these and logs them as `critical('parse', …)`,
 * which lets the parser continue with the next rule instead of aborting.
 */
export class TjError extends TjRuntimeError {
  /**
   * Creates the error.
   *
   * @param message Human-readable description.
   */
  constructor(message: string,) {
    super(message,);
    this.name = "TjError";
  }
}

/** Error raised when an argument is invalid or missing. */
export class TjArgumentError extends TjRuntimeError {
  /**
   * Creates the error.
   *
   * @param message Human-readable description.
   */
  constructor(message: string,) {
    super(message,);
    this.name = "TjArgumentError";
  }
}

/** Error raised for states the implementation considers impossible. */
export class TjInternalError extends TjRuntimeError {
  /**
   * Creates the error.
   *
   * @param message Human-readable description.
   */
  constructor(message: string,) {
    super(message,);
    this.name = "TjInternalError";
  }
}

/** Error raised when an attribute tries to overwrite a value already set. */
export class AttributeOverwrite extends TjArgumentError {
  /**
   * Creates the error.
   *
   * @param attributeId Attribute that was written twice.
   */
  constructor(attributeId: string,) {
    super(`Attribute '${attributeId}' já está definido`,);
    this.name = "AttributeOverwrite";
  }
}

/** Error raised by methods that depend on a phase not implemented yet. */
export class NotYetImplementedError extends TjRuntimeError {
  /**
   * Creates the error.
   *
   * @param phase Phase that owns the missing behaviour.
   * @param method Method that was called.
   */
  constructor(phase: string, method: string,) {
    super(`O método '${method}' depende da Fase ${phase}`,);
    this.name = "NotYetImplementedError";
  }
}
