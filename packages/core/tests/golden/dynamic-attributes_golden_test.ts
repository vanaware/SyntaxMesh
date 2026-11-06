/**
 * Golden de `Project#generateReport` com `dynamicAttributes` — 18.19.7.
 *
 * Replays cada caso de `dynamic-attributes.golden.json` (gerado por
 * `scripts/golden/dynamic-attributes.rb` sobre o tj3 3.8.4 real) contra o port:
 * para cada snippet do `-A` parseia o fixture, agenda, gera o `taskreport` e
 * compara o estado **observável** com o do Ruby:
 *
 *  - `columns` — ids das colunas do relatório depois da geração (o backup do
 *    Ruby é raso, então as colunas do snippet permanecem — ver o cabeçalho de
 *    `tests/reports/dynamic-attributes_test.ts`);
 *  - `headers` — rótulos do cabeçalho da tabela HTML;
 *  - `tasks`   — ids das tarefas que apareceram na tabela (`a`/`b`);
 *  - `errors`  — nº de erros do MessageHandler.
 *
 * Divergência conhecida (só no caso de erro de sintaxe): o Ruby para no
 * primeiro `no_reduce` e **aborta o processo** (`SystemExit`) — a tabela do
 * golden fica vazia. O port acumula a cascata do FSM e segue (18.19.6 — não há
 * `exit` no core): a coluna inválida é descartada, a lista anterior (`id`)
 * permanece e a tabela é gerada normalmente. Para esse caso o teste compara
 * `columns` com o golden (que confirma a lista intacta) e exige a tabela com a
 * coluna `id`, em vez dos cabeçalhos vazios do Ruby.
 *
 * O `MessageHandler` é zerado **depois** do `schedule()`: o agendamento emite
 * avisos (`priority_inversion`, `*_check_unsupported`) que não fazem parte do
 * `dynamicAttributes`; o que se compara aqui é só o que a geração produziu.
 *
 * @see scripts/golden/dynamic-attributes.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md §18.19
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import { ProjectFileParser, } from "../../src/parser/project-file-parser.ts";
// Efeito colateral: registra as fábricas de conteúdo (`taskreport`).
import "../../src/reports/mod.ts";

/** Fixture idêntico ao de `scripts/golden/dynamic-attributes.rb`. */
const TJP = `project prj "Dynamic Attributes" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
  now 2026-02-01
  workinghours mon - fri 9:00 - 17:00
  scenario plan "Plan" {
  }
  trackingscenario plan
}
resource dev "Developer" {
}
task a "Alpha" {
  effort 5d
  allocate dev
}
task b "Beta" {
  effort 3d
  allocate dev
}
taskreport dyn "dyn.tjp" {
  formats html
  columns id
  period 2026-01-01 - 2026-12-31
}
`;

interface GoldenCase {
  description: string;
  dynamic: string | null;
  columns: string[];
  headers: string[];
  tasks: string[];
  errors: number;
  errorIds: string[];
  error: string | null;
}

/** Ids das colunas do relatório, na ordem em que serão renderizadas. */
function columnIds(report: Report,): string[] {
  const columns = (report.get("columns",) ?? []) as Array<{ id: string }>;
  return columns.map((column,) => column.id);
}

/** Rótulos do cabeçalho (células em negrito da tabela). */
function headersOf(html: string,): string[] {
  return [...html.matchAll(/font-weight:bold; ">([^<]*)<\/td>/gu,),]
    .map((match,) => match[1]!.trim());
}

/**
 * Ids das tarefas da tabela: as mesmas células de conteúdo que o script Ruby
 * varre, restritas ao universo do fixture (a coluna `name` traria `Alpha`/
 * `Beta`, que não interessam aqui).
 */
function tasksOf(html: string,): string[] {
  const cells = [...html.matchAll(/white-space:nowrap; ?">([^<]+)<\/td>/gu,),]
    .map((match,) => match[1]!.trim());
  return cells.filter((cell,) => cell === "a" || cell === "b");
}

/** Monta o projeto do fixture já agendado. */
function makeProject(): Project {
  const parser = new ProjectFileParser();
  parser.open(TJP, true, true,);
  const project = parser.parse("project",) as Project;
  project.schedule();
  return project;
}

const golden = JSON.parse(
  Deno.readTextFileSync(
    new URL("./dynamic-attributes.golden.json", import.meta.url,),
  ),
) as { cases: GoldenCase[] };

describe("dynamic-attributes golden (18.19)", () => {
  it("o golden cobre os seis casos do --attr", () => {
    assertEquals(golden.cases.length, 6,);
  });

  for (const c of golden.cases) {
    it(c.description, () => {
      const project = makeProject();
      const handler = MessageHandlerInstance.instance;
      // Zera depois do `schedule()` — ver o cabeçalho.
      handler.reset();

      project.generateReport(
        "dyn",
        false,
        undefined,
        c.dynamic ?? undefined,
      );

      const report = project.report("dyn",) as Report;
      const html = String(report.output,);

      // Colunas: o snippet substitui a lista do arquivo e o restore raso do
      // Ruby **não** devolve o valor anterior (fidelidade verificada no tj3).
      assertEquals(columnIds(report,), c.columns,);

      if (c.errors > 0) {
        // Ruby aborta no primeiro `no_reduce`; o port acumula a cascata e
        // conclui a geração com a lista de colunas anterior (ver cabeçalho).
        assert(handler.errors >= 1,);
        assert(
          handler.messages.some((message,) => message.type === "error"),
        );
        assertEquals(headersOf(html,), ["Id",],);
        assertEquals(tasksOf(html,), ["a", "b",],);
      } else {
        assertEquals(handler.errors, c.errors,);
        assertEquals(handler.messages, [],);
        // Cabeçalhos e tarefas visíveis: só existem quando a geração concluiu.
        assertEquals(headersOf(html,), c.headers,);
        assertEquals(tasksOf(html,), c.tasks,);
      }
    },);
  }
});
