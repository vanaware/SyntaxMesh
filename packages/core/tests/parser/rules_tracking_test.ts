/**
 * Testes do bloco 4 de TjpSyntaxRules — tracking (subfase 10.14).
 *
 * Cobre `navigator` (registro + `hidereport` + duplicidade), `opennodes`
 * (listas de `nodeId`, o `-` esvaziante e nós desconhecidos), `timeSheet`
 * (cria TimeSheet no projeto, aviso de autor para recurso-grupo) e
 * `statusSheet` (consome journal entries).
 *
 * Sem `trackingscenario` apontando para um cenário existente, cabeçalhos de
 * timesheet/statussheet emitem `ts_no_tracking_scenario` /
 * `ss_no_tracking_scenario` — toleramos esses avisos via `projectTolerating`.
 * O corpo do projeto NÃO é envolvido por chaves.
 *
 * @see docs/syntaxmesh/fases/fase-10-parser-linguagem-tarefas.md §10.14
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import { Navigator, } from "../../src/reports/navigator.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** Pega o Project resultante (lança se houve qualquer mensagem). */
function project(out: ReturnType<typeof parseProject>,): Project {
  assert(
    out.threw === null,
    "parse não deveria lançar: " + out.threw?.message,
  );
  assertEquals(out.messageIds, [],);
  return out.result as Project;
}

/** Pega o Project permitindo apenas os IDs de aviso informados. */
function projectTolerating(
  out: ReturnType<typeof parseProject>,
  ids: string[],
): Project {
  assert(
    out.threw === null,
    "parse não deveria lançar: " + out.threw?.message,
  );
  assertEquals(out.messageIds, ids,);
  return out.result as Project;
}

const BASE = PROJECT_HEADER + 'resource john "J" {}\ntask t1 "T1" {}\n';

/** Busca um navigator registrado no parser pelo id. */
function navigatorOf(
  out: ReturnType<typeof parseProject>,
  id: string,
): Navigator | undefined {
  return out.parser.navigators.get(id,) as Navigator | undefined;
}

/** Tamanho da lista `openNodes` de um relatório. */
function openNodesLen(p: Project, id: string,): number {
  const nodes = p.report(id,)!.get("openNodes",) as unknown[] | null;
  return nodes === null ? -1 : nodes.length;
}

// ---------------------------------------------------------------------------
// 10.14.5.4 — navigator
// ---------------------------------------------------------------------------
describe("rule_navigator (10.14.5.4)", () => {
  it("registra o navigator por id no parser", () => {
    const out = parseProject(
      BASE + "navigator nv {\n  hidereport isleaf()\n}\n",
    );
    project(out,);
    const nav = navigatorOf(out, "nv",);
    assert(nav instanceof Navigator, "navigator deveria ser registrado",);
    assertEquals(nav!.id, "nv",);
  });

  it("guarda a expressão lógica de hidereport", () => {
    const out = parseProject(
      BASE + "navigator nv {\n  hidereport isleaf()\n}\n",
    );
    project(out,);
    assertEquals(navigatorOf(out, "nv",)!.hideReport?.toString(), "isleaf()",);
  });

  it("navigator sem corpo deixa hideReport nulo", () => {
    const out = parseProject(BASE + "navigator nv {\n}\n",);
    project(out,);
    assertEquals(navigatorOf(out, "nv",)!.hideReport, null,);
  });

  it("navigator duplicado dispara navigator_exists", () => {
    const out = parseProject(BASE + "navigator nv {\n}\nnavigator nv {\n}\n",);
    projectTolerating(out, ["navigator_exists",],);
  });
});

// ---------------------------------------------------------------------------
// 10.14.5.5 — opennodes / nodeIdList
// ---------------------------------------------------------------------------
describe("rule_opennodes (10.14.5.5)", () => {
  it("um nó conhecido produz lista de tamanho 1", () => {
    const p = project(
      parseProject(
        BASE + 'taskreport tr "T" {\n  columns bsi\n  opennodes t1\n}\n',
      ),
    );
    assertEquals(openNodesLen(p, "tr",), 1,);
  });

  it("'-' esvazia a lista de nós", () => {
    const p = project(
      parseProject(
        BASE + 'taskreport tn "T" {\n  columns bsi\n  opennodes -\n}\n',
      ),
    );
    assertEquals(openNodesLen(p, "tn",), 0,);
  });

  it("nó desconhecido dispara unknown_main_node", () => {
    const out = parseProject(
      BASE + 'taskreport tu "T" {\n  columns bsi\n  opennodes zz.zy\n}\n',
    );
    projectTolerating(out, ["unknown_main_node",],);
  });
});

// ---------------------------------------------------------------------------
// 10.14.5.6 — timeSheet
// ---------------------------------------------------------------------------
describe("rule_timeSheet (10.14.5.6)", () => {
  it("cria um TimeSheet no projeto (recurso folha)", () => {
    const out = parseProject(
      BASE +
        "timesheet john 2026-02-01 - 2026-02-28 {\n  task t1 {\n" +
        "    work 50%\n  }\n}\n",
    );
    const p = projectTolerating(out, ["ts_no_tracking_scenario",],);
    assertEquals(p.timeSheets.sheets.length, 1,);
  });

  it("recurso-grupo (não-folha) dispara ts_group_author", () => {
    const src = PROJECT_HEADER +
      'resource grp "G" {\n  resource sub "S" {\n  }\n}\ntask t1 "T1" {}\n' +
      "timesheet grp 2026-02-01 - 2026-02-28 {\n  task t1 {\n" +
      "    work 50%\n  }\n}\n";
    const out = parseProject(src,);
    projectTolerating(out, ["ts_group_author", "ts_no_tracking_scenario",],);
  });
});

// ---------------------------------------------------------------------------
// 10.14.5.7 — statusSheet
// ---------------------------------------------------------------------------
describe("rule_statusSheet (10.14.5.7)", () => {
  it("aceita status com nível de alerta padrão", () => {
    const out = parseProject(
      BASE +
        "statussheet john 2026-02-01 - 2026-02-28 {\n  task t1 {\n" +
        '    status green "ok"\n  }\n}\n',
    );
    projectTolerating(out, ["ss_no_tracking_scenario",],);
  });
});
