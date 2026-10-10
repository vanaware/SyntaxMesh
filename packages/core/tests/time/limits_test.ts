import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { Limit, Limits, } from "../../src/scheduling/limits.ts";
import { ScoreboardInterval, } from "../../src/time/scoreboard-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { MockProject, } from "../model/mock-project.ts";
import { Resource, } from "../../src/model/resource.ts";

/** Cria um recurso mockado para testes de limite por resource. */
function makeResource(project: MockProject, id: string,): Resource {
  return new Resource(project, id, id, null,);
}

describe("Limit", () => {
  const sbStart = TjTime.fromDate(new Date("2026-01-01T00:00:00Z",),);
  const sbEnd = TjTime.fromDate(new Date("2026-01-08T00:00:00Z",),);

  it("constructor cria Limit com campos corretos", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    assertEquals(limit.name, "dailymax",);
    assertEquals(limit.period, 86400,);
    assertEquals(limit.value, 8,);
    assertEquals(limit.upper, true,);
    assertEquals(limit.resource, null,);
    assertEquals(limit.getScoreboard().size, 8,);
    assertEquals(limit.getDirty(), false,);
  });

  it("copy cria cópia profunda", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    limit.inc(0, null,);
    const copy = limit.copy();
    assertEquals(copy.name, "dailymax",);
    assertEquals(copy.value, 8,);
    assertEquals(copy.getScoreboard().get(0,), 1,);
    assert(
      copy.getScoreboard() !== limit.getScoreboard(),
      "scoreboard deve ser cópia, não compartilhado",
    );
  });

  it("reset sem index reseta todos os slots", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    limit.inc(0, null,);
    limit.inc(1, null,);
    limit.reset();
    assertEquals(limit.getScoreboard().get(0,), 0,);
    assertEquals(limit.getScoreboard().get(1,), 0,);
    assertEquals(limit.getDirty(), false,);
  });

  it("reset com index reseta apenas o slot", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    limit.inc(0, null,);
    limit.inc(1, null,);
    limit.reset(0,);
    assertEquals(limit.getScoreboard().get(0,), 0,);
    assertEquals(limit.getScoreboard().get(1,), 1,);
    assertEquals(limit.getDirty(), false,);
  });

  it("inc dentro do intervalo incrementa", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    limit.inc(0, null,);
    assertEquals(limit.getScoreboard().get(0,), 1,);
    limit.inc(0, null,);
    assertEquals(limit.getScoreboard().get(0,), 2,);
    assertEquals(limit.getDirty(), true,);
  });

  it("inc fora do intervalo não incrementa", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    limit.inc(200, null,);
    assertEquals(limit.getScoreboard().get(0,), 0,);
    assertEquals(limit.getDirty(), false,);
  });

  it("inc filtra por resource", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const project = new MockProject(2,);
    const resource = makeResource(project, "r1",);
    const limit = new Limit("dailymax", interval, 86400, 8, true, resource,);
    limit.inc(0, resource,);
    assertEquals(limit.getScoreboard().get(0,), 1,);
    limit.inc(0, null,);
    assertEquals(
      limit.getScoreboard().get(0,),
      1,
      "resource diferente não incrementa",
    );
  });

  it("dec decrementa", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    limit.inc(0, null,);
    limit.inc(0, null,);
    limit.dec(0, null,);
    assertEquals(limit.getScoreboard().get(0,), 1,);
    assertEquals(limit.getDirty(), true,);
  });

  it("ok? dailymax retorna true quando abaixo do limite", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    limit.inc(0, null,);
    assertEquals(limit.ok(0, true, null,), true,);
  });

  it("ok? dailymax retorna false quando acima do limite", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    for (let i = 0; i < 9; i++) {
      limit.inc(0, null,);
    }
    assertEquals(limit.ok(0, true, null,), false,);
  });

  it("ok? dailymin retorna true quando acima do limite", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymin", interval, 86400, 4, false,);
    limit.inc(0, null,);
    limit.inc(0, null,);
    limit.inc(0, null,);
    limit.inc(0, null,);
    limit.inc(0, null,);
    assertEquals(limit.ok(0, false, null,), true,);
  });

  it("ok? dailymin retorna false quando abaixo do limite", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymin", interval, 86400, 4, false,);
    limit.inc(0, null,);
    assertEquals(limit.ok(0, false, null,), false,);
  });

  it("ok? com resource filtra", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const project = new MockProject(2,);
    const resource = makeResource(project, "r1",);
    const limit = new Limit("dailymax", interval, 86400, 8, true, resource,);
    limit.inc(0, resource,);
    assertEquals(limit.ok(0, true, resource,), true,);
    assertEquals(
      limit.ok(0, true, null,),
      true,
      "resource diferente retorna true",
    );
  });

  it("ok? com index null verifica todos os slots", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    for (let i = 0; i < 9; i++) {
      limit.inc(0, null,);
    }
    assertEquals(
      limit.ok(null, true, null,),
      false,
      "um slot acima do limite torna ok false",
    );
  });

  it("ok? com index fora do intervalo retorna true", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    assertEquals(limit.ok(200, true, null,), true,);
  });

  it("ok? com upper diferente retorna true", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    limit.inc(0, null,);
    for (let i = 1; i < 9; i++) {
      limit.inc(i, null,);
    }
    assertEquals(
      limit.ok(0, false, null,),
      true,
      "upper diferente retorna true",
    );
  });

  it("idxToSbIdx converte corretamente", () => {
    const interval = new ScoreboardInterval(sbStart, 3600, 0, 167,);
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    assertEquals(limit["idxToSbIdx"](0,), 0,);
    assertEquals(limit["idxToSbIdx"](24,), 1,);
    assertEquals(limit["idxToSbIdx"](48,), 2,);
  });
});

