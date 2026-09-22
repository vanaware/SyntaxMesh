// Re-export rubyRound from compat.ts for convenience.
// Avoids circular dependency: compat.ts does not import from num.ts.
export { rubyRound, } from "../compat.ts";
