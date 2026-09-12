# Fase 2 — Tarefas Complementares (revisão pós-implementação)

> **Arquivo:** `docs/syntaxmesh/fases/fase-2-tarefas-complementar.md`
> **Plano:** `docs/syntaxmesh/fases/fase-2-tempo-geometria.md`
> **Tarefas originais:** `docs/syntaxmesh/fases/fase-2-tarefas.md`
> **Status:** ⬜ Não iniciada
> **Total:** 42 tarefas
> **Concluídas:** 0

---

## ⚠️ Quando executar este arquivo

**Este arquivo só deve ser executado DEPOIS que todas as tarefas de `fase-2-tarefas.md` estiverem marcadas `[x]`.**

Ele serve para:

1. **Revisar** o que foi implementado na Fase 2 à luz da leitura completa dos arquivos Ruby.
2. **Corrigir divergências** entre a primeira versão do TS e o comportamento real do `tj3`.
3. **Categorizar bugs** do Ruby nas 3 categorias (A/B/C) definidas na ADR 012.
4. **Adicionar a flag `compat.keepRubyBugs`** onde necessário.
5. **Estender golden tests** para cobrir os bugs.

Estas tarefas **podem rever** tarefas já marcadas como concluídas na Fase 2. Ao revisar, **não apague** a marcação original — adicione uma nota `(revisado em 5.X.R.Y)`.

---

## 0. Protocolo TDD (reforço)

1. Escrever teste que falha
2. `deno task test` → falha correta
3. Implementar
4. `deno task test` → passa
5. `deno task check-all` → verde
6. Commit: `fix(core): <descrição>`
7. Marcar `[x]`

**Regras específicas desta fase complementar:**

- **Antes de cada tarefa:** reler o arquivo Ruby indicado.
- **Se a mudança pode afetar golden tests**, rodar `deno task golden:generate && deno task test` antes de commitar.
- **Se for bug Categoria B**, adicionar teste em **ambos os modos** (`keepRubyBugs: true` e `false`).
- **Se for bug Categoria A**, adicionar comentário `// RUBY-COMPAT-FIX:` no código.
- **Se for bug Categoria C**, adicionar comentário `// RUBY-COMPAT-DOC:` no código.

---

## Progresso

```
[ ] 5.0.R  Fundação (compat.ts + auditoria)     —  0/4
[ ] 5.1.R  Parsing (revisão)                    —  0/5
[ ] 5.2.R  Aritmética (revisão)                 —  0/5
[ ] 5.3.R  Normalizações (revisão)              —  0/3
[ ] 5.4.R  Avanços (revisão — 4 bugs Cat. B)    —  0/6
[ ] 5.5.R  Diferenças (revisão)                 —  0/2
[ ] 5.6.R  Timezone + strftime (revisão)        —  0/3
[ ] 5.7.R  Interval (revisão — 3 bugs)          —  0/4
[ ] 5.8.R  TimeInterval (revisão)               —  0/2
[ ] 5.9.R  ScoreboardInterval (revisão)         —  0/2
[ ] 5.10.R IntervalList (revisão)               —  0/3
[ ] 5.11.R Scoreboard (revisão — 2 bugs)        —  0/4
[ ] 5.12.R WorkingHours (revisão — 1 bug Cat A) —  0/3
[ ] 5.13.R RealFormat (revisão — 1 bug Cat B)   —  0/2
[ ] 5.14.R Golden tests (extensão)              —  0/4
─────────────────────────────────────────────────
TOTAL: 52
```

---

## Bloco A — Fundação

### 5.0.R — `compat.ts` + auditoria

**Objetivo:** criar a infraestrutura da flag global `keepRubyBugs` e auditar o código existente.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.0.R.1 | Criar `packages/core/src/compat.ts` com `export const compat = { keepRubyBugs: true }` + JSDoc explicando as 3 categorias | `src/compat.ts` | `deno check` |
| 5.0.R.2 | Adicionar export em `packages/core/mod.ts` | `mod.ts` | `deno check` |
| 5.0.R.3 | Auditoria: para cada método do código atual, marcar (via comentário) qual bug do §12 do cheat sheet ele pode ter | `src/time/*.ts` | grep `RUBY-COMPAT` retorna ≥ 0 |
| 5.0.R.4 | Revisar ADR 012 — confirmar que a seção "Bugs do Ruby" está atualizada com as 3 categorias | `decisoes/012-tjtime-typescript.md` | lido |

