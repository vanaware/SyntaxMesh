/**
 * Barrel of the time/status sheets subsystem (phase 18).
 *
 * `email-message` describes the message as data (ADR 036); `sheet-handler-base`
 * is the common base for senders and receivers; `sheet-sender`/`sheet-receiver`
 * are the pipelines of blocks B and C; `time-sheet-summary` closes block D;
 * `apps/` holds the core of the five executables (18.18); `app-data` is the
 * phase 24 data path (24.2.32: in-memory `FileStore`, output as a value).
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md
 */

export * from "./app-data.ts";
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
