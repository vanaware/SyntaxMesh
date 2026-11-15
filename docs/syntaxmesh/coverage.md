# Relatório de cobertura de testes — SyntaxMesh core

> F21¹ (Fase 21, 1ª onda), tarefa 26.10. Medição de cobertura de **linhas**
> do `packages/core/src` a partir dos testes unitários consolidados.
> Data da medição: 2026-11-15.

## Resultado

| Métrica | Valor |
| --- | --- |
| Alvo (26.10.3) | >= 85% de linhas no core |
| Linhas cobertas | 48114 |
| Linhas instrumentadas | 52977 |
| **Cobertura de linhas** | **90.82%** |
| Arquivos no relatório | 350 |
| Status | PASS (90.82% >= 85%) |

## Como reproduzir

```sh
# Coleta + relatório lcov restrito ao core (task 26.10.3):
deno task coverage:core

# Agregação das linhas (LH = hit, LF = found) sobre o lcov:
awk -F: '/^LH:/{h+=$2}/^LF:/{f+=$2}END{printf "%.2f%%\n",100*h/f}' .tmp/core.lcov
```

`deno task coverage:core` executa:

```sh
deno test --no-check -P --coverage=.tmp/cov --clean \
  --ignore=packages/core/tests/golden packages/core/tests/ tests/unit/
deno coverage .tmp/cov --lcov --include=packages/core/src/ --output=.tmp/core.lcov
```

## Escopo e metodologia

- **Fonte da cobertura:** testes unitários do core (`packages/core/tests/`)
  mais o smoke de workspace (`tests/unit/`). O relatório lcov é filtrado
  para `packages/core/src/` — apenas código de produção do motor entra na
  métrica (testes, helpers e fixtures não contam).
- **Runner consolidado (26.10.1/26.10.2):** `deno task test:all` roda
  `packages/*/tests/**` + `tests/unit/**` (glob de include na seção `test`
  do `deno.jsonc`). A cobertura é medida sobre o subconjunto core.
- **Exclusão consciente do golden e2e do CLI:** o harness
  `packages/cli/tests/golden/e2e-harness.ts` gera um subprocesso `deno`
  por fixture (~340). Com `--coverage`, o `DENO_COVERAGE_DIR` propaga para
  esses filhos e cada um escreve um perfil por módulo — centenas de
  milhares de arquivos que esgotam o limite de inodes do filesystem
  (`StorageFull`, mesmo com GB livres). Por isso a coleta de cobertura é
  restrita aos testes que **não** geram subprocessos `deno`.
- **Exclusão do golden do core (`--ignore=.../golden`):** o único
  subprocesso dos testes do core é `ruby/tj3` (sondas do oráculo), que não
  escreve cobertura deno; o diretório é ignorado para manter a medição
  focada nos testes unitários e rápida.
- `.tmp/cov` e `.tmp/core.lcov` são scratch gitignored (`.tmp/`).

## Cobertura por módulo (diretórios de `packages/core/src`)

| Módulo | Linhas hit/found | Cobertura |
| --- | --- | --- |
| accounting | 308/315 | 97.8% |
| attributes | 907/1079 | 84.1% |
| calendar | 188/194 | 96.9% |
| docgen | 1762/1817 | 97.0% |
| execution | 643/673 | 95.5% |
| finance | 247/296 | 83.4% |
| format | 97/101 | 96.0% |
| gantt | 1509/1540 | 98.0% |
| html | 185/185 | 100.0% |
| i18n | 957/957 | 100.0% |
| ical | 223/225 | 99.1% |
| interfaces | 97/98 | 99.0% |
| lexer | 1912/2057 | 93.0% |
| logic | 871/1049 | 83.0% |
| logical | 5/5 | 100.0% |
| lsp | 859/891 | 96.4% |
| markdown | 818/850 | 96.2% |
| model | 9788/11518 | 85.0% |
| painter | 1422/1422 | 100.0% |
| parser | 8653/9485 | 91.2% |
| query | 510/552 | 92.4% |
| reports | 7073/7963 | 88.8% |
| richtext | 2482/2641 | 94.0% |
| scheduling | 763/822 | 92.8% |
| sheets | 1768/1876 | 94.2% |
| time | 1508/1649 | 91.4% |
| timesheet | 466/470 | 99.1% |
| utils | 486/507 | 95.9% |
| xml | 300/306 | 98.0% |
| (raiz) | 1307/1434 | 91.1% |
| **TOTAL** | **48114/52977** | **90.82%** |

## Arquivos com menor cobertura (>= 40 linhas)

Lacunas conhecidas, ordenadas da menor para a maior cobertura. Muitas
correspondem a funcionalidades adiadas para fases futuras (ex.: `niku-report`,
`material-allocation`) ou a caminhos de erro raros.

| Arquivo | Linhas hit/found | Cobertura |
| --- | --- | --- |
| finance/balance-account.ts | 18/43 | 41.9% |
| log.ts | 40/82 | 48.8% |
| attributes/time-interval/working-hours-attribute.ts | 33/62 | 53.2% |
| model/material-allocation.ts | 79/135 | 58.5% |
| model/task-scenario.ts | 1839/2786 | 66.0% |
| reports/niku-report.ts | 295/428 | 68.9% |
| attributes/list-attribute-base.ts | 36/48 | 75.0% |
| reports/tjp-export-re.ts | 492/634 | 77.6% |
| model/resource-scenario.ts | 900/1136 | 79.2% |
| model/material-booking.ts | 59/74 | 79.7% |
| model/property-set.ts | 192/240 | 80.0% |
| reports/i-cal-report.ts | 140/174 | 80.5% |

## Notas

- A métrica é **cobertura de linhas** (lcov `LH`/`LF`), não de branches.
- O alvo de 85% é sobre o **total do core**; módulos individuais podem
  ficar abaixo (ex.: `logic` 83.0%, `finance` 83.4%, `attributes` 84.1%)
  sem violar o alvo agregado.
- Determinismo dos snapshots de regressão (26.9): todas as fixtures i18n
  fixam `now`/`timezone` — incluindo `complemento-keywords`, corrigida nesta
  tarefa para não depender do relógio real (o default de `Project.now` é
  `TjTime.now().align(3600)`).