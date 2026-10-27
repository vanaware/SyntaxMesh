/**
 * Modificador de extended charge — define como um valor monetário é distribuído
 * no tempo durante a execução de uma tarefa.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 * @see docs/syntaxmesh/fases/fase-10-complemento2.md (§3.1–§3.6)
 */
import { type Task, } from "./task.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { TjTime, } from "../time/tj-time.ts";
import {
  countEligibleDays,
  distributeDays,
  distributeFractions,
  type DistributionContext,
  type PeriodModifier,
  perPeriod,
} from "../accounting/distribution.ts";

export type ExtendedChargeModifier =
  | "onstart"
  | "onend"
  | "perhour"
  | "perday"
  | "perweek"
  | "permonth"
  | "distributed"
  | "distribution";

/**
 * Representa uma charge estendida com distribuição temporal não-linear.
 *
 * Semelhante a `MaterialAllocation`, mas para valores monetários.
 *
 * Fase 10 Complemento (C2.10): após `attach()`, o método `turnover(period)`
 * usa a distribuição unificada do `distribution.ts` respeitando `timebasis`
 * (§3.1–§3.6). Substitui o cálculo ad-hoc (`amount/7` para perweek/permonth,
 * `perDiem` para perday) que o parser fazia antes.
 */
export class ExtendedCharge {
  readonly amount: number;
  readonly modifier: ExtendedChargeModifier;
  readonly distribution?: number[];

  // Preenchidos por attach(). Se ausentes, turnover() retorna 0.
  private _task: Task | null = null;
  private _scIdx: number = 0;
  private _ctx: DistributionContext | null = null;

  constructor(
    amount: number,
    modifier: ExtendedChargeModifier,
    distribution?: number[],
  ) {
    this.amount = amount;
    this.modifier = modifier;
    this.distribution = distribution;

    // Validação
    if (distribution) {
      const sum = distribution.reduce((a, b,) => a + b, 0,);
      if (Math.abs(sum - 1.0,) > 0.001) {
        throw new Error(
          `Extended charge distribution must sum to 1.0, got ${sum}`,
        );
      }
    }
  }

  /**
   * Anexa o contexto de cálculo (tarefa dona, cenário e DistributionContext
   * já resolvido — tipicamente construído a partir do `resolvedTimebasis`
   * da tarefa em `prepareScheduling()`).
   */
  attach(task: Task, scIdx: number, ctx: DistributionContext,): void {
    this._task = task;
    this._scIdx = scIdx;
    this._ctx = ctx;
  }

  /**
   * Valor desta charge que incide sobre `period` (§3.1–§3.6).
   *
   * Retorna 0 se a charge não foi anexada a uma tarefa agendada ou se o
   * período não interseca o intervalo da tarefa.
   */
  turnover(period: TimeInterval,): number {
    if (!this._task || !this._ctx) return 0;
    const scenario = this._task.scenarioData(this._scIdx,);
    const taskStart = scenario.a("start",) as TjTime | null;
    const taskEnd = scenario.a("end",) as TjTime | null;
    if (!taskStart || !taskEnd) return 0;

    // Caso pontual (§3.2): onstart/onEnd — verificamos se o dia UTC da
    // data-chave está contido no período (inclusive em ambas as pontas).
    if (this.modifier === "onstart") {
      return dayInPeriod(taskStart.toDate(), period,) ? this.amount : 0;
    }
    if (this.modifier === "onend") {
      return dayInPeriod(taskEnd.toDate(), period,) ? this.amount : 0;
    }

    // Interseção ao nível de dia (inclusive) — `distribution.ts` itera
    // dias discretos, então `Interval.intersection` half-open [start, end)
    // falharia quando período e tarefa compartilham apenas um dia.
    const aMs = Math.max(
      dayStartMs(taskStart.toDate(),),
      dayStartMs(period.start.toDate(),),
    );
    const bMs = Math.min(
      dayStartMs(taskEnd.toDate(),),
      dayStartMs(period.end.toDate(),),
    );
    if (aMs > bMs) return 0;
    const a = new Date(aMs,);
    const b = new Date(bMs,);
    const ctx = this._ctx;

    switch (this.modifier) {
      case "perhour":
      case "perday":
      case "perweek":
      case "permonth":
        return perPeriod(
          this.modifier as PeriodModifier,
          this.amount,
          a,
          b,
          ctx,
        );
      case "distributed": {
        const totalEligible = countEligibleDays(
          taskStart.toDate(),
          taskEnd.toDate(),
          ctx,
        );
        if (totalEligible === 0) return 0;
        const interEligible = countEligibleDays(a, b, ctx,);
        return this.amount * interEligible / totalEligible;
      }
      case "distribution": {
        const fr = this.distribution ?? [];
        if (fr.length === 0) return 0;
        // Array de valores por dia elegível da TAREFA.
        const perDay = distributeFractions(
          this.amount,
          fr,
          taskStart.toDate(),
          taskEnd.toDate(),
          ctx,
        );
        // Determinar quais dias elegíveis da tarefa caem na interseção.
        const MS_DAY = 86_400_000;
        const taskStartMs = dayStartMs(taskStart.toDate(),);
        const taskEndMs = dayStartMs(taskEnd.toDate(),);
        let sum = 0;
        let idx = 0;
        for (let t = taskStartMs; t <= taskEndMs; t += MS_DAY) {
          const eligible = ctx.timebasis === "duration" ||
            (ctx.isWorkingCalendarDay(new Date(t,),) &&
              !coveredByLeave(t, ctx,));
          if (!eligible) continue;
          if (t >= aMs && t <= bMs) sum += perDay[idx] ?? 0;
          idx++;
        }
        return sum;
      }
      default:
        return 0;
    }
  }

  /**
   * Cópia profunda imutável.
   * Retorna this (imutável) para compatibilidade com deepClone.
   */
  deepClone(): this {
    return this;
  }
}

/** Meia-noite UTC de um Date (aritmética de dias fechada em UTC). */
function dayStartMs(d: Date,): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),);
}

/** Check se um dia UTC ms está coberto por algum leave do ctx. */
function coveredByLeave(ms: number, ctx: DistributionContext,): boolean {
  for (const l of ctx.leaves) {
    const s = Date.UTC(
      l.start.getUTCFullYear(),
      l.start.getUTCMonth(),
      l.start.getUTCDate(),
    );
    const e = Date.UTC(
      l.end.getUTCFullYear(),
      l.end.getUTCMonth(),
      l.end.getUTCDate(),
    );
    if (ms >= s && ms <= e) return true;
  }
  return false;
}

/** Verifica se o dia UTC de `d` está dentro de `period` (inclusive). */
function dayInPeriod(d: Date, period: TimeInterval,): boolean {
  const ms = dayStartMs(d,);
  return ms >= dayStartMs(period.start.toDate(),) &&
    ms <= dayStartMs(period.end.toDate(),);
}
