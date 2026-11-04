/**
 * Extensões MSPDI do `MspXmlRE` (Fase 14 Complemento, 14C.4.2–4.13).
 *
 * O fixture `14c-mspdi-ext.tjp` exercita tudo o que o `MspXmlRE.rb` original
 * não exporta e que decidimos emitir como extensão SyntaxMesh: recursos de
 * material (`<Type>`0) e de custo (`<Type>`2), atribuições de material/custo
 * com `<TimephasedData>` de custo (`Type`6), progresso (`effortdone`),
 * `<Notes>`, `<Exceptions>` de calendário, `<DurationFormat>` `ed` e
 * `<LinkLag>`/`<LagFormat>`.
 *
 * Os cortes de unidade seguem o modelo do core: `effort`, `effortdone` e
 * `gapLength` são armazenados em **slots** (`segundos ÷ scheduleGranularity`),
 * não em dias.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.4)
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { parseProject, } from "../parser/parse-helper.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { asMoney, MspXmlRE, } from "../../src/reports/msp-xml-re.ts";

/** XML gerado uma única vez para o fixture de extensões (memoizado). */
let cached: string | null = null;

function generate(): string {
  if (cached !== null) return cached;
  const source = Deno.readTextFileSync(
    new URL("../fixtures/ext/14c-mspdi-ext.tjp", import.meta.url,),
  );
  const parsed = parseProject(source,);
  assertEquals(parsed.threw?.message ?? null, null,);
  const project = parsed.result as Project;
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  assertEquals(project.schedule(), true,);
  const report = (project.reports.toArray() as Report[]).find((r,) =>
    r.name === "MS Project"
  );
  if (!report) throw new Error("report MS Project não encontrado",);
  project.reportContexts.push(new ReportContext(project, report,),);
  cached = new MspXmlRE(report,).to_mspxml();
  return cached;
}

/** Blocos de primeiro nível com `tag` (o MSPDI gerado é plano). */
function blocks(xml: string, tag: string,): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g",);
  return [...xml.matchAll(re,),].map((m,) => m[1]!);
}

/** Texto de um campo simples dentro de um bloco. */
function field(block: string, tag: string,): string | null {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`,).exec(block,);
  return match ? match[1]! : null;
}

/** `<Resource>` cujo `<Name>` é `name`. */
function resourceNamed(xml: string, name: string,): string {
  const found = blocks(xml, "Resource",).find((r,) =>
    field(r, "Name",) === name
  );
  if (!found) throw new Error(`<Resource> ${name} não encontrado`,);
  return found;
}

/** `<Task>` cujo `<Name>` é `name`. */
function taskNamed(xml: string, name: string,): string {
  const found = blocks(xml, "Task",).find((t,) => field(t, "Name",) === name);
  if (!found) throw new Error(`<Task> ${name} não encontrado`,);
  return found;
}

/** `<Assignment>` de `taskName` para o recurso com `resourceName`. */
function assignmentFor(
  xml: string,
  taskName: string,
  resourceName: string,
): string {
  const taskUid = field(taskNamed(xml, taskName,), "UID",);
  const resourceUid = field(resourceNamed(xml, resourceName,), "UID",);
  const found = blocks(xml, "Assignment",).find(
    (a,) =>
      field(a, "TaskUID",) === taskUid &&
      field(a, "ResourceUID",) === resourceUid,
  );
  if (!found) {
    throw new Error(`<Assignment> ${taskName}/${resourceName} não encontrado`,);
  }
  return found;
}

describe("MspXmlRE — extensões MSPDI (14C.4)", () => {
  describe("recursos de material e de custo (14C.4.2/14C.4.4)", () => {
    it("exporta Material como <Resource> Type 0 com label, rate e notas", () => {
      const steel = resourceNamed(generate(), "Aço",);
      // 0 = material na tabela oficial do elemento Type (ver nota do módulo).
      assertEquals(field(steel, "Type",), "0",);
      assertEquals(field(steel, "MaterialLabel",), "kg",);
      assertEquals(field(steel, "StandardRate",), "2.5",);
      assertEquals(field(steel, "Notes",), "Lote único de aço.",);
    });

    it("atribui UIDs globais distintos a humanos, materiais e charges", () => {
      const xml = generate();
      const uids = blocks(xml, "Resource",).map((r,) => field(r, "UID",));
      assertEquals(new Set(uids,).size, uids.length,);
      // Recursos humanos continuam Type 1.
      assertEquals(field(resourceNamed(xml, "Alice",), "Type",), "1",);
      const charge = blocks(xml, "Resource",).find((r,) =>
        (field(r, "Name",) ?? "").startsWith("Charges ",)
      )!;
      assertEquals(field(charge, "Type",), "2",);
      assertEquals(field(charge, "IsBudget",), "0",);
    });
  });

  describe("atribuições de material e de custo (14C.4.3/14C.4.4)", () => {
    it("liga atribuição de material por TaskUID/ResourceUID com Units e Cost", () => {
      const xml = generate();
      const a = assignmentFor(xml, "Design", "Aço",);
      assertEquals(field(a, "Units",), "200.0",);
      // 200 kg × 2,5 €/kg.
      assertEquals(field(a, "Cost",), "500.0",);
      assertEquals(
        field(a, "TaskUID",),
        field(taskNamed(xml, "Design",), "UID",),
      );
    });

    it("exporta charge flat como atribuição com <Cost> direto", () => {
      const xml = generate();
      const a = assignmentFor(xml, "Design", "Charges fase.design #1",);
      assertEquals(field(a, "Cost",), "500.0",);
      assertEquals(field(a, "Units",), "1.0",);
    });
  });

  describe("duração e formato (14C.4.5)", () => {
    it("usa DurationFormat 7 para tarefa em calendário normal", () => {
      assertEquals(
        field(taskNamed(generate(), "Design",), "DurationFormat",),
        "7",
      );
    });

    it("usa DurationFormat 8 (elapsed days) em calendário 24×7, nunca 9", () => {
      const cure = taskNamed(generate(), "Cura",);
      assertEquals(field(cure, "DurationFormat",), "8",);
      assert(field(cure, "Duration",) !== null,);
      assert(
        !blocks(generate(), "Task",).some((t,) =>
          field(t, "DurationFormat",) === "9"
        ),
        "DurationFormat 9 não é usado para `ed`",
      );
    });
  });

  describe("progresso real (14C.4.6)", () => {
    it("converte effortdone (slots) em ActualWork/RemainingWork", () => {
      const design = taskNamed(generate(), "Design",);
      // effort 4d = 32 slots; effortdone 2d = 16 slots; granularidade 1h.
      assertEquals(field(design, "ActualWork",), "PT16H0M0S",);
      assertEquals(field(design, "RemainingWork",), "PT16H0M0S",);
    });

    it("omite progresso quando não há effortdone", () => {
      const cure = taskNamed(generate(), "Cura",);
      assertEquals(field(cure, "ActualWork",), null,);
      assertEquals(field(cure, "RemainingWork",), null,);
    });
  });

  describe("<Notes> (14C.4.7)", () => {
    it("exporta nota da tarefa em texto plano escapado", () => {
      assertEquals(
        field(taskNamed(generate(), "Design",), "Notes",),
        "Detalhar a arquitetura.",
      );
    });

    it("exporta nota do recurso humano", () => {
      assertEquals(
        field(resourceNamed(generate(), "Alice",), "Notes",),
        "Engenheira responsável.",
      );
    });
  });

  describe("<TimephasedData> estendido (14C.4.8)", () => {
    it("emite série de custo (Type 6) por dia na atribuição de material", () => {
      const a = assignmentFor(generate(), "Design", "Aço",);
      const series = blocks(a, "TimephasedData",);
      // `Design` tem `effortdone 2d` e o projeto tem `now 2026-03-02`: o
      // scheduler retoma de `now` (TaskScenario#bookBookings), então a janela
      // fica 2026-03-02T00:00 → 2026-03-04T11:00 — três dias de calendário.
      // Datas conferidas no tj3 3.8.4 real (Ruby: `design start=2026-03-02-00:00
      // end=2026-03-04-11:00`). A expectativa anterior (5 fatias) vinha do
      // `bookBookings` stub, que ignorava `effortdone`.
      assertEquals(series.length, 3,);
      for (const td of series) {
        assertEquals(field(td, "Type",), "6",);
        assertEquals(field(td, "Unit",), "2",);
        // 500 € (200 kg × 2,5 €/kg) em 3 fatias → 166,67 por dia.
        assertEquals(field(td, "Value",), "166.67",);
      }
      // A série cobre a janela inteira, uma fatia por dia de calendário.
      assertEquals(field(series[0]!, "Start",), "2026-03-02T00:00:00",);
      assertEquals(field(series[2]!, "Finish",), "2026-03-04T10:59:59",);
    });

    it("mantém Type 1 para trabalho humano e Type 6 para custo", () => {
      const xml = generate();
      const human = blocks(
        assignmentFor(xml, "Design", "Alice",),
        "TimephasedData",
      );
      assert(human.length > 0,);
      assertEquals(field(human[0]!, "Type",), "1",);
      const charge = blocks(
        assignmentFor(xml, "Design", "Charges fase.design #1",),
        "TimephasedData",
      );
      assertEquals(field(charge[0]!, "Type",), "6",);
    });
  });

  describe("calendário e exceções (14C.4.9)", () => {
    it("gera <Exceptions> a partir dos leaves do recurso", () => {
      const alice = resourceNamed(generate(), "Alice",);
      const calendarUid = field(alice, "CalendarUID",)!;
      const calendar = blocks(generate(), "Calendar",).find((c,) =>
        field(c, "UID",) === calendarUid
      )!;
      const exceptions = blocks(calendar, "Exception",);
      assertEquals(exceptions.length, 1,);
      const period = blocks(exceptions[0]!, "TimePeriod",)[0]!;
      assertEquals(field(period, "FromDate",), "2026-03-16T00:00:00",);
      assertEquals(field(period, "ToDate",), "2026-03-17T00:00:00",);
      assertEquals(field(exceptions[0]!, "DayWorking",), "0",);
    });
  });

  describe("dependências com lag (14C.4.11)", () => {
    it("converte gaplength (slots) em LinkLag de décimos de minuto", () => {
      const link = blocks(
        taskNamed(generate(), "Entrega",),
        "PredecessorLink",
      )[0]!;
      // 2d úteis = 2 × 480 min × 10.
      assertEquals(field(link, "LinkLag",), "9600",);
      assertEquals(field(link, "LagFormat",), "7",);
      assertEquals(field(link, "Type",), "1",);
    });
  });

  describe("validação estrutural do XML gerado (14C.4.13)", () => {
    it("mantém UIDs únicos e referências só por UID", () => {
      const xml = generate();
      const taskUids = blocks(xml, "Task",).map((t,) => field(t, "UID",));
      const resourceUids = blocks(xml, "Resource",).map((r,) =>
        field(r, "UID",)
      );
      const assignmentUids = blocks(xml, "Assignment",).map((a,) =>
        field(a, "UID",)
      );
      assertEquals(new Set(taskUids,).size, taskUids.length,);
      assertEquals(new Set(resourceUids,).size, resourceUids.length,);
      assertEquals(new Set(assignmentUids,).size, assignmentUids.length,);

      for (const a of blocks(xml, "Assignment",)) {
        assert(taskUids.includes(field(a, "TaskUID",),),);
        assert(resourceUids.includes(field(a, "ResourceUID",),),);
      }
    });

    it("emite durações ISO 8601 bem-formadas", () => {
      const xml = generate();
      const durations = [...xml.matchAll(/<Duration>([^<]*)<\/Duration>/g,),]
        .map((m,) => m[1]!);
      assert(durations.length > 0,);
      for (const d of durations) assert(/^PT\d+H\d+M\d+S$/.test(d,), d,);
    });

    it("aplica hideMaterial só quando o atributo existe (14C.4.10)", () => {
      // O atributo `hideMaterial` chega com 14C.6; até lá o filtro é inerte e o
      // material precisa continuar exportado.
      const xml = generate();
      assert(xml.includes("<Name>Aço</Name>",),);
    });
  });

  describe("asMoney — arredondamento monetário (15.13)", () => {
    it("arredonda à centavos sem ruído de ponto flutuante", () => {
      // `500 / 3` em JS vaza 166.66666666666669 para o XML.
      assertEquals(asMoney(500 / 3,), "166.67",);
      assertEquals(asMoney(2.005,), "2.01",);
    });

    it("preserva o sufixo .0 dos inteiros (asDecimal)", () => {
      assertEquals(asMoney(500,), "500.0",);
      assertEquals(asMoney(0,), "0.0",);
    });
  });
});
