/**
 * 14.23 — Golden tests de relatórios (ADR 026/027).
 *
 * `reports.golden.json` é gerado por `scripts/golden/reports-mwe001..009.rb` e
 * `scripts/golden/reports-syntax-correct.rb` contra o TaskJuggler Ruby real
 * (tj3): roda parse → schedule → `generateIntermediateFormat` sobre cada `.tjp`
 * e extrai o formato intermediário (`ReportTable`) de cada relatório via
 * `scripts/golden/reports-common.rb` — o MESMO walker que `extract-table.ts`
 * implementa do lado TypeScript.
 *
 * O que é comparado é o **digest estrutural** do formato intermediário
 * (nº de colunas, nº de linhas, sequência de "kinds" de célula por linha), não o
 * markup HTML — que difere por design (ADR 027, browser) — nem os VALORES de
 * célula, que dependem de integração ainda pendente:
 *   • colunas calculadas `query_*` (Fase 11, adiado p/ scheduling/finance — ver
 *     CURRENT.md: "métodos concretos query_* ainda não existem no modelo");
 *   • coluna `chart` = GanttChart (Fase 15/16, não portada);
 *   • rótulo `name` e fuso das datas na célula (integração modelo↔relatório).
 *
 * Divergências NÃO são xfails silenciosos:
 *   • relatórios que o TS não consegue montar (Gantt/query/to_rti) são
 *     classificados `pending` pela CLASSE do erro — um erro inesperado falha;
 *   • relatórios que o TS monta com geometria divergente estão numa allowlist
 *     EXPLÍCITA e rastreada (`PENDING_DIVERGENCES`); quando a integração
 *     query e alocação chegarem, a entrada sai da lista e o digest volta a ser
 *     exigido.
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { NotYetImplementedError, } from "../../src/model/errors.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TableReport, } from "../../src/reports/table-report.ts";
// Efeito colateral: registra as fábricas de conteúdo (TaskListRE, ...) usadas
// por `Report.generateIntermediateFormat` — sem isso o dispatch lança NYI.
import "../../src/reports/mod.ts";
import {
  digestTable,
  extractTable,
  type TableDigest,
} from "./extract-table.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";

interface ReportRef {
  id: string;
  name: string;
  type: string;
  formats: string[];
  table?: { header: unknown[]; rows: unknown[][] };
  error?: string;
}
interface GoldenCase {
  file: string;
  tz: string;
  error: string | null;
  reports: ReportRef[];
}

/** Raiz do repo a partir de packages/core/tests/golden/. */
const REPO_ROOT = new URL("../../../../", import.meta.url,);

/**
 * Relatórios que o TS CONSTRUÍ mas cuja geometria (nº de linhas) diverge do
 * tj3 porque a listagem de sub-linhas depende de alocação/`query_*` ainda não
 * integrada (hideresource / tarefas-por-recurso / filtragem lógica). Cada
 * entrada é removida quando a integração correspondente chegar; aí o digest
 * volta a ser exigido. NÃO é um xfail genérico: cobre exatamente estes IDs.
 */
const PENDING_DIVERGENCES = new Set<string>([
  "docs/taskjuggler/test/TestSuite/ReportGenerator/Correct/LogicalFunctions2.tjp:report1",
  "docs/taskjuggler/test/TestSuite/CSV-Reports/resourcereport_with_tasks.tjp:csv",
  "docs/taskjuggler/test/TestSuite/CSV-Reports/taskreport_with_resources.tjp:csv",
],);

function loadGolden(): GoldenCase[] {
  const url = new URL("./reports.golden.json", import.meta.url,);
  const content = Deno.readTextFileSync(url,);
  return (JSON.parse(content,) as { cases: GoldenCase[] }).cases;
}

/** Resultado TS de um relatório: metadados + digest (ou motivo de bloqueio). */
interface TsReportOutcome {
  type: string;
  formats: string[];
  digest: TableDigest | null;
  /** Erro-sancionado pendente (Gantt/query/to_rti); undefined se não bloqueou. */
  pending?: string;
  /** Erro inesperado (falha no teste). */
  error?: string;
}

/**
 * Re-executa o pipeline TS sobre o mesmo `.tjp` e devolve, por id de
 * relatório, o resultado estrutural equivalente ao golden Ruby. Um erro em
 * parse/schedule (fora dos relatórios) é capturado como `fatal` — ele é
 * reportado por relatório, nunca deixa o módulo estourar.
 */
