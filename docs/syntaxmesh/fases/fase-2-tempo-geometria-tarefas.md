# Fase 2 — Tarefas Atômicas (revisada com base no Ruby)

> **Arquivo:** `docs/syntaxmesh/fases/fase-02-tempo-geometria-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-02-tempo-geometria.md`
> **Status:** ⬜ Não iniciada
> **Total:** 142 tarefas (era 127)
> **Concluídas:** 0
> **Fonte Ruby revisada:** `TjTime.rb`, `Interval.rb`, `IntervalList.rb`, `Scoreboard.rb`, `WorkingHours.rb`, `RealFormat.rb`

---

## 0. Protocolo TDD (aplica-se a TODA tarefa)

1. **Escrever o teste** que falha (coluna *Verificação*)
2. `deno task test` → confirmar falha correta
3. **Implementar o mínimo** (coluna *Arquivos*)
4. `deno task test` → passa
5. `deno task check-all` → verde
6. **Commit atômico**: `feat(core): <descrição>`
7. Marcar `[x]` neste arquivo

**Regras:**
- ⚠️ `⚠️ RUBY: <arquivo>:<linha>` = **leia o Ruby antes**. Não invente comportamento.
- Tarefa com 2 verbos = quebre.
- Não caber em 2h = quebre.
- `check-all` falha em `fmt`/`lint` = não commitar.

**Comandos:**
```bash
deno task test
deno task check-all
deno task fmt && deno task lint
```

**Ordem:** 5.0 → 5.14 estritamente. 5.6 pode rodar em paralelo com 5.7–5.10.

---

## Progresso

```
[ ] 5.0  ADR 012                      —  0/5
[ ] 5.1  TjTime parsing               —  0/18
[ ] 5.2  TjTime aritmética            —  0/10
[ ] 5.3  TjTime normalizações         —  0/10
[ ] 5.4  TjTime avanços               —  0/12
[ ] 5.5  TjTime diferenças            —  0/8
[ ] 5.6  TjTime timezone + strftime   —  0/16
[ ] 5.7  Interval                     —  0/9
[ ] 5.8  TimeInterval                 —  0/6
[ ] 5.9  ScoreboardInterval           —  0/7
[ ] 5.10 IntervalList                 —  0/7
[ ] 5.11 Scoreboard                   —  0/12
[ ] 5.12 WorkingHours                 —  0/14
[ ] 5.13 RealFormat                   —  0/8
[ ] 5.14 Infra golden tests           —  0/9
─────────────────────────────────────────────
TOTAL: 142
```

---

## Bloco A — Fundação

### 5.0 — ADR 012 (`TjTime` em TypeScript)

*(inalterado — 5 tarefas)*

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.0.1 | Criar `decisoes/012-tjtime-typescript.md` | `decisoes/012-*.md` | tem frontmatter |
| 5.0.2 | Seção **Contexto** (Time/ENV['TZ']) | idem | — |
| 5.0.3 | Seção **Decisão** (representação, `Intl`, factory, strftime mínimo) | idem | — |
| 5.0.4 | **Alternativas** (Temporal/luxon) + **Consequências** | idem | — |
| 5.0.5 | Linha `012` em `decisoes/README.md` | `decisoes/README.md` | link funciona |

---

### 5.1 — `TjTime`: parsing

