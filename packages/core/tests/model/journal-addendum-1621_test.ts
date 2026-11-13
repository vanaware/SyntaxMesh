/**
 * 16.21 — Adendo Fase 10 Complemento: Journal aceita `Material`/`Account`
 * como folha + `pictures`/`format` propagados na consulta e no RTI.
 *
 * Cobre:
 * - 16.21.4: `currentEntries`/`currentEntriesR`/`alertLevel`/`alertEntries`
 *   agregam material/account (journalentry contribui para o alertLevel).
 * - 16.21.5: `to_rti` aceita material/account nos modos `journal`,
 *   `status_up`, `status_down`, `alerts_*`; `journal_sub` de material vira
 *   `journal`.
 * - 16.21.6: `pictures` e `format` (`markdown`/`richtext`) propagados no RTI.
 * - 16.21.7: regressão — journal em task/resource/project inalterado.
 *
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.21)
 * @see docs/syntaxmesh/fases/fase-10-complemento1.md (§2.5, §4.5, §6.6)
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Account, } from "../../src/model/account.ts";
import { Material, } from "../../src/model/material.ts";
import { Picture, } from "../../src/model/picture.ts";
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

/** Query mínima aceita por `to_rti`. */
function query(
  project: Project,
  mode: string,
  property: Task | Resource | Material | Account | null = null,
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

function rtiOf(
  q: JournalQueryLike & { rti?: unknown },
): RichTextIntermediate {
  assert(q.rti, `to_rti não produziu RTI (mode=${q.journalMode})`,);
  return q.rti as RichTextIntermediate;
}

describe("16.21.4 — alertLevel/currentEntries agregam material/account", () => {
  let project: Project;
  let journal: Journal;

  beforeEach(() => {
    project = createTestProject(1,);
    journal = project.journal;
  },);

  it("alertLevel de um material reflete a sua entrada", () => {
    const steel = new Material(project, "steel", "kg", 2,);
    entry(journal, steel, "2026-02-01", "atraso", 2,);
    const q: JournalQueryLike = { project, journalMode: "status_down", };
    assertEquals(journal.alertLevel(D("2026-12-31",), steel, q,), 2,);
  });

  it("alertLevel de uma conta pai agrega o máximo das subcontas", () => {
    const root = new Account(project, "root", "Root", null,);
    const child = new Account(project, "child", "Child", root,);
    entry(journal, root, "2026-01-01", "raiz-verde", 0,);
    entry(journal, child, "2026-03-01", "filha-vermelha", 2,);
    const q: JournalQueryLike = { project, journalMode: "status_down", };
    assertEquals(journal.alertLevel(D("2026-12-31",), root, q,), 2,);
  });

  it("currentEntries de um material devolve a última entrada até a data", () => {
    const steel = new Material(project, "steel", "kg", 2,);
    entry(journal, steel, "2026-01-01", "antiga", 0,);
    entry(journal, steel, "2026-02-01", "recente", 1,);
    const got = journal.currentEntries(
      D("2026-12-31",),
      steel,
      0,
      null,
      null,
    );
    assertEquals(got.map((e,) => e.headline), ["recente",],);
  });

  it("currentEntriesR de uma conta pai inclui a entrada da subconta", () => {
    const root = new Account(project, "root", "Root", null,);
    const child = new Account(project, "child", "Child", root,);
    entry(journal, child, "2026-03-01", "filha", 1,);
    const q: JournalQueryLike = { project, journalMode: "status_down", };
    const got = journal.currentEntriesR(D("2026-12-31",), root, 0, null, q,);
    assertEquals(got.map((e,) => e.headline), ["filha",],);
  });

  it("alertEntries de um material devolve só a entrada de maior nível", () => {
    const steel = new Material(project, "steel", "kg", 2,);
    entry(journal, steel, "2026-01-01", "verde", 0,);
    entry(journal, steel, "2026-02-01", "vermelha", 2,);
    const q: JournalQueryLike = { project, journalMode: "alerts_down", };
    const got = journal.alertEntries(D("2026-12-31",), steel, 1, null, q,);
    assertEquals(got.map((e,) => e.headline), ["vermelha",],);
  });
});

describe("16.21.5 — to_rti aceita material/account nos modos status/alerts", () => {
  let project: Project;
  let journal: Journal;
  let steel: Material;
  let root: Account;
  let child: Account;

  beforeEach(() => {
    project = createTestProject(1,);
    journal = project.journal;
    steel = new Material(project, "steel", "kg", 2,);
    root = new Account(project, "root", "Root", null,);
    child = new Account(project, "child", "Child", root,);
    entry(journal, steel, "2026-02-01", "aco-antiga", 0,);
    entry(journal, steel, "2026-05-01", "aco-nova", 2,);
    entry(journal, root, "2026-01-01", "conta-raiz", 0,);
    entry(journal, child, "2026-06-01", "conta-filha", 1,);
  },);

  it("status_up de um material devolve a sua entrada corrente", () => {
    const q = query(project, "status_up", steel,);
    journal.to_rti(q,);
    const text = rtiOf(q,).to_s();
    assert(text.includes("aco-nova",), text,);
    assert(!text.includes("aco-antiga",), text,);
  });

  it("status_down de uma conta pai devolve a entrada corrente (filha vence)", () => {
    const q = query(project, "status_down", root,);
    journal.to_rti(q,);
    const text = rtiOf(q,).to_s();
    assert(text.includes("conta-filha",), text,);
    assert(!text.includes("conta-raiz",), "a filha é mais recente",);
  });

  it("alerts_down de um material devolve só a entrada de maior alerta", () => {
    const q = query(project, "alerts_down", steel,);
    journal.to_rti(q,);
    const text = rtiOf(q,).to_s();
    assert(text.includes("aco-nova",), text,);
    assert(!text.includes("aco-antiga",), text,);
  });

  it("journal_sub de um material equivale a journal (só as próprias)", () => {
    const sub = query(project, "journal_sub", steel,);
    journal.to_rti(sub,);
    const jrnl = query(project, "journal", steel,);
    journal.to_rti(jrnl,);
    assertEquals(rtiOf(sub,).to_s(), rtiOf(jrnl,).to_s(),);
  });

  it("journal_sub de uma conta inclui as subcontas", () => {
    const q = query(project, "journal_sub", root,);
    journal.to_rti(q,);
    const text = rtiOf(q,).to_s();
    assert(text.includes("conta-raiz",), text,);
    assert(text.includes("conta-filha",), text,);
  });

  it("regressão: status_up de um resource continua vazio (comportamento atual)", () => {
    const r = new Resource(project, "r1", "R1", null,);
    const e = entry(journal, steel, "2026-03-01", "do-recurso", 0,);
    e.author = r;
    const q = query(project, "status_up", r,);
    journal.to_rti(q,);
    assertEquals(rtiOf(q,).to_s(), "",);
  });
});

describe("16.21.6 — pictures/format propagados no RTI", () => {
  let project: Project;
  let journal: Journal;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    journal = project.journal;
    task = new Task(project, "t1", "T1", null,);
  },);

  it("pictures aparecem como imagens no RTI (to_markdown)", () => {
    const e = entry(journal, task, "2026-02-01", "Chegada",);
    const pic = new Picture("img/peca.png",);
    pic.alt = "peça";
    e.pictures = [pic,];
    const q = query(project, "journal", task,);
    journal.to_rti(q,);
    const md = rtiOf(q,).to_markdown();
    assert(md.includes("![peça](img/peca.png)",), md,);
  });

  it("format markdown renderiza negrito do corpo via MarkdownFactory", () => {
    const e = entry(journal, task, "2026-02-01", "Nota",);
    e.format = "markdown";
    e.details = "Texto **negrito** aqui.";
    const q = query(project, "journal", task,);
    journal.to_rti(q,);
    // `<b>` prova que o corpo foi parseado como Markdown (e não literal).
    const html = rtiOf(q,).to_html()!.toHTML();
    assert(html.includes("<b>negrito</b>",), html,);
  });

  it("format richtext renderiza negrito MediaWiki do corpo", () => {
    const e = entry(journal, task, "2026-02-01", "Nota",);
    e.format = "richtext";
    e.details = "Texto '''negrito''' aqui.";
    const q = query(project, "journal", task,);
    journal.to_rti(q,);
    const html = rtiOf(q,).to_html()!.toHTML();
    assert(html.includes("<b>negrito</b>",), html,);
  });

  it("selfContained troca a imagem por um marcador textual", () => {
    const e = entry(journal, task, "2026-02-01", "Chegada",);
    e.pictures = [new Picture("img/peca.png",),];
    const q = query(project, "journal", task,);
    q.selfContained = true;
    journal.to_rti(q,);
    const text = rtiOf(q,).to_s();
    assert(text.includes("img/peca.png",), text,);
    assert(!rtiOf(q,).to_markdown().includes("![",), "não deve haver imagem",);
  });

  it("regressão: corpo markdown simples continua como texto plano", () => {
    const e = entry(journal, task, "2026-02-01", "Nota",);
    e.summary = "Chegaram 50 kg.";
    e.details = "Nota fiscal 1234.";
    const q = query(project, "journal", task,);
    journal.to_rti(q,);
    const text = rtiOf(q,).to_s();
    assert(text.includes("Chegaram 50 kg.",), text,);
    assert(text.includes("Nota fiscal 1234.",), text,);
  });
});
