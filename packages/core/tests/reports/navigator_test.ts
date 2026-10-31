/**
 * Testes de Navigator + NavigatorElement (Fase 14.21).
 *
 * Cobre a construção da árvore (`NavigatorElement`), o HTML da barra (top-level
 * e sub-menu do ramo `current`), o dump de debug `to_s`, o `filterReports` com
 * `hideReport`, `normalizeURL` (corte do prefixo comum até o último `/`) e
 * `findReportURL` (URL `.html` relativo vs modo interativo vs recursão em
 * container sem HTML).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.21)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { Navigator, NavigatorElement, } from "../../src/reports/navigator.ts";
import { PropertyList, } from "../../src/model/property-list.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { RTFNavigator, } from "../../src/richtext/handlers/rtf-navigator.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";

describe("NavigatorElement (14.21.1)", () => {
  it("constructor: parent/label/url, elements=[] e current=false", () => {
    const e = new NavigatorElement(null, "Home", "./home.html",);
    assertEquals(e.parent, null,);
    assertEquals(e.label, "Home",);
    assertEquals(e.url, "./home.html",);
    assertEquals(e.elements, [],);
    assertEquals(e.current, false,);
  });

  it("constructor aceita apenas parent (label/url default null)", () => {
    const e = new NavigatorElement(null,);
    assertEquals(e.label, null,);
    assertEquals(e.url, null,);
  });

  it("to_html sem container cria div.navbar_container com HR top+bottom", () => {
    const root = new NavigatorElement(null, "Root", "#",);
    const html = root.to_html().toHTML();
    assert(html.includes('class="navbar_container"',), "container",);
    assert(html.includes('class="navbar_topruler"',), "HR topo",);
    assert(html.includes('class="navbar_bottomruler"',), "HR base",);
    assert(html.includes('class="navbar"',), "div.navbar presente",);
  });

  it("to_html marca current como span.navbar_current e outros como link", () => {
    const root = new NavigatorElement(null,);
    const cur = new NavigatorElement(root, "A", "a.html",);
    cur.current = true;
    const other = new NavigatorElement(root, "B", "b.html",);
    root.elements.push(cur, other,);
    const html = root.to_html().toHTML();
    assert(html.includes('class="navbar_current"',), "span current",);
    assert(html.includes(">A<",), "label A no current",);
    assert(html.includes('class="navbar_other"',), "span other",);
    assert(html.includes('href="b.html"',), "link b.html",);
    assert(html.includes(">B<",), "label B no link",);
    // separador `|` entre os dois spans.
    assert(html.includes("|",), "separador | presente",);
  });

  it("to_html recursa sub-menu do ramo current sob <hr class=navbar_midruler>", () => {
    const root = new NavigatorElement(null,);
    const first = new NavigatorElement(root, "F", "f.html",);
    const cur = new NavigatorElement(root, "C", "c.html",);
    cur.current = true;
    const sub = new NavigatorElement(cur, "S", "s.html",);
    sub.current = true;
    cur.elements.push(sub,);
    root.elements.push(first, cur,);
    const html = root.to_html().toHTML();
    assert(html.includes('class="navbar_midruler"',), "HR meio presente",);
    assert(html.includes(">S<",), "sub-menu S renderizado",);
  });

  it("to_s indentado marca current com <> ao redor do label", () => {
    const root = new NavigatorElement(null,);
    const cur = new NavigatorElement(root, "A", "a.html",);
    cur.current = true;
    const other = new NavigatorElement(root, "B", "b.html",);
    root.elements.push(cur, other,);
    const dump = root.to_s();
    assert(dump.includes("<A> -> a.html",), "current entre <>",);
    assert(dump.includes("B -> b.html",), "não-current sem <>",);
  });
});

describe("Navigator (14.21.2)", () => {
  let project: Project;
  let report: Report;

  beforeEach(() => {
    project = createTestProject(1,);
    report = new Report(project, "root", "root", null,);
    report.set("start", TjTime.fromString("2026-01-01",),);
    report.set("end", TjTime.fromString("2026-12-31",),);
    report.set("scenarios", [0,],);
    report.set("formats", ["html",],);
    report.set("title", null,);
    project.reportContexts.push(new ReportContext(project, report,),);
  },);

  it("constructor: id/project definidos; hideReport default false", () => {
    const nav = new Navigator("nav1", project,);
    assertEquals(nav.id, "nav1",);
    assertEquals(nav.project, project,);
    // Padrão: `LogicalOperation.new(0)` → eval false.
    const ctxQuery = project.reportContexts.at(-1,)?.query;
    assert(ctxQuery, "contexto query presente",);
    assertEquals(nav.hideReport.eval(ctxQuery!,), false,);
  });

  it("normalizeURL corta prefixo comum até o último / (14.21.2.6)", () => {
    const nav = new Navigator("n", project,);
    const priv = nav as unknown as {
      normalizeURL(a: string, b: string,): string;
    };
    // Caminho com diretórios idênticos: retorna a partir do último /.
    assertEquals(
      priv.normalizeURL("dir/sub/a.html", "dir/sub/b.html",),
      "a.html",
    );
    // Divergência antes do primeiro / → mantém url1 inteiro.
    assertEquals(priv.normalizeURL("x/a.html", "y/b.html",), "x/a.html",);
    // URL idêntica: sem corte (loop completo → retorna url1).
    assertEquals(
      priv.normalizeURL("same/a.html", "same/a.html",),
      "same/a.html",
    );
  });

  it("findReportURL retorna '<name>.html' relativo a reportDef em modo não-interativo (14.21.2.7)", () => {
    const nav = new Navigator("n", project,);
    const child = new Report(project, "child", "dir/sub/child", null,);
    child.set("formats", ["html",],);
    child.set("title", null,);
    const all = new PropertyList<Report>(project.reports,);
    all.clear();
    all.append([report, child,],);
    const priv = nav as unknown as {
      findReportURL(
        r: Report,
        all: PropertyList<Report>,
        def: Report,
      ): string | null;
    };
    // reportDef.name = "root" (sem `/`) → common prefix = 0; sem corte.
    const url = priv.findReportURL(child, all, report,);
    assertEquals(url, "dir/sub/child.html",);
  });

  it("findReportURL devolve URL interativa com projectid+fullId (14.21.2.7)", () => {
    project.set("projectid", "myproj",);
    // Ruby: `interactive?()` lê sempre `contexts[0]`. Troca o contexto base
    // pelo relatório interativo para reproduzir a semântica de saída.
    project.reportContexts.length = 0;
    const interactiveCtx = new Report(project, "ic", "ic", null,);
    interactiveCtx.set("interactive", true,);
    interactiveCtx.set("formats", ["html",],);
    project.reportContexts.push(new ReportContext(project, interactiveCtx,),);
    const nav = new Navigator("n", project,);
    const child = new Report(project, "c1", "c1", null,);
    child.set("formats", ["html",],);
    const all = new PropertyList<Report>(project.reports,);
    all.clear();
    all.append([interactiveCtx, child,],);
    const priv = nav as unknown as {
      findReportURL(
        r: Report,
        all: PropertyList<Report>,
        def: Report,
      ): string | null;
    };
    const url = priv.findReportURL(child, all, interactiveCtx,);
    assertEquals(url, "/taskjuggler?project=myproj;report=c1",);
    project.reportContexts.pop();
  });

  it("findReportURL retorna null quando report não está em allReports", () => {
    const nav = new Navigator("n", project,);
    const orphan = new Report(project, "orphan", "orphan", null,);
    const all = new PropertyList<Report>(project.reports,);
    all.clear();
    all.append([report,],);
    const priv = nav as unknown as {
      findReportURL(
        r: Report,
        all: PropertyList<Report>,
        def: Report,
      ): string | null;
    };
    assertEquals(priv.findReportURL(orphan, all, report,), null,);
  });

  it("filterReports exclui relatórios escondidos por hideReport (14.21.2.5)", () => {
    const parent = new Report(project, "p", "p", null,);
    parent.set("formats", ["html",],);
    const child = new Report(project, "c", "c", parent,);
    child.set("formats", ["html",],);
    // Expressão true → filtra tudo.
    const nav = new Navigator("n", project,);
    nav.hideReport = new LogicalExpression(new LogicalOperation(1,),);
    const priv = nav as unknown as {
      filterReports(): PropertyList<Report>;
    };
    const filtered = priv.filterReports();
    assertEquals(
      filtered.length(),
      0,
      "todos filtrados quando hideReport=true",
    );
  });

  it("generate monta NavigatorElement e recursa para os kids do reportDef (14.21.2.3)", () => {
    const parent = new Report(project, "p2", "p2", null,);
    parent.set("formats", ["html",],);
    parent.set("title", "Parent Title",);
    const child = new Report(project, "c2", "c2", parent,);
    child.set("formats", ["html",],);
    const nav = new Navigator("n", project,);
    const all = new PropertyList<Report>(project.reports,);
    all.clear();
    all.append([parent, child,],);
    const root = new NavigatorElement(null,);
    // Ruby: `currentReports` são os `kids` do ancestral de topo. Aqui, só
    // `parent` é item de topo; o generator recursa em `parent.kids()`.
    nav.generate(all, [parent,], parent, root,);
    // parent vira entrada de topo; child entra como sub-menu do current=parent.
    assertEquals(root.elements.length, 1, "apenas parent como item de topo",);
    const parentEl = root.elements[0]!;
    assertEquals(parentEl.label, "Parent Title",);
    assertEquals(parentEl.current, true, "parent é o reportDef → current",);
    assertEquals(parentEl.elements.length, 1, "child recursado no sub-menu",);
    assertEquals(parentEl.elements[0]!.label, "c2",);
  });

  it("to_html devolve null quando reportDef não está na lista filtrada (14.21.2.4)", () => {
    const nav = new Navigator("n", project,);
    // hideReport = true esconde tudo → filterReports vazio → null.
    nav.hideReport = new LogicalExpression(new LogicalOperation(1,),);
    assertEquals(nav.to_html(report,), null,);
  });
});

describe("RTFNavigator (14.21.3)", () => {
  it("registra erro quando args sem 'id' (14.21.3.1)", () => {
    const proj = createTestProject(1,);
    const h = new RTFNavigator(proj, null,);
    // Mensagem acumulada no handler global (não lança fora de trapSetup).
    const mh = MessageHandlerInstance.instance;
    mh.reset();
    const out = h.to_html({},);
    assertEquals(out, null, "retorna null na falta de id",);
    assertEquals(mh.errors, 1, "1 erro registrado",);
    assert(
      mh.messages.some((m,) => m.id === "rtf_nav_id_missing"),
      "id da mensagem presente",
    );
  });

  it("registra erro quando 'id' aponta para navigator inexistente (14.21.3.2)", () => {
    const proj = createTestProject(1,);
    const h = new RTFNavigator(proj, null,);
    const mh = MessageHandlerInstance.instance;
    mh.reset();
    const out = h.to_html({ id: "ghost", },);
    assertEquals(out, null, "retorna null para id desconhecido",);
    assertEquals(mh.errors, 1,);
    assert(
      mh.messages.some((m,) => m.id === "rtf_nav_unknown_id"),
      "mensagem de navigator desconhecido",
    );
  });

  it("delegar para navigator.to_html quando id resolvido (14.21.3.3)", () => {
    const proj = createTestProject(1,);
    const rep = new Report(proj, "r", "r", null,);
    rep.set("start", TjTime.fromString("2026-01-01",),);
    rep.set("end", TjTime.fromString("2026-12-31",),);
    rep.set("formats", ["html",],);
    proj.reportContexts.push(new ReportContext(proj, rep,),);
    const nav = new Navigator("main", proj,);
    proj.navigators.set("main", nav,);

    const h = new RTFNavigator(proj, null,);
    // navigator.to_html() sem relatórios além do próprio → retorna um
    // XMLElement (root da árvore). Não lançamos.
    const out = h.to_html({ id: "main", },);
    assert(out !== null, "renderizado (não null) quando context ok",);
  });
});