**⚠️ RUBY: `TjTime.rb:parse` (linhas ~289–380).** O algoritmo é `split('-', 5)` — **cinco** campos separados por hífen. Não use regex genérica.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.1.1 | Criar `tj-time.ts` classe vazia + construtor privado | `src/time/tj-time.ts` | `deno check` |
| 5.1.2 | Campo `private readonly time: number` (ms desde epoch) | idem | idem |
| 5.1.3 | `static fromSeconds(n)` + `static now()` + `toSeconds()` + 3 testes | idem + `tests/time/tj-time-parsing_test.ts` | 3 verdes |
| 5.1.4 | `static fromDate(d)` + `toDate()` + 2 testes | idem | idem |
| 5.1.5 | `static fromArray([y,m,d,h,min,s])` (usado por normalizações) + 2 testes | idem | idem |
| 5.1.6 | ⚠️ RUBY:parse. Implementar `private parse(str)` usando **`str.split('-', 5)`** e validar que há 3–5 partes. Erro se ≠. | idem | 4 testes cobrindo 3, 4, 5 partes e inválido |
| 5.1.7 | Validar **ano** `1970 <= y <= 2035`. Erro: `"Year #{y} out of range (1970 - 2035)"` | idem | 3 testes |
| 5.1.8 | Validar **mês** `1 <= m <= 12`. Erro: `"Month #{m} out of range (1 - 12)"` | idem | 3 testes |
| 5.1.9 | ⚠️ RUBY usa `Date.gregorian_leap?`. Implementar array local `maxDay[month]` (13 posições, índice 0 = 0) e `leapYear?` | idem | 5 testes (jan=31, fev=28, fev=29 bissexto, abr=30, jun=31) |
| 5.1.10 | Validar **hora** `0 <= h <= 23` (default 0). Erro: `"Hour #{h} out of range (0 - 23)"` | idem | 3 testes |
| 5.1.11 | Validar **minuto** `0 <= m <= 59` (default 0). Erro idem | idem | 3 testes |
| 5.1.12 | Validar **segundo** `0 <= s <= 59` (default 0) | idem | 3 testes |
| 5.1.13 | ⚠️ Se **sem timezone**: `Time.mktime(y, m, d, h, min, s)` (local). Comportamento de rollover do Ruby precisa ser replicado — `mktime(2024, 4, 31)` → `2024-05-01` | idem | 2 testes |
| 5.1.14 | ⚠️ Se **com timezone** `±HHMM`: validar 5 chars, primeiro char `+`/`-`, range `[-1200, +1400]`. Erro: `"Time zone adjustment out of range (-1200 - +1400} but is #{zone})"` (mantenha `}` no final — bug do Ruby) | idem | 5 testes (formato, prefixo, range, minuto inválido) |
| 5.1.15 | ⚠️ Com timezone: `Time.utc(...)` e **subtrair** o offset (não adicionar) | idem | 3 testes (`-0300`, `+0000`, `+1400`) |
| 5.1.16 | ⚠️ **NÃO** usar `strftime` para retornar erro. Ruby usa `TjException.new, "msg"`. Em TS, `TjArgumentError` | idem | 1 teste agregado |
| 5.1.17 | Adicionar `getOffsetSeconds(epochSecs, tz)` (Fase futura usa) | `src/time/timezone.ts` | 3 testes |
| 5.1.18 | `getLocalParts(epochSecs, tz)` retornando `{y,m,d,h,min,s,weekday}` | idem | 3 testes |

**Não fazer:** normalizações (5.3), avanços (5.4), timezone global (5.6).

---

### 5.2 — `TjTime`: comparação e aritmética

**⚠️ RUBY: `TjTime.rb` linhas ~95–160.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.2.1 | `addSeconds(n)` + `subSeconds(n)` + 3 testes | `src/time/tj-time.ts` + `tests/time/tj-time-arithmetic_test.ts` | 3 verdes |
| 5.2.2 | ⚠️ `diff(other)` retorna **segundos como number** (não ms) | idem | 2 testes |
| 5.2.3 | `modulo(n)` = `toSeconds() % n` | idem | 2 testes |
| 5.2.4 | ⚠️ `compareTo(other)` com **nil**: Ruby retorna `-1` se `other.nil?`. TS: `other: TjTime \| null` | idem | 2 testes |
| 5.2.5 | ⚠️ `lessThan(other)` com `nil` → `false`; `greaterThan(nil)` → `true`. Ruby trata nil como "infinito" | idem | 4 testes |
| 5.2.6 | `lessThanOrEqual`, `greaterThanOrEqual` seguem mesma regra | idem | 4 testes |
| 5.2.7 | `equals(other)` com nil → `false` | idem | 2 testes |
| 5.2.8 | ⚠️ `align(clock)` = `Math.floor(localtimeSecs / clock) * clock`. Usa **local time**, não UTC | idem | 3 testes (3600, 900, 60) |
| 5.2.9 | `upto(end, step=1, fn)` itera enquanto `t < end`. **Não** itera se `start >= end` | idem | 3 testes |
| 5.2.10 | Refatorar: extrair `private localSecs(): number` | idem | `check-all` |

