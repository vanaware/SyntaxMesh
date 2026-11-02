/**
 * Testes do `RdoReport` (Fase 14 Complemento 14C.3).
 *
 * Cobre o registro na fábrica de conteúdo (substituindo o NYI de 14C.0.10), a
 * obrigatoriedade do `period` no parser, os cinco `groupby`, os `journalmode`
 * de status/alerta, `journalattributes`, a galeria (`picture` + imagens em
 * `details`) com `maxpictures`, as colunas/filtros e as saídas HTML/JSON.
 *
 * Os cenários vêm de um `.tjp` inline (parser real), garantindo que
 * `journalentry`/`picture`/`format`/`alert` chegam ao relatório como no
 * arquivo do usuário (ADR 027: nada é escrito em disco).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.3)
 * @see docs/syntaxmesh/fases/fase-10-complemento1.md §6
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { parseProject, } from "../parser/parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { RdoReport, } from "../../src/reports/rdo-report.ts";
import { contentFactories, } from "../../src/model/report-content.ts";

const HEADER = `project prj "RDO Test" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
}
`;

const BODY = `account acct "Conta Obra" {
  journalentry 2026-02-20 "Conta fevereiro" {
    summary "Lançamento do mês"
    alert green
  }
}

material steel "Aço" {
  unit "kg"
  unitprice 2.5
  journalentry 2026-03-05 "Chegada do aço" {
    summary "Lote único"
    alert yellow
    picture "img/steel.png" {
      caption "Pilha no estoque"
      align left
      width 320
      alt "Aço empilhado"
    }
  }
}

resource team "Equipe de obra" {
  journalentry 2026-02-15 "Kick-off" {
    summary "Reunião inicial"
    alert yellow
  }
}

task t1 "Fundação" {
  start 2026-02-01
  effort 5d
  chargeset acct 100%
  responsible team
  material steel 10
  charge 200 perday
  journalentry 2026-01-15 "Fora do período" {
    summary "Deve ser ignorado"
  }
  journalentry 2026-02-10 "Diário 1" {
    summary "Fundação concluída"
    alert red
    picture "img/a.png" {
      caption "Vala vista de lado"
      align right
      width 640
      alt "Vista lateral"
    }
  }
  journalentry 2026-02-10 "Diário 1b" {
    details "Detalhe: ![A](img/a.png) e ![B](img/b.png)"
    alert green
  }
  journalentry 2026-03-03 "Diário 2" {
    details "Turma noturna; aditivo de 4 m3"
    alert green
    format richtext
  }
}
`;

/** Fonte TJP com o `rdoreport` no final (atributos parametrizáveis). */
function source(
  attrs = `  period 2026-02-01 - 2026-03-31
  groupby date
  formats html, json`,
): string {
  return `${HEADER}\n${BODY}\nrdoreport rdo "RDO" {\n${attrs}\n}\n`;
}

/** Parseia a fonte e devolve o projeto (falha o teste se o parse quebrar). */
function parseTjp(text: string,): Project {
  const outcome = parseProject(text,);
  assert(outcome.threw === null, String(outcome.threw,),);
  return outcome.result as Project;
}

/** Gera o RDO, opcionalmente configurando a instância antes da geração. */
function generate(
  project: Project,
  extra: Record<string, unknown> = {},
  configure?: (re: RdoReport,) => void,
): RdoReport {
  const report = project.reports.get("rdo",) as Report;
  for (const [key, value,] of Object.entries(extra,)) report.force(key, value,);
  project.reportContexts.push(new ReportContext(project, report,),);
  const re = new RdoReport(report,);
  configure?.(re,);
  re.generateIntermediateFormat();
  return re;
}

/** HTML completo do relatório como string. */
function htmlOf(re: RdoReport,): string {
  return re.to_html().map((el,) => (el as { toHTML(): string }).toHTML())
    .join("\n",);
}

/** Projeto base já parseado com o `period` padrão. */
function baseProject(): Project {
  return parseTjp(source(),);
}

describe("RdoReport — registro e validação (14C.3.1)", () => {
  it("está registrado na fábrica de conteúdo sob rdoreport", () => {
    assert(contentFactories.has("rdoreport",),);
  });

  it("period é obrigatório (rdo_period_required no parser)", () => {
    const outcome = parseProject(
      `${HEADER}\n${BODY}\nrdoreport sem "Sem período" {\n  formats html\n}\n`,
    );
    assert(outcome.messageIds.includes("rdo_period_required",),);
  });

  it("groupby default é date", () => {
    const project = parseTjp(source(`  period 2026-02-01 - 2026-03-31`,),);
    assertEquals(generate(project,).groupby(), "date",);
  });
});

describe("RdoReport — groupby date (14C.3.2)", () => {
  it("cria um bloco por dia com entradas, ordenados por data", () => {
    const re = generate(baseProject(),);
    assertEquals(
      re.getGroups().map((group,) => group.id),
      ["2026-02-10", "2026-02-15", "2026-02-20", "2026-03-03", "2026-03-05",],
    );
    assertEquals(re.getGroups()[0]!.entries.length, 2,);
    assertEquals(re.getGroups()[0]!.name, "2026-02-10",);
  });

  it("entradas fora do period do relatório não geram bloco", () => {
    const re = generate(baseProject(),);
    const headlines = re.getGroups().flatMap((group,) =>
      group.entries.map((entry,) => entry.headline)
    );
    assert(!headlines.includes("Fora do período",), headlines.join(",",),);
    assertEquals(headlines.length, 6,);
  });
});

describe("RdoReport — groupby entidades (14C.3.3)", () => {
  it("groupby task: bloco por tarefa com as entradas do período", () => {
    const re = generate(baseProject(), { groupby: "task", },);
    assertEquals(re.getGroups().map((group,) => group.id), ["t1",],);
    assertEquals(re.getGroups()[0]!.entries.length, 3,);
  });

  it("groupby resource: bloco pelo recurso das entradas", () => {
    const re = generate(baseProject(), { groupby: "resource", },);
    assertEquals(re.getGroups().map((group,) => group.id), ["team",],);
    assertEquals(re.getGroups()[0]!.entries[0]!.headline, "Kick-off",);
  });

  it("groupby material: bloco pelo material das entradas", () => {
    const re = generate(baseProject(), { groupby: "material", },);
    assertEquals(re.getGroups().map((group,) => group.id), ["steel",],);
    assertEquals(
      re.getGroups()[0]!.entries[0]!.headline,
      "Chegada do aço",
    );
  });

  it("groupby account: bloco pela conta das entradas", () => {
    const re = generate(baseProject(), { groupby: "account", },);
    assertEquals(re.getGroups().map((group,) => group.id), ["acct",],);
    assertEquals(
      re.getGroups()[0]!.entries[0]!.headline,
      "Conta fevereiro",
    );
  });
});

describe("RdoReport — journalmode (14C.3.4)", () => {
  it("status_down mantém só a entrada corrente por tarefa", () => {
    const re = generate(baseProject(), { journalMode: "status_down", },);
    const days = re.getGroups().map((group,) => group.id);
    // 2026-02-10 cai (a entrada corrente de t1 é 2026-03-03).
    assertEquals(
      days,
      ["2026-02-15", "2026-02-20", "2026-03-03", "2026-03-05",],
    );
    const t1 = re.getGroups().find((group,) => group.id === "2026-03-03")!;
    assertEquals(t1.entries[0]!.headline, "Diário 2",);
  });

  it("status_up mantém as entradas correntes das tarefas de topo", () => {
    const re = generate(baseProject(), { journalMode: "status_up", },);
    const headlines = re.getGroups().flatMap((group,) =>
      group.entries.map((entry,) => entry.headline)
    );
    assert(headlines.includes("Diário 2",), headlines.join(",",),);
    assert(!headlines.includes("Diário 1",), headlines.join(",",),);
  });

  it("alerts_down mantém só o maior nível de alerta corrente", () => {
    const re = generate(baseProject(), { journalMode: "alerts_down", },);
    const headlines = re.getGroups().flatMap((group,) =>
      group.entries.map((entry,) => entry.headline)
    );
    // yellow (1) é o máximo entre as correntes (Diário 2 e conta são green).
    assertEquals(headlines.sort(), ["Chegada do aço", "Kick-off",],);
  });

  it("alerts_<id> filtra pelo nível de alerta (extensão)", () => {
    const re = generate(baseProject(), { journalMode: "alerts_red", },);
    const headlines = re.getGroups().flatMap((group,) =>
      group.entries.map((entry,) => entry.headline)
    );
    assertEquals(headlines, ["Diário 1",],);
  });
});

describe("RdoReport — journalattributes (14C.3.5)", () => {
  it("controla os campos exibidos na entrada", () => {
    const project = baseProject();
    const re = generate(project, {
      journalAttributes: ["headline", "date",],
    },);
    const html = htmlOf(re,);
    assert(html.includes("Diário 1",),);
    assert(html.includes("2026-02-10",),);
    assert(!html.includes("Fundação concluída",), "summary filtrado",);
    assert(!html.includes("tj_rdo_alert",), "alert filtrado",);
  });
});

describe("RdoReport — galeria (14C.3.6)", () => {
  it("une picture + imagens do details sem repetir caminho", () => {
    const re = generate(baseProject(),);
    const day = re.getGroups().find((group,) => group.id === "2026-02-10")!;
    assertEquals(
      day.pictures.map((picture,) => picture.path),
      ["img/a.png", "img/b.png",],
    );
    assertEquals(day.entries[1]!.pictures.map((picture,) => picture.path), [
      "img/a.png",
      "img/b.png",
    ],);
  });

  it("maxpictures corta só a saída; align/width/caption/alt são renderizados", () => {
    const re = generate(baseProject(), { maxpictures: 1, },);
    const day = re.getGroups().find((group,) => group.id === "2026-02-10")!;
    assertEquals(day.pictures.length, 2, "a entrada não pode ser mutada",);

    const html = htmlOf(re,);
    const dayBlock = (html.split('data-group="2026-02-10"',)[1] ?? "")
      .split("</article>",)[0]!;
    assertEquals(dayBlock.split("<img",).length - 1, 1,);
    assert(dayBlock.includes('width="640"',), dayBlock,);
    assert(dayBlock.includes('class="tj_picture_align_right"',), dayBlock,);
    assert(dayBlock.includes('alt="Vista lateral"',), dayBlock,);
    assert(dayBlock.includes("<figcaption>Vala vista de lado</figcaption>",),);
  });
});

describe("RdoReport — colunas e filtros (14C.3.8/14C.3.9)", () => {
  it("colunas default incluem galeria e tabelas; columns restringe", () => {
    const full = htmlOf(generate(baseProject(), { groupby: "task", },),);
    assert(full.includes("tj_gallery",),);
    assert(full.includes("tj_rdo_materials",),);
    assert(full.includes("tj_rdo_charges",),);

    const project = baseProject();
    const restricted = generate(project, {
      groupby: "task",
      columns: [{ id: "name", }, { id: "journal", },],
    },);
    const html = htmlOf(restricted,);
    assert(!html.includes("tj_gallery",), "pictures fora das columns",);
    assert(!html.includes("tj_rdo_table",), "tabelas fora das columns",);
  });

  it("hidetask remove o bloco da tarefa oculta", () => {
    const project = parseTjp(
      source(`  period 2026-02-01 - 2026-03-31
  groupby task
  formats html, json
  hidetask isleaf()`,),
    );
    assertEquals(generate(project,).getGroups().length, 0,);
  });
});

describe("RdoReport — tabelas do bloco (14C.3.8)", () => {
  it("tarefa traz o responsável declarado", () => {
    const re = generate(baseProject(), { groupby: "task", },);
    assertEquals(re.getGroups()[0]!.responsible, "Equipe de obra",);
  });

  it("tarefa traz materiais e charges alocados", () => {
    const re = generate(baseProject(), { groupby: "task", },);
    const task = re.getGroups()[0]!;
    assertEquals(task.materials.length, 1,);
    assertEquals(task.materials[0]!.id, "steel",);
    assertEquals(task.materials[0]!.detail, "10 kg",);
    assertEquals(task.materials[0]!.amount, 25,);
    assertEquals(task.charges.length, 1,);
    assertEquals(task.charges[0]!.amount, 200,);
  });
});

describe("RdoReport — saídas (14C.3.10/14C.3.11/14C.3.12)", () => {
  it("HTML segue o template de RDO (seção, bloco, entrada, galeria)", () => {
    const html = htmlOf(generate(baseProject(),),);
    assert(html.includes('<div class="tj_rdo_frame">',),);
    assert(html.includes('<section class="tj_rdo">',),);
    assert(
      html.includes('<article class="tj_rdo_block" data-group="2026-02-10">',),
    );
    assert(html.includes('<div class="tj_rdo_entry">',),);
    assert(html.includes('<div class="tj_gallery">',),);
  });

  it("JSON é aninhado por groupby com as imagens de cada entrada", () => {
    const re = generate(baseProject(),);
    const json = JSON.parse(re.toJSON(),) as {
      groupby: string;
      period: { start: string; end: string };
      groups: Array<{
        id: string;
        entries: Array<{ headline: string; pictures: Array<{ path: string }> }>;
      }>;
    };
    assertEquals(json.groupby, "date",);
    assertEquals(json.period.start, "2026-02-01",);
    assertEquals(json.period.end, "2026-03-31",);
    const day = json.groups.find((group,) => group.id === "2026-02-10")!;
    assertEquals(day.entries[0]!.headline, "Diário 1",);
    assertEquals(day.entries[1]!.pictures.map((picture,) => picture.path), [
      "img/a.png",
      "img/b.png",
    ],);
  });

  it("imagens relativas passam pelo ImageStore injetável", () => {
    const project = baseProject();
    const re = generate(project, {}, (instance,) => {
      instance.setImageResolver((path,) => `/opfs/${path}`);
    },);
    const html = htmlOf(re,);
    assert(html.includes('src="/opfs/img/a.png"',),);
    assertEquals(
      re.getGroups().find((group,) => group.id === "2026-02-10")!
        .pictures[0]!.path,
      "img/a.png",
      "o caminho original é preservado na estrutura",
    );
  });
});
