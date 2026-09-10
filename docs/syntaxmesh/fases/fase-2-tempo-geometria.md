# Fase 2 — Tempo e Geometria

> **Arquivo:** `docs/syntaxmesh/fases/fase-2-tempo-geometria.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 5–7 dias
> **Depende de:** Fase 1 — Fundação
> **Bloqueia:** Fases 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 15, 18

---

## 1. Contexto

**Tudo** no TaskJuggler é baseado em tempo. Datas de tarefas, intervalos de booking, working hours, leaves, granularidade de scheduling, calendários — todos dependem de uma representação temporal robusta, precisa e alinhada com o comportamento do TaskJuggler original.

O `TjTime` do TaskJuggler **não usa `Date` do Ruby**. Ele usa `Time` internamente (segundos desde epoch), com suporte a timezones via `ENV['TZ']`, e implementa várias operações que não existem na biblioteca padrão:

- `sameTimeNextDay`, `sameTimeNextWeek`, `sameTimeNextMonth`, `sameTimeNextQuarter`, `sameTimeNextYear`
- `beginOfWeek(startMonday)`, `beginOfMonth`, `beginOfQuarter`, `beginOfYear`
- `align(clock)` para alinhar com granularidade de scheduling
- `daysTo`, `weeksTo`, `monthsTo` (contagem de intervalos, não aritmética simples)
- Parsing de datas no formato `YYYY-MM-DD[-HH:MM[:SS]][-TZ]`
- Suporte a timezone `±HHMM`

Ao redor do `TjTime` existem estruturas geométricas: `Interval`, `TimeInterval`, `ScoreboardInterval`, `IntervalList`, `WorkingHours`, `Scoreboard`.

Esta fase porta **fielmente** essas classes para TypeScript. Não há lógica de negócio aqui — apenas primitivas de tempo que todas as fases seguintes usam.

**Nota crítica:** erros nesta fase se propagam para todo o sistema. O comportamento do `TjTime` deve ser idêntico ao Ruby — incluindo edge cases de leap year, DST, e mudança de mês. **Golden tests contra `tj3` são obrigatórios.**

---

## 2. Objetivo

Ao final desta fase:

- `TjTime` implementa toda a API do `TjTime.rb` Ruby (parsing, normalizações, avanços, diferenças, timezone).
- `Interval`, `TimeInterval`, `ScoreboardInterval` portados.
- `IntervalList` com interseção e merge.
- `Scoreboard` genérico (base para WorkingHours, Limits, ShiftAssignments).
- `WorkingHours` com scoreboard interno.
- `RealFormat` para formatação de números e moeda.
- **≥ 150 testes unitários** + **≥ 50 golden tests** contra `tj3`.
- ADR 012 registrado.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `TjTime.rb` | ~470 | Alta | **Crítica** |
| `Interval.rb` | ~290 | Média | **Crítica** |
| `IntervalList.rb` | ~130 | Média | **Crítica** |
| `Scoreboard.rb` | ~180 | Média | **Crítica** |
| `WorkingHours.rb` | ~250 | Alta | **Crítica** |
| `RealFormat.rb` | ~120 | Baixa | Alta |
| `TjException.rb` | ~30 | Baixa | Alta |

### 3.2 Blueprints (fonte secundária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/02-bluprint-engine1.md` | §6 TjTime | Referência consolidada |
| `docs/tj3-engine/02-bluprint-engine1.md` | §2.6 Scoreboards | Uso do Scoreboard |
| `docs/tj3-engine/05-blueprint-engine4.md` | §4 ShiftAssignments | Encoding de bits |

### 3.3 Golden tests (via `tj3`)

Como `tj3` está instalado (Ruby gem), podemos gerar referências executando Ruby diretamente com a gem `taskjuggler`. Isso permite comparar o comportamento de `TjTime` sem depender do parser TJP (que só existirá na Fase 10).

Ver subfase 5.14 para detalhes da infraestrutura.

---

## 4. Decisões de port (Ruby → TypeScript)

Estas decisões **não estão no código Ruby** — são adaptações necessárias para TypeScript. Cada uma deve virar um ADR ou ser registrada aqui.

### 4.1 Representação interna

| Aspecto | Ruby | TypeScript |
|---|---|---|
| Armazenamento | `Time` (segundos desde epoch, com frações) | `number` (segundos desde epoch, inteiro) |
| Precisão | Segundos + nanossegundos | Segundos (granularidade mínima é 1 min) |
| Tipo de retorno | `TjTime` | `TjTime` (classe própria) |

**Decisão:** `TjTime` armazena `private readonly seconds: number`. Nunca expõe `Date` diretamente.

### 4.2 Timezone

Ruby manipula `ENV['TZ']` globalmente. TypeScript não pode. Alternativas:

- **`Temporal` (proposal)** — ideal, mas ainda não estável no Deno.
- **`Intl.DateTimeFormat`** — estável, mas requer workaround para obter offset.
- **`luxon` ou `date-fns-tz`** — dependência externa.

**Decisão:** usar `Intl.DateTimeFormat` com um helper próprio `getOffsetSeconds(epochSeconds, timeZone)`. Sem dependência externa.

**Consequência:** `TjTime` tem um `currentTimeZone` global (module-level state). `setTimeZone(zone)` altera esse estado e retorna o anterior.

### 4.3 Construtor polimórfico

Ruby tem construtor com `case t ... when nil, Time, TjTime, String, Array, else`. TypeScript não suporta overload real de construtor.

**Decisão:** usar **factory methods estáticos** em vez de construtor polimórfico:

```ts
class TjTime {
  private constructor(private readonly seconds: number) {}

  static now(): TjTime
  static fromSeconds(secs: number): TjTime
  static fromString(str: string): TjTime
  static fromParts(year, month, day, hour, min, sec, tz?): TjTime
  static fromDate(date: Date): TjTime
}
```

### 4.4 Imutabilidade

`TjTime` é **imutável** em Ruby (todas as operações retornam novo `TjTime`). Manter isso em TS.

`Interval` também é imutável exceto por `TimeInterval` (que tem setters em Ruby). Em TS, **manter imutável**.

`IntervalList` herda de `Array` em Ruby. Em TS, **estender `Array<T>`** mas com `[Symbol.species] = Array` para evitar bugs de `map`/`filter`.

### 4.5 `deep_clone` e cópia

Ruby usa `deep_clone`. Para `WorkingHours`, o Ruby tem um construtor de cópia: `WorkingHours.new(existing)`.

**Decisão:** implementar **construtor de cópia explícito** para `WorkingHours` e `Scoreboard`. Não usar `structuredClone` cegamente (perde referências).

### 4.6 Exceptions

Criar `TjError` (base) e subclasses:

- `TjError extends Error`
- `TjArgumentError extends TjError` — erros de validação de argumentos
- `TjRuntimeError extends TjError` — erros em runtime

### 4.7 `strftime` mínimo

Ruby tem `strftime` completo + `%Q` (quarter, extensão TJ). TypeScript não tem `strftime` nativo.

**Decisão:** implementar um `strftime` **mínimo** suportando **apenas os formatos usados pelo TaskJuggler**:

`%Y`, `%m`, `%d`, `%H`, `%M`, `%S`, `%A`, `%a`, `%B`, `%b`, `%z`, `%Q`.

Formatos fora dessa lista lançam `TjArgumentError` com mensagem clara. Se no futuro o TJ passar a usar outros formatos, expandir.

---

## 5. Subfases detalhadas

Cada subfase segue `docs/syntaxmesh/fases/modelo-tarefas.md`.

---

### 5.0 — ADR 012 (`TjTime` em TypeScript)

#### Contexto

O `TjTime.rb` usa `Time` do Ruby + `ENV['TZ']` global. TypeScript não tem equivalente direto. As decisões de representação, timezone e parsing precisam ser registradas formalmente antes de começar a implementar.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/012-tjtime-typescript.md` seguindo o template padrão.

#### Arquivos

- `docs/syntaxmesh/decisoes/012-tjtime-typescript.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] Seguir o template de `decisoes/README.md`.
- [ ] **Contexto:** mencionar `Time`/`ENV['TZ']` e a limitação do TS.
- [ ] **Decisão:**
  - Representação interna: `seconds: number` (inteiro, segundos desde epoch UTC).
  - Timezone: `currentTimeZone` module-level + helper `Intl.DateTimeFormat`.
  - Factory methods estáticos em vez de construtor polimórfico.
  - `strftime` mínimo (`%Y %m %d %H %M %S %A %a %B %b %z %Q`).
- [ ] **Alternativas consideradas:** `Temporal`, `luxon`, `date-fns-tz`.
- [ ] **Consequências:** performance (cacheável), precisão (segundos), sem dependência externa.
- [ ] Tabela em `README.md` atualizada com ID 012.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjTime.rb`
- `docs/syntaxmesh/decisoes/README.md`
- Seção 4 deste documento

#### Fora de escopo

- ADRs para subclasses de `Interval` — decisões são locais.

#### Critério de aceite

- ADR 012 criado seguindo o template.
- Tabela de ADRs atualizada.

#### Testes

- Nenhum teste automatizado. Validação manual do formato.

---

### 5.1 — `TjTime`: representação, factory methods e parsing

#### Contexto

`TjTime` é a primitiva temporal de todo o sistema. Sem ele, nada funciona. Esta subfase cobre a representação interna, factory methods estáticos e parsing de strings no formato TaskJuggler.

#### Objetivo

Implementar `TjTime` com:
- Representação interna (`seconds: number`).
- Factory methods: `now`, `fromSeconds`, `fromString`, `fromDate`, `fromParts`.
- Parsing de string `YYYY-MM-DD[-HH:MM[:SS][-TZ]]` com validações.
- Acesso a `toSeconds`, `toDate` (debug).

#### Arquivos

- `packages/core/src/time/tj-time.ts`
- `packages/core/tests/time/tj-time-parsing_test.ts`

#### Requisitos

- [ ] Classe `TjTime` com construtor **privado**.
- [ ] `static now(): TjTime` — retorna tempo atual.
- [ ] `static fromSeconds(secs: number): TjTime` — sem validação de range.
- [ ] `static fromDate(date: Date): TjTime` — converte via `getTime() / 1000`.
- [ ] `static fromString(str: string): TjTime` — parsing completo.
- [ ] `static fromParts(y, m, d, h?, min?, s?, tz?): TjTime` — construção via partes.
- [ ] `toSeconds(): number`.
- [ ] `toDate(): Date` — para debug (retorna cópia).
- [ ] Parsing de `str`:
  - Split por `-`, máximo 5 partes.
  - `[year, month, day, time?, zone?]`.
  - Validação:
    - `year` entre 1970 e 2035.
    - `month` entre 1 e 12.
    - `day` válido para o mês (usar `lastDayOfMonth`).
    - `time` opcional, formato `HH:MM` ou `HH:MM:SS`.
    - `zone` opcional, formato `±HHMM` (5 chars), entre `-1200` e `+1400`.
  - Se `zone` presente: converte para UTC subtraindo o offset.
  - Se `zone` ausente: usa `currentTimeZone` do módulo.
- [ ] Cada erro lança `TjArgumentError` com mensagem clara (mesma do Ruby quando possível).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjTime.rb` — método `parse` (privado).
- `docs/taskjuggler/lib/taskjuggler/TjTime.rb` — `MON_MAX`.
- `docs/tj3-engine/02-bluprint-engine1.md` — §6.2 Parsing de Datas.

#### Fora de escopo

- Comparação e aritmética (subfase 5.2).
- Normalizações (5.3).
- Timezone global (5.6).

#### Critério de aceite

```ts
TjTime.fromString("2026-01-01").toSeconds() === /* epoch correto */
TjTime.fromString("2026-01-01-09:00").toSeconds() === /* ... */
TjTime.fromString("2026-01-01-09:00:00-0300").toSeconds() === /* ... */
TjTime.fromString("2036-01-01") // TjArgumentError
TjTime.fromString("2026-13-01") // TjArgumentError
TjTime.fromString("2026-02-30") // TjArgumentError
TjTime.fromString("2026-01-01-25:00") // TjArgumentError
```

#### Testes

`tj-time-parsing_test.ts`:

- `describe("TjTime.fromString")`
  - `it("parseia YYYY-MM-DD")` — 5 datas válidas.
  - `it("parseia YYYY-MM-DD-HH:MM")` — 3 variações.
  - `it("parseia YYYY-MM-DD-HH:MM:SS")`.
  - `it("parseia com timezone ±HHMM")` — `-0300`, `+0000`, `+1400`, `-1200`.
  - `it("rejeita ano < 1970")` / `> 2035`.
  - `it("rejeita mês inválido")`.
  - `it("rejeita dia inválido para o mês")` — 30/02, 31/04, etc.
  - `it("rejeita hora inválida")` — 24:00, 25:00.
  - `it("rejeita minuto inválido")`.
  - `it("rejeita timezone fora do range")` — `+1500`, `-1300`.
  - `it("rejeita timezone mal formatado")` — `-03`, `-03000`.
  - `it("rejeita formato geral inválido")` — `01-01-2026`, `abc`.
- `describe("TjTime.fromSeconds")`
  - `it("retorna instância com os segundos")`.
- `describe("TjTime.now")`
  - `it("retorna tempo próximo ao atual")`.
- `describe("TjTime.fromParts")`
  - `it("constrói a partir de partes")` — 5 variações.

**Nota:** os testes de timezone exigem que `currentTimeZone` esteja setado. Como a subfase 5.6 ainda não existe, os testes de timezone explícita (`-0300`) podem usar offset direto.

---

### 5.2 — `TjTime`: comparação e aritmética

#### Contexto

`TjTime` precisa ser comparável e suportar operações aritméticas. Também precisa iterar (`upto`).

#### Objetivo

Implementar:
- Comparações: `<`, `<=`, `>`, `>=`, `==`, `<=>`, `!=`.
- Aritmética: `+seconds`, `-seconds`, `-tjtime` (retorna delta).
- `%value` (módulo).
- `upto(end, step)` — iteração.

#### Arquivos

- `packages/core/src/time/tj-time.ts` (estender)
- `packages/core/tests/time/tj-time-arithmetic_test.ts`

#### Requisitos

- [ ] Métodos explícitos (TS não permite sobrecarga de operadores):
  - `addSeconds(secs: number): TjTime`
  - `subSeconds(secs: number): TjTime`
  - `diff(other: TjTime): number` — diferença em segundos.
  - `modulo(val: number): number`
  - `compareTo(other: TjTime): -1 | 0 | 1`
  - `equals(other: TjTime): boolean`
  - `lessThan(other: TjTime): boolean`
  - `lessThanOrEqual(other: TjTime): boolean`
  - `greaterThan(other: TjTime): boolean`
  - `greaterThanOrEqual(other: TjTime): boolean`
- [ ] `upto(end: TjTime, step: number, fn: (t: TjTime) => void): void`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjTime.rb` — métodos `+`, `-`, `%`, `<`, `<=`, `>`, `>=`, `==`, `<=>`, `upto`.

#### Fora de escopo

- Aritmética de calendário (subfases 5.3–5.5).

#### Critério de aceite

```ts
const a = TjTime.fromString("2026-01-01");
const b = TjTime.fromString("2026-01-02");
b.diff(a) === 86400;
a.addSeconds(86400).equals(b);
a.lessThan(b) === true;
```

#### Testes

`tj-time-arithmetic_test.ts`:

- `describe("TjTime aritmética")`
  - `it("soma segundos")`.
  - `it("subtrai segundos")`.
  - `it("diferença entre dois TjTime em segundos")`.
  - `it("módulo")`.
- `describe("TjTime comparação")`
  - `it("menor")` / `maior` / `igual` / `menor ou igual` / `maior ou igual`.
  - `it("compareTo retorna -1, 0, 1")`.
- `describe("TjTime.upto")`
  - `it("itera de A a B com step")`.
  - `it("não itera se A >= B")`.

---

### 5.3 — `TjTime`: normalizações

#### Contexto

`beginOfHour`, `midnight`, `beginOfWeek`, `beginOfMonth`, `beginOfQuarter`, `beginOfYear` truncam uma data para o início de uma unidade temporal.

#### Objetivo

Implementar todos os `beginOf*` do Ruby, com fidelidade a timezone e leap years.

#### Arquivos

- `packages/core/src/time/tj-time.ts` (estender)
- `packages/core/tests/time/tj-time-normalize_test.ts`

#### Requisitos

- [ ] `beginOfHour(): TjTime`.
- [ ] `midnight(): TjTime`.
- [ ] `beginOfWeek(startMonday: boolean): TjTime`.
- [ ] `beginOfMonth(): TjTime`.
- [ ] `beginOfQuarter(): TjTime`.
- [ ] `beginOfYear(): TjTime`.
- [ ] Todos operam em **timezone local** (`currentTimeZone`).

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjTime.rb` — métodos `beginOfHour`, `midnight`, `beginOfWeek`, `beginOfMonth`, `beginOfQuarter`, `beginOfYear`.

#### Fora de escopo

- `sameTimeNext*` (5.4).

#### Critério de aceite

```ts
TjTime.fromString("2026-01-15-14:30:45").midnight()
  .equals(TjTime.fromString("2026-01-15"));

TjTime.fromString("2026-01-15").beginOfMonth()
  .equals(TjTime.fromString("2026-01-01"));

TjTime.fromString("2026-05-15").beginOfQuarter()
  .equals(TjTime.fromString("2026-04-01"));

TjTime.fromString("2024-02-29").beginOfMonth()
  .equals(TjTime.fromString("2024-02-01"));
```

#### Testes

`tj-time-normalize_test.ts`:

- `describe("TjTime normalizações")`
  - `it("beginOfHour zera minutos e segundos")`.
  - `it("midnight zera hora")`.
  - `it("beginOfWeek com startMonday=true")` — 5 datas.
  - `it("beginOfWeek com startMonday=false")`.
  - `it("beginOfMonth")` — 12 meses.
  - `it("beginOfQuarter")` — 4 quarters.
  - `it("beginOfYear")`.
  - `it("preserva timezone ao normalizar")` — `America/Sao_Paulo`.

---

### 5.4 — `TjTime`: avanços (`sameTimeNext*`)

#### Contexto

`sameTimeNext*` avança uma data para a próxima unidade mantendo o horário. Respeita fronteiras de calendário (mês de 30 vs 31 dias, leap year).

#### Objetivo

Implementar todos os `sameTimeNext*`, incluindo `nextDayOfWeek`.

#### Arquivos

- `packages/core/src/time/tj-time.ts` (estender)
- `packages/core/tests/time/tj-time-advance_test.ts`

#### Requisitos

- [ ] `hoursLater(hours: number): TjTime`.
- [ ] `sameTimeNextHour(): TjTime`.
- [ ] `sameTimeNextDay(): TjTime`.
- [ ] `sameTimeNextWeek(): TjTime`.
- [ ] `sameTimeNextMonth(): TjTime` — clamp para último dia do mês.
- [ ] `sameTimeNextQuarter(): TjTime`.
- [ ] `sameTimeNextYear(): TjTime` — clamp para 28/02 em non-leap.
- [ ] `nextDayOfWeek(dow: 0..6): TjTime`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjTime.rb` — métodos `hoursLater`, `sameTimeNextHour`, `sameTimeNextDay`, `sameTimeNextWeek`, `sameTimeNextMonth`, `sameTimeNextQuarter`, `sameTimeNextYear`, `nextDayOfWeek`, `lastDayOfMonth`, `leapYear?`.

#### Fora de escopo

- Diferenças (5.5).

#### Critério de aceite

```ts
TjTime.fromString("2024-01-31").sameTimeNextMonth()
  .equals(TjTime.fromString("2024-02-29"));

TjTime.fromString("2025-01-31").sameTimeNextMonth()
  .equals(TjTime.fromString("2025-02-28"));

TjTime.fromString("2024-02-29").sameTimeNextYear()
  .equals(TjTime.fromString("2025-02-28"));
```

#### Testes

`tj-time-advance_test.ts`:

- `describe("TjTime.sameTimeNextDay")`
  - `it("avança 1 dia")`.
  - `it("atravessa mês")`.
  - `it("atravessa ano")`.
- `describe("TjTime.sameTimeNextWeek")`
  - `it("avança 7 dias")`.
- `describe("TjTime.sameTimeNextMonth")`
  - `it("avança para próximo mês")`.
  - `it("clamp em fevereiro non-leap")` — 31/01 → 28/02.
  - `it("clamp em fevereiro leap")` — 31/01 → 29/02.
  - `it("atravessa ano")`.
- `describe("TjTime.sameTimeNextQuarter")`
  - `it("avança 3 meses")`.
- `describe("TjTime.sameTimeNextYear")`
  - `it("29/02 non-leap → 28/02")`.
- `describe("TjTime.nextDayOfWeek")`
  - `it("próxima segunda")`, `it("mesmo dia = próxima semana")`.
  - `it("dow inválido lança erro")`.

---

### 5.5 — `TjTime`: diferenças (`*To`)

#### Contexto

`daysTo`, `weeksTo`, `monthsTo`, `quartersTo`, `yearsTo` contam **intervalos** de uma data até outra — não são simples divisões.

#### Objetivo

Implementar todas as diferenças com a mesma semântica do Ruby (contagem por iteração).

#### Arquivos

- `packages/core/src/time/tj-time.ts` (estender)
- `packages/core/tests/time/tj-time-diff_test.ts`

#### Requisitos

- [ ] `hoursTo(date): number` — arredondado para cima.
- [ ] `daysTo(date): number` — conta `sameTimeNextDay` até ultrapassar.
- [ ] `weeksTo(date): number`.
- [ ] `monthsTo(date): number`.
- [ ] `quartersTo(date): number`.
- [ ] `yearsTo(date): number`.
- [ ] `countIntervals(date, stepFn)` — helper privado.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjTime.rb` — métodos `hoursTo`, `daysTo`, `weeksTo`, `monthsTo`, `quartersTo`, `yearsTo`, `countIntervals`, `order`.

#### Fora de escopo

- Formatação — coberto em 5.6.

#### Critério de aceite

```ts
const a = TjTime.fromString("2026-01-01-09:00");
const b = TjTime.fromString("2026-01-03-09:00");
b.daysTo(a) === 2;
a.daysTo(b) === 2;

TjTime.fromString("2026-01-31").daysTo(TjTime.fromString("2026-02-02")) === 2;
```

#### Testes

`tj-time-diff_test.ts`:

- `describe("TjTime.daysTo")`
  - `it("mesmo dia = 0")`.
  - `it("1 dia completo")`.
  - `it("atravessa mês")`.
  - `it("atravessa leap year")`.
  - `it("simétrico (a.daysTo(b) == b.daysTo(a))")`.
- `describe("TjTime.weeksTo")`
  - `it("1 semana = 1")`.
  - `it("8 dias = 2")`.
- `describe("TjTime.monthsTo")`
  - `it("1 mês exato")`.
  - `it("31/01 a 28/02 = 1")`.
- `describe("TjTime.yearsTo")`
  - `it("1 ano = 1")`.
  - `it("29/02/2024 a 28/02/2025 = 1")`.

---

### 5.6 — `TjTime`: timezone

#### Contexto

Ruby usa `ENV['TZ']` global. TypeScript não tem equivalente direto.

#### Objetivo

Implementar:
- `TjTime.checkTimeZone(zone)` — valida string IANA.
- `TjTime.setTimeZone(zone)` — setter global, retorna o anterior.
- `TjTime.timeZone` — getter global.
- `TjTime.prototype.localtime()` — partes locais.
- `TjTime.prototype.gmtime()` — partes UTC.
- `TjTime.prototype.secondsOfDay(tz)`.
- `TjTime.prototype.utc()`.
- `TjTime.prototype.to_s(format, tz)` — formatação com timezone.

#### Arquivos

- `packages/core/src/time/tj-time.ts` (estender)
- `packages/core/src/time/timezone.ts` (novo)
- `packages/core/tests/time/tj-time-timezone_test.ts`
- `packages/core/tests/time/timezone_test.ts`

#### Requisitos

**`timezone.ts`:**

- [ ] `isValidTimeZone(zone: string): boolean` — tenta `Intl.DateTimeFormat`.
- [ ] `getOffsetSeconds(epochSecs: number, timeZone: string): number`.
- [ ] `getLocalParts(epochSecs, timeZone)` — `{ year, month, day, hour, minute, second, weekday }`.
- [ ] `getUtcParts(epochSecs)`.
- [ ] `fromLocalParts(parts, timeZone)`.

**`TjTime`:**

- [ ] `static checkTimeZone(zone: string): boolean`.
- [ ] `static setTimeZone(zone: string): string`.
- [ ] `static getTimeZone(): string`.
- [ ] `localtime(): LocalParts`.
- [ ] `gmtime(): LocalParts`.
- [ ] `secondsOfDay(tz?: string): number`.
- [ ] `utc(): TjTime`.
- [ ] `to_s(format?: string, tz?: string): string`.
  - **Formatos suportados (apenas estes):** `%Y`, `%m`, `%d`, `%H`, `%M`, `%S`, `%A`, `%a`, `%B`, `%b`, `%z`, `%Q`.
  - `%Q` = quarter (extensão TJ).
  - Se `format` omitido, usa `%Y-%m-%d-%H:%M[:%S]-%z`.
  - Formatos fora da lista lançam `TjArgumentError`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjTime.rb` — métodos `checkTimeZone`, `setTimeZone`, `timeZone`, `localtime`, `gmtime`, `secondsOfDay`, `utc`, `to_s`, `strftime`.

#### Fora de escopo

- `strftime` completo — implementar apenas a lista acima.

#### Critério de aceite

```ts
TjTime.checkTimeZone("America/Sao_Paulo") === true;
TjTime.checkTimeZone("Invalid/Zone") === false;

TjTime.setTimeZone("America/Sao_Paulo");

TjTime.fromString("2026-01-01-00:00:00-0300").utc().to_s("%Y-%m-%d-%H:%M:%S")
  === "2026-01-01-03:00:00";

TjTime.fromString("2026-01-15").to_s("%A") === "Thursday";
TjTime.fromString("2026-05-15").to_s("%Q") === "2";
```

#### Testes

`timezone_test.ts`:

- `describe("isValidTimeZone")`
  - `it("aceita America/Sao_Paulo")`.
  - `it("aceita UTC")`.
  - `it("rejeita sem barra")`.
  - `it("rejeita IANA inválida")`.
- `describe("getOffsetSeconds")`
  - `it("Brasil sem DST = -10800")`.
  - `it("UTC = 0")`.

`tj-time-timezone_test.ts`:

- `describe("TjTime.setTimeZone")`
  - `it("retorna tz anterior")`.
  - `it("respeita nova tz em localtime")`.
- `describe("TjTime.localtime")`
  - `it("partes corretas em SP")`.
  - `it("partes corretas em UTC")`.
- `describe("TjTime.to_s")`
  - `it("format padrão")`.
  - `it("format customizado")`.
  - `it("%Q quarter")` — jan/mar/abr/jul/out/dez.
  - `it("%A dia da semana")`.
  - `it("rejeita formato não suportado")`.
- `describe("TjTime.utc")`
  - `it("converte para UTC preservando momento")`.
- `describe("TjTime.secondsOfDay")`
  - `it("00:00 = 0")`.
  - `it("12:00 = 43200")`.

---

### 5.7 — `Interval` genérico

#### Contexto

`Interval` é a classe base para `TimeInterval` e `ScoreboardInterval`. Representa um intervalo `[start, end)`.

#### Objetivo

Implementar `Interval<S, E>` genérico com:
- `start`, `end` readonly.
- Validação `start <= end`.
- `contains`, `overlaps`, `intersection`, `combine`, `compareTo`, `equals`.

#### Arquivos

- `packages/core/src/time/interval.ts`
- `packages/core/tests/time/interval_test.ts`

#### Requisitos

- [ ] `class Interval<S, E>` com:
  - `readonly start: S`
  - `readonly end: E`
  - Constructor valida `end >= start`, senão `TjArgumentError`.
- [ ] `contains(arg: S | Interval<S, E>): boolean`.
- [ ] `overlaps(arg: S | Interval<S, E>): boolean`.
- [ ] `intersection(other: Interval<S, E>): Interval<S, E> | null`.
- [ ] `combine(other: Interval<S, E>): Interval<S, E>`.
- [ ] `compareTo(other: Interval<S, E>): -1 | 0 | 1`.
- [ ] `equals(other: Interval<S, E>): boolean`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Interval.rb` — classe `Interval`.

#### Fora de escopo

- `TimeInterval` e `ScoreboardInterval` (5.8, 5.9).

#### Critério de aceite

```ts
const a = new Interval(1, 10);
const b = new Interval(5, 15);
a.overlaps(b) === true;
a.intersection(b)!.start === 5;
a.intersection(b)!.end === 10;
```

#### Testes

`interval_test.ts`:

- `describe("Interval")`
  - `it("constructor valida end >= start")`.
  - `it("contains value")`.
  - `it("contains Interval")`.
  - `it("overlaps parcial à direita")`, `à esquerda`, `contido`, `contendo`.
  - `it("intersection retorna null se não há sobreposição")`.
  - `it("intersection retorna correto se há sobreposição")`.
  - `it("combine adjacente à direita")`.
  - `it("combine adjacente à esquerda")`.
  - `it("combine não adjacente retorna this")`.
  - `it("compareTo")`.

---

### 5.8 — `TimeInterval`

#### Contexto

`TimeInterval` especializa `Interval` para `TjTime`.

#### Objetivo

Implementar `TimeInterval` com factory methods e `duration`.

#### Arquivos

- `packages/core/src/time/time-interval.ts`
- `packages/core/tests/time/time-interval_test.ts`

#### Requisitos

- [ ] `class TimeInterval extends Interval<TjTime, TjTime>`:
  - Construtor `(start: TjTime, end: TjTime)`.
  - `static fromSingle(t: TjTime): TimeInterval`.
  - `static fromInterval(iv: TimeInterval): TimeInterval`.
  - `duration(): number`.
  - `to_s(): string`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Interval.rb` — classe `TimeInterval`.

#### Critério de aceite

```ts
const iv = new TimeInterval(
  TjTime.fromString("2026-01-01"),
  TjTime.fromString("2026-01-02"),
);
iv.duration() === 86400;
```

#### Testes

`time-interval_test.ts`:

- `describe("TimeInterval")`
  - `it("constrói com start/end")`.
  - `it("duration em segundos")`.
  - `it("start = end → duration 0")`.
  - `it("rejeita end < start")`.

---

### 5.9 — `ScoreboardInterval`

#### Contexto

`ScoreboardInterval` representa um intervalo de **índices de scoreboard**, mas aceita `TjTime` no construtor e faz a conversão.

#### Objetivo

Implementar `ScoreboardInterval` com:
- `sbStart`, `slotDuration`.
- `start`, `end` como índices.
- `startDate()`, `endDate()`, `duration()`.

#### Arquivos

- `packages/core/src/time/scoreboard-interval.ts`
- `packages/core/tests/time/scoreboard-interval_test.ts`

#### Requisitos

- [ ] `class ScoreboardInterval extends Interval<number, number>`:
  - `readonly sbStart: TjTime`
  - `readonly slotDuration: number`
  - Constructor `(sbStart, slotDuration, start, end)` onde start/end podem ser `number | TjTime`.
  - `startDate(): TjTime`
  - `endDate(): TjTime`
  - `duration(): number`.
  - `to_s(): string`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Interval.rb` — classe `ScoreboardInterval`.

#### Critério de aceite

```ts
const sbStart = TjTime.fromString("2026-01-01");
const iv = new ScoreboardInterval(sbStart, 3600, sbStart, sbStart.addSeconds(7200));
iv.start === 0;
iv.end === 2;
iv.duration() === 7200;
iv.endDate().equals(sbStart.addSeconds(7200)) === true;
```

#### Testes

`scoreboard-interval_test.ts`:

- `describe("ScoreboardInterval")`
  - `it("start/end como índices")`.
  - `it("start/end como TjTime converte para índices")`.
  - `it("startDate/endDate convertem de volta")`.
  - `it("duration em segundos")`.

---

### 5.10 — `IntervalList`

#### Contexto

`IntervalList` é uma lista ordenada e sem sobreposição de intervalos.

#### Objetivo

Implementar `IntervalList<T extends Interval>` com:
- Herança de `Array<T>`.
- `intersect(other): IntervalList<T>`.
- `add(iv: T): this` — com merge automático.

#### Arquivos

- `packages/core/src/time/interval-list.ts`
- `packages/core/tests/time/interval-list_test.ts`

#### Requisitos

- [ ] `class IntervalList<T extends Interval<any, any>> extends Array<T>`:
  - `intersect(other: IntervalList<T>): IntervalList<T>`.
  - `add(iv: T): this`.
  - `append(iv: T): void`.
  - `[Symbol.species] = Array`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/IntervalList.rb` — método `&` e `<<`.

#### Fora de escopo

- Otimização com árvore de intervalos.

#### Critério de aceite

```ts
const a = new IntervalList<TimeInterval>();
a.add(new TimeInterval(t1, t2));
a.add(new TimeInterval(t2, t3)); // mescla → 1 intervalo [t1, t3]

const b = new IntervalList<TimeInterval>();
b.add(new TimeInterval(t2, t4));
a.intersect(b); // [t2, t3]
```

#### Testes

`interval-list_test.ts`:

- `describe("IntervalList.add")`
  - `it("adiciona intervalo isolado")`.
  - `it("mescla adjacente à direita")`.
  - `it("mescla adjacente à esquerda")`.
  - `it("rejeita sobreposição")`.
- `describe("IntervalList.intersect")`
  - `it("interseção parcial")`.
  - `it("interseção total")`.
  - `it("interseção vazia")`.
  - `it("interseção múltipla")`.

---

### 5.11 — `Scoreboard` (genérico)

#### Contexto

`Scoreboard` é um array de slots de tempo. Usado por `WorkingHours`, `Limits`, `ShiftAssignments`, `ResourceScenario` e `Project`.

**Nota:** o Scoreboard é **genérico** — armazena qualquer tipo. A codificação de bits é feita na Fase 6.

#### Objetivo

Implementar `Scoreboard<T>` com:
- Slots indexados por tempo.
- `idxToDate`, `dateToIdx`.
- `each`, `each_index`, `collect!`.
- `collectIntervals`.

#### Arquivos

- `packages/core/src/time/scoreboard.ts`
- `packages/core/tests/time/scoreboard_test.ts`

#### Requisitos

- [ ] `class Scoreboard<T = unknown>`:
  - `readonly startDate: TjTime`
  - `readonly endDate: TjTime`
  - `readonly resolution: number`
  - `readonly size: number`
  - `private data: T[]`
  - Constructor `(startDate, endDate, resolution, initVal?)`.
  - `clear(initVal?)`.
  - `idxToDate(idx, forceIntoProject?)`.
  - `dateToIdx(date, forceIntoProject?)`.
  - `get(idx)`.
  - `set(idx, value)`.
  - `each(startIdx?, endIdx?): IterableIterator<T>`.
  - `each_index(): IterableIterator<number>`.
  - `collect!(fn: (v: T, idx: number) => T): void`.
  - `collectIntervals(iv, minDuration, predicate): IntervalList<TimeInterval>`.
  - `length(): number`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/Scoreboard.rb` — classe completa.
- `docs/tj3-engine/02-bluprint-engine1.md` — §2.6.

#### Fora de escopo

- Codificação de bits — Fase 6.
- Otimização com `Int32Array` — Fase 6.

#### Critério de aceite

```ts
const sb = new Scoreboard<boolean>(
  TjTime.fromString("2026-01-01"),
  TjTime.fromString("2026-01-02"),
  3600,
  false,
);
sb.size === 24;
sb.get(0) === false;
sb.set(0, true);
sb.collectIntervals(
  new TimeInterval(TjTime.fromString("2026-01-01"), TjTime.fromString("2026-01-02")),
  0,
  (v) => v === true,
); // [intervalo 0..1]
```

#### Testes

`scoreboard_test.ts`:

- `describe("Scoreboard")`
  - `it("cria slots com valor inicial")`.
  - `it("size = (end - start) / resolution + 1")`.
  - `it("idxToDate")` / `it("dateToIdx")`.
  - `it("idxToDate forceIntoProject clampa")`.
  - `it("dateToIdx forceIntoProject clampa")`.
  - `it("get/set")`.
  - `it("each itera no range")`.
  - `it("collect! transforma")`.
- `describe("Scoreboard.collectIntervals")`
  - `it("coleta intervalo contíguo")`.
  - `it("ignora intervalos abaixo do minDuration")`.
  - `it("clampa ao intervalo de entrada")`.
  - `it("múltiplos intervalos")`.

---

### 5.12 — `WorkingHours`

#### Contexto

`WorkingHours` modela os horários de trabalho de um recurso ou do projeto.

#### Objetivo

Implementar `WorkingHours` com armazenamento de 7 dias × intervalos, `Scoreboard<boolean>` interno, timezone-aware.

#### Arquivos

- `packages/core/src/calendar/working-hours.ts`
- `packages/core/tests/calendar/working-hours_test.ts`

#### Requisitos

- [ ] `class WorkingHours`:
  - `readonly startDate: TjTime`
  - `readonly endDate: TjTime`
  - `readonly slotDuration: number`
  - `private timezone: string`
  - `private days: Array<Array<[number, number]>>`
  - `private scoreboard: Scoreboard<boolean> | null`
  - Constructor `(slotDuration, startDate, endDate, timeZone)`.
  - Constructor de cópia `(existing: WorkingHours)`.
  - `setWorkingHours(dayOfWeek, intervals)`.
  - `getWorkingHours(dayOfWeek)`.
  - `set timezone(zone: string)`.
  - `onShift(arg: TjTime | number): boolean`.
  - `timeOff(iv: TimeInterval): boolean`.
  - `weeklyWorkingHours(): number`.
  - `equals(other: WorkingHours): boolean`.
  - `deepClone(): WorkingHours`.
  - `to_s(): string`.
  - Private `initScoreboard(): void`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/WorkingHours.rb` — classe completa.

#### Fora de escopo

- `LeaveList` (Fase 16).
- Integração com `ResourceScenario` (Fase 7).

#### Critério de aceite

```ts
const wh = new WorkingHours(
  3600,
  TjTime.fromString("2026-01-01"),
  TjTime.fromString("2026-12-31"),
  "UTC",
);

wh.onShift(TjTime.fromString("2026-01-05-10:00")) === true;
wh.onShift(TjTime.fromString("2026-01-05-20:00")) === false;
wh.onShift(TjTime.fromString("2026-01-03-10:00")) === false;
wh.weeklyWorkingHours() === 40;
```

#### Testes

`working-hours_test.ts`:

- `describe("WorkingHours construtor")`
  - `it("default seg-sex 9-17")`.
  - `it("copia de outra instância")`.
- `describe("WorkingHours.setWorkingHours")`
  - `it("define novo horário para um dia")`.
  - `it("rejeita dia inválido")`.
  - `it("rejeita intervalo inválido")`.
  - `it("aceita múltiplos intervalos por dia")` — almoço.
- `describe("WorkingHours.onShift")`
  - `it("dentro do horário")`.
  - `it("fora do horário")`.
  - `it("sábado/domingo")`.
  - `it("respeita timezone")`.
- `describe("WorkingHours.timeOff")`
  - `it("intervalo totalmente off")`.
  - `it("intervalo parcialmente on")`.
- `describe("WorkingHours.weeklyWorkingHours")`
  - `it("40 horas para seg-sex 9-17")`.
  - `it("part-time 20 horas")`.
- `describe("WorkingHours.deepClone")`
  - `it("cria cópia independente")`.

---

### 5.13 — `RealFormat`

#### Contexto

`RealFormat` formata números reais para exibição em reports.

#### Objetivo

Implementar `RealFormat` fiel ao Ruby.

#### Arquivos

- `packages/core/src/format/real-format.ts`
- `packages/core/tests/format/real-format_test.ts`

#### Requisitos

- [ ] `class RealFormat`:
  - `readonly signPrefix: string`
  - `readonly signSuffix: string`
  - `readonly thousandsSeparator: string`
  - `readonly fractionSeparator: string`
  - `readonly fractionDigits: number`
  - Constructor `(args: [string, string, string, string, number] | RealFormat)`.
  - `format(n: number): string`.
  - `to_s(): string`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RealFormat.rb` — classe completa.

#### Fora de escopo

- Integração com `Query` — Fase 11.

#### Critério de aceite

```ts
const brl = new RealFormat(["-", "", ".", ",", 2]);
brl.format(1234.56) === "1.234,56";
brl.format(-1234.56) === "-1.234,56";

const usd = new RealFormat(["-", "", ",", ".", 2]);
usd.format(1234.56) === "1,234.56";

const pct = new RealFormat(["(", ")", ",", ".", 1]);
pct.format(-5.5) === "(5.5)";
```

#### Testes

`real-format_test.ts`:

- `describe("RealFormat")`
  - `it("formata inteiro")`.
  - `it("formata decimal")`.
  - `it("formata negativo com prefixo")`.
  - `it("formata negativo com sufixo")`.
  - `it("separador de milhar")`.
  - `it("fractionDigits 0")`, `1`, `2`, `3`.
  - `it("copy constructor")`.

---

### 5.14 — Infraestrutura de golden tests

#### Contexto

`tj3` está instalado (Ruby gem `taskjuggler`). Isso permite gerar **referências oficiais** para o comportamento de `TjTime`, `WorkingHours` e `Interval`, sem depender do parser TJP (que só existirá na Fase 10).

A estratégia é usar um **script Ruby** que importa `taskjuggler/TjTime` diretamente, executa operações e serializa os resultados em JSON. O teste em TypeScript carrega esse JSON e compara com os resultados do nosso `TjTime` TS.

Isso garante **fidelidade bit-a-bit** ao comportamento do TaskJuggler original.

#### Objetivo

Criar:
- Script Ruby `scripts/golden/tjtime.rb` que gera `packages/core/tests/golden/tjtime.golden.json`.
- Script Ruby `scripts/golden/working-hours.rb` que gera `packages/core/tests/golden/working-hours.golden.json`.
- Task Deno `golden:generate` que executa ambos os scripts.
- Teste `packages/core/tests/golden/tjtime_golden_test.ts` que compara.

#### Arquivos

- `scripts/golden/tjtime.rb` (novo)
- `scripts/golden/working-hours.rb` (novo)
- `scripts/golden/README.md` (novo)
- `packages/core/tests/golden/tjtime.golden.json` (gerado)
- `packages/core/tests/golden/working-hours.golden.json` (gerado)
- `packages/core/tests/golden/tjtime_golden_test.ts` (novo)
- `packages/core/tests/golden/working-hours_golden_test.ts` (novo)
- `deno.jsonc` — task `golden:generate`

#### Requisitos

**Script Ruby `scripts/golden/tjtime.rb`:**

- [ ] Importa `taskjuggler/TjTime` da gem instalada.
- [ ] Para cada caso de teste, executa uma operação e serializa o resultado.
- [ ] Formato JSON:
  ```json
  {
    "parsing": [
      { "input": "2026-01-01", "seconds": 1767225600, "to_s": "2026-01-01-00:00-UTC" },
      ...
    ],
    "normalizations": [
      { "input": "2026-01-15-14:30:45", "op": "midnight", "seconds": 1768435200, "to_s": "..." },
      ...
    ],
    "advances": [
      { "input": "2024-01-31", "op": "sameTimeNextMonth", "seconds": ..., "to_s": "2024-02-29" },
      ...
    ],
    "diffs": [
      { "from": "2026-01-01", "to": "2026-01-03", "op": "daysTo", "value": 2 },
      ...
    ]
  }
  ```
- [ ] Cobertura mínima: 50 casos.
- [ ] Sem DST-dependentes (usar UTC para parsing estável).

**Script Ruby `scripts/golden/working-hours.rb`:**

- [ ] Importa `taskjuggler/WorkingHours`.
- [ ] Serializa `onShift?` para datas de teste (seg-sex, sáb-dom, feriados, DST).
- [ ] Formato JSON:
  ```json
  {
    "configs": [
      {
        "name": "default-seg-sex-9-17",
        "slotDuration": 3600,
        "timezone": "UTC",
        "days": [[], [[32400, 61200]], ...],
        "checks": [
          { "date": "2026-01-05-10:00", "onShift": true },
          ...
        ]
      }
    ]
  }
  ```

**Task `golden:generate` em `deno.jsonc`:**

```jsonc
"golden:generate": "ruby scripts/golden/tjtime.rb > packages/core/tests/golden/tjtime.golden.json && ruby scripts/golden/working-hours.rb > packages/core/tests/golden/working-hours.golden.json"
```

**Teste TypeScript `tjtime_golden_test.ts`:**

- [ ] Lê `tjtime.golden.json` com `Deno.readTextFile` + `JSON.parse`.
- [ ] Para cada caso de parsing: `TjTime.fromString(input).toSeconds() === seconds`.
- [ ] Para cada caso de normalização: `TjTime.fromString(input)[op]().toSeconds() === seconds`.
- [ ] Para cada caso de avanço: idem.
- [ ] Para cada caso de diferença: `from[op](to) === value`.
- [ ] Se um caso falhar, mostrar `input`, `expected`, `actual` e mensagem.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjTime.rb` — comportamento de referência.
- `docs/taskjuggler/lib/taskjuggler/WorkingHours.rb`.
- `docs/taskjuggler/test/TestSuite/` — casos do TJ original (se aplicável).

#### Fora de escopo

- Golden tests de parser (Fase 10+).
- Golden tests de scheduler (Fase 21).
- Integração CI (Fase 21).

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- JSON gerado com ≥ 50 casos.
- Todos os testes de golden passam.
- Se um caso divergir, a mensagem aponta o input exato.

#### Testes

- `tjtime_golden_test.ts`
  - `describe("Golden TjTime parsing")` — itera casos.
  - `describe("Golden TjTime normalizations")`.
  - `describe("Golden TjTime advances")`.
  - `describe("Golden TjTime diffs")`.
- `working-hours_golden_test.ts`
  - `describe("Golden WorkingHours onShift")`.

**Nota de implementação:** o script Ruby **pode** ser inicialmente manual (executado uma vez, JSON commitado). No CI, o script é re-executado para garantir que a referência está atualizada (se o ambiente tiver `tj3`).

---

## 6. Ordem de execução sugerida

```text
5.0  ADR 012                    ← pode ser feito primeiro
      ↓
5.1  TjTime parsing
      ↓
5.2  TjTime aritmética
      ↓
5.3  TjTime normalizações
      ↓
5.4  TjTime avanços
      ↓
5.5  TjTime diferenças
      ↓
5.6  TjTime timezone       ← pode rodar em paralelo com 5.7–5.10
      ↓
5.7  Interval
      ↓
5.8  TimeInterval
      ↓
5.9  ScoreboardInterval
      ↓
5.10 IntervalList
      ↓
5.11 Scoreboard
      ↓
5.12 WorkingHours
      ↓
5.13 RealFormat
      ↓
5.14 Infraestrutura golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 2 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] Todos os 13 arquivos de `src/` existem e estão implementados.
- [ ] Todos os 13 arquivos de teste existem e passam.
- [ ] **≥ 150 testes unitários** no total.
- [ ] **≥ 50 golden tests** contra `tj3` no total.
- [ ] Nenhum `any` em `src/` (exceto onde justificado e documentado).
- [ ] Nenhum import proibido em `packages/core/src/`.
- [ ] `docs/syntaxmesh/decisoes/012-tjtime-typescript.md` criado.
- [ ] `README.md` de ADRs atualizado.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Timezone via `Intl` retorna offset errado em DST | Alto | Golden tests com `America/Sao_Paulo` (pré e pós-2019) e `America/New_York` |
| `sameTimeNextMonth` com clamp não bate com Ruby | Alto | Golden tests cobrindo todos os meses de 2020–2030 |
| `beginOfWeek` não respeita timezone | Médio | Golden tests com `America/Sao_Paulo` |
| `IntervalList` com herança de Array quebra `map` | Médio | Documentar; usar `[Symbol.species]` |
| `Scoreboard` genérico é lento com objetos | Médio | Aceitável por ora; Fase 6 cria especialização `Int32Array` |
| `strftime` incompleto quebra report futuro | Médio | Documentar lista; expandir quando Fase 14 precisar |
| Golden tests divergem por diferença de ambiente Ruby/Deno | Alto | Fixar timezone `UTC` nos casos; isolar casos DST |
| Script Ruby depende de gem instalada | Médio | Documentar em `scripts/golden/README.md`; JSON é commitado |
| `RealFormat` com muitos decimais gera string errada | Baixo | Golden test com valores extremos |

---

## 9. Referências cruzadas

### Arquivos Ruby de referência (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/TjTime.rb`
- `docs/taskjuggler/lib/taskjuggler/Interval.rb`
- `docs/taskjuggler/lib/taskjuggler/IntervalList.rb`
- `docs/taskjuggler/lib/taskjuggler/Scoreboard.rb`
- `docs/taskjuggler/lib/taskjuggler/WorkingHours.rb`
- `docs/taskjuggler/lib/taskjuggler/RealFormat.rb`
- `docs/taskjuggler/lib/taskjuggler/TjException.rb`

### Blueprints

- `docs/tj3-engine/02-bluprint-engine1.md` — §2.6, §6
- `docs/tj3-engine/05-blueprint-engine4.md` — §4

### Documentos do projeto

- `docs/syntaxmesh/decisoes/001-core-independente-do-dom.md`
- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md`
- `docs/syntaxmesh/decisoes/012-tjtime-typescript.md` (novo, criado nesta fase)
- `docs/syntaxmesh/03-arquitetura.md`
- `docs/syntaxmesh/06-testes-e-processo.md`

### Fases dependentes

- **Fase 3 — Modelo de Atributos** (usa `TjTime` em `DateAttribute`).
- **Fase 4 — Árvore de Propriedades** (usa `TjTime` em `ScenarioData`).
- **Fase 6 — Scoreboard e Estruturas Base** (estende `Scoreboard` com bits).
- **Fase 7 — Scheduler** (usa `WorkingHours`, `Scoreboard`, `IntervalList`).

---

## 10. Notas para a IA

1. **Portar fielmente, não reinterpretar.** Se o Ruby faz `x.upto(y)`, o TS faz igual. Não usar `date-fns` ou `luxon` para "simplificar" — o comportamento tem que bater.
2. **Um arquivo de teste por arquivo de src.** Espelhar a estrutura.
3. **Usar `describe`/`it`.** Nunca `Deno.test` direto.
4. **Golden tests contra Ruby são obrigatórios** para `TjTime` (parsing, normalizações, avanços, diferenças) e `WorkingHours`. Usar o script em `scripts/golden/`.
5. **Não otimizar prematuramente.** `Scoreboard` genérico é OK. Especialização vem na Fase 6.
6. **Documentar cada decisão de port** como comentário no código ou como ADR se afetar múltiplos arquivos.
7. **`TjTime` é a fundação.** Se algum teste falhar aqui, **parar e resolver** antes de avançar.
8. **Sem `any`.** Se precisar, usar `unknown` e narrowing explícito.
9. **Sem `as` cast.** Se precisar, é sinal de design ruim — revisar.
10. **Commit por subfase.** Cada `5.x` é um commit atômico com mensagem `feat(core): <descrição>`.
11. **`tj3` está disponível.** Usar para golden tests, não para inspiração.
12. **Formatos `strftime` limitados.** Não expandir sem necessidade concreta da Fase 14.

---

## 11. ADR 012 (referência rápida)

Criado como subfase 5.0. Conteúdo esperado:

- **Título:** TjTime em TypeScript: representação, timezone e parsing
- **Contexto:** `Time`/`ENV['TZ']` no Ruby vs TS
- **Decisão:**
  - Representação: `seconds: number` (inteiro, UTC).
  - Timezone: `currentTimeZone` module-level + helper `Intl.DateTimeFormat`.
  - Factory methods estáticos.
  - `strftime` mínimo (`%Y %m %d %H %M %S %A %a %B %b %z %Q`).
- **Alternativas:** `Temporal`, `luxon`, `date-fns-tz`.
- **Consequências:** performance (cacheável), precisão (segundos), sem dependência.

---

**Fim da Fase 2.**