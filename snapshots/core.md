> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém experimentos e código da área de @syntaxmesh/core
> O projeto é o **SyntaxMesh ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto SyntaxMesh - Modo: CORE

Gerado automaticamente em: 9/12/2026, 7:41:10 AM

---

## Arquivo: `packages/core/src/time/timezone.ts`

```ts
export const currentTimeZone: string = 'UTC';

/**
 * Check if a timezone string is valid (IANA format)
 * @param zone - Timezone string to validate
 * @returns boolean
 */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(zone);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get offset in seconds for a given epoch and timezone
 * @param epochSecs - Epoch seconds (UTC)
 * @param timeZone - Timezone string (e.g., 'America/Sao_Paulo')
 * @returns Offset in seconds
 */
export function getOffsetSeconds(epochSecs: number, timeZone: string): number {
  try {
    const date = new Date(epochSecs * 1000);
    const formatter = new Intl.DateTimeFormat(timeZone, { timeZoneName: 'short' });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');
    if (!offsetPart) return 0;
    
    // Extract offset from timezone name (e.g., "GMT-03:00" -> -18000)
    const match = offsetPart.value.match(/GMT?([+-])(\d{2}):(\d{2})/);
    if (!match) return 0;
    
    const sign = match[1] === '-' ? -1 : 1;
    const hours = parseInt(match[2] ?? '0');
    const minutes = parseInt(match[3] ?? '0');
    return sign * (hours * 3600 + minutes * 60);
  } catch {
    return 0;
  }
}

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

/**
 * Get local parts (year, month, day, hour, minute, second, weekday) for given epoch and timezone
 * @param epochSecs - Epoch seconds (UTC)
 * @param timeZone - Timezone string
 * @returns Object with local parts
 */
export function getLocalParts(epochSecs: number, timeZone: string): LocalParts {
  try {
    const date = new Date(epochSecs * 1000);
    const formatter = new Intl.DateTimeFormat(timeZone, { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short'
    });
    
    const parts = formatter.formatToParts(date);
    const result: LocalParts = {
      year: 0,
      month: 0,
      day: 0,
      hour: 0,
      minute: 0,
      second: 0,
      weekday: 0
    };
    
    for (const part of parts) {
      if (part.type === 'year') result.year = parseInt(part.value);
      else if (part.type === 'month') result.month = parseInt(part.value);
      else if (part.type === 'day') result.day = parseInt(part.value);
      else if (part.type === 'hour') result.hour = parseInt(part.value);
      else if (part.type === 'minute') result.minute = parseInt(part.value);
      else if (part.type === 'second') result.second = parseInt(part.value);
      else if (part.type === 'weekday') {
        const weekdayMap: Record<string, number> = {
          'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
          'Thursday': 4, 'Friday': 5, 'Saturday': 6,
          'Dom': 0, 'Seg': 1, 'Ter': 2, 'Qua': 3,
          'Qui': 4, 'Sex': 5, 'Sáb': 6,
        };
        result.weekday = weekdayMap[part.value] ?? 0;
      }
    }
    
    return result;
  } catch {
    return {
      year: 0,
      month: 0,
      day: 0,
      hour: 0,
      minute: 0,
      second: 0,
      weekday: 0
    };
  }
}
```

---

## Arquivo: `packages/core/src/time/tj-time.ts`