---

### 5.3 — `TjTime`: normalizações

**⚠️ RUBY: `TjTime.rb` linhas ~165–225.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.3.1 | `beginOfHour()` — zera min+seg **em local time** | `src/time/tj-time.ts` + `tests/time/tj-time-normalize_test.ts` | 3 verdes |
| 5.3.2 | `midnight()` — zera h+m+s em local | idem | 3 verdes |
| 5.3.3 | ⚠️ `beginOfWeek(startMonday)`: implementar o **algoritmo exato** do Ruby (vai para **meio-dia**, subtrai `(weekday - (startMonday?1:0))` dias, depois `midnight`). Não simplificar para "subtrair dias de hoje". | idem | 6 testes (seg/qua/sáb/dom × flag) |
| 5.3.4 | ⚠️ **Edge case**: se domingo e `startMonday=true`, `weekday - 1 = -1`, ou seja, **adiciona** 1 dia antes de midnight. Testar. | idem | 1 teste |
| 5.3.5 | `beginOfMonth()` — zera h/m/s, dia=1 | idem | 4 testes |
| 5.3.6 | `beginOfQuarter()` — month = `((m-1) % 3) + 1` | idem | 4 testes |
| 5.3.7 | `beginOfYear()` — zera h/m/s, dia=month=1 | idem | 3 testes |
| 5.3.8 | `wday()`, `hour()`, `day()`, `month()`, `year()` — acessores via `localtime` | idem | 5 testes |
| 5.3.9 | ⚠️ Todas operam em **timezone local** (`currentTimeZone`). Teste com `America/Sao_Paulo` | idem | 1 teste (bloqueado: 5.6) |
| 5.3.10 | `to_a()` retorna `[y, m, d, h, min, s, weekday]` — usado por normalizações | idem | 1 teste |

---

### 5.4 — `TjTime`: avanços (`sameTimeNext*`)

**⚠️ CRÍTICO: `TjTime.rb` linhas ~230–285.** Comportamento **diferente** do que parece à primeira vista. **Ler o Ruby antes de codificar.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.4.1 | `hoursLater(h)` = `addSeconds(h * 3600)` | `src/time/tj-time.ts` + `tests/time/tj-time-advance_test.ts` | 2 testes |
| 5.4.2 | `sameTimeNextHour()` = `hoursLater(1)` | idem | 2 testes |
| 5.4.3 | `sameTimeNextDay()`: `day += 1`; se `day > lastDayOfMonth(month, year)`, `day = 1` e `month += 1`; se `month > 12`, `month = 1`, `year += 1`. Usa `localtime.to_a` | idem | 5 testes |
| 5.4.4 | ⚠️ **`sameTimeNextWeek()` NÃO É `+7 dias`**. É `day += 7` com overflow de **no máximo 1 mês**. Ex: `28/jan + 7 = 35 > 31 → 4/fev`. `25/jan + 7 = 32 > 31 → 1/fev` | idem | 5 testes |
| 5.4.5 | ⚠️ `sameTimeNextMonth()`: captura `monMax = (month==2 && leap) ? 29 : MON_MAX[month]` (do mês **ANTIGO**). Avança mês. Se `day >= lastDayOfMonth(newMonth)`, `day = monMax`. **Este algoritmo tem bug**: `31/jan → monMax=31, day=31, new=2 → lastDayOfMonth(2,2024)=29, day>=29, day=31 → rollover março 2`. Replicar **exatamente** | idem | 6 testes (todos os meses) |
| 5.4.6 | ⚠️ **`sameTimeNextQuarter()` SEM CLAMP**: `month += 3`, se `> 12` subtrai 12 e `year += 1`. **Não mexe em `day`**. `31/jan → 31/abr` → `Time.mktime(2024,4,31)` → `1/mai` (rollover) | idem | 4 testes |
| 5.4.7 | ⚠️ **`sameTimeNextYear()` SEM CLAMP**: `year += 1`. `29/fev/2024 → 1/mar/2025` (rollover) | idem | 3 testes |
| 5.4.8 | `nextDayOfWeek(dow)`: `d = midnight.sameTimeNextDay` (sempre **pelo menos amanhã**); `currentDoW = d.wday`; itera `(dow + 7 - currentDoW) % 7` vezes `sameTimeNextDay` | idem | 5 testes |
| 5.4.9 | Validação `nextDayOfWeek`: `dow ∈ [0,6]` senão erro `"Day of week must be 0 - 6."` | idem | 1 teste |
| 5.4.10 | Todas as normalizações preservam h/min/s | idem | 1 teste |
| 5.4.11 | `lastDayOfMonth(month, year)`: `month==2 && leapYear? ? 29 : MON_MAX[month]` | idem | 3 testes |
| 5.4.12 | `leapYear?(year)`: 400 → true; 100 → false; 4 → true | idem | 5 testes (2000, 1900, 2024, 2100, 2400) |

---

### 5.5 — `TjTime`: diferenças (`*To`)

**⚠️ RUBY: `TjTime.rb` linhas ~290–320.** Todos usam `countIntervals` com `order()` (simétrico).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.5.1 | `private order(date)`: retorna `[menor, maior]` | `src/time/tj-time.ts` + `tests/time/tj-time-diff_test.ts` | 1 teste |
| 5.5.2 | `private countIntervals(date, stepFn)`: itera `sameTimeNext*` até `t1 >= t2` | idem | 1 teste |
| 5.5.3 | `hoursTo(date)`: `Math.ceil((t2 - t1) / 3600)` | idem | 3 testes |
| 5.5.4 | `daysTo(date)`: `countIntervals(date, 'sameTimeNextDay')` — **simétrico** | idem | 4 testes |
| 5.5.5 | `weeksTo(date)` — simétrico | idem | 2 testes |
| 5.5.6 | `monthsTo(date)` — simétrico | idem | 4 testes |
| 5.5.7 | `quartersTo(date)`, `yearsTo(date)` | idem | 4 testes |
| 5.5.8 | Teste agregado: `a.daysTo(b) === b.daysTo(a)` para 20 pares | idem | 1 teste |

---

### 5.6 — `TjTime`: timezone + strftime

**⚠️ RUBY: `TjTime.rb` linhas ~55–85, 240–280, 330–370.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.6.1 | `isValidTimeZone(zone)` via `Intl.DateTimeFormat` (tentar construir, catch) | `src/time/timezone.ts` + `tests/time/timezone_test.ts` | 4 testes |
| 5.6.2 | `checkTimeZone(zone)`: `'UTC' → true`; sem `/` → `false` | `src/time/tj-time.ts` + `tests/time/tj-time-timezone_test.ts` | 3 testes |
| 5.6.3 | `getOffsetSeconds(epochSecs, tz)`: via `Intl` (partes locais - UTC) | `src/time/timezone.ts` | 3 testes |
| 5.6.4 | Estado module-level `currentTz = 'UTC'`; `getTimeZone()`; `setTimeZone(tz)` retorna anterior | `src/time/tj-time.ts` | 3 testes |
| 5.6.5 | `static checkTimeZone(tz)` (estático, distinto de instance) | idem | 2 testes |
| 5.6.6 | `localtime(): Parts` (via `getLocalParts(toSeconds(), currentTz)`) | idem | 3 testes |
| 5.6.7 | `gmtime(): Parts` (UTC) | idem | 2 testes |
| 5.6.8 | `utc(): TjTime` — retorna **novo** TjTime com partes UTC (não muda currentTz) | idem | 3 testes |
| 5.6.9 | `secondsOfDay(tz?)`: `(epochSecs + offset) % 86400` | idem | 3 testes |
| 5.6.10 | `strftime(fmt, tz?)` **mínimo**: `%Y %m %d %H %M %S %A %a %B %b %z %Q` + `%%` | idem | 8 testes |
| 5.6.11 | `strftime` com `%Q` = `((month-1)/3)+1` (quarter, extensão TJ) | idem | 4 testes |
| 5.6.12 | `strftime` com `%z`: `+0000` / `-0300` / `+1400` | idem | 3 testes |
| 5.6.13 | `strftime` com formato inválido lança `TjArgumentError` (não Ruby's `strftime` silencioso) | idem | 1 teste |
| 5.6.14 | ⚠️ `to_s(fmt?, tz?)`: usa **`this.time.sec` (original)** para decidir se inclui `:%S` no formato default. Não usa `localtime().s` | idem | 2 testes |
| 5.6.15 | `to_s` formato default: `'%Y-%m-%d-%H:%M' + (sec==0 ? '' : ':%S') + '-%z'` | idem | 3 testes |
| 5.6.16 | `to_s` com `tz='UTC'`: usa `gmtime`, senão `localtime` | idem | 2 testes |

---

## Bloco B — Geometria

### 5.7 — `Interval` genérico

**⚠️ RUBY: `Interval.rb` linhas ~18–100.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.7.1 | Classe `Interval<S, E>` com `readonly start/end`; valida `end >= start` (erro: `"Invalid interval (#{s} - #{e})"`) | `src/time/interval.ts` + `tests/time/interval_test.ts` | 2 testes |
| 5.7.2 | ⚠️ `contains(arg)`: **lança `TjArgumentError` se `self.constructor !== arg.constructor`**. Para `Interval`, requer `start <= arg.start && arg.end <= end`. Para valor, requer `start <= arg && arg < end` | idem | 4 testes |
| 5.7.3 | ⚠️ `overlaps(arg)`: mesma checagem de classe. Para `Interval`: `(start <= arg.start && arg.start < end) \|\| (arg.start <= start && start < arg.end)`. Para valor: idêntico a `contains` | idem | 5 testes |
| 5.7.4 | `intersection(other)`: `newStart = max`, `newEnd = min`; retorna `null` se `newStart >= newEnd` | idem | 4 testes |
| 5.7.5 | ⚠️ **`combine(iv)` retorna `[Interval]` (Array com 1 elemento)**, não `Interval`. É um **bug do Ruby** mas replicamos. Se `iv.end === start`: `[new(iv.start, end)]`. Se `end === iv.start`: `[new(start, iv.end)]`. Senão: retorna `this` (não Array) | idem | 4 testes |
| 5.7.6 | ⚠️ `compareTo(iv)`: retorna `-1` se `end < iv.start`, `1` se `iv.end < start`, **`0` se sobrepõe** (não lança) | idem | 4 testes |
| 5.7.7 | `equals(iv)`: mesma classe E start/end iguais | idem | 3 testes |
| 5.7.8 | ⚠️ Todos os métodos com checagem de classe: `if (self.constructor !== arg.constructor) throw TjArgumentError('Class mismatch')` | idem | 1 teste com subclasse |
| 5.7.9 | Refatorar: extrair `private checkClass(arg)` | idem | `check-all` |

---

### 5.8 — `TimeInterval`

**⚠️ RUBY: `Interval.rb` linhas ~115–160.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.8.1 | ⚠️ Constructor **variádico**: 1 arg (TjTime → `[arg, arg]`; TimeInterval → cópia) ou 2 args (ambos TjTime). Erro se outro | `src/time/time-interval.ts` + `tests/time/time-interval_test.ts` | 4 testes |
| 5.8.2 | Erros: `"Illegal argument 1: #{class}"`, `"Interval start must be a date, not a #{class}"`, `"Too many arguments: #{n}"` | idem | 3 testes |
| 5.8.3 | `duration(): number` em **segundos** (`end.diff(start)`) | idem | 3 testes |
| 5.8.4 | `to_s()`: `"#{start.to_s()} - #{end.to_s()}"` | idem | 1 teste |
| 5.8.5 | Setters `start=` / `end=` (mutável — diferente de `Interval`) | idem | 2 testes |
| 5.8.6 | `static fromSingle(t)`, `static fromInterval(iv)` | idem | 2 testes |

---

### 5.9 — `ScoreboardInterval`

**⚠️ RUBY: `Interval.rb` linhas ~165–260.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.9.1 | ⚠️ Constructor **variádico**: 1 arg (copy), 3 args (`sbStart, slotDuration, single`), 4 args (`sbStart, slotDuration, start, end`) | `src/time/scoreboard-interval.ts` + `tests/time/scoreboard-interval_test.ts` | 4 testes |
| 5.9.2 | Validar `sbStart: TjTime`, `slotDuration: number` (int), `start/end: number \| TjTime` | idem | 3 testes |
| 5.9.3 | `dateToIndex(date)`: `(date.diff(sbStart)) / slotDuration` (divisão **inteira**) | idem | 2 testes |
| 5.9.4 | `indexToDate(idx)`: `sbStart.addSeconds(idx * slotDuration)` | idem | 2 testes |
| 5.9.5 | `startDate()`, `endDate()`, `duration()` | idem | 3 testes |
| 5.9.6 | Setters `start=` / `end=` aceitam `TjTime \| number` | idem | 3 testes |
| 5.9.7 | `to_s()` usa `indexToDate(...).to_s()` | idem | 1 teste |

---

### 5.10 — `IntervalList`

**⚠️ RUBY: `IntervalList.rb` linhas ~17–100.**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.10.1 | Classe `IntervalList<T>` estende `Array<T>` com `[Symbol.species] = Array` | `src/time/interval-list.ts` + `tests/time/interval-list_test.ts` | 2 testes |
| 5.10.2 | `append(iv)` — alias de `Array.push` (não usa `<<`) | idem | 1 teste |
| 5.10.3 | ⚠️ `<<(iv)` sobrescrito: se `iv.start < last.end` → **lança** `"Intervals may not overlap and must be added in ascending order."`. Se `iv.start === last.end` → **merge** (substitui `last` por `new(last.start, iv.end)`). Senão, `push` | idem | 4 testes |
| 5.10.4 | ⚠️ `intersect(other)`: algoritmo com **6 branches** do Ruby. **Não** usar `Set` ou mapa. Ler as linhas 20–75 do Ruby e replicar | idem | 8 testes (todas as combinações) |
| 5.10.5 | Revisar: `intersect` retorna `IntervalList` **vazia** se não há sobreposição | idem | 1 teste |
| 5.10.6 | Teste de fumaça: mesclar 100 intervalos ascendentes | idem | 1 teste |
| 5.10.7 | Refatorar: extrair `private addCase(...)` para os branches | idem | `check-all` |

---

### 5.11 — `Scoreboard` genérico

**⚠️ RUBY: `Scoreboard.rb` (~180 linhas).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.11.1 | ⚠️ Constructor: `size = Math.ceil((end - start) / resolution) + 1` — **CEIL**, não floor. `clear(initVal?)` preenche `data: T[]` | `src/time/scoreboard.ts` + `tests/time/scoreboard_test.ts` | 3 testes |
| 5.11.2 | ⚠️ `idxToDate(idx, forceIntoProject=false)`: **BUG no Ruby** (`kdx` typo no branch negativo). **Corrigir em TS**: se `forceIntoProject` e `idx < 0` → `startDate`. Se `idx >= size` → `endDate`. Senão, lança `"Index #{idx} is out of scoreboard range (#{size-1})"`. Documentar desvio do Ruby | idem | 4 testes |
| 5.11.3 | `dateToIdx(date, forceIntoProject=true)`: `Math.trunc((date - startDate) / resolution)`. Se `forceIntoProject`: clampa em `0` e `size-1`. Senão, lança | idem | 4 testes |
| 5.11.4 | `get(idx)` / `set(idx, val)` / `clear(val?)` | idem | 3 testes |
| 5.11.5 | `each(startIdx?, endIdx?)` — iterador com range | idem | 3 testes |
| 5.11.6 | `each_index()` | idem | 2 testes |
| 5.11.7 | `collect!(fn)` — in-place | idem | 2 testes |
| 5.11.8 | ⚠️ `collectIntervals(iv, minDuration, predicate)`: algoritmo do Ruby com **sentinel `start === 0`** (bug: slot 0 nunca é início válido). Replicar **exatamente** | idem | 6 testes |
| 5.11.9 | `length()` = `size` | idem | 1 teste |
| 5.11.10 | `inspect()` — debug, lista `idx: date: value` | idem | 1 teste |
| 5.11.11 | Refatorar: tipo genérico `T` — não usar `any` | idem | `check-all` |
| 5.11.12 | Nota: `Scoreboard<number>` (Fase 6) e `Scoreboard<number \| null>` (Fase 6) devem funcionar | idem | 1 teste de tipos |

---

### 5.12 — `WorkingHours`

**⚠️ RUBY: `WorkingHours.rb` (~250 linhas).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.12.1 | ⚠️ Constructor **variádico**: 1 arg (`WorkingHours` → cópia) ou 4 args (`slotDuration, startDate, endDate, timeZone`). `@days` inicializado com **default seg-sex 9-17** (não vazio!) | `src/calendar/working-hours.ts` + `tests/calendar/working-hours_test.ts` | 4 testes |
| 5.12.2 | ⚠️ `@days` é `[ [], [[9h, 17h]], [[9h, 17h]], ..., [], [] ]` (7 entradas, [0] e [6] vazios) | idem | 2 testes |
| 5.12.3 | ⚠️ Em TS, **usar arrays únicos** (`Array.from({length: 7}, () => [])`). O Ruby compartilha o mesmo array vazio para dom e sáb — replicar para compatibilidade | idem | 1 teste |
| 5.12.4 | Construtor de cópia: deep copy de `days` (cada intervalo duplicado), `timezone`, `startDate`, `endDate`, `slotDuration`. `scoreboard` é **compartilhado** (copy-on-write: seta `null` em qualquer setter) | idem | 3 testes |
| 5.12.5 | `setWorkingHours(dayOfWeek, intervals)`: valida `0 <= day <= 6`, `0 <= iv[0] < iv[1] <= 86400`. Erros: `"dayOfWeek out of range"`, `"Interval end time must be larger than start time"` | idem | 6 testes |
| 5.12.6 | ⚠️ **`setWorkingHours` zera `scoreboard`** (copy-on-write). Idem para `timezone=`. Manter | idem | 2 testes |
| 5.12.7 | `getWorkingHours(day)` retorna o array do dia | idem | 2 testes |
| 5.12.8 | ⚠️ `onShift?(arg: TjTime \| number)`: aceita ambos. `initScoreboard` lazy. `TjTime` → `dateToIdx`, número → índice direto | idem | 5 testes |
| 5.12.9 | ⚠️ `timeOff?(iv: TimeInterval)`: itera `startIdx..endIdx-1`. Retorna `true` se **todos** os slots são `false` (não-working). Diferente do que parece | idem | 3 testes |
| 5.12.10 | `weeklyWorkingHours()`: soma `(iv[1] - iv[0])` por dia / 3600 | idem | 3 testes |
| 5.12.11 | ⚠️ `initScoreboard`: **troca timezone global temporariamente** (`TjTime.setTimeZone(@timezone)`) durante o cálculo e restaura. Replicar. Usa `wday` e `secondsOfDay` locais | idem | 3 testes |
| 5.12.12 | `==(wh)`: compara timezone, startDate, endDate, slotDuration, cada intervalo de cada dia | idem | 4 testes |
| 5.12.13 | `deepClone()` = `new WorkingHours(this)` | idem | 2 testes |
| 5.12.14 | `to_s()` — usado em debug | idem | 1 teste |

---

### 5.13 — `RealFormat`

**⚠️ RUBY: `RealFormat.rb` (~120 linhas).**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.13.1 | Constructor: `(args: [string, string, string, string, number] \| RealFormat)`. Valida `args.length === 5` senão `"Bad number of parameters #{n}"` | `src/format/real-format.ts` + `tests/format/real-format_test.ts` | 3 testes |
| 5.13.2 | ⚠️ `format(n)` — algoritmo: `|n| * 10^digits`, `round()`, `to_i`, `toString()`. Pad com `'0' * (digits - len + 1)` se len <= digits. Split em intPart e fracPart | idem | 4 testes |
| 5.13.3 | ⚠️ Separador de milhar: inserção manual iterando da direita, inserindo a cada 3 **se `i < intPart.length`** (último grupo pode ter 1-3 dígitos) | idem | 5 testes |
| 5.13.4 | `fractionDigits = 0` → sem fracPart | idem | 2 testes |
| 5.13.5 | `signPrefix` (negativos) — se `n < 0`, prepend | idem | 3 testes |
| 5.13.6 | `signSuffix` (negativos) — se `n < 0`, append | idem | 3 testes |
| 5.13.7 | Copy constructor + `to_s()` | idem | 2 testes |
| 5.13.8 | ⚠️ `round()` do Ruby: `2.5.round = 3` (half-up, não banker's). Usar `Math.round` do TS (também half-up) | idem | 3 testes |

---

## Bloco C — Golden tests

### 5.14 — Infraestrutura de golden tests

*(inalterado — 9 tarefas, apenas ajustar escopos)*

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.14.1 | `scripts/golden/README.md` | idem | — |
| 5.14.2 | `scripts/golden/tjtime.rb` — parsing + normalizações (30 casos) | idem | JSON válido |
| 5.14.3 | Estender com avanços + diffs (60 casos) | idem | ≥ 60 |
| 5.14.4 | `scripts/golden/working-hours.rb` (3 configs × 5 checks) | idem | JSON válido |
| 5.14.5 | Task `golden:generate` | `deno.jsonc` | roda |
| 5.14.6 | `tjtime_golden_test.ts` | idem | verde |
| 5.14.7 | `working-hours_golden_test.ts` | idem | verde |
| 5.14.8 | Mensagens claras em divergências | idem | 3 testes |
| 5.14.9 | Commitar JSONs em `packages/core/tests/golden/` | idem | versionado |

---

## Notas para a IA (revisadas)

1. **Leia o Ruby antes.** Toda tarefa com `⚠️ RUBY` = ler arquivo antes de escrever teste.
2. **`split('-', 5)`** — parsing do TjTime é limitado a 5 partes.
3. **`sameTimeNextWeek` não é `+7d`.** Tem lógica própria.
4. **`sameTimeNextQuarter` e `sameTimeNextYear` não clampam.** Confie no rollover.
5. **`sameTimeNextMonth` tem bug.** Replicar.
6. **`combine` retorna `[Interval]`.** Replicar.
7. **`compareTo` sobreposto retorna 0.**
8. **`Scoreboard.size` usa `ceil`** e `idxToDate` tem bug `kdx`.
9. **`WorkingHours.@days` compartilha array vazio** entre dom/sáb.
10. **`strftime` é mínimo.** Formato fora da lista → `TjArgumentError`.
11. **`to_s` usa `@time.sec` original**, não `localtime().s`.
12. **`IntervalList.&` tem 6 branches.** Ler o Ruby.
13. **Testes golden só depois** de toda a implementação verde.
14. **Sem `any`.** Use `unknown` + narrowing.
15. **Commit por subfase.**

---

**Fim do arquivo de tarefas da Fase 2 (revisada).**