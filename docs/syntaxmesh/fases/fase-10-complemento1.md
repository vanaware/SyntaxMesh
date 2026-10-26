# 📋 Especificação Consolidada — 5 Funcionalidades Adicionais

> **Documento:** especificação completa para desenvolvimento
> **Base:** conversas sobre `journal`, `note`, `material`, `account`, BOM, RDO e relatórios
> **Estado do projeto:** Fase 10 (Parser) em andamento; Fases 1–9, 8.1 e 8.2 concluídas
> **Natureza:** camada periférica / modelo de domínio / parser / relatórios
> **Compatibilidade:** nenhuma quebra com `.tjp` existentes; extensões são sintaxe nova
> **Golden tests:** apenas regressão de funcionalidades originais do `tj3` (journal/note em task/resource/project) + testes novos para o que não existe no TJ

---

## 0. Confirmações

Antes de prosseguir preciso que verifique se o parser planejado e desenvolvido na fase 10 acabou incluindo as palavras chaves e modificações acrescentadas a funcionalidade original do taskjuggler que o syntaxmesh criou nas fases:
* docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
* docs/syntaxmesh/fases/fase-8.2-modelo-contabil-estendido.md

Se faltou fazer ajustes no parser recem desenvolvido favor listar as tarefas adicionais necessárias para tornar as novas funcionalidades compativeis com o parser e syntaxrules do syntaxmesh

## 1. Visão Geral

| # | Funcionalidade | Camada | Fases ancoradas | Novas keywords | Impacto no Core |
|---|---|---|---|---|---|
| 1 | `journalentry` em `material` (+ `work`/`remaining` via timesheet + `alert`) | Modelo + Journal + Sheets | 8.1, 10, 16, 18 | Não | Nenhum |
| 2 | `note` em `resource` e `material` | Modelo + Parser + Reports | 5, 8.1, 10, 14 | Não | Nenhum |
| 3 | `journalentry`, `note` e `supplement` em `account` | Modelo + Journal + Parser + Reports | 5, 10, 14, 16 | Não | Nenhum |
| 4 | `breakdownreport` — material + resource + charge por tarefa ou conta | Reports | 14 | **Sim** (`breakdownreport`) | Nenhum |
| 5 | Relatório fotográfico de RDO (Markdown + `picture` + `rdoreport`) | Modelo + Parser + Markdown + Reports + Storage | 10, 13, 14, 16, 18, 19 | **Sim** (`picture`, `rdoreport`, `format`) | Nenhum |

**Princípio comum:** todas as extensões **reutilizam palavras-chave existentes** (`journalentry`, `note`, `supplement`, `status`, `alert`, `summary`, `details`, `author`, `work`, `remaining`) e mudam apenas o **contexto** onde são aceitas, ou introduzem **poucas keywords novas** (`picture`, `rdoreport`, `breakdownreport`, `format`).

---

## 2. Funcionalidade Adicional #1 — `journalentry` em `material`

### 2.1 Descrição

Permitir que `journalentry` seja declarado dentro de um bloco `material` (e `supplement (material)`), com os mesmos comportamentos de `task` e `resource`: herança do projeto, status via timesheet/statussheet, e `alert` que contribui para o `alertLevel` do projeto.

### 2.2 Contextos

- `material` (nível do material)
- `supplement (material)` (suplemento de material)

### 2.3 Sintaxe

```taskjuggler
material "Steel" {
  unit "kg"
  unitPrice 25.0
  chargeset "Costs.Materials"

  journalentry 2026-10-15 "Recebimento de aço" {
    alert green
    summary "2 toneladas de aço recebidas"
    details -8<-
      Nota fiscal 1234. Material aprovado pelo controle de qualidade.
    ->8-
  }
}
```

E via `supplement`:

```taskjuggler
supplement material "Steel" {
  journalentry 2026-10-16 "Aço danificado" {
    alert red
    summary "1 tonelada danificada no transporte"
    details -8<-
      Será devolvida ao fornecedor. Impacto de 2 dias no cronograma.
    ->8-
  }
}
```

