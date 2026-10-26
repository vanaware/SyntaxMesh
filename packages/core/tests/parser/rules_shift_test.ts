/**
 * Testes do bloco 2 de TjpSyntaxRules — shift (subfase 10.12.3).
 *
 * Cobre `rule_shift`/`rule_shiftHeader`, `rule_shiftScenarioAttributes`
 * (replace, timezone, vacation, workinghours) e `rule_validTimeZone`.
 *
 * @see docs/syntaxmesh/fases/fase-10-parser-linguagem-tarefas.md §10.12.3
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import { Shift, } from "../../src/model/shift.ts";
import { Leave, } from "../../src/model/leave.ts";
import { WorkingHours, } from "../../src/calendar/working-hours.ts";
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

describe("rule_shift + rule_shiftHeader (10.12.3.1)", () => {
  it("cria Shift com id e nome, registrado no projeto", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'shift morning "Morning" {\nworkinghours mon - fri 9:00 - 17:00\n}\n',
      ),
    );
    const s = p.shift("morning",);
    assert(s instanceof Shift,);
    assertEquals(s!.name, "Morning",);
  });

  it("id duplicado registra shift_exists", () => {
    const out = parseProject(
      PROJECT_HEADER + 'shift s1 "A" {\n}\nshift s1 "B" {\n}\n',
    );
    assert(out.messageIds.includes("shift_exists",),);
  });
});

describe("rule_shiftScenarioAttributes (10.12.3.2)", () => {
  it("workinghours povoa WorkingHours do cenário", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'shift w "W" {\nworkinghours mon - fri 9:00 - 17:00\n}\n',
      ),
    );
    const wh = p.shift("w",)!.getForScenario("workinghours", 0,);
    assert(wh instanceof WorkingHours, "workinghours instalada",);
  });

  it("replace liga o modo de substituição de leaves", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'shift r "R" {\nreplace\n}\n',),
    );
    assertEquals(p.shift("r",)!.getForScenario("replace", 0,), true,);
  });

  it("timezone válido é armazenado; inválido registra bad_time_zone", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'shift ok "OK" {\ntimezone "Europe/Berlin"\n}\n',
      ),
    );
    assertEquals(
      p.shift("ok",)!.getForScenario("timezone", 0,),
      "Europe/Berlin",
    );

    const out = parseProject(
      PROJECT_HEADER +
        'shift bad "Bad" {\ntimezone "Not/AZone"\n}\n',
    );
    assert(out.messageIds.includes("bad_time_zone",),);
  });

  it("vacation vira Leave(holiday) sem reason na lista de leaves", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'shift v "V" {\nvacation "Xmas" 2026-12-24 - 2026-12-25\n}\n',
      ),
    );
    const leaves = p.shift("v",)!.getForScenario("leaves", 0,) as Leave[];
    assertEquals(leaves.length, 1,);
    assertEquals(leaves[0]!.type, "holiday",);
    // Ruby: `Leave.new(:holiday, interval)` — o nome da vacation é descartado.
    assertEquals(leaves[0]!.reason, null,);
  });
});

describe("agregados de shift (10.12.4.10)", () => {
  it('agregado: `shift morning "Morning" { workinghours mon - fri 9:00 - 17:00 }`', () => {
    const p = project(
      parseProject(
        PROJECT_HEADER +
          'shift morning "Morning" {\nworkinghours mon - fri 9:00 - 17:00\n}\n',
      ),
    );
    assert(p.shift("morning",)!.getForScenario("workinghours", 0,),);
  });
});