describe("Limits", () => {
  it("constructor cria Limits vazio", () => {
    const limits = new Limits();
    assertEquals(limits.limits.length, 0,);
  });

  it("constructor copy cria cópia profunda", () => {
    const interval = new ScoreboardInterval(
      TjTime.fromDate(new Date("2026-01-01T00:00:00Z",),),
      3600,
      0,
      167,
    );
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    limit.inc(0, null,);
    const limits = new Limits([limit,],);
    const copy = new Limits(limits,);
    assertEquals(copy.limits.length, 1,);
    assertEquals(copy.limits[0]!.getScoreboard().get(0,), 1,);
    assert(
      copy.limits[0]!.getScoreboard() !== limits.limits[0]!.getScoreboard(),
      "scoreboard deve ser cópia",
    );
  });

  it("setProject lança se já tem limites", () => {
    const limits = new Limits();
    const interval = new ScoreboardInterval(
      TjTime.fromDate(new Date("2026-01-01T00:00:00Z",),),
      3600,
      0,
      167,
    );
    limits.limits.push(new Limit("dailymax", interval, 86400, 8, true,),);
    const project = new MockProject(2,);
    assertThrows(
      () => limits.setProject(project,),
      Error,
      "Cannot set project",
    );
  });

  it("setProject associa projeto", () => {
    const limits = new Limits();
    const project = new MockProject(2,);
    limits.setProject(project,);
    assertEquals(limits.getProject(), project,);
  });

  it("reset reseta todos os limites", () => {
    const limits = new Limits();
    const interval = new ScoreboardInterval(
      TjTime.fromDate(new Date("2026-01-01T00:00:00Z",),),
      3600,
      0,
      167,
    );
    const limit = new Limit("dailymax", interval, 86400, 8, true,);
    limit.inc(0, null,);
    limits.limits.push(limit,);
    limits.reset();
    assertEquals(limit.getScoreboard().get(0,), 0,);
  });

  it("setLimit dailymax cria limite diário", () => {
    const limits = new Limits();
    const project = new MockProject(2,);
    limits.setProject(project,);
    limits.setLimit("dailymax", 8,);
    assertEquals(limits.limits[0]!.name, "dailymax",);
    assertEquals(limits.limits[0]!.period, 86400,);
    assertEquals(limits.limits[0]!.value, 8,);
    assertEquals(limits.limits[0]!.upper, true,);
  });

  it("setLimit weeklymax cria limite semanal", () => {
    const limits = new Limits();
    const project = new MockProject(2,);
    limits.setProject(project,);
    limits.setLimit("weeklymax", 40,);
    assertEquals(limits.limits[0]!.name, "weeklymax",);
    assertEquals(limits.limits[0]!.period, 604800,);
    assertEquals(limits.limits[0]!.upper, true,);
  });

  it("setLimit monthlymax cria limite mensal", () => {
    const limits = new Limits();
    const project = new MockProject(2,);
    limits.setProject(project,);
    limits.setLimit("monthlymax", 160,);
    assertEquals(limits.limits[0]!.name, "monthlymax",);
    assertEquals(limits.limits[0]!.period, 2592000,);
    assertEquals(limits.limits[0]!.upper, true,);
  });

  it("setLimit maximum cria limite máximo", () => {
    const limits = new Limits();
    const interval = new ScoreboardInterval(
      TjTime.fromDate(new Date("2026-01-01T00:00:00Z",),),
      3600,
      0,
      167,
    );
    limits.setLimit("maximum", 8, interval,);
    assertEquals(limits.limits[0]!.name, "maximum",);
    assertEquals(limits.limits[0]!.upper, true,);
  });

  it("setLimit substitui existente", () => {
    const limits = new Limits();
    const project = new MockProject(2,);
    limits.setProject(project,);
    limits.setLimit("dailymax", 8,);
    limits.setLimit("dailymax", 10 * 3600,);
    assertEquals(limits.limits.length, 1,);
    assertEquals(limits.limits[0]!.value, 10 * 3600,);
  });

  it("inc/dec/ok? delegam para os limites", () => {
    const limits = new Limits();
    const project = new MockProject(2,);
    limits.setProject(project,);
    limits.setLimit("dailymax", 8,);
    limits.inc(0,);
    assertEquals(limits.ok(0, true,), true,);
    for (let i = 0; i < 9; i++) {
      limits.inc(0,);
    }
    assertEquals(limits.ok(0, true,), false,);
  });

  it("inc filtra por resource", () => {
    const limits = new Limits();
    const project = new MockProject(2,);
    limits.setProject(project,);
    const resource = makeResource(project, "r1",);
    limits.setLimit("dailymax", 8 * 3600, undefined, resource,);
    limits.inc(0, resource,);
    assertEquals(limits.ok(0, true, resource,), true,);
    limits.inc(0,);
    assertEquals(
      limits.ok(0, true, resource,),
      true,
      "resource diferente não incrementa",
    );
  });

  it("agregado: dailymax 8h + 30 incs → ok? retorna false", () => {
    const limits = new Limits();
    const project = new MockProject(2,);
    limits.setProject(project,);
    limits.setLimit("dailymax", 8,);
    for (let i = 0; i < 30; i++) {
      limits.inc(0,);
    }
    assertEquals(limits.ok(0, true,), false,);
  });
});