```ts
import { isValidTimeZone, getOffsetSeconds, getLocalParts, currentTimeZone } from './timezone.ts';
import { assertEquals, assertNotEquals } from "@std/assert";

export class TjArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TjArgumentError';
  }
}

export class TjTime {
  private readonly seconds: number;

  private constructor(seconds: number) {
    this.seconds = seconds;
  }

  /**
   * Returns current time
   */
  static now(): TjTime {
    return new TjTime(Math.floor(Date.now() / 1000));
  }

  /**
   * Create TjTime from seconds since epoch
   * @param secs - Seconds since epoch (UTC)
   */
  static fromSeconds(secs: number): TjTime {
    return new TjTime(secs);
  }

  /**
   * Create TjTime from Date object
   * @param date - Date object
   */
  static fromDate(date: Date): TjTime {
    return new TjTime(Math.floor(date.getTime() / 1000));
  }

  /**
   * Create TjTime from parts
   * @param year - Year (1970-2035)
   * @param month - Month (1-12)
   * @param day - Day (1-31)
   * @param hour - Hour (0-23, default 0)
   * @param minute - Minute (0-59, default 0)
   * @param second - Second (0-59, default 0)
   * @param tz - Timezone (optional, defaults to currentTimeZone)
   */
  static fromParts(
    year: number,
    month: number,
    day: number,
    hour: number = 0,
    minute: number = 0,
    second: number = 0,
    tz: string = currentTimeZone
  ): TjTime {
    if (!isValidTimeZone(tz)) {
      throw new TjArgumentError(`Invalid time zone: ${tz}`);
    }
    
    // Validate ranges
    if (year < 1970 || year > 2035) {
      throw new TjArgumentError(`Year ${year} out of range (1970 - 2035)`);
    }
    if (month < 1 || month > 12) {
      throw new TjArgumentError(`Month ${month} out of range (1 - 12)`);
    }
    if (hour < 0 || hour > 23) {
      throw new TjArgumentError(`Hour ${hour} out of range (0 - 23)`);
    }
    if (minute < 0 || minute > 59) {
      throw new TjArgumentError(`Minute ${minute} out of range (0 - 59)`);
    }
    if (second < 0 || second > 59) {
      throw new TjArgumentError(`Second ${second} out of range (0 - 59)`);
    }
    
    // Validate day for month
    const maxDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let maxDay: number = maxDays[month]!;
    if (month === 2 && TjTime.isLeapYear(year)) {
      maxDay = 29;
    }
    if (day < 1 || day > maxDay) {
      throw new TjArgumentError(`Day ${day} out of range (1 - ${maxDay}) for month ${month}`);
    }
    
    // Convert to UTC seconds
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const utcSeconds = Math.floor(date.getTime() / 1000);
    
    // Apply timezone offset
    const offset = getOffsetSeconds(utcSeconds, tz);
    return new TjTime(utcSeconds - offset);
  }

  /**
   * Parse string in format YYYY-MM-DD[-HH:MM[:SS][-TZ]]
   * @param str - String to parse
   */
  static fromString(str: string): TjTime {
    const regex = /^(\d{4})-(\d{2})-(\d{2})(?:-(\d{2}):(\d{2})(?::(\d{2}))?)?(?:([+-]\d{4}))?$/;
    const match = str.match(regex);
    if (!match) {
      throw new TjArgumentError(`Invalid date format: ${str}`);
    }

    const year = parseInt(match[1]!);
    const month = parseInt(match[2]!);
    const day = parseInt(match[3]!);

    let hour = 0;
    let minute = 0;
    let second = 0;
    const tz: string = currentTimeZone;

    if (match[4]) {
      hour = parseInt(match[4]);
      minute = parseInt(match[5]!);
      second = match[6] ? parseInt(match[6]) : 0;
    }

    if (match[7]) {
      const tzPart = match[7];
      if (!/^[+-]\d{4}$/.test(tzPart)) {
        throw new TjArgumentError(`Time zone adjustment out of range (-1200 - +1400) but is ${tzPart})`);
      }

      const sign = tzPart[0] === '-' ? -1 : 1;
      const hours = parseInt(tzPart.substring(1, 3));
      const minutes = parseInt(tzPart.substring(3, 5));

      if (hours < 0 || hours > 12 || (hours === 12 && minutes > 0) || minutes < 0 || minutes > 59) {
        throw new TjArgumentError(`Time zone adjustment out of range (-1200 - +1400) but is ${tzPart})`);
      }

      const offsetHours = hours * 60 + minutes;
      const offsetSeconds = sign * offsetHours * 60;

      // Validate range
      if (offsetSeconds < -12 * 3600 || offsetSeconds > 14 * 3600) {
        throw new TjArgumentError(`Time zone adjustment out of range (-1200 - +1400) but is ${tzPart})`);
      }

      // Fixed-offset timezones are not valid IANA identifiers, so compute UTC
      // seconds directly instead of routing through fromParts/isValidTimeZone.
      // offsetSeconds is positive for +HHMM (local ahead of UTC), so subtract to get UTC.
      const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      const utcSeconds = Math.floor(date.getTime() / 1000);
      return new TjTime(utcSeconds - offsetSeconds);
    }

    return TjTime.fromParts(year, month, day, hour, minute, second, tz);
  }

  /**
   * Get seconds since epoch
   */
  toSeconds(): number {
    return this.seconds;
  }

  /**
   * Convert to Date object (for debugging)
   */
  toDate(): Date {
    return new Date(this.seconds * 1000);
  }

  /**
   * Check if year is leap year
   */
  static isLeapYear(year: number): boolean {
    return (year % 400 === 0) || (year % 4 === 0 && year % 100 !== 0);
  }

  /**
   * Add seconds to TjTime
   * @param secs - Seconds to add
   */
  addSeconds(secs: number): TjTime {
    return new TjTime(this.seconds + secs);
  }

  /**
   * Subtract seconds from TjTime
   * @param secs - Seconds to subtract
   */
  subSeconds(secs: number): TjTime {
    return new TjTime(this.seconds - secs);
  }

  /**
   * Get difference in seconds between two TjTime instances
   * @param other - Other TjTime instance
   */
  diff(other: TjTime): number {
    return this.seconds - other.seconds;
  }

  /**
   * Get modulo of seconds
   * @param val - Value to modulo by
   */
  modulo(val: number): number {
    return this.seconds % val;
  }

  /**
   * Compare to another TjTime instance
   * @param other - Other TjTime instance
   * @returns -1 if less, 0 if equal, 1 if greater
   */
  compareTo(other: TjTime): -1 | 0 | 1 {
    if (this.seconds < other.seconds) return -1;
    if (this.seconds > other.seconds) return 1;
    return 0;
  }

  /**
   * Check if this TjTime is less than another
   * @param other - Other TjTime instance
   */
  lessThan(other: TjTime): boolean {
    return this.seconds < other.seconds;
  }

  /**
   * Check if this TjTime is greater than another
   * @param other - Other TjTime instance
   */
  greaterThan(other: TjTime): boolean {
    return this.seconds > other.seconds;
  }

  /**
   * Check if this TjTime equals another
   * @param other - Other TjTime instance
   */
  equals(other: TjTime): boolean {
    return this.seconds === other.seconds;
  }

  /**
   * Check if this TjTime is less than or equal to another
   * @param other - Other TjTime instance
   */
  lessThanOrEqual(other: TjTime): boolean {
    return this.seconds <= other.seconds;
  }

  /**
   * Check if this TjTime is greater than or equal to another
   * @param other - Other TjTime instance
   */
  greaterThanOrEqual(other: TjTime): boolean {
    return this.seconds >= other.seconds;
  }

  /**
   * Zero minutes and seconds in local time
   */
  beginOfHour(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return TjTime.fromParts(parts.year, parts.month, parts.day, parts.hour, 0, 0, currentTimeZone);
  }

  /**
   * Zero hours, minutes, seconds in local time
   */
  midnight(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return TjTime.fromParts(parts.year, parts.month, parts.day, 0, 0, 0, currentTimeZone);
  }

  /**
   * Beginning of week. If startMonday=true, week starts Monday; otherwise Sunday.
   * Algorithm: go to noon, subtract (weekday - (startMonday?1:0)) days, then midnight.
   */
  beginOfWeek(startMonday: boolean = true): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    const noon = TjTime.fromParts(parts.year, parts.month, parts.day, 12, 0, 0, currentTimeZone);
    const daysToSubtract = parts.weekday - (startMonday ? 1 : 0);
    const noonMinusDays = noon.subSeconds(daysToSubtract * 86400);
    const np = getLocalParts(noonMinusDays.toSeconds(), currentTimeZone);
    return TjTime.fromParts(np.year, np.month, np.day, 0, 0, 0, currentTimeZone);
  }

  /**
   * Beginning of month: day=1, h/m/s=0 in local time
   */
  beginOfMonth(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return TjTime.fromParts(parts.year, parts.month, 1, 0, 0, 0, currentTimeZone);
  }

  /**
   * Beginning of quarter: month = ((m-1) % 3) + 1, h/m/s=0
   */
  beginOfQuarter(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    const quarterMonth = ((parts.month - 1) % 3) + 1;
    return TjTime.fromParts(parts.year, quarterMonth, 1, 0, 0, 0, currentTimeZone);
  }

  /**
   * Beginning of year: month=1, day=1, h/m/s=0
   */
  beginOfYear(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return TjTime.fromParts(parts.year, 1, 1, 0, 0, 0, currentTimeZone);
  }

  /**
   * Weekday in local time (0=Sunday, 1=Monday, ..., 6=Saturday)
   */
  wday(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return parts.weekday;
  }

  /**
   * Hour in local time
   */
  hour(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return parts.hour;
  }

  /**
   * Day in local time
   */
  day(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return parts.day;
  }

  /**
   * Month in local time
   */
  month(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return parts.month;
  }

  /**
   * Year in local time
   */
  year(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return parts.year;
  }

  /**
   * Return [year, month, day, hour, minute, second, weekday] in local time
   */
  to_a(): number[] {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return [parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second, parts.weekday];
  }

  /**
   * Iterate from this TjTime to end with step
   * @param end - End TjTime (exclusive)
   * @param step - Step in seconds (default 1)
   * @param fn - Callback function
   */
  upto(end: TjTime, step: number = 1, fn: (t: TjTime) => void): void {
    let current = TjTime.fromSeconds(this.seconds);
    while (current.seconds < end.seconds) {
      fn(current);
      current = TjTime.fromSeconds(current.seconds + step);
    }
  }
}
```

