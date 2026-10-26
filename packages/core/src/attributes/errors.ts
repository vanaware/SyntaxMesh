/**
 * Erros do sistema de atributos — re-exporta de model/errors.ts (Fase 9).
 *
 * Mantém compatibilidade com imports existentes de Fase 3-8.
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
