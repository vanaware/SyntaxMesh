/**
 * Barrel do módulo parser (Fase 10 — port de TextParser/*).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/
 */
export { Pattern, type Token, type TokenType, } from "./pattern.ts";
export { Rule, } from "./rule.ts";
export { StackElement, TextParserResultArray, } from "./stack-element.ts";
export {
  State,
  type StateKey,
  stateKeyOf,
  type StateKeys,
  StateTransition,
} from "./state.ts";
export {
  type ParserActionHost,
  type ParserToken,
  TextParser,
  tokenTypeToInt,
} from "./text-parser.ts";
export { detectLanguage, ProjectFileParser, } from "./project-file-parser.ts";
