// monorepo/service-worker/src/utils/config.ts
// Versão do app — **derivada** de `@vanaware/syntaxmesh` (fonte única:
// `packages/core/src/version.ts`, gerada pelo build com `__APP_VERSION__` e
// reexportada como `VERSION` pelo barril do core). Nenhum literal aqui: um bump
// só acontece em `version.ts`/manifestos.
//
// Importa o subcaminho `./version` em vez do barril `.`: o service-worker roda
// em bundle próprio e não deve arrastar o core inteiro (micromark, vento,
// registro de reports) só para ler uma string.

export { APP_VERSION, } from "@vanaware/syntaxmesh/version";
