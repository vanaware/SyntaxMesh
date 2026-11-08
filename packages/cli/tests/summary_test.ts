/**
 * Testes do resumo do projeto (24.4.5).
 *
 * O resumo é lido do projeto carregado por `execute` (`lastExecutedProject`,
 * conveniência in-process). Cada teste roda um `execute` próprio em memória —
 * o `execute` serializa chamadas e repõe o handler, então a leitura é
 * determinística.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.4.5)
 */
import { afterAll, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { execute, lastExecutedProject, } from "@vanaware/syntaxmesh";
import {
  formatSummary,
  lastSummaryLines,
  projectSummary,
} from "../src/summary.ts";

/** Projeto de prova: 1 tarefa, 1 recurso, 1 conta, moeda declarada. */
const PROJECT = `project prj "Probe" "2.0" 2026-01-01 - 2026-12-31 {
  timezone "Europe/Berlin"
  currency "EUR"
}
account acc "Acc"
resource dev "Dev"
task t1 "T1" {
  effort 2d
  allocate dev
}
`;

/** Projeto carregado pelo último `execute` bem-sucedido. */
function loadedProject() {
  const project = lastExecutedProject();
  if (project === null) throw new Error("no project loaded",);
  return project;
}

/** Roda `execute` sobre o texto e devolve as linhas do resumo. */
async function summaryOf(content: string,): Promise<string[]> {
  await execute({
    entry: "proj.smx",
    files: [{ path: "proj.smx", content, },],
  },);
  return lastSummaryLines();
}

afterAll(() => {
  // Nenhum estado global a limpar; o `execute` já repõe o handler.
},);

describe("projectSummary (24.4.5)", () => {
  it("extrai id, nome, versão, timezone e intervalo", async () => {
    await execute({
      entry: "proj.smx",
      files: [{ path: "proj.smx", content: PROJECT, },],
    },);
    const project = loadedProject();
    const summary = projectSummary(project,);
    assertEquals(summary.id, "prj",);
    assertEquals(summary.name, "Probe",);
    assertEquals(summary.version, "2.0",);
    assertEquals(summary.timezone, "Europe/Berlin",);
    assertEquals(summary.start, "2026-01-01",);
    assertEquals(summary.end, "2026-12-31",);
    assertEquals(summary.currency, "EUR",);
  });

  it("conta tarefas, recursos e contas", async () => {
    const lines = await summaryOf(PROJECT,);
    assertEquals(
      lines.includes("  tasks: 1, resources: 1, accounts: 1",),
      true,
    );
  });

  it("soma os custos do cenário do plano", async () => {
    await execute({
      entry: "proj.smx",
      files: [{ path: "proj.smx", content: PROJECT, },],
    },);
    const project = loadedProject();
    assertEquals(projectSummary(project,).cost, 0,);
  });
});

describe("formatSummary (24.4.5)", () => {
  it("monta as linhas do resumo com custo e moeda", async () => {
    const lines = await summaryOf(PROJECT,);
    assertEquals(lines, [
      'Project prj "Probe" v2.0',
      "  timezone: Europe/Berlin",
      "  period: 2026-01-01 - 2026-12-31",
      "  tasks: 1, resources: 1, accounts: 1",
      "  cost: 0.00 EUR",
    ],);
  });

  it("omite timezone e período quando ausentes", () => {
    const lines = formatSummary({
      id: "x",
      name: "X",
      version: "1.0",
      timezone: "",
      start: null,
      end: null,
      tasks: 0,
      resources: 0,
      accounts: 0,
      cost: 12.5,
      currency: "",
    },);
    assertEquals(lines, [
      'Project x "X" v1.0',
      "  tasks: 0, resources: 0, accounts: 0",
      "  cost: 12.50",
    ],);
  });
});

describe("lastSummaryLines (24.4.5)", () => {
  it("é vazio quando nenhum projeto foi carregado", async () => {
    await execute({ version: true, },);
    assertEquals(lastSummaryLines(), [],);
  });
});
