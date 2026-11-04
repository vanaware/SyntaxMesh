/**
 * 16.3 — `Journal`: consultas `entriesBy*`, `rangeEntries` e `to_rti`
 * (Ruby `Journal.rb` l.404-612).
 *
 * Cobre as bordas assimétricas herdadas do Ruby: `entriesByTask` usa
 * `[start, end)` enquanto `entriesByResource` usa `(start, end]`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Journal.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.3)
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Account, } from "../../src/model/account.ts";
import { Material, } from "../../src/model/material.ts";
import { type Journal, JournalEntry, } from "../../src/model/journal.ts";
import type { JournalQueryLike, } from "../../src/model/journal.ts";
import type { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

const D = (s: string,) => TjTime.fromString(s,);

/** Cria e registra uma entrada (o construtor já chama `addEntry`). */
function entry(
  journal: Journal,
  property: Task | Resource | Material | Account | null,
  date: string,
  headline: string,
  alertLevel = 0,
): JournalEntry {
  const e = new JournalEntry(journal, D(date,), headline, property,);
  e.alertLevel = alertLevel;
  return e;
}

function headlines(
  list: { toArray(): JournalEntry[] },
): string[] {
  return list.toArray().map((e,) => e.headline);
}

describe("Journal#entriesByTask (16.3)", () => {
  let project: Project;
  let journal: Journal;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    journal = project.journal;
    task = new Task(project, "t1", "T1", null,);
  },);

  it("filtra pela propriedade e ignora outras entidades", () => {
    const other = new Task(project, "t2", "T2", null,);
    entry(journal, task, "2026-02-01", "minha",);
    entry(journal, other, "2026-02-01", "alheia",);
    entry(journal, null, "2026-02-01", "global",);
    assertEquals(headlines(journal.entriesByTask(task,),), ["minha",],);
  });

  it("start é inclusivo e end é exclusivo", () => {
    entry(journal, task, "2026-01-01", "no-start",);
    entry(journal, task, "2026-01-15", "meio",);
    entry(journal, task, "2026-02-01", "no-end",);
    const got = journal.entriesByTask(
      task,
      D("2026-01-01",),
      D("2026-02-01",),
    );
    assertEquals(headlines(got,), ["no-start", "meio",],);
  });

  it("descarta entradas com headline vazio", () => {
    entry(journal, task, "2026-01-01", "",);
    entry(journal, task, "2026-01-02", "visível",);
    assertEquals(headlines(journal.entriesByTask(task,),), ["visível",],);
  });

  it("filtra por nível mínimo de alerta", () => {
    entry(journal, task, "2026-01-01", "verde", 0,);
    entry(journal, task, "2026-01-02", "amarelo", 1,);
    entry(journal, task, "2026-01-03", "vermelho", 2,);
    const got = journal.entriesByTask(task, null, null, null, null, 1,);
    assertEquals(headlines(got,), ["amarelo", "vermelho",],);
  });

  it("filtra pelo autor (recurso)", () => {
    const r = new Resource(project, "r1", "R1", null,);
    const comAutor = entry(journal, task, "2026-01-01", "com-autor",);
    comAutor.author = r;
    entry(journal, task, "2026-01-02", "sem-autor",);
    const got = journal.entriesByTask(task, null, null, null, r,);
    assertEquals(headlines(got,), ["com-autor",],);
  });

  it("aplica a expressão lógica de ocultação", () => {
    entry(journal, task, "2026-01-01", "oculta",);
    entry(journal, task, "2026-01-02", "visível",);
    const logExp = { eval: (e: JournalEntry,) => e.headline === "oculta", };
    assertEquals(headlines(journal.entriesByTask(task, null, null, logExp,),), [
      "visível",
    ],);
  });

  it("sem datas devolve tudo em ordem de data", () => {
    entry(journal, task, "2026-03-01", "mar",);
    entry(journal, task, "2026-01-01", "jan",);
    entry(journal, task, "2026-02-01", "fev",);
    assertEquals(headlines(journal.entriesByTask(task,),), [
      "jan",
      "fev",
      "mar",
    ],);
  });
});

describe("Journal#entriesByTaskR (16.3)", () => {
  it("inclui as sub-tasks recursivamente", () => {
    const project = createTestProject(1,);
    const journal = project.journal;
    const parent = new Task(project, "p", "P", null,);
    const child = new Task(project, "c", "C", parent,);
    const grandchild = new Task(project, "g", "G", child,);
    entry(journal, parent, "2026-01-01", "pai",);
    entry(journal, child, "2026-01-02", "filho",);
    entry(journal, grandchild, "2026-01-03", "neto",);
    assertEquals(headlines(journal.entriesByTaskR(parent,),), [
      "pai",
      "filho",
      "neto",
    ],);
  });

  it("respeita o intervalo também nos descendentes", () => {
    const project = createTestProject(1,);
    const journal = project.journal;
    const parent = new Task(project, "p", "P", null,);
    const child = new Task(project, "c", "C", parent,);
    entry(journal, parent, "2026-01-01", "pai",);
    entry(journal, child, "2026-06-01", "filho-fora",);
    const got = journal.entriesByTaskR(
      parent,
      D("2026-01-01",),
      D("2026-02-01",),
    );
    assertEquals(headlines(got,), ["pai",],);
  });
});

describe("Journal#entriesByResource (16.3)", () => {
  let project: Project;
  let journal: Journal;
  let resource: Resource;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    journal = project.journal;
    resource = new Resource(project, "r1", "R1", null,);
    task = new Task(project, "t1", "T1", null,);
  },);

  it("seleciona pelo autor e não pela propriedade", () => {
    const minha = entry(journal, task, "2026-01-01", "do-recurso",);
    minha.author = resource;
    entry(journal, task, "2026-01-02", "de-outro",);
    assertEquals(headlines(journal.entriesByResource(resource,),), [
      "do-recurso",
    ],);
  });

  it("start é exclusivo e end é inclusivo (assimetria do Ruby)", () => {
    const a = entry(journal, task, "2026-01-01", "no-start",);
    a.author = resource;
    const b = entry(journal, task, "2026-01-15", "meio",);
    b.author = resource;
    const c = entry(journal, task, "2026-02-01", "no-end",);
    c.author = resource;
    const got = journal.entriesByResource(
      resource,
      D("2026-01-01",),
      D("2026-02-01",),
    );
    assertEquals(headlines(got,), ["meio", "no-end",],);
  });

  it("filtra também pela task quando informada", () => {
    const outra = new Task(project, "t2", "T2", null,);
    const x = entry(journal, task, "2026-01-01", "na-task",);
    x.author = resource;
    const y = entry(journal, outra, "2026-01-02", "na-outra",);
    y.author = resource;
    const got = journal.entriesByResource(
      resource,
      null,
      null,
      null,
      task,
    );
    assertEquals(headlines(got,), ["na-task",],);
  });
});

describe("Journal#entriesByMaterial / #entriesByAccount (16.3)", () => {
  it("material filtra pela folha e pela janela [start, end)", () => {
    const project = createTestProject(1,);
    const journal = project.journal;
    const steel = new Material(project, "steel", "kg", 2,);
    const other = new Material(project, "wood", "un", 5,);
    entry(journal, steel, "2026-01-01", "aço-jan",);
    entry(journal, steel, "2026-02-01", "aço-fev",);
    entry(journal, other, "2026-01-01", "madeira",);
    const got = journal.entriesByMaterial(
      steel,
      D("2026-01-01",),
      D("2026-02-01",),
    );
    assertEquals(headlines(got,), ["aço-jan",],);
  });

  it("conta filtra pela folha e pelo nível de alerta", () => {
    const project = createTestProject(1,);
    const journal = project.journal;
    const acc = new Account(project, "a", "A", null,);
    const other = new Account(project, "b", "B", null,);
    entry(journal, acc, "2026-01-01", "verde", 0,);
    entry(journal, acc, "2026-01-02", "vermelho", 2,);
    entry(journal, other, "2026-01-03", "outra", 2,);
    const got = journal.entriesByAccount(acc, null, null, null, 1,);
    assertEquals(headlines(got,), ["vermelho",],);
  });
});

