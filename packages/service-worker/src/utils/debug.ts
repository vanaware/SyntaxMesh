// monorepo/service-worker/src/utils/debug.ts
// Substituto local de @syntaxmesh/utils/debug (pacote removido na simplificação de arquitetura).
// Log simples para depuração — o código real do SW ainda não foi desenvolvido.

/**
 * Registra uma mensagem de debug no console.
 * Assinatura compatível com a utilidade original:
 *   addDebugLog(message: string)
 *   addDebugLog(level: string, module: string, message: string)
 */
export function addDebugLog(
  arg1: string,
  arg2?: string,
  arg3?: string,
): void {
  let message: string;
  if (arg2 !== undefined && arg3 !== undefined) {
    // addDebugLog(level, module, message)
    message = `[${arg2}] ${arg3}`;
  } else {
    // addDebugLog(message)
    message = arg1;
  }
  console.debug(`[SW-DEBUG] ${message}`);
}
