/**
 * Erros do sistema de atributos — re-exporta de model/errors.ts (Fase 9).
 *
 * Mantém compatibilidade com imports existentes de Fase 3-8.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AttributeBase.rb (raise ArgumentError, RuntimeError)
 */
export {
  TjError,
  TjArgumentError,
  TjRuntimeError,
  TjInternalError,
  AttributeOverwrite,
  NotYetImplementedError,
} from "../model/errors.ts";