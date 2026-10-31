/**
 * Testes de ICalReport (Fase 14.19.2).
 *
 * Cobre `generateIntermediateFormat()` (lista de tarefas, VTODO, VEVENT,
 * ORGANIZER/ATTENDEE, RELATED-TO, DESCRIPTION), o `to_iCal()` e o registro da
 * fábrica de conteúdo `ical`. Não depende do scheduler: as datas vêm de
 * `setForScenario("start"/"end", ...)`. O caminho de VJOURNAL é Fase 16 e é
 * apenas confirmado como defensivamente ignorado quando `entriesByTask` falta.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.19.2)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { ICalReport, } from "../../src/reports/i-cal-report.ts";
import { contentFactories, } from "../../src/model/report-content.ts";
import { ReportType, } from "../../src/model/report-type.ts";

const D = (s: string,): TjTime => TjTime.fromString(s,);

describe("ICalReport (14.19.2)", () => {
  let project: Project;
  let report: Report;

  function newReport(): Report {
    const r = new Report(project, "ical1", "ical.ics", null,);
    r.typeSpec = ReportType.ICal;
    r.set("start", D("2026-01-01",),);
    r.set("end", D("2026-12-31",),);
    r.set("scenarios", [0,],);
    r.set("sortTasks", [],);
    r.set("sortResources", [],);
    project.reportContexts.push(new ReportContext(project, r,),);
    return r;
  }

  function addTask(
    id: string,
    name: string,
    start: string,
    end: string,
    parent: Task | null = null,
  ): Task {
    const t = new Task(project, id, name, parent,);
    t.setForScenario("start", D(start,), 0,);
    t.setForScenario("end", D(end,), 0,);
    return t;
  }

  beforeEach(() => {
    project = createTestProject(1,);
    report = newReport();
  },);

  describe("geração básica (14.19.2.2 / 14.19.2.3)", () => {
    it("emite envelope VCALENDAR e um VTODO por tarefa", () => {
      addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      addTask("t2", "Beta", "2026-03-01", "2026-03-02",);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assert(out.startsWith("BEGIN:VCALENDAR\r\n",), out.slice(0, 30,),);
      assert(out.endsWith("END:VCALENDAR\r\n",),);
      assertEquals((out.match(/BEGIN:VTODO/g,) ?? []).length, 2,);
      assert(out.includes("SUMMARY:Alpha",),);
      assert(out.includes("SUMMARY:Beta",),);
    });

    it("DTSTAMP/DTSTART/DUE aparecem em formato UTC compacto", () => {
      addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assert(/DTSTART:20260201T000000Z/.test(out,), out.slice(0, 400,),);
      assert(/DUE:20260205T000000Z/.test(out,),);
      assert(/DTSTAMP:\d{8}T\d{6}Z/.test(out,),);
    });

    it("UID é derivado do projectid + fullId + sufixo TODO", () => {
      const t = addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assert(
        out.includes(
          `UID:${String(t.getForScenario("projectid", 0,),)}-${t.fullId}-TODO`,
        ),
      );
    });
  });

  describe("percentComplete e prioridade", () => {
    it("emite PERCENT-COMPLETE derivado do query `complete`", () => {
      const t = addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      t.setForScenario("complete", 42.7, 0,);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      // Math.trunc(42.7) = 42.
      assert(ical.to_iCal().includes("PERCENT-COMPLETE:42\r\n",),);
    });

    it("percentComplete=100 emite COMPLETED em vez de DUE", () => {
      const t = addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      t.setForScenario("complete", 100, 0,);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assert(out.includes("COMPLETED:20260205T000000Z",),);
      assert(!out.includes("DUE:",),);
    });
  });

  describe("VEVENT (14.19.2.6)", () => {
    it("sem 'novevents' = [false], folha não-milestone NÃO gera VEVENT", () => {
      addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assert(!out.includes("BEGIN:VEVENT",),);
    });

    it("com 'novevents' = [false] e folha não-milestone → gera VEVENT", () => {
      report.set("novevents", false,);
      addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assert(out.includes("BEGIN:VEVENT",),);
      assert(out.includes("DTEND:20260205T000000Z",),);
      assert(out.includes("TRANSP:TRANSPARENT",),);
    });

    it("milestone folha não gera VEVENT mesmo com novevents=[false]", () => {
      report.set("novevents", false,);
      const t = addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      t.setForScenario("milestone", true, 0,);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      assert(!ical.to_iCal().includes("BEGIN:VEVENT",),);
    });

    it("tarefa não-folha (com filho) não gera VEVENT", () => {
      report.set("novevents", false,);
      const parent = addTask("p", "Parent", "2026-02-01", "2026-02-10",);
      addTask("c", "Child", "2026-02-01", "2026-02-05", parent,);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assertEquals((out.match(/BEGIN:VEVENT/g,) ?? []).length, 1,);
      assert(out.includes("SUMMARY:Child",),);
    });
  });

  describe("Organizer/Attendees (14.19.2.4 / 14.19.2.5)", () => {
    it("primeiro responsável com email vira ORGANIZER", () => {
      const r = new Resource(project, "r1", "Alice", null,);
      r.set("email", "alice@ex.com",);
      const t = addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      t.setForScenario("responsible", [r,], 0,);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assert(out.includes("ORGANIZER;CN=Alice:mailto:alice@ex.com",),);
    });

    it("responsável sem email NÃO vira ORGANIZER", () => {
      const r = new Resource(project, "r1", "Alice", null,);
      const t = addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      t.setForScenario("responsible", [r,], 0,);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      assert(!ical.to_iCal().includes("ORGANIZER",),);
    });

    it("assignedresources com email viram ATTENDEEs", () => {
      const r1 = new Resource(project, "r1", "Alice", null,);
      r1.set("email", "alice@ex.com",);
      const r2 = new Resource(project, "r2", "Bob", null,);
      r2.set("email", "bob@ex.com",);
      const t = addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      t.setForScenario("assignedresources", [r1, r2,], 0,);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assert(out.includes("ATTENDEE;CN=Alice:mailto:alice@ex.com",),);
      assert(out.includes("ATTENDEE;CN=Bob:mailto:bob@ex.com",),);
    });

    it("assignedresource sem email é ignorado", () => {
      const r = new Resource(project, "r1", "Ghost", null,);
      const t = addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      t.setForScenario("assignedresources", [r,], 0,);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      assert(!ical.to_iCal().includes("ATTENDEE",),);
    });
  });

  describe("relatedTo (hierarquia)", () => {
    it("filho referencia UID do pai quando o pai já foi emitido", () => {
      const parent = addTask("p", "Parent", "2026-02-01", "2026-02-10",);
      addTask("c", "Child", "2026-02-01", "2026-02-05", parent,);
      // Ordena pai antes de filho (default seqno já produz isso; garantimos).
      report.set("sortTasks", [["seqno", true, -1,],],);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      const parentUid = `${
        String(parent.getForScenario("projectid", 0,),)
      }-${parent.fullId}-TODO`;
      assert(out.includes(`RELATED-TO:${parentUid}`,), out,);
    });
  });

  describe("to_iCal (14.19.2.8)", () => {
    it("retorna string com CRLF ao final de cada linha", () => {
      addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assert(!out.match(/(?<!\r)\n/,), "sem LF isolado",);
      assert(out.includes("\r\nEND:VCALENDAR\r\n",),);
    });

    it("sem tarefas gera apenas o envelope", () => {
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assert(out.includes("BEGIN:VCALENDAR",),);
      assert(out.includes("END:VCALENDAR",),);
      assert(!out.includes("BEGIN:VTODO",),);
    });
  });

  describe("Journal defensivo (14.19.2.7)", () => {
    it("ausência de entriesByTask silencia VJOURNAL sem lançar", () => {
      addTask("t1", "Alpha", "2026-02-01", "2026-02-05",);
      const ical = new ICalReport(report,);
      ical.generateIntermediateFormat();
      const out = ical.to_iCal();
      assert(!out.includes("BEGIN:VJOURNAL",),);
    });
  });

  describe("Fábrica de conteúdo (14.19 wiring)", () => {
    it("'ical' está registrado em contentFactories", () => {
      const factory = contentFactories.get("ical",);
      assert(factory, "fábrica ical presente",);
      const content = factory!(report,) as unknown as ICalReport;
      assert(content instanceof ICalReport,);
    });
  });
});
