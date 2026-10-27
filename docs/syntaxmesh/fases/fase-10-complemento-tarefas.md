# Fase 10 — Complemento: Tarefas Atômicas (extensões de domínio)

> **Arquivo:** `docs/syntaxmesh/fases/fase-10-complemento-tarefas.md`
> **Especificação:** `fase-10-complemento1.md` (funcionalidades #1–#5) + `fase-10-complemento2.md` (#6 `timebasis` e #6a distribuição temporal)
> **Escopo deste arquivo:** **apenas** as tarefas que tocam as **Fases 1–10** (modelo, núcleo/scheduler, parser, i18n de keywords, golden de parser). As tarefas de fases futuras (11–21) estão em **adendos** nos arquivos de cada fase.
> **Status:** ✅ Concluída (2026-10-27)
> **Concluídas:** Blocos C0–C4 implementados e testadas em `packages/core`. Modelo (`note`/`journal` em resource/account; `Material` registrado + `MaterialScenario` + `effortdone`/`effortleft`; `timebasis` + `resolveTimebasis` + `distribution.ts`), parser (`material`/`supplement material`/`note`/`journalentry`/`picture`/`format`/`timebasis`/`breakdownreport`/`rdoreport`/colunas novas/`hidejournalentry`), i18n (en/pt-BR/es com AST equivalente) e golden (regressão parser idêntica; fixtures de extensão). Suíte core: 279 testes / 2994 passos, 0 falhas; `golden:generate` idempotente; `fmt`/`lint`/`check` verdes. RichText (`note`) adiado para a Fase 12 (lança `NotYetImplementedError`).
> **Fonte Ruby:** nada no `tj3` para `material`/`picture`/`rdoreport`/`breakdownreport`/`timebasis` (extensões). `note`/`journalentry`/`supplement` **existem** no TJ (task/resource/account) — portar fiel o que existe, estender onde é novo.
> **Convenção:** seguir `docs/syntaxmesh/fases/modelo-tarefas.md` e as regras de `09-regras-para-ia.md`. Sem `any` em `src/`.

---

## ⚠️ PREÂMBULO — Leia antes de começar

### A. Confirmação pedida em `fase-10-complemento1.md` §0 (Fase 8.1/8.2 × parser)

Verificação feita no código de `packages/core/src/parser/` e `packages/core/src/model/` (2026-10-26):

| Item | Estado real | Consequência |
|---|---|---|
| `material` no parser | **NÃO existe.** Não há `rule_material`, `materialBody`, nem criação de `Material` a partir de `.tjp`. `Material` (Fase 8.1) é **só modelo** e usa um `PropertySet` temporário, não registrado no projeto. | Toda a integração de `material` ao parser é **nova** (Bloco C3). As specs #1/#2 assumeiam que `rule_material` já existia — não existe. |
| `note` | Só em **`task`** (`rules/task.ts`), como no TJ. | `note` em resource/account/material é **extensão** (Bloco C0/C3). |
| `journalentry` | Só em **`task`** (`rules/task.ts`). | `journalentry` em resource/material/account é **extensão**. |
| `supplement` | Existem `supplementTask`, `supplementResource`, `supplementAccount`, `supplementReport`. **Não** há `supplementMaterial`. | Criar `rule_supplementMaterial` (Bloco C3); estender `supplementAccount` p/ `journalentry`/`note`/`credit` (1×). |
| `AttributeDefinition` `note`/`journal` | Só em `task-attributes.ts`. | Adicionar em `resource-attributes.ts`, `account-attributes.ts` e (novo) `material-attributes.ts` (Bloco C0/C1). |
| `timebasis` | **Inexistente** (modelo, scheduler e parser). | Novo nos 3 lugares (Blocos C2/C3). |
| `picture`, `format`, `rdoreport`, `breakdownreport` | **Inexistentes.** | Parser + i18n + modelo novos (Bloco C3). |
| Modificadores `perday/perweek/permonth/…` | `ExtendedCharge` e `MaterialAllocation` já têm os tipos de modificador, mas o **cálculo não usa `workinghours`/`leaves`** — não há regra de `timebasis`. | Núcleo `distribution.ts` novo (Bloco C2). |

**Conclusão do §0:** a Fase 10 entregou o parser **genérico fiel ao TJ** e as regras dos blocos de entidade (task/resource/account/shift/scenario/report/tracking/logic), mas **não incluiu `material`** (porque a Fase 8.1 o definiu apenas como modelo). É necessário um **conjunto novo de tarefas de parser** (Bloco C3) para tornar `material` e as extensões (#1–#6a) compatíveis com `TjpSyntaxRules`.

### B. Regras transversais

- **Zero quebra de `.tjp` existentes:** toda keyword nova (`material`, `picture`, `format`, `timebasis`, `rdoreport`, `breakdownreport`) é **aditiva**. `note`/`journalentry`/`supplement` já existem e mantêm comportamento atual em `task`.
- **Golden:** só há oracle `tj3` para `note`/`journalentry`/`supplement (task|resource|account)` e para `charge` no **default** `timebasis duration`. Extensões puras (`material`, `picture`, `rdoreport`, `breakdownreport`, `timebasis length`) têm **testes novos**, sem comparação com TJ (regressão cobre o que existia).
- **Scanner:** as specs afirmam "o scanner não muda". Confirmado — as keywords novas entram como `:ID`/`:KEYWORD` normais; nenhuma mudança de modo. Se alguma keyword nova colidir com `ID`, resolver no `LanguageRegistry` (i18n), não no scanner.
- **i18n:** cada keyword nova precisa de entry canônica em `packages/core/src/i18n/{en,pt-BR,es}.ts` (Bloco C3.9) — sem isso, o `language` directive não a reconhece.

### C. Ordem de execução (dentro deste arquivo)

```
C0 (Fase 5 — modelo: note/journal em resource/account)
 ↓
C1 (Fase 8.1 — modelo: Material registrado + note/journal/effortdone/effortleft)
 ↓
C2 (Fase 5/7 — timebasis modelo + resolução + distribution.ts)
 ↓
C3 (Fase 10 — parser: material, supplementMaterial, note/journalentry estendidos,
     picture, format, timebasis, breakdownreport, rdoreport, keywords i18n, erros)
 ↓
C4 (Fase 10 — golden parser + regressão)
```

Dependências de **fases futuras** (fora deste arquivo, ver adendos): Journal #16, Sheets #18, Reports #14, Markdown #13, Storage #19, App #20, Compat #21.

---

## Bloco C0 — Modelo: `note` e `journal` em Resource e Account (Fase 5)

**⚠️ RUBY:** `lib/taskjuggler/Resource.rb` (o TJ **não** tem `note` em resource — extensão), `lib/taskjuggler/Account.rb` (idem). `note`/`journal` de **task** servem de referência de implementação (`model/attributes/task-attributes.ts`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C0.1 | Adicionar `note` como `AttributeDefinition` (StringAttribute, **não** scenario-specific, **não** herda) em `Resource` | `model/attributes/resource-attributes.ts` | `deno check` + 1 teste |
| C0.2 | Adicionar `note` (StringAttribute, não scenario) em `Account` | `model/attributes/account-attributes.ts` | idem |
| C0.3 | Adicionar `journal` (atributo de diário, lista de `JournalEntry`, não scenario) em `Account` — espelhar o `journal` de task | `model/attributes/account-attributes.ts` | `deno check` + 1 teste |
| C0.4 | Testes BDD: `note` em resource round-trip; `note`/`journal` em account; confirmar que **não** são scenario-specific (overwrite sem erro) | `tests/model/resource_test.ts`, `tests/model/account_test.ts` | 3+ testes |

**Fora de escopo C0:** parsing (C3), renderização em relatório (Fase 14).

---

## Bloco C1 — Modelo: `Material` como entidade de árvore + diário/nota/esforço (Fase 8.1)

**⚠️ RUBY:** não há no TJ (entidade nova). Referência de forma: `model/resource.ts` (PropertyTreeNode registrado) e `model/attributes/resource-attributes.ts`.

Hoje `Material` (`model/material.ts`) **não** é registrado em um `PropertySet` do projeto (usa um temporário). Para `journalentry`/`note`/`supplement material`/relatórios funcionarem, `Material` precisa ser um `PropertyTreeNode` de verdade, indexável por ID e navegável na árvore do projeto.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C1.1 | Registrar `Material` em um `PropertySet` do projeto (`project.materials`, `flatNamespace`); adicionar `materials` ao `Project` com os acessores análogos a `tasks`/`resources` | `model/material.ts`, `model/project.ts` | `deno check` + 1 teste |
| C1.2 | Criar `MaterialScenario` (`data[scIdx]`) com `effortdone`/`effortleft` (numéricos, scenario-specific) e pré-carregar via ADR 016 | `model/material-scenario.ts` | `deno check` + 2 testes |
| C1.3 | Adicionar `note` (StringAttribute, não scenario) e `journal` (lista de diário, não scenario) como `AttributeDefinition` de `Material` | `model/attributes/material-attributes.ts` (novo) | `deno check` + 2 testes |
| C1.4 | Migrar campos `unit`/`unitPrice`/`chargeset`/`totalQuantity` de `Material` para o padrão de atributos do `PropertyTreeNode` **ou** mantê-los como campos, mas garantir `getForScenario`/`setForScenario` coerente com o parser (C3) | `model/material.ts` | `deno check` |
| C1.5 | Testes BDD: material registrado no projeto é achado por ID; `effortdone`/`effortleft` herdam do pai; `note`/`journal` não-scenário | `tests/model/material_test.ts` | 4+ testes |
| C1.6 | Estender golden `attributes` para cobrir `note`/`journal`/`effortdone`/`effortleft` quando parseados (deixar placeholder p/ C4) | `scripts/golden/attributes.rb` | regenera sem quebra |

**Dependência:** C1 precede C3 (regras de `material` precisam do modelo registrado).

---

## Bloco C2 — `timebasis` (#6) e distribuição temporal (#6a) no modelo/núcleo

**⚠️ RUBY:** `lib/taskjuggler/Project.rb` (`maxScheduleGranularity`, `weekStartsMonday`), `Task.rb`/`TaskScenario` (`duration`/`length` como SymbolAttribute scenario-specific), `ExtendedCharge`/`MaterialAllocation` (sem equivalente direto no TJ). Ver `fase-10-complemento2.md` §2–§5.

### C2.a — Modelo (Fase 5): atributo `timebasis`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C2.1 | `timebasis` como `SymbolAttribute` **scenario-specific** em `Task` (valores canônicos `duration`/`length`; aliases `calendar`/`working` normalizados para canônico) | `model/attributes/task-attributes.ts` | `deno check` + 1 teste |
| C2.2 | `timebasis` como `SymbolAttribute` **não** scenario-specific no `Project` (default global) | `model/project.ts`, `model/attributes/*` | `deno check` + 1 teste |
| C2.3 | **Rejeitar** `timebasis` em milestone (helper de validação) — a regra de erro completa é no parser (C3.7) | `model/task.ts` | 1 teste |

### C2.b — Núcleo/Scheduler (Fase 7): resolução e distribuição

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C2.4 | Implementar `resolveTimebasis(task, project)` com as 5 regras de `complemento2` §2.4 (length→LENGTH; duration→DURATION; senão explícito; senão projeto; senão DURATION) | `model/task-scenario.ts` | 5 testes (um por ramo) |
| C2.5 | Armazenar o resultado em `TaskScenario.resolvedTimebasis` durante `prepareScheduling()`; **não** tocar em `scheduleSlot()` (timebasis não altera agendamento) | `model/task-scenario.ts` | 2 testes |
| C2.6 | Criar módulo central `accounting/distribution.ts` com a **regra unificada** §3.4: para `duration`, contar dias corridos; para `length`, dias úteis do calendário (via `workinghours`/shift) **menos** `leaves`; `perhour` sempre horas úteis | `accounting/distribution.ts` (novo) | 6+ testes |
| C2.7 | `perweek`: respeitar `project.weekStartsMonday`; `permonth`: mês calendário; bordas proporcionais com denominador conforme `timebasis` (§3.4.3/§3.4.4) | `accounting/distribution.ts` | testes dos exemplos §4.4/§4.5 |
| C2.8 | `distributed` e `distribution { … }`: dividir **dias elegíveis cobertos**; soma das frações = 1.0 (validado Fase 8.1); **resto** absorvido pela última parte (resolver pergunta aberta §10.1 — decisão: última parte) | `accounting/distribution.ts` | testes §4.8/§4.9 |
| C2.9 | Se a tarefa tem `shift`, usar `workinghours`/`leaves` do **shift** (não do projeto) no modo `length` (§2.7) | `accounting/distribution.ts`, `model/task-scenario.ts` | 2 testes |
| C2.10 | Fazer `ExtendedCharge.turnover()` e `MaterialAllocation` consultarem `resolvedTimebasis` e delegarem ao `distribution.ts` (substituir cálculo ad-hoc atual) | `model/extended-charge.ts`, `model/material-allocation.ts` | regressão dos testes 8.1 |
| C2.11 | `leaves`/`workinghours` de **recurso** NÃO influenciam (task-centric) — asserir em teste | `accounting/distribution.ts` | 1 teste |
| C2.12 | Golden de regressão: `charge perday/perweek/permonth` no **default** `duration` bate com `tj3` (estender `scripts/golden/finance-*.rb`); divergências `length` vão para `known-divergences.json` | `scripts/golden/finance-variations.rb`, `packages/core/tests/golden/known-divergences.json` | `deno task golden:generate && deno task test` verde |

**Fora de escopo C2:** parsing de `timebasis` (C3), coluna de relatório (Fase 14).

---

## Bloco C3 — Parser: extensões de sintaxe (Fase 10)

**⚠️ RUBY:** `lib/taskjuggler/TjpSyntaxRules.rb` — usar `rule_taskNote`/`rule_journalEntry`/`rule_supplement*` como molde; `material`/`picture`/`rdoreport`/`breakdownreport`/`timebasis` são **novos** (inventar o mínimo, seguir forma das regras existentes). Toda regra nova vai ao bloco correto em `parser/rules/`. Registrar keyword canônica no `LanguageRegistry` (C3.9).

### C3.1 — `material` e `supplement material` (funcionalidade #1 + #2)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C3.1.1 | `rule_material` + `materialBody`: `material <id?> "<nome>" { … }` aceitando `unit`, `unitPrice`, `chargeset`, `totalQuantity`, `note`, `journalentry`, `allocate`/`use` (allocation p/ task) | `parser/rules/material.ts` (novo) | parse + 1 teste |
| C3.1.2 | `rule_materialId`, `rule_materialName`, `rule_materialAllocation` (uso em task: `material "<aço>" 100 unit`) | `parser/rules/material.ts` | 2 testes |
| C3.1.3 | `rule_supplementMaterial` (análogo a `supplementResource`), registrado no dispatch de `rule_supplement` (`common.ts`); aceita `note`, `journalentry`, atributos de material | `parser/rules/common.ts`, `parser/rules/material.ts` | 1 teste |
| C3.1.4 | Wire `material` no `projectBody`/top-level (hoje só task/resource/account/shift/scenario/report entram) | `parser/rules/project.ts` | teste de integração |

### C3.2 — `note`/`journalentry` em resource e account (#2, #3)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C3.2.1 | Estender `rule_resourceBody`/`resourceAttributes` para aceitar `note` (porta de `rule_taskNote`) | `parser/rules/resource.ts` | 1 teste |
| C3.2.2 | Estender `rule_accountBody`/`accountAttributes` para aceitar `note` e `journalentry` | `parser/rules/account.ts` | 2 testes |
| C3.2.3 | `rule_supplementAccount`: adicionar `journalentry`, `note` e **`credit` uma única vez** (segunda → erro `attribute_overwrite`/`supplement_credit_dup`) | `parser/rules/common.ts` | 2 testes (ok + duplicado) |

### C3.3 — `picture` e `format` em `journalentry`/`status` (#5, parte parser)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C3.3.1 | `rule_picture` + `pictureAttributes`: `picture "<caminho>" { caption/align/width/alt }`; `align` ∈ `left|center|right`; `width` inteiro | `parser/rules/journal.ts` (novo ou em task.ts) | 2 testes |
| C3.3.2 | `rule_format`: `format markdown` (default) / `format richtext`; anexar flag ao `JournalEntry`/`status` corrente | `parser/rules/journal.ts` | 2 testes |
| C3.3.3 | Estender `rule_journalEntryAttributes` para aceitar `picture` e `format` | `parser/rules/task.ts` | teste |
| C3.3.4 | `status` em timesheet/statussheet aceitar `picture`/`format` (**estrutura**; consumo de sheet na Fase 18) | `parser/rules/tracking.ts` | 1 teste |
| C3.3.5 | Modelo: `JournalEntry` ganha `pictures: Picture[]` e `format: 'markdown'|'richtext'`; criar classe `Picture { path; caption?; align?; width?; alt? }` | `model/journal.ts`, `model/picture.ts` (novo) | 2 testes |

### C3.4 — `timebasis` no parser (#6)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C3.4.1 | `rule_timebasis`: aceita `duration|calendar|length|working` → normaliza p/ canônico (`complemento2` §2.2) | `parser/rules/common.ts` | 2 testes |
| C3.4.2 | Estender `rule_taskScenarioAttributes` (aceita `timebasis`) e `rule_projectBodyAttributes` (default global) | `parser/rules/task.ts`, `parser/rules/project.ts` | 2 testes |
| C3.4.3 | Erros (§2.6): `task_overspecified` (length/duration + timebasis), `illegal_timebasis`, `timebasis_not_supported` (milestone/material) | `parser/rules/task.ts`, `model/errors` (se necessário) | 3 testes |

### C3.5 — `breakdownreport` (#4)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C3.5.1 | `rule_breakdownReport` + `rule_breakdownReportAttributes`: `formats`, `groupby account|task`, `period`, `hidetask/hideaccount/hideresource/hidejournalentry <expr>`, `columns` | `parser/rules/report.ts` | 2 testes |
| C3.5.2 | `rule_breakdownReport` entra no dispatch de reports (registro `newReport("breakdownreport", …)`) | `parser/rules/report.ts`, `model/report.ts` | teste de integração |

### C3.6 — `rdoreport` (#5, parte parser)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C3.6.1 | `rule_rdoReport` + `rule_rdoReportAttributes`: `period` **obrigatório**, `formats`, `groupby date|task|resource|material|account`, filtros `hide*`, `journalmode`, `journalattributes`, `maxpictures`, `columns` | `parser/rules/report.ts` | 2 testes |
| C3.6.2 | Validar `period` ausente → erro `rdo_period_required` | `parser/rules/report.ts` | 1 teste |
| C3.6.3 | Registrar `rdoreport` no dispatch de reports | `model/report.ts` | teste |

### C3.7 — Colunas/expressões de filtro novas nos reports (parser só aceita; execução na Fase 14)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C3.7.1 | Aceitar `materials`, `resources`, `charges`, `pictures`, `note`, `journal`, `timebasis` como nomes de coluna válidos em `columns` de breakdown/rdo/taskreport | `parser/rules/report.ts` | 2 testes |
| C3.7.2 | Aceitar `hidejournalentry <expr>` na gramática (a avaliação da expressão é Fase 11) | `parser/rules/report.ts` | 1 teste |

### C3.8 — Scanner: confirmação de que **não** muda

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C3.8.1 | Asserir que `material/picture/format/timebasis/breakdownreport/rdoreport` lexicam como `:KEYWORD`/`:ID` sem novos modos; adicionar teste de tokenização | `tests/lexer/scanner_test.ts` | 1 teste |

### C3.9 — i18n: keywords canônicas novas (en/pt-BR/es)

| # Tarefa | Arquivos | Verificação |
|---|---|---|
| C3.9.1 | Adicionar entradas canônicas p/ **todas** as keywords novas (`material`, `unit`, `unitprice`, `picture`, `caption`, `align`, `width`, `alt`, `format`, `markdown`, `richtext`, `timebasis`, `duration`, `calendar`, `length`, `working`, `breakdownreport`, `groupby`, `rdoreport`, `journalmode`, `journalattributes`, `maxpictures`, `materials`, `charges`, `pictures`) em `en` | `i18n/en.ts`, `i18n/canonical.ts` | `deno check` |
| C3.9.2 | Traduzir as mesmas em `pt-BR` e `es` (ex.: `material`→`material`, `picture`→`foto`/`imagen`, `timebasis`→`base_temporal`/`base_temporal`) | `i18n/pt-BR.ts`, `i18n/es.ts` | testes de registry |
| C3.9.3 | Teste de equivalência de AST: um `.tjp` com as keywords novas parseia **igual** em en/pt-BR/es | `tests/ast-equivalence_test.ts` | 3+ testes |

**Fora de escopo C3:** renderização RichText/Markdown de `details` (Fase 12/13), avaliação de expressões `hide*` (Fase 11), cálculo dos relatórios (Fase 14).

---

## Bloco C4 — Golden tests e regressão do parser (Fase 10)

**⚠️ RUBY:** só há oracle para o que existe no TJ. Extensões usam fixtures próprias.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| C4.1 | Scripts `parser-material*.rb` (ou fixtures TS) para os novos blocos que **existem no TJ** (`note`/`journalentry`/`supplement account` com `credit`) — golden comparativo | `scripts/golden/parser-*.rb` | regenera |
| C4.2 | Fixtures de extensão (sem oracle TJ): `material` + `journalentry` + `picture`; `timebasis` (5 ramos); `breakdownreport`; `rdoreport` | `packages/core/tests/fixtures/ext/` (novo) | carregam |
| C4.3 | Testes golden de **regressão**: garantir que `note`/`journalentry` em **task** e `supplement (task|resource|account)` continuam 100% após as mudanças | `tests/golden/parser_golden_test.ts` | verde |
| C4.4 | Testes golden de **regressão financeira**: `charge` default `duration` idêntico a antes (não introduzir `timebasis` no default) | `tests/golden/finance_golden_test.ts` | verde |
| C4.5 | `deno task check:all` + `deno task golden:generate` + `deno task test` verdes | — | exit 0 |

---

## Critérios de aceite deste arquivo (só o que toca Fases ≤ 10)

- [x] `Material` é `PropertyTreeNode` registrado no projeto (`project.materials`).
- [x] `note` existe em resource/account/material; `journal`/`journalentry` em account/material; `effortdone`/`effortleft` em `MaterialScenario`.
- [x] `timebasis` existe (modelo) e `resolveTimebasis` roda no `prepareScheduling` sem alterar o agendamento.
- [x] `distribution.ts` implementa §3.4–§3.5 (perday/perweek/permonth/distributed/distribution; perhour sempre útil; bordas proporcionais; `weekStartsMonday`; shift; leaves de recurso não contam).
- [x] Parser aceita `material`/`supplement material`/`note`/`journalentry` (resource/account/material)/`picture`/`format`/`timebasis`/`breakdownreport`/`rdoreport` e os erros novos.
- [x] Keywords novas presentes em en/pt-BR/es com AST equivalente.
- [x] Regressão de `.tjp` existentes: **zero quebra** (golden task/finance idênticos).
- [x] Sem `any` em `src/`; `check:all`/`test`/`golden:generate` verdes.

> **Referências cruzadas (fases futuras — ver adendos):** #16 Journal (`entriesByMaterial`/`entriesByAccount`, `pictures`/`format` na API), #18 Sheets (material `work`/`remaining`/`status`, `picture` em status), #13 Markdown (imagens OPFS/`dataDirs`), #14 Reports (`BreakdownReport`/`RdoReport`, colunas `note`/`journal`/`timebasis`/`pictures`), #19 Storage (image store OPFS), #20 App (tela RDO), #21 Compat (golden de extensão).

---

**Fim das tarefas complementares que tocam as Fases 1–10.**
