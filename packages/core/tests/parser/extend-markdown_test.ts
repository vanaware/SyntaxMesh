/**
 * Bloco C5 (ADR 039 — `fase-10-complemento3.md`) — tipo `markdown` em `extend`.
 *
 * C5.1: fix fiel ao Ruby — `richtext` em `extend` registra
 * `AttributeType.RichText` (`TjpSyntaxRules.rb:1322`,
 * `extendPropertySetDefinition(RichTextAttribute, nil)`).
 * C5.4/C5.6: padrão `_markdown` em `extendAttributes`; valor via
 * `MarkdownFactory` (mesmo `RichTextIntermediate` do `richtext`).
 * C5.5: scanner/i18n (keyword `markdown` já canônica — C3.9).
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { RichTextAttribute, } from "../../src/attributes/rich/rich-text-attribute.ts";
import { MarkdownAttribute, } from "../../src/attributes/rich/markdown-attribute.ts";
import { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import { Report, } from "../../src/model/report.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TjpExportRE, } from "../../src/reports/tjp-export-re.ts";
import type { XMLElementLike, } from "../../src/xml/xml-element-like.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Task, } from "../../src/model/task.ts";

/** Corpo de projeto com `extend` + tarefa. */
function projectBody(extend: string, task: string,): string {
  return 'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n' + extend +
    "}\n" + task;
}

/** Serializa o retorno de `RichTextIntermediate#to_html`. */
function html(rti: RichTextIntermediate,): string {
  const out = rti.to_html() as XMLElementLike | XMLElementLike[] | null;
  if (out === null) return "";
  const list = Array.isArray(out,) ? out : [out,];
  return list.map((el,) => el.toHTML()).join("",);
}

/** Parseia sem tolerar mensagens; devolve o Project. */
function mustParse(text: string,): Project {
  const out = parseProject(text,);
  assertEquals(out.threw, null, `parse lançou: ${out.threw?.message ?? ""}`,);
  assertEquals(out.messageIds, [], `msgs=${out.messageIds.join(",",)}`,);
  return out.result as Project;
}

/** Monta um relatório de export pronto para uso (padrão 14C.1.13). */
function exportReport(
  project: Project,
  taskAttributes: string[],
): Report {
  const report = new Report(project, "tj", "export.tji", null,);
  report.set("start", TjTime.fromString("2026-01-01",),);
  report.set("end", TjTime.fromString("2026-12-31",),);
  report.set("scenarios", [0,],);
  report.set("sortResources", [],);
  report.set("sortTasks", [],);
  // `project` traz a seção que carrega as declarações `extend` — sem ela o
  // round-trip não tem como registrar os atributos de usuário.
  report.set("definitions", ["project", "tasks",],);
  report.set("resourceAttributes", [],);
  report.set("taskAttributes", taskAttributes,);
  project.reportContexts.push(new ReportContext(project, report,),);
  return report;
}

describe("C5.1 — `richtext` em `extend` registra AttributeType.RichText", () => {
  it("definição usa AttributeType.RichText e atributo é RichTextAttribute", () => {
    const p = mustParse(
      projectBody(
        'extend task {\n  richtext Intro "Intro"\n}\n',
        "task t \"T\" {\n  Intro \"'''x'''\"\n}\n",
      ),
    );
    const t = p.task("t",) as Task;
    const def = t.propertySet.attributeDefinition("Intro",);
    assert(def !== undefined, "atributo Intro não registrado",);
    assertEquals(def!.type, AttributeType.RichText,);
    const attr = t.getAttribute("Intro",);
    assert(attr instanceof RichTextAttribute, "não é RichTextAttribute",);
    assert(attr.get() instanceof RichTextIntermediate, "valor não é RTI",);
  });

  it("to_s renderiza o markup MediaWiki e to_tjp prefixa o id", () => {
    const p = mustParse(
      projectBody(
        'extend task {\n  richtext Intro "Intro"\n}\n',
        'task t "T" {\n  Intro "abc"\n}\n',
      ),
    );
    const attr = (p.task("t",) as Task).getAttribute("Intro",);
    assert(attr.to_s().includes("abc",), `to_s=${attr.to_s()}`,);
    assertEquals(attr.to_tjp(), 'Intro "abc"',);
  });
});