### 2.4 Decisões consolidadas

| Questão | Decisão |
|---|---|
| Herança do projeto | **Sim** — `material` herda `journalentry` do projeto, como `task`/`resource`. |
| Status via timesheet/statussheet | **Sim** — `material` aceita `status` (cor, `summary`, `details`, `alert`) via `timesheet`/`statussheet`. |
| `timesheet` de material aceita `work`/`remaining` | **Sim** — `work` (used) e `remaining` são aceitos. Material participa do cálculo de esforço realizado/restante. |
| Material contribui para `totalNetWorkingSlots` | **Não** — material não tem working hours; o `work` reportado não entra na validação de slots do período. |
| `journal_sub` em material | **Vira `journal`** (material é folha, sem filhos). |
| `alertLevel` no journal de material | **Sim** — contribui para `Journal.alertLevel` e é filtrável por `alerts_dep`/`alerts_down`. |
| Scenario-specific | **Não** para `journalentry` (como em `task`/`resource`). |

### 2.5 Impacto por camada

**Modelo (Fase 8.1):**
- `Material` deve ser `PropertyTreeNode` (ou equivalente) com `data[scIdx]` (`MaterialScenario`).
- `MaterialScenario` precisa de `effortdone`/`effortleft` (para `work`/`remaining` via timesheet).
- Adicionar `journal` como atributo de diário em `Material`.

**Parser (Fase 10):**
- Estender `rule_material` (prevista na Fase 8.1/8.2) para incluir `journalentry` no corpo.
- Criar `rule_supplementMaterial` (análoga a `rule_supplementTask` e `rule_supplementResource`).
- O scanner **não muda**.

**Journal (Fase 16):**
- `JournalEntry.property` passa a poder ser `Material`.
- Novo método: `Journal.entriesByMaterial(material, startDate?, endDate?, logExp?, alertLevel?): JournalEntryList`.
- `Journal.currentEntries`/`currentEntriesR`/`alertLevel`/`alertEntries` tratam `Material` como folha.
- `Journal.to_rti` aceita `Material` nos modos `journal`, `status_up`, `status_down`, `alerts_*`; `journal_sub` vira `journal`.

**Timesheet/Statussheet (Fase 18):**
- `TimeSheetRecord` aceita `material` como alvo de `work`, `remaining` e `status`.
- `TimeSheet`/`TimeSheets` **não** consideram material em `totalNetWorkingSlots` (só validam `work`/`remaining` individualmente).
- `SheetSender`/`SheetReceiver` listam `material` como propriedade que pode receber `work`/`remaining`/`status` no template.
- `TimeSheetSummary` agrega status de material.

**Reports (Fase 14):**
- Coluna `journal` (e variantes `journal_sub`, `alerts_*`) funciona em relatórios de material, se existirem.
- Coluna `effortdone`/`effortleft` funciona em relatórios de material.

### 2.6 Golden tests

- **Não há referência no `tj3`** (material não existe lá).
- Golden tests possíveis: garantir que `journalentry` e `status` em `task`/`resource`/`project` continuam funcionando após a mudança.

---

## 3. Funcionalidade Adicional #2 — `note` em `resource` e `material`

### 3.1 Descrição

Permitir que `note "<texto>"` seja declarado em `resource` (e `supplement (resource)`) e em `material` (e `supplement (material)`), com a mesma natureza do `note` de `task`: descrição estática, não datada, não afeta scheduler.

### 3.2 Contextos

- `resource`, `supplement (resource)`
- `material`, `supplement (material)`

### 3.3 Sintaxe

```taskjuggler
resource "Engineer" {
  rate 500
  note "Engenheiro civil responsável pela estrutura"
}

material "Steel" {
  unit "kg"
  unitPrice 25.0
  chargeset "Costs.Materials"
  note "Aço CA-50, bitola 10mm, fornecedor AçoBrasil"
}
```

### 3.4 Decisões consolidadas