---

## Bloco B — Revisão por subfase

### 5.1.R — Parsing

**⚠️ RUBY: `TjTime.rb:parse` (linhas 289–380)**
**Categoria C:** rollover de `Time.mktime` é comportamento documentado, não bug.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.1.R.1 | Verificar se `fromString` usa `split('-', 5)` (não regex). Se usa regex, reescrever com split | `src/time/tj-time.ts` | teste com 3/4/5 partes |
| 5.1.R.2 | Confirmar que mensagem de erro do timezone out-of-range termina em `)` extra: `"...but is #{zone})"`. Replicar exato | idem | assert de mensagem |
| 5.1.R.3 | Adicionar `// RUBY-COMPAT-DOC:` no ponto onde `fromParts` faz rollover (`mktime(2024,4,31) → 2024-05-01`) | idem | grep |
| 5.1.R.4 | Adicionar teste que valida o rollover: `fromParts(2024, 4, 31)` === `fromString("2024-05-01")` | idem | 1 teste |
| 5.1.R.5 | Testar `fromString` com ano=1970, 2035 (limites); mês=1, 12; dia=1, lastDay | idem | 4 testes |

### 5.2.R — Aritmética

**⚠️ RUBY: `TjTime.rb:95–160`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.2.R.1 | ⚠️ `compareTo(null)` deve retornar `-1` (não lançar). Ajustar assinatura `compareTo(other: TjTime \| null)` | `src/time/tj-time.ts` | 2 testes |
| 5.2.R.2 | ⚠️ `lessThan(null)` retorna `false`; `greaterThan(null)` retorna `true`; `equals(null)` retorna `false` | idem | 3 testes |
| 5.2.R.3 | `align(clock)` deve operar em **local time**: `Math.floor((this.toSeconds() + offset) / clock) * clock - offset` | idem | 2 testes (`America/Sao_Paulo`) |
| 5.2.R.4 | ⚠️ **Categoria B:** `Math.round(-2.5) === -2`, mas Ruby `(-2.5).round === -3`. Criar helper `rubyRound(n)` em `compat.ts` que respeita `keepRubyBugs` | `src/compat.ts` + `src/utils/num.ts` | 3 testes (ambos modos) |
| 5.2.R.5 | Substituir `Math.round` por `rubyRound` onde o Ruby usa `Integer#round` | `src/time/tj-time.ts`, `src/format/real-format.ts` | grep `Math.round` = 0 |

### 5.3.R — Normalizações

**⚠️ RUBY: `TjTime.rb:165–225`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.3.R.1 | ⚠️ `beginOfWeek` deve implementar o algoritmo exato: (1) ir para noon, (2) subtrair `(weekday - (startMonday?1:0))` dias, (3) chamar `midnight` | `src/time/tj-time.ts` | 6 testes |
| 5.3.R.2 | Testar edge case domingo + `startMonday=true`: Ruby adiciona **1 dia** antes de midnight (resultado: próxima segunda) | idem | 1 teste |
| 5.3.R.3 | Todas as normalizações devem operar em `currentTimeZone`. Adicionar teste com `America/Sao_Paulo` | idem | 1 teste |

### 5.4.R — Avanços (4 bugs Categoria B)

**⚠️ RUBY: `TjTime.rb:230–285`**
**Aqui estão 4 bugs Categoria B.** Cada um precisa de flag.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.4.R.1 | ⚠️ **Cat. B:** `sameTimeNextWeek` — Ruby faz `day += 7` com overflow de **1 mês**, não +7 dias. Adicionar branch `if (compat.keepRubyBugs)` | `src/time/tj-time.ts` | 3 testes (ambos modos) |
| 5.4.R.2 | ⚠️ **Cat. B:** `sameTimeNextMonth` — Ruby clampa em `monMax` do mês **antigo** (bug). Adicionar branch `if (compat.keepRubyBugs)` | idem | 4 testes (ambos modos) |
| 5.4.R.3 | ⚠️ **Cat. B:** `sameTimeNextQuarter` — Ruby **não clampa** (rollover). Adicionar branch | idem | 3 testes |
| 5.4.R.4 | ⚠️ **Cat. B:** `sameTimeNextYear` — Ruby **não clampa** (rollover). Adicionar branch | idem | 3 testes |
| 5.4.R.5 | `nextDayOfWeek(dow)` — sempre começa em `midnight.sameTimeNextDay` (pelo menos amanhã, nunca hoje) | idem | 3 testes |
| 5.4.R.6 | Teste agregado: rodar 20 datas × 4 operações em ambos modos (compat e não-compat) | idem | 1 teste |

### 5.5.R — Diferenças

**⚠️ RUBY: `TjTime.rb:290–320`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.5.R.1 | Implementar `order()` (retorna `[menor, maior]`) e `countIntervals(date, stepFn)` — métodos privados | `src/time/tj-time.ts` | 2 testes |
| 5.5.R.2 | Testar simetria: `a.daysTo(b) === b.daysTo(a)` para 20 pares | idem | 1 teste |

### 5.6.R — Timezone + strftime

**⚠️ RUBY: `TjTime.rb:55–85, 240–280, 330–370`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.6.R.1 | `strftime` com formato fora da lista (`%Z`, `%j`, etc.) lança `TjArgumentError` | `src/time/tj-time.ts` | 3 testes |
| 5.6.R.2 | ⚠️ **Cat. B:** `to_s()` sem formato usa `this.time.sec` (original) para decidir se inclui `:%S`, não o sec local. Adicionar flag | idem | 2 testes (ambos modos) |
| 5.6.R.3 | `to_s(fmt, 'UTC')` usa `gmtime`; `to_s(fmt)` usa `localtime` | idem | 2 testes |

### 5.7.R — Interval (3 bugs)

**⚠️ RUBY: `Interval.rb:18–100`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.7.R.1 | ⚠️ **Cat. A:** `combine` — Ruby retorna `[Interval]` em 2 branches e `Interval` no 3º (tipo inconsistente). **Corrigir:** sempre retornar `Interval` | `src/time/interval.ts` | 3 testes |
| 5.7.R.2 | Adicionar comentário `// RUBY-COMPAT-FIX: combine sempre retorna Interval (Ruby retorna [Interval] em 2 branches)` | idem | grep |
| 5.7.R.3 | ⚠️ **Cat. C:** `compareTo` retorna `0` em overlap (não lança). Confirmar e adicionar `// RUBY-COMPAT-DOC:` | idem | 1 teste |
| 5.7.R.4 | `contains`/`overlaps` lançam `TjArgumentError('Class mismatch')` se classes divergem | idem | 2 testes |

### 5.8.R — TimeInterval

**⚠️ RUBY: `Interval.rb:115–160`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.8.R.1 | Constructor variádico: 1 arg (TjTime → sameTimeNextDay? Não — Ruby: `[arg, arg]`; TimeInterval → cópia) ou 2 args (start, end) | `src/time/time-interval.ts` | 4 testes |
| 5.8.R.2 | Testar erros: `"Illegal argument 1: #{class}"`, `"Too many arguments: #{n}"` | idem | 2 testes |

### 5.9.R — ScoreboardInterval

**⚠️ RUBY: `Interval.rb:165–260`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.9.R.1 | Constructor variádico: 1 (copy), 3 (`sbStart, slotDuration, single`), 4 (`sbStart, slotDuration, start, end`) | `src/time/scoreboard-interval.ts` | 4 testes |
| 5.9.R.2 | `dateToIndex` / `indexToDate` fazem divisão inteira (`Math.trunc`) | idem | 2 testes |

### 5.10.R — IntervalList

**⚠️ RUBY: `IntervalList.rb:17–100`**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.10.R.1 | ⚠️ `intersect(other)` — algoritmo com 6 branches. Ler o Ruby linha-a-linha. **Não simplificar** | `src/time/interval-list.ts` | 8 testes (todas combinações) |
| 5.10.R.2 | `<<` sobrescrito: overlap → erro; adjacente → merge; senão → push | idem | 4 testes |
| 5.10.R.3 | Teste de fumaça: mesclar 100 intervalos ascendentes | idem | 1 teste |

### 5.11.R — Scoreboard (2 bugs)

**⚠️ RUBY: `Scoreboard.rb` (~180 linhas)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.11.R.1 | ⚠️ **Cat. A:** `idxToDate` — Ruby tem typo `kdx`. **Corrigir:** usar `idx` corretamente. Adicionar `// RUBY-COMPAT-FIX:` | `src/time/scoreboard.ts` | 3 testes |
| 5.11.R.2 | ⚠️ Constructor: `size = Math.ceil((end - start) / resolution) + 1` (**ceil**, não floor) | idem | 2 testes |
| 5.11.R.3 | ⚠️ **Cat. B:** `collectIntervals` — sentinel `start === 0` perde slot 0. Flag `keepRubyBugs` | idem | 4 testes (ambos modos) |
| 5.11.R.4 | `dateToIdx(date, forceIntoProject=true)` — clamp em `[0, size-1]` | idem | 3 testes |

### 5.12.R — WorkingHours (1 bug Cat. A)

**⚠️ RUBY: `WorkingHours.rb` (~250 linhas)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.12.R.1 | ⚠️ **Cat. A:** `@days` compartilha o mesmo array vazio entre dom/sáb. **Corrigir:** `Array.from({length: 7}, () => [])`. Adicionar `// RUBY-COMPAT-FIX:` | `src/calendar/working-hours.ts` | 3 testes |
| 5.12.R.2 | Constructor variádico: 1 (copy) ou 4 args | idem | 3 testes |
| 5.12.R.3 | `timeOff(iv: TimeInterval)` itera `startIdx..endIdx-1`, retorna `true` se **todos** são `false` | idem | 2 testes |

### 5.13.R — RealFormat (1 bug Cat. B)

**⚠️ RUBY: `RealFormat.rb` (~120 linhas)**

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.13.R.1 | ⚠️ **Cat. B:** `round` de negativos — usar `rubyRound` helper (criado em 5.2.R.4) | `src/format/real-format.ts` | 2 testes (ambos modos) |
| 5.13.R.2 | Testar `format(-12.5)` com `fractionDigits=0`: `-13` (compat) vs `-12` (fix) | idem | 2 testes |

### 5.14.R — Golden tests (extensão)

**Objetivo:** golden tests cobrem os 3 tipos de bug.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 5.14.R.1 | Estender `tjtime.golden.json` com 20 casos cobrindo bugs Cat. B (sameTimeNext*, to_s, collectIntervals) | `scripts/golden/tjtime.rb` | ≥ 80 casos |
| 5.14.R.2 | Criar `packages/core/tests/golden/compat.golden.json` que valida comportamento com `keepRubyBugs: true` (default) | idem | JSON válido |
| 5.14.R.3 | Criar `packages/core/tests/golden/compat-fix.golden.json` com comportamento corrigido (para referência futura) | idem | JSON válido |
| 5.14.R.4 | Teste `compat_golden_test.ts` roda ambos e valida | `tests/golden/compat_golden_test.ts` | verde |

---

## Bloco C — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 5.15.R.1 | `deno task check-all` verde | exit 0 |
| 5.15.R.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 5.15.R.3 | Todos os testes originais da Fase 2 continuam passando | sem regressão |
| 5.15.R.4 | `grep -r "RUBY-COMPAT" packages/core/src/` retorna ≥ 10 ocorrências | grep |
| 5.15.R.5 | `grep -r "keepRubyBugs" packages/core/src/` retorna ≥ 6 ocorrências (uma por bug Cat. B) | grep |
| 5.15.R.6 | ADR 012 revisada e commitada | git log |
| 5.15.R.7 | Marcar cada `5.X` original em `fase-2-tarefas.md` com `(revisado em 5.X.R.Y)` | grep |

---

## Notas para a IA

1. **Ordem:** 5.0.R → 5.1.R → ... → 5.13.R → 5.14.R → Bloco C.
2. **Sempre ler o Ruby antes** de cada 5.X.R.
3. **Categoria A** = sempre corrigir, comentário `RUBY-COMPAT-FIX`.
4. **Categoria B** = flag `compat.keepRubyBugs`, ambos branches testados.
5. **Categoria C** = replicar, comentário `RUBY-COMPAT-DOC`.
6. **Nunca apagar** marcação `[x]` original da Fase 2. Adicionar `(revisado em 5.X.R.Y)` ao lado.
7. **Commit com prefixo `fix(core):`** (não `feat`).
8. **Golden tests rodam com default (`keepRubyBugs: true`).**
9. **Se um bug não está no §12 do cheat sheet**, adicionar lá primeiro.
10. **Sem `any`.** Use `unknown` + narrowing.

---

**Fim do arquivo de tarefas complementares da Fase 2.**