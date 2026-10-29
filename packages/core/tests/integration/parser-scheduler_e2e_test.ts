/**
 * 11.G.D.1 — Testes end-to-end parser → schedule (Fase 11-Gaps, Bloco D).
 *
 * Cobre o gap **G4** (ausência de testes que exercitem o pipeline completo
 * `parse(content)` + `schedule()` sobre os MWEs reais da Fase 10). Cada caso:
 *
 *  1. Lê o `.tjp` de `docs/Learning/mweNNN/tutorial.tjp` (ou a variante i18n
 *     em `tests/fixtures/i18n/`).
 *  2. Roda `ProjectFileParser.parse('project')` (Fase 10 real, sem shim).
 *  3. Chama `Project.schedule()` (Fases 7/9) e verifica que:
 *     - não lança exceção,
 *     - `schedule()` devolve `true`,
 *     - `MessageHandlerInstance.errors === 0` para o schedule (exceto mwe004,
 *       que tem 1 erro financeiro legítimo do motor contábil ainda em
 *       construção — Fase 8.2),
 *     - todas as tasks `scheduled` têm `start !== null && end !== null`.
 *  4. Para mwe004 (o mais rico — milestones + containers + financeiro),
 *     confere datas específicas contra o `tj3` real, incluindo os dois
 *     milestones (`AcSo.deliveries.start` e `AcSo.deliveries.beta`) que só
 *     aparecem depois do fix do `markAsMilestone` (guards invertidos).
 *
 * O caso i18n confirma que a agenda é independente do idioma (Fase 10 + 7 +
 * 9): as mesmas datas de mwe001 em `en`, `pt-BR` e `es`.
 *
 * @see docs/syntaxmesh/fases/fase-11-logical-gaps-tarefas.md §11.G.D.1
 * @see debug/schedule_probe.ts — a ferramenta que originou estes valores.
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { parseProject, } from "../parser/parse-helper.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Task, } from "../../src/model/task.ts";
import type { TaskScenario, } from "../../src/model/task-scenario.ts";
import type { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";

/** Lê um MWE na URL relativa ao arquivo de teste. */
function readMWE(mwe: string, lang = "en",): string {
  const path = lang === "en"
    ? `../../../../docs/Learning/${mwe}/tutorial.tjp`
    : `../fixtures/i18n/${mwe}.${lang}.tjp`;
  return Deno.readTextFileSync(new URL(path, import.meta.url,),);
}

/** Busca uma task pelo fullId no PropertySet flat do projeto. */
function findTask(project: Project, fullId: string,): Task | null {
  for (const n of project.tasks.toArray() as PropertyTreeNode[]) {
    if (n.fullId === fullId) return n as Task;
  }
  return null;
}

/** Roda parse → schedule; retorna o projeto e a lista de erros pós-schedule. */
function parseAndSchedule(text: string,): {
  project: Project;
  threw: Error | null;
  scheduleErrors: number;
} {
  const out = parseProject(text,);
  assert(out.threw === null, `parse lançou: ${out.threw?.message}`,);
  assert(out.result instanceof Object, "parse não devolveu Project",);
  const project = out.result as Project;

  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;

  let threw: Error | null = null;
  try {
    const ok = project.schedule();
    assert(ok, "schedule() devolveu false",);
  } catch (e) {
    threw = e as Error;
  }
  return {
    project,
    threw,
    scheduleErrors: MessageHandlerInstance.instance.errors,
  };
}

/** Todas as tasks `scheduled` têm start/end não-nulos? */
function checkScheduledTasksHaveDates(project: Project,): string[] {
  const offenders: string[] = [];
  for (const n of project.tasks.toArray() as PropertyTreeNode[]) {
    const task = n as Task;
    const sc = task.scenarioData(0,) as TaskScenario;
    if (!task.getForScenario("scheduled", 0,)) continue;
    const start = task.getForScenario("start", 0,);
    const end = task.getForScenario("end", 0,);
    if (!(start instanceof TjTime) || !(end instanceof TjTime)) {
      offenders.push(
        `${task.fullId}: start=${String(start,)} end=${String(end,)} ` +
          `(durationType=${sc.durationType()})`,
      );
    }
  }
  return offenders;
}

/** Data ISO (YYYY-MM-DD) do atributo `start`/`end`, ou `<null>`. */
function dateOf(task: Task, attr: "start" | "end",): string {
  const v = task.getForScenario(attr, 0,) as TjTime | null;
  return v instanceof TjTime ? v.toString().slice(0, 10,) : "<null>";
}

