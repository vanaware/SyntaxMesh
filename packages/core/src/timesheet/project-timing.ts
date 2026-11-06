/**
 * `ProjectTiming` — helpers de tempo que as time sheets usam além de
 * `ProjectLike`.
 *
 * `Resource.project` é tipado como `ProjectLike` (o mínimo que as entidades
 * precisam no construtor). Os cálculos de folha de ponto usam também
 * `dailyWorkingHours`, `weeklyWorkingDays`, `convertToDailyLoad` e
 * `dateToIdx`, que só existem em `Project`. O cast fica num único lugar em
 * vez de espalhado — mesmo padrão do `projExt()` de `task-scenario.ts`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Project.rb
 */
import type { TjTime, } from "../time/tj-time.ts";

export interface ProjectTiming {
  get(name: string,): unknown;
  dateToIdx(date: TjTime, forceIntoProject?: boolean,): number;
  dailyWorkingHours(): number;
  weeklyWorkingDays(): number;
  convertToDailyLoad(seconds: number,): number;
}
