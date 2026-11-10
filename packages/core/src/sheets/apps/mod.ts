/**
 * Barrel of the sheet apps (18.18).
 *
 * The core of the five executables (`tj3ts_*`, `tj3ss_*`) lives here;
 * `OptionParser`, `stdin` and `Deno.exit` stay with the **phase 24** wrapper
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
