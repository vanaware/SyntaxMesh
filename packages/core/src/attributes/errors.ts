/**
 * Attribute system errors — re-exported from model/errors.ts (phase 9).
 *
 * Keeps compatibility with the imports that existed in phases 3-8.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb (raise ArgumentError, RuntimeError)
 */
export {
  AttributeOverwrite,
  NotYetImplementedError,
  TjArgumentError,
  TjError,
  TjInternalError,
  TjRuntimeError,
} from "../model/errors.ts";
