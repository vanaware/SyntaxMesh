/**
 * 26.10.2 — Smoke test do runner consolidado (`deno task test:all`).
 *
 * Vive em `tests/unit/` (raiz do workspace) e exercita a superfície
 * pública do barril do core via import relativo — garante que o runner
 * consolidado enxerga os testes dos pacotes e os de `tests/unit/`, e que
 * o barril publicado parseia um projeto mínimo de ponta a ponta.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.10)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  MessageHandlerInstance,
  ProjectFileParser,
  VERSION,
} from "../../packages/core/src/mod.ts";
import type { Project, } from "../../packages/core/src/model/project.ts";

const SOURCE = `project smoke "Smoke" "1.0" 2026-01-01 - 2026-03-31 {
  timezone "UTC"
  now 2026-01-15
}
task t1 "Only task" { start 2026-01-05 }
`;

describe("Workspace smoke (26.10.2)", () => {
  it("barril do core exporta VERSION (string; vazia fora do build)", () => {
    // APP_VERSION é injetada no build (__APP_VERSION__); em dev é "".
    assertEquals(typeof VERSION, "string",);
  });

  it("parse de projeto mínimo pela API pública", () => {
    MessageHandlerInstance.instance.reset();
    const parser = new ProjectFileParser();
    parser.open(SOURCE, true, true,);
    const result: unknown = parser.parse("project",);
    assert(result !== null && result !== false, "parse não retornou Project",);
    const project = result as Project;
    assertEquals(project.id, "smoke",);
    assertEquals(project.tasks.toArray().length, 1,);
    assertEquals(MessageHandlerInstance.instance.errors, 0,);
  });
});
