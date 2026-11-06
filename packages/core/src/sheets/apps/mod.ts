/**
 * Barrel dos apps de sheet (18.18).
 *
 * O núcleo dos cinco executáveis (`tj3ts_*`, `tj3ss_*`) mora aqui; o
 * `OptionParser`, o `stdin` e o `Deno.exit` ficam com o wrapper da **Fase 24**
 * (`docs/syntaxmesh/fases/fase-24-cli.md` §5.4).
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18)
 */

export * from "./app-base.ts";
export * from "./ss-receiver-app.ts";
export * from "./ss-sender-app.ts";
export * from "./ts-receiver-app.ts";
export * from "./ts-sender-app.ts";
export * from "./ts-summary-app.ts";