---

## Arquivo: `packages/core/src/mod.ts`

```ts
/**
 * @syntaxmesh/core
 *
 * Placeholder - implementacao em andamento (Fase 1).
 * O Core e independente de DOM, Preact, BeerCSS, IndexedDB, OPFS
 * e de globals de navegador.
 */

export const CORE_VERSION = "0.0.0-placeholder";

// Export time module
export * from './time/tj-time.ts';
export * from './time/timezone.ts';
```

---

## Arquivo: `packages/core/tests/time/tj-time-parsing_test.ts`

```ts
import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { TjTime, TjArgumentError } from "../../src/time/tj-time.ts";

describe("TjTime.fromSeconds", () => {
  it("retorna instância com os segundos", () => {
    const t = TjTime.fromSeconds(1000000000);
    assertEquals(t.toSeconds(), 1000000000);
  });
});

describe("TjTime.now", () => {
  it("retorna tempo próximo ao atual", () => {
    const before = Math.floor(Date.now() / 1000);
    const t = TjTime.now();
    const after = Math.floor(Date.now() / 1000);
    const seconds = t.toSeconds();
    assertEquals(seconds >= before && seconds <= after, true);
  });
});

describe("TjTime.fromDate", () => {
  it("converte Date para TjTime", () => {
    const date = new Date("2026-01-15T12:30:45Z");
    const t = TjTime.fromDate(date);
    assertEquals(t.toSeconds(), Math.floor(date.getTime() / 1000));
  });
});

describe("TjTime.fromString", () => {
  it("parseia YYYY-MM-DD", () => {
    const t = TjTime.fromString("2026-01-15");
    assertEquals(t.toSeconds(), TjTime.fromParts(2026, 1, 15).toSeconds());
  });

  it("parseia YYYY-MM-DD-HH:MM", () => {
    const t = TjTime.fromString("2026-01-15-14:30");
    assertEquals(t.toSeconds(), TjTime.fromParts(2026, 1, 15, 14, 30).toSeconds());
  });

  it("parseia YYYY-MM-DD-HH:MM:SS", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    assertEquals(t.toSeconds(), TjTime.fromParts(2026, 1, 15, 14, 30, 45).toSeconds());
  });

  it("parseia com timezone +HHMM", () => {
    const t = TjTime.fromString("2026-01-15-14:30-0300");
    // -0300 means 3 hours behind UTC, so 14:30 local = 17:30 UTC
    const expected = TjTime.fromParts(2026, 1, 15, 17, 30);
    assertEquals(t.toSeconds(), expected.toSeconds());
  });

  it("parseia com timezone -HHMM", () => {
    const t = TjTime.fromString("2026-01-15-14:30+0300");
    // +0300 means 3 hours ahead of UTC, so 14:30 local = 11:30 UTC
    const expected = TjTime.fromParts(2026, 1, 15, 11, 30);
    assertEquals(t.toSeconds(), expected.toSeconds());
  });

  it("parseia com timezone +0000", () => {
    const t = TjTime.fromString("2026-01-15-14:30+0000");
    assertEquals(t.toSeconds(), TjTime.fromParts(2026, 1, 15, 14, 30).toSeconds());
  });

  it("rejeita ano < 1970", () => {
    assertThrows(() => TjTime.fromString("1969-01-01"), TjArgumentError);
  });

  it("rejeita ano > 2035", () => {
    assertThrows(() => TjTime.fromString("2036-01-01"), TjArgumentError);
  });

  it("rejeita mês inválido", () => {
    assertThrows(() => TjTime.fromString("2026-00-01"), TjArgumentError);
    assertThrows(() => TjTime.fromString("2026-13-01"), TjArgumentError);
  });

  it("rejeita dia inválido para o mês", () => {
    assertThrows(() => TjTime.fromString("2026-02-30"), TjArgumentError);
    assertThrows(() => TjTime.fromString("2026-04-31"), TjArgumentError);
  });

  it("rejeita hora inválida", () => {
    assertThrows(() => TjTime.fromString("2026-01-01-24:00"), TjArgumentError);
    assertThrows(() => TjTime.fromString("2026-01-01-25:00"), TjArgumentError);
  });

  it("rejeita minuto inválido", () => {
    assertThrows(() => TjTime.fromString("2026-01-01-14:60"), TjArgumentError);
  });

  it("rejeita timezone fora do range", () => {
    assertThrows(() => TjTime.fromString("2026-01-01-14:00+1500"), TjArgumentError);
    assertThrows(() => TjTime.fromString("2026-01-01-14:00-1300"), TjArgumentError);
  });

  it("rejeita timezone mal formatado", () => {
    assertThrows(() => TjTime.fromString("2026-01-01-14:00-03"), TjArgumentError);
    assertThrows(() => TjTime.fromString("2026-01-01-14:00-03000"), TjArgumentError);
  });

  it("rejeita formato geral inválido", () => {
    assertThrows(() => TjTime.fromString("01-01-2026"), TjArgumentError);
    assertThrows(() => TjTime.fromString("abc"), TjArgumentError);
  });
});

describe("TjTime.fromParts", () => {
  it("constrói a partir de partes básicas", () => {
    const t = TjTime.fromParts(2026, 1, 15, 14, 30, 45);
    assertEquals(t.toSeconds(), TjTime.fromString("2026-01-15-14:30:45").toSeconds());
  });

  it("usa valores padrão para hora, minuto, segundo", () => {
    const t = TjTime.fromParts(2026, 1, 15);
    assertEquals(t.toSeconds(), TjTime.fromString("2026-01-15").toSeconds());
  });

  it("valida ano fora do range", () => {
    assertThrows(() => TjTime.fromParts(1969, 1, 1), TjArgumentError);
    assertThrows(() => TjTime.fromParts(2036, 1, 1), TjArgumentError);
  });

  it("valida mês fora do range", () => {
    assertThrows(() => TjTime.fromParts(2026, 0, 1), TjArgumentError);
    assertThrows(() => TjTime.fromParts(2026, 13, 1), TjArgumentError);
  });

  it("valida dia para fevereiro em ano bissexto", () => {
    const t = TjTime.fromParts(2024, 2, 29);
    assertEquals(t.toSeconds(), TjTime.fromString("2024-02-29").toSeconds());
    assertThrows(() => TjTime.fromParts(2025, 2, 29), TjArgumentError);
  });
});
```

---

## Arquivo: `packages/core/tests/time/tj-time-arithmetic_test.ts`

```ts
import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { TjTime, TjArgumentError } from "../../src/time/tj-time.ts";

describe("TjTime aritmética", () => {
  it("soma segundos", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = t1.addSeconds(86400);
    const expected = TjTime.fromString("2026-01-02");
    assertEquals(t2.toSeconds(), expected.toSeconds());
  });

  it("subtrai segundos", () => {
    const t1 = TjTime.fromString("2026-01-02");
    const t2 = t1.subSeconds(86400);
    const expected = TjTime.fromString("2026-01-01");
    assertEquals(t2.toSeconds(), expected.toSeconds());
  });

  it("diferença entre dois TjTime em segundos", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-03");
    assertEquals(t2.diff(t1), 172800);
    assertEquals(t1.diff(t2), -172800);
  });

  it("módulo", () => {
    const t = TjTime.fromString("2026-01-01");
    assertEquals(t.modulo(86400), t.toSeconds() % 86400);
    assertEquals(t.modulo(3600), t.toSeconds() % 3600);
  });
});

describe("TjTime comparação", () => {
  it("menor", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-02");
    assertEquals(t1.lessThan(t2), true);
    assertEquals(t2.lessThan(t1), false);
  });

  it("maior", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-02");
    assertEquals(t1.greaterThan(t2), false);
    assertEquals(t2.greaterThan(t1), true);
  });

  it("igual", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-01");
    assertEquals(t1.equals(t2), true);
    assertEquals(t1.equals(t2.addSeconds(1)), false);
  });

  it("menor ou igual", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-02");
    assertEquals(t1.lessThanOrEqual(t2), true);
    assertEquals(t2.lessThanOrEqual(t1), false);
    assertEquals(t1.lessThanOrEqual(t1), true);
  });

  it("maior ou igual", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-02");
    assertEquals(t1.greaterThanOrEqual(t2), false);
    assertEquals(t2.greaterThanOrEqual(t1), true);
    assertEquals(t1.greaterThanOrEqual(t1), true);
  });

  it("compareTo retorna -1, 0, 1", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-02");
    assertEquals(t1.compareTo(t2), -1);
    assertEquals(t2.compareTo(t1), 1);
    assertEquals(t1.compareTo(t1), 0);
  });
});

describe("TjTime.upto", () => {
  it("itera de A a B com step", () => {
    const results: number[] = [];
    const start = TjTime.fromString("2026-01-01");
    const end = TjTime.fromString("2026-01-04");
    start.upto(end, 86400, (t) => {
      results.push(t.toSeconds());
    });
    assertEquals(results.length, 3);
    assertEquals(results[0], start.toSeconds());
    assertEquals(results[1], TjTime.fromString("2026-01-02").toSeconds());
    assertEquals(results[2], TjTime.fromString("2026-01-03").toSeconds());
  });

  it("não itera se A >= B", () => {
    const results: number[] = [];
    const start = TjTime.fromString("2026-01-02");
    const end = TjTime.fromString("2026-01-01");
    start.upto(end, 1, (t) => {
      results.push(t.toSeconds());
    });
    assertEquals(results.length, 0);
  });
});
```

