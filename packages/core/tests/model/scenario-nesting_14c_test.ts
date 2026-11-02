/**
 * 14C.17 — Cenários: caracterização do comportamento real (Adendo Extra §12.5).
 *
 * Confirma, com evidência por teste, o que a fonte Ruby (`TjpSyntaxRules.rb`,
 * `Project.rb`, `PropertyTreeNode.rb`) e o port TypeScript concordam:
 *
 *  - cenários usam **flatNamespace**: `fullId` de um cenário aninhado é o ID
 *    curto, não o caminho pontuado completo (§13.5, PropertyTreeNode.rb:294-303)
 *  - herança de atributos pelo **aninhamento** (`inheritedFromParent`)
 *  - aninhamento é **recursivo** no parser (`scenarioAttributes` inclui
 *    `p.pattern(["!scenario"])`)
 *  - redeclarar o top-level **limpa** os cenários anteriores
 *    (`clearProperties` quando `this.property === null`)
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §13.5
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { parseProject, } from "../parser/parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";

/** Parseia scenario dentro do corpo do project e lança se houver erros. */
function parseScenario(scenarioBody: string,): Project {
  const { parser, messageIds, messages, threw, result, } = parseProject(
    `project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n${scenarioBody}}\n`,
  );
  assertEquals(
    threw,
    null,
    `exceção: ${threw?.message ?? ""}`,
  );
  assertEquals(
    messageIds,
    [],
    `msgs: ${messages.map((m,) => m.id).join(" | ",)}`,
  );
  assert(result !== false, `parse falhou: ${messageIds.join(",",)}`,);
  return parser.project!;
}

// ─── 14C.17.2 — caracterização: cenário de 2 níveis ─────────────────────────

describe("14C.17.2 — cenário de 2 níveis: aninhamento e registro", () => {
  it("aninhamento recursivo: scenario dentro de scenario registra ambos", () => {
    const project = parseScenario(
      'scenario plan "Plan" {\n' +
        '  scenario real "Real" {\n  }\n' +
        "}\n",
    );
    const plan = project.scenario("plan",);
    const real = project.scenario("real",);
    assert(plan !== null, "plan não registrado",);
    assert(real !== null, "real não registrado",);
  });

  it("fullId de real aninhado em plan é 'real' (flatNamespace, §13.5)", () => {
    const project = parseScenario(
      'scenario plan "Plan" {\n' +
        '  scenario real "Real" {\n  }\n' +
        "}\n",
    );
    const real = project.scenario("real",)!;
    // flatNamespace = true em project.scenarios → fullId = subId = "real"
    // Ruby PropertyTreeNode.rb:294-303: com flatNamespace devolve @subId
    assertEquals(real.fullId, "real",);
    // NÃO é "plan.real" (comportamento divergente que se suspeitava no §12)
    assertEquals(real.fullId.includes(".",), false,);
  });

  it("parent de real é plan: estrutura de árvore de cenários", () => {
    const project = parseScenario(
      'scenario plan "Plan" {\n' +
        '  scenario real "Real" {\n  }\n' +
        "}\n",
    );
    const plan = project.scenario("plan",)!;
    const real = project.scenario("real",)!;
    assertEquals(real.parent, plan,);
    assertEquals(plan.parent, null,); // plan é top-level
  });

  it("herança por aninhamento: real herda projection de plan", () => {
    // `projection` é BooleanAttribute com inheritedFromParent=true.
    // Se plan define `active yes`, real.inheritFromParent deve resolver para plan.
    const project = parseScenario(
      'scenario plan "Plan" {\n' +
        "  active no\n" +
        '  scenario real "Real" {\n  }\n' +
        "}\n",
    );
    const real = project.scenario("real",)!;
    // plan tem `active = false` (defined in plan)
    // real does NOT define `active` → inherits from parent (plan)
    // PTN.get("active") walks parent chain for inheritedFromParent attrs
    assertEquals(real.get("active",), false,);
  });
});

// ─── 14C.17.3 — redeclarar top-level limpa cenários (clearProperties) ───────

describe("14C.17.3 — clearProperties: redeclarar cenário top-level limpa anteriores", () => {
  it("segundo scenario no mesmo nível apaga o primeiro (Ruby l.5184)", () => {
    const project = parseScenario(
      'scenario s1 "S1" {\n}\n' +
        'scenario s2 "S2" {\n}\n',
    );
    // Depois do parse de s2, s1 foi removido por clearProperties
    assertEquals(project.scenario("s1",), null,);
    assert(project.scenario("s2",) !== null, "s2 deve existir",);
    // plan foi limpo também (clearProperties remove tudo)
    assertEquals(project.scenario("plan",), null,);
    // Apenas s2 permanece
    assertEquals(
      project.scenarioCount,
      1,
      `esperado 1 cenário, tem ${project.scenarioCount}`,
    );
  });
});
