/**
 * Testes do bloco 2 de TjpSyntaxRules — cenário + extend + chargeset
 * (subfase 10.12.4).
 *
 * Cobre `rule_scenario*` (header, active/disabled/enabled), `rule_extend*`
 * (metaprogramação de atributos), `rule_chargeset` e os erros
 * `scenario_exists`, `extend_id_cap`, `account_bad_aggregate`.
 *
 * @see docs/syntaxmesh/fases/fase-10-parser-linguagem-tarefas.md §10.12.4
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import { Scenario, } from "../../src/model/scenario.ts";
import { ChargeSet, } from "../../src/finance/charge-set.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** Pega o Project resultante (lança se o parse não produziu um). */
function project(out: ReturnType<typeof parseProject>,): Project {
  assert(
    out.threw === null,
    "parse não deveria lançar: " + out.threw?.message,
  );
  assert(out.messageIds.length === 0, JSON.stringify(out.messages,),);
  return out.result as Project;
}

/** Pega o Project tolerando apenas os ids de mensagem listados. */
function projectTolerating(
  out: ReturnType<typeof parseProject>,
  allowed: string[],
): Project {
  assert(
    out.threw === null,
    "parse não deveria lançar: " + out.threw?.message,
  );
  for (const id of out.messageIds) {
    assert(allowed.includes(id,), id + " não permitido",);
  }
  return out.result as Project;
}

/** Project com corpo (cenários vivem no corpo do projeto). */
function projectBody(body: string,): string {
  return 'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n' + body +
    "}\n";
}

describe("rule_scenario + rule_scenarioHeader (10.12.4.1)", () => {
  it("cria Scenario com active yes no corpo do projeto", () => {
    const p = project(
      parseProject(projectBody('scenario s1 "S1" {\nactive yes\n}\n',),),
    );
    const s = p.scenario("s1",);
    assert(s instanceof Scenario,);
    assertEquals(s!.name, "S1",);
    assertEquals(s!.get("active",), true,);
  });

  it("disabled e enabled são apelidos depreciados de active", () => {
    // forma aninhada: dois headers top-level seguidos chamariam
    // clearProperties (semântica Ruby do cenário "default").
    const p = projectTolerating(
      parseProject(
        projectBody(
          'scenario on1 "On" {\nenabled\nscenario off1 "Off" {\ndisabled\n' +
            "}\n}\n",
        ),
      ),
      ["deprecated_keyword",],
    );
    assertEquals(p.scenario("on1",)!.get("active",), true,);
    assertEquals(p.scenario("off1",)!.get("active",), false,);
  });

  it("cenários aninhados coexistem e desativam hideScenario", () => {
    // Idiomático do TJ3 (Tutorial/tutorial.tjp): apenas UM scenario vive no
    // corpo do projeto; os demais aninham-se dentro dele (header aninhado
    // vê @property não-nil e não chama clearProperties).
    const p = project(
      parseProject(
        projectBody(
          'scenario a "A" {\nscenario b "B"\n}\n',
        ),
      ),
    );
    assertEquals(p.scenarios.toArray().length, 2,);
    assertEquals(MessageHandlerInstance.instance.hideScenario, false,);
  });

  it("id de cenário duplicado registra scenario_exists", () => {
    // Probe tj3 3.8.4: duplicata aninhada acha o externo no set flat.
    const out = parseProject(
      projectBody('scenario dup "D" {\nscenario dup "E"\n}\n',),
    );
    assert(out.messageIds.includes("scenario_exists",),);
  });
});

describe("rule_extend* (10.12.4.4)", () => {
  it("extend task cria atributo number global usável na task", () => {
    const p = project(
      parseProject(
        projectBody('extend task {\nnumber MyNum "My Num"\n}\n',) +
          'task t "T" {\nMyNum 42\n}\n',
      ),
    );
    assertEquals(p.task("t",)!.get("MyNum",), 42,);
  });

  it("extend com scenariospecific grava no cenário", () => {
    const p = project(
      parseProject(
        projectBody(
          'extend task {\ntext MyNote "My Note" { scenariospecific }\n}\n',
        ) + 'task t "T" {\nMyNote "hello"\n}\n',
      ),
    );
    assertEquals(p.task("t",)!.getForScenario("MyNote", 0,), "hello",);
  });

  it("id de atributo sem maiúscula inicial registra extend_id_cap", () => {
    const out = parseProject(
      projectBody('extend task {\nnumber lower "Lower"\n}\n',),
    );
    assert(out.messageIds.includes("extend_id_cap",),);
  });
});

describe("rule_chargeset (10.12.4.2)", () => {
  it("chargeset com conta aggregate tasks popula a lista do cenário", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'account dev "D" {\naggregate tasks\n}\n' +
          'task t "T" {\nchargeset dev 100%\n}\n',
      ),
    );
    const sets = p.task("t",)!.getForScenario("chargeset", 0,) as ChargeSet[];
    assertEquals(sets.length, 1,);
    assert(sets[0] instanceof ChargeSet,);
    assertEquals(sets[0]!.master?.fullId, "dev",);
  });

  it("conta com aggregate incompatível registra account_bad_aggregate", () => {
    const out = parseProject(
      PROJECT_HEADER + 'account fin "F" {\naggregate resources\n}\n' +
        'task t "T" {\nchargeset fin 100%\n}\n',
    );
    assert(out.messageIds.includes("account_bad_aggregate",),);
  });
});