describe("Journal#rangeEntries (16.3)", () => {
  it("sem propriedade devolve o journal inteiro no intervalo inclusivo", () => {
    const project = createTestProject(1,);
    const journal = project.journal;
    const t = new Task(project, "t1", "T1", null,);
    entry(journal, t, "2026-01-01", "no-limite",);
    entry(journal, null, "2026-01-15", "global",);
    entry(journal, t, "2026-02-01", "fora",);
    const got = journal.rangeEntries(D("2026-01-01",), D("2026-01-15",), null,);
    assertEquals(headlines(got,), ["no-limite", "global",],);
  });

  it("com propriedade inclui descendentes", () => {
    const project = createTestProject(1,);
    const journal = project.journal;
    const parent = new Task(project, "p", "P", null,);
    const child = new Task(project, "c", "C", parent,);
    const unrelated = new Task(project, "x", "X", null,);
    entry(journal, parent, "2026-01-01", "pai",);
    entry(journal, child, "2026-01-02", "filho",);
    entry(journal, unrelated, "2026-01-03", "alheia",);
    const got = journal.rangeEntries(null, null, null, parent,);
    assertEquals(headlines(got,), ["pai", "filho",],);
  });

  it("alerta é comparado por igualdade (não por mínimo)", () => {
    const project = createTestProject(1,);
    const journal = project.journal;
    const t = new Task(project, "t1", "T1", null,);
    entry(journal, t, "2026-01-01", "verde", 0,);
    entry(journal, t, "2026-01-02", "amarelo", 1,);
    entry(journal, t, "2026-01-03", "vermelho", 2,);
    const got = journal.rangeEntries(null, null, null, null, 1,);
    assertEquals(headlines(got,), ["amarelo",],);
  });
});

