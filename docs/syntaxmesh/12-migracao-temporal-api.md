# Guia de Migração para a Temporal API

> **Status:** Proposta histórica incorporada à Fase 25 (2026-11-28)  
> **Plano canônico:** [`fase-25-temporal-api.md`](fases/fase-25-temporal-api.md)  
> **Tarefas executáveis:** [`fase-25-temporal-api-tarefas.md`](fases/fase-25-temporal-api-tarefas.md)  
> **Pré-requisito:** Deno >= 2.7 (o projeto usa 2.9.8, portanto a API é nativa e estável)[reference:1].  
> **Objetivo:** Substituir o uso da legacy `Date` e de helpers manuais pelos tipos imutáveis e timezone-aware da Temporal API, reduzindo bugs de DST e simplificando a aritmética de datas no motor de scheduling.

> **Nota de incorporação:** este documento permanece como registro da proposta
> original. A Fase 25 é autoritativa e substitui os detalhes provisórios abaixo:
> `TjTime` será removido, comportamento Temporal corrigido será o único suportado,
> o fallback não mutará `globalThis.Temporal`, e não haverá fachada pública legada
> nem guia público de migração.

---

## 1. Por que migrar?

A `Date` do JavaScript é mutável, confunde UTC com horário local e não possui um tipo nativo para durações (o que obriga o motor a fazer contas em milissegundos). A Temporal API resolve isso com tipos explícitos para cada conceito[reference:2].

No contexto do SyntaxMesh, os principais ganhos são:

- **Imutabilidade:** operações como `.add({ days: 7 })` retornam um novo objeto, eliminando efeitos colaterais acidentais no cálculo de cronogramas[reference:3].
- **Timezones explícitos:** `ZonedDateTime` carrega o fuso IANA (ex: `America/New_York`) e trata transições de horário de verão corretamente[reference:4].
- **Duração de primeira classe:** `Temporal.Duration` representa “10 dias”, “2 horas” ou “3 meses” sem precisar converter tudo para milissegundos.
- **Separação de conceitos:** `PlainDate` para datas de calendário (ex: feriados), `PlainTime` para horários de trabalho, `Instant` para timestamps absolutos.

---

## 2. Mapeamento de Tipos

| Conceito no SyntaxMesh | Tipo Temporal recomendado |
| :--- | :--- |
| Data de início/fim de uma tarefa (com fuso do projeto) | `Temporal.ZonedDateTime` |
| Data de um feriado (sem hora) | `Temporal.PlainDate` |
| Horário de trabalho (ex: 08:00–12:00) | `Temporal.PlainTime` |
| Esforço de uma tarefa (ex: `10d`, `4h`) | `Temporal.Duration` |
| Intervalo entre duas datas | `Temporal.Duration` (via `.until()`) |
| Timestamp de “agora” (`now` do projeto) | `Temporal.Instant` ou `Temporal.Now.zonedDateTimeISO(tz)` |
| Data e hora sem fuso (raro no motor) | `Temporal.PlainDateTime` |

> **Regra de ouro:** no Core do SyntaxMesh, **nunca** use `new Date()` diretamente. Toda data deve ser um objeto Temporal. A única exceção é a borda de entrada/saída (parsing de `.tjp` e serialização para relatórios), onde a conversão ocorre.

---

## 3. Estratégia de Migração Incremental

Não reescreva todo o motor de uma vez. Siga a ordem abaixo, garantindo que os testes continuem passando a cada passo.

### Passo 1: Encapsular a Criação de Datas

Crie um módulo `packages/core/src/time/temporal.ts` que centraliza a criação de objetos temporais a partir de strings do TJP.

```ts
// packages/core/src/time/temporal.ts
import { Temporal } from "npm:@js-temporal/polyfill"; // ou use o global nativo

export function parseDate(iso: string, timeZone: string): Temporal.ZonedDateTime {
  // Converte "2025-01-06" para um ZonedDateTime no fuso do projeto
  return Temporal.PlainDate.from(iso).toZonedDateTime(timeZone);
}

export function parseDuration(value: number, unit: string): Temporal.Duration {
  // "10d" -> Duration({ days: 10 })
  const map: Record<string, keyof Temporal.DurationLike> = {
    d: "days",
    h: "hours",
    w: "weeks",
    m: "months", // cuidado: 'm' pode ser minutos; o parser do TJP deve normalizar
  };
  return Temporal.Duration.from({ [map[unit]]: value });
}
```

**Substitua** todas as chamadas `new Date(isoString)` por `parseDate(isoString, project.timezone)`.

### Passo 2: Migrar `TjTime` para `ZonedDateTime`

O projeto possui uma classe `TjTime` (ver `cheat-sheet-ruby-ts.md`) que replica o comportamento do Ruby. Ela pode ser reescrita como um **wrapper fino** sobre `Temporal.ZonedDateTime`.

```ts
// packages/core/src/time/tj-time.ts
export class TjTime {
  private constructor(private zdt: Temporal.ZonedDateTime) {}

  static fromISO(iso: string, tz: string): TjTime {
    return new TjTime(parseDate(iso, tz));
  }

  addDays(n: number): TjTime {
    return new TjTime(this.zdt.add({ days: n }));
  }

  diff(other: TjTime): Temporal.Duration {
    return this.zdt.since(other.zdt);
  }

  toSeconds(): number {
    return this.zdt.epochSeconds;
  }

  // ... outros métodos delegam para this.zdt
}
```

> **Atenção:** a `TjTime` original tinha quirks (como `sameTimeNextMonth`). A migração para `ZonedDateTime` **corrige** esses bugs automaticamente, mas você deve **remover a flag `compat.keepRubyBugs`** para esses métodos ou adaptar os testes de compatibilidade.

### Passo 3: Substituir Aritmética de Milissegundos

**Antes:**
```ts
const start = new Date("2025-01-06T00:00:00Z");
const end = new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000);
```

**Depois:**
```ts
const start = Temporal.PlainDate.from("2025-01-06").toZonedDateTime("UTC");
const end = start.add({ days: 10 });
```

A duração de uma tarefa (`effort`) deixa de ser um número de milissegundos e passa a ser um `Temporal.Duration`. O scheduler pode usar `.total({ unit: "hours", relativeTo: start })` para obter o esforço em horas de trabalho.

### Passo 4: Intervalos de Trabalho e Calendários

Para representar um intervalo de trabalho (ex: 08:00–12:00), use `Temporal.PlainTime` e `Temporal.PlainDate`.

```ts
// Exemplo: verificar se um dia é útil
function isWorkingDay(date: Temporal.PlainDate, holidays: Temporal.PlainDate[]): boolean {
  const dayOfWeek = date.dayOfWeek; // 1 = segunda, 7 = domingo
  if (dayOfWeek === 6 || dayOfWeek === 7) return false;
  return !holidays.some(h => h.equals(date));
}
```

Para calcular o esforço em dias úteis, combine `Temporal.PlainDate` com um loop (ou use bibliotecas como `@akashgupta1909/temporal-workdays` se precisar de regras complexas de feriados)[reference:5].

### Passo 5: Formatação e Parsing para Relatórios

A Temporal API **não** substitui a formatação localizada (isso é papel do `Intl`). Para gerar datas em relatórios, use `Intl.DateTimeFormat` com `timeZone` explícito.

```ts
const formatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: project.timezone,
  dateStyle: "short",
  timeStyle: "short",
});
const formatted = formatter.format(zdt.toInstant().epochMilliseconds);
```

Para o parsing de arquivos `.tjp`, o lexer já reconhece datas no formato ISO; a conversão para `ZonedDateTime` deve usar o fuso declarado no projeto (`timezone "UTC"` ou `timezone "America/Sao_Paulo"`).

---

## 4. Exemplos de Migração no Código

### Exemplo 1: Cálculo de Data de Término

**Antes (com `Date`):**
```ts
function calculateEnd(start: Date, effortDays: number): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + effortDays);
  return end;
}
```

**Depois (com Temporal):**
```ts
function calculateEnd(
  start: Temporal.ZonedDateTime,
  effort: Temporal.Duration,
): Temporal.ZonedDateTime {
  return start.add(effort);
}
```

### Exemplo 2: Diferença entre Datas (Esforço Restante)

**Antes:**
```ts
const remainingMs = task.end.getTime() - task.start.getTime();
const remainingDays = remainingMs / (1000 * 60 * 60 * 24);
```

**Depois:**
```ts
const remaining: Temporal.Duration = task.end.since(task.start);
const remainingDays = remaining.total({ unit: "days" });
```

### Exemplo 3: Lidando com Fuso Horário do Projeto

**Antes:**
```ts
const now = new Date(); // Horário local do servidor — perigoso!
```

**Depois:**
```ts
const now = Temporal.Now.zonedDateTimeISO(project.timezone);
```

---

## 5. Testes e Compatibilidade

- **Testes unitários:** todos os testes que usam `Date` devem ser atualizados para comparar `Temporal` objects com `.equals()` (ex: `assertEquals(start, expected)`).
- **Golden tests:** os snapshots de schedule (F21) devem ser regenerados. A Temporal API pode produzir diferenças mínimas em cálculos de DST que o Ruby não tratava; documente essas divergências no `known-divergences.json`.
- **Polyfill para o navegador:** embora o Deno 2.9.8 já tenha Temporal, o PWA (Fase 20) pode rodar em navegadores mais antigos. Inclua `temporal-polyfill` (~20KB) como fallback condicional:

```ts
// packages/ui/src/main.tsx
import { Temporal } from "temporal-polyfill";

if (!("Temporal" in globalThis)) {
  globalThis.Temporal = Temporal;
}
```

---

## 6. Riscos e Armadilhas

| Risco | Mitigação |
| :--- | :--- |
| `Temporal.Duration` com meses/anos não é “exato” em dias | Use `relativeTo` em `.total()` ou prefira `PlainDate.add()` para aritmética de calendário. |
| A API é imutável: esquecer de atribuir o resultado | O TypeScript (strict) ajuda, mas revise os métodos que retornam novos objetos. |
| Conversão de `ZonedDateTime` para `Date` (para libs externas) | Use `.toInstant().epochMilliseconds` apenas nas bordas; nunca no Core. |
| Diferenças de comportamento em relação ao Ruby | Adicione testes de compatibilidade no `compat.keepRubyBugs` ou remova a flag para os métodos migrados. |

---

## 7. Checklist original (substituído pelo plano executável da Fase 25)

- [ ] Criar `packages/core/src/time/temporal.ts` com helpers de parsing.
- [ ] Refatorar `TjTime` para delegar a `Temporal.ZonedDateTime`.
- [ ] Substituir `new Date()` em `scheduler/`, `calendar/` e `accounting/` por Temporal.
- [ ] Migrar `Duration` de milissegundos para `Temporal.Duration` em `effort` e `duration`.
- [ ] Atualizar o parser para criar `Temporal.PlainDate`/`ZonedDateTime` em vez de `Date`.
- [ ] Regenerar golden tests de schedule e documentar divergências.
- [ ] Adicionar polyfill no entry point do PWA (Fase 20).

---

> **Referências:**
> - Deno 2.7 stabilizes Temporal: [deno.com/blog/v2.7](https://deno.com/blog/v2.7)[reference:6]
> - Guia de migração Moment → Temporal: [pkgpulse.com](https://www.pkgpulse.com/guides/temporal-api-replace-momentjs-date-fns-2026)[reference:7]
> - Tipos Temporal (MDN): `PlainDate`, `ZonedDateTime`, `Duration`[reference:8]
> - Calendários de trabalho com Temporal: `@akashgupta1909/temporal-workdays`[reference:9]