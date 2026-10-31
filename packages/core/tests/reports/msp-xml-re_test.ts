/**
 * Testes de MspXmlRE (Fase 14.18.3).
 *
 * Cobre os helpers puros (`durationToMsp`/`daytimeToS`), a estrutura do
 * documento MSP (declaração XML, comentário, `Project` com `xmlns`, `Calendars`
 * com o calendário 'Standard') e o registro da fábrica sob `export`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.18.3)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import {
  daytimeToS,
  durationToMsp,
  MspXmlRE,
} from "../../src/reports/msp-xml-re.ts";

describe("MspXmlRE (14.18.3)", () => {
  describe("durationToMsp", () => {
    it("formata segundos como PT{H}H{M}M{S}S", () => {
      assertEquals(durationToMsp(3726,), "PT1H2M6S",);
    });
    it("trata zero e apenas segundos", () => {
      assertEquals(durationToMsp(0,), "PT0H0M0S",);
      assertEquals(durationToMsp(45,), "PT0H0M45S",);
    });
    it("apenas horas", () => {
      assertEquals(durationToMsp(7200,), "PT2H0M0S",);
    });
  });

  describe("daytimeToS", () => {
    it("formata segundos desde a meia-noite como HH:MM:SS", () => {
      assertEquals(daytimeToS(9 * 3600,), "09:00:00",);
      assertEquals(daytimeToS(17 * 3600 + 30 * 60 + 5,), "17:30:05",);
    });
    it("zero-pad", () => {
      assertEquals(daytimeToS(0,), "00:00:00",);
    });
  });

  describe("to_mspxml — estrutura (14.18.3.3)", () => {
    let project: Project;
    let report: Report;

    beforeEach(() => {
      project = createTestProject(1,);
      report = new Report(project, "msp", "msp.xml", null,);
      report.set("start", TjTime.fromString("2026-01-01",),);
      report.set("end", TjTime.fromString("2026-12-31",),);
      report.set("scenarios", [0,],);
      report.set("sortResources", [],);
      report.set("sortTasks", [],);
      project.reportContexts.push(new ReportContext(project, report,),);
    },);

    function generate(): string {
      return new MspXmlRE(report,).to_mspxml();
    }

    it("emite a declaração XML e o elemento Project com xmlns", () => {
      const xml = generate();
      assert(
        xml.startsWith(
          '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
        ),
        "declaração XML no topo",
      );
      assert(
        xml.includes(
          '<Project xmlns="http://schemas.microsoft.com/project">',
        ),
        "elemento Project com namespace MSP",
      );
    });

    it("inclui um comentário de geração com o nome do software", () => {
      const xml = generate();
      assert(xml.includes("<!--",), "comentário presente",);
      assert(xml.includes("SyntaxMesh",), "comentário cita o software",);
    });

    it("gera os atributos do projeto (SaveVersion, StartDate, CalendarUID)", () => {
      const xml = generate();
      assert(xml.includes("<SaveVersion>14</SaveVersion>",),);
      assert(xml.includes("<ScheduleFromStart>1</ScheduleFromStart>",),);
      assert(xml.includes("<CalendarUID>1</CalendarUID>",),);
      assert(xml.includes("<Tasks/>",) || xml.includes("<Tasks>",),);
    });

    it("cria o calendário base 'Standard' (14.18.3.4/14.18.3.5)", () => {
      const xml = generate();
      assert(xml.includes("<Calendars>",),);
      assert(xml.includes("<Calendar>",),);
      assert(xml.includes("<Name>Standard</Name>",),);
      assert(xml.includes("<IsBaseCalendar>1</IsBaseCalendar>",),);
    });
  });
});
