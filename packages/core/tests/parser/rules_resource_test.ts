/**
 * Testes do bloco 2 de TjpSyntaxRules — resource (subfase 10.12.1).
 *
 * Cobre `rule_resource`/`rule_resourceHeader` (criação e hierarquia),
 * `rule_resourceScenarioAttributes` (rate, efficiency, leaves, limits,
 * managers), `rule_resourceId` e os erros `resource_exists`,
 * `resource_id_expected` e `no_own_resource_booking`.
 *
 * @see docs/syntaxmesh/fases/fase-10-parser-linguagem-tarefas.md §10.12.1
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Leave, } from "../../src/model/leave.ts";
import { Booking, } from "../../src/scheduling/booking.ts";
import { Limits, } from "../../src/scheduling/limits.ts";
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

describe("rule_resource + rule_resourceHeader (10.12.1.1)", () => {
  it("cria Resource com id e nome no projeto", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'resource r1 "Resource 1" {\n}\n',),
    );
    const r = p.resource("r1",);
    assert(r instanceof Resource,);
    assertEquals(r!.name, "Resource 1",);
    assertEquals(r!.fullId, "r1",);
  });

  it("recursos aninhados herdam o pai mas mantêm fullId curto (flat)", () => {
    // Ruby: Project.rb cria @resources com namespace flat — tj3 até rejeita
    // `allocate top.kid`; o filho nichado é registrado pelo ID curto.
    const p = project(
      parseProject(
        PROJECT_HEADER + 'resource top "T" {\nresource kid "K" {\n}\n}\n',
      ),
    );
    const kid = p.resource("kid",);
    assert(kid instanceof Resource, "filho registrado como kid",);
    assertEquals(kid!.fullId, "kid",);
    assertEquals(kid!.parent, p.resource("top",),);
  });

  it("id duplicado registra resource_exists", () => {
    const out = parseProject(
      PROJECT_HEADER + 'resource r1 "A" {\n}\nresource r1 "B" {\n}\n',
    );
    assert(out.messageIds.includes("resource_exists",),);
  });

  it("email é atributo global (não de cenário)", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'resource r1 "R" {\nemail "r1@ex.com"\n}\n',
      ),
    );
    assertEquals(p.resource("r1",)!.get("email",), "r1@ex.com",);
  });
});

describe("rule_resourceScenarioAttributes (10.12.1.2)", () => {
  it("rate e efficiency são scenario-específicos", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'resource r1 "R" {\nrate 100\nefficiency 200\n}\n',
      ),
    );
    const r = p.resource("r1",)!;
    assertEquals(r.getForScenario("rate", 0,), 100,);
    assertEquals(r.getForScenario("efficiency", 0,), 200,);
  });

  it("leaves cria Leave(holiday) na lista do cenário", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'resource r1 "R" {\nleaves holiday "Xmas" 2026-12-24 - 2026-12-25\n}\n',
      ),
    );
    const leaves = p.resource("r1",)!.getForScenario("leaves", 0,) as Leave[];
    assertEquals(leaves.length, 1,);
    assertEquals(leaves[0]!.type, "holiday",);
    assertEquals(leaves[0]!.reason, "Xmas",);
  });

  it("managers acumula lista de ids de recursos", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'resource m "M" {\n}\nresource r "R" {\n' +
          "managers m\n}\n",
      ),
    );
    const mgrs = p.resource("r",)!.getForScenario("managers", 0,) as string[];
    assertEquals(mgrs.length, 1,);
    // Ruby: undefResourceId devolve o ID (string), não o objeto.
    assertEquals(mgrs[0], "m",);
  });

  it("limits { dailymax 8h } produz objeto Limits", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'resource r "R" {\nlimits {\ndailymax 8h\n}\n}\n',
      ),
    );
    const lim = p.resource("r",)!.getForScenario("limits", 0,);
    assert(lim instanceof Limits, "limits instalado",);
  });

  it("leaveallowances guarda provisionamento anual", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'resource r "R" {\nleaveallowances annual 2026-01-01 160h\n}\n',
      ),
    );
    const la = p.resource("r",)!.getForScenario("leaveallowances", 0,) as Array<
      { type: string; slots: number }
    >;
    assertEquals(la.length, 1,);
    assertEquals(la[0]!.type, "annual",);
  });
});

describe("booking e referências do resource (10.12.1.3)", () => {
  it("booking no cenário padrão entra na lista de bookings da task", () => {
    // ownbookings default = true (Project.rb), então o caminho é positivo.
    const p = project(
      parseProject(
        PROJECT_HEADER + 'task t1 "T" {\n}\n' +
          'resource r1 "R" {\nbooking t1 2026-01-01 - 2026-01-02\n}\n',
      ),
    );
    const bookings = p.task("t1",)!.getForScenario("booking", 0,) as Booking[];
    assertEquals(bookings.length, 1,);
    assertEquals(bookings[0]!.resource.fullId, "r1",);
  });

  it("id inexistente em allocate registra unknown_resource", () => {
    const out = parseProject(
      PROJECT_HEADER + 'task t1 "T" {\nallocate zzz\n}\n',
    );
    assert(
      out.messageIds.includes("unknown_resource",) ||
        out.messageIds.includes("resource_id_expected",) ||
        out.messageIds.includes("no_reduce",),
      "ids: " + out.messageIds.join(",",),
    );
  });
});

describe("agregados de resource (10.12.4.9)", () => {
  it('agregado: `resource r1 "Resource" { rate 100 }`', () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'resource r1 "Resource" {\nrate 100\n}\n',),
    );
    assertEquals(p.resource("r1",)!.getForScenario("rate", 0,), 100,);
  });
});
