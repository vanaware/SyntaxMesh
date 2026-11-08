/**
 * `summary.ts` — resumo do projeto no terminal (24.4.5).
 *
 * Lido do `project` carregado pela última chamada de `execute`
 * (`lastExecutedProject`), uma **conveniência in-process** (plano §5.5,
 * ponto 9): o envelope continua sendo o contrato dos resultados de comando.
 * Num consumidor remoto (worker/HTTP) este resumo simplesmente não existe.
 *
 * O `tj3` imprime um banner de `AppConfig` antes de rodar e nenhum resumo
 * final; aqui o banner não é portado (os mesmos dados já saem em `--version`) e
 * o resumo entra como **adaptação** pedida por 24.4.5. Tudo em inglês
 * (plano §1.7).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.4.5)
 */
import {
  lastExecutedProject,
  type Project,
  TjTime,
} from "@vanaware/syntaxmesh";

/** Dados do resumo — puro, sem referências ao modelo. */
export interface ProjectSummary {
  id: string;
  name: string;
  version: string;
  timezone: string;
  /** `YYYY-MM-DD`; `null` quando o projeto não declara o atributo. */
  start: string | null;
  end: string | null;
  tasks: number;
  resources: number;
  accounts: number;
  /** Soma dos `costEvents` do cenário 0. */
  cost: number;
  currency: string;
}

/** Data `YYYY-MM-DD` de um atributo temporal do projeto. */
function dateOf(value: unknown,): string | null {
  return value instanceof TjTime ? value.to_s("%Y-%m-%d",) : null;
}

/** Soma os custos do cenário do plano (índice 0). */
function plannedCost(project: Project,): number {
  let total = 0;
  for (const event of project.costEvents) {
    if (event.scenarioIdx === 0) total += event.amount;
  }
  return total;
}

/** Extrai o resumo do projeto carregado. */
export function projectSummary(project: Project,): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    version: project.version,
    timezone: String(project.get("timezone",) ?? "",),
    start: dateOf(project.get("start",),),
    end: dateOf(project.get("end",),),
    tasks: project.tasks.items,
    resources: project.resources.items,
    accounts: project.accounts.items,
    cost: plannedCost(project,),
    currency: String(project.get("currency",) ?? "",),
  };
}

/** Valor monetário com 2 casas e a moeda do projeto. */
function money(cost: number, currency: string,): string {
  const amount = cost.toFixed(2,);
  return currency === "" ? amount : `${amount} ${currency}`;
}

/**
 * Linhas do resumo, prontas para o terminal (nunca vazias para projeto válido).
 *
 * Sem `start`/`end` a linha de período é omitida — o resumo não inventa dados.
 */
export function formatSummary(summary: ProjectSummary,): string[] {
  const lines = [
    `Project ${summary.id} "${summary.name}" v${summary.version}`,
  ];
  if (summary.timezone !== "") lines.push(`  timezone: ${summary.timezone}`,);
  if (summary.start !== null && summary.end !== null) {
    lines.push(`  period: ${summary.start} - ${summary.end}`,);
  }
  lines.push(
    `  tasks: ${summary.tasks}, resources: ${summary.resources}, ` +
      `accounts: ${summary.accounts}`,
    `  cost: ${money(summary.cost, summary.currency,)}`,
  );
  return lines;
}

/**
 * Resumo da última execução no processo.
 *
 * `[]` quando ninguém carregou projeto (ex.: `--version`, parse quebrado).
 */
export function lastSummaryLines(): string[] {
  const project = lastExecutedProject();
  return project === null ? [] : formatSummary(projectSummary(project,),);
}
