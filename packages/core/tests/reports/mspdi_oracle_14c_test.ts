/**
 * Oracle MSPDI (14C.4.1 / 14C.4.14).
 *
 * Compara a árvore `<Project>` gerada pelo `MspXmlRE` com a árvore produzida
 * pelo tj3 real (`scripts/golden/mspdi-tj3.rb`) sobre o fixture
 * `packages/core/tests/fixtures/ext/14c-mspdi.tjp`, gravada em
 * `mspdi.golden.json` e normalizada pelo mesmo walker REXML
 * (`mspdi-normalize.ts`).
 *
 * O fixture usa apenas o subconjunto que o `MspXmlRE.rb` exporta (sem
 * materiais, charges, `vacation` e sem dependências — ver comentários no
 * `.tjp`), de modo que as extensões SyntaxMesh (14C.4.2–4.11) não entram nesta
 * comparação: elas são cobertas pelos testes estruturais.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.4)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { parseProject, } from "../parser/parse-helper.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { MspXmlRE, } from "../../src/reports/msp-xml-re.ts";
import { type MspdiNode, normalizeMspdi, } from "../golden/mspdi-normalize.ts";

interface MspdiCase {
  file: string;
  report: string;
  tz: string;
  error: string | null;
  project?: MspdiNode;
}

/** Raiz do repositório (o oracle grava o caminho do fixture relativo a ela). */
const REPO_ROOT = new URL("../../../../", import.meta.url,);

/** Carrega o caso do oracle e gera a árvore MSPDI do lado TypeScript. */
function buildBoth(): { oracle: MspdiNode; ts: MspdiNode } {
  const golden = JSON.parse(
    Deno.readTextFileSync(
      new URL("../golden/mspdi.golden.json", import.meta.url,),
    ),
  ) as { cases: MspdiCase[] };
  const testCase = golden.cases[0]!;
  assertEquals(testCase.error, null,);
  const oracle = testCase.project!;
  assertEquals(oracle.tag, "Project",);

  const source = Deno.readTextFileSync(
    new URL(testCase.file, REPO_ROOT,),
  );
  const parsed = parseProject(source,);
  assertEquals(parsed.threw?.message ?? null, null,);
  const project = parsed.result as Project;
  // O oracle silencia o MessageHandler; aqui só limpamos as mensagens do parse.
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  assertEquals(project.schedule(), true,);

  const report = (project.reports.toArray() as Report[]).find((r,) =>
    r.name === testCase.report
  );
  if (!report) throw new Error(`report ${testCase.report} not found`,);
  project.reportContexts.push(new ReportContext(project, report,),);
  const xml = new MspXmlRE(report,).to_mspxml();
  return { oracle, ts: normalizeMspdi(xml,), };
}

describe("MSPDI oracle (14C.4.1/14C.4.14)", () => {
  it("o caso do oracle é gerado sem erro", () => {
    const golden = JSON.parse(
      Deno.readTextFileSync(
        new URL("../golden/mspdi.golden.json", import.meta.url,),
      ),
    ) as { cases: MspdiCase[] };
    assertEquals(golden.cases.length, 1,);
    assertEquals(golden.cases[0]!.error, null,);
  });

  it("reproduz a árvore MSPDI do tj3 (paridade campo a campo)", () => {
    const { oracle, ts, } = buildBoth();
    assertEquals(ts, oracle,);
  });

  it("mantém os blocos estruturais do MSPDI", () => {
    const { ts, } = buildBoth();
    const tags = ts.children.map((c,) => c.tag);
    for (const tag of ["Calendars", "Tasks", "Resources", "Assignments",]) {
      assertEquals(tags.includes(tag,), true, `bloco ${tag}` as never,);
    }
  });
});