function runTsCase(
  goldenCase: GoldenCase,
): { outcomes: Map<string, TsReportOutcome>; fatal?: string } {
  const outcomes = new Map<string, TsReportOutcome>();
  TjTime.setTimeZone(goldenCase.tz,);
  const mh = MessageHandlerInstance.instance;
  mh.messages.length = 0;
  mh.errors = 0;

  let project: Project;
  try {
    const parser = new ProjectFileParser();
    parser.open(new URL(goldenCase.file, REPO_ROOT,).pathname, true, false,);
    const result = parser.parse("project",) as Project | false;
    if (!result) return { outcomes, fatal: "parse-failed", };
    project = result;
    project.schedule();
  } catch (e) {
    const err = e as Error;
    return {
      outcomes,
      fatal: `${err.constructor.name}: ${
        err.message.split("\n",)[0] ?? err.message
      }`,
    };
  }

  for (const report of project.reports.toArray() as Report[]) {
    const formats = report.get("formats",) as string[] | null;
    if (!formats || formats.length === 0) continue;
    const outcome: TsReportOutcome = {
      type: String(report.typeSpec,),
      formats: [...formats,].sort(),
      digest: null,
    };
    try {
      project.reportContexts.push(new ReportContext(project, report,),);
      try {
        report.generateIntermediateFormat();
        const content = report.content;
        if (content instanceof TableReport && content.getTable()) {
          outcome.digest = digestTable(extractTable(content.getTable(),),);
        }
      } finally {
        project.reportContexts.pop();
      }
    } catch (e) {
      const err = e as Error;
      const msg = err.message.split("\n",)[0] ?? err.message;
      if (
        err instanceof NotYetImplementedError ||
        /Unknown attribute or query/.test(msg,)
      ) {
        // Pendência sancionada por fase (Gantt 15/16, query_* 11, to_rti 12/14).
        outcome.pending = msg;
      } else {
        outcome.error = `${err.constructor.name}: ${msg}`;
      }
    }
    outcomes.set(report.fullId, outcome,);
  }
  return { outcomes, };
}

/** Cache por arquivo: parse+schedule é caro e deve rodar uma única vez. */
const fileCache = new Map<string, ReturnType<typeof runTsCase>>();
function evaluateFile(gc: GoldenCase,): ReturnType<typeof runTsCase> {
  let cached = fileCache.get(gc.file,);
  if (!cached) {
    cached = runTsCase(gc,);
    fileCache.set(gc.file, cached,);
  }
  return cached;
}

/**
 * Arquivos do TestSuite cujo agendamento TS ainda estoura (gap de scheduler de
 * fases anteriores, não de relatório). O golden de relatório é adiado junto.
 *
 * 14C.12.3 (2026-11-01): vazio. `CSV-Reports/alert.tjp` era o único membro —
 * `propagateDateToDep` estourava em `null.toSeconds()` quando a tarefa não
 * tinha a data do lado comparado; o guard de nulidade reabriu a comparação
 * deste arquivo (antes adiada) e ele passou a ser verificado normalmente.
 */
const PENDING_SCHEDULER_FILES = new Set<string>([],);

const golden = loadGolden();
const totalReports = golden.reduce((n, c,) => n + c.reports.length, 0,);

describe("14.23 golden: relatórios (formato intermediário vs tj3 real)", () => {
  for (const goldenCase of golden) {
    describe(goldenCase.file, () => {
      if (goldenCase.error) {
        // O tj3 não montou o arquivo (ex.: TimeSheet usa diretivas Fase 18).
        it(`[${goldenCase.file}] pulado: tj3 '${goldenCase.error}'`, () => {
          // Nada a comparar — o próprio oracle falhou neste arquivo.
        });
        return;
      }

      for (const ref of goldenCase.reports) {
        const key = `${goldenCase.file}:${ref.id}`;
        it(`${ref.id} (${ref.type}, ${ref.formats.join("/",)})`, () => {
          // 0) Se o próprio agendamento TS deste arquivo ainda estoura (gap de
          //    scheduler de outra fase), adiamos com rastreamento explícito.
          const { outcomes, fatal, } = evaluateFile(goldenCase,);
          if (fatal !== undefined) {
            assert(
              PENDING_SCHEDULER_FILES.has(goldenCase.file,),
              `schedule TS estourou em ${goldenCase.file}: ${fatal}`,
            );
            return;
          }

          const tsOut = outcomes.get(ref.id,);
          assert(tsOut, `relatório '${ref.id}' ausente no motor TS`,);

          // 1) Dispatch/registro (sempre): typeSpec + formats idênticos.
          assertEquals(tsOut.type, ref.type, "typeSpec divergiu",);
          assertEquals(tsOut.formats, ref.formats, "formats divergiu",);

          // 2) Sem tabela no oracle (iCal/textreport/…): só metadata. TS também
          //    não deve produzir tabela de relatório.
          if (!ref.table) {
            assertEquals(
              tsOut.digest,
              null,
              "TS produziu tabela onde o tj3 não tem",
            );
            return;
          }

          const rubyDigest = digestTable(ref.table,);

          // 3) TS bloqueado por pendência sancionada → tracked, não falha.
          if (tsOut.pending !== undefined) {
            assert(
              /GanttChart|to_rti|Unknown attribute or query|Fase 1/.test(
                tsOut.pending,
              ),
              `erro TS não-sanctionado em ${key}: ${tsOut.pending}`,
            );
            return;
          }
          if (tsOut.error) {
            throw new Error(`erro TS inesperado em ${key}: ${tsOut.error}`,);
          }

          // 4) TS construiu tabela. Divergência rastreada → exige só existência.
          if (PENDING_DIVERGENCES.has(key,)) {
            assert(
              tsOut.digest,
              `divergência rastreada ${key} deveria produzir tabela TS`,
            );
            return;
          }

          // 5) Caso "pronto": digest estrutural idêntico ao tj3 (regressão).
          assertEquals(
            tsOut.digest,
            rubyDigest,
            `digest estrutural divergiu em ${key}`,
          );
        });
      }
    },);
  }

  it(`cobre ≥ 60 casos de relatório (total: ${totalReports})`, () => {
    assert(
      totalReports >= 60,
      `esperado ≥60 casos, obtido ${totalReports}`,
    );
  });
});
