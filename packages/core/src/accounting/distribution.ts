/**
 * Distribuição temporal unificada de custos (#6a) e resolução de
 * `timebasis` (#6) — Fase 10 Complemento, Bloco C2.
 *
 * Este módulo é a fonte única da regra transversal que conecta `timebasis`
 * aos cálculos de `charge` e `material`: define se a distribuição temporal
 * conta dias corridos (`duration`) ou dias úteis (`length`).
 *
 * `timebasis` **não** altera agendamento — é exclusivo para cálculo de
 * custo (complemento2 §1.2 princípio 1).
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento2.md (§2–§5)
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C2)
 */
import { type Task, } from "../model/task.ts";
import { type ProjectLike, } from "../model/project-like.ts";

/** Valor canônico de timebasis (complemento2 §2.2). */
export type Timebasis = "duration" | "length";

/**
 * Normaliza um valor de timebasis (pode ser alias) para o canônico.
 * `calendar` → `duration`; `working` → `length`. Valores desconhecidos
 * ou nulos retornam null (o parser reporta `illegal_timebasis`, C3.4.3).
 */
export function normalizeTimebasis(
  v: string | null | undefined,
): Timebasis | null {
  switch (v) {
    case "duration":
    case "calendar":
      return "duration";
    case "length":
    case "working":
      return "length";
    default:
      return null;
  }
}

/**
 * Regra de resolução do `timebasis` efetivo (complemento2 §2.4), aplicada
 * por tarefa, em ordem:
 *
 * 1. `length` da tarefa > 0 → `length` (implícito, ganha de tudo).
 * 2. `duration` da tarefa > 0 → `duration` (implícito).
 * 3. `timebasis` explícito da tarefa → valor explícito (normalizado).
 * 4. `timebasis` do projeto → valor do projeto.
 * 5. Nenhum dos acima → default `duration` (compatibilidade TJ).
 */
export function resolveTimebasis(
  task: Task,
  scIdx: number,
  project: ProjectLike,
): Timebasis {
  const scenario = task.scenarioData(scIdx,);
  if ((scenario.a("length",) as number) > 0) return "length";
  if ((scenario.a("duration",) as number) > 0) return "duration";
  const explicit = normalizeTimebasis(
    scenario.a("timebasis",) as string | null,
  );
  if (explicit) return explicit;
  const fromProject = normalizeTimebasis(
    project.get("timebasis",) as string | null,
  );
  if (fromProject) return fromProject;
  return "duration";
}

/**
 * Contexto para os cálculos de distribuição (§3.3–§3.4). As fontes de
 * `isWorkingCalendarDay` e `leaves` são o shift da tarefa, se houver,
 * senão o projeto (complemento2 §2.7) — leaves de RECURSO nunca entram
 * (propriedade 5: charge/material são task-centric).
 */
export interface DistributionContext {
  /** timebasis resolvido da tarefa (resolvedTimebasis). */
  timebasis: Timebasis;
  /** Dia útil do calendário (workinghours do shift/projeto, sem leaves). */
  isWorkingCalendarDay: (day: Date,) => boolean;
  /** Intervalos de leave [start, end] fechados (shift/projeto). */
  leaves: Array<{ start: Date; end: Date }>;
  /** project.weekStartsMonday — define o início da semana (perweek). */
  weekStartsMonday: boolean;
  /** Horas úteis por dia (project.dailyworkinghours) — para perhour. */
  workingHoursPerDay: number;
}

/** Modificadores dependentes de período (§3.2). */
export type PeriodModifier = "perhour" | "perday" | "perweek" | "permonth";

const MS_DAY = 86400000;

/** Meia-noite UTC de um Date (aritmética de dias fechada em UTC). */
function dayStart(d: Date,): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),);
}

/** Dias fechados entre start e end (inclusive), em passos de 1 dia UTC. */
function* eachDay(start: Date, end: Date,): Generator<number> {
  const s = dayStart(start,);
  const e = dayStart(end,);
  for (let t = s; t <= e; t += MS_DAY) yield t;
}

function dayFromDate(ms: number,): Date {
  return new Date(ms,);
}

/** Dia coberto por algum leave (intervalos fechados). */
export function inLeaves(
  ms: number,
  leaves: Array<{ start: Date; end: Date }>,
): boolean {
  for (const l of leaves) {
    if (ms >= dayStart(l.start,) && ms <= dayStart(l.end,)) return true;
  }
  return false;
}

/**
 * Dias elegíveis cobertos pelo intervalo (§5, definições formais):
 * `duration`: qualquer dia; `length`: dia útil do calendário E não
 * coberto por leave.
 */
export function countEligibleDays(
  start: Date,
  end: Date,
  ctx: DistributionContext,
): number {
  let n = 0;
  for (const ms of eachDay(start, end,)) {
    if (ctx.timebasis === "duration") {
      n++;
    } else if (
      ctx.isWorkingCalendarDay(dayFromDate(ms,),) && !inLeaves(ms, ctx.leaves,)
    ) {
      n++;
    }
  }
  return n;
}

/**
 * Horas úteis cobertas (§3.4.2): dias úteis do calendário menos leaves,
 * × horas úteis por dia. `perhour` é sempre horas úteis, independente de
 * timebasis (propriedade 8).
 */
export function countWorkingHours(
  start: Date,
  end: Date,
  isWorkingCalendarDay: (day: Date,) => boolean,
  hoursPerDay: number,
  leaves: Array<{ start: Date; end: Date }> = [],
): number {
  let n = 0;
  for (const ms of eachDay(start, end,)) {
    const d = dayFromDate(ms,);
    if (isWorkingCalendarDay(d,) && !inLeaves(ms, leaves,)) n += hoursPerDay;
  }
  return n;
}

/** Início da semana (UTC ms) que contém `ms`, segundo weekStartsMonday. */
function weekStartMs(ms: number, weekStartsMonday: boolean,): number {
  const d = new Date(ms,);
  const wd = d.getUTCDay(); // 0=dom
  const offset = weekStartsMonday ? (wd + 6) % 7 : wd;
  return ms - offset * MS_DAY;
}

/** Primeiro dia do mês de `ms` (UTC). */
function monthStartMs(ms: number,): number {
  const d = new Date(ms,);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1,);
}

/** Último dia do mês de `ms` (UTC, ms do dia). */
function monthEndMs(ms: number,): number {
  const d = new Date(monthStartMs(ms,),);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0,);
}

/**
 * Fórmula unificada (§3.4/§3.6): para cada período P (semana ou mês) que
 * intersecta o intervalo, `amount × (numerador(P) / denominador(P))`, com
 * denominador = dias corridos (`duration`) ou dias úteis do calendário sem
 * leaves (`length`); numerador = dias do período cobertos pela tarefa
 * (`duration`) ou dias elegíveis cobertos (`length`).
 */
function perPeriodFormula(
  amount: number,
  start: Date,
  end: Date,
  ctx: DistributionContext,
  periodOf: (ms: number,) => number,
  periodEnd: (ms: number,) => number,
): number {
  let total = 0;
  const seen = new Set<number>();
  for (const ms of eachDay(start, end,)) {
    const p = periodOf(ms,);
    if (seen.has(p,)) continue;
    seen.add(p,);
    const pEnd = periodEnd(p,);
    // Numerador e denominador do período P.
    let num = 0;
    let den = 0;
    for (let t = p; t <= pEnd; t += MS_DAY) {
      const covered = t >= dayStart(start,) && t <= dayStart(end,);
      if (ctx.timebasis === "duration") {
        den++;
        if (covered) num++;
      } else {
        const working = ctx.isWorkingCalendarDay(dayFromDate(t,),);
        if (working) {
          den++;
          if (covered && !inLeaves(t, ctx.leaves,)) num++;
        }
      }
    }
    if (den > 0) total += (amount * num) / den;
  }
  return total;
}

/**
 * Valor total de um modificador de período sobre o intervalo da tarefa.
 * `perhour` não depende de timebasis; `perday` é contagem direta; `perweek`
 * e `permonth` usam a fórmula proporcional por período (§3.4.3/§3.4.4).
 */
export function perPeriod(
  modifier: PeriodModifier,
  amount: number,
  start: Date,
  end: Date,
  ctx: DistributionContext,
): number {
  switch (modifier) {
    case "perhour":
      return amount * countWorkingHours(
        start,
        end,
        ctx.isWorkingCalendarDay,
        ctx.workingHoursPerDay,
        ctx.leaves,
      );
    case "perday":
      return amount * countEligibleDays(start, end, ctx,);
    case "perweek":
      return perPeriodFormula(
        amount,
        start,
        end,
        ctx,
        (ms,) => weekStartMs(ms, ctx.weekStartsMonday,),
        (p,) => p + 6 * MS_DAY,
      );
    case "permonth":
      return perPeriodFormula(
        amount,
        start,
        end,
        ctx,
        monthStartMs,
        monthEndMs,
      );
  }
}

/**
 * `distributed` (§3.4.5): divide o total igualmente pelos dias elegíveis
 * cobertos. O total distribuído é sempre `total` (propriedade 9); o último
 * dia absorve o resto de arredondamento para fechar exatamente.
 */
export function distributeDays(
  total: number,
  start: Date,
  end: Date,
  ctx: DistributionContext,
): number[] {
  const days: number[] = [];
  for (const ms of eachDay(start, end,)) {
    const eligible = ctx.timebasis === "duration" ||
      (ctx.isWorkingCalendarDay(dayFromDate(ms,),) &&
        !inLeaves(ms, ctx.leaves,));
    if (eligible) days.push(ms,);
  }
  if (days.length === 0) return [];
  const per = total / days.length;
  const out = days.map(() => per);
  // Último dia absorve o resto (decisão §10.1).
  const sum = out.reduce((a, b,) => a + b, 0,);
  out[out.length - 1]! += total - sum;
  return out;
}

/**
 * `distribution { frações }` (§3.4.6): divide os dias elegíveis cobertos em
 * N blocos consecutivos (N = frações) e aplica `fração × total` por bloco,
 * igualmente pelos dias do bloco. Dias não divisíveis: o RESTO vai para o
 * último bloco (decisão §10.1 — absorvido pela última parte).
 * A soma dos valores é sempre `total` (propriedade 9; soma das frações = 1.0
 * validada na Fase 8.1).
 */
export function distributeFractions(
  total: number,
  fractions: number[],
  start: Date,
  end: Date,
  ctx: DistributionContext,
): number[] {
  const eligible: number[] = [];
  for (const ms of eachDay(start, end,)) {
    const ok = ctx.timebasis === "duration" ||
      (ctx.isWorkingCalendarDay(dayFromDate(ms,),) &&
        !inLeaves(ms, ctx.leaves,));
    if (ok) eligible.push(ms,);
  }
  const n = fractions.length;
  if (eligible.length === 0 || n === 0) return [];
  const base = Math.floor(eligible.length / n,);
  // Blocos: n-1 de tamanho `base`; último absorve o resto.
  const out: number[] = [];
  for (let b = 0; b < n; b++) {
    const size = b === n - 1 ? eligible.length - base * (n - 1) : base;
    const blockTotal = fractions[b]! * total;
    const perDay = size > 0 ? blockTotal / size : 0;
    for (let i = 0; i < size; i++) out.push(perDay,);
  }
  // Fecha arredondamento: último dia absorve a diferença.
  const sum = out.reduce((a, b,) => a + b, 0,);
  out[out.length - 1]! += total - sum;
  return out;
}
