/**
 * 14C.0.4/14C.0.5/14C.0.6 — índices por entidade do Journal (bring-forward
 * da Fase 16, adendo 16.21): `entriesByTask/Resource/Material/Account`
 * ordenados por data, `entriesByDate` e remoção consistente.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Account, } from "../../src/model/account.ts";
import { Material, } from "../../src/model/material.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

const D = (s: string,) => TjTime.fromString(s,);

function entry(
  project: Project,
  property: Task | Resource | Material | Account | null,
  date: string,
  headline = "H",
): JournalEntry {
  return new JournalEntry(project.journal, D(date,), headline, property,);
}

describe("Journal índices por entidade (14C.0.4)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(1,);
  },);

  it("indexa task e mantém ordem por data mesmo com inserção fora de ordem", () => {
    const t = new Task(project, "t1", "T1", null,);
    entry(project, t, "2026-03-01", "mar",);
    entry(project, t, "2026-01-15", "jan",);
    entry(project, t, "2026-02-20", "fev",);
    const list = project.journal.entriesByTask.get(t,)!;
    assertEquals(list.length, 3,);
    assertEquals(list.map((e,) => e.headline), ["jan", "fev", "mar",],);
  });

  it("indexa resource, material e account em seus maps", () => {
    const r = new Resource(project, "r1", "R1", null,);
    const m = new Material(project, "m1", "kg", 2.5,);
    const a = new Account(project, "a1", "A1", null,);
    entry(project, r, "2026-01-01",);
    entry(project, m, "2026-01-02",);
    entry(project, a, "2026-01-03",);
    assertEquals(project.journal.entriesByResource.get(r,)!.length, 1,);
    assertEquals(project.journal.entriesByMaterial.get(m,)!.length, 1,);
    assertEquals(project.journal.entriesByAccount.get(a,)!.length, 1,);
  });

  it("entrada com property null fica apenas em entries (sem índice)", () => {
    entry(project, null, "2026-01-01",);
    assertEquals(project.journal.entries.length, 1,);
    assertEquals(project.journal.entriesByTask.size, 0,);
  });

  it("entriesByDate filtra por intervalo inclusivo e ordena por data", () => {
    const t = new Task(project, "t1", "T1", null,);
    entry(project, t, "2026-01-31", "a",);
    entry(project, t, "2026-02-01", "b",);
    entry(project, t, "2026-03-15", "c",);
    const range = project.journal.entriesByDate(
      D("2026-02-01",),
      D("2026-03-01",),
    );
    assertEquals(range.length, 1,);
    assertEquals(range[0]!.headline, "b",);
    const all = project.journal.entriesByDate(
      D("2026-01-01",),
      D("2026-12-31",),
    );
    assertEquals(all.map((e,) => e.headline), ["a", "b", "c",],);
  });
});

describe("Journal remoção consistente (14C.0.5)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(1,);
  },);

  it("removeEntry limpa entries e o índice da entidade", () => {
    const t = new Task(project, "t1", "T1", null,);
    const keep = entry(project, t, "2026-02-01", "keep",);
    const gone = entry(project, t, "2026-01-01", "gone",);
    project.journal.removeEntry(gone,);
    assertEquals(project.journal.entries.length, 1,);
    assertEquals(project.journal.entriesByTask.get(t,)!.length, 1,);
    assertEquals(project.journal.entriesByTask.get(t,)![0], keep,);
  });

  it("deleteIf não vaza entradas: bucket vazio é removido do mapa", () => {
    const t = new Task(project, "t1", "T1", null,);
    entry(project, t, "2026-01-01",);
    entry(project, t, "2026-02-01",);
    project.journal.deleteIf((e,) => e.property === t);
    assert(!project.journal.entriesByTask.has(t,), "bucket vazio vazou",);
    assertEquals(project.journal.entries.length, 0,);
  });
});
