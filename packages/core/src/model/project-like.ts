import type { PropertySet, } from "./property-set.ts";
import type { Scenario, } from "./scenario.ts";
import type { Shift, } from "./shift.ts";
import type { Account, } from "./account.ts";
import type { Resource, } from "./resource.ts";
import type { Task, } from "./task.ts";
import type { Report, } from "./report.ts";
import type { TjTime, } from "../time/tj-time.ts";

export interface ProjectLike {
  readonly scenarioCount: number;
  scenario(idx: number,): { id: string; fullId: string } | null;
  scenarioIdx(sc: string,): number | undefined;
  get(name: string,): unknown;
  set(name: string, value: unknown,): void;
  addScenario(scenario: { id: string; fullId: string },): void;
  addScenario(s: Scenario,): void;

  // PropertySets (para as entidades se registrarem)
  readonly scenarios: PropertySet;
  readonly shifts: PropertySet;
  readonly accounts: PropertySet;
  readonly resources: PropertySet;
  readonly tasks: PropertySet;
  readonly reports: PropertySet;

  // Registro
  addShift(s: Shift,): void;
  addAccount(a: Account,): void;
  addTask(t: Task,): void;
  addResource(r: Resource,): void;
  addReport(r: Report,): void;
  removeAccount(a: Account,): void;

  /**
   * Resolve um ID de tarefa em um objeto `Task`.
   *
   * Usado por `TaskDependency.resolve()` para resolver referências
   * cruzadas entre tarefas.
   */
  task(id: string,): Task | null;

  /**
   * Resolve um ID de recurso em um objeto `Resource`.
   *
   * Usado por `TaskScenario.preScheduleCheck()` para converter os IDs de
   * recursos do atributo `responsible` em objetos `Resource`.
   */
  resource(id: string,): Resource | null;

  /**
   * Converte uma data `TjTime` para o índice numérico de slot.
   *
   * Usado por `TaskScenario.prepareScheduling()` para calcular
   * o índice do dia atual.
   */
  dateToIdx(date: TjTime,): number;

  /**
   * Converte um índice de slot para uma data `TjTime`.
   *
   * Usado por `TaskScenario.schedule()` e `propagateDate()` para
   * propagar datas.
   */
  idxToDate(sbIdx: number,): TjTime;

  /**
   * Verifica se algum recurso está disponível no slot especificado.
   *
   * Usado por `TaskScenario.bookResources()`.
   */
  anyResourceAvailable(sbIdx: number,): boolean;

  /**
   * Verifica se o slot especificado é um horário de trabalho.
   *
   * Usado por `TaskScenario.onShiftCheck()` e `calcLength()`.
   */
  isWorkingTime(sbIdx: number,): boolean;

  /**
   * Converte um número de slots para dias de trabalho.
   *
   * Usado por `TaskScenario.postScheduleCheck()` para relatar gaps.
   */
  slotsToDays(slots: number,): number;
}