describe("C5.4/C5.6 — `markdown` em `extend`", () => {
  it("parseia sem mensagens e registra AttributeType.Markdown", () => {
    const p = mustParse(
      projectBody(
        'extend task {\n  markdown Claim "Claim"\n}\n',
        'task t "T" {\n  Claim "**x**"\n}\n',
      ),
    );
    const t = p.task("t",) as Task;
    const def = t.propertySet.attributeDefinition("Claim",);
    assert(def !== undefined, "atributo Claim não registrado",);
    assertEquals(def!.type, AttributeType.Markdown,);
    const attr = t.getAttribute("Claim",);
    assert(attr instanceof MarkdownAttribute, "não é MarkdownAttribute",);
    // Mesmo contrato de RichTextAttribute por herança (ADR 039, D1).
    assert(attr instanceof RichTextAttribute, "não herda RichTextAttribute",);
    assert(attr.get() instanceof RichTextIntermediate, "valor não é RTI",);
  });

  it("to_s é texto puro e to_markdown preserva o markup de origem", () => {
    const p = mustParse(
      projectBody(
        'extend task {\n  markdown Claim "Claim"\n}\n',
        'task t "T" {\n  Claim "**Efetivo:** 15"\n}\n',
      ),
    );
    const attr = (p.task("t",) as Task).getAttribute("Claim",);
    const rti = attr.get() as RichTextIntermediate;
    const text = rti.to_s();
    assert(text.includes("Efetivo:",), `to_s=${text}`,);
    assert(!text.includes("**",), `to_s com markup cru: ${text}`,);
    assert(rti.to_markdown().includes("**Efetivo:**",), "to_markdown",);
  });

  it("to_html vem do pipeline markdown (negrito) e é sanitizado", () => {
    // O payload vai em bloco tesoura: aspas desbalanceadas dentro de "..."
    // quebram o scanner TJP em qualquer dialeto (Ruby scaneia o mesmo —
    // a string consome até a próxima aspa par). Em `-8<-` não há aspas.
    const p = mustParse(
      projectBody(
        'extend task {\n  markdown Claim "Claim"\n}\n',
        'task t "T" {\n  Claim -8<-\n**Efetivo:** 15 <script>mau()</script>\n->8-\n}\n',
      ),
    );
    const rti = (p.task("t",) as Task).getAttribute("Claim",)
      .get() as RichTextIntermediate;
    const out = html(rti,);
    // O `strong` do Markdown cai no `bold` do RichText → `<b>` (Fase 13).
    assert(out.includes("<b>Efetivo:</b>",), `html=${out}`,);
    assert(!out.includes("<script>",), `script não sanitizado: ${out}`,);
  });

  it("valor em bloco -8<- ... ->8-", () => {
    const p = mustParse(
      projectBody(
        'extend task {\n  markdown Claim "Claim"\n}\n',
        'task t "T" {\n  Claim -8<-\n**Efetivo:** 15 pedreiros.\n->8-\n}\n',
      ),
    );
    const rti = (p.task("t",) as Task).getAttribute("Claim",)
      .get() as RichTextIntermediate;
    assert(html(rti,).includes("<b>Efetivo:</b>",), "bloco -8<",);
  });

  it("scenariospecific grava no cenário; inherit marca a definição", () => {
    const p = mustParse(
      projectBody(
        'extend task {\n  markdown Claim "Claim" { scenariospecific }\n' +
          '  markdown Note2 "Note 2" { inherit }\n}\n',
        'task t "T" {\n  Claim "**x**"\n}\n',
      ),
    );
    const t = p.task("t",) as Task;
    const rti = t.getForScenario("Claim", 0,) as RichTextIntermediate;
    assert(rti instanceof RichTextIntermediate, "valor não está no cenário 0",);
    assert(html(rti,).includes("<b>x</b>",), "render cenário",);
    assert(
      t.propertySet.attributeDefinition("Note2",)!.inheritedFromParent,
      "inherit não registrado",
    );
  });

  it("id sem maiúscula inicial → extend_id_cap", () => {
    const out = parseProject(
      projectBody('extend task {\n  markdown lower "Lower"\n}\n', "",),
    );
    assert(out.messageIds.includes("extend_id_cap",),);
  });

  it("`markdown` continua sendo keyword canônica nos 3 idiomas", () => {
    // C5.5 — keyword já entregue em C3.9; o que muda é só a gramática.
    const en = mustParse(
      projectBody(
        'extend task {\n  markdown Claim "C"\n}\n',
        'task t "T" {\n}',
      ),
    );
    assert(en.task("t",) !== null, "en",);
    const pt = mustParse(
      'language "pt-BR"\n' +
        'projeto prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n' +
        '  estender tarefa {\n    markdown Reiv "Reiv"\n  }\n}\n' +
        'tarefa t "T" {\n  Reiv "**x**"\n}\n',
    );
    const t = pt.task("t",) as Task;
    assertEquals(
      t.propertySet.attributeDefinition("Reiv",)!.type,
      AttributeType.Markdown,
    );
    assert(
      html(t.getAttribute("Reiv",).get() as RichTextIntermediate,)
        .includes("<b>x</b>",),
      "pt-BR",
    );
  });
});

describe("C5.7 — round-trip TJP-export (parse → export → parse)", () => {
  // `extend` vive no corpo de `project` (rule extendBody); `task` é statement
  // de topo — mesmo formato que o TjpExportRE emite (generateTaskList, 0-indent).
  // Sem `start` na tarefa: `DateAttribute#to_tjp` emite `date <valor>` (fiel ao
  // Ruby) e o relido não reduz — limitação já registrada em 14C.1.13.
  const SOURCE = 'project prj "Test" "1.0" 2026-01-01 - 2026-12-31 {\n' +
    'extend task {\n  markdown Claim "Claim"\n  richtext Intro "Intro"\n}\n}\n' +
    'task t1 "T1" {\n  Claim "**Efetivo:** 15"\n  Intro "abc"\n}\n';

  it("export declara markdown/richtext via tjpId e preserva o valor", () => {
    const project = mustParse(SOURCE,);
    const tjp = new TjpExportRE(
      exportReport(project, ["Claim", "Intro",],),
    ).to_tjp();
    assert(
      tjp.includes('markdown Claim "Claim"',),
      `sem declaração markdown: ${tjp}`,
    );
    assert(
      tjp.includes('richtext Intro "Intro"',),
      `sem declaração richtext: ${tjp}`,
    );
    // Valor: RichTextAttribute#to_tjp prefixa o id da definição, não o tipo.
    assert(tjp.includes('Claim "**Efetivo:** 15"',), `sem valor: ${tjp}`,);

    // Round-trip: reparseia a saída e confere o RTI preservado.
    const back = mustParse(tjp,);
    const t = back.task("t1",) as Task;
    assertEquals(
      t.propertySet.attributeDefinition("Claim",)!.type,
      AttributeType.Markdown,
    );
    const rti = t.getAttribute("Claim",).get() as RichTextIntermediate;
    assert(
      rti.to_markdown().includes("**Efetivo:** 15",),
      "round-trip markdown",
    );
  });

  it("round-trip do richtext preserva o texto de origem", () => {
    const project = mustParse(SOURCE,);
    const tjp = new TjpExportRE(
      exportReport(project, ["Intro",],),
    ).to_tjp();
    const back = mustParse(tjp,);
    const attr = (back.task("t1",) as Task).getAttribute("Intro",);
    assert(attr instanceof RichTextAttribute, "não é RichTextAttribute",);
    assert(attr.to_s().includes("abc",), `to_s=${attr.to_s()}`,);
  });
});
