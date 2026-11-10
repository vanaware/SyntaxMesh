/**
 * `summary.ts` — project summary in the terminal (24.4.5).
 *
 * Read from the `project` loaded by the last `execute` call
 * (`lastExecutedProject`), an **in-process convenience** (plan §5.5, point 9):
 * the envelope remains the contract for command results. In a remote consumer
 * (worker/HTTP) this summary simply does not exist.
 *
 * `tj3` prints an `AppConfig` banner before running and no final summary; here
 * the banner is not ported (the same data already comes out in `--version`) and
 * the summary is an **adaptation** requested by 24.4.5. Everything in English
 * (plan §1.7).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.4.5)
 */
import {
  lastExecutedProject,
  type Project,
  TjTime,
} from "@vanaware/syntaxmesh";

/** Summary data — pure, with no references to the model. */
export interface ProjectSummary {
  id: string;
  name: string;
  version: string;
  timezone: string;
  /** `YYYY-MM-DD`; `null` when the project does not declare the attribute. */
  start: string | null;
  end: string | null;
  tasks: number;
  resources: number;
  accounts: number;
  /** Sum of the `costEvents` of scenario 0. */
  cost: number;
  currency: string;
}

/** `YYYY-MM-DD` date from a temporal attribute of the project. */
function dateOf(value: unknown,): string | null {
  return value instanceof TjTime ? value.to_s("%Y-%m-%d",) : null;
}

/** Sums the costs of the plan scenario (index 0). */
function plannedCost(project: Project,): number {
  let total = 0;
  for (const event of project.costEvents) {
    if (event.scenarioIdx === 0) total += event.amount;
  }
  return total;
}

/** Extracts the summary of the loaded project. */
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

/** Monetary value with 2 decimals and the project currency. */
function money(cost: number, currency: string,): string {
  const amount = cost.toFixed(2,);
  return currency === "" ? amount : `${amount} ${currency}`;
}

/**
 * Summary lines, ready for the terminal (never empty for a valid project).
 *
 * Without `start`/`end` the period line is omitted — the summary invents no data.
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
 * Summary of the last execution in this process.
 *
 * `[]` when nobody loaded a project (e.g. `--version`, broken parse).
 */
export function lastSummaryLines(): string[] {
  const project = lastExecutedProject();
  return project === null ? [] : formatSummary(projectSummary(project,),);
}
