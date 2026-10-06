import type { PropertySet, } from "./property-set.ts";
import type { Scenario, } from "./scenario.ts";
import type { Shift, } from "./shift.ts";
import type { Account, } from "./account.ts";
import type { Resource, } from "./resource.ts";
import type { Task, } from "./task.ts";
import type { Report, } from "./report.ts";

export interface ProjectLike {
  readonly scenarioCount: number;
  scenario(idx: number): { id: string; fullId: string } | null;
  scenarioIdx(sc: string): number | undefined;
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  addScenario(scenario: { id: string; fullId: string }): void;

  // PropertySets (para as entidades se registrarem)
  readonly scenarios: PropertySet;
  readonly shifts: PropertySet;
  readonly accounts: PropertySet;
  readonly resources: PropertySet;
  readonly tasks: PropertySet;
  readonly reports: PropertySet;

  // Registro
  addScenario(s: Scenario): void;
  addShift(s: Shift): void;
  addAccount(a: Account): void;
  addTask(t: Task): void;
  addResource(r: Resource): void;
  addReport(r: Report): void;
  removeAccount(a: Account): void;

  /**
   * Resolve um ID de tarefa em um objeto `Task`.
   *
   * Usado por `TaskDependency.resolve()` para resolver referências
   * cruzadas entre tarefas.
   */
  task(id: string): Task | null;
}