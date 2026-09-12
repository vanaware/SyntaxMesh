# 012 — TjTime em TypeScript

## Contexto

O `TjTime.rb` do TaskJuggler usa `Time` do Ruby + `ENV['TZ']` global para representar timestamps. TypeScript/JavaScript não tem equivalente direto:

- Não há `Time` nativo com precisão de segundos estável
- Não há variável de ambiente global equivalente a `ENV['TZ']`
- `Date` é mutável e tem semântica de timezone inconsistente
- `Temporal` ainda não está estável no Deno

Além disso, o código Ruby contém **bugs conhecidos** que afetam o output. Precisamos decidir: replicar (para paridade com `tj3`) ou corrigir.

## Decisão

### Representação

- `TjTime` armazena `private readonly seconds: number` (inteiro, segundos desde epoch **UTC**)
- Nunca expõe `Date` na API pública
- Precisão de **segundos** (granularidade mínima do TJ é 1 minuto)

### Timezone

- Estado module-level `currentTimeZone: string` (default `'UTC'`)
- `setTimeZone(zone)` retorna timezone anterior
- Helper `Intl.DateTimeFormat` para offset e partes locais
- Replica `ENV['TZ']` global do Ruby (documentado: **não thread-safe**)

### Factory methods

Construtor privado. Factory estáticos substituem o construtor polimórfico do Ruby:

```
TjTime.now()                                 → tempo atual
TjTime.fromSeconds(secs)                     → segundos desde epoch
TjTime.fromDate(date)                        → Date → TjTime
TjTime.fromString(str)                       → "YYYY-MM-DD[-HH:MM[:SS][-TZ]]"
TjTime.fromParts(y, m, d, h, min, s, tz?)    → partes + timezone
```

### Parsing

Formato: `YYYY-MM-DD[-HH:MM[:SS][-TZ]]`, split em até **5 partes** por `-`.

Validações:
- Ano: 1970–2035
- Mês: 1–12
- Dia: 1–`lastDayOfMonth(month, year)`
- Hora: 0–23, Minuto: 0–59, Segundo: 0–59
- Timezone: `±HHMM`, range `[-1200, +1400]`

Timezone presente → `Time.utc` + subtrair offset. Ausente → `currentTimeZone`.

Mensagens de erro **idênticas** ao Ruby (incluindo `)` final faltante do erro de range).

### `strftime` mínimo

Suporta apenas: `%Y %m %d %H %M %S %A %a %B %b %z %Q %%`.

`%Q` = quarter (extensão TJ). Formatos fora da lista lançam `TjArgumentError`.

### Operações

Comparação, aritmética, normalizações, avanços, diferenças e timezone — todos seguindo o Ruby fielmente (com exceção dos bugs, abaixo).

### `deep_clone` e imutabilidade

`TjTime` é imutável (todas as operações retornam novo). `deepClone(tjtime)` retorna `tjtime` (mesma referência).

## Bugs do Ruby: replicar ou corrigir?

O código Ruby do TJ 3.8.4 contém bugs conhecidos. Dividimos em 3 categorias.

### Categoria A — Latentes (sempre corrigir)

Nunca disparam em uso normal. Corrigir é invisível para o usuário.

| Bug | Comportamento Ruby | Correção TS |
|---|---|---|
| `Interval#combine` tipo inconsistente | Retorna `[Interval]` em 2 branches, `Interval` no 3º | Retorna `Interval` sempre |
| `Scoreboard#idxToDate` typo `kdx` | `NameError` se `forceIntoProject && idx < 0` | Usa `idx` corretamente |
| `WorkingHours.@days` shared array | 7 referências ao mesmo `[]` | `Array.from({length:7}, () => [])` |

**Decisão:** sempre corrigir. Não há flag. Registrar divergência aqui.

### Categoria B — Afetam output (flag global)

Produzem resultados diferentes em casos legítimos. Precisamos de paridade com `tj3` **e** opção de correção.

| Bug | Ruby faz | Correto seria |
|---|---|---|
| `TjTime#sameTimeNextMonth` clamp em mês antigo | `2024-01-31 → 2024-03-02` (rollover) | `2024-01-31 → 2024-02-29` |
| `TjTime#sameTimeNextQuarter` sem clamp | `2024-01-31 → 2024-05-01` (rollover) | `2024-01-31 → 2024-04-30` |
| `TjTime#sameTimeNextYear` sem clamp | `2024-02-29 → 2025-03-01` | `2024-02-29 → 2025-02-28` |
| `Integer#round` para `-X.5` | `-2.5.round == -3` | `-2.5.round == -2` (JS native) |
| `TjTime#to_s` usa `sec` original | Formato depende do UTC original | Usar sec local |
| `Scoreboard#collectIntervals` sentinel `0` | Slots que começam em 0 são deslocados | Usar `-1` como sentinel |

**Decisão:** flag global.

```ts
// packages/core/src/compat.ts
export const compat = {
  /**
   * Quando `true` (default), replica bugs do TaskJuggler 3.8.4 para
   * garantir paridade bit-a-bit em golden tests.
   *
   * Quando `false`, aplica comportamento corrigido.
   */
  keepRubyBugs: true,
};
```

Cada método afetado:

```ts
sameTimeNextMonth(): TjTime {
  if (compat.keepRubyBugs) {
    // comportamento Ruby (bug)
  } else {
    // comportamento corrigido
  }
}
```

Golden tests: não trocam a flag (default `true`).
Produção: usuário troca em `main.tsx` se quiser comportamento corrigido.

### Categoria C — Documentados no Ruby (sempre replicar)

Não são bugs — são comportamentos documentados.

| Comportamento | Justificativa |
|---|---|
| `Interval#compareTo` retorna 0 em overlap | Documentado: "only works for non-overlapping intervals" |
| `String#to_i` retorna 0 em string inválida | Comportamento canônico do Ruby |
| `Time.mktime` faz rollover em dia inválido | Comportamento documentado do `Time` |
| `Integer#round` half-up em positivos | Mesmo que `Math.round` |

**Decisão:** replicar sempre. Sem flag.

## Alternativas consideradas

- **`Temporal`**: API moderna, mas ainda fase 3 no Deno
- **`luxon` / `date-fns-tz`**: dependência externa, desnecessária
- **Sem flag, sempre replicar bugs**: mais simples, mas engessa o usuário
- **Flag por método**: poluído demais

## Consequências

### Positivas

- Comportamento idêntico ao `TjTime.rb` (validado por golden tests)
- Sem dependências externas
- API imutável e determinística
- Paridade com `tj3` **por padrão**, correção opcional
- Bugs documentados como ADR (rastreáveis)

### Negativas / Riscos

- Precisão limitada a segundos
- Estado module-level `currentTimeZone` (documentado — idêntico ao Ruby)
- Flag global muda comportamento em runtime — cuidado em testes que assumem paridade
- Manutenção dupla dos branches `keepRubyBugs: true|false`

### Neutras / Observações

- Golden tests usam `keepRubyBugs: true`
- Usuários podem trocar para `false` em `main.tsx` via `compat.keepRubyBugs = false`
- Quando `Temporal` estabilizar, migração futura possível
- Bugs de Categoria A são divergências documentadas (não rastreáveis por flag)
- Ver `docs/syntaxmesh/cheat-sheet-ruby-ts.md` §12 para lista completa

---

**Status:** Aceito
**Data:** 2026-09-11
**Autor(es):** Vanaware