/**
 * Shim de compatibilidade — as classes lógicas vivem agora em `src/logic/`
 * (Fase 11). Este módulo re-exporta as implementações completas para que o
 * parser (Fase 10) e os reports continuem importando o mesmo caminho, e para
 * que o parser construa exatamente os objetos que a Fase 11 avalia.
 *
 * @see packages/core/src/logic/
 */
export { LogicalOperation, } from "../logic/logical-operation.ts";
export { LogicalExpression, } from "../logic/logical-expression.ts";
export { LogicalAttribute, } from "../logic/logical-attribute.ts";
export { LogicalFlag, } from "../logic/logical-flag.ts";
export { LogicalFunction, } from "../logic/logical-function.ts";
