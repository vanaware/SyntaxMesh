/**
 * Golden test de Journal/JournalEntry (Fase 16.19).
 *
 * Reproduz a fixture de `scripts/golden/journal.rb` (oracle Ruby) e compara o
 * texto plano do `RichTextIntermediate` produzido por `Journal#to_rti` para
 * cada `journalMode`. Isso cobre, de uma vez, a seleção de entradas por modo,
 * a ordenação `date/alert/seqno` e a renderização de `JournalEntry#to_rText`.
 *
 * Tolerância: whitespace colapsado (`\s+` → espaço), a mesma do golden de
 * RichText (Fase 12.19) — o `textBlockFormat` do Ruby reflui parágrafos
 * conforme a largura. O conteúdo (alertas, nomes, ids, datas, flags,
 * summary/details) é comparado integralmente.
 *
 * Divergências registradas:
 * • `entry.summary`/`entry.details` são markup (o Ruby guarda o
 *   `RichTextIntermediate` e lê `richText.inputText`; o port guarda o
 *   `inputText` direto) — mesmo efeito no markup final.
 *
 * @see scripts/golden/journal.rb
 * @see docs/taskjuggler/lib/taskjuggler/Journal.rb
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import { Query, } from "../../src/query/query.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { LogicalFlag, } from "../../src/logic/logical-flag.ts";
import type { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";

interface GoldenCase {
  description: string;
  mode: string;
  property: string | null;
  start: string;
  end: string;
  attributes: string[];
  selfContained: boolean;
  hideFlags: string[];
  expected: string;
}

/** Entidades endereçáveis pelo id serializado no golden. */
type Fixture = {
  project: Project;
  byId: Map<string, Task | Resource>;
};

/**
 * Mesma fixture do script Ruby: 2 tasks raiz + 1 sub-task, 2 resources, 6
 * entradas (incluindo uma global sem propriedade e uma com flag `secret`).
 */
function buildFixture(): Fixture {
  const project = createTestProject(1,);
  project.set("timeFormat", "%Y-%m-%d",);

  const t1 = new Task(project, "t1", "Design", null,);
  const t11 = new Task(project, "t1_1", "Design Child", t1,);
  const t2 = new Task(project, "t2", "Build", null,);
  const alice = new Resource(project, "alice", "Alice", null,);
  const bob = new Resource(project, "bob", "Bob", null,);
  const journal = project.journal;

  const kickoff = new JournalEntry(
    journal,
    TjTime.fromString("2026-01-05",),
    "Kickoff",
    t1,
  );
  kickoff.author = alice;

  const risk = new JournalEntry(
    journal,
    TjTime.fromString("2026-01-10",),
    "Risk Found",
    t1,
  );
  risk.alertLevel = 2;
  risk.author = bob;
  risk.flags = ["risk",];
  risk.summary = "Summary line";
  risk.details = "Details block";

  const child = new JournalEntry(
    journal,
    TjTime.fromString("2026-01-12",),
    "Child Update",
    t11,
  );
  child.author = alice;

  const late = new JournalEntry(
    journal,
    TjTime.fromString("2026-01-15",),
    "Build Late",
    t2,
  );
  late.alertLevel = 1;
  late.author = bob;
  late.flags = ["late",];

  new JournalEntry(
    journal,
    TjTime.fromString("2026-01-18",),
    "Global Note",
    null,
  );

  const secret = new JournalEntry(
    journal,
    TjTime.fromString("2026-01-28",),
    "Secret Note",
    t2,
  );
  secret.alertLevel = 1;
  secret.author = bob;
  secret.flags = ["secret",];

  return {
    project,
    byId: new Map<string, Task | Resource>([
      ["t1", t1,],
      ["t1_1", t11,],
      ["t2", t2,],
      ["alice", alice,],
      ["bob", bob,],
    ],),
  };
}

/** Texto plano do RTI com whitespace colapsado (tolerância 12.19.8). */
function normalize(text: string,): string {
  return text.replace(/\s+/g, " ",).trim();
}

function render(c: GoldenCase,): string {
  const { project, byId, } = buildFixture();
  const hide = c.hideFlags.length > 0
    ? new LogicalExpression(new LogicalFlag(c.hideFlags[0]!,),)
    : null;
  const query = new Query({
    project,
    property: c.property ? byId.get(c.property,) ?? null : null,
    start: TjTime.fromString(c.start,),
    end: TjTime.fromString(c.end,),
    scenarioIdx: 0,
    journalMode: c.mode,
    journalAttributes: c.attributes,
    sortJournalEntries: [["date", 1,], ["alert", 1,], ["seqno", 1,],],
    selfContained: c.selfContained,
    hideJournalEntry: hide,
    timeFormat: "%Y-%m-%d",
  },);
  project.journal.to_rti(query,);
  const rti = query.rti as RichTextIntermediate | null;
  assertEquals(rti === null, false, "to_rti não pode devolver null",);
  return normalize((rti as RichTextIntermediate).to_s(),);
}

function loadCases(): GoldenCase[] {
  const path = new URL("./journal.golden.json", import.meta.url,);
  const parsed = JSON.parse(Deno.readTextFileSync(path,),) as {
    cases: GoldenCase[];
  };
  return parsed.cases;
}

describe("journal golden (16.19)", () => {
  const cases = loadCases();

  it("tem pelo menos 15 casos", () => {
    assertEquals(cases.length >= 15, true,);
  });

  it("cobre todos os modos do Ruby", () => {
    const covered = new Set(cases.map((c,) => c.mode),);
    for (
      const mode of [
        "journal",
        "journal_sub",
        "status_up",
        "status_down",
        "status_dep",
        "alerts_down",
        "alerts_dep",
      ]
    ) {
      assertEquals(covered.has(mode,), true, `modo ausente: ${mode}`,);
    }
  });

  for (const c of cases) {
    it(c.description, () => {
      assertEquals(render(c,), normalize(c.expected,),);
    },);
  }
});
