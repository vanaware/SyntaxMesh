/**
 * Onda B1 — query_* compartilhados de `PropertyTreeNode` (porta
 * PropertyTreeNode.rb:594-673), exercitados via dispatch do `Query.process`
 * (etapa h: property.query_X). Cobrem children/journal/alert/alerttrend e as
 * variantes de mensagens/resumos, delegando ao `Journal` já portado
 * (currentEntriesR/alertLevel/alertEntries/messagesRti).
 *
 * @see docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb:594-673
 * @see docs/taskjuggler/lib/taskjuggler/Journal.rb:584-734
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { Query, } from "../../src/query/query.ts";
import { JournalEntry, } from "../../src/model/journal.ts";

Deno.env.set("TZ", "UTC",);
TjTime.setTimeZone("UTC",);

const D = (s: string,) => TjTime.fromString(s,);

/** Query mínima para um atributo compartilhado de uma propriedade. */
function makeQuery(
  project: Project,
  property: Task,
  attributeId: string,
  start: TjTime,
  end: TjTime,
): Query {
  return new Query({
    project,
    property,
    attributeId,
    scenarioIdx: 0,
    start,
    end,
  },);
}

describe("query_* PropertyTreeNode (Onda B1)", () => {
  it("query_children lista os filhos como 'Nome (fullId)'", () => {
    const project = createTestProject(1,);
    const parent = new Task(project, "p", "Parent", null,);
    new Task(project, "c1", "Child One", parent,);
    new Task(project, "c2", "Child Two", parent,);

    const q = makeQuery(
      project,
      parent,
      "children",
      D("2026-01-01",),
      D("2026-12-31",),
    );
    assert(q.process(), q.errorMessage ?? "",);

    const text = q.to_s();
    assert(text.includes("Child One (",), `sem Child One: ${text}`,);
    assert(text.includes("Child Two (",), `sem Child Two: ${text}`,);
    // Dois filhos separados por vírgula (listType default = comma).
    assert(text.includes(", ",), `sem separador: ${text}`,);
  });

  it("query_alert devolve nível numérico + nome colorido em end", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t", "T", null,);
    const entry = new JournalEntry(
      project.journal,
      D("2026-03-10",),
      "Problema",
      task,
    );
    entry.alertLevel = 2; // red

    const q = makeQuery(
      project,
      task,
      "alert",
      D("2026-03-01",),
      D("2026-03-15",),
    );
    assert(q.process(), q.errorMessage ?? "",);

    assertEquals(q.to_num(), 2,);
    assertEquals(q.to_sort(), 2,);
    assertEquals(q.string, "Red",);
    assert(q.rti, "rti ausente para o alerta",);
  });

  it("query_alerttrend Up quando o nível sobe entre start e end", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t", "T", null,);
    const low = new JournalEntry(
      project.journal,
      D("2026-03-05",),
      "OK",
      task,
    );
    low.alertLevel = 0;
    const high = new JournalEntry(
      project.journal,
      D("2026-03-10",),
      "Problema",
      task,
    );
    high.alertLevel = 2;

    const q = makeQuery(
      project,
      task,
      "alerttrend",
      D("2026-03-06",),
      D("2026-03-15",),
    );
    assert(q.process(), q.errorMessage ?? "",);
    assertEquals(q.to_sort(), 0,);
    assertEquals(q.string, "Up",);
  });

  it("query_alerttrend Flat quando o nível não muda", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t", "T", null,);
    const e = new JournalEntry(
      project.journal,
      D("2026-03-05",),
      "Estável",
      task,
    );
    e.alertLevel = 1;

    const q = makeQuery(
      project,
      task,
      "alerttrend",
      D("2026-03-06",),
      D("2026-03-15",),
    );
    assert(q.process(), q.errorMessage ?? "",);
    assertEquals(q.to_sort(), 1,);
    assertEquals(q.string, "Flat",);
  });

  it("query_journalmessages monta RTI com a última entrada corrente", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t", "T", null,);
    const old = new JournalEntry(
      project.journal,
      D("2026-03-01",),
      "Antiga",
      task,
    );
    old.summary = "resumo antigo";
    const cur = new JournalEntry(
      project.journal,
      D("2026-03-10",),
      "Atual",
      task,
    );
    cur.summary = "resumo atual";

    const q = makeQuery(
      project,
      task,
      "journalmessages",
      D("2026-03-01",),
      D("2026-03-15",),
    );
    assert(q.process(), q.errorMessage ?? "",);

    const text = q.to_s();
    // currentEntries só devolve a última entrada (Atual, não Antiga).
    assert(text.includes("Atual",), `sem 'Atual': ${text}`,);
    assert(text.includes("resumo atual",), `sem resumo: ${text}`,);
    assert(!text.includes("Antiga",), `não deveria trazer 'Antiga': ${text}`,);
  });

  it("query_alertsummaries usa alertEntries (só maior nível entre filhos)", () => {
    const project = createTestProject(1,);
    const parent = new Task(project, "p", "Parent", null,);
    const child = new Task(project, "c", "Child", parent,);
    const medium = new JournalEntry(
      project.journal,
      D("2026-03-10",),
      "Alerta pai",
      parent,
    );
    medium.alertLevel = 1;
    medium.summary = "detalhe do pai";
    const high = new JournalEntry(
      project.journal,
      D("2026-03-10",),
      "Alerta filho",
      child,
    );
    high.alertLevel = 2;

    // Min level 1; currentEntriesR do pai propaga para o filho mais recente.
    const q = makeQuery(
      project,
      parent,
      "alertsummaries",
      D("2026-03-01",),
      D("2026-03-15",),
    );
    assert(q.process(), q.errorMessage ?? "",);
    assert(q.rti, "esperava rti do resumo de alertas",);
  });
});
