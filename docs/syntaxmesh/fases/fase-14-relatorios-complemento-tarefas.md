# Fase 14 Complemento — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-14-relatorios-complemento.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~100 tarefas
> **Concluídas:** 0
> **Fonte Ruby (parcial):** `docs/taskjuggler/lib/taskjuggler/reports/MspXmlRE.rb` +
> `Journal.rb` + `AlertLevelDefinitions.rb` (o restante — materialreport,
> breakdown, RDO, markdown em reports — são **extensões SyntaxMesh sem oracle**)

---

## Checklist de progresso

```
[ ] 14C.0 Fundação (json, journal-index, alert-levels, picture-render, dispatch) — 12
[ ] 14C.1 Materiais nos relatórios existentes + materialreport                   — 22
[ ] 14C.2 BreakdownReport (absorve 14.25.1–5)                                   — 10
[ ] 14C.3 RdoReport + galeria de imagens (absorve 14.25.6–10)                   — 14
[ ] 14C.4 MspXml → MSPDI (mspdi.md)                                             — 16
[ ] 14C.5 Markdown nos relatórios                                               — 12
[ ] 14C.6 hidematerial/rollupmaterial/hidepicture + auditoria hide/rollup       — 10
[ ] 14C.7 Golden/fixture + verificação final + docs                             — 8
─────────────────────────────────────────────────────────
TOTAL: ~94
```

**Ordem:** C0 → C1 → C2 → C3 → C4 → C5 → C6 → C7. C4 e C5 independem de C2/C3
(podem paralelizar). C6.5+ depende de C2/C3 (aplica hide nos novos geradores).

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
| 14C.0.11 | Fixture `.tjp` base do complemento: projeto com materiais, allocations, charges (flat/perCost), journalentries com `picture`/`format markdown` em task/resource/material/account — `packages/core/tests/golden/fixtures/14c-rdo-budget.tjp` | fixture | carregável por `ProjectFileParser` (1 teste) |
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

---

## 14C.4 — MspXml → MSPDI (fonte: `docs/tj3-engine/mspdi.md`)

> Oracle Ruby parcial: `MspXmlRE.rb` cobre o essencial humano; extensões de
> material/custo são SyntaxMesh (sem oracle) — validar por **regras do
> mspdi.md** + estrutura.

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| 14C.4.1 | Script Ruby `scripts/golden/mspdi-tj3.rb`: roda tj3 sobre mwe005 (ou projeto com tasks/resources) gerando o XML MSPDI real e extrai o `<Project>` normalizado → `mspdi.golden.json`; wiring `golden:generate` + README | `scripts/golden/`, `generate_golden.ts` | byte-idempotente; teste compara TS atual vs oracle nos campos já portados (regra de normalização p/ atributos/whitespace, 14.23.9) |
| 14C.4.2 | Recursos **material**: `Material` → `<Resource>` com `<Type>2</Type>`, `<MaterialLabel>` = unidade, `<StandardRate>` = `unitPrice`; UID distinto de recursos humanos (espaço de UID único global) | `reports/msp-xml-re.ts` | 2 testes (absorve pedido §mspdi 3.2) |
| 14C.4.3 | Alocações de material → `<Assignment>` com `<Units>` = quantidade e `<Cost>` = quantity×unitPrice; ligar TaskUID/ResourceUID corretos (nunca `<ID>`) | idem | 2 testes (mspdi §4.2) |
| 14C.4.4 | Recursos **custo**: `ExtendedCharge`/`Charge` flat não-atrelados a recurso humano → `<Resource>` `<Type>0</Type>` (+`<IsBudget>` quando apropriado) e `<Assignment><Cost>` direto | idem | 2 testes |
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

---

## Notas de conclusão (preencher ao final)

- (espelho do padrão da casa: ADRs afetados, divergências rastreadas,
  vereditos de 14C.1.15–18, limitações de Mspdi 14C.4.12)
