/**
 * E2E suite of the `scheduler-correct` corpus group (26.3/26.5, F21 wave 1).
 * One file per group: Deno runs them in parallel over the shared harness.
 *
 * @see packages/cli/tests/golden/e2e-harness.ts
 * @see docs/syntaxmesh/decisoes/042-estrategia-validacao.md
 */
import { registerGroup, } from "./golden/e2e-harness.ts";

registerGroup("scheduler-correct",);