| Aspecto | Decisão |
|---|---|
| Natureza | Estática, descritiva, não datada. **Não** é journal. **Não** afeta agendamento. |
| Herança do projeto | **Não** — específico da entidade. |
| Scenario-specific | **Não** — atributo único. |
| Coluna de relatório | **Sim** — `note` já existe como coluna para task; estender para resource e material. |

### 3.5 Impacto por camada

**Modelo (Fase 5 + Fase 8.1):**
- Adicionar `note` como `AttributeDefinition` em `Resource`.
- Adicionar `note` como `AttributeDefinition` em `Material`.

**Parser (Fase 10):**
- Estender `rule_resource` para aceitar `note`.
- Estender `rule_material` (Fase 8.1/8.2) para aceitar `note`.
- Criar `rule_supplementResource` (se não existir) e `rule_supplementMaterial` para aceitar `note`.
- O scanner **não muda**.

**Reports (Fase 14):**
- Coluna `note` já existe para task; estender para que funcione em relatórios de resource e material (se houver).

### 3.6 Golden tests

- **Não há referência no `tj3`** para `note` em resource/material.
- Golden tests possíveis: garantir que `note` em `task` continua funcionando.

---

## 4. Funcionalidade Adicional #3 — `journal`, `note` e `supplement` em `account`

### 4.1 Descrição

Permitir que `account` aceite `journalentry` e `note`, e que exista `supplement (account)` para adicionar atributos a uma conta já definida.

### 4.2 Contextos

- `account` (nível da conta)
- `supplement (account)` (suplemento de conta)

### 4.3 Sintaxe

```taskjuggler
account "Costs" {
  note "Conta de custos consolidados da obra"
  journalentry 2026-10-15 "Orçamento aprovado" {
    alert green
    summary "Orçamento adicional de R$ 50.000 aprovado"
    details -8<-
      Aprovação do cliente para custos extras de fundação.
    ->8-
  }
}

supplement account "Costs" {
  note "Atualizado após reunião de 2026-10-20"
  journalentry 2026-10-20 "Revisão de custos" {
    alert yellow
    summary "Revisão indica estouro de 5%"
    details -8<-
      Necessário replanejamento.
    ->8-
  }
  credit 2026-10-20 "Ajuste" 5000
}
```

### 4.4 Decisões consolidadas

| Aspecto | Decisão |
|---|---|
| `journalentry` em `account` | **Sim** — entrada datada, com `alert`, `summary`, `details`, `author`. |
| `note` em `account` | **Sim** — descrição estática, não datada. |
| `supplement account` | **Sim** — adiciona `journalentry`, `note` ou outros atributos a uma conta existente. |
| `supplement account` aceita `credit` | **Sim, apenas 1 vez** — segunda ocorrência gera erro. |
| `journalentry` em account contribui para `alertLevel` | **Sim**. |
| Scenario-specific | **Não** para `journalentry` e `note`; `credit` continua scenario-specific. |
| Herança do projeto | **Não** — específico da conta. |
| Impacto no cálculo financeiro | **Nenhum** — `journalentry` e `note` são qualitativos. |

### 4.5 Impacto por camada

**Modelo (Fase 5):**
- Adicionar `note` como `AttributeDefinition` em `Account`.
- Adicionar `journal` como atributo de diário em `Account`.

**Journal (Fase 16):**
- `JournalEntry.property` passa a poder ser `Account`.
- Novo método: `Journal.entriesByAccount(account, startDate?, endDate?, logExp?, alertLevel?): JournalEntryList`.
- `Journal.currentEntries`/`currentEntriesR`/`alertLevel`/`alertEntries` tratam `Account` como folha.
- `Journal.to_rti` aceita `Account`.

**Parser (Fase 10):**
- Estender `rule_account` para aceitar `journalentry` e `note`.
- Criar `rule_supplementAccount` com `journalentry`, `note` e `credit` (uma única vez).
- O scanner **não muda**.

**Reports (Fase 14):**
- Coluna `journal` funciona em relatórios de conta (se existirem).
- Coluna `note` idem.

### 4.6 Golden tests

- **Não há referência no `tj3`** para `journalentry`/`note` em account.
- Golden tests possíveis: regressão de `journalentry`/`note` em `task`/`resource`/`project`.

