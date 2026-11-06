/**
 * Barrel do subsistema de time/status sheets (Fase 18).
 *
 * `email-message` descreve a mensagem como dado (ADR 036); `sheet-handler-base`
 * é a base comum de senders e receivers; `sheet-sender`/`sheet-receiver` são os
 * pipelines dos blocos B e C; `time-sheet-summary` fecha o bloco D; `apps/`
 * guarda o núcleo dos cinco executáveis (18.18).
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md
 */

export * from "./apps/mod.ts";
export * from "./email-message.ts";
export * from "./sheet-handler-base.ts";
export * from "./sheet-receiver.ts";
export * from "./sheet-sender.ts";
export * from "./status-sheet-receiver.ts";
export * from "./status-sheet-sender.ts";
export * from "./time-sheet-receiver.ts";
export * from "./time-sheet-sender.ts";
export * from "./time-sheet-summary.ts";
