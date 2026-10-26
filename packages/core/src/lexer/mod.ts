/**
 * Barrel do módulo lexer (Fase 10 — port de TextParser/*).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/
 */
export { Macro, MacroTable, } from "./macro-table.ts";
export {
  BufferStreamHandle,
  dirnameOf,
  FileStreamHandle,
  type FileTextLoader,
  LineScanner,
  type LogLike,
  type MacroStackEntry,
  type ScannerHostLike,
  StreamHandle,
  TextStream,
} from "./stream-handle.ts";
export {
  Scanner,
  type ScannerToken,
  type TokenPattern,
  type TokenPostProcessor,
} from "./scanner.ts";
export { ProjectFileScanner, TJP_MODES, } from "./project-file-scanner.ts";
export { TokenDoc, } from "./token-doc.ts";
