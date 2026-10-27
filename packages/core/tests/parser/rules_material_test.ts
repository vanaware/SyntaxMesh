/**
 * C3.1 — parser aceita `material`, `supplement material` e alocação de
 * material em tarefas. Cobrea as tarefas atômicas C3.1.1–C3.1.4.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

describe("C3.1.1 material body", () => {
  it("material com unit/unitprice/totalquantity registra atributos", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'material ac "Aço" {\nunit "kg"\nunitprice 5\ntotalquantity 100\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const m = parser.project!.material("ac",)!;
    assert(m !== null, "material ac não registrado",);
    assertEquals(m.get("unit",), "kg",);
    assertEquals(m.get("cost",), 5,);
    assertEquals(m.get("totalquantity",), 100,);
  });

  it("material aceita chargeset (atributo de cenário)", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'account cst "Custo" {\naggregate materials\n}\n' +
        'material ac "Aço" {\nchargeset cst 100%\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const m = parser.project!.material("ac",)!;
    const sets = m.getForScenario("chargeset", 0,) as unknown[];
    assertEquals(sets.length, 1,);
  });

  it("material aceita journalentry", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'material ac "Aço" {\n' +
        'journalentry 2026-02-01 "Chegada"\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
  });
});

describe("C3.1.2 materialAllocation em task", () => {
  it("material <id> <q> <modificador> produz MaterialAllocation na task", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'material ac "Aço" {\nunit "kg"\n}\n' +
        'task t "T" {\nmaterial ac 100 perday\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const t = parser.project!.task("t",)!;
    const allocs = t.getForScenario("materialallocations", 0,) as unknown[];
    assertEquals(allocs.length, 1,);
    const a = allocs[0] as MaterialAllocation;
    assert(a instanceof MaterialAllocation, "não é MaterialAllocation",);
    assertEquals(a.quantity, 100,);
    assertEquals(a.modifier, "perday",);
    assertEquals(a.material, parser.project!.material("ac",),);
  });

  it("use é alias de material e default modifier = distributed", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'material ac "Aço" {\nunit "kg"\n}\n' +
        'task t "T" {\nuse ac 50\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const t = parser.project!.task("t",)!;
    const allocs = t.getForScenario("materialallocations", 0,) as unknown[];
    assertEquals(allocs.length, 1,);
    const a = allocs[0] as MaterialAllocation;
    assertEquals(a.modifier, "distributed",);
  });
});

describe("C3.1.3 supplement material", () => {
  it("supplement material atualiza atributos existentes", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'material ac "Aço" {\nunit "kg"\ntotalquantity 100\n}\n' +
        "supplement material ac {\ntotalquantity 200\n}\n",
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const m = parser.project!.material("ac",)!;
    assertEquals(m.get("totalquantity",), 200,);
  });
});

describe("C3.1.4 integração material no top-level", () => {
  it("dois materiais + task processam juntos", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER +
        'material ac "Aço" {\nunit "kg"\nunitprice 5\n}\n' +
        'material ct "Concreto" {\nunit "m3"\nunitprice 80\n}\n' +
        'task t "Fundaçao" {\nmaterial ac 100 perday\nuse ct 12 distributed\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    assert(parser.project!.material("ac",) !== null,);
    assert(parser.project!.material("ct",) !== null,);
    const allocs = parser.project!.task("t",)!.getForScenario(
      "materialallocations",
      0,
    ) as unknown[];
    assertEquals(allocs.length, 2,);
  });
});
