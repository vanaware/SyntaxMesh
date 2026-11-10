/**
 * Compatibility shim — the logical classes now live in `src/logic/` (phase 11).
 * This module re-exports the full implementations so that the parser (phase 10)
 * and the reports keep importing the same path, and so that the parser builds
 * exactly the objects that phase 11 evaluates.
 *
 * @see packages/core/src/logic/
 */
export { LogicalOperation, } from "../logic/logical-operation.ts";
export { LogicalExpression, } from "../logic/logical-expression.ts";
export { LogicalAttribute, } from "../logic/logical-attribute.ts";
export { LogicalFlag, } from "../logic/logical-flag.ts";
export { LogicalFunction, } from "../logic/logical-function.ts";