describe("Journal#to_rti (16.3)", () => {
  let project: Project;
  let journal: Journal;
  let parent: Task;
  let child: Task;
  let standalone: Task;

  /** Query mínima aceita por `to_rti`. */
  function query(
    mode: string,
    property: Task | null = null,
  ): JournalQueryLike & { rti?: RichTextIntermediate | null } {
    return {
      project,
      property,
      start: D("2026-01-01",),
      end: D("2026-12-31",),
      journalMode: mode,
      journalAttributes: ["*",],
      scenarioIdx: 0,
      rti: null,
    };
  }

  function textOf(q: JournalQueryLike & { rti?: unknown },): string {
    assert(q.rti, `to_rti não produziu RTI (mode=${q.journalMode})`,);
    return (q.rti as RichTextIntermediate).to_s();
  }

  beforeEach(() => {
    project = createTestProject(1,);
    journal = project.journal;
    parent = new Task(project, "p", "Parent", null,);
    child = new Task(project, "c", "Child", parent,);
    standalone = new Task(project, "s", "Standalone", null,);
    entry(journal, parent, "2026-02-10", "pai-antiga", 0,);
    entry(journal, parent, "2026-05-01", "pai-nova", 1,);
    entry(journal, child, "2026-03-01", "filha-velha", 2,);
    entry(journal, child, "2026-06-01", "filha-nova", 1,);
    entry(journal, standalone, "2026-04-01", "outra", 2,);
  },);

  it("journal mostra só as entradas da própria propriedade", () => {
    const q = query("journal", parent,);
    journal.to_rti(q,);
    const text = textOf(q,);
    assert(text.includes("pai-antiga",), text,);
    assert(text.includes("pai-nova",), text,);
    assert(!text.includes("filha-nova",), "não deve vazar a sub-task",);
  });

  it("journal_sub inclui as sub-tasks", () => {
    const q = query("journal_sub", parent,);
    journal.to_rti(q,);
    const text = textOf(q,);
    assert(text.includes("pai-nova",), text,);
    assert(text.includes("filha-nova",), text,);
    assert(!text.includes("outra",), text,);
  });

  it("status_up devolve a última entrada de cada task raiz", () => {
    const q = query("status_up",);
    journal.to_rti(q,);
    const text = textOf(q,);
    assert(text.includes("pai-nova",), text,);
    assert(!text.includes("pai-antiga",), text,);
    assert(text.includes("outra",), text,);
  });

  it("status_down devolve a entrada corrente da raiz (sub-task vence)", () => {
    const q = query("status_down", parent,);
    journal.to_rti(q,);
    const text = textOf(q,);
    assert(text.includes("filha-nova",), text,);
    assert(!text.includes("pai-nova",), "a entrada do filho é mais recente",);
  });

  it("alerts_down devolve só a entrada de maior alerta", () => {
    const q = query("alerts_down", parent,);
    journal.to_rti(q,);
    const text = textOf(q,);
    assert(text.includes("filha-nova",), text,);
    assert(!text.includes("filha-velha",), "não é a entrada corrente",);
    assert(!text.includes("pai-antiga",), text,);
  });

  it("alerts_dep segue dependências end->start", () => {
    const dep = new Task(project, "d", "Dep", null,);
    entry(journal, dep, "2026-07-01", "dependencia-alerta", 2,);
    parent.setForScenario("startpreds", [[dep, true,],], 0,);
    const q = query("alerts_dep", parent,);
    journal.to_rti(q,);
    const text = textOf(q,);
    assert(text.includes("dependencia-alerta",), text,);
  });

  it("ordena por data ascendente por default", () => {
    const q = query("journal", parent,);
    journal.to_rti(q,);
    const text = textOf(q,);
    assert(
      text.indexOf("pai-antiga",) < text.indexOf("pai-nova",),
      `ordem errada: ${text}`,
    );
  });

  it("usa sortJournalEntries quando informado (data desc)", () => {
    const q = query("journal", parent,);
    q.sortJournalEntries = [["date", -1,],];
    journal.to_rti(q,);
    const text = textOf(q,);
    assert(
      text.indexOf("pai-nova",) < text.indexOf("pai-antiga",),
      `ordem errada: ${text}`,
    );
  });

  it("marca a RTI como journal (sem números de seção)", () => {
    const q = query("journal", parent,);
    journal.to_rti(q,);
    const rti = q.rti as RichTextIntermediate;
    assertEquals(rti.cssClass, "tj_journal",);
    assertEquals(rti.sectionNumbers, false,);
  });

  it("journalmessages usa as entradas correntes", () => {
    const q = query("journalmessages", parent,);
    journal.to_rti(q,);
    const text = textOf(q,);
    assert(text.includes("pai-nova",), text,);
    assert(!text.includes("pai-antiga",), text,);
  });

  it("modo desconhecido lança erro", () => {
    assertThrows(
      () => journal.to_rti(query("inexistente", parent,),),
      Error,
      "Unknown journal mode: inexistente",
    );
  });

  it("renderiza o nível de alerta da paleta do projeto", () => {
    // O default do projeto é Green/Yellow/Red (nomes do Ruby).
    const q = query("journal", parent,);
    journal.to_rti(q,);
    const text = textOf(q,);
    assert(text.includes("[Green]",), text,);
    assert(text.includes("[Yellow]",), text,);
  });
});

describe("Journal#alertLevel / #alertEntries (16.3)", () => {
  it("alertLevel é o máximo das entradas correntes recursivas", () => {
    const project = createTestProject(1,);
    const journal = project.journal;
    const parent = new Task(project, "p", "P", null,);
    const child = new Task(project, "c", "C", parent,);
    entry(journal, child, "2026-06-01", "alerta", 2,);
    const q: JournalQueryLike = {
      project,
      journalMode: "status_down",
      scenarioIdx: 0,
    };
    assertEquals(journal.alertLevel(D("2026-12-31",), parent, q,), 2,);
    assertEquals(journal.alertLevel(null, parent, q,), 0,);
  });

  it("alertEntries descarta níveis menores", () => {
    const project = createTestProject(1,);
    const journal = project.journal;
    const t = new Task(project, "t", "T", null,);
    entry(journal, t, "2026-01-01", "verde", 0,);
    entry(journal, t, "2026-01-02", "vermelho-a", 2,);
    entry(journal, t, "2026-01-03", "vermelho-b", 2,);
    const q: JournalQueryLike = { project, journalMode: "alerts_down", };
    // Só a entrada mais recente conta como "corrente".
    const got = journal.alertEntries(D("2026-12-31",), t, 1, null, q,);
    assertEquals(got.map((e,) => e.headline), ["vermelho-b",],);
  });
});