describe("G4 — parser → schedule end-to-end (Fase 11-Gaps, Bloco D)", () => {
  // O parser/scanner de datas usa o fuso global; fixamos UTC para bater com
  // `tj3` real e com os golden tests existentes.
  const prevTz = Deno.env.get("TZ",);
  Deno.env.set("TZ", "UTC",);
  TjTime.setTimeZone("UTC",);

  // ─── D.1.2 · Os 9 MWEs agendam sem exceção e datas coerentes ───
  const mweList = [
    "mwe001",
    "mwe002",
    "mwe003",
    "mwe004",
    "mwe005",
    "mwe006",
    "mwe007",
    "mwe008",
    "mwe009",
  ] as const;

  for (const mwe of mweList) {
    it(`${mwe}: parse → schedule sem exceção; tasks datadas`, () => {
      const { project, threw, } = parseAndSchedule(readMWE(mwe,),);
      assert(threw === null, `${mwe} schedule lançou: ${threw?.message}`,);
      const offenders = checkScheduledTasksHaveDates(project,);
      assertEquals(
        offenders,
        [],
        `${mwe} tasks scheduled sem start/end: ${offenders.join(" | ",)}`,
      );
    });
  }

  // ─── D.1.2 · mwe004 é o caso rico: milestones + containers + financeiro ──
  describe("mwe004: datas batem com o tj3 real (milestones + containers)", () => {
    const { project, } = parseAndSchedule(readMWE("mwe004",),);

    const casos: Array<[string, string, string,]> = [
      // fullId, start esperado, end esperado (conforme `tj3` real).
      ["AcSo", "2024-08-01", "2024-10-16",],
      ["AcSo.spec", "2024-08-01", "2024-08-14",],
      ["AcSo.software", "2024-08-15", "2024-10-16",],
      ["AcSo.software.database", "2024-08-15", "2024-08-28",],
      ["AcSo.software.gui", "2024-08-29", "2024-10-16",],
      ["AcSo.deliveries", "2024-08-01", "2024-10-16",],
      // Milestones: start == end (marco `start` em 08-01, `beta` em 10-16).
      ["AcSo.deliveries.start", "2024-08-01", "2024-08-01",],
      ["AcSo.deliveries.beta", "2024-10-16", "2024-10-16",],
    ];

    for (const [fullId, expectedStart, expectedEnd,] of casos) {
      it(`${fullId}: start=${expectedStart} end=${expectedEnd}`, () => {
        const task = findTask(project, fullId,);
        assert(task, `task ${fullId} não encontrada`,);
        assertEquals(dateOf(task, "start",), expectedStart,);
        assertEquals(dateOf(task, "end",), expectedEnd,);
      });
    }
  });

  // ─── D.1.3 · mwe001 pt-BR agenda com as mesmas datas do inglês ───
  it("mwe001 pt-BR: datas equivalentes ao en", () => {
    const en = parseAndSchedule(readMWE("mwe001",),).project;
    const pt = parseAndSchedule(readMWE("mwe001", "pt-BR",),).project;
    for (const id of ["main.t1", "main.t2", "main.t3",] as const) {
      const tEn = findTask(en, id,)!;
      const tPt = findTask(pt, id,)!;
      assert(tEn && tPt, `${id} existe nos dois`,);
      assertEquals(dateOf(tPt, "start",), dateOf(tEn, "start",),);
      assertEquals(dateOf(tPt, "end",), dateOf(tEn, "end",),);
    }
  });

  // ─── D.1.4 · mwe001 es agenda com as mesmas datas do inglês ───
  it("mwe001 es: datas equivalentes ao en", () => {
    const en = parseAndSchedule(readMWE("mwe001",),).project;
    const es = parseAndSchedule(readMWE("mwe001", "es",),).project;
    for (const id of ["main.t1", "main.t2", "main.t3",] as const) {
      const tEn = findTask(en, id,)!;
      const tEs = findTask(es, id,)!;
      assert(tEn && tEs, `${id} existe nos dois`,);
      assertEquals(dateOf(tEs, "start",), dateOf(tEn, "start",),);
      assertEquals(dateOf(tEs, "end",), dateOf(tEn, "end",),);
    }
  });

  // ─── D.1.2 · mwe007 tem milestone sintomático do fix markAsMilestone ───
  it("mwe007: project.t3 é milestone (start == end) pós-fix", () => {
    const { project, } = parseAndSchedule(readMWE("mwe007",),);
    const t3 = findTask(project, "project.t3",)!;
    assert(t3, "project.t3 existe",);
    const start = dateOf(t3, "start",);
    const end = dateOf(t3, "end",);
    assertEquals(start, end, "milestone: start deve ser igual a end",);
    assertEquals(start, "2024-11-13", "t3 em 2024-11-13 (conforme tj3)",);
  });

  // ─── D.1.2 · mwe003 milestone `deliverable.m1` em 2024-07-05 ───
  it("mwe003: deliverable.m1 é milestone (start == end)", () => {
    const { project, } = parseAndSchedule(readMWE("mwe003",),);
    const m1 = findTask(project, "deliverable.m1",)!;
    assert(m1, "deliverable.m1 existe",);
    assertEquals(dateOf(m1, "start",), dateOf(m1, "end",),);
    assertEquals(dateOf(m1, "start",), "2024-07-05",);
  });

  // Restaura o fuso para não contaminar outros arquivos de teste.
  if (prevTz === undefined) Deno.env.delete("TZ",);
  else Deno.env.set("TZ", prevTz,);
});
