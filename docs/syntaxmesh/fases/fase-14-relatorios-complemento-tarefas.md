# Fase 14 Complemento — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-14-relatorios-complemento.md`
> **Status:** ✅ Concluída (C0 2026-10-31; C1–C7 2026-11-01; C8–C12 2026-11-01; C13–C17 em desenvolvimento)
> **Total:** 177 tarefas
> **Concluídas:** 145
> **Fonte Ruby (parcial):** `docs/taskjuggler/lib/taskjuggler/reports/MspXmlRE.rb` +
> `Journal.rb` + `AlertLevelDefinitions.rb` (o restante — materialreport,
> breakdown, RDO, markdown em reports — são **extensões SyntaxMesh sem oracle**)

---

## Checklist de progresso

```
[x] 14C.0 Fundação (json, journal-index, alert-levels, picture-render, dispatch) — 12
[x] 14C.1 Materiais nos relatórios existentes + materialreport                   — 22
[x] 14C.2 BreakdownReport (absorve 14.25.1–5)                                   — 10
[x] 14C.3 RdoReport + galeria de imagens (absorve 14.25.6–10)                   — 14
[x] 14C.4 MspXml → MSPDI (mspdi.md)                                             — 16
[x] 14C.5 Markdown nos relatórios                                               — 12
[x] 14C.6 hidematerial/rollupmaterial/hidepicture + auditoria hide/rollup       — 10
[x] 14C.7 Golden/fixture + verificação final + docs                             — 8
[x] 14C.8 Saída markdown (`formats markdown` + `md*report`)                   — 8
[x] 14C.9 `defaultaccount` (universal + variantes) + `to_rti` × 4              — 8
[x] 14C.10 MSPDI `<Baseline>` via `baseline <scenario>`                        — 7
[x] 14C.11 Unit price por alocação/booking + remoção de `totalquantity`       — 12
[x] 14C.12 Auditoria G1.4 (scheduler) + verificação do adendo                 — 6
[ ] 14C.13 Booking de estoque (sem tarefa, quantidade ±)                      — 8
[ ] 14C.14 Unit price calculado por composição                                 — 7
[ ] 14C.15 Keywords opcionais + `booking charge`                               — 8
[ ] 14C.16 Turnover com precedência de unit price                              — 5
[ ] 14C.17 Cenários: registro do comportamento real                            — 4
─────────────────────────────────────────────────────────
TOTAL: 177
```

**Ordem:** C0 → C1 → C2 → C3 → C4 → C5 → C6 → C7 → **C8 → C9 → C10 → C11 → C12**
(adendo §10 do plano). C4 e C5 independem de C2/C3 (podem paralelizar).
C6.5+ depende de C2/C3 (aplica hide nos novos geradores). C8–C12 vêm depois
de C7 porque o adendo só foi escrito ao final da fase.
**C13 → C14 → C15 → C16 → C17** (Adendo Extra §12): C14 depende de C13
(mesma regra de booking no corpo do material), C16 depende de C13 + C14
(turnover consome os dois), C17 é independente.

## Convenções (herdam a Fase 14)

1. **ADR 027**: toda saída é string/estrutura em memória; zero disco, zero DOM.
2. **Sem `any`** — `unknown` + type guards.
3. **BDD** (`@std/testing/bdd`) + `@std/assert`; testes proporcional a cada tarefa.
4. **Commit por sub-bloco**: `feat(reports-14c): material-list-re`, etc.
5. **Regressão obrigatória a cada bloco**: `deno task check:all` + suíte +
   `reports.golden.json`/`parser.golden.json` inalterados.
6. **Stub novo = âncora** (`// Ancorado: Fase N — razão`) validada por
   `deno task check:stubs`.
7. **Não tocar** em Gantt (15/16), sheets (18) ou storage (19) — registrar
   requisitos e seguir.
8. Extensões **sem oracle tj3** usam fixtures determinísticos + snapshots
   próprios (`reports-extensions.golden.json`), nunca comparação subjetiva.

---

## 14C.0 — Fundação

> Prepara o terreno consumido por todos os blocos. Inclui dois
> **bring-forwards** justificados do plano (§6): índice do Journal e
> alert-levels mínimos (dona: Fase 16 — a 16 herda e estende).

### 14C.0.A — Formato `json` de primeira classe

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.0.1 | `ReportType.Json` não existe — adicionar ramo `case "json"` no switch de `Report.generate()` que delega a `content.toJSON()` (novo método opcional no contrato de conteúdo) e grava string em `output` | `model/report.ts`, `model/report-content.ts` | 2 testes (formato json roteado; formato desconhecido ainda lança) |
| 14C.0.2 | Estender o contrato de conteúdo (`ReportContent`) com `toJSON?(): string` e registrar `json` nos formatos aceitos pelo parser de `formats` (verificar gramática atual em `parser/rules/report.ts`) | `model/report-content.ts`, `parser/rules/report.ts` | `deno check` + 1 teste parser |
| 14C.0.3 | `TextReport`/`TableReport`: `toJSON()` serializando o formato intermediário (colunas + linhas, células com texto normalizado) — estrutura estável e documentada | `reports/table-report.ts` | 3 testes (célula texto, especial `calendario` vira descritor, legenda ausente em json) |

### 14C.0.B — Índice do Journal (bring-forward Fase 16)

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.0.4 | `Journal.addEntry` mantém índices `entriesByTask/Resource/Material/Account` (Map `PropertyTreeNode → JournalEntry[]`, ordenados por data; entradas com `property` null ignoradas) + `entriesByDate(start,end)` por intervalo | `model/journal.ts` | 4 testes (um por tipo + intervalo de datas) |
| 14C.0.5 | Remoção consistente: hook quando entidade/entrada é destruída (espelhar `Journal.rb` `removeEntry`); não vazar entradas de entidades removidas | `model/journal.ts`, `model/property-tree-node.ts` (se necessário) | 1 teste |
| 14C.0.6 | Comentar no topo de `journal.ts` que a Fase 16 (adendo 16.21) herda e estende os índices (flags/status de timesheet) | `model/journal.ts` | doc |

### 14C.0.C — Alert levels mínimos (bring-forward) + Picture→HTML

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.0.7 | `AlertLevelDefinitions` mínimo: palette default do TJ (`none/red/blue/green/orange/yellow/violet` + level 0–6) como módulo; parser já valida os nomes — conferir e ligar a validação ao módulo | `model/alert-levels.ts` (novo), `parser/rules/journal.ts` | 2 testes |
| 14C.0.8 | `Picture.to_html()`: `<img>` com `src` resolvido (URL externa intacta; relativo → `resolveImageRef`/`ImageStore` de 13.14, core devolve descritor com `src` relativo preservado), `alt`, `width`, e wrapper `<figure>/<figcaption>` para `caption`; `align` via classe | `model/picture.ts` | 4 testes (externa, relativa-caption, align, sem caption/alt) |
| 14C.0.9 | Galeria helper `picturesToHtml(pictures, maxPictures?)`: corta **só a saída** (`maxpictures`), nunca a entrada; retorna string HTML | `reports/gallery.ts` (novo) | 2 testes (limite respeitado; ilimitado default) |

### 14C.0.D — Registro no dispatch

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.0.10 | Adicionar `materialreport`, `breakdownreport`, `rdoreport` ao `ReportType` enum + `KNOWN_TYPE_SPECS` (ainda sem fábrica → `NotYetImplementedError` **ancorado "14C"** temporário para falhar com mensagem de plano, não `Unknown report type`) | `model/report.ts` | 2 testes |
| 14C.0.11 | Fixture `.tjp` base do complemento: projeto com materiais, allocations, charges (flat/perCost), journalentries com `picture`/`format markdown` em task/resource/material/account — `packages/core/tests/fixtures/ext/14c-rdo-budget.tjp` (convênio existente de fixtures de extensão; `golden/fixtures/` não existia) | fixture | carregável por `ProjectFileParser` (2 testes em `extension-fixtures_golden_test.ts`) |
| 14C.0.12 | Runner de snapshots de extensão: `generate_extension_golden.ts` (TS puro, determinístico, idempotente byte-a-byte) escrevendo `reports-extensions.golden.json`; wiring em `golden:generate` + README | `tests/golden/`, `deno.jsonc`, `scripts/golden/README.md` | rodar 2× e comparar bytes |

---

## 14C.1 — Materiais nos relatórios existentes + `materialreport`

> Vereditos do pedido (analisar cada relatório da lista original). Colunas
> `note`/`journal` em material/account e `timebasis` canônica absorvem
> **14.25.11–13**.

### 14C.1.A — Auditoria de colunas já existentes

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.1.1 | Auditar colunas entregues pela 10-C C4 (`totalcost`, `totalrevenue`, `cost`, `revenue`, `net`, `benefit`, `vat`, `remainingcost`, `unitprice`, `materials`?) já registradas em `TableReport`/REs; listar lacuna material↔coluna numa tabela neste doc (correções viram 14C.1.1x) | `reports/table-report.ts`, `reports/task-list-re.ts`, `reports/resource-list-re.ts`, `reports/account-list-re.ts` | grep + tabela preenchida |

#### Vereditos da auditoria 14C.1.1 (preenchido 2026-10-31)

| Coluna | Em `TableReport.propertiesById`? | Value pipeline hoje | Lacuna / ação |
|---|---|---|---|
| `cost`, `revenue`, `balance` | ✅ (idêntico ao Ruby, 47 entradas) | via `Query.process` → `query_*`/atributo + `query.to_rti()` (`table-report.ts:779/809`) | nenhuma — núcleo já portado; material entra **indiretamente** via `CostEvent`/`turnoverByType` (14C.1.19) |
| `totalcost`, `totalrevenue`, `net`, `benefit`, `vat`, `remainingcost` | ❌ — **não existem no Ruby tampoco** (grep 0 hits em `TableReport.rb`/`TaskListRE.rb`); a menção da 10-C era aspiracional | n/a | **sem correção**: não são colunas tj3; se um dia vierem, serão extensão própria |
| `unitprice`, `allocations` | ❌ (não existem no Ruby) | n/a | exclusivo do futuro `MaterialListRE` (14C.1.5) — colunas próprias, pipeline próprio |
| `materials` | ❌ no mapa; parser aceita o keyword (`rules/report.ts:2274`) | célula cai no fallback de atributo → Task **não** tem atributo `materials` → célula vazia hoje | 14C.1.11: handler de coluna em `TaskListRE` + (`query_materials` ou processo direto) |
| `materialcost`, `charges` | ❌ mapa; keyword aceito no parser | idem | 14C.1.11 / MaterialListRE (14C.1.5–6) |
| `journal`, `journal_sub`, `journalmessages`, `journalsummaries` | ✅ no mapa (igual Ruby) | Ruby resolve por `Journal#to_rti(query)` dispatchando `query.journalMode`; **`to_rti` do Journal não está portado** no TS (`model/journal.ts` não o tem) | 14C.1.7 precisa portar `to_rti` + `entriesBy*` com intervalo/hide (índices de 14C.0.4 já prontos) e estender p/ Material/Account |
| `note` | ❌ mapa (Ruby também não tem; vem do atributo RichText `note`) | via atributo do PTN — funciona em task/resource; material/account têm o atributo (10-C C3.2) mas nenhuma RE o lista | 14C.1.8 |
| `timebasis` | ❌ mapa; keyword aceito | atributo de cenário `timebasis` existe (`resolvedTimebasis`) | 14C.1.9 (absorve 14.25.13) |
| REs existentes | — | `task/resource/account-list-re.ts` **zero** referências a material | 14C.1.11–19 |
| `Query` sobre Material | — | `Query.process` é genérico por PTN; `Material` não define `query_*` p/ unitprice/allocations | 14C.1.20 (testar; estender se faltar) |

### 14C.1.B — `materialreport` (novo, extensão SyntaxMesh)

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.1.2 | Parser: `rule_materialReport` (agregador de reports, análogo `resourcereport`; aceita `columns`, `formats html/csv/json`, `hideresource`, `hidetask`, `sortby`) em `parser/rules/report.ts` + keyword no `TjpSyntaxRules` | `parser/rules/report.ts` | 2 testes de parse |
| 14C.1.3 | i18n `materialreport` (canonical + en/pt-BR/es) com AST equivalente | `src/i18n/*` | teste i18n 3 idiomas |
| 14C.1.4 | `MaterialListRE extends ReportBase` (`reports/material-list-re.ts`) iterando `project.materials`; registrar `registerContentFactory("materialreport")` + export em `reports/mod.ts` | `reports/material-list-re.ts`, `reports/mod.ts` | teste de registro/dispatch |
| 14C.1.5 | Colunas do material: `name`, `id`, `note`, `unit`, `unitprice`, `allocations` (tarefas que consomem, com quantidade), `scheduledcost`, `actualcost`, `totalcost`, `journal` | `reports/material-list-re.ts` | 6 testes |
| 14C.1.6 | Cálculo de custos de material via `CostEvent`/`MaterialAllocation` (8.1/8.2) — aggregação por período do report quando `period` presente | idem | 2 testes |
| 14C.1.7 | Coluna `journal` funcional em **material e account** (variantes `journal_sub`, `journalmessages`, `journalsummaries`) reutilizando o mecanismo de task/resource já portado | `reports/table-report.ts` | 3 testes (absorve 14.25.12) |
| 14C.1.8 | Coluna `note` estendida a material/account (modelo já existe, C0/C1 da 10-C) | `reports/table-report.ts` | 2 testes (absorve 14.25.11) |
| 14C.1.9 | Coluna `timebasis` exibindo `TaskScenario.resolvedTimebasis` canônico (`duration`/`length`) | `reports/table-report.ts` | 1 teste (absorve 14.25.13) |
| 14C.1.10 | HTML/CSV/JSON do `materialreport` (intermediário `ReportTable` → `generate*` existentes + `toJSON` de 14C.0.1) | — | 2 testes |

### 14C.1.C — Materiais nos relatórios existentes (vereditos)

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.1.11 | `taskreport`: coluna `materials` (nomes + quantidades das alocações da tarefa via `MaterialAllocation`) e `materialcost` (soma de `CostEvent` de material da tarefa) | `reports/task-list-re.ts`, `model/task.ts` (se faltar accessor) | 3 testes |
| 14C.1.12 | `textreport`: confirmar herança das colunas de taskreport (materiais/custos/accounts funcionam) | `reports/text-report.ts` | 1 teste com fixture 14c |
| 14C.1.13 | `export`/`TjpExportRE`: exportar `material { ... }` + `materialallocations` (+ flags) respeitando `hidematerial` (C6) quando presente; round-trip parse→export→parse | `reports/tjp-export-re.ts` | 2 testes (round-trip; sem material = saída inalterada) |
| 14C.1.14 | `tracereport`: aceitar atributos de material via Query (`<-name->` etc.) quando a coluna aponta para material; registrar suporte de `hidematerial` (aplicação em C6) | `reports/trace-report.ts` | 1 teste |
| 14C.1.15 | `resourcereport`: veredito documentado — recursos humanos não listam materiais (material não é booking); adicionar coluna opcional `materialcost`? **Não** (fora de escopo), registrar motivo | nota neste doc | doc |
| 14C.1.16 | `icalendar`/`niku`/`tagfile`/`chartplotter`: veredito documentado — calendários/stacks são centrados em tarefas/recursos; material não tem scoreboard próprio → **sem integração**; registrar | nota neste doc | doc |
| 14C.1.17 | `"Calendar" Report` (weekly/monthly): veredito — grades vêm de `ColumnTable` (dia/semana têm esforço, não custo de material); **opcional**: célula tooltip listing? → adiar p/ Fase 15/16 junto Gantt; registrar | nota | doc |
| 14C.1.18 | `htmlstatusreport`/`statussheetreport`/`xmlreport`: auditar keywords no TJ vendorizado (`TjpSyntaxRules.rb`/`ProjectFileScanner.rb`); statussheet **deve** listar materiais → registrar requisito formal na Fase 18 (comentar em `fase-18-...-tarefas.md`); `xmlreport` sem referência TJ → documentar como extensão futura | docs das fases | doc |
| 14C.1.19 | `accountreport`: verificar que `turnoverByType` (8.2) já agrega material nos totais exibidos; 1 teste com fixture 14c | `reports/account-list-re.ts` | 1 teste |
| 14C.1.20 | Query sobre `Material`: confirmar `Query.process` com `obj` = Material (acessores/`resolvePropertyId`); estender `Query`/`SimpleQueryExpander` se faltar acesso a `unitprice`/allocations | `query/query.ts` | 2 testes |
| 14C.1.21 | Regressão: taskreport/resourcereport/accountreport inalterados para projetos **sem** extensões (golden núcleo) | — | golden verde (absorve 14.25.14) |

#### Vereditos 14C.1.12–14C.1.18 (preenchido 2026-11-01)

| # | Veredito | Evidência |
|---|----------|-----------|
| 14C.1.12 | **Premissa incorreta, documentada**: o `textreport` não tem sistema de colunas — nem no port nem no TJ 3.8.4 (`TextReport < ReportBase`, só os 5 blocos RichText `header/left/center/right/footer`). Não existe “herança das colunas de taskreport”. Material aparece em textreport apenas como texto RichText; listagem tabular = `materialreport`. | `tests/reports/text-report-material_14c_test.ts` (2 testes) |
| 14C.1.13 | **Implementado (extensão)**: `definitions materials` emite `material <id> "<nome>" { unit/unitprice/totalquantity/flags/note }` (aninhando sub-materiais) e `taskattributes materialallocations` emite `material <id> <qtd> [modificador]` no bloco da tarefa; flags de material passam a ser declaradas por `generateFlagDeclaration`. Round-trip verificado. `hidematerial`/`rollupmaterial` entram em 14C.6. Nota: `start`/`end` **não** são round-trip-áveis (`DateAttribute#to_tjp` → `date <valor>`, fiel ao Ruby). | `tests/reports/tjp-export-material_14c_test.ts` (2 testes) |
| 14C.1.14 | **Implementado**: o `TraceReport` inclui a lista de materiais (cabeçalho + valores), então `<-atributo->` funciona quando a coluna aponta para material. `Material` espelha `name`/`id` em `AttributeBase` (o PTN guarda esses valores em campos) para que `<-name->`/`<-id->` resolvam. `hidematerial` em 14C.6. | `tests/reports/trace-report-material_14c_test.ts` (2 testes) |
| 14C.1.15 | **Sem integração (decisão)**: `resourcereport` lista recursos humanos; material não é booking nem tem scoreboard próprio. Não se adiciona coluna `materialcost` (fora de escopo): custo de material por período é responsabilidade do `materialreport`. | grep: 0 referências a “material” em `docs/taskjuggler/lib/taskjuggler/reports/` |
| 14C.1.16 | **Sem integração (decisão)**: `icalendar`/`niku`/`tagfile`/`chartplotter` são centrados em tarefas/recursos (calendários, stacks de carga, séries de esforço). Material não tem slot de calendário nem stack; o único caminho de série temporal é o `tracereport`, que já expõe colunas de material (14C.1.14). | idem |
| 14C.1.17 | **Adiado (decisão)**: as grades `Calendar` (weekly/monthly) vêm de `ColumnTable` (eixo de tempo × esforço por recurso); custo/consumo de material não tem slot diário próprio. Tooltip/listagem por célula fica para a Fase 15/16 (Gantt), quando a grade for comum. | idem |
| 14C.1.18 | **Auditoria**: `htmlstatusreport` e `xmlreport` **não existem no TJ 3.8.4** (0 hits em `TjpSyntaxRules.rb`/`KeywordDocumentation.rb`) → extensão futura, sem parser. `statussheetreport` existe (`ReportType.StatusSheet`; `_statussheetreport` em `parser/rules/report.ts:1849`) e o requisito “status sheet lista materiais” foi registrado como tarefa **18.17.8** em `fase-18-time-status-sheets-tarefas.md`. | grep + `report.ts:1849` |

#### Evidências 14C.1.8–14C.1.11 e 14C.1.19–14C.1.21 (preenchido 2026-11-01)

| # | Entrega | Evidência |
|---|---------|-----------|
| 14C.1.8 | Coluna `note` em material e conta (modelo RichText já existente da 10-C) | `tests/reports/note-timebasis_14c_test.ts` (2 testes) |
| 14C.1.9 | Coluna `timebasis` exibindo o valor **resolvido** do cenário (`TaskScenario.resolvedTimebasis`), não o atributo cru | idem (2 testes: explícito `length`, default `duration`) |
| 14C.1.10 | `materialreport` em HTML/CSV/JSON pelos geradores do núcleo (`ReportTable` + `toJSON` de 14C.0.3) | `tests/reports/material-report-output_14c_test.ts` + `table-report-json_14c_test.ts` |
| 14C.1.11 | `materials` (alocações `material (quantidade)`) e `materialcost` (soma dos `CostEvent` `material_usage`, queda para `quantidade × preço`) — implementado no `TableReport` compartilhado, herdado por `taskreport` | `tests/reports/task-material-columns_14c_test.ts` (3 testes) |
| 14C.1.19 | `accountreport`: `aggregate materials` soma `Material#totalCost()` de `project.materials`, mantendo o invariante 8.2 `sum(buckets) === total` | `tests/reports/account-material-turnover_14c_test.ts` (2 testes) |
| 14C.1.20 | `Query.process` resolve atributos de `Material`; `Material` espelha `name`/`id` no PTN para `<-name->`/`<-id->` | `tests/query/query-material_14c_test.ts` |
| 14C.1.21 | Regressão núcleo: `reports.golden.json` e `parser.golden.json` inalterados; suíte core verde; `deno task check:all` limpo | `deno task check:all` + `deno test -P packages/core/tests` + `git status` |

---

## 14C.2 — `BreakdownReport` (absorve 14.25.1–5)

> Spec canônica: `fase-10-complemento1.md` §5. Parser já reconhece
> `breakdownreport` + atributos (10-C C3.5).

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.2.1 | `BreakdownReport extends ReportBase` (`reports/breakdown-report.ts`); fábrica registrada (`materialreport`-style) substituindo o NYI de 14C.0.10 | idem, `reports/mod.ts` | teste de registro |
| 14C.2.2 | `groupby account` (default): por conta, listar recursos contribuintes (esforço + custo via `chargeset`), materiais (quantidade + `unitPrice` + total via `MaterialAllocation`), charges (modo + valor) e total — consome `AccountScenario.turnoverByType` | `reports/breakdown-report.ts` | 3 testes (absorve 14.25.2) |
| 14C.2.3 | `groupby task`: idem por tarefa (alocados + charges da tarefa + total) | idem | 2 testes (absorve 14.25.3) |
| 14C.2.4 | Filtros `hidetask`/`hideaccount`/`hideresource`/`hidejournalentry <expr>` via engine Fase 11 (avaliação em `ReportBase.filterAccountList`/`Query`); `period` default = período do projeto | idem | 2 testes (absorve 14.25.4) |
| 14C.2.5 | Colunas `name`, `materials`, `resources`, `charges`, `total` com `sortby` | idem | 2 testes |
| 14C.2.6 | Formato HTML: tabela hierárquica (conta → contribuintes → total) com `ReportTable` | idem | 1 teste |
| 14C.2.7 | Formato CSV: linhas planas (entidade, tipo-contribuinte, esforço/quantidade, custo, total) | idem | 1 teste (absorve 14.25.5) |
| 14C.2.8 | Formato JSON: aninhado por `groupby` via `toJSON`/`generate(json)` (14C.0.1) | idem | 1 teste |
| 14C.2.9 | Snapshot 14C: breakdown do fixture 14c em html-normalizado-estrutural + csv + json em `reports-extensions.golden.json` | `tests/golden/` | run 2× idempotente |
| 14C.2.10 | Regressão núcleo: `reports.golden.json` byte-idêntico após bloco | — | verde |

#### Evidências 14C.2.1–14C.2.10 (preenchido 2026-11-01)

**Arquivos:** `src/reports/breakdown-report.ts` (novo), `src/reports/mod.ts`,
`src/model/report.ts` (remove a âncora NYI), `src/model/material.ts`
(`unitPriceValue`/`unitValue`/`totalQuantityValue`), `tests/golden/extension-snapshot.ts`.

| # | Entrega | Evidência |
|---|---------|-----------|
| 14C.2.1 | `BreakdownReport extends ReportBase` + `registerContentFactory("breakdownreport")`; âncora `EXTENSION_TYPE_BLOCKS` removida | `breakdown-report_14c_test.ts` (registro na fábrica + 3 testes de `groupby`) |
| 14C.2.2 | `groupby account` (default): contribuintes de `project.costEvents` da conta/filhas + materiais do `chargeset` (ou conta `aggregate materials`), com totais por tipo | 2 testes (agregação; conta sem contribuintes não gera grupo) |
| 14C.2.3 | `groupby task`: recursos (`assignedResources` + `getAllocatedTime`), materiais (`materialallocations` × preço efetivo) e charges (`charge` declarada), com `CostEvent` como fonte autoritativa | 3 testes |
| 14C.2.4 | Filtros via engine da Fase 11 (`filterTaskList`/`filterAccountList` com `hideTask`/`hideAccount`/`rollup*`/`openNodes`); período default = período do projeto (`project.get("start"/"end")`) | 2 testes |
| 14C.2.5 | Colunas `name`/`resources`/`materials`/`charges`/`total` (∩ `columns` declarado) e `sortby` sobre os totais | 2 testes |
| 14C.2.6 | HTML: `ReportTable` hierárquica (grupo → contribuintes indentados) | 1 teste |
| 14C.2.7 | CSV: linhas planas `[entidade, tipo, esforço/quantidade, custo, total]` | 1 teste |
| 14C.2.8 | JSON: `{ groupby, groups[].contributors[] }` via `toJSON` (14C.0.1) | 1 teste |
| 14C.2.9 | Snapshot 14C do fixture `14c-rdo-budget` (html + csv + json, `groupby account` e `task`) em `reports-extensions.golden.json`; geração 2× byte-idêntica | `reports-extensions_golden_test.ts` (verde) |
| 14C.2.10 | `reports.golden.json` e `parser.golden.json` inalterados; suíte core + `deno task check:all` verdes | git status + suíte (420 testes) |

---

## 14C.3 — `RdoReport` + galeria (absorve 14.25.6–10)

> Spec canônica: `fase-10-complemento1.md` §6. Parser já reconhece
> `rdoreport`/`picture`/`format` (10-C C3.6–C3.7); modelo `JournalEntry.pictures`
> existe; agregações lógicas/`hide*` da Fase 11.

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.3.1 | `RdoReport extends ReportBase` (`reports/rdo-report.ts`); fábrica registrada substituindo NYI de 14C.0.10; `period` obrigatório (parser já valida `rdo_period_required` — conferir) | idem | teste de registro + 1 de validação |
| 14C.3.2 | `groupby date` (default): blocos por dia com entradas do período via `entriesByDate` | idem | 2 testes |
| 14C.3.3 | `groupby task/resource/material/account` via índices `entriesBy*` (14C.0.4) | idem | 4 testes (absorve 14.25.7) |
| 14C.3.4 | `journalmode` `journal` (default) / `status_up` / `status_down` filtrando por `timeSheetRecord`/flags quando presentes; `alerts_red/green/...` filtrando por `alertLevel` (14C.0.7) | idem | 3 testes (absorve 14.25.8) |
| 14C.3.5 | `journalattributes` (`date`, `headline`, `summary`, `details`, `alert`, `author`) controlando campos exibidos | idem | 1 teste |
| 14C.3.6 | Galeria de imagens por bloco: união de `entry.pictures` + imagens extraídas do `details` (markdown `![..]`/richtext `[]`), respeitando `maxpictures` (saída só) + `align/width/caption/alt` — usa `picturesToHtml` (14C.0.9) | idem, `richtext`/`markdown` extraction helper | 3 testes (absorve 14.25.9) |
| 14C.3.7 | Extração de imagens do corpo `details`: percorrer `RichTextIntermediate`/markdown AST buscando nós de imagem (ambos os formatos) | helper em `reports/gallery.ts` | 2 testes |
| 14C.3.8 | Colunas `name`, `resources`, `responsible`, `journal`, `pictures`, `materials`, `charges` (por bloco, quando aplicável ao `groupby`) | `reports/rdo-report.ts` | 2 testes |
| 14C.3.9 | Filtros `hidetask`/`hideaccount`/`hideresource` aplicados aos blocos (expression engine Fase 11) | idem | 1 teste |
| 14C.3.10 | Render HTML "template de RDO": cabeçalho do bloco + lista de entradas (atributos selecionados) + galeria + tabelas de recursos/materiais/charges | idem | 1 teste estrutural |
| 14C.3.11 | Saída JSON aninhada por `groupby` (com array de imagens por entrada) | idem | 1 teste (absorve 14.25.10) |
| 14C.3.12 | Imagens relativas no HTML do RDO: `src` sai como descritor/caminho resolvido por `ImageStore` injetável (default: mantém relativo) — DOM-free, ADR 001 | idem | 1 teste |
| 14C.3.13 | Snapshot 14C: RDO do fixture 14c (groupby date + material) html-estrutural + json | `tests/golden/` | idempotente |
| 14C.3.14 | Regressão núcleo verde | — | verde |

#### Evidências 14C.3.1–14C.3.14 (preenchido 2026-11-01)

**Arquivos:** `src/reports/rdo-report.ts` (novo), `src/reports/gallery.ts`
(`picturesFromDetails`), `src/reports/mod.ts`, `src/model/report.ts` (âncora
`EXTENSION_TYPE_BLOCKS` esvaziada), `tests/golden/extension-snapshot.ts`,
`tests/model/report-json-dispatch_14c_test.ts` (âncoras NYI → fábricas).

| # | Entrega | Evidência |
|---|---------|-----------|
| 14C.3.1 | `RdoReport extends ReportBase` + `registerContentFactory("rdoreport")`; `period` validado pelo parser (`rdo_period_required`); `groupby` default `date` | `rdo-report_14c_test.ts` (3 testes: registro, validação, default) |
| 14C.3.2 | `groupby date`: um bloco por dia com entradas (`Journal#entriesByDate`), dias vazios omitidos, ordem cronológica | 2 testes (blocos/ordem; recorte do período) |
| 14C.3.3 | `groupby task/resource/material/account` via índices `entriesByTask/Resource/Material/Account` ∩ entradas permitidas (período + `journalmode`) | 4 testes (um por entidade) |
| 14C.3.4 | `journalmode`: `journal`/`journal_sub` (todas), `status_up` (corrente por tarefa de topo, filhos diretos), `status_down`/`status_dep` (corrente por subárvore), `alerts_down`/`alerts_dep` (maior `alertLevel` corrente) e `alerts_<id>` (filtro por nível — extensão); entradas de recurso/material/conta preservadas (extensão declarada no doc do módulo) | 4 testes (`status_down`, `status_up`, `alerts_down`, `alerts_red`) |
| 14C.3.5 | `journalattributes` controla os campos da entrada (date/headline/summary/details/alert/author/flags/property), com `*` = todos | 1 teste |
| 14C.3.6 | Galeria por bloco: união `entry.pictures` + imagens do `details`, dedupe por caminho, corte por `maxpictures` só na saída; `align/width/caption/alt` renderizados via `Picture#to_html` | 2 testes (união/dedupe; `maxpictures` + atributos) |
| 14C.3.7 | `picturesFromDetails` em `gallery.ts`: regex Markdown `![alt](path)` (cobre o `img` serializado do RichText) e MediaWiki `[[Image:\|File:path\|...]]` | `gallery_14c_test.ts` (2 testes) |
| 14C.3.8 | Colunas `name`/`responsible`/`journal`/`pictures`/`resources`/`materials`/`charges`; tabelas com `detail` (esforço/quantidade) e `amount`; `columns` declarado restringe a saída | 3 testes (default × restrito; materiais/charges; responsável) |
| 14C.3.9 | `hidetask`/`hideaccount`/`hideresource` via `filterTaskList`/`filterAccountList`/`filterResourceList` (engine Fase 11); `hidematerial` opcional até 14C.6 | 1 teste (`hidetask isleaf()`) |
| 14C.3.10 | HTML: `<div class="tj_rdo_frame">` → `<section class="tj_rdo">` → `<article class="tj_rdo_block" data-group="…">` com header, entradas, galeria e tabelas | 1 teste estrutural |
| 14C.3.11 | JSON: `{ groupby, period, groups[].entries[].pictures[] }` | 1 teste |
| 14C.3.12 | `setImageResolver` injetável (ImageStore): `src` resolvido no HTML, caminho original preservado na estrutura | 1 teste |
| 14C.3.13 | Snapshot em `reports-extensions.golden.json` (`rdo`: `groupby date` e `material`) — geração 2× byte-idêntica (md5 `f75313b5…`) | `reports-extensions_golden_test.ts` (verde) |
| 14C.3.14 | `deno task check:all` (exit 0), `check:stubs`, `deno lint`/`deno fmt --check` limpos nos arquivos novos; `reports.golden.json`/`parser.golden.json` inalterados; suíte core completa | git status + suíte |

---

## 14C.4 — MspXml → MSPDI (fonte: `docs/tj3-engine/mspdi.md`)

> Oracle Ruby parcial: `MspXmlRE.rb` cobre o essencial humano; extensões de
> material/custo são SyntaxMesh (sem oracle) — validar por **regras do
> mspdi.md** + estrutura.

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.4.1 | Script Ruby `scripts/golden/mspdi-tj3.rb`: roda tj3 sobre mwe005 (ou projeto com tasks/resources) gerando o XML MSPDI real e extrai o `<Project>` normalizado → `mspdi.golden.json`; wiring `golden:generate` + README | `scripts/golden/`, `generate_golden.ts` | byte-idempotente; teste compara TS atual vs oracle nos campos já portados (regra de normalização p/ atributos/whitespace, 14.23.9) |
| 14C.4.2 | Recursos **material**: `Material` → `<Resource>` com `<Type>0</Type>`, `<MaterialLabel>` = unidade, `<StandardRate>` = `unitPrice`; UID distinto de recursos humanos (espaço de UID único global) | `reports/msp-xml-re.ts` | 2 testes (absorve pedido §mspdi 3.2) |
| 14C.4.3 | Alocações de material → `<Assignment>` com `<Units>` = quantidade e `<Cost>` = quantity×unitPrice; ligar TaskUID/ResourceUID corretos (nunca `<ID>`) | idem | 2 testes (mspdi §4.2) |
| 14C.4.4 | Recursos **custo**: `ExtendedCharge`/`Charge` flat não-atrelados a recurso humano → `<Resource>` `<Type>2</Type>` (+`<IsBudget>` quando apropriado) e `<Assignment><Cost>` direto | idem | 2 testes |
| 14C.4.5 | `<DurationFormat>` coerente: tarefas normais `7` (dias), duração `ed` (calendrier 24×7 / milestone elapsed) `8` com `<Duration>` em horas totais (`PnDTnHnMnS` ISO 8601); nunca `9` para `ed` (mspdi §8) | idem (`durationToMsp`) | 3 testes |
| 14C.4.6 | Campos de progresso/real: `<ActualWork>`, `<ActualCost>`, `<RemainingWork>`, `<RemainingCost>` em `<Task>`/`<Assignment>` quando tracking presente (`effortdone`/`_doneEffort`, `CostEvent`) | idem | 2 testes |
| 14C.4.7 | `<Notes>`: notas RichText/Markdown de task/resource → texto plano (`to_s`) escapado em CDATA-safe | idem | 2 testes |
| 14C.4.8 | `<TimephasedData>` estendido: série por período (day/week) de trabalho E custo (agregação via scoreboard/`CostEvent`), `<Type>`/`<Unit>` válidos | idem | 2 testes |
| 14C.4.9 | Calendário base `<WeekDays>` correto a partir do `ProjectConfig`/working hours + `<Exceptions>` para leaves/feriados do projeto (`Project.leaves`) | idem | 2 testes |
| 14C.4.10 | Respeitar `hidematerial`/`hideresource`/`hidetask` (com C6) na geração | idem | 1 teste |
| 14C.4.11 | `ConstraintType`/`ConstraintDate` e `PredecessorLink` com `<LinkLag>`/`<LagFormat>` para dependências com lag (mapear TJ `onEnd/onStart` + `lag` → tipos FS/SS/FF/SF do mspdi §2.3) | idem | 2 testes |
| 14C.4.12 | Veredito `Baseline`/`ExtendedAttribute`: sem dados de baseline no modelo → **documentar limitação** (não inventar); alerts via `<Priority>`/notes? registrar | nota no doc de fase | doc |
| 14C.4.13 | Validação estrutural: teste que parseia o XML gerado (regex/estrutura mínima) e verifica invariantes mspdi — UID único por Task/Resource/Assignment, referências só por UID, duração ISO 8601 bem-formada | `msp-xml-re_test.ts` | 1 teste guarda-chuva |
| 14C.4.14 | Oracle: TS vs Ruby nos campos já exportados (não-regressão do que existe: Calendars/Tasks/Resources/Assignments/TimephasedData humanos) | `mspdi.golden.json` | verde |
| 14C.4.15 | `deno check` + suíte reports verde; snapshot 14C do material/custo (sem oracle) gravado | — | verde |
| 14C.4.16 | Regressão núcleo | — | verde |

#### Evidências 14C.4.1–14C.4.16 (preenchido 2026-11-01)

**Arquivos:** `scripts/golden/mspdi-tj3.rb` (novo), `scripts/golden/README.md`,
`tests/golden/generate_golden.ts`, `tests/golden/mspdi-normalize.ts` (novo),
`tests/golden/mspdi.golden.json` (novo), `tests/golden/extension-snapshot.ts`,
`src/reports/msp-xml-re.ts`, `tests/reports/mspdi_oracle_14c_test.ts` (novo),
`tests/reports/msp-xml-re_14c_test.ts` (novo),
`tests/fixtures/ext/14c-mspdi.tjp` + `14c-mspdi-ext.tjp` (novos).

**Correção de doc:** `docs/tj3-engine/mspdi.md` §3.1 invertia os valores de
`<Resource><Type>` (dizia 2 = material / 0 = custo). A tabela oficial do
elemento `Type` (Microsoft) é **0 = material, 1 = trabalho, 2 = custo**; a
implementação segue a oficial e os itens 14C.4.2/14C.4.4 acima foram
corrigidos.

| # | Entrega | Evidência |
|---|---------|-----------|
| 14C.4.1 | `mspdi-tj3.rb` roda tj3 sobre `fixtures/ext/14c-mspdi.tjp` e serializa a árvore REXML normalizada (sem `CreationDate`/`CurrentDate`/`StatusDate`, texto com whitespace colapsado); duas execuções = md5 `9590aa09…` (86717 bytes) | `deno task golden:generate` → `mspdi.golden.json` (77 KB); `md5sum -c` dos demais goldens intacto |
| 14C.4.2 | `Material` → `<Resource>` `Type 0`, `MaterialLabel` = `unitValue()`, `StandardRate` = `unitPriceValue()`, `<Notes>` do material; UID alocado em espaço global após os humanos | 2 testes (Type/label/rate/notes; UIDs distintos + humanos seguem `Type 1`) |
| 14C.4.3 | `<Assignment>` de material com `TaskUID`/`ResourceUID` por UID, `Units` = quantidade, `Cost` = qtd × `unitPrice` e série `TimephasedData` `Type 6` | 2 testes (Units/Cost/TaskUID; série diária de custo) |
| 14C.4.4 | `Charge` flat → `<Resource>` `Type 2` ("Charges <task> #n") + `<Assignment><Cost>` com `turnover()` por período; `IsBudget` sempre `0` (charge é despesa — o modelo não marca orçamento) | 2 testes (Type/IsBudget; atribuição de custo) |
| 14C.4.5 | `DurationFormat`: `7` (dias) por default; `8` quando o intervalo de calendário iguala o esforço em calendário 24×7; `9` nunca é emitido para `ed`. `effort` é convertido de **slots** (`× scheduleGranularity`), não de dias | 3 testes (normal; 24×7 = 8; ausência de 9) |
| 14C.4.6 | `<ActualWork>`/`<RemainingWork>` na tarefa e na atribuição (`effortdone` em slots; atribuição proporcional ao esforço efetivo); `<ActualCost>`/`<RemainingCost>` somados de `CostEvent` (8.2) por modo `actual`/`planned`, opcionalmente por recurso | 2 testes (PT16H/PT16H; omissão sem `effortdone`) |
| 14C.4.7 | `<Notes>` de tarefa, recurso humano e material como texto plano escapado por `XMLNamedText` | 2 testes (nota da tarefa; nota do recurso) |
| 14C.4.8 | Trabalho humano mantém a série `Type 1` herdada do Ruby; material e charge ganham série de custo `Type 6` (único tipo de custo de atribuição no MSPDI), `Unit 2` (dias) e `<Value>` decimal por fatia | 2 testes (série de material; Type 1 × Type 6) |
| 14C.4.9 | `<Exceptions>` no calendário: leaves do projeto (base) e do recurso, convertidos de `ScoreboardInterval`/`TimeInterval` para `FromDate`/`ToDate` com `DayWorking 0`. **Limitação:** `Project` não tem store `leaves` (só `Resource`/`Shift`), então `vacation` no bloco `project` não é suportado pelo core — as exceções vêm dos recursos | 1 teste (exceção de Alice 2026-03-16→17) |
| 14C.4.10 | Filtro `hideMaterial` ligado ao motor de expressões via `attributeDefinition("hideMaterial")`: fica **inerte** até o atributo existir (14C.6), quando então passa a omitir o material | 1 teste (material presente enquanto o atributo não existe) |
| 14C.4.11 | `PredecessorLink`: `Type` 1 (FS) do Ruby preservado; `LinkLag` em décimos de minuto a partir de `gapLength` (slots → dias úteis → `LagFormat 7`) e de `gapDuration` (dias corridos → `LagFormat 8`) | 1 teste (gaplength 2d → `9600`/`7`) |
| 14C.4.12 | **Limitação documentada:** o modelo não guarda baseline nem `ExtendedAttribute`/alerts do ponto de vista MSPDI; por decisão não inventamos `<Baseline>`/`<ExtendedAttribute>`. `ConstraintType 2`/`ConstraintDate` continuam como no Ruby (Start No Earlier Than) e a prioridade já é exportada em `<Priority>` | esta nota |
| 14C.4.13 | Guarda-chuva estrutural: UIDs únicos por coleção, `TaskUID`/`ResourceUID` sempre resolvem para UID existente, toda `<Duration>` casa `^PT\d+H\d+M\d+S$` | `msp-xml-re_14c_test.ts` (3 testes) |
| 14C.4.14 | Oracle campo a campo contra o `<Project>` do tj3 sobre `14c-mspdi.tjp` (calendários, tarefas, recursos e atribuições humanas) | `mspdi_oracle_14c_test.ts` (3 steps, verde) |
| 14C.4.15 | Snapshot das extensões (blocos `<Calendars>`/`<Tasks>`/`<Resources>`/`<Assignments>`, sem timestamps) em `reports-extensions.golden.json` → `mspdi` | `reports-extensions_golden_test.ts` (byte-idêntico após regenerar) |
| 14C.4.16 | `deno task check:all` exit 0, `check:stubs` OK, `deno fmt --check` limpo; suíte core completa verde | logs da sessão + `deno task test` |

> **Nota de unidade (armadilha):** `effort`, `effortdone` e `TaskDependency.gapLength`
> são armazenados em **slots** no core (`segundos ÷ scheduleGranularity`), não em
> dias. Toda conversão para MSPDI passa pelo helper `granularity()`
> (`scheduleGranularity`, default 3600). Já `ResourceScenario#getEffectiveWork`
> devolve **dias**, e é o único caminho que multiplica por `dailyWorkingHours`.
>
> **Nota de material:** `Material.name` é o id (o parser não passa o rótulo
> `"Aço"` ao construtor), então `<Name>` do recurso de material sai com o id;
> `MaterialAllocation.quantity` é usado como total consumido (mesma convenção
> do `BreakdownReport` 14C.1.11), com divisão uniforme entre os dias porque
> `quantityIn()` depende de `attach()`, que o scheduler não chama.
> **Nota de artefato:** `golden:generate` reescreve os `.html` de amostra em
> `tests/golden/` (byproducts do tj3, não comparados por teste); eles foram
> restaurados para não poluir o diff.

---

## 14C.5 — Markdown nos relatórios

> Default de **report** permanece `richtext` (compatibilidade `.tjp`); markdown
> é opt-in por `format` no escopo do relatório/entrada. Roteamento previsto na
> 13.14.4 (adiada) é entregue aqui.

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.5.1 | Parser: atributo `format markdown|richtext` no contexto de `report` (header/footer/prolog/epilog/intro/caption); ao criar RichText, rotear para `MarkdownFactory` (13) quando markdown | `parser/rules/report.ts`, `parser/rules/journal.ts` (helper compartilhado) | 2 testes |
| 14C.5.2 | `TableReport`/geradores HTML: usar o conteúdo RichTextIntermediate (já unificado) — verificar que header/footer markdown chegam ao HTML de saída sem mudança de API | `reports/table-report.ts` | 1 teste (header markdown → `<h1>`/`<strong>` no html) |
| 14C.5.3 | Handlers RTF **dentro de Markdown**: confirmar/terminar o wiring dos placeholders de `extensions/functions.ts` (`[[query:]]`, `[[report:]]`, `[[reportlink:]]`, `[[navigator:]]`) para os handlers reais (`richtext/handlers/*`) com `ReportContext` ativo; mini-query `<-attr->` em header/footer | `markdown/extensions/functions.ts`, `markdown/mdast-to-richtext.ts` | 4 testes (um por handler) |
| 14C.5.4 | `[[query:]]` em markdown renderiza como em richtext dentro de reports (integração 13.7 + ReportContext.push/pop) | idem | 1 teste |
| 14C.5.5 | `RTFReport`/`RTFReportLink` sob markdown: mesma semântica (URL comprimida `URLParameter.encode`) — garantir que o pipeline markdown preserve o payload p/ o handler | `richtext/handlers/rtf-report*.ts`, markdown pipeline | 2 testes |
| 14C.5.6 | Imagens inline em `details` markdown dentro de journal-columns/RDO já funcionam via 14C.3.6/14C.3.7 (cruzar verificação) | — | 1 teste combinado |
| 14C.5.7 | `celltext`/`note` de task/resource/material/account: body markdown → html no relatório quando `format markdown`; `to_s` no textreport | `reports/table-report.ts` | 2 testes |
| 14C.5.8 | `TextReport` com header/footer markdown: plain-text (`to_s`) equivalente ao richtext | `reports/text-report.ts` | 1 teste |
| 14C.5.9 | Sanitização: saída html de markdown em reports passa pelo `html-sanitizer` (13) — nunca inserir AST crua | `markdown/html-sanitizer.ts` usage | 1 teste (XSS básico em caption) |
| 14C.5.10 | Regressão richtext: `.tjp` existentes sem `format` renderem **idênticos** (golden núcleo + `richtext.golden.json`) | — | verde |
| 14C.5.11 | Snapshot 14C: relatório com header markdown + query + reportlink (html estrutural) | `tests/golden/` | idempotente |
| 14C.5.12 | Documentar no ADR 027 (seção adendo) a escolha default-richtext/opt-in-markdown nos reports | `docs/syntaxmesh/decisoes/027-reports-browser.md` | doc |

#### Evidências 14C.5.1–14C.5.5 (preenchido 2026-11-01)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.5.1 | Atributo `format` (Symbol, default `richtext`, `inheritedFromParent`) em `report-attributes.ts`; `newRichText(text, sfi, tokenSet, format)` escolhe `MarkdownFactory` × `RichTextFactoryImpl` (com `setMarkdownFactory` para injeção). Independência de ordem: o parser grava cada fonte em `Report.richTextSources` e `applyReportFormat()` reconstrói os RTIs já lidos. A regra `format` de `journal.ts` é compartilhada (`applyFormat`: entrada de journal › relatório). `applyReportFormat` usa `force()` porque `set()` dispara `AttributeOverwrite` na guarda de redefinição | 5 testes em `markdown-report_14c_test.ts` (antes/depois do texto, herança pelo pai, default richtext, fábrica injetada); `attribute-definitions.golden.json` +1 entrada (`format`, `default: "richtext"`, `extension: "reports"`) |
| 14C.5.2 | Nenhuma mudança em `TableReport`: as duas fábricas produzem o mesmo `RichTextIntermediate`, então `rt_to_html()` segue igual | 2 testes (header markdown → `<h1>`/`<b>` no html; relatório sem `format` continua sem `<h1>`) |
| 14C.5.3 | Wiring já existente só precisou de fixture: `extensions/functions.ts` converte `[[nome:args]]` em `inlinefunc`/`blockfunc` com payload `[nome, args]` e `<-attr->` no açúcar de `[[query:attribute=…]]` (13.7). Dos quatro handlers, `report` vira `blockfunc` (só quando sozinho no parágrafo) e os demais `inlinefunc` | 5 testes em `markdown-handlers_14c_test.ts` (`query` → `<span>2026-03-02</span>`; `report` embute `mddefault` e restaura a pilha de contextos; `reportlink` → `md-default.html`; `navigator` → navbar com `navbar_current`; açúcar `<-end->` → `2026-03-31`) |
| 14C.5.4 | Markdown `[[query:attribute=start]]` e RichText `<-query attribute="start"->` resolvem pelo mesmo `RTFQuery` com a `Query` do `ReportContext` | 1 teste comparando as duas saídas (`2026-03-02`); única diferença é o `<p>` do bloco markdown |
| 14C.5.5 | `RTFReport`/`RTFReportLink` recebem o payload intacto: no caminho interativo o `reportlink` monta `taskjuggler?project=…;report=…;attributes=<URLParameter.encode(expand())>` | 2 testes: href interativo markdown ≡ richtext (com `;attributes=` + `URLParameter.encode("x=1")`) e payload `["report", {id}]` na árvore + recursão barrada (`rtp_report_recursion`, sem vazar contexto) |

> **Divergências pré-existentes encontradas (não corrigidas aqui):**
>
> - `name`/`projectid`/`version` do projeto são **campos** de `Project`, não
>   atributos, então `[[query:attribute=name]]` renderiza vazio (a `Query`
>   cai no fallback `project.get(...)`). Os testes usam `start`/`end`. Também
>   por isso a URL interativa sai com `project=` vazio.
> - No RichText `[[…]]` é **referência interna** (link), então `[[query:…]]` só
>   existe no Markdown; e `<-attr->` procuraria um handler com o nome do
>   atributo e lança `No handler for name registered` (Ruby emitiria
>   `bad_inline_function`).
> - `RTFReportLink` estático acrescenta `.html` ao **nome** do relatório:
>   fixtures com `[[reportlink:]]` não podem nomear o relatório com `.html`
>   (mesma semântica do Ruby).

#### Evidências 14C.5.6–14C.5.9 (preenchido 2026-11-01)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.5.6 | Nenhuma mudança de código: `picturesFromDetails()` (`reports/gallery.ts`) já roda na geração do RDO sobre o `details` da entrada, independente do dialeto (14C.3.7) | 1 teste em `markdown-content_14c_test.ts`: entrada markdown `![A](img/a.png)` → `pictures` `["img/a.png"]`; entrada MediaWiki `[[Image:img/b.png\|B]]` → `["img/b.png"]`; HTML do RDO com 2 `<img` |
| 14C.5.7 | `ReportBase#rtiForReport()` reinterpreta o RTI quando `report.richTextFormat() === "markdown"` (só se `rti.richText instanceof RichText`, i.e. nasceu MediaWiki) e `#cellTextForReport()` trata a `celltext` crua no mesmo caso; `table-report.ts` aplica os dois em `genAttributeCell`, `genCalculatedCell` e nas três células de material | 2 testes: `note "**Importante** …"` vira `<b>Importante</b>` no `mdnote` e literal no `rtnote`; `celltext 1 "**Célula**"` vira `<b>Célula</b>` só no relatório markdown |
| 14C.5.8 | Nenhuma mudança: `TextReport` usa `to_s()` sobre o mesmo `RichTextIntermediate`, então markdown e MediaWiki convergem no texto plano | 1 teste: header markdown ≡ header MediaWiki (`"Título\n\nTexto forte"`); footer markdown `"fim"` × MediaWiki `"//fim//"`; `TextReport.generateIntermediateFormat()` + `to_html()` trazem os dois blocos |
| 14C.5.9 | Nenhuma mudança: `mdast-to-richtext` aplica `sanitizeHtml` (13.5) em cada nó `html` antes de virar markup | 1 teste: caption `Antes <script>alert(1)</script> depois <img src="x.png" onerror="alert(2)">` → sem `<script` e sem `onerror`, com `Antes`/`depois` preservados (no documento inteiro, só resta o `<script>` do template) |

> **Comportamentos documentados na 14C.5.6–5.9:**
>
> - A galeria do RDO é **agnóstica de dialeto**: `picturesFromDetails` aceita
>   `![alt](path)` e `[[Image:path|alt]]` na mesma varredura, então uma entrada
>   `format richtext` também contribui imagens (o `format` da entrada decide a
>   renderização do texto, não a coleta).
> - A sanitização é **por nó mdast**, não por documento: `<script>` e
>   `</script>` chegam como dois nós `html` separados, então o corpo do script
>   sobrevive como texto inerte (`alert(1)` escapado) em vez de desaparecer.
>   O que se garante é: nenhuma tag bloqueada e nenhum atributo de evento
>   atravessam para a saída.
> - `celltext` é string crua no TaskJuggler (sem markup próprio); no relatório
>   markdown ela é **interpretada** como markdown — desvio consciente para
>   manter paridade de leitura com `note`/`header` no mesmo relatório.

#### Evidências 14C.5.10–14C.5.12 (preenchido 2026-11-01)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.5.10 | Nenhuma mudança de código nos caminhos richtext: o atributo `format` só desvia quando o valor é `markdown`, e `report-attributes.ts` declara `richtext` como default/herdado | `reports.golden.json`, `parser.golden.json`, `mspdi.golden.json` e `richtext/golden/richtext.golden.json` byte-idênticos; regressão `golden/ + reports/ + richtext/ + parser/` → 196 testes (2161 steps), 0 falhas |
| 14C.5.11 | Bloco `markdownReports` em `extension-snapshot.ts` (relê `14c-markdown-report.tjp`, gera `mdfuncs`, `rtquery` e `mddefault` e guarda `format`, `header`, `footer` e o HTML estrutural) | `reports-extensions.golden.json` regenerado (+37 linhas) e comparado byte-a-byte; 2º `it` em `reports-extensions_golden_test.ts` trava os invariantes (query `2026-03-02`, `href="md-default.html"`, embed `<b>Forte</b> e //itálico//`, rodapé `2026-03-31`, `rtquery` sem `<p>`, `mddefault` richtext) |
| 14C.5.12 | Adendo em `docs/syntaxmesh/decisoes/027-reports-browser.md`: dialeto default `richtext`, markdown opt-in por `format` no escopo do relatório, independência de ordem, alternativas rejeitadas e limites (galeria agnóstica, sanitização por nó, `celltext`, `name` não consultável) | revisão do documento |

> **Nota do snapshot 14C.5.11:** as células `<Error>` da coluna `name` nas
tabelas do snapshot são a divergência **já rastreada** da integração
modelo↔relatório (ver cabeçalho de `reports_golden_test.ts` e `CURRENT.md`),
não um efeito do markdown — o snapshot congela o estado atual para que a
integração futura apareça como diff explícito.

---

## 14C.6 — `hidematerial`/`rollupmaterial`/`hidepicture` + auditoria (absorve 14.26)

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.6.1 | Auditoria da 1ª leva: confirmar com testes que `hidetask`/`hideresource`/`hideaccount`/`hidejournalentry` e `rollup*` são **avaliados** (não só parseados) em `ReportBase`/`TableReport` (14.26.1a/b) | `reports/report-base.ts`, `reports/table-report.ts` | 3 testes; se faltar avaliação → tarefa corretiva (14.26.1c) |
| 14C.6.2 | Parser: `rule_hidematerial` + `rule_rollupmaterial` (análogos a `hideresource`) em `parser/rules/report.ts` | idem | 2 testes (absorve 14.26.2a) |
| 14C.6.3 | Parser: `rule_hidepicture` (análogo `hidejournalentry`) | idem | 1 teste (absorve 14.26.2b) |
| 14C.6.4 | i18n `hidematerial`/`rollupmaterial`/`hidepicture` (canonical + en/pt-BR/es, AST equivalente) | `src/i18n/*` | teste i18n (absorve 14.26.2c) |
| 14C.6.5 | `ReportContext`/`Query`: campos `hideMaterial`/`rollupMaterial`/`hidePicture` (parceiros de `hideJournalEntry`) + `query_material`-hooks necessários | `reports/report-context.ts`, `query/query.ts` | `deno check` + 1 teste (absorve 14.26.2d) |
| 14C.6.6 | Aplicar `hidematerial`/`rollupmaterial` em materialreport/breakdown/rdo `groupby material` e na coluna `materials` de taskreport | `reports/*` | 3 testes (absorve 14.26.2e) |
| 14C.6.7 | Aplicar `hidepicture` em galeria RDO + journal-columns (entradas cuja imagem é filtrada não contam p/ `maxpictures`) | `reports/rdo-report.ts`, `reports/gallery.ts` | 2 testes (absorve 14.26.2f) |
| 14C.6.8 | Aplicar `hidematerial` em TjpExportRE e MspXmlRE (com 14C.4.10) | export files | 1 teste |
| 14C.6.9 | `rollupmaterial`: agregação de alocações/material em summaries de breakdown/taskreport (semântica de `rollupresource` já portada) | `reports/*` | 2 testes |
| 14C.6.10 | Regressão: relatórios sem as novas diretivas inalterados (golden núcleo byte-idêntico) | — | verde (absorve 14.26.2g) |

#### Evidências 14C.6.1–14C.6.10 (preenchido 2026-11-01)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.6.1 | Auditoria das diretivas da 1ª leva com `.tjp` real: `hidetask`/`hideresource`/`hideaccount` + `rollup*` chegam ao motor lógico (`ReportBase#standardFilterOps`) e **removem** linhas. Fixture com grupos/folhas de task, resource e account; ocultação por `ischildof(...)` e consolidação por `treelevel() = 1` (o treeMode readiciona pais, então o resultado é comparado como conjunto ordenado). `hidejournalentry` é o único ancorado: a filtragem é **por entrada** e avaliar expressão com `JournalEntry` como contexto é Fase 16 (`LogicalFlag` → `NotYetImplementedError("16")`), então o teste audita o encanamento relatório → `ReportContext.query` | `tests/reports/hide-rollup-audit_14c_test.ts` (3 testes) |
| 14C.6.2 | `rule(p, "hidematerial")` e `rule(p, "rollupmaterial")` no corpo compartilhado `reportAttributes` (vale para materialreport/task/resource/account/export/ical/niku/tagfile), com `p.pattern(["_hidematerial", "!logicalExpression"])` e `set("hideMaterial"/"rollupMaterial", …)`; duplicata de `!rollupmaterial` no corpo principal removida | 2 testes (expressões `isleaf()`/`treelevel() > 1`, rdoreport com `period` obrigatório) |
| 14C.6.3 | `rule(p, "hidepicture")` análoga, gravando `hidePicture` | 1 teste |
| 14C.6.4 | i18n: `hidematerial`/`hidepicture`/`rollupmaterial` em `CANONICAL_KEYWORDS` + sinônimos pt-BR (`ocultarmaterial`/`ocultarimagem`/`agregarmaterial`) e es (`ocultarmaterial`/`ocultarimagen`/`agregarmaterial`); nomes canônicos resolvem em qualquer idioma | 2 testes em `parser/rules_report_hide_material_picture_14c_test.ts` (registry + AST equivalente en/pt-BR/es) |
| 14C.6.5 | `hideMaterial`/`rollupMaterial`/`hidePicture` em `QueryParams`, campos de `Query`, construtor, `dup()` e `ReportContext` (lidos do `Report`); `ReportBase#hiddenBy(attribute, property)` promovido do `RdoReport` (avalia a expressão com `query.property = propriedade` sobre um `dup()` da query corrente — sem estado compartilhado); `ReportBase#filterMaterialList()` aplica só hide/rollup (materiais não têm `materialroot`) | `deno check` limpo (reports/query/report-base) + efeito observável nos 8 testes de 14C.6.6–6.9 |
| 14C.6.6 | `MaterialListRE` filtra via `filterMaterialList`; `RdoReport#buildByMaterials` descarta o material oculto/envolvido antes de montar blocos; `TableReport` filtra as alocações nas colunas `materials` **e** ignora material oculto no `materialcost` (eventos e fallback quantidade×preço); `BreakdownReport` ignora material oculto nos contribuintes de conta, de tarefa e em `replaceContributorCost` | 3 testes em `reports/hide-material-picture_14c_test.ts` (sub-material por `ischildof`, blocos do RDO por `isleaf()`, coluna `materials` do taskreport) |
| 14C.6.7 | `RdoReport#picturesOf()` devolve `[]` quando o **dono** da entrada casa `hidepicture` — vale para a lista da entrada e para a galeria do bloco, de modo que a imagem filtrada não consome slot de `maxpictures` (o corte continua só na saída, 14C.0.9) | 2 testes: `groupby material` (bloco do material folha sem galeria e com `entries[].pictures` vazio) e `groupby date` + `maxpictures 2` (as duas imagens do material visível cabem; sem a diretiva a primeira do dia é a do dono oculto) |
| 14C.6.8 | `TjpExportRE` omite o material oculto em `generateMaterialList`/`generateMaterial` (sub-materiais) e nas alocações (`generateMaterialAllocations`); `MspXmlRE#hiddenMaterial` passa a delegar a `hiddenBy` (o wiring de 14C.4.10 deixa de ser inerte), então o material não vira `<Resource>` e não gera `<Assignment>`. `rollupmaterial` **não** altera o arquivo exportado (round-trip: a exportação é a própria fonte TJP) | 1 teste com as duas exportações (TJP sem `cimento` e com `material aco 2`; MSPDI sem o recurso e com `<Name>aco</Name>`) |
| 14C.6.9 | `rollupmaterial` consolida: no `materialreport` remove os descendentes do nó casado (semântica de `rollupresource`); no `BreakdownReport` o contribuinte recebe `rolledUp` e sai de HTML/CSV/JSON **mantendo o valor em `totals`**; a flag só entra no JSON quando verdadeira (`rolledUpFlag`), preservando o shape de quem não usa a diretiva | 2 testes (rollup × hide no materialreport com `~isleaf()`; breakdown `groupby task` com totais 130 e CSV/JSON sem o material envolvido) |
| 14C.6.10 | Sem mudança nos caminhos de quem não usa as diretivas: os goldens do núcleo (oracle Ruby) seguem byte-idênticos e o snapshot de extensões só difere pelo bloco `markdownReports` da C5 (+37 linhas) — C6 não adiciona nada a ele | `deno test packages/core/tests/golden/` → 24 testes verdes; `deno test packages/core/tests/reports/ + golden/` → 93 testes (1584 steps), 0 falhas; `reports-extensions.golden.json` regenerado idempotente |

> **Decisões e limites registrados na 14C.6:**
>
> - **Semântica das três diretivas**: `hidematerial <expr>` remove o material
>   de todas as superfícies (materialreport, RDO `groupby material`, coluna
>   `materials`/`materialcost`, breakdown, TJP e MSPDI); `rollupmaterial <expr>`
>   consolida (sem linha própria nas listas planas, descendentes fora das
>   hierárquicas, valor preservado nos totais); `hidepicture <expr>` é avaliado
>   na **propriedade dona** da entrada de journal (não no caminho da imagem).
> - Em lista plana (materiais não têm `materialroot`), `hidematerial treelevel() = 1`
>   remove os materiais raiz e **mantém** o filho; `rollupmaterial` faz o
>   contrário — a diferença é o teste que separa hide de rollup.
> - A negação lógica do TJP é `~` (`~isleaf()`); `!` é token de outro contexto
>   e produz `no_reduce`.
> - **Divergência pré-existente encontrada (não corrigida aqui):** `Material`
>   espelha `name`/`id` no `AttributeBase` (14C.1.14), então o nome exibido é o
>   **id** — o TJP exporta `material aco "aco"` e o MSPDI emite
>   `<Name>aco</Name>`, não o `$STRING` do bloco. O texto do cabeçalho só é
>   preservado para task/resource/account.

---

## 14C.7 — Verificação final + docs

| # | Tarefa | Verificação |
|---|--------|-------------|
| 14C.7.1 | `deno task check:all` exit 0; `deno lint`/`deno fmt --check` verdes nos arquivos do complemento | exit 0 |
| 14C.7.2 | `deno task golden:generate` reproduzível: `reports.golden.json`/`parser.golden.json`/`mspdi.golden.json` estáveis; `reports-extensions.golden.json` idempotente 2× | bytes iguais |
| 14C.7.3 | Suíte completa `deno task test` verde (relatório de contagem atualizado neste doc) | 0 falhas |
| 14C.7.4 | `deno task check:stubs`: nenhum NYI des-ancorado novo (trazidos de 14C.0.10 são removidos ao registrar fábricas) | OK |
| 14C.7.5 | Smoke `tests/integration/smoke_after_phase_14c_test.ts`: fixture 14c → materialreport+breakdown+RDO+Mspxml gerados como strings; nenhuma escrita a disco | 1 teste |
| 14C.7.6 | Auditoria de escopo: cada item do pedido original (lista de relatórios p/ materiais; picture/RDO; mspdi; markdown) tem tarefa entregue ou veredito documentado — tabela de rastreabilidade neste doc | grep/leitura |
| 14C.7.7 | Docs: status ✅ no header deste arquivo e do plano; `plano.md`/`AGENTS.md`/`CURRENT.md` atualizados; requisito de materiais na statussheet registrado na Fase 18 | diff |
| 14C.7.8 | Contagem final de testes documentada em CURRENT.md (linha Fase 14 Complemento) | doc |

#### Evidências 14C.7.1–14C.7.8 (preenchido 2026-11-01)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.7.1 | `deno task check:all` (type check de todos os pacotes) exit 0; `deno fmt --check` limpo em 571 arquivos; `deno lint` **restrito aos arquivos do complemento** (parser/reports/model + testes novos) limpo em 36 arquivos | exit 0 / `Checked 571 files` / `Checked 36 files` |
| 14C.7.2 | `golden:generate:extensions` roda 2× e produz **bytes idênticos** (`reports-extensions.golden.json`, 50.738 bytes, mesmo md5 nas duas gerações); `reports.golden.json`, `parser.golden.json` e `mspdi.golden.json` **não aparecem** em `git status` — byte-idênticos ao HEAD (núcleo 14 intocado) | `diff` dos md5 = vazio |
| 14C.7.3 | `deno task test` (suíte completa, todos os pacotes) | **450 testes / 4841 passos / 0 falhas** (5m52s) |
| 14C.7.4 | `deno task check:stubs`: nenhuma âncora perdida; `EXTENSION_TYPE_BLOCKS` está **vazio** desde 14C.3.1 (as três fábricas registradas) e os NYI restantes pertencem às Fases 16/18/19 | `check:stubs OK — todos os stubs anotados.` |
| 14C.7.5 | `tests/integration/smoke_after_phase_14c_test.ts` + fixture `fixtures/ext/14c-smoke.tjp` (materiais com `chargeset`, alocações, diários com `picture`, os quatro relatórios): materialreport (html/csv/json), breakdown (`groupby account`, totais 4900 = `Material#totalCost()`), RDO `groupby date` com galeria e MSPDI com o material como `<Resource>`. O `outputDir` do projeto aponta para um tmpdir e o teste **falha se algo for escrito** | 1 teste / 4 steps verdes |
| 14C.7.6 | Auditoria de escopo com tabela de rastreabilidade (abaixo): os quatro itens do pedido (§1) e os adendos absorvidos têm entrega ou veredito; a saída markdown em arquivo `.md` e os prefixos `md*report` do adendo §10 ficam **explicitamente fora da entrega** (veredito registrado) | tabela abaixo |
| 14C.7.7 | Status ✅ no header deste arquivo e do `fase-14-relatorios-complemento.md`; `plano.md` (linha `14-C`), `AGENTS.md` (tabela das 21 fases) e `CURRENT.md` atualizados; requisito de materiais na statussheet já registrado como **18.17.8** em `fase-18-time-status-sheets-tarefas.md` (14C.1.18) | `diff` / grep |
| 14C.7.8 | `CURRENT.md`, linha da Fase 14 Complemento: `450 testes / 4841 passos / 0 falhas` + pendências herdadas | doc |

#### Rastreabilidade do pedido original (14C.7.6)

| Item do pedido | Origem | Entrega | Evidência |
|---|---|---|---|
| “Nenhum relatório lista materiais” | plano §1 | **Entregue (C1)**: `materialreport` (`MaterialListRE`) com `name`/`id`/`note`/`unit`/`unitprice`/`allocations`/`scheduledcost`/`actualcost`/`totalcost`/`journal`/`timebasis`; colunas `materials`/`materialcost` no `taskreport`; `note`/`journal` em material e account; `tracereport` e `accountreport` (`aggregate materials`) integrados; vereditos de `resourcereport`/`icalendar`/`niku`/`tagfile`/`chartplotter`/`Calendar` (14C.1.15–17) | 14C.1.5–1.11, 1.14, 1.19–1.20 + vereditos 1.12/1.15–1.18 |
| “`picture` + RDO sem engine fotográfico” | plano §1 (10-C #5) | **Entregue (C3)**: `RdoReport` com `groupby date|task|resource|material|account`, `journalmode`/`journalattributes`, galeria `picturesToHtml` + `maxpictures`, imagens do `details` (`picturesFromDetails`) e `setImageResolver` para OPFS na Fase 19 | 14C.3.1–3.13 + `gallery_14c_test.ts` |
| “MspXml pobre vs. MSPDI real” | plano §1 + `mspdi.md` | **Entregue (C4)**: recursos material/custo, `<Assignment>` rico com `TimephasedData`, `DurationFormat` 7/8, `ActualWork`/`Remaining*`, `<Notes>`, `<Exceptions>`, `<LinkLag>`; correção do `mspdi.md` §3.1 (0 material / 1 trabalho / 2 custo); limitações registradas (sem `<Baseline>`/`<ExtendedAttribute>`) | 14C.4.1–4.16 + oracle `mspdi.golden.json` + snapshot |
| “Markdown nos relatórios” (dialeto) | plano §1 + 13.14.4 | **Entregue (C5)**: atributo `format` (`richtext` default, opt-in `markdown`), roteamento `MarkdownFactory` com independência de ordem, handlers `[[query:]]`/`[[report:]]`/`[[reportlink:]]`/`[[navigator:]]` e `<-attr->` dentro de markdown, `note`/`celltext` reinterpretados, sanitização por nó; adendo na ADR 027 | 14C.5.1–5.12 |
| Adendos 14.25.1–5 (BreakdownReport) | Fase 14 | **Entregue (C2)**: `groupby account|task`, html/csv/json, contribuintes e totais | 14C.2.1–2.10 |
| Adendos 14.25.6–10 (RdoReport/galeria) | Fase 14 | **Entregue (C3)** | 14C.3.1–3.13 |
| Adendos 14.25.11–13 (`note`/`journal`/`timebasis`) | Fase 14 | **Entregue (C1.7–1.9)** | 14C.1.8/1.9 + `note-timebasis_14c_test.ts` |
| Adendos 14.26.1a–2g (`hidematerial`/`rollupmaterial`/`hidepicture` + auditoria) | Fase 11-C F14 / Fase 14 | **Entregue (C6)**: três diretivas com parser+i18n, `Query`/`ReportContext`, aplicação em materialreport/RDO/colunas/breakdown/TJP/MSPDI e auditoria de `hide*`/`rollup*` | 14C.6.1–6.10 + `hide-material-picture_14c_test.ts` |
| **Adendo §10 do plano** — `formats markdown` gerando arquivo `.md` e prefixos `md*report` (`mdtaskreport`, `mdresourcereport`, …) | plano §10 | **Não entregue (veredito)**: a C5 entrega o **dialeto** markdown dentro do conteúdo dos relatórios (header/footer/note/celltext) e o `format` por relatório; uma **saída** markdown exige um gerador `ReportTable`→tabela de pipes + `generateMarkdown()` + extensão `.md` em `Report#outputFileName` + alias `md*` no dispatch — escopo novo, registrado em `CURRENT.md` como pendência para um adendo futuro (14C-MD-output) | este veredito |

> **Divergências/limitações encontradas na 14C.7:**
>
> - **Corrigido:** as colunas **padrão** do `materialreport` (definidas no
>   `materialReportHeader`) saíam sem título — `columnTitle()` lê
>   `Project#attributeName`, que não conhece `no`/`unit`/`unitprice`/`totalcost`,
>   então o cabeçalho HTML vinha vazio e o CSV trazia `null`. O parser agora usa
>   `MATERIAL_COLUMN_TITLES` (espelho de `TableReport.materialPropertiesById`)
>   com fallback para `columnTitle`. Achado pelo smoke da 14C.7.5.
> - **Não corrigido (rastreado):** declarar `columns unit, unitprice, totalcost`
>   (ou `allocations`/`scheduledcost`/`actualcost`) em um `.tjp` continua sendo
>   rejeitado por `reportableAttributes` — só `name`/`id`/`note`/`journal` e as
>   colunas do núcleo são aceitas como id de coluna. As variantes de material
>   funcionam quando chegam por API (colunas padrão, fixtures de teste). Fechar
>   exige keywords canônicas novas (`totalcost`, `allocations`, …) + regra de
>   coluna por tipo de relatório — registrado em `CURRENT.md`.
> - **Manutenção:** `MATERIAL_COLUMN_TITLES` duplica os títulos de
>   `TableReport.materialPropertiesById`; se um terceiro consumidor precisar, o
>   mapa deve subir para um módulo comum em `reports/`.

---

## 14C.8 — Saída Markdown (`formats markdown` + `md*report`)

> Fecha o veredito da 14C.7.6. A C5 entregou o **dialeto** markdown dentro do
> conteúdo; aqui o markdown vira **formato de arquivo** (`.md`), com
> renderização pura (tabelas de pipes, links, imagens) e aliases de header.

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.8.1 | Módulo puro de renderização markdown: `markdownCell` (escapa `\\`/`|` e converte quebra de linha em `<br>`), `markdownText` (aceita RTI via `to_markdown`), `markdownTable` (GFM + alinhamento `---:` para colunas numéricas), `markdownSections`, `markdownHeading`, `markdownImage` | `reports/markdown.ts` (novo) | 5 testes (célula, tabela, linha curta, seções, título/imagem) |
| 14C.8.2 | `ReportTable#to_markdown` (cabeçalho = `cell1`+`cell2`, corpo = grade do `to_csv`) e `ReportBase#rt_to_markdown` | `reports/report-table.ts`, `reports/report-base.ts` | `deno check` + cobertura via 8.3–8.6 |
| 14C.8.3 | `to_markdown()` em `TableReport` (header/tabela/footer) e `BreakdownReport` | `reports/table-report.ts`, `reports/breakdown-report.ts` | testes de 8.7 |
| 14C.8.4 | `to_markdown()` em `TextReport` (header/left/center/right/footer) | `reports/text-report.ts` | idem |
| 14C.8.5 | `to_markdown()` em `RdoReport`: blocos, meta linha, galeria e tabelas de recursos/materiais/charges | `reports/rdo-report.ts` | idem (sem `<table>`/`<div>` na saída) |
| 14C.8.6 | `ReportContent` ganha `to_markdown?`; `Report.generate()` ganha `case "markdown"` + `generateMarkdown()` (título, `.md` em `outputFileName`, corpo em `output`) | `model/report-content.ts`, `model/report.ts` | 2 testes (formato roteado, sufixo `.md` uma única vez) |
| 14C.8.7 | Parser: `taskReportKeyword`/`resourceReportKeyword`/`materialReportKeyword`/`accountReportKeyword` com `md` alias + `markdownReportDefaults()` (preseta `formats` sem sobrescrever corpo) + `outputFormat markdown` | `parser/rules/report.ts` | 3 testes (alias preseta, `formats` explícito vence, `formats markdown` em `taskreport`) |
| 14C.8.8 | i18n `mdtaskreport`/`mdresourcereport`/`mdmaterialreport`/`mdaccountreport` (canonical + pt-BR + es) e correções de port encontradas (`defaultColumnTitle`→`null`, `Project#attributeName` por tasks/resources, `columnTitle` com fallback) | `i18n/*`, `reports/table-report.ts`, `model/project.ts`, `parser/project-file-parser.ts` | 2 testes i18n + golden `attribute-definitions` idempotente |

#### Evidências 14C.8.1–14C.8.8 (preenchido 2026-11-01)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.8.1 | `reports/markdown.ts`: `markdownCell` escapa `\\`/`|` e troca quebra de linha por `<br>`; `markdownTable` alinha `---:` pelas colunas marcadas numéricas; `markdownSections`/`markdownHeading`/`markdownImage` completam o conjunto | `tests/reports/markdown-content_14c_test.ts` |
| 14C.8.2 | `ReportTable#to_markdown` (cabeçalho `cell1`+`cell2`, corpo pela grade do `to_csv`) e `ReportBase#rt_to_markdown` | `tests/reports/markdown-content_14c_test.ts` |
| 14C.8.3 | `TableReport#to_markdown` + `BreakdownReport#to_markdown` (tabela hierárquica com `bsi`) | `tests/reports/markdown-output_14c_test.ts` |
| 14C.8.4 | `TextReport#to_markdown` (header/left/center/right/footer, sem grade) | idem |
| 14C.8.5 | `RdoReport#to_markdown`: blocos, meta, galeria (`![](path "caption")`) e as três tabelas; nenhuma tag de relatório vaza | idem (asserções `!includes("<table")`/`"<div"`) |
| 14C.8.6 | `ReportContent#to_markdown?` + `Report#generateMarkdown` com `outputFileName` trocando a extensão por `.md` uma única vez | idem |
| 14C.8.7 | `taskReportKeyword`/`resourceReportKeyword`/`materialReportKeyword`/`accountReportKeyword` devolvem boolean; `markdownReportDefaults()` preseta `formats ["markdown"]` só quando o corpo não declara `formats`; `outputFormat markdown` aceito | `tests/parser/rules_report_markdown_14c_test.ts` (fixture `14c-markdown-report.tjp`) |
| 14C.8.8 | `mdtaskreport`/`mdresourcereport`/`mdmaterialreport`/`mdaccountreport` em `canonical.ts` + pt-BR + es; `TableReport.defaultColumnTitle` devolve `null` para coluna desconhecida (fiel ao Ruby) e `Project#attributeName` consulta `tasks` → `resources` | registry híbrido AST-equivalente en/pt-BR/es + golden `attribute-definitions` regenerado |

> **Nota (14C.8.6):** `Report#generate` roteia `case "markdown"` para `generateMarkdown()`, que é **puro** (string em `output`), preservando a ADR 027 — nenhuma escrita em disco.

## 14C.9 — `defaultaccount` (universal + variantes) + `to_rti` × 4

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.9.1 | `Project.defaultAccountId` + `Project.defaultAccountIds: Map<CostType, string>` + `defaultAccountFor(type)` (variante precede a universal; IDs resolvidos sob demanda) | `model/project.ts` | 4 testes |
| 14C.9.2 | `CostLine.project?` e regra 4 de `resolveAccount` usando a conta default (sem `defaultaccount` preserva `account: null`) | `accounting/attribution.ts` | 4 testes |
| 14C.9.3 | Parser do bloco `project`: `defaultaccount $ID` e `defaultaccount (material|resource|charge) $ID` — guarda o **ID** (referência futura: o bloco `project` precede as declarações de `account`), resolvido em `defaultAccountFor` | `parser/rules/project.ts` | 5 testes (universal, 3 variantes, referência futura, conta desconhecida) |
| 14C.9.4 | Regra `defaultAccountType` (`_material`/`_resource`/`_charge` → `CostType`) e mapeamento `charge` → `task` | idem | 3 testes |
| 14C.9.5 | i18n `defaultaccount` (pt-BR `contapadrao`, es `cuentapredeterminada`) com AST equivalente | `i18n/*` | 2 testes |
| 14C.9.6 | `ReferenceAttribute#to_rti` (URL+label → RichText `[url label]`) | `attributes/reference/reference-attribute.ts` | 2 testes |
| 14C.9.7 | `ListAttributeBase#to_rti` (`query.listItem` → `<nowiki>` por item + `assignList`; sem query → lista em RichText) | `attributes/list-attribute-base.ts` | 3 testes |
| 14C.9.8 | Auditoria dos `to_rti` restantes (base já implementado; `Journal#to_rti` fica na Fase 16) documentada + `Query#assignList` gera o RTI do texto montado (Ruby `Query.rb:234`) | doc, `query/query.ts` | revisão + 1 teste |

#### Evidências 14C.9.1–14C.9.8 (preenchido 2026-11-01)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.9.1 | `Project#defaultAccountId`/`#defaultAccountIds` + `#defaultAccountFor(type)` (variante do tipo → universal → `null`). Guards de tipo `CostType` de `model/account.ts`; `defaultAccountFor` entra em `ProjectLike` como opcional (o `CostLine` aceita projeto nulo) | `tests/model/default-account_14c_test.ts` — 4 steps |
| 14C.9.2 | `CostLine.project?` + `projectDefaultResult()` aplicado nas **duas** saídas da regra 4 de `resolveAccount`; `resource-scenario.ts` passa `project:` ao emitir `resource_effort`. Sem conta default o resultado segue `account: null`/`projectDefault: {}` | `tests/accounting/attribution_default-account_14c_test.ts` — 5 steps |
| 14C.9.3 | Regra `defaultAccountType` (opcional) + padrão `["_defaultaccount", "!defaultAccountType", "$ID"]` em `projectBodyAttributes`, logo após `currency`; o ID vai para `defaultAccountId`/`defaultAccountIds` **sem validar** no parse (referência futura) | `tests/parser/rules_defaultaccount_14c_test.ts` — 5 steps |
| 14C.9.4 | `_material`→`material`, `_resource`→`resource`, `_charge`→`task`; `charge` mapeia para `CostType` `task` (mesmo vocabulário do chargeset) | idem (variantes resource/charge) |
| 14C.9.5 | `"defaultaccount"` em `CANONICAL_KEYWORDS` antes de `definitions`; pt-BR `contapadrao`, es `cuentapredeterminada`. O lexer deriva `_defaultaccount` automaticamente | idem — registry + AST equivalente en/pt-BR/es |
| 14C.9.6 | `ReferenceAttribute#to_rti` = `RichText("[url label]")` sem handlers (Ruby `Attributes.rb:462`); valor vazio → `null`. O teste antigo que exigia `NotYetImplementedError` foi substituído | `tests/attributes/reference-attributes_test.ts` (2 steps) + `tests/attributes/to-rti_14c_test.ts` |
| 14C.9.7 | `ListAttributeBase#to_rti(query?)` portado de `Attributes.rb:498`: sem query → um RTI com os nomes; com `query.listItem` → `<nowiki>` por item com `q.property = item` + `query.assignList`; sem template → `<nowiki>name</nowiki>` | `tests/attributes/to-rti_14c_test.ts` (3 steps) + `list-primitive-attributes_test.ts` |
| 14C.9.8 | Auditoria: `AttributeBase#to_rti` já devolvia `null` (fiel a Ruby); `Journal#to_rti` já implementado desde a 14C.0/13 (`JournalEntry#to_rText`); `Query#to_rti` passa a repassar `this` e `Query#assignList` gera o RTI (`RichText(list)`) — o placeholder "Fase 12" foi fechado | `tests/query/query_test.ts` (assignList) |

> **Decisão de port (14C.9.3):** `defaultaccount` é **extensão SyntaxMesh** (não existe no TJ 3.8.4 — busca em `docs/taskjuggler/lib/taskjuggler/` sem resultado). Como o bloco `project` sempre precede as declarações de `account`, o parser guarda o **ID** e a resolução acontece em `Project#defaultAccountFor` via `Project#account(id)`. Conta inexistente **não** falha o parse e resolve para `null` (regra 4 continua sem atribuição) — validação antecipada exigiria um segundo passe.

## 14C.10 — MSPDI `<Baseline>` via `baseline <scenario>`

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.10.1 | Atributo de report `baseline` (IntegerAttribute/`scenarioIdx`, não herdado) | `model/attributes/report-attributes.ts` | 1 teste |
| 14C.10.2 | Parser do corpo de `export`: `baseline <scenario_id>` (reusa `!scenarioId`) | `parser/rules/report.ts` | 2 testes |
| 14C.10.3 | i18n `baseline` (pt-BR `linhadebase`, es `lineabase`) | `i18n/*` | 1 teste |
| 14C.10.4 | `MspXmlRE`: `<Baseline>` do projeto (Number 0) com Start/Finish/Cost do cenário | `reports/msp-xml-re.ts` | 2 testes |
| 14C.10.5 | `MspXmlRE`: `<Baseline>` por tarefa (Start/Finish/Cost do cenário, omitido sem data) | idem | 3 testes |
| 14C.10.6 | Sem `baseline`, documento byte-idêntico (regressão do oracle `mspdi.golden.json`) | — | golden verde |
| 14C.10.7 | Golden de extensão: fixture com `baseline` + snapshot em `reports-extensions.golden.json` | `tests/golden/*` | idempotente 2× |

### Evidências 14C.10.1–14C.10.7

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.10.1 | `baseline` registrado em `report-attributes.ts` entre `balance` e `booking` (`IntegerAttribute`, default `null`, `isScenarioAttribute=false`, nem herdado do pai nem do projeto). Guarda o **índice** do cenário, não um `Scenario` | `tests/reports/baseline_14c_test.ts` — 2 steps (definição + ausência no default); contagem em `report-attributes_test.ts` 66 → 67 |
| 14C.10.2 | `p.pattern(["_baseline", "!scenarioId"])` em `exportAttributes` após `p.level("beta")`; `asProp(this).set("baseline", sc)`; `sc` não numérico (ID desconhecido já reportado) não grava nada; cenário inativo → aviso `baseline_sc_disabled` mantendo o índice | `tests/reports/baseline_14c_test.ts` — 3 steps (índice, `unknown_scenario_id`, aviso) |
| 14C.10.3 | `"baseline"` em `canonical.ts` entre `balance` e `booking`; pt-BR `linhadebase`, es `lineabase`; `en` deriva do canônico | idem — registry + AST pt-BR (`cenário`/`exportar`/`formatos`/`linhadebase`) |
| 14C.10.4 | `generateProjectBaseline` agrega min(`start`)/max(`end`) das tarefas do cenário e `scenarioCost(null, sc)`; `appendBaseline` escreve `Number` 0, `Start`, `Finish` e `<Cost>` só quando há `CostEvent`. Sem datas → `baseline_not_scheduled` e nenhum `<Baseline>` do projeto | idem — 3 steps (datas do fixture, `<Cost>` 500.0 com dois eventos sintéticos, omissão + aviso) |
| 14C.10.5 | Em `generateTask`, após `appendPredecessors`: `baselineDates(task, baselineIdx)` nulo pula a tarefa; `scenarioCost(task, baselineIdx)` restringe o `<Cost>` aos eventos dela | idem — 2 steps (Alpha/Beta com Number/Start/Finish; cenário sem datas ⇒ nenhum `<Baseline>`) |
| 14C.10.6 | Nenhum código roda quando `baselineIdx === null`: `mspdi.golden.json` e o snapshot `mspdi` de `reports-extensions` ficam byte-idênticos | `mspdi_oracle_14c_test.ts` + `reports-extensions_golden_test.ts` verdes; `baseline_14c_test.ts` confirma ausência de `<Baseline>` no fixture sem o atributo |
| 14C.10.7 | `snapshotBaseline()` em `extension-snapshot.ts` (fixture `14c-baseline`): `baselineScenario` 1, `<Baseline>` do projeto (02/03 09:00 → 11/03 17:00) e por tarefa (Alpha/Beta). Só blocos sem timestamp entram no snapshot | `deno task golden:generate:extensions` + `reports-extensions_golden_test.ts` (idempotente 2×) |

> **Decisão de port (14C.10.1):** `baseline` é **extensão SyntaxMesh** — o §6 de `docs/tj3-engine/mspdi.md` descreve `<Baseline>`/`<Baseline>` por tarefa, mas o `MspXmlRE.rb` do TJ 3.8.4 nunca os emite (busca em `docs/taskjuggler/lib/taskjuggler/reports/` sem resultado), logo não há oracle Ruby. O atributo é `IntegerAttribute` (índice) e **não** `ScenarioAttribute`: `ScenarioAttribute` faria o valor variar por cenário, enquanto aqui o relatório aponta para um cenário fixo.
>
> **Decisão de port (14C.10.4):** o `<Cost>` do baseline sai de `project.costEvents` (Fase 8.2), filtrado por `scenarioIdx` e, nas tarefas, por identidade da tarefa. Nenhum fixture `.tjp` atual gera `CostEvent` (o caminho depende de chargeset de recurso com `rate`), então o teste de custo injeta dois eventos no projeto já agendado — o caminho de soma fica coberto sem inventar um cenário de rates que o scheduler ainda não produz.

## 14C.11 — Unit price por alocação/booking + remoção de `totalquantity`

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.11.1 | `MaterialAllocation.unitPrice?` + `unitPriceFor(material)` (precedência alocação → material) | `model/material-allocation.ts` | 3 testes |
| 14C.11.2 | Parser: `unitprice <n>` opcional depois do modificador na alocação de tarefa | `parser/rules/material.ts` | 3 testes |
| 14C.11.3 | `MaterialBooking` (material, quantity, unitPrice, date, task) + atributo de cenário `materialbookings` | `model/material-booking.ts`, `model/attributes/task-attributes.ts` | 3 testes |
| 14C.11.4 | Parser: `booking material "X" quantity <q> [unitprice <p>] on <data>` no corpo da tarefa | `parser/rules/task.ts` | 3 testes |
| 14C.11.5 | Parser: mesma forma no corpo do material, com `task <id>` para amarrar a tarefa | `parser/rules/material.ts` | 2 testes |
| 14C.11.6 | Preço efetivo nos relatórios: alocação (`table-report`, `breakdown-report`, `rdo-report`, `msp-xml-re`) usa `unitPriceFor` | `reports/*` | 4 testes |
| 14C.11.7 | Custo realizado do material = Σ bookings (quantidade × preço do booking → alocação → material) quando não houver `CostEvent` | `reports/table-report.ts` | 2 testes |
| 14C.11.8 | Export TJP: `unitprice` na alocação e no booking; round-trip | `reports/tjp-export-re.ts` | 2 testes |
| 14C.11.9 | Remover `totalquantity` da gramática do material | `parser/rules/material.ts` | 2 testes (token rejeitado; fixture migrada) |
| 14C.11.10 | Remover o atributo `totalquantity` e derivar a quantidade (Σ alocações) em `materialreport`/`breakdown`/`rdo` | `model/attributes/material-attributes.ts`, `reports/*` | 3 testes |
| 14C.11.11 | Export TJP deixa de emitir `totalquantity`; fixtures e goldens de extensão migrados | `reports/tjp-export-re.ts`, `tests/fixtures/ext/*` | golden idempotente |
| 14C.11.12 | Requisito `unitprice` no timesheet registrado na Fase 18 (parser de timesheet sem bloco de material) | `docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md` | doc |

#### Evidências 14C.11.1–14C.11.12 (preenchido 2026-11-01)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.11.1 | `MaterialAllocation#unitPrice?` (5º argumento do construtor) + `#unitPriceFor(material = this.material)` = `unitPrice ?? material.unitPriceValue()` | `tests/model/material-allocation_test.ts` — 3 steps (sem preço → material, com preço, material alternativo) |
| 14C.11.2 | Regra `materialAllocationUnitPrice` (`p.optional()` + `_unitprice !number`) referenciada por `materialAllocation` e pelo alias `use`; `addMaterialAllocation` grava `this.val[4]` | `tests/parser/rules_material_booking_14c_test.ts` — 3 steps (com modificador, sem preço, `use` sem modificador) |
| 14C.11.3 | `model/material-booking.ts` (`material`, `taskId`, `quantity`, `date`, `unitPrice?`, `task` resolvível) + `materialbookings` em `task-attributes.ts` (`NodeListAttribute`, `scenarioSpecific`, default `[]`) | `tests/model/material-booking_14c_test.ts` — 3 steps; `attribute-definitions.golden.json` (173 casos) e `task-attributes_test.ts` 45 → 46 |
| 14C.11.4 | `taskBooking` ganha o padrão `["_material", "!materialBooking"]`; a regra `materialBooking` (`!materialId _quantity !number !materialBookingUnitPrice _on !date`) fica **aninhada** no booking de recurso — duas regras irmãs começando por `_booking` geravam ambiguidade de FSM | idem — 3 steps (com preço, sem preço + herança, convivência com o booking de recurso) |
| 14C.11.5 | Padrão `_booking !materialBookingTaskRef _quantity !number !materialBookingUnitPrice _on !date` no corpo do material; tarefa ausente vai para `Project.pendingBookings` (drenado por `flushPendingBookings()` no fim da regra `project`) | idem — 2 steps (referência futura + nome entre aspas) |
| 14C.11.6 | `unitPriceFor` nas rotas de relatório: `table-report` (`taskMaterialCost`, `materialAllocationCost`, `bookingCost`), `breakdown-report`, `rdo-report`, `msp-xml-re` | `tests/reports/material-booking-cost_14c_test.ts` — 1 step (alocação vence o material) + migrações de `trace-report-material`/`task-material-columns` |
| 14C.11.7 | `taskMaterialCost` soma alocações **e** bookings quando não há `CostEvent`; `materialActualCost` = Σ bookings no período; `totalcost` = planejado + realizado | idem — 2 steps (booking alimenta `actualcost`/`totalcost`; precedência cai para a alocação) |
| 14C.11.8 | `generateMaterialAllocations` emite `unitprice` só quando declarado; `generateMaterialBookings` emite `booking material <id> quantity <q> [unitprice <p>] on <data>` sob `taskattributes materialbookings` | `tests/reports/tjp-export-material_14c_test.ts` — 3 steps (linha + round-trip do booking + ausência de material) |
| 14C.11.9 | `totalquantity` fora do corpo do material; padrão `["_totalquantity", "!number"]` **reservado** emite `totalquantity_removed` com instrução de migração | `tests/parser/rules_material_test.ts` — 2 steps (rejeição direcionada + corpo canônico) |
| 14C.11.10 | `totalquantity` fora de `material-attributes.ts`; `Material#allocations`/`#allocatedQuantity`/`#allocatedCost` derivam das alocações; a coluna `totalquantity` do `materialreport` passou a ser **calculada** (`materialNumericColumns`) | `tests/reports/material-report-output_14c_test.ts`, `material-list-re_test.ts`, `query-material_14c_test.ts`, `markdown-output_14c_test.ts` |
| 14C.11.11 | `TjpExportRE` não emite mais `totalquantity`; as três fixtures de extensão migradas para alocação | `reports-extensions.golden.json` regenerado (concrete 50 → 10 @1200, steel 1000 → 200 @500) |
| 14C.11.12 | Fase 18 ganha **18.17.9** (record de material com `unitprice` → `MaterialBooking`) e **18.17.10** (parser/sender do sheet) | `fase-18-time-status-sheets-tarefas.md` §18.17 |

> **Nota (14C.11.9):** `totalquantity` continua em `CANONICAL_KEYWORDS` e nos dicionários pt-BR (`quantidadetotal`)/es (`cantidadtotal`) **de propósito**: é o que permite ao lexer emitir `_totalquantity` e a regra reservada produzir `totalquantity_removed` em vez de `unexpctd_token`. O token não é mais um atributo do modelo.

## 14C.12 — Auditoria G1.4 (scheduler) + verificação do adendo

| # | Tarefa | Verificação |
|---|--------|-------------|
| 14C.12.1 | Inventário dos 4 bugs corrigidos (PropertyList items, `doneEffort`, `propagateDate`, Xref) com arquivo/linha | doc |
| 14C.12.2 | Probe ao vivo: modelo construído à mão (`start`+`effort`+`allocate`) via `Project.schedule()` | 1 teste (âncora: passa quando o placement evoluir) |
| 14C.12.3 | Varredura de bugs remanescentes (`toSeconds` null em `propagateDateToDep`, `ScenarioData#error` stub) | doc + testes |
| 14C.12.4 | Registrar achados no adendo 2026-10-27 da Fase 7 (sem reabrir a fase) | doc |
| 14C.12.5 | `check:all`, `check:stubs`, suíte completa e goldens byte-idênticos | exit 0 / 0 falhas |
| 14C.12.6 | Docs: `CURRENT.md`, `plano.md`, `AGENTS.md` + rastreabilidade §11.7 do plano | diff |

#### Evidências 14C.12.1–14C.12.6 (preenchido 2026-11-01)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.12.1 | Inventário dos quatro correções do adendo de 2026-10-27: `PropertyList.items = arg.to_ary` (o loop não via tarefa alguma), `doneEffort()` lendo `_doneEffort` (não o atributo de usuário `effortdone`), `Xref`/`checkDependency` resolvendo `dependency.task`, `propagateDate` gravando `start`/`end` e propagando a dependentes/filhos/containers | `tests/integration/logical-scheduler-driven_test.ts` + cabeçalho de `scheduler-g1_4-audit_14c_test.ts` |
| 14C.12.2 | Probe: modelo à mão (`start` + `effort 16` + `allocate` + 1 recurso 24h/dia) → `Project.schedule()` devolve `true`, `start`/`end` não nulos e `doneEffort() === 16` | `scheduler-g1_4-audit_14c_test.ts` — step “probe: modelo à mão recebe start/end” |
| 14C.12.3 | Bug remanescente da varredura: a variante sem argumentos de `TaskScenario#propagateDateToDep()` fazia `(this.a("end") as TjTime).toSeconds()` sem guard → `TypeError` em tarefa nunca agendada. Reescrita com `own`/`other` locais e `continue` quando `null`. O outro item da varredura (`ScenarioData#error` stub) já estava fechado antes desta subfase | idem — 2 steps (nada propagate sem data própria; dependente reprogramado quando a data muda) |
| 14C.12.4 | Adendo **2026-11-01** em `fase-7-scheduler-core-tarefas.md`: fix do null-deref + divergência de `finishScheduling` (o Ruby recursa, mescla `assignedresources` no pai e anula as listas de candidatos; o port calcula completion/status/gauge, chama `propagateDateToDep()` e grava `_scheduled`) registrada sem reabrir a Fase 7 | doc + 3 steps verdes |
| 14C.12.5 | Com o guard, `CSV-Reports/alert.tjp` passou a agendar: `PENDING_SCHEDULER_FILES` em `tests/golden/reports_golden_test.ts` ficou **vazio** e o arquivo passou a ser comparado com o oracle Ruby (112 passos). Nenhum golden precisou ser regenerado | `deno test -A packages/core/tests/golden/reports_golden_test.ts` — ok, 0 falhas |
| 14C.12.6 | `CURRENT.md`, `plano.md` (linha 14-C) e `AGENTS.md` atualizados; tabelas de evidência 14C.8–14C.12 preenchidas; `deno task check-all` verde | este documento + diff |

> **Nota (14C.12):** a auditoria **não** reescreveu o scheduler. O único código de produção tocado foi o guard de nulidade em `task-scenario.ts`; o resto é âncora de teste e documentação. O efeito colateral positivo (destravar `alert.tjp`) veio da mesma correção.

## 14C.13 — Booking de estoque (material sem tarefa, quantidade ±)

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.13.1 | `MaterialBooking.taskId: string \| null`; quantidade negativa rejeitada **só** quando há tarefa | `model/material-booking.ts` | 3 testes |
| 14C.13.2 | Atributo de cenário `stockbookings` no PropertySet de material | `model/attributes/material-attributes.ts` | 2 testes |
| 14C.13.3 | Regra `signedNumber` (`!number` \| `_- !number`) usada pela gramática de estoque | `parser/rules/common.ts`, `parser/rules/material.ts` | 2 testes |
| 14C.13.4 | Parser: `booking [quantity] <n> [unitprice <p>] on <data>` sem tarefa no corpo do material | `parser/rules/material.ts` | 3 testes |
| 14C.13.5 | Erro `stock_booking_without_chargeset` quando não há `chargeset` nem `defaultaccount material` | `parser/rules/material.ts` | 2 testes |
| 14C.13.6 | `Material#stockQuantity` / `#stockCost` derivados | `model/material.ts` | 2 testes |
| 14C.13.7 | Turnover: bookings de estoque com data em `[start, end)` entram na conta resolvida (regra 2 → regra 4) | `model/account-scenario.ts` | 3 testes |
| 14C.13.8 | Export TJP round-trip do booking de estoque + verificação final do bloco | `reports/tjp-export-re.ts` | 2 testes |

## 14C.14 — Unit price calculado por composição

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.14.1 | `MaterialComponent { material, quantity }` | `model/material-component.ts` (novo) | 2 testes |
| 14C.14.2 | Atributo de cenário `materialcomponents` no material | `model/attributes/material-attributes.ts` | 1 teste |
| 14C.14.3 | Parser: `material <id> <quantidade>` no corpo do material; `!material` (declaração aninhada) sai de `materialAttributes` | `parser/rules/material.ts` | 3 testes |
| 14C.14.4 | `Material#unitPriceValue()` com componentes (recursivo, com guard de pilha) | `model/material.ts` | 3 testes |
| 14C.14.5 | Erro `unitprice_with_components` nas duas ordens | `parser/rules/material.ts` | 2 testes |
| 14C.14.6 | Erro `material_composition_cycle` (DFS de alcance antes de anexar) | `parser/rules/material.ts` | 2 testes |
| 14C.14.7 | Exemplo do §12 (concreto a 234,95) de ponta a ponta: parse → preço calculado → alocação → custo | `tests/fixtures/ext/*` | 2 testes |

## 14C.15 — Keywords opcionais (`effort`/`quantity`/`value`) + `booking charge`

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.15.1 | `effort` opcional no booking de tarefa (`taskBookingHeader`) | `parser/rules/task.ts` | 2 testes |
| 14C.15.2 | `effort` opcional no booking de recurso (`resourceBookingHeader`) | `parser/rules/resource.ts` | 1 teste |
| 14C.15.3 | `quantity` opcional no booking de material (corpo da tarefa e corpo do material) | `parser/rules/material.ts` | 3 testes |
| 14C.15.4 | `ChargeBooking` (dono, tarefa, montante ±, data, descrição) + atributo `chargebookings` da tarefa | `model/charge-booking.ts` (novo), `model/attributes/task-attributes.ts` | 3 testes |
| 14C.15.5 | Parser: `booking charge ["<descrição>"] [value] <n> on <data>` no corpo da tarefa — **sem** referência de recurso (revisão 2026-11-02) | `parser/rules/booking.ts`, `parser/rules/task.ts` | 5 testes |
| 14C.15.6 | Parser: `booking charge <tarefa> ["<descrição>"] [value] <n> on <data>` no corpo do recurso | `parser/rules/booking.ts`, `parser/rules/resource.ts` | 2 testes |
| 14C.15.7 | Mesma forma no corpo do material (com referência futura) | `parser/rules/booking.ts`, `parser/rules/material.ts`, `model/project.ts` | 2 testes |
| 14C.15.8 | i18n pt-BR/es das keywords novas + export TJP de `booking charge` | `i18n/*`, `reports/tjp-export-re.ts` | 3 testes |

## 14C.16 — Turnover com precedência de unit price

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.16.1 | Auditoria das rotas de custo de material até a conta (alocação, estoque, relatório) | doc + testes | 4 testes |
| 14C.16.2 | Preço de **alocação** vence o do material no turnover | `model/account-scenario.ts` | 1 teste |
| 14C.16.3 | Preço **calculado** por composição chega ao turnover | `model/material.ts` | 1 teste |
| 14C.16.4 | Booking **com tarefa** não duplica custo no turnover (decisão §13.4) | idem | 1 teste-âncora |
| 14C.16.5 | Estorno: booking de estoque negativo subtrai da conta | idem | 1 teste |

## 14C.17 — Cenários: registro do comportamento real

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.17.1 | Sondar o código nos 4 pontos do §12 e confrontar com a fonte Ruby | doc (plano §13.5) | — |
| 14C.17.2 | Teste de caracterização: cenário de 2 níveis, `fullId` curto, herança por aninhamento | `tests/model/scenario-nesting_14c_test.ts` (novo) | 4 testes |
| 14C.17.3 | Teste: redeclarar o top-level limpa os cenários (`clearProperties`) | idem | 1 teste |
| 14C.17.4 | Corrigir a tabela do §12 no plano (não há divergência) | `fase-14-relatorios-complemento.md` | diff |

## Notas de conclusão

#### Evidências 14C.13.1–14C.13.8 (preenchido 2026-11-02)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.13.1 | `MaterialBooking.taskId: string \| null` + `task: Task \| null`; construtor rejeita quantidade negativa só quando `taskId !== null` | `tests/model/material-booking_14c_test.ts` — 3 steps (erro de negativo, campos, isInventory) |
| 14C.13.2 | `stockbookings` (`NodeListAttribute`, `isScenarioAttribute=true`) registrado em `material-attributes.ts` | `tests/attributes/material-attributes_test.ts` + contagem |
| 14C.13.3 | `signedNumber` (`p.optional(‘-‘) !number`) em `parser/rules/common.ts` + referenciada pela gramática de estoque | `debug/adendo_extra_probe.ts` casos estoque +/− (2 steps) |
| 14C.13.4 | `materialBookingBody` com `!materialBookingTaskRef` opcional; `addStockBooking` grava em `stockbookings` do material | `debug/adendo_extra_probe.ts` — 2 steps (estoque + / −, sem task) |
| 14C.13.5 | `validateStockBookings` emitido no fechamento de `materialBody`; erro `stock_booking_without_chargeset` | `debug/adendo_extra_probe.ts` — 1 step (m8: erro esperado sem chargeset) |
| 14C.13.6 | `Material#stockQuantity(scIdx)` / `#stockCost(scIdx)` derivados | `turnover-price-precedence_14c_test.ts` — rota de estoque (4 steps) |
| 14C.13.7 | `AccountScenario#addStockBookings`: data ∈ [start,end), conta = `stockAccount` (chargeset→defaultaccount), `CostEvent material_usage` idempotente | `turnover-price-precedence_14c_test.ts` 14C.16.5 — 2 steps (estorno, soma) |
| 14C.13.8 | Export TJP: `booking [quantity] <n> [unitprice <p>] on <data>` no corpo do material | `tjp-export-re.ts` (booking export já coberto em 14C.11.8) |

#### Evidências 14C.14.1–14C.14.7 (preenchido 2026-11-02)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.14.1 | `model/material-component.ts` (`MaterialComponent { material, quantity }`) | `turnover-price-precedence_14c_test.ts` 14C.16.3 (1 step) |
| 14C.14.2 | `materialcomponents` (`NodeListAttribute`, `isScenarioAttribute=true`) em `material-attributes.ts` | contagem em `material-attributes_test.ts` |
| 14C.14.3 | Regra funil `material` → `materialNameRef` + `materialStatementTail`; `material <ref> <qtd>` via `addMaterialComponent` | `debug/adendo_extra_probe.ts` (caso m9: composição, 1 step) |
| 14C.14.4 | `Material#unitPriceValue()` recursivo com `pricingStack` (ciclo → 0) | `turnover-price-precedence_14c_test.ts` 14C.16.3 (1 step) |
| 14C.14.5 | `unitprice_with_components` — nas duas ordens | `debug/adendo_extra_probe.ts` |
| 14C.14.6 | `material_composition_cycle` via DFS de alcance (`composes()`) | `debug/adendo_extra_probe.ts` |
| 14C.14.7 | Exemplo do §12 (Concreto a 234,95) ponta a ponta | `turnover-price-precedence_14c_test.ts` 14C.16.3 — 1 step |

#### Evidências 14C.15.1–14C.15.8 (preenchido 2026-11-02)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.15.1 | `bookingEffortKeyword` (`p.optional()` com `_effort`) referenciado em `taskBooking` | `debug/adendo_extra_probe.ts` — caso “task: booking curtos” (2 steps) |
| 14C.15.2 | `bookingEffortKeyword` em `resourceBookingHeader` | idem — “resource: booking <task> <interval>” |
| 14C.15.3 | `bookingQuantity` (`p.optional()` com `_quantity`) em `bookingEffort` e em `materialBooking` | `debug/adendo_extra_probe.ts` — casos material curto +/− (3 steps) |
| 14C.15.4 | `ChargeBooking` (`model/charge-booking.ts`) + `chargebookings` em `task-attributes.ts`; campo `description` (revisão 2026-11-02) | `tests/attributes/task-attributes_test.ts` 46→47; `attribute-definitions.golden.json` regenerado |
| 14C.15.5 | `taskChargeBookingHeader` **sem** referência de recurso + descrição `$STRING` opcional (regra `chargeBookingDescription`); antigo `booking charge <recurso>` passa a ser rejeitado | `tests/parser/rules_booking_charge_14c_test.ts` — 5 steps (sem ref/desc, `value`, descrição, estorno com descrição, recurso rejeitado) |
| 14C.15.6 | `resourceChargeBookingHeader` com `!chargeBookingTaskRef` + descrição opcional (índices 2/4/6) | idem — 2 steps (descrição gravada, `unknown_task` mantido) + probe `debug/adendo_extra_probe.ts` |
| 14C.15.7 | `materialChargeBookingHeader` idem + fila `pendingBookings` (referência futura resolve por **ID**, como o booking de material) | idem — 1 step (fila drenada, descrição preservada) + probe — 4 steps |
| 14C.15.8 | i18n `effort`/`quantity`/`value` pt-BR/es (value=quantia para evitar colisão com `charge`=valor); `booking charge` no export TJP | `i18n/pt-BR.ts`, `i18n/es.ts` + golden parser |

#### Evidências 14C.16.1–14C.16.5 (preenchido 2026-11-02)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.16.1 | Auditoria: `allocatedCost` usa `unitPriceFor(allocation)`; `booking.cost()` sem alocação usa `unitPrice ?? unitPriceValue()`; `addStockBookings` só itera `stockbookings` (não `materialbookings`); precedência booking→alocação→material na rota de relatório | `tests/reports/turnover-price-precedence_14c_test.ts` — 6 steps |
| 14C.16.2 | Preço da alocação (unitPrice=20) vence o do material (unitPrice=10) no `turnover(aggregate=materials)` | idem — 1 step (turnover = 5×20 = 100) |
| 14C.16.3 | Preço calculado por composição (Σ componente×preço) chega a `allocatedCost` e ao turnover quando não há unitPrice na alocação | idem — 1 step (2×204,75 = 409,5) |
| 14C.16.4 | Booking com tarefa (`taskId !== null`) fica em `materialbookings` da tarefa, **não** em `stockbookings` do material — não entra no `addStockBookings` | idem — 1 step (parser: stockBookings vazio) |
| 14C.16.5 | Booking de estoque negativo (−100 × 10) subtrai 1000 do turnover da conta; soma algébrica de entrada e saída | idem — 2 steps |

#### Evidências 14C.17.1–14C.17.4 (preenchido 2026-11-02)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.17.1 | Sondados os 4 pontos (§13.5): `project.ts:268` `PropertySet(this, true)` ✓; `scenario.ts:163` `p.pattern(["!scenario"])` recursivo ✓; `scenario.ts:196` usa `this.property` como parent ✓; sem teste prévio de 2 níveis → nova arquivo | doc (tabela §13.5 preenchida com arquivo/linha) |
| 14C.17.2 | Cenário de 2 níveis: ambos registrados, `real.fullId === "real"`, `real.parent === plan`, `real` herda `active` de `plan` por aninhamento | `tests/model/scenario-nesting_14c_test.ts` — 4 steps |
| 14C.17.3 | Segundo `scenario` top-level limpa os anteriores (`clearProperties` quando `!this.property`) | idem — 1 step (só s2 sobrevive) |
| 14C.17.4 | Tabela “Diferenças prováveis” do §12 corrigida com nota de confirmação e evidência Ruby (`PropertyTreeNode.rb:294-303`); §13.5 mantém-se como fonte canônica | diff em `fase-14-relatorios-complemento.md` |

## 14C.18 — Colunas de estoque `stockquantity`/`stockcost` (pendência §13.7)

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.18.1 | Keywords `stockquantity`/`stockcost` no i18n (canonical + pt-BR + es) | `i18n/canonical.ts`, `i18n/pt-BR.ts`, `i18n/es.ts` | parser + golden i18n |
| 14C.18.2 | Parser: `singlePattern` em `reportableAttributes` (com `descr`) + títulos em `MATERIAL_COLUMN_TITLES` | `parser/rules/report.ts` | 2 testes |
| 14C.18.3 | `TableReport`: metadados (`materialPropertiesById`, `materialNumericColumns`), `defaultColumnTitle` como segundo dicionário, casos de célula em `genMaterialCell` + helpers de período/soma | `reports/table-report.ts` | 5 testes |
| 14C.18.4 | Limpeza da pendência §13.7: apagar o órfão `ExtendedBooking` (Fase 8.1), sem instanciadores no parser/engine; `ChargeBooking` fica como fonte única do booking de charge (merge descartado — formas incompatíveis) | `model/extended-booking.ts` (delete), `model/mod.ts`, comentário `model/charge-booking.ts` | `deno check` + suíte sem o teste órfão |

#### Evidências 14C.18.1–14C.18.4 (preenchido 2026-11-02)

| # | Implementação | Verificação |
|---|---------------|-------------|
| 14C.18.1 | `"stockcost"`/`"stockquantity"` em `canonical.ts`; pt-BR `custoestoque`/`quantidadeestoque`; es `costoexistencias`/`cantidadexistencias` | `columns stockquantity, stockcost` parseia limpo (`tests/reports/stock-columns_14c_test.ts` — 1 step); keyword desconhecida rejeitada — 1 step |
| 14C.18.2 | Par `_stockquantity`/`_stockcost` no fim de `reportableAttributes` (após os itens da 10-C) com `descr()`; títulos “Stock Quantity”/“Stock Cost” em `MATERIAL_COLUMN_TITLES` | idem — 1 step (ids e títulos das colunas parseadas) |
| 14C.18.3 | Σ algébrico dos bookings `isInventory()` com data em `[start, end]` (`stockBookingsInPeriod`); preço efetivo `booking.cost()` (booking → material); `defaultColumnTitle` consulta `materialPropertiesById` após `propertiesById` | idem — 5 steps (soma 400/4000, precedência 50/700, recorte de período 500/5000, sem movimentos 0/0, booking com tarefa não entra) |
| 14C.18.4 | `ExtendedBooking` + teste + re-export removidos; comentário de `ChargeBooking` atualizado para "fonte única" | `deno check packages/core/mod.ts` limpo; suíte core verde sem as 7 etapas do teste órfão |

---

## Notas de conclusão

- **ADRs afetados:** 027 (adendo 14C.5.12 — default `richtext`/opt-in
  `markdown` nos reports); nenhum ADR novo (as três diretivas de C6 são
  extensões documentadas aqui e nas tabelas de atributos).
- **Divergências rastreadas (não corrigidas):** `Material#name` espelha o id
  (14C.6.8) — TJP/MSPDI mostram `aco`, não o texto do cabeçalho;
  `name`/`projectid`/`version` do projeto não são consultáveis por `query`
  (14C.5); `columns unit|unitprice|totalcost` via `.tjp` continua rejeitado
  por `reportableAttributes` (os keywords não são `singlePattern`) — o que C18
  resolveu foi o **título**: `defaultColumnTitle` passou a consultar
  `materialPropertiesById`, então toda coluna de material aceita em `.tjp`
  (inclusive as novas de estoque) sai cabeçada também fora do
  `materialreport`.
- **Vereditos da 14C.1.15–1.18:** `resourcereport`, `icalendar`/`niku`/`tagfile`/
  `chartplotter` e as grades `Calendar` não listam material (decisão);
  `htmlstatusreport`/`xmlreport` não existem no TJ 3.8.4 e o requisito
  “statussheet lista materiais” está na **18.17.8**.
- **Limitações do MSPDI (14C.4.12):** sem `<Baseline>`/`<ExtendedAttribute>`
  (o modelo não tem os dados); `CalendarUID` completo por recurso limitado a
  `<Exceptions>`; `Project` não tem store `leaves`.
- **Pendências herdadas:** a saída markdown `.md` + prefixos `md*report` foi
  entregue na 14C.8; o requisito de `unitprice` no timesheet ficou registrado
  como **18.17.9/18.17.10** e o status sheet com materiais como **18.17.8**
  (Fase 18).
- **Fechado na 14C.12:** `PENDING_SCHEDULER_FILES` (golden de reports) ficou
  vazio — `alert.tjp` agora é comparado contra o oracle Ruby; a divergência de
  `finishScheduling` segue aberta só na documentação da Fase 7.
