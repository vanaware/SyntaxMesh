/**
 * Fase 24 (24.7) — identidade do projeto no mapa de atributos.
 *
 * O `Project#initialize` do Ruby grava a identidade no `@data` do próprio
 * projeto (`Project.rb` l.88-118): `'name' => name`, `'projectid' => id`,
 * `'version' => version`. Vários pontos do port leem
 * `project.get('name')` — o `<title>` do HTML (Report.rb `generateHTML`),
 * o cabeçalho `Project: …` do niku/mspxml — e recebiam `undefined` porque o
 * construtor só preenchia os campos `id`/`name`/`version`.
 *
 * Achado pelo golden da Fase 24.7: o HTML do `tj3` traz
 * `<title>Parity - Plan</title>` e o port escrevia `undefined - Plan`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Project.rb l.88-118
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import { ProjectFileParser, } from "../../src/parser/project-file-parser.ts";
// Efeito colateral: registra as fábricas de conteúdo (`taskreport`).
import "../../src/reports/mod.ts";

/** Projeto de uma tarefa com relatório HTML. */
const TJP = `project prj "Parity" "2.5" 2026-01-05 - 2026-01-16 {
  timezone "UTC"
  timeformat "%Y-%m-%d"
  now 2026-01-05
}
task a "A" {
  effort 2d
}
taskreport plan "out" {
  formats html
  columns id, name
}
`;

/** Parse do fixture acima. */
function parse(): Project {
  const parser = new ProjectFileParser();
  parser.open(TJP, true, true,);
  return parser.parse("project",) as Project;
}

describe("24.7 — identidade do projeto nos atributos", () => {
  it("`get` devolve name, version e projectid", () => {
    const project = parse();

    assertEquals(project.get("name",), "Parity",);
    assertEquals(project.get("version",), "2.5",);
    assertEquals(project.get("projectid",), "prj",);
  });

  it("o `<title>` do HTML usa o nome do projeto", () => {
    const project = parse();

    project.generateReport("plan", false,);

    const html = String(project.report("plan",)!.output,);
    // Sem atributo `title`, o Ruby usa o nome do arquivo de destino
    // (`"#{project['name']} - #{@name}"`, Report.rb l.170).
    assertEquals(
      /<title>([^<]*)<\/title>/u.exec(html,)?.[1],
      "Parity - out",
    );
  });
});
