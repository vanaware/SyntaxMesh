import { Material, } from "./material.ts";
import { type Task, } from "./task.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { TjTime, } from "../time/tj-time.ts";
import {
  countEligibleDays,
  distributeFractions,
  type DistributionContext,
  type PeriodModifier,
  perPeriod,
} from "../accounting/distribution.ts";

/**
 * Modificador de alocação de material — define como uma quantidade de material
 * é distribuída no tempo durante a execução de uma tarefa.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 */
export type MaterialAllocationModifier =
  | "onstart"
  | "onend"
  | "perhour"
  | "perday"
  | "perweek"
  | "permonth"
  | "distributed"
  | "distribution";

/**
 * Representa uma alocação de material a uma tarefa, com um modificador
 * temporal que determina quando e como o material é consumido.
 *
 * Fase 10 Complemento (C2.10): após `attach()`, `quantityIn(period)` delega
 * ao `distribution.ts` respeitando `timebasis` (mesma semântica de
 * ExtendedCharge, mas em unidades de material em vez de moeda).
 */
export class MaterialAllocation {
  readonly material: Material;
  readonly quantity: number;
  readonly modifier: MaterialAllocationModifier;
  readonly distribution?: number[];

  private _task: Task | null = null;
  private _scIdx: number = 0;
  private _ctx: DistributionContext | null = null;

  constructor(
    material: Material,
    quantity: number,
    modifier: MaterialAllocationModifier,
    distribution?: number[],
  ) {
    this.material = material;
    this.quantity = quantity;
    this.modifier = modifier;
    this.distribution = distribution;

    // Validação
    if (quantity < 0) {
      throw new Error("Material allocation quantity cannot be negative",);
    }

    if (distribution) {
      const sum = distribution.reduce((a, b,) => a + b, 0,);
      if (Math.abs(sum - 1.0,) > 0.001) {
        throw new Error(
          `Material allocation distribution must sum to 1.0, got ${sum}`,
        );
      }
    }
  }

  /** Anexa o contexto de cálculo (tarefa, cenário, DistributionContext). */
  attach(task: Task, scIdx: number, ctx: DistributionContext,): void {
    this._task = task;
    this._scIdx = scIdx;
    this._ctx = ctx;
  }

  /** Quantidade de material consumida dentro de `period` (§3.1–§3.6). */
  quantityIn(period: TimeInterval,): number {
    if (!this._task || !this._ctx) return 0;
    const scenario = this._task.scenarioData(this._scIdx,);
    const taskStart = scenario.a("start",) as TjTime | null;
    const taskEnd = scenario.a("end",) as TjTime | null;
    if (!taskStart || !taskEnd) return 0;

    if (this.modifier === "onstart") {
      return dayInPeriod(taskStart.toDate(), period,) ? this.quantity : 0;
    }
    if (this.modifier === "onend") {
      return dayInPeriod(taskEnd.toDate(), period,) ? this.quantity : 0;
    }

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

    switch (this.modifier) {
      case "perhour":
      case "perday":
      case "perweek":
      case "permonth":
        return perPeriod(
          this.modifier as PeriodModifier,
          this.quantity,
          a,
          b,
          this._ctx,
        );
      case "distributed": {
        const totalEligible = countEligibleDays(
          taskStart.toDate(),
          taskEnd.toDate(),
          this._ctx,
        );
        if (totalEligible === 0) return 0;
        const interEligible = countEligibleDays(a, b, this._ctx,);
        return this.quantity * interEligible / totalEligible;
      }
      case "distribution": {
        const fr = this.distribution ?? [];
        if (fr.length === 0) return 0;
        const perDay = distributeFractions(
          this.quantity,
          fr,
          taskStart.toDate(),
          taskEnd.toDate(),
          this._ctx,
        );
        const MS_DAY = 86_400_000;
        const taskStartMs = dayStartMs(taskStart.toDate(),);
        const taskEndMs = dayStartMs(taskEnd.toDate(),);
        let sum = 0;
        let idx = 0;
        for (let t = taskStartMs; t <= taskEndMs; t += MS_DAY) {
          const eligible = this._ctx.timebasis === "duration" ||
            (this._ctx.isWorkingCalendarDay(new Date(t,),) &&
              !coveredByLeave(t, this._ctx,));
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

/** Leave check — mesma semântica do ExtendedCharge. */
function coveredByLeave(ms: number, ctx: DistributionContext,): boolean {
  for (const l of ctx.leaves) {
    const s = dayStartMs(l.start,);
    const e = dayStartMs(l.end,);
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
