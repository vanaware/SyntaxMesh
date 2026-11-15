# Relatório de performance — SyntaxMesh core

> F21¹ (Fase 21, 1ª onda), tarefa 26.14. Otimização final dos **top-3
> hotspots** identificados por profiling CPU dos benchmarks da 26.11.
> Data da medição: 2026-11-15. Runtime: Deno 2.9.8 (v8 15.0.245).

## Resultado

Ganhos medidos por `deno task bench:compare` (baseline 26.11 pré-otimização
→ estado atual pós-otimização). Métrica: `avg` ns/iter do `deno bench --json`
(menor = melhor). Limiar de regressão: > 20%.

| Bench | Antes | Depois | Delta | Speedup |
| --- | --- | --- | --- | --- |
| schedule_booking_100 | 1564.1ms | 183.0ms | **-88.3%** | 8.5× |
| parse_100 | 319.0ms | 42.5ms | **-86.7%** | 7.5× |
| gantt_500_html | 1869.5ms | 483.2ms | **-74.2%** | 3.9× |
| parse_1000 | 370.2ms | 111.4ms | **-69.9%** | 3.3× |
| schedule_100 | 563.6ms | 315.9ms | **-44.0%** | 1.8× |
| report_10_html | 81.4ms | 57.3ms | **-29.6%** | 1.4× |
| richtext_to_html | 296.4µs | 235.4µs | -20.6% | ruído |
| query_10k_effort | 8.5ms | 7.3ms | -13.7% | — |
| richtext_to_tagged | 245.9µs | 212.0µs | -13.8% | ruído |
| schedule_1000 | 2634.4ms | 2580ms | -1.9% | — |
| richtext_to_s | 250.2µs | 295.1µs | +17.9% | ruído |

`bench:compare` **EXIT=0** — sem regressões > 20% (11 benches). Os micro-benches
de RichText (sub-milissegundo) e o `schedule_1000` variam dentro do ruído de
máquina entre execuções; os workloads pesados dominados por fuso/XML mostram
ganhos grandes e estáveis.

## Metodologia de profiling

- **Ferramenta:** `node:inspector` (`Profiler.enable` → `setSamplingInterval`
  100µs → `start`/`stop`), agregando `profile.samples` por `callFrame` para
  self-time. O subcomando `deno prof` **não existe** no Deno 2.9.8.
- **Workloads determinísticos:** todos fixam `timezone "UTC"` e
  `now 2026-01-15` (ver `bench/workloads.ts`), eliminando variância de
  relógio/fuso entre execuções.
- **Três workloads pesados perfilados:** booking 300 (alocação de recursos),
  Gantt 500 (render HTML) e schedule 1000 (datas fixas).
- Os probes de profiling são scratch gitignored (`.tmp/probe-cpu-profile.ts`,
  `.tmp/probe-utc-fastpath.ts`); os artefatos permanentes são `bench/` e os
  testes de equivalência.

## Top-3 hotspots (profile)

| # | Hotspot | Workload | Self-time | Causa raiz |
| --- | --- | --- | --- | --- |
| 1 | Matemática de fuso | booking 300 | **~95%** | `Intl.DateTimeFormat.formatToParts` (ICU) chamado milhões de vezes |
| 2 | `XMLElement.to_s` | gantt 500 | **~65%** | `out.endsWith(">")` relia a corda acumulada a cada filho (O(n²)) + escape char-a-char |
| 3 | Acesso a atributos | schedule 1000 | ~30% | `a`/`getStoredValue`/`get` — **não otimizado** (ver abaixo) |

Detalhamento do hotspot 1 (booking 300): `getLocalParts` 40.5%,
`getOffsetSeconds` 25%, `getTimeZoneAbbr` 13.4%, `strftime` 9.4%. A hipótese
inicial de que `duties.includes` era o culpado do O(n²) de booking foi
**refutada** pelo profile: o custo era ICU, não a busca de deveres.

## Otimizações aplicadas

### 1. Fast path UTC — `time/timezone.ts`

Para `timeZone === "UTC"` os getters nativos `Date.getUTC*` são
matematicamente idênticos ao Intl (sem offset/DST):

- `getOffsetSeconds(UTC)` → `0` (sem ICU).
- `getLocalParts(UTC)` → decomposição via `getUTCFullYear/Month/Date/Hours/`
  `Minutes/Seconds/Day`.
- `getTimeZoneAbbr(UTC)` → `"UTC"` (o ICU renderiza "UTC" para o fuso UTC).

**Equivalência provada:** 200k instantes com 0 divergências vs. o caminho Intl;
micro-benchmark de 1M chamadas: Intl = 6327ms vs. nativo = 239ms (**26.5×**).
Três testes de equivalência ICU lockam o contrato (`timezone_test.ts`,
describe `"UTC fast path (26.14)"`): `getLocalParts`, `getOffsetSeconds` e
`getTimeZoneAbbr` comparados à referência `Intl.DateTimeFormat` em 10
instantes representativos (época, negativo, bissexto, viradas de ano,
transições de DST e futuro). O caminho Intl permanece intacto para não-UTC.

### 2. `strftime` lazy + constantes hoisted — `time/tj-time.ts`

- Arrays constantes (`STRFTIME_DAY_NAMES`, `DAY_ABBR`, `MONTH_NAMES`,
  `MONTH_ABBR`, `MAX_DAYS`, `VALID_SPECIFIERS`) movidos para o escopo de
  módulo — antes eram realocados a cada chamada.
- Especificadores caros computados **só quando presentes** no formato:
  `%Z` (abreviação do fuso), `%z` (offset), `%j`/`%W` (dia do ano/semana).
  O default de `to_s` (`%Y-%m-%d %H:%M:%S %z`) não usa `%Z`/`%j`/`%W`.
- Código morto removido (`firstDayOfYear`/`firstWeekday` não usados no `%W`).

### 3. Fast path de escape XML — `xml/xml-element.ts`

- `escape`: sem `&` nem `"` o texto sai intacto (evita o loop por code point).
- `XMLText.to_s`: sem `<`, `>` nem `&` o texto sai intacto.

Provadamente idêntico: nenhum caractere escapável presente. Sozinho foi
**neutro** no Gantt — o custo real do `to_s` era o `endsWith` (item 4).

### 4. `XMLElement.to_s` O(n²) → O(n) — `xml/xml-element.ts`

`out.endsWith(">")` dentro do loop de filhos relia (flattening) a corda
acumulada inteira a cada iteração — quadrático no número de filhos. Como no
início de cada iteração `out` termina exatamente com o último caractere do
filho anterior (ou `">"` antes do primeiro), o estado é rastreado por
`prevEndsWithGt` a partir de `childStr` (O(n) total). **Byte-idêntico**,
verificado pelos goldens de Gantt (3382 linhas), reports (11501 linhas),
html-xml e ical + snapshots de regressão. Foi o ganho real do Gantt (**3.9×**).

## O que NÃO foi otimizado (e por quê)

- **Acesso a atributos (hotspot 3, ~30% do schedule 1000):** a guarda
  `!attr → null` em `getStoredValue`/`get` é semântica deliberada de
  compatibilidade (atributo ausente vs. valor nulo). Um cache/memoização
  arriscaria regressões sutis de herança/scenario por um ganho incerto —
  adiado conscientemente. Por isso `schedule_1000` melhora apenas -1.9%
  (só o fast path de fuso nas alineações de data).
- **Micro-benches de RichText:** sub-milissegundo, dominados por ruído de
  máquina (±20% entre execuções); não usam fuso/XML `to_s` de forma quente.

## Como reproduzir

```sh
# Benchmarks (11 benches em 6 arquivos):
deno task bench:run            # roda os benches
deno task bench:baseline       # regenera bench/baseline.json (--json)
deno task bench:compare        # compara atual vs. baseline; EXIT=1 se > 20%

# Limiar configurável (gate de regressão):
BENCH_THRESHOLD_PCT=20 deno task bench:compare
```

O `baseline.json` foi **regenerado** após a 26.14 para refletir o estado
otimizado — assim o gate de regressão > 20% protege os ganhos (remover o fast
path UTC, por exemplo, seria sinalizado como regressão). A cópia pré-otimização
fica em `.tmp/baseline-pre-2614.json` (scratch) para referência histórica.

## Verificação

| Conjunto | Resultado |
| --- | --- |
| time + strftime + tjtime golden + html-xml golden + regression | 46 passed (585 steps) |
| xml/html + gantt/reports/html-xml/ical goldens + regression | 31 passed (332 steps) |
| `timezone_test.ts` (inclui 3 testes UTC fast path) | 2 passed (7 steps) |
| `deno check`/`fmt`/`lint` (tj-time, timezone, xml-element) | limpos |
| `deno task bench:compare` | EXIT=0 (sem regressões > 20%) |

Toda otimização é **output-preserving**: os goldens e snapshots de regressão
comprovam saída byte-idêntica; os 3 testes de equivalência UTC comprovam que o
fast path nativo coincide com o ICU. O gate completo `deno task tests` é
executado no fechamento da F21¹.

## Notas

- Os ganhos concentram-se nos workloads dominados por **fuso** (booking, parse,
  schedule de datas) e por **serialização XML/HTML** (Gantt, reports). O
  `timezone "UTC"` é o default do motor e o caso mais comum dos fixtures.
- O fast path UTC não altera o comportamento de fusos não-UTC (DST, offsets):
  o caminho Intl original permanece para esses casos.
- Determinismo: os benches fixam `now`/`timezone`; sem isso, o default de
  `Project.now` (`TjTime.now().align(3600)`) introduziria variância de relógio.