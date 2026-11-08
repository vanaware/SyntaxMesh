/**
 * Versão da aplicação — **fonte única** do runtime.
 *
 * Consumidores: `AppConfig.version` (banner e `--version` da CLI) e o atributo
 * `version` de `Project`. O build/tag (`scripts/tag-version.ts` via
 * `@vanaware/buildit`) reescreve este arquivo e o `package.json` da raiz; os
 * dois precisam concordar (coberto por `packages/cli/tests/version_test.ts`).
 */
export const VERSION = "0.0.2";