---

## Arquivo: `packages/core/tests/time/tj-time-normalize_test.ts`

```ts
import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { TjTime, TjArgumentError } from "../../src/time/tj-time.ts";

describe("TjTime.beginOfHour", () => {
  it("zera minutos e segundos", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    const result = t.beginOfHour();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-15-14:00:00").toSeconds());
  });

  it("mantém hora já no início da hora", () => {
    const t = TjTime.fromString("2026-01-15-14:00:00");
    const result = t.beginOfHour();
    assertEquals(result.toSeconds(), t.toSeconds());
  });

  it("funciona para 23:59:59", () => {
    const t = TjTime.fromString("2026-01-15-23:59:59");
    const result = t.beginOfHour();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-15-23:00:00").toSeconds());
  });
});

describe("TjTime.midnight", () => {
  it("zera horas, minutos e segundos", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    const result = t.midnight();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-15-00:00:00").toSeconds());
  });

  it("mantém midnight já no início do dia", () => {
    const t = TjTime.fromString("2026-01-15-00:00:00");
    const result = t.midnight();
    assertEquals(result.toSeconds(), t.toSeconds());
  });

  it("funciona para 23:59:59", () => {
    const t = TjTime.fromString("2026-01-15-23:59:59");
    const result = t.midnight();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-15-00:00:00").toSeconds());
  });
});

describe("TjTime.beginOfWeek", () => {
  it("segunda-feira com startMonday=true retorna mesma segunda", () => {
    // 2026-01-12 é segunda-feira
    const t = TjTime.fromString("2026-01-12-14:30:00");
    const result = t.beginOfWeek(true);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-12-00:00:00").toSeconds());
  });

  it("quarta-feira com startMonday=true retorna segunda anterior", () => {
    // 2026-01-14 é quarta-feira
    const t = TjTime.fromString("2026-01-14-10:00:00");
    const result = t.beginOfWeek(true);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-12-00:00:00").toSeconds());
  });

  it("sábado com startMonday=true retorna segunda anterior", () => {
    // 2026-01-17 é sábado
    const t = TjTime.fromString("2026-01-17-10:00:00");
    const result = t.beginOfWeek(true);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-12-00:00:00").toSeconds());
  });

  it("domingo com startMonday=true retorna segunda seguinte", () => {
    // 2026-01-18 é domingo
    const t = TjTime.fromString("2026-01-18-10:00:00");
    const result = t.beginOfWeek(true);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-19-00:00:00").toSeconds());
  });

  it("domingo com startMonday=false retorna domingo atual", () => {
    // 2026-01-18 é domingo
    const t = TjTime.fromString("2026-01-18-10:00:00");
    const result = t.beginOfWeek(false);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-18-00:00:00").toSeconds());
  });

  it("sábado com startMonday=false retorna domingo anterior", () => {
    // 2026-01-17 é sábado
    const t = TjTime.fromString("2026-01-17-10:00:00");
    const result = t.beginOfWeek(false);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-18-00:00:00").toSeconds());
  });
});

describe("TjTime.beginOfMonth", () => {
  it("dia do meio do mês retorna dia 1", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    const result = t.beginOfMonth();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });

  it("já no dia 1 mantém dia 1", () => {
    const t = TjTime.fromString("2026-01-01-14:30:45");
    const result = t.beginOfMonth();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });

  it("último dia do mês retorna dia 1", () => {
    const t = TjTime.fromString("2026-01-31-23:59:59");
    const result = t.beginOfMonth();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });

  it("zera horas, minutos e segundos", () => {
    const t = TjTime.fromString("2026-03-20-14:30:45");
    const result = t.beginOfMonth();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-03-01-00:00:00").toSeconds());
  });
});

describe("TjTime.beginOfQuarter", () => {
  it("janeiro (Q1) retorna janeiro", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    const result = t.beginOfQuarter();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });

  it("abril (Q2) retorna abril", () => {
    const t = TjTime.fromString("2026-04-15-14:30:45");
    const result = t.beginOfQuarter();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-04-01-00:00:00").toSeconds());
  });

  it("agosto (Q3) retorna julho", () => {
    const t = TjTime.fromString("2026-08-15-14:30:45");
    const result = t.beginOfQuarter();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-07-01-00:00:00").toSeconds());
  });

  it("novembro (Q4) retorna outubro", () => {
    const t = TjTime.fromString("2026-11-15-14:30:45");
    const result = t.beginOfQuarter();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-10-01-00:00:00").toSeconds());
  });
});

describe("TjTime.beginOfYear", () => {
  it("meio do ano retorna janeiro 1", () => {
    const t = TjTime.fromString("2026-06-15-14:30:45");
    const result = t.beginOfYear();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });

  it("já em janeiro 1 mantém", () => {
    const t = TjTime.fromString("2026-01-01-00:00:00");
    const result = t.beginOfYear();
    assertEquals(result.toSeconds(), t.toSeconds());
  });

  it("último dia do ano retorna janeiro 1", () => {
    const t = TjTime.fromString("2026-12-31-23:59:59");
    const result = t.beginOfYear();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });
});

describe("TjTime acessores", () => {
  it("wday() retorna dia da semana correto", () => {
    // 2026-01-12 é segunda-feira (weekday=1)
    const t = TjTime.fromString("2026-01-12-14:30:00");
    assertEquals(t.wday(), 1);
  });

  it("hour() retorna hora local", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    assertEquals(t.hour(), 14);
  });

  it("day() retorna dia do mês", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    assertEquals(t.day(), 15);
  });

  it("month() retorna mês", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    assertEquals(t.month(), 1);
  });

  it("year() retorna ano", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    assertEquals(t.year(), 2026);
  });
});

describe("TjTime.to_a", () => {
  it("retorna array [ano, mes, dia, hora, min, seg, weekday]", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    const result = t.to_a();
    assertEquals(result, [2026, 1, 15, 14, 30, 45, 4]);
  });
});
```

---

## Arquivo: `packages/core/deno.jsonc`

```json
{
  "name": "@syntaxmesh/core",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "dom.asynciterable", "esnext", "deno.ns", "deno.unstable"],
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true
  },
  "imports": {
    "@std/assert": "jsr:@std/assert@^1",
    "@std/testing/bdd": "jsr:@std/testing@^1/bdd"
  },
  "tasks": {
    "test": "deno test --allow-env --allow-net --allow-read --allow-write tests/",
    "check": "deno check src/**/*.ts tests/**/*.ts",
    "tests": "deno task check && deno task test"
  },
  "exports": {
    ".": "./src/mod.ts"
  }
}

```

---