---

## 5. Funcionalidade Adicional #4 — `breakdownreport`

### 5.1 Descrição

Novo tipo de relatório que lista, de forma unificada, `material`, `resource` e `charge` que compõem os custos de uma tarefa ou de uma conta, com agrupamento configurável.

### 5.2 Sintaxe

```taskjuggler
breakdownreport "Orçamento por conta" {
  formats html, csv, json
  groupby account          # ou task
  period 2026-01-01 - 2026-12-31
  hidetask ~(id = "obra-central")
  hideaccount ~(id = "custos-indiretos")
  hideresource ~(id = "estagiario")
  hidejournalentry ~(alert = "green")
  columns name, materials, resources, charges, total
}
```

### 5.3 Atributos do `breakdownreport`

| Atributo | Obrigatório | Descrição |
|---|---|---|
| `formats` | Sim | `html`, `csv`, `json` (todos suportados). |
| `groupby` | Não | `account` (default) ou `task`. |
| `period` | Não | Período do relatório (default: período do projeto). |
| `hidetask <expr>` | Não | Filtro de tarefas. |
| `hideaccount <expr>` | Não | Filtro de contas. |
| `hideresource <expr>` | Não | Filtro de recursos. |
| `hidejournalentry <expr>` | Não | Filtro de entradas de diário. |
| `columns` | Não | `name`, `materials`, `resources`, `charges`, `total`. |

### 5.4 Saída

**Modo `groupby account` (default):**
Para cada conta, lista:
- Recursos que contribuíram (via `chargeset`), com esforço e custo.
- Materiais que contribuíram (via `chargeset`), com quantidade, preço unitário e total.
- Charges que contribuíram, com modo e valor.
- Total da conta.

**Modo `groupby task`:**
Para cada tarefa, lista:
- Recursos alocados, com esforço e custo.
- Materiais alocados, com quantidade, preço unitário e total.
- Charges da tarefa, com modo e valor.
- Total da tarefa.

**Formatos:** HTML (tabela hierárquica), CSV (linhas planas), JSON (estrutura aninhada).

### 5.5 Impacto por camada

**Reports (Fase 14):**
- Novo arquivo: `src/report/reports/BreakdownReport.ts`.
- Herda de `ReportBase` (Fase 14).
- Usa `AccountScenario.turnoverByType` (Fase 8.2) para separar `task`/`resource`/`material`.
- Usa `TaskScenario.turnover` e `ResourceScenario.turnover` (Fase 8.2) para detalhamento.
- Para materiais, usa `Material` (Fase 8.1) + `MaterialAllocation`.
- Gera HTML, CSV e JSON.

**Parser (Fase 10):**
- Adicionar `rule_breakdownReport` e `rule_breakdownReportAttributes`.
- O scanner **não muda** (`breakdownreport` é keyword nova).

**Modelo (Fase 8.2):**
- Nenhuma mudança — o relatório consome `turnoverByType` e `turnover` existentes.

### 5.6 Golden tests

- **Não há referência no `tj3`** (o TJ não tem esse relatório).
- Golden tests possíveis: garantir que `taskreport`, `resourcereport`, `accountreport` continuam funcionando.

---

## 6. Funcionalidade Adicional #5 — Relatório Fotográfico de RDO

### 6.1 Descrição

Permitir imagens em entradas de diário (`journalentry` e `status` de timesheet/statussheet) por **duas vias complementares** — Markdown inline em `details` e elemento `picture` dedicado — e criar um **novo relatório `rdoreport`** que gera o Diário de Obra a partir de um período selecionado, com filtros e limite de imagens configurável.

### 6.2 Sintaxe — Markdown em `details`

```taskjuggler
journalentry 2026-10-15 "Concretagem da laje" {
  alert green
  summary "Concretagem concluída conforme programado"
  format markdown
  details -8<-
    **Efetivo:** 15 pedreiros, 5 serventes.

    ![Vista geral da laje](fotos/laje-2pav-01.jpg)
    ![Detalhe da ferragem](https://exemplo.com/fotos/ferragem.jpg)
  ->8-
}
```

- **Default do `format`:** `markdown`.
- **Compatibilidade TJ:** `format richtext` para `.tjp` existentes.
- **URL absoluta** (`https://...`) → referência externa.
- **URL relativa** (`fotos/...`) → OPFS primeiro, fallback `dataDirs`.

### 6.3 Sintaxe — elemento `picture`

```taskjuggler
journalentry 2026-10-15 "Concretagem da laje" {
  alert green
  summary "Concretagem concluída conforme programado"
  details -8<-
    **Efetivo:** 15 pedreiros, 5 serventes.
  ->8-
  picture "fotos/laje-2pav-01.jpg" {
    caption "Vista geral da laje após concretagem"
    align center
    width 640
    alt "Laje do 2º pavimento concretada"
  }
  picture "fotos/laje-2pav-02.jpg" {
    caption "Detalhe da ferragem do 2º pavimento"
    align center
  }
}
```

**Atributos de `picture`:**

| Atributo | Obrigatório | Descrição |
|---|---|---|
| `"<caminho>"` | Sim | URL externa ou caminho relativo (OPFS). |
| `caption "<texto>"` | Não | Legenda exibida abaixo da imagem. |
| `align <left\|center\|right>` | Não | Alinhamento no relatório (default `center`). |
| `width <pixels>` | Não | Largura máxima em pixels. |
| `alt "<texto>"` | Não | Texto alternativo (acessibilidade). |

**Contextos de `picture`:**
- Dentro de `journalentry` (nível de `task`, `resource`, `material`, `account`, `project`).
- Dentro de `status` (em `timesheet`/`statussheet`).

**Semântica:** `picture` é uma entrada de mídia associada à entrada de diário; não é um `journalentry` separado. Múltiplos `picture` por entrada são permitidos, na ordem declarada, **sem limite**.

### 6.4 Novo relatório — `rdoreport`

```taskjuggler
rdoreport "RDO - Outubro 2026" {
  period 2026-10-01 - 2026-10-31
  formats html, json
  groupby date             # ou task, resource, material, account
  hidetask ~(id = "obra-central")
  hideaccount ~(id = "custos-indiretos")
  hideresource ~(id = "estagiario")
  journalmode journal
  journalattributes date, headline, summary, details, alert, author
  maxpictures 20
  columns name, resources, responsible, journal, pictures
}
```

**Atributos do `rdoreport`:**

| Atributo | Obrigatório | Descrição |
|---|---|---|
| `period <start> - <end>` | **Sim** | Período do RDO. |
| `formats html, json` | Sim | Formatos de saída. |
| `groupby` | Não | `date` (default), `task`, `resource`, `material`, `account`. |
| `hidetask <expr>` | Não | Filtro de tarefas. |
| `hideaccount <expr>` | Não | Filtro de contas. |
| `hideresource <expr>` | Não | Filtro de recursos. |
| `journalmode` | Não | `journal` (default), `status_up`, `status_down`, `alerts_*`. |
| `journalattributes` | Não | Campos exibidos (`date`, `headline`, `summary`, `details`, `alert`, `author`). |
| `maxpictures` | Não | Limite de imagens **no relatório** (default ilimitado). Sem limite na entrada. |
| `columns` | Não | `name`, `resources`, `responsible`, `journal`, `pictures`, `materials`, `charges`. |

**Saída HTML:** cada bloco (dia, tarefa, recurso, material ou conta) tem:
- Cabeçalho com identificação.
- Lista de entradas: `headline`, `summary`, `details`, `alert`, `author`.
- Galeria de imagens (Markdown + `picture`), respeitando `maxpictures`.
- Tabela de recursos/materiais/charges (se `columns` incluir).

**Saída JSON:** estrutura aninhada conforme `groupby`.

### 6.5 Decisões consolidadas

| Questão | Decisão |
|---|---|
| Suporte a Markdown em `details` | **Sim** — default `format markdown`. |
| Compatibilidade TJ | `format richtext` para `.tjp` existentes. |
| Imagens por URL externa | **Sim**. |
| Imagens por caminho relativo (OPFS) | **Sim** — OPFS primeiro, fallback `dataDirs`. |
| Elemento `picture` dedicado | **Sim**. |
| `picture` em `status` de timesheet | **Sim**. |
| Limite de imagens por entrada | **Sem limite**. |
| Limite de imagens no relatório | **Configurável via `maxpictures`** (default ilimitado). |
| Nome do relatório | `rdoreport`. |
| `groupby` padrão | `date`. |

### 6.6 Impacto por camada

**Modelo (Fase 16 + Fase 18):**
- `JournalEntry` ganha `pictures: Picture[]` e `format: 'markdown' | 'richtext'` (default `markdown`).
- `TimeSheetRecord.status` (JournalEntry) herda os mesmos campos.
- `Picture` é uma classe simples: `{ path, caption?, align?, width?, alt? }`.

**Parser (Fase 10):**
- Adicionar `rule_picture` e `rule_pictureAttributes`.
- Estender `rule_journalEntryAttributes` para aceitar `picture` e `format`.
- Adicionar `rule_rdoReport` e `rule_rdoReportAttributes`.
- O scanner **não muda** (`picture`, `rdoreport`, `format` são keywords novas).

**Markdown (Fase 13):**
- Já prevê sintaxe de imagem; adicionar resolução de caminho relativo (OPFS/`dataDirs`).

**Reports (Fase 14):**
- Novo arquivo: `src/report/reports/RdoReport.ts`.
- Herda de `ReportBase`.
- Usa `Journal.entriesByTask`/`entriesByResource`/`entriesByMaterial`/`entriesByAccount`.
- Usa `Markdown` (Fase 13) para renderizar `details`.
- Usa `Picture` para renderizar imagens.
- Gera HTML (template de RDO) e JSON.

**Storage (Fase 19):**
- Imagens em OPFS resolvidas via `FileStore.read` ou `URL.createObjectURL` a partir de um `Blob`.
- Imagens externas referenciadas por URL.

**App (Fase 20):**
- UI para selecionar período e gerar RDO.
- Visualização do RDO com galeria de imagens.

### 6.7 Golden tests

- **Não há referência no `tj3`** (RDO, `picture` e Markdown em `details` não existem lá).
- Golden tests possíveis:
  - Regressão: `journalentry` com `details` RichText continua funcionando (`format richtext`).
  - Regressão: `taskreport`, `resourcereport`, `accountreport` continuam funcionando.
  - Novo: `rdoreport` com fixtures controladas (sem comparação com `tj3`).

---

## 7. Impacto Consolidado por Fase

| Fase | Impacto | Arquivos prováveis |
|---|---|---|
| **5 — Entidades Concretas** | Adicionar `note` em `Resource` e `Account`; adicionar `journal` em `Account`. | `src/core/model/attributes/resource-attributes.ts`, `account-attributes.ts` |
| **8.1 — Nova func. custos** | Adicionar `journal` e `note` em `Material`; `MaterialScenario` precisa de `effortdone`/`effortleft`. | `src/core/model/material.ts`, `material-scenario.ts`, `material-allocation.ts` |
| **8.2 — Modelo contábil** | Nenhuma mudança direta (relatórios consomem `turnoverByType`). | — |
| **10 — Parser e Linguagem** | Estender `rule_material`, `rule_resource`, `rule_account`; criar `rule_supplementMaterial`, `rule_supplementAccount`; criar `rule_picture`, `rule_rdoReport`, `rule_breakdownReport`; adicionar `format` em `journalentry`. | `src/core/parser/rules/rules-*.ts` |
| **13 — Markdown** | Resolução de caminho relativo (OPFS/`dataDirs`). | `src/core/markdown/extensions/images.ts` |
| **14 — Relatórios** | Novo `BreakdownReport` e `RdoReport`; coluna `note` em resource/material; coluna `journal` em material/account; `maxpictures` no `rdoreport`. | `src/report/reports/breakdown-report.ts`, `rdo-report.ts`, `src/report/columns/*` |
| **16 — Apoio (Journal)** | `JournalEntry.property` aceita `Material` e `Account`; métodos `entriesByMaterial`, `entriesByAccount`; `pictures` e `format` em `JournalEntry`; `to_rti` estendido. | `src/journal/journal.ts`, `journal-entry.ts` |
| **18 — Time/Status Sheets** | `TimeSheetRecord` aceita material com `work`/`remaining`/`status`; `SheetSender`/`SheetReceiver` listam material; `TimeSheetSummary` agrega; `picture` em `status`. | `src/sheets/*.ts` |
| **19 — Storage** | Resolução de imagens OPFS. | `src/storage/projects/image-store.ts` |
| **20 — App** | UI de RDO (seleção de período, galeria). | `src/ui/views/RdoView.tsx` |

**Fases 1–4, 6, 7, 9, 11, 12, 15, 17, 21:** sem impacto direto.

---

## 8. Compatibilidade com TaskJuggler

| Funcionalidade | `.tjp` existentes | Golden tests |
|---|---|---|
| #1 — journal em material | Nenhum `.tjp` usa `material` (entidade nova). | Regressão de journal em task/resource/project. |
| #2 — note em resource/material | Nenhum `.tjp` usa `note` em resource (TJ rejeitaria). | Regressão de note em task. |
| #3 — journal/note em account | Nenhum `.tjp` usa `journalentry`/`note` em account (TJ rejeitaria). | Regressão de journal/note em task/resource/project. |
| #4 — `breakdownreport` | Nenhum `.tjp` usa a keyword (nova). | Regressão de taskreport/resourcereport/accountreport. |
| #5 — RDO (`picture`, `rdoreport`, `format`) | Nenhum `.tjp` usa essas keywords (novas); `format markdown` é novo, mas `format richtext` preserva compatibilidade. | Regressão de journal com `details` RichText; taskreport/resourcereport/accountreport. |

**Princípio:** todas as extensões são **sintaxe nova** que o `tj3` rejeitaria. Nenhuma `.tjp` existente quebra.

---

## 9. Ordem de Implementação Sugerida

```
1. #2 — note em Resource e Account (Fase 5)          [menor esforço]
   ↓
2. #3 — journal em Account + supplement account (Fase 5)
   ↓
3. #1 — journal e note em Material + effortdone/effortleft (Fase 8.1)
   ↓
4. #5 (parte 1) — picture + format no modelo (Fase 16/18)
   ↓
5. Parser: estender rule_resource, rule_account, rule_material, rule_supplement*
   ↓
6. Parser: rule_picture + rule_rdoReport + rule_breakdownReport (Fase 10)
   ↓
7. Journal: entriesByMaterial, entriesByAccount, pictures (Fase 16)
   ↓
8. Sheets: TimeSheetRecord aceita material (work/remaining/status) e picture (Fase 18)
   ↓
9. Markdown: resolução de caminho relativo (Fase 13)
   ↓
10. Reports: coluna note, coluna journal, BreakdownReport (Fase 14)
    ↓
11. Reports: RdoReport (Fase 14)
    ↓
12. Storage: resolução de imagens OPFS (Fase 19)
    ↓
13. App: UI de RDO (Fase 20)
    ↓
14. Golden tests de regressão (Fase 21)
```

---

## 10. Critérios de Aceite Consolidados

Cada funcionalidade só é considerada concluída quando:

- [ ] Modelo implementado (`AttributeDefinition` registrada, `JournalEntry` estendido).
- [ ] Parser implementado (regras estendidas/criadas).
- [ ] Journal implementado (métodos novos).
- [ ] Sheets implementado (quando aplicável).
- [ ] Markdown implementado (quando aplicável).
- [ ] Reports implementado (colunas/relatórios novos).
- [ ] Storage implementado (quando aplicável).
- [ ] App implementado (quando aplicável).
- [ ] Testes unitários (≥ 5 por funcionalidade).
- [ ] Golden tests de regressão (task/resource/project continuam funcionando).
- [ ] `deno task check-all` verde.
- [ ] `deno task test` verde.
- [ ] Sem `any` em `src/`.
- [ ] Documentação em `docs/syntaxmesh/fases/` atualizada.

---

## 11. Resumo Executivo

As cinco funcionalidades estendem o SyntaxMesh para cobrir **RDO** (journal em material, note em resource/material, journal/note em account, imagens via Markdown e `picture`, relatório `rdoreport`) e **orçamento/BOM** (relatório `breakdownreport`), sem tocar no Core de scheduling. Todas reutilizam palavras-chave existentes ou introduzem **poucas keywords novas** (`picture`, `rdoreport`, `breakdownreport`, `format`). Nenhuma `.tjp` existente quebra. Golden tests cobrem apenas regressão das funcionalidades originais do `tj3`.

**Decisões finais consolidadas:**
- `timesheet` de material aceita `work`/`remaining`; material **não** contribui para `totalNetWorkingSlots`.
- `journal_sub` em material vira `journal`.
- `note` em resource/material/account: não scenario-specific, não herda.
- `journalentry` em account contribui para `alertLevel`.
- `supplement account` aceita `credit` **uma única vez**.
- Keyword do breakdown: `breakdownreport`; agrupamento padrão `account`; todos os formatos; todos os filtros.
- `format` default `markdown`; `format richtext` para compatibilidade TJ.
- `rdoreport` com `period` obrigatório, `groupby date` default, `maxpictures` configurável (sem limite na entrada).
- Imagens: URL externa ou caminho relativo (OPFS primeiro, fallback `dataDirs`).
- `picture` válido em `journalentry` e em `status` de timesheet/statussheet.

**Próximo passo:** escrever as tarefas atômicas em `docs/syntaxmesh/fases/fase-10-complemento1-tarefas.md` (ou equivalente), seguindo `docs/syntaxmesh/fases/modelo-tarefas.md`, e atualizar `plano.md` e `README.md` com a nova fase.

## 12. Compatibilização Documentação

A fonte da verdade das especificações, planejamento e andamento do projeto de desenvolvimento do SyntaxMesh é o conteúdo das pastas: 
* docs/syntaxmesh/fases
* docs/syntaxmesh/decisoes

Precisamos ajustar tambem alguns arquivos para manter a coerencia da documentação geral do projeto:
* ajustar docs/syntaxmesh/fases/README.md (os arquivos fase-*- e fase-*-*tarefas.md são os que refletem especificação e andamento corretos)
* ajustar docs/syntaxmesh/fases/plano.md (os arquivos fase-*- e fase-*-*tarefas.md são os que refletem especificação e andamento corretos)
* ajustar docs/syntaxmesh/fases/fase-1-fundacao.md e docs/syntaxmesh/fases/fase-1-fundacao-tarefas.md (as funcionalidades ficarão todas em packages/core, não teremos mais separações em packages diferentes. teremos apenas: core, server, ui e service-worker)
* ajustar docs/syntaxmesh/fases/resumo-fase-1.md (incorporar junto com docs/syntaxmesh/fases/fase-1-fundacao.md  não manter este arquivo a parte)
* ajustar docs/syntaxmesh/fases/_ajustes-r1-r12.md (incorporar o desenvilvido aqui nas outras fases)
* arquivos docs/syntaxmesh/*-*.md (ajustar e manter total coerencia com o que temos em docs/syntaxmesh/fases e docs/syntaxmesh/decisoes - se for redundante avalie se é melhor transferir conteúdo para os arquivos já existentes lá)
* ajustar docs/syntaxmesh/README.md (ajustar e manter total coerencia com o que temos em docs/syntaxmesh/fases e docs/syntaxmesh/decisoes)
* ajustar /CURRENT.md, /README.md e /AGENTS.md ( precisa manter total coerencia com o que temos em docs/syntaxmesh/fases e docs/syntaxmesh/decisoes)
* avaliar possibilidade de exclusão do arquivos /debug_*.ts pois parecem ter sido de uso temporário , parecem que não fazem parte de rotinas de testes e nem do código princiapal e poderiam ser descartados


