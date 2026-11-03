/**
 * Onda D3 — booking temporal (fase-14-c-onda-d-booking-sintaxe-nomenclatura.md §3.D3).
 *
 * Um booking de **charge** ou de **material** (inclusive estoque) deixa de ser
 * preso a uma data pontual e passa a carregar um **período** (lista de
 * intervalos) com um **modifier** que distribui o valor no período — o mesmo
 * vocabulário da alocação/planejamento (`onstart`/`onend`/`perhour`/`perday`/
 * `perweek`/`permonth`/`distributed`).
 *
 * Diferença deliberada em relação a `ExtendedCharge`/`distribution.ts`: o
 * booking é um fato **real** (dinheiro gasto / material movimentado em datas
 * do calendário), não uma previsão sobre a agenda de trabalho da tarefa. A
 * distribuição é calendar-based (dias de calendário cobertos pelos intervalos,
 * com fim exclusivo como no parser), sem `DistributionContext`. O parser de
 * *gramática* é compartilhado (mesmos
 * literais de modifier); a matemática vive aqui, fonte única para charge,
 * material e estoque.
 *
 * Compatibilidade: `on <data>` vira um intervalo degenerado de 1 dia com
 * modifier `onstart` (`.isTemporal() === false`), e os consumidores tratam o
 * booking legado exatamente como antes (mesmo filtro de data, valor cheio).
 */
import { TjTime, } from "../time/tj-time.ts";
import { TimeInterval, } from "../time/time-interval.ts";

/** Vocabulário de distribuição do booking (mesmos literais da alocação). */
export type BookingModifier =
  | "onstart"
  | "onend"
  | "perhour"
  | "perday"
  | "perweek"
  | "permonth"
  | "distributed";

/** Período + modifier de um booking (charge ou material/estoque). */
export interface BookingTail {
  modifier: BookingModifier;
  intervals: TimeInterval[];
}

const DAY_SECONDS = 86400;

/**
 * Índice do dia de calendário (meia-noite UTC) que cobre um instante. Toda a
 * aritmética de dias trabalha com esses índices inteiros — a mesma base da
 * iteração dia-a-dia de `distribution.ts`.
 */
function dayIdx(t: TjTime,): number {
  return Math.floor(t.toSeconds() / DAY_SECONDS,);
}

/**
 * Tail legado a partir de `on <data>`: intervalo de um dia com modifier
 * `onstart` — `isTemporalTail` devolve `false` e os consumidores mantêm o
 * caminho antigo (mesmo ponto, valor cheio).
 */
export function legacyTail(date: TjTime,): BookingTail {
  return {
    modifier: "onstart",
    intervals: [new TimeInterval(date, date.sameTimeNextDay(),),],
  };
}

/**
 * Faixa de dias cobertos por um intervalo na convenção do parser: fim
 * **exclusivo** (`[start, end)`). Assim `d + 24h` (data despida) cobre 1 dia e
 * `A - B` (fim em `B 00:00`) cobre de A até B−1 — a mesma leitura que a
 * exportação usa ao reemitir `end − 1s`.
 */
function ivDayRange(interval: TimeInterval,): [number, number,] {
  const lo = Math.floor(interval.start.toSeconds() / DAY_SECONDS,);
  const hi = Math.floor((interval.end.toSeconds() - 1) / DAY_SECONDS,);
  return [lo, hi,];
}

/** Dias cobertos pelo intervalo (0 se vazio). */
function daysOf(interval: TimeInterval,): number {
  const [lo, hi,] = ivDayRange(interval,);
  return hi >= lo ? hi - lo + 1 : 0;
}

/**
 * Dias de sobreposição entre `intervals` (fim exclusivo) e o período fechado
 * `[start, end]` (inclusivo em ambas as pontas). Metade ausente do período não
 * corta o intervalo: sem `start` o piso é o próprio início; sem `end` o teto é
 * o fim do intervalo.
 */
export function overlapDays(
  intervals: TimeInterval[],
  start: TjTime | null,
  end: TjTime | null,
): number {
  const pLo = start === null ? -Infinity : dayIdx(start,);
  const pHi = end === null ? Infinity : dayIdx(end,);
  let days = 0;
  for (const iv of intervals) {
    const [lo, hi,] = ivDayRange(iv,);
    const a = Math.max(lo, pLo,);
    const b = Math.min(hi, pHi,);
    if (a <= b) days += b - a + 1;
  }
  return days;
}

/** Algum intervalo cruza o período fechado `[start, end]`? */
export function tailOverlaps(
  tail: BookingTail,
  start: TjTime | null,
  end: TjTime | null,
): boolean {
  return overlapDays(tail.intervals, start, end,) > 0;
}

/**
 * O tail expressa algo além do ponto legado (`on <data>` ≡ onstart pontual)?
 * Consumidores usam isto para manter o caminho antigo intacto.
 */
export function isTemporalTail(tail: BookingTail,): boolean {
  if (tail.modifier !== "onstart") return true;
  return tail.intervals.some((iv,) => daysOf(iv,) > 1);
}

/**
 * Parte do `value` que cai no período fechado `[start, end]` sob o modifier.
 * Sem período ⇒ valor cheio. Booking legado (onstart pontual) ⇒ valor cheio
 * quando o ponto está no período, 0 fora — coerente com o filtro antigo.
 */
export function valueInPeriod(
  value: number,
  tail: BookingTail,
  start: TjTime | null,
  end: TjTime | null,
): number {
  if (start === null || end === null) return value;
  const days = overlapDays(tail.intervals, start, end,);
  if (days === 0) return 0;
  const pLo = dayIdx(start,);
  const pHi = dayIdx(end,);
  switch (tail.modifier) {
    case "onstart": {
      // Valor integral se o primeiro dia coberto de algum intervalo cai no
      // período.
      const hit = tail.intervals.some((iv,) => {
        const [lo,] = ivDayRange(iv,);
        return lo >= pLo && lo <= pHi;
      },);
      return hit ? value : 0;
    }
    case "onend": {
      // Valor integral se o último dia coberto de algum intervalo cai no
      // período (fim exclusivo ⇒ o dia coberto é `end − 1s`).
      const hit = tail.intervals.some((iv,) => {
        const [, hi,] = ivDayRange(iv,);
        return hi >= pLo && hi <= pHi;
      },);
      return hit ? value : 0;
    }
    case "perday":
      return value * days;
    case "perhour":
      return value * 24 * days;
    case "perweek":
      return value * days / 7;
    case "permonth":
      return value * days / 30;
    case "distributed": {
      const total = tail.intervals.reduce((sum, iv,) => sum + daysOf(iv,), 0,);
      return total <= 0 ? 0 : value * days / total;
    }
  }
}
