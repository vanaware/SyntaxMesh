# Especificação Consolidada — Funcionalidades #6 e #6a

> **Documento:** `timebasis` (#6) e distribuição temporal unificada (#6a)
> **Versão:** 1.0 (consolidada)
> **Estado do projeto:** Fase 10 em andamento; Fases 1–9, 8.1 e 8.2 concluídas
> **Compatibilidade:** default do projeto replica o TaskJuggler; `timebasis length` é extensão explícita
> **Golden tests:** comparar com `tj3` no default (`timebasis duration`); divergências documentadas em `known-divergences.json`

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Funcionalidade #6 — `timebasis`](#2-funcionalidade-6--timebasis)
3. [Funcionalidade #6a — Distribuição Temporal Unificada](#3-funcionalidade-6a--distribuição-temporal-unificada)
4. [Exemplos Completos](#4-exemplos-completos)
5. [Definições Formais](#5-definições-formais)
6. [Propriedades da Regra](#6-propriedades-da-regra)
7. [Impacto por Camada](#7-impacto-por-camada)
8. [Compatibilidade com TaskJuggler](#8-compatibilidade-com-taskjuggler)
9. [Decisões Consolidadas](#9-decisões-consolidadas)
10. [Perguntas em Aberto](#10-perguntas-em-aberto)
11. [Critérios de Aceite](#11-critérios-de-aceite)
12. [Resumo Executivo](#12-resumo-executivo)

---

## 1. Visão Geral

### 1.1 Contexto

O TaskJuggler distingue **`duration`** (tempo de calendário, dias corridos) de **`length`** (tempo de trabalho, dias úteis). No entanto, quando se trata de **custos** (`charge` e `material`), a documentação não deixa claro se modificadores como `perday`, `perweek` e `permonth` contam dias corridos ou dias úteis. Essa ambiguidade é problemática em projetos de construção, onde feriados e fins de semana afetam o cronograma de custos.

As funcionalidades **#6** e **#6a** resolvem essa ambiguidade introduzindo:

- **`timebasis`** (#6): um atributo que define, explícita e hierarquicamente, se a distribuição temporal conta dias corridos (`duration`) ou dias úteis (`length`).
- **Distribuição temporal unificada** (#6a): a regra transversal que conecta `timebasis` aos cálculos de `charge` e `material`, definindo como cada modificador (`perday`, `perweek`, `permonth`, `distributed`, `distribution { ... }`) aplica o valor sobre os dias elegíveis.

### 1.2 Princípios

1. **`timebasis` não altera o agendamento.** `schedule()`, `effort`, `length`, `duration` e `milestone` **não** são afetados. `timebasis` é exclusivo para cálculo de custos.
2. **Default replica o TaskJuggler.** O default do projeto é `timebasis duration`, preservando `.tjp` existentes e permitindo golden tests contra `tj3`.
3. **Extensão explícita.** `timebasis length` é sintaxe nova que o `tj3` rejeitaria; não há risco de confusão.
4. **Herança hierárquica.** `timebasis` resolvido em ordem: `length`/`duration` da tarefa → `timebasis` explícito da tarefa → `timebasis` do projeto → default `duration`.
5. **Cálculo proporcional unificado.** Bordas são sempre proporcionais; períodos completos são cheios (sem feriados) ou proporcionais (com feriados, sob `length`).
6. **Feriados reduzem `length`, não `duration`.** `timebasis duration` conta todos os dias (corridos), então feriados não afetam. `timebasis length` conta dias úteis não feriados, então feriados reduzem.

---

## 2. Funcionalidade #6 — `timebasis`

### 2.1 Descrição

`timebasis` define se a distribuição temporal de `charge` e `material` conta **dias de calendário** ou **dias úteis**. Aplica-se apenas quando o modificador depende de período (`perday`, `perweek`, `permonth`, `distributed`, `distribution { ... }`). Modificadores de ponto único (`onstart`, `onend`) e `perhour` não são afetados.

### 2.2 Valores e Aliases

| Valor canônico | Alias | Semântica |
|---|---|---|
| `duration` | `calendar` | Dias corridos (calendário) |
| `length` | `working` | Dias úteis (definidos por `workinghours` + `leaves`) |

O alias é açúcar sintático; o valor canônico é o que aparece na AST e em relatórios.

**Exemplos equivalentes:**

```taskjuggler
timebasis duration    # equivale a: timebasis calendar
timebasis length      # equivale a: timebasis working
```

### 2.3 Escopo de Declaração

| Onde | Permitido? | Scenario-specific? | Observação |
|---|---|---|---|
| `project` | **Sim** (default global) | **Não** | Define o padrão para tarefas que não resolvem de outra forma. |
| `task` | **Sim** (explícito, se aplicável) | **Sim** (como `duration`) | Só se a tarefa **não** tiver `length` nem `duration`. |
| `supplement (task)` | **Sim** | **Sim** | Aceita como qualquer atributo de tarefa. |
| `material` | **Não** | — | Material usa o `timebasis` resolvido da tarefa onde está alocado. |
| `resource` | **Não** | — | `timebasis` é task-centric. |
| `account` | **Não** | — | — |

### 2.4 Regra de Resolução do `timebasis` Efetivo

Aplicada em ordem, **para cada tarefa**:

1. **Se a tarefa tem `length`** → `timebasis = length` (implícito).
   - Usuário **não pode** definir `timebasis` explícito (erro `task_overspecified`).
2. **Se a tarefa tem `duration`** → `timebasis = duration` (implícito).
   - Usuário **não pode** definir `timebasis` explícito (erro `task_overspecified`).
3. **Se a tarefa não tem nem `length` nem `duration`**:
   - Se tem `timebasis` explícito → usa o valor explícito.
   - Senão → herda o `timebasis` do projeto.
4. **Se o projeto também não tem `timebasis`** → default `duration` (compatibilidade TJ).

O valor resolvido é armazenado em `TaskScenario.resolvedTimebasis` e usado em todos os cálculos de custo da tarefa.

**Pseudocódigo:**

```
function resolveTimebasis(task, project):
  if task.length != null:
    return LENGTH
  if task.duration != null:
    return DURATION
  if task.timebasis != null:
    return task.timebasis
  if project.timebasis != null:
    return project.timebasis
  return DURATION  // default
```

### 2.5 Sintaxe

```taskjuggler
project "Obra" 2026-01-01 - 2026-12-31 {
  timebasis length            # default do projeto: dias úteis
  workinghours mon - fri 9:00 - 18:00
  leaves holiday "Dia do Trabalho" 2026-05-01
}

task "Fundação" {
  duration 10d                # timebasis implícito = duration (dias corridos)
  charge 1000 perday
}

task "Estrutura" {
  length 10d                  # timebasis implícito = length (dias úteis)
  charge 1000 perday
}

task "Acabamento" {
  start 2026-06-01
  end   2026-06-15
  timebasis length            # tarefa sem length/duration; explícito
  charge 500 perday
}

task "Cura do concreto" {
  start 2026-07-01
  end   2026-07-10
  # sem length, sem duration, sem timebasis → herda do projeto (length)
  charge 200 perday
}
```

### 2.6 Erros

| Condição | Erro | Mensagem sugerida |
|---|---|---|
| `length` + `timebasis` na mesma tarefa | `task_overspecified` | "Task has both 'length' and 'timebasis'. Use one or the other." |
| `duration` + `timebasis` na mesma tarefa | `task_overspecified` | "Task has both 'duration' and 'timebasis'. Use one or the other." |
| `timebasis` com valor inválido | `illegal_timebasis` | "Illegal timebasis 'X'. Valid values: duration, calendar, length, working." |
| `timebasis` em milestone | `timebasis_not_supported` | "Milestones cannot have 'timebasis'." |
| `timebasis` em `material` | `timebasis_not_supported` | "Materials cannot have 'timebasis'. Use the task's timebasis." |

### 2.7 Interação com Conceitos Existentes

| Conceito | Interação |
|---|---|
| `effort` | **Nenhuma** — `effort` é sempre em tempo de trabalho. `timebasis` só afeta custo. |
| `length` | Implica `timebasis length`. Não pode ser combinado com `timebasis` explícito. |
| `duration` | Implica `timebasis duration`. Não pode ser combinado com `timebasis` explícito. |
| `milestone` | `timebasis` não se aplica (erro). |
| `container` | `timebasis` se aplica (distribuição sobre os dias elegíveis do span dos filhos). |
| `shift` na tarefa | **Sim** — se a tarefa tem `shift`, usa `workinghours` e `leaves` do shift (não do projeto). |
| `leaves` de recurso | **Não** influenciam (charge/material são task-centric). |
| `workinghours` de recurso | **Não** influenciam. |
| `weekStartsMonday` | **Sim** — define o início da semana para cálculo de `perweek`. |

---

## 3. Funcionalidade #6a — Distribuição Temporal Unificada

### 3.1 Descrição

Regra transversal que conecta `timebasis` (#6) aos cálculos de `charge` e `material`. Define **como contar períodos elegíveis** e **como aplicar o valor** em cada modificador.

### 3.2 Escopo — Modificadores Afetados

| Modificador | Afetado por `timebasis`? |
|---|---|
| `onstart` | Não (ponto único) |
| `onend` | Não (ponto único) |
| `perhour` | **Não** — sempre horas úteis |
| `perday` | **Sim** |
| `perweek` | **Sim** |
| `permonth` | **Sim** |
| `distributed` | **Sim** |
| `distribution { ... }` | **Sim** |

### 3.3 Algoritmo Geral

Para calcular a distribuição temporal de `charge` ou `material` em uma tarefa:

1. **Resolver `timebasis` efetivo** (§2.4).
2. **Determinar o intervalo da tarefa** (`start..end` ou pós-schedule).
3. **Calcular os dias elegíveis cobertos** dentro do intervalo.
4. **Aplicar o modificador** conforme §3.4.

### 3.4 Semântica por Modificador

#### 3.4.1 `perday`

| `timebasis` | Cálculo |
|---|---|
| `duration` | `amount × (número de dias corridos cobertos pelo intervalo)` |
| `length` | `amount × (número de dias úteis cobertos e não feriados)` |

#### 3.4.2 `perhour`

**Sempre horas úteis**, independente de `timebasis`.

- `amount × (número de horas úteis cobertas pelo intervalo)`.
- Horas úteis = horas com `workinghours` definido **E** não cobertas por `leave` (shift ou projeto).
- Preserva o significado natural de "por hora".
- **Não depende de `timebasis`.**

#### 3.4.3 `perweek`

Para cada semana `S` que intersecta o intervalo da tarefa:

**`timebasis duration`:**
- `denominador(S)` = número de dias do calendário em `S` (sempre 7).
- `numerador(S)` = número de dias de `S` cobertos pelo intervalo da tarefa.
- `valor(S)` = `amount × (numerador / denominador)`.

**`timebasis length`:**
- `denominador(S)` = número de **dias úteis do calendário** em `S` (dias com `workinghours` definido — do shift da tarefa, se houver; senão, do projeto — **sem** considerar `leaves`).
- `numerador(S)` = número de dias de `S` que são **úteis do calendário** **E** **não cobertos por `leave`** **E** **cobertos pelo intervalo da tarefa**.
- `valor(S)` = `amount × (numerador / denominador)`.

**Casos limite:**
- `S` inteiramente fora do intervalo da tarefa → `numerador = 0` → **0**.
- `S` inteiramente dentro, sem feriado → `numerador = denominador` → **`amount` (cheio)**.
- `S` inteiramente dentro, com feriado → `numerador < denominador` → **proporcional (< `amount`)**.
- `S` inteiramente dentro, com todos os dias úteis em feriado → `numerador = 0` → **0**.

**`weekStartsMonday` do projeto** define o início da semana.

#### 3.4.4 `permonth`

Para cada mês `M` que intersecta o intervalo da tarefa:

**`timebasis duration`:**
- `denominador(M)` = número de dias do calendário em `M` (28, 29, 30 ou 31).
- `numerador(M)` = número de dias de `M` cobertos pelo intervalo da tarefa.
- `valor(M)` = `amount × (numerador / denominador)`.

**`timebasis length`:**
- `denominador(M)` = número de **dias úteis do calendário** em `M` (dias com `workinghours` definido — do shift da tarefa, se houver; senão, do projeto — **sem** considerar `leaves`).
- `numerador(M)` = número de dias de `M` que são **úteis do calendário** **E** **não cobertos por `leave`** **E** **cobertos pelo intervalo da tarefa**.
- `valor(M)` = `amount × (numerador / denominador)`.

**Casos limite:**
- `M` inteiramente fora do intervalo da tarefa → `numerador = 0` → **0**.
- `M` inteiramente dentro, sem feriado → `numerador = denominador` → **`amount` (cheio)**.
- `M` inteiramente dentro, com feriado → `numerador < denominador` → **proporcional (< `amount`)**.
- `M` inteiramente dentro, com todos os dias úteis em feriado → `numerador = 0` → **0**.

**Mês calendário** (janeiro, fevereiro, ...) define o período.

#### 3.4.5 `distributed`

| `timebasis` | Cálculo |
|---|---|
| `duration` | `total / (número de dias corridos cobertos pelo intervalo)` por dia |
| `length` | `total / (número de dias úteis cobertos e não feriados)` por dia |

O total distribuído é sempre `total` (o valor declarado). O que muda é a **granularidade** (dias corridos vs úteis).

#### 3.4.6 `distribution { ... }`

| `timebasis` | Cálculo |
|---|---|
| `duration` | Divide os **dias corridos cobertos** em N partes iguais; aplica as N frações. |
| `length` | Divide os **dias úteis cobertos e não feriados** em N partes iguais; aplica as N frações. |

- N = número de frações declaradas.
- A soma das frações deve ser 1.0 (validado na Fase 8.1).
- **Pergunta em aberto:** se o número de dias não for divisível por N, a última parte absorve o resto (sugestão) ou distribui pelas primeiras? Ver §10.

### 3.5 Tabela Final Consolidada

| Modificador | `timebasis duration` | `timebasis length` |
|---|---|---|
| `onstart` | `amount` (ponto único) | `amount` (ponto único) |
| `onend` | `amount` (ponto único) | `amount` (ponto único) |
| `perhour` | **Horas úteis sempre** | **Horas úteis sempre** |
| `perday` | `amount × dias corridos cobertos` | `amount × dias úteis cobertos e não feriados` |
| `perweek` | `amount × (dias cobertos na semana / 7)` | `amount × (dias úteis cobertos e não feriados / dias úteis do calendário na semana)` |
| `permonth` | `amount × (dias cobertos no mês / dias do mês)` | `amount × (dias úteis cobertos e não feriados / dias úteis do calendário no mês)` |
| `distributed` | `total / dias corridos cobertos` | `total / dias úteis cobertos e não feriados` |
| `distribution { ... }` | Divide dias corridos cobertos em N partes | Divide dias úteis cobertos e não feriados em N partes |

### 3.6 Regra Unificada (Resumo)

A fórmula é a mesma para `perweek` e `permonth`, mudando apenas o período e o denominador:

```
valor(P) = amount × (numerador(P) / denominador(P))
```

Onde:

| | `timebasis duration` | `timebasis length` |
|---|---|---|
| `denominador(P)` | Dias do calendário em P | Dias úteis do calendário em P (sem `leaves`) |
| `numerador(P)` | Dias de P cobertos pela tarefa | Dias úteis de P não feriados e cobertos pela tarefa |

**Propriedades:**
- Período completo sem feriado → `numerador = denominador` → **`amount` (cheio)**.
- Período completo com feriado (`length`) → `numerador < denominador` → **proporcional**.
- Período parcial (borda) → proporcional, com denominador dependente do `timebasis`.
- Período inteiro em férias (`length`) → `numerador = 0` → **0**.

---

## 4. Exemplos Completos

### 4.1 Exemplo 1 — Tarefa 15/01 a 15/11, `permonth 1000`, sem feriados

```taskjuggler
project "Obra" 2026-01-01 - 2026-12-31 {
  workinghours mon - fri 9:00 - 18:00
}

task "Fundação" {
  start 2026-01-15
  end   2026-11-15
  charge 1000 permonth
}
```

**`timebasis duration` (default):**

| Mês | Dias cobertos | Dias no mês | Cálculo | Valor |
|---|---|---|---|---|
| Janeiro | 17 (15–31) | 31 | `17/31 × 1000` | ≈ 548 |
| Fevereiro | 28 | 28 | `28/28 × 1000` | **1000** |
| Março | 31 | 31 | `31/31 × 1000` | **1000** |
| Abril | 30 | 30 | `30/30 × 1000` | **1000** |
| Maio | 31 | 31 | `31/31 × 1000` | **1000** |
| Junho | 30 | 30 | `30/30 × 1000` | **1000** |
| Julho | 31 | 31 | `31/31 × 1000` | **1000** |
| Agosto | 31 | 31 | `31/31 × 1000` | **1000** |
| Setembro | 30 | 30 | `30/30 × 1000` | **1000** |
| Outubro | 31 | 31 | `31/31 × 1000` | **1000** |
| Novembro | 15 (1–15) | 30 | `15/30 × 1000` | **500** |
| **Total** | | | | ≈ **10048** |

**`timebasis length` (com `workinghours mon - fri`):**

| Mês | Dias úteis cobertos | Dias úteis no mês | Cálculo | Valor |
|---|---|---|---|---|
| Janeiro | ~12 | ~22 | `12/22 × 1000` | ≈ 545 |
| Fevereiro | ~20 | ~20 | `20/20 × 1000` | **1000** |
| Março | ~22 | ~22 | `22/22 × 1000` | **1000** |
| ... | ... | ... | ... | **1000** |
| Outubro | ~22 | ~22 | `22/22 × 1000` | **1000** |
| Novembro | ~10 | ~21 | `10/21 × 1000` | ≈ 476 |
| **Total** | | | | ≈ **10021** |

**Observação:** meses 2–10 custam **1000 cada**, independente de `timebasis` (sem feriados). As bordas (janeiro e novembro) são proporcionais, com denominador dependente do `timebasis` (dias corridos vs úteis do calendário). O total é **aproximado** em 1 mês, variando por causa dos comprimentos dos meses e das bordas.

### 4.2 Exemplo 2 — Feriado em mês completo (março)

```taskjuggler
project "Obra" 2026-01-01 - 2026-12-31 {
  workinghours mon - fri 9:00 - 18:00
  leaves holiday "Carnaval" 2026-03-10 +5d   # 10–14/03, 5 dias úteis
}

task "Fundação" {
  start 2026-01-15
  end   2026-11-15
  timebasis length
  charge 1000 permonth
}
```

**Março:**

| `timebasis` | Numerador | Denominador | Valor |
|---|---|---|---|
| `duration` | 31 (todos os dias) | 31 | **1000** (feriado não afeta) |
| `length` | 17 (22 dias úteis − 5 feriados) | 22 | `17/22 × 1000` ≈ **773** |

**Interpretação B (confirmada):** feriado em mês completo **reduz** o valor em `length` porque o numerador (dias úteis não feriados) é menor que o denominador (dias úteis do calendário). Em `duration`, o feriado **não** afeta.

**Janeiro e novembro (bordas):** o cálculo é o mesmo de §4.1, mas o feriado de março não os afeta.

**Total (`length`):** ≈ 545 (jan) + 1000×8 (fev, abr–out) + 773 (mar) + 476 (nov) ≈ **9994**.

### 4.3 Exemplo 3 — Mês inteiro de férias (julho)

```taskjuggler
project "Obra" 2026-01-01 - 2026-12-31 {
  workinghours mon - fri 9:00 - 18:00
  leaves holiday "Férias coletivas" 2026-07-01 +31d   # julho inteiro
}

task "Fundação" {
  start 2026-01-15
  end   2026-11-15
  timebasis length
  charge 1000 permonth
}
```

**Julho:**

| `timebasis` | Numerador | Denominador | Valor |
|---|---|---|---|
| `duration` | 31 (todos os dias) | 31 | **1000** (férias não afetam) |
| `length` | 0 (todos os dias úteis em férias) | 22 | `0/22 × 1000` = **0** |

**Interpretação B (confirmada):** mês inteiro de férias **zera** o valor em `length`.

### 4.4 Exemplo 4 — `perweek` com bordas parciais (`timebasis duration`)

```taskjuggler
project "Obra" 2026-01-01 - 2026-12-31 {
  weekStartsMonday true
}

task "Fundação" {
  start 2026-06-03   # quarta
  end   2026-06-17   # quarta
  charge 5000 perweek
}
```

**`timebasis duration`:**

| Semana | Dias cobertos | Dias na semana | Cálculo | Valor |
|---|---|---|---|---|
| 01–07/06 | 5 (03–07) | 7 | `5/7 × 5000` | ≈ 3571 |
| 08–14/06 | 7 | 7 | `7/7 × 5000` | **5000** |
| 15–21/06 | 3 (15–17) | 7 | `3/7 × 5000` | ≈ 2143 |
| **Total** | | | | ≈ **10714** |

### 4.5 Exemplo 5 — `perweek` com semana de feriado (`timebasis length`)

```taskjuggler
project "Obra" 2026-01-01 - 2026-12-31 {
  workinghours mon - fri 9:00 - 18:00
  weekStartsMonday true
  leaves holiday "Natal" 2026-12-21 +7d   # semana inteira
}

task "Fundação" {
  start 2026-12-01
  end   2026-12-31
  timebasis length
  charge 5000 perweek
}
```

| Semana | Dias úteis cobertos e não feriados | Dias úteis no calendário | Cálculo | Valor |
|---|---|---|---|---|
| 01–07/12 | 5 | 5 | `5/5 × 5000` | **5000** |
| 08–14/12 | 5 | 5 | `5/5 × 5000` | **5000** |
| 15–21/12 | 5 | 5 | `5/5 × 5000` | **5000** |
| 22–28/12 (Natal) | 0 | 5 | `0/5 × 5000` | **0** |
| 29/12–04/01 | 3 (29–31/12) | 5 | `3/5 × 5000` | **3000** |
| **Total** | | | | **16000** |

### 4.6 Exemplo 6 — `perday` (`timebasis duration` vs `length`)

```taskjuggler
project "Obra" 2026-01-01 - 2026-12-31 {
  workinghours mon - fri 9:00 - 18:00
  leaves holiday "Dia do Trabalho" 2026-05-01   # sexta
}

task "Fundação" {
  start 2026-04-27   # segunda
  end   2026-05-08   # sexta
  charge 1000 perday
}
```

| `timebasis` | Dias elegíveis cobertos | Cálculo | Valor |
|---|---|---|---|
| `duration` | 12 (27/04–08/05, todos os dias) | `12 × 1000` | **12000** |
| `length` | 9 (exclui sábados, domingos e 1º de maio) | `9 × 1000` | **9000** |

### 4.7 Exemplo 7 — `perhour` (sempre horas úteis)

```taskjuggler
project "Obra" 2026-01-01 - 2026-12-31 {
  workinghours mon - fri 9:00 - 18:00
}

task "Fundação" {
  start 2026-06-01   # segunda
  end   2026-06-05   # sexta
  timebasis duration   # ou length — não importa
  charge 10 perhour
}
```

| `timebasis` | Horas úteis | Cálculo | Valor |
|---|---|---|---|
| `duration` | 40 (5 dias × 8h) | `40 × 10` | **400** |
| `length` | 40 (5 dias × 8h) | `40 × 10` | **400** |

**`perhour` é sempre horas úteis**, independente de `timebasis`.

### 4.8 Exemplo 8 — `distributed` (`timebasis duration` vs `length`)

```taskjuggler
project "Obra" 2026-01-01 - 2026-12-31 {
  workinghours mon - fri 9:00 - 18:00
}

task "Fundação" {
  start 2026-06-01   # segunda
  end   2026-06-12   # sexta (2 semanas)
  charge 10000 distributed
}
```

| `timebasis` | Dias elegíveis | Cálculo por dia | Total |
|---|---|---|---|
| `duration` | 12 (01–12/06, todos os dias) | `10000/12` ≈ 833/dia | **10000** |
| `length` | 10 (2 semanas × 5 dias úteis) | `10000/10` = 1000/dia | **10000** |

**Total é sempre `total`**; muda a granularidade (dias corridos vs úteis).

### 4.9 Exemplo 9 — `distribution { ... }` com feriado

```taskjuggler
project "Obra" 2026-01-01 - 2026-12-31 {
  workinghours mon - fri 9:00 - 18:00
  leaves holiday "Feriado" 2026-06-03 +1d   # quarta
}

task "Fundação" {
  start 2026-06-01   # segunda
  end   2026-06-09   # terça (9 dias corridos)
  timebasis length
  charge 1000 distribution { 0.5, 0.3, 0.2 }
}
```

**Dias úteis cobertos (sem feriado):** 01, 02, 04, 05, 08, 09/06 = **6 dias** (03/06 é feriado, 06–07/06 é fim de semana).

**Distribuição (N=3):**
- 6 dias ÷ 3 partes = 2 dias por parte.
- Parte 1 (50%): 2 primeiros dias úteis (01, 02/06) → `0.5 × 1000 = 500`.
- Parte 2 (30%): 2 próximos (04, 05/06) → `0.3 × 1000 = 300`.
- Parte 3 (20%): 2 últimos (08, 09/06) → `0.2 × 1000 = 200`.
- **Total = 1000**.

Se `timebasis duration`: 9 dias corridos ÷ 3 = 3 dias por parte; o feriado e o fim de semana são contados normalmente.

---

## 5. Definições Formais

| Termo | Definição |
|---|---|
| **Dia útil do calendário** | Dia com `workinghours` definido (do shift da tarefa, se houver; senão, do projeto), **independente de `leaves`**. |
| **Dia elegível** | `duration`: qualquer dia. `length`: dia útil do calendário **E** não coberto por `leave`. |
| **Dia coberto pela tarefa** | Dia dentro do intervalo `start..end` da tarefa. |
| **Período `P`** | `perweek`: semana segundo `weekStartsMonday` do projeto. `permonth`: mês calendário. |
| **Borda** | Período parcialmente coberto pela tarefa. |
| **Período completo** | Período inteiramente coberto pela tarefa. |
| **Período fora** | Período sem nenhum dia coberto pela tarefa. |
| **`resolvedTimebasis`** | Valor de `timebasis` resolvido para uma tarefa, armazenado em `TaskScenario`. |

---

## 6. Propriedades da Regra

1. **Períodos completos sem feriado custam `amount` cheio**, independente de `timebasis`. (Meses 2–10 do exemplo 4.1.)
2. **Períodos completos com feriado (`length`) custam menos**, proporcional aos dias úteis não feriados. (Exemplo 4.2.)
3. **Bordas são sempre proporcionais**, com denominador dependente do `timebasis` (dias corridos vs úteis do calendário).
4. **Feriados só afetam `timebasis length`**, e só quando estão dentro do intervalo da tarefa.
5. **`leaves` de recurso não influenciam** (só `leaves` do shift ou do projeto).
6. **`weekStartsMonday` importa** no cálculo de `perweek`.
7. **Mês inteiro de férias (`length`) zera** o valor daquele mês.
8. **`perhour` é sempre horas úteis**, independente de `timebasis`.
9. **`distributed` e `distribution { ... }` distribuem o total**, nunca mudam o valor total.
10. **Default do projeto = `duration`** (replica o TJ).

---

## 7. Impacto por Camada

### 7.1 Modelo (Fase 5 + Fase 9)

- `timebasis` como `AttributeDefinition` em `Task` (`SymbolAttribute`, scenario-specific, como `duration`/`length`).
- `timebasis` como `AttributeDefinition` no `Project` (default global, **não** scenario-specific).
- Valores válidos: `duration`, `calendar`, `length`, `working`. Canônico: `duration`, `length`.

### 7.2 Core (Fase 7)

- `TaskScenario.prepareScheduling()`: resolver o `timebasis` efetivo e armazenar em `resolvedTimebasis`.
- `scheduleSlot()` **não muda** (o `timebasis` não altera o agendamento).
- `MaterialAllocation` e `ExtendedCharge.turnover()`: consultar `task.scenarioData(scIdx).resolvedTimebasis`.
- **Novo módulo centralizado:** `src/core/accounting/distribution.ts` (ou equivalente) que implementa a regra unificada, reutilizado por `charge` e `material`.

### 7.3 Parser (Fase 10)

- `rule_timebasis` (aceita `duration` | `calendar` | `length` | `working`).
- Estender `rule_taskScenarioAttributes` e `rule_projectBodyAttributes`.
- O scanner **não muda** (keywords já existem ou são novas mas triviais).

### 7.4 Reports (Fase 14)

- Coluna `timebasis` (opcional) exibe o valor resolvido.
- `breakdownreport` e `rdoreport` **não usam** `timebasis` diretamente (usam o custo já calculado).

---

## 8. Compatibilidade com TaskJuggler

| Aspecto | Comportamento |
|---|---|
| **Default do projeto** | `timebasis duration` — replica o TJ. |
| **`.tjp` existentes** | Nenhuma quebra (keyword nova; sem ela, default `duration`). |
| **Golden tests** | Comparar `charge` com `perday`/`perweek`/`permonth` no `tj3` usando `timebasis duration`. |
| **`timebasis length`** | Extensão explícita; o TJ não documenta a interação de `charge perday` com `workinghours`/`leaves`. |
| **Divergências** | Documentar em `known-divergences.json` e alinhar o default ao TJ. |

**Estratégia:** replicar o TJ primeiro no default, depois introduzir `timebasis length` como extensão. Se o TJ usar fórmula diferente (ex: binary gate em `perweek`), documentar a divergência e ajustar o default para replicar o TJ.

---

## 9. Decisões Consolidadas

### 9.1 Decisões da #6

| # | Decisão |
|---|---|
| 1 | Valores: `duration` (alias `calendar`) \| `length` (alias `working`) |
| 2 | Default do projeto: `duration` (replica TJ) |
| 3 | Scenario-specific: projeto **não**; tarefa **sim** |
| 4 | Resolução: `length` → implícito; `duration` → implícito; senão explícito; senão herda projeto; senão default |
| 5 | Erro `length` + `timebasis`: `task_overspecified` |
| 6 | Erro `duration` + `timebasis`: `task_overspecified` |
| 7 | `supplement (task)` aceita `timebasis` |
| 8 | `shift` na tarefa: usa `workinghours`/`leaves` do shift |
| 9 | Coluna `timebasis` em relatórios: sim (exibe valor resolvido) |
| 10 | `breakdownreport`/`rdoreport`: não usam diretamente |
| 11 | `timebasis` em `material`: não |

### 9.2 Decisões da #6a

| # | Decisão |
|---|---|
| 1 | `perhour`: sempre horas úteis, independente de `timebasis` |
| 2 | `perday`: escala com dias elegíveis (corridos ou úteis) |
| 3 | `perweek`/`permonth`: proporcional nas bordas; cheio nos completos sem feriado; proporcional nos completos com feriado (`length`); 0 se período inteiro sem dia útil (`length`) |
| 4 | Bordas: proporcionais, com denominador dependente do `timebasis` (dias corridos vs úteis do calendário) |
| 5 | Feriado em período completo (`length`): reduz o valor |
| 6 | Feriado em borda (`length`): reduz o valor |
| 7 | Período inteiro de férias (`length`): 0 |
| 8 | Total aproximado: aceito; calculado com base no `timebasis` (calendar ou working) |
| 9 | `weekStartsMonday`: importa em `perweek` |
| 10 | `distributed`/`distribution { ... }`: divide dias elegíveis cobertos |
| 11 | `workinghours`/`leaves` do projeto: influenciam apenas `timebasis length` |
| 12 | `leaves` de recurso: não influenciam |
| 13 | Divergência com TJ: default do projeto = comportamento TJ; documentar em `known-divergences.json` |
| 14 | Interpretação B: feriado em período completo reduz o valor em `length` |

---

## 10. Perguntas em Aberto

1. **`distribution { ... }` com resto:** se o número de dias elegíveis não for divisível por N, como distribuir o resto? **Sugestão:** a última parte absorve o resto; testar com N=3 e 10 dias.
2. **`perweek` com `weekStartsMonday` e `leaves` que cruzam semanas:** a semana é definida por `weekStartsMonday`; o `leave` é aplicado por dia. **Sugestão:** sim, cada dia é avaliado individualmente.
3. **`permonth` com meses de comprimentos diferentes:** aceitar a variação natural (proporcional aos dias reais). **Sugestão:** sim.
4. **`perhour` com `timebasis duration`:** confirmar que continua sendo horas úteis (não horas corridas). **Sugestão:** sim (decisão final).
5. **Coluna `timebasis` em relatórios:** exibir o valor canônico (`duration`/`length`) ou o alias (`calendar`/`working`)? **Sugestão:** canônico.
6. **`timebasis` em `supplement (project)`:** permitir sobrescrever o default do projeto via `supplement`? **Sugestão:** sim, como qualquer atributo de projeto.
7. **Mensagens de erro:** usar as mensagens sugeridas em §2.6 ou adaptar ao padrão do projeto? **Sugestão:** adaptar ao padrão do projeto (em inglês).

---

## 11. Critérios de Aceite

- [ ] `timebasis` implementado em `Task` e `Project`.
- [ ] Resolução do `timebasis` efetivo implementada (5 regras de §2.4).
- [ ] Erros `task_overspecified`, `illegal_timebasis`, `timebasis_not_supported` implementados.
- [ ] `resolvedTimebasis` armazenado em `TaskScenario` durante `prepareScheduling()`.
- [ ] `MaterialAllocation` e `ExtendedCharge.turnover()` consultam `resolvedTimebasis`.
- [ ] Regra unificada de distribuição implementada em módulo único (`distribution.ts` ou equivalente).
- [ ] `perday`, `perweek`, `permonth`, `distributed`, `distribution { ... }` seguem a tabela final (§3.5).
- [ ] `perhour` sempre horas úteis.
- [ ] Bordas proporcionais com denominador dependente do `timebasis`.
- [ ] `weekStartsMonday` respeitado em `perweek`.
- [ ] `shift` da tarefa influencia `timebasis length`.
- [ ] Coluna `timebasis` em relatórios exibe valor resolvido.
- [ ] Golden tests comparam com `tj3` no default (`timebasis duration`).
- [ ] Divergências documentadas em `known-divergences.json`.
- [ ] `deno task check-all` verde.
- [ ] Sem `any` em `src/`.

---

## 12. Resumo Executivo

| Item | Decisão |
|---|---|
| **#6 — `timebasis`** | `duration` (alias `calendar`, default) \| `length` (alias `working`) |
| **#6 — Resolução** | `length` → implícito; `duration` → implícito; senão explícito; senão herda projeto; senão default |
| **#6 — Erros** | `length`/`duration` + `timebasis` → `task_overspecified` |
| **#6 — Escopo** | Projeto (default) e Task (explícito); não em material/recurso/account |
| **#6a — `perhour`** | Sempre horas úteis |
| **#6a — `perday`** | Dias corridos (`duration`) ou úteis não feriados (`length`) |
| **#6a — `perweek`/`permonth`** | `amount × (dias elegíveis cobertos / dias úteis do calendário no período)` para `length`; `amount × (dias cobertos / dias do período)` para `duration` |
| **#6a — Feriado em período completo** | Reduz o valor em `length` (numerador menor); não afeta em `duration` |
| **#6a — Período inteiro de férias** | 0 em `length`; cheio em `duration` |
| **#6a — Bordas** | Proporcionais, denominador dependente do `timebasis` |
| **#6a — `distributed`/`distribution`** | Divide dias elegíveis cobertos |
| **#6a — `weekStartsMonday`** | Importa em `perweek` |
| **#6a — `shift`** | Influencia `timebasis length` |
| **#6a — `leaves` de recurso** | Não influenciam |
| **Compatibilidade TJ** | Default = TJ; `length` é extensão; divergências documentadas |

**Próximo passo:** com #6 e #6a fechadas, escrever as **tarefas atômicas** em `docs/syntaxmesh/fases/fase-10-complemento2-tarefas.md` (ou equivalente), seguindo `modelo-tarefas.md`, separadas por funcionalidade.