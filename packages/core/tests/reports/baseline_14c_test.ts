/**
 * MSPDI `<Baseline>` via `baseline <scenario>` (Fase 14 Complemento, 14C.10).
 *
 * `baseline` é uma **extensão SyntaxMesh** (adendo §10): não existe no
 * TaskJuggler 3.8.4, onde o `MspXmlRE.rb` nunca emite `<Baseline>`. O atributo
 * guarda o **índice** do cenário e o exportador deriva dele
 *   • um `<Baseline><Number>0</Number>` do projeto com o menor `Start`/maior
 *     `Finish` das tarefas agendadas naquele cenário e o `Cost` do cenário;
 *   • um `<Baseline>` por tarefa que tenha `start`/`end` no cenário.
 *
 * Sem o atributo nada é emitido, então `mspdi.golden.json` (oracle tj3)
 * permanece byte-idêntico — ver `mspdi_oracle_14c_test.ts` (14C.10.6).
 *
 * O `<Cost>` só aparece quando há `CostEvent` do cenário (Fase 8.2). Nenhum
 * fixture `.tjp` atual gera eventos (o caminho depende de chargeset de
 * recurso), por isso o teste de custo injeta eventos sintéticos no projeto
 * já agendado.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §11.3
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { parseProject, } from "../parser/parse-helper.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import type { Task, } from "../../src/model/task.ts";
import { PropertySet, } from "../../src/model/property-set.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { registerReportAttributes, } from "../../src/model/attributes/report-attributes.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { MspXmlRE, } from "../../src/reports/msp-xml-re.ts";
import { CostEvent, } from "../../src/accounting/cost-event.ts";
import { globalRegistry, } from "../../src/i18n/mod.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/** Cabeçalho de projeto com os cenários fornecidos. */
function header(scenarios: string,): string {
  return 'project prj "Test" "1.0" 2026-03-02 - 2026-04-30 {\n' +
    '  timezone "UTC"\n  timeformat "%Y-%m-%d"\n  now 2026-03-02\n' +
    scenarios + "}\n";
}

/** `plan` (topo) com as folhas `base` e `atual`, índices 0/1/2. */
const SCENARIOS = '  scenario plan "Plan" {\n' +
  '    scenario base "Baseline" {\n    }\n' +
  '    scenario atual "Atual" {\n    }\n  }\n';

/** Bloco de export MSP com os atributos extras informados. */
function exportBlock(extra: string,): string {
  return `export "MS Project" {\n  formats mspxml\n${extra}}\n`;
}

/** Lê um fixture da pasta `ext/`. */
function fixture(name: string,): string {
  return Deno.readTextFileSync(
    new URL(`../fixtures/ext/${name}.tjp`, import.meta.url,),
  );
}

/** Bloco `<tag>` mais externo de `xml` (primeira ocorrência). */
function blocks(xml: string, tag: string,): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g",);
  return [...xml.matchAll(re,),].map((m,) => m[1]!);
}

/** Texto de um campo simples dentro de um bloco. */
function field(block: string, tag: string,): string | null {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`,).exec(block,);
  return match ? match[1]! : null;
}

/** `<Task>` cujo `<Name>` é `name`. */
function taskNamed(xml: string, name: string,): string {
  const found = blocks(xml, "Task",).find((t,) => field(t, "Name",) === name);
  if (!found) throw new Error(`<Task> ${name} não encontrado`,);
  return found;
}

/** `<Baseline>` do projeto (antes de `<Tasks>`), ou `null`. */
function projectBaseline(xml: string,): string | null {
  const head = xml.split("<Tasks>",)[0] ?? xml;
  return blocks(head, "Baseline",)[0] ?? null;
}

/** `<Baseline>` da tarefa `name`, ou `null`. */
function taskBaseline(xml: string, name: string,): string | null {
  return blocks(taskNamed(xml, name,), "Baseline",)[0] ?? null;
}

/** Gera o MSPDI do fixture (memoizado por nome). */
const cache = new Map<string, { xml: string; project: Project }>();

function generate(name: string,): { xml: string; project: Project } {
  const hit = cache.get(name,);
  if (hit) return hit;
  const parsed = parseProject(fixture(name,),);
  assertEquals(parsed.threw?.message ?? null, null,);
  const project = parsed.result as Project;
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  assertEquals(project.schedule(), true,);
  const report = (project.reports.toArray() as Report[]).find((r,) =>
    r.name === "MS Project"
  );
  if (!report) throw new Error(`relatório MS Project ausente em ${name}`,);
  project.reportContexts.push(new ReportContext(project, report,),);
  const xml = new MspXmlRE(report,).to_mspxml();
  const out = { xml, project, };
  cache.set(name, out,);
  return out;
}

/** Mensagens registradas com um dos `ids`. */
function messagesWith(ids: string[],): string[] {
  return MessageHandlerInstance.instance.messages
    .filter((m,) => ids.includes(m.id,))
    .map((m,) => m.id);
}

// ----------------------------------------------------------------------
// 14C.10.1 — atributo de report
// ----------------------------------------------------------------------

describe("atributo baseline (14C.10.1)", () => {
  it("é IntegerAttribute não herdado, sem default e não cenário-específico", () => {
    const project = createTestProject();
    const ps = new PropertySet(project, false,);
    registerReportAttributes(ps,);
    const def = ps.attributeDefinition("baseline",);
    assert(def !== undefined, "baseline deve estar registrado",);
    assertEquals(def.name, "Baseline",);
    assertEquals(def.type, AttributeType.Integer,);
    assertEquals(def.defaultValue, null,);
    assertEquals(def.userDefined, false,);
    assertEquals(def.isList, false,);
    assertEquals(def.isScenarioAttribute, false,);
    assertEquals(def.inheritedFromParent, false,);
    assertEquals(def.inheritedFromProject, false,);
  });

  it("é ausente por padrão em relatório que não declara baseline", () => {
    const parsed = parseProject(fixture("14c-mspdi-ext",),);
    const project = parsed.result as Project;
    const report = (project.reports.toArray() as Report[])[0]!;
    assertEquals(report.get("baseline",), null,);
  });
});

// ----------------------------------------------------------------------
// 14C.10.2 — parser
// ----------------------------------------------------------------------

describe("parser de baseline no bloco export (14C.10.2)", () => {
  it("grava o índice do cenário declarado", () => {
    const out = parseProject(
      header(SCENARIOS,) + exportBlock("  baseline base\n",),
    );
    assertEquals(out.threw, null,);
    assertEquals(out.messageIds, [],);
    const report = ((out.result as Project).reports.toArray() as Report[])[0]!;
    assertEquals(report.get("baseline",), 1,);
  });

  it("cenário desconhecido gera unknown_scenario_id e não grava o atributo", () => {
    const out = parseProject(
      header(SCENARIOS,) + exportBlock("  baseline fantasma\n",),
    );
    assert(out.messageIds.includes("unknown_scenario_id",),);
    const report = ((out.result as Project).reports.toArray() as Report[])[0]!;
    assertEquals(report.get("baseline",), null,);
  });

  it("cenário inativo gera o aviso baseline_sc_disabled", () => {
    const inactive = '  scenario plan "Plan" {\n' +
      '    scenario base "Baseline" {\n      active no\n    }\n' +
      '    scenario atual "Atual" {\n    }\n  }\n';
    const out = parseProject(
      header(inactive,) + exportBlock("  baseline base\n",),
    );
    assertEquals(out.messageIds, ["baseline_sc_disabled",],);
    // O índice é preservado: o exportador é quem omite o `<Baseline>`.
    const report = ((out.result as Project).reports.toArray() as Report[])[0]!;
    assertEquals(report.get("baseline",), 1,);
  });
});

// ----------------------------------------------------------------------
// 14C.10.3 — i18n
// ----------------------------------------------------------------------

describe("i18n de baseline (14C.10.3)", () => {
  it("registry resolve os sinônimos pt-BR e es", () => {
    assertEquals(globalRegistry.resolve("linhadebase", "pt-BR",), "baseline",);
    assertEquals(globalRegistry.resolve("lineabase", "es",), "baseline",);
    assertEquals(globalRegistry.resolve("baseline", "en",), "baseline",);
  });

  it("mesma AST em pt-BR e es", () => {
    const pt = parseProject(
      'language "pt-BR"\nprojeto prj "Teste" "1.0" 2026-03-02 - 2026-04-30\n' +
        "{\n" + '  cenário plan "Plan" {\n' +
        '    cenário base "Linha de base" {\n    }\n' +
        '    cenário atual "Atual" {\n    }\n  }\n}\n' +
        'exportar "MS Project" {\n  formatos mspxml\n  linhadebase base\n}\n',
    );
    assertEquals(pt.threw, null,);
    assertEquals(pt.messageIds, [],);
    const report = ((pt.result as Project).reports.toArray() as Report[])[0]!;
    assertEquals(report.get("baseline",), 1,);
  });
});

// ----------------------------------------------------------------------
// 14C.10.4 — <Baseline> do projeto
// ----------------------------------------------------------------------

describe("MSPDI: <Baseline> do projeto (14C.10.4)", () => {
  it("emite Number 0 com Start/Finish do cenário de linha de base", () => {
    const { xml, } = generate("14c-baseline",);
    const baseline = projectBaseline(xml,);
    assert(baseline !== null, "projeto deve ter <Baseline>",);
    assertEquals(field(baseline, "Number",), "0",);
    // alpha 02/03–06/03, beta 09/03–11/03 (horário útil do calendário).
    assertEquals(field(baseline, "Start",), "2026-03-02T09:00:00",);
    assertEquals(field(baseline, "Finish",), "2026-03-11T17:00:00",);
    // Sem CostEvent no cenário: o <Cost> é omitido.
    assertEquals(field(baseline, "Cost",), null,);
  });

  it("soma os CostEvent do cenário de linha de base no <Cost>", () => {
    const parsed = parseProject(fixture("14c-baseline",),);
    const project = parsed.result as Project;
    assertEquals(project.schedule(), true,);
    const alpha = project.task("alpha",) as Task;
    project.costEvents.push(
      new CostEvent(
        "resource_effort",
        300,
        null,
        "project_default",
        1,
        "planned",
        alpha,
      ),
    );
    project.costEvents.push(
      new CostEvent(
        "task_charge",
        200,
        null,
        "project_default",
        1,
        "planned",
        null,
      ),
    );
    const report = (project.reports.toArray() as Report[]).find((r,) =>
      r.name === "MS Project"
    )!;
    project.reportContexts.push(new ReportContext(project, report,),);
    const xml = new MspXmlRE(report,).to_mspxml();
    assertEquals(field(projectBaseline(xml,)!, "Cost",), "500.0",);
    assertEquals(field(taskBaseline(xml, "Alpha",)!, "Cost",), "300.0",);
    // Nenhum evento de `beta`: sem <Cost> na baseline dele.
    assertEquals(field(taskBaseline(xml, "Beta",)!, "Cost",), null,);
  });

  it("omite o projeto inteiro e avisa quando o cenário não tem datas", () => {
    const { xml, } = generate("14c-baseline-gap",);
    assertEquals(projectBaseline(xml,), null,);
    assertEquals(messagesWith(["baseline_not_scheduled",],), [
      "baseline_not_scheduled",
    ],);
  });
});

// ----------------------------------------------------------------------
// 14C.10.5 — <Baseline> por tarefa
// ----------------------------------------------------------------------

describe("MSPDI: <Baseline> por tarefa (14C.10.5)", () => {
  it("emite uma baseline por tarefa agendada no cenário", () => {
    const { xml, } = generate("14c-baseline",);
    const alpha = taskBaseline(xml, "Alpha",);
    const beta = taskBaseline(xml, "Beta",);
    assert(alpha !== null && beta !== null,);
    assertEquals(field(alpha, "Number",), "0",);
    assertEquals(field(alpha, "Start",), "2026-03-02T09:00:00",);
    assertEquals(field(alpha, "Finish",), "2026-03-06T17:00:00",);
    assertEquals(field(beta, "Start",), "2026-03-09T09:00:00",);
    assertEquals(field(beta, "Finish",), "2026-03-11T17:00:00",);
  });

  it("não emite baseline de tarefa quando o cenário não tem datas", () => {
    const { xml, } = generate("14c-baseline-gap",);
    assertEquals(taskBaseline(xml, "Alpha",), null,);
    // Só o projeto e a tarefa existem: nenhum <Baseline> no documento.
    assertEquals(xml.includes("<Baseline>",), false,);
  });
});

// ----------------------------------------------------------------------
// 14C.10.6 — regressão: sem baseline nada muda
// ----------------------------------------------------------------------

describe("sem baseline no relatório (14C.10.6)", () => {
  it("não emite <Baseline> em nenhum lugar", () => {
    const { xml, } = generate("14c-mspdi-ext",);
    assertEquals(xml.includes("<Baseline>",), false,);
  });
});
