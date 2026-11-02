# Fase 14 Complemento — Relatórios: Materiais, RDO, MspXml e Markdown

> **Arquivo:** `docs/syntaxmesh/fases/fase-14-relatorios-complemento.md`
> **Tarefas:** `docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md`
> **Status:** ✅ concluída — C0 ✅ 2026-10-31 · C1–C7 ✅ 2026-11-01 (450 testes / 4841 passos) · adendo §10 → C8–C12 ✅ 2026-11-01 (472 testes / 4909 passos) — ver §11 · adendo extra §12 → C13–C17 ✅ 2026-11-02 (482 testes / 4934 passos, incl. a revisão de `booking charge`) — ver §13 · pendência §13.7 → C18 ✅ 2026-11-02 — ver §14
> **Duração estimada:** 8–12 dias
> **Depende de:** Fases 8.1/8.2 (material + modelo contábil), 10 Complemento (parser reconhece `material`/`picture`/`format`/`breakdownreport`/`rdoreport`), 11 (motor lógico/Query), 12 (RichText), 13 (Markdown), 14 (pipeline de relatórios — concluída 2026-10-31)
> **Bloqueia:** adendos de UI (Fase 20) que exibem RDO/breakdown; nada no núcleo 15/16/17

---

## 1. Contexto

A Fase 14 entregou o port fiel do pipeline de relatórios do TaskJuggler 3.8.4
(dispatch de conteúdos, `ReportTable`/`TableReport`, HTML/CSV/iCal/Niku/Trace/
TagFile/MspXml/TJP-export, Navigator, RTF completo, golden estrutural). Porém,
o SyntaxMesh criou **elementos que não existem no TJ Ruby** e que ainda não
chegaram aos relatórios:

- **Materiais e contabilidade estendida** (Fases 8.1/8.2): `Material`,
  `MaterialAllocation`, `ExtendedCharge`, `turnoverByType`, journal/note em
  material/account (10-C). Hoje **nenhum relatório lista materiais**
  (`msp-xml-re.ts` e `tjp-export-re.ts` não conhecem `Material`; os tipos
  `breakdownreport`/`rdoreport` nem passam do dispatch — `KNOWN_TYPE_SPECS` em
  `model/report.ts` não os inclui e `generate()` não tem formato `json`).
- **`picture` + RDO** (10-C #5): parser e modelo (`JournalEntry.pictures`,
  `format: 'markdown'|'richtext'`) existem, mas não há engine de relatório
  fotográfico nem galeria nos journal-columns.
- **MspXml pobre vs. MSPDI real**: `docs/tj3-engine/mspdi.md` mapeia o formato
  (recursos material `Type=2`/custo `Type=0`, `MaterialLabel`, `DurationFormat`
  7/8, `ActualWork`/`Remaining*`, `Baseline`, `Exceptions` de calendário);
  nosso `MspXmlRE` exporta só o esqueleto trabalho-humano do TJ.
- **Markdown nos relatórios** (Fase 13): a fábrica `MarkdownFactory` unifica a
  AST com RichText e `functions.ts` já reconhece `[[query:]]/[[report:]]/
  [[reportlink:]]/[[navigator:]]` como placeholders, mas os relatórios ainda
  só aceitam markup RichText (mediwiki) em header/footer/prolog/epilog e não
  há roteamento por `format`.

Além disso, os **adendos 14.25 e 14.26** criados dentro de
`fase-14-relatorios-tarefas.md` (BreakdownReport/RdoReport/colunas novas +
hide/rollup de material/picture) pertencem a este complemento e são **absorvidos
aqui** (as seções originais viram ponteiro).

## 2. Objetivo

Integrar os elementos materiais do Syntaxmesh (material, picture, markdown,
contabilidade estendida) ao sistema de relatórios entregue na Fase 14, e
aprimorar a exportação MspXml até o subconjunto MSPDI descrito em
`docs/tj3-engine/mspdi.md` — tudo fiel ao pipeline existente (ADR 027:
saídas como string, DOM-free, sem disco).

## 3. Escopo — blocos

| Bloco | Conteúdo | Origem |
|---|---|---|
| **C0** | Fundação: `format json` de primeira classe, indexação do `Journal` (`entriesBy*`), `AlertLevelDefinitions` mínimo, render de `Picture`→HTML, registro dos novos `typeSpec` no dispatch | bring-forward das Fases 16/19 (justificado no §6) |
| **C1** | Materiais nos relatórios existentes + novo `materialreport` (`MaterialListRE`) + colunas `note`/`journal` em material/account + coluna `timebasis` canônica | pedido neste doc + 14.25.11–13 |
| **C2** | `BreakdownReport` (groupby account/task, html/csv/json) | 10-C #4 + 14.25.1–5 |
| **C3** | `RdoReport` (groupby date/task/…, `journalmode`, `journalattributes`, galeria com `maxpictures`) | 10-C #5 + 14.25.6–10 |
| **C4** | Aprimoramento MspXml → MSPDI: recursos material/custo, assignments ricos, `DurationFormat` 7/8, `Exceptions` de calendário, `Notes`, timephased de custo | pedido neste doc + `mspdi.md` |
| **C5** | Markdown nos relatórios: `format markdown` em header/footer/prolog/epilog/caption, handlers RTF dentro de Markdown, imagens em `details`, RTFReport/URLParameter sob Markdown | pedido neste doc + 13.14.4 (roteamento adiado) |
| **C6** | `hidematerial`/`rollupmaterial`/`hidepicture` (parser+i18n+aplicação) + auditoria da aplicação de hide/rollup já existentes | 11-C F14 + 14.26 |
| **C7** | Golden/fixture tests das extensões, regressão do núcleo 14, smoke, verificação final e docs | padrão da casa |

> **C4 ✅ 2026-11-01.** Oracle Ruby real (`scripts/golden/mspdi-tj3.rb` →
> `mspdi.golden.json`, paridade campo a campo no subconjunto que o tj3 exporta)
> + extensões SyntaxMesh (material/custo/`effortdone`/`vacation`/lag) validadas
> por estrutura e snapshot. **Correção:** `docs/tj3-engine/mspdi.md` §3.1
> invertia `<Resource><Type>`; a ordem oficial é 0 = material, 1 = trabalho,
> 2 = custo. **Limitações registradas:** sem `<Baseline>`/`<ExtendedAttribute>`
> (o modelo não tem os dados), `Project` não possui store `leaves` (exceções de
> calendário vêm dos recursos) e `hideMaterial` — ativado na C6 (o filtro de
> 14C.4.10 delegava a `hiddenBy` desde então, mas o atributo só existe agora).

## 4. Fora de escopo

- **Fase 15/16 (Gantt)**: coluna `chart` continua NYI ancorada; nada de
  GanttChart/GanttLine aqui.
- **Time/status sheets** (`timetsheetreport`, `statussheetreport`,
  `htmlstatusreport`): dono é a **Fase 18**. Este doc apenas registra o
  veredito de materiais para elas (statussheet deve listar materiais no futuro —
  anotar como requisito na Fase 18).
- **`xmlreport` (`.tjx`)**: não existe no TJ 3.8.4 vendorizado; se a auditoria
  C1 confirmar ausência, fica como extensão futura documentada (não portar).
- **Escrita a disco / OPFS real / `URL.createObjectURL`**: Fase 19/20. Aqui,
  imagens relativas produzem **descritor** via `resolveImageRef` (13.14) ou
  `ImageStore` injetável; o core continua DOM-free (ADR 001).
- **Calendários por recurso no Mspdi (`CalendarUID` completo) e `Baseline`**:
  só entram se a auditoria C4 mostrar dados suficientes no modelo; caso
  contrário, documentar limitação (Baseline exige tracking de linhas de base,
  inexistente até no TJ).
- **UI (visualização de RDO)**: Fase 20.

## 5. Integração com o código existente

- **Dispatch**: `packages/core/src/model/report.ts` (`KNOWN_TYPE_SPECS`,
  `contentFactories`) — adicionar `materialreport`, `breakdownreport`,
  `rdoreport` (hoje caem em `"Unknown report type"`).
- **Formatos**: switch de `Report.generate()` — adicionar `json`; `output`
  permanece string/Array (CSV) conforme ADR 027.
- **Novas classes** (kebab-case, padrão `reports/`):
  `reports/material-list-re.ts`, `reports/breakdown-report.ts`,
  `reports/rdo-report.ts` — todas `extends ReportBase`, registradas via
  `registerContentFactory` (efeito colateral em `reports/mod.ts`).
- **Parser**: `picture`/`format`/`breakdownreport`/`rdoreport` já reconhecidos
  (10-C C3.5–C3.7 em `parser/rules/report.ts`/`journal.ts`); faltam
  `materialreport` (C1) e `hidematerial`/`rollupmaterial`/`hidepicture` (C6)
  com i18n en/pt-BR/es.
- **Modelo que já dá suporte**: `Material`/`MaterialAllocation`/
  `MaterialScenario(effortdone/effortleft)`, `AccountScenario.turnoverByType`,
  `JournalEntry.pictures/.format`, `Picture`, `Query` (Fase 11) para os
  filtros `hide*`.
- **Markdown**: `markdown/mod.ts` (`MarkdownFactory`, `richTextToMarkdown`,
  `extensions/functions.ts`) + `richtext/handlers/*` (RTF completos desde
  14.24.6).
- **Golden**: `reports.golden.json` (Fase 14) não muda para casos existentes
  (regressão obrigatória); extensões ganham goldens **próprios baseados em
  fixtures** (sem oracle tj3 — o TJ não tem esses relatórios), exceto MspXml,
  que tem oracle Ruby parcial (`MspXmlRE.rb` + `mspdi-mwe.rb` novo).

## 6. Dependências de outras fases e bring-forward justificado

| Dependência | Dona | Decisão neste complemento |
|---|---|---|
| `Journal.entriesByTask/Resource/Material/Account` | Fase 16 (adendo 16.21) | **Bring-forward (C0)**: índice simples sobre `Journal.entries` já filtrável por `property instanceof`; a Fase 16 herda e estende (remove/destroy hooks). Custo baixo, pré-requisito duro de RDO/breakdown. |
| `AlertLevelDefinitions` (cores/nomes de `alerts_*`) | Fase 16 | **Bring-forward mínimo (C0)**: default palette do TJ (red/green/blue/orange/yellow/violet) fixada como hoje o parser já valida; configuração `alerts` fica na 16 (âncora). |
| `hasalert` / Journal-flag lógico | Fase 16 | Permanece stub ancorado; `journalmode alerts_*` filtra por `alertLevel` numérico disponível. |
| Resolução de imagem relativa (OPFS/`objectURL`) | Fase 19 | **Não trazer**: usar `resolveImageRef`/`ImageStore` (contrato 13.14) produzindo descritor/URL; HTML do RDO referencia `src` resolvido pelo host. |
| Gantt/`chart` | Fases 15/16 | **Não tocar** (nota #19 da Fase 14). |

## 7. Estratégia de teste

1. **Regressão do núcleo 14** (obrigatória em cada bloco): `deno task test`,
   `reports.golden.json` byte-idêntico, `parser.golden.json`,
   `deno task check:stubs`.
2. **Extensões sem oracle Ruby** (`materialreport`, breakdown, RDO, `format
   json`, markdown em reports): testes unitários BDD + **fixtures TS-snapshot**
   (`packages/core/tests/golden/reports-extensions.golden.json`, gerado por
   script local determinístico, não por Ruby) e validação estrutural
   (ex.: JSON parseável, HTML contém galeria com `maxpictures` respeitado).
3. **MspXml**: oracle Ruby real para o subconjunto que o TJ já exporta
   (`scripts/golden/mspdi-tj3.rb` extraindo XML do `tj3` sobre mwe005) +
   asserts novos para material/custo/duration-format baseados em regras do
   `mspdi.md` (UID≠ID, `PTnHnMnS`, `DurationFormat` 7/8).
4. **i18n**: AST equivalente en/pt-BR/es para `materialreport` e
   `hidematerial`/`rollupmaterial`/`hidepicture` (padrão 10-C).
5. **Smoke**: `tests/integration/smoke_after_phase_14c_test.ts`
   (gera breakdown+RDO+materialreport a partir de um `.tjp` de exemplo com
   materiais/pictures, todos como string, sem tocar disco).

## 8. Riscos

| Risco | Mitigação |
|---|---|
| Breakdown/RDO dependem de `query_*` concretos ainda pendentes (Fase 11 gap) para colunas calculadas | usar APIs diretas do modelo (`turnoverByType`, `MaterialAllocation`, `ChargeSet`) em vez de `Query` para agregações; `Query` só nos filtros `hide*` (funcionam hoje) |
| `format markdown` colide com compatibilidade TJ (`.tjp` existentes usam mediwiki) | default continua `richtext` nos **reports** (journalentry mantém default `markdown` de 10-C); opt-in explícito |
| MspXml "mais completo" virar invenção sem validação | limitar ao subconjunto documentado em `mspdi.md` + teste de estrutura; nada de campos especulativos |
| Duplicação com adendos 14.25/14.26 já escritos na Fase 14 | seções originais viram ponteiro; IDs 14.25.x/14.26.x mapeados nos cabeçalhos dos blocos C2/C3/C6 |

## 9. Critério de aceite global

- `deno task check:all` exit 0 · `deno task test` verde · `deno task
  golden:generate` reproduzível (núcleo 14 inalterado) ·
  `deno task check:stubs` OK (todo stub novo ancorado) ·
  blocos C0–C7 com tabelas de tarefas marcadas em
  `fase-14-relatorios-complemento-tarefas.md` ·
  CURRENT.md/plano.md/AGENTS.md atualizados ao concluir.

## 10. Adendo para incluir no plano e tarefas

> **Execução:** este adendo virou os blocos **C8–C12** (§11). Os vereditos
> originais ficam abaixo como registro do pedido; o que foi entregue, o que
> foi transferido para outra fase e o que ficou rastreado está na tabela de
> rastreabilidade §11.7.

### Formato Markdown 

Durante a execução da fase 14 complementar verificamos a necessidade de incluir o formato de saida markdown aos variados reports que o syntaxmesh tem atualmente. são reports que teriam um arquivo de extensão ".md" 

Então teremos um novo formats que poderá ser escolhido : "markdown".

O formato markdown suporta textos, tabelas, links, imagens, algumas formatações, então ele poderá atender a muitos elementos igual temos no formato html, csv, text...

O prefixo "md" poderá ser usado também, por exemplo:
* mdtaskreport
* mdresourcereport
* mdaccountreport
* mdmaterialreport 

O markdown tambem aceita o uso de html, elementos mais complexos como gráficos poderiam usar de elementos html para renderizar, mas prefirimos que antes seja viabilizado o uso de markdown puro.

> **Veredito da 14C.7.6:** a Fase 14 Complemento entregou o **dialeto** markdown
> no conteúdo dos relatórios (C5: `format markdown` em header/footer/prolog/
> epilog/caption/`note`/`celltext` + handlers RTF), mas **não** a saída markdown
> como formato de arquivo (`formats markdown` → `.md`, tabelas em pipes) nem os
> prefixos `md*report`. Esse item do pedido fica como pendência herdada para um
> adendo futuro (14C-MD-output), registrado em `CURRENT.md`.

### Resolver pendencias anteriores

resolveAccount regra 4,	project_default no-op (sem Project.defaultAccount),	Documentado em ADR 031 §5 marcado para resolver na Fase 14.
vamos usar a key word "defaultaccount <id>" (default universal). mas podemos ter as variantes (que teriam precedencia ao default universal):
* defaultaccount material <id>
* defaultaccount resource <id>
* defaultaccount charge <id>

to_rti × 4,	Wiring por atributo depende de query.listItem/ReportContext (Fase 14), estavam	Re-ancorados para 14.

MSPDI limitado,	<Baseline> poderia ser um cenario que é definido dentro do bloco de definição do report: "baseline <scenario_id>" . Assim os dados do cenário (datas de niicio e fim e valores) são os que serão exportados como baseline para o MSPDI report

Gap técnico real no núcleo é o G1.4 (placement de datas em modelo construído à mão, sem parser) — o caminho parser → schedule funciona nos 9 MWEs. G1.4, Project.schedule() não coloca datas em modelo construído à mão (parser e2e funciona nos 9 MWEs). Esta resolvido Parcial? Temos 4 bugs corrigidos (PropertyList items, doneEffort, propagateDate, Xref). Tem mais algum bug para ser resolvido ? ver fase-7-scheduler-core-tarefas.md Adendo 2026-10-27 e planejar resolução de bugs ainda não tratados. 

### Adendo ao Unit Price de material

O material tem um valor de custo definido como unitprice dentro de seu bloco de definição.

```tjp
material "Steel" {
  unit "kg"
  unitPrice 25.0
}
```

Teremos a opção de modificar o unit price no material da tarefa (valido para apenas aquela atribuição) logo após a definição de sua quantidade. se unit price omitido na atribuição da tarefa usa o unit price definido no material.
```tjp
task "Foundation" {
  material "Steel" 500 onstart unitprice 26.0
  material "Concrete" 300 distributed unitprice 600.0
  material "Paint" 20 perweek unitprice 55.0
  material "Sand" 100 distribution { 0.3, 0.5, 0.2 }  unitprice 106.0
}
```

Teremos a opção TAMBÉM de indicar o unit price real do material no booking (valido para apenas aquele booking) logo após a definição de sua quantidade. se unit price omitido no booking usa-se o unitprice definido na alocação de tarefa e na falta deste, o unit price definido no material.
```tjp
material "Steel" {
  unit "kg"
  unitPrice 25.0
  booking "Foundation" quantity 500 unitprice 26.5 on 2026-11-01
}

task "Foundation" {
  material "Steel" 500 onstart unitprice 26.0
  material "Concrete" 300 distributed unitprice 600.0
  material "Paint" 20 perweek unitprice 55.0
  material "Sand" 100 distribution { 0.3, 0.5, 0.2 }  unitprice 106.0

  booking material "Steel" quantity 550 unitprice 27.0 on 2026-11-03
}
```

Podendo tambem ser modificado no timesheet
```tjp
timesheet "Engineer" 2026-11-01 - 2026-11-07 {
  material "Steel" {
    work 90%          # 90% da quantidade planejada consumida
    remaining 10%     # 10% restante
    unitprice 25.5
  }
}
```

Retirar a definição de totalquantity do bloco de definições de material. totalquantity pode ser uma informação de relatório apenas se for possivel somar das alocações (Σ MaterialAllocation.quantity).

---

## 11. Adendo §10 — execução (blocos C8–C12)

O adendo §10 foi transformado em cinco blocos com a mesma disciplina dos
blocos anteriores: ADR 027 (saída string, zero disco/DOM), parser + i18n
en/pt-BR/es, testes BDD, evidência por tarefa e regressão de golden.

| Bloco | Conteúdo | Origem |
|---|---|---|
| **C8** | Saída markdown: `formats markdown` → `.md` + prefixos `md<X>report` (`mdtaskreport`, `mdresourcereport`, `mdaccountreport`, `mdmaterialreport`) + geradores puros (pipes GFM, links, imagens) em todos os conteúdos que já produzem tabela | §10 “Formato Markdown” + veredito 14C.7.6 |
| **C9** | `defaultaccount <id>` universal + variantes `defaultaccount material|resource|charge <id>` (variante tem precedência) resolvendo `resolveAccount` regra 4 (`project_default`); fechar os `to_rti` × 4 que estavam re-ancorados | §10 “Resolver pendências anteriores” |
| **C10** | MSPDI `<Baseline>`: atributo `baseline <scenario_id>` no bloco do report de exportação; o cenário indicado fornece início/fim/custos da linha de base | §10 “MSPDI limitado” |
| **C11** | Unit price por alocação (`material "X" 500 onstart unitprice 26.0`), por booking (`booking material "X" quantity 550 unitprice 27.0 on …`) e remoção de `totalquantity` do bloco de material (quantidade passa a ser derivada de Σ `MaterialAllocation.quantity`) | §10 “Adendo ao Unit Price de material” |
| **C12** | Auditoria G1.4 do scheduler (Fase 7 — adendo 2026-10-27): inventário dos bugs já corrigidos, probe ao vivo do modelo construído à mão, decisão sobre os bugs remanescentes | §10 “Gap técnico real no núcleo é o G1.4” |

### 11.1 C8 — Saída Markdown (✅ 2026-11-01)

- `reports/markdown.ts` concentra a renderização **pura** (sem HTML de
  relatório): `markdownCell` (escapa `\`, `|`, converte quebra de linha em
  `<br>`), `markdownText` (aceita `RichTextIntermediate#to_markdown`),
  `markdownTable` (GFM com alinhamento numérico `---:`), `markdownSections`,
  `markdownHeading`, `markdownImage`.
- `ReportTable#to_markdown`, `ReportBase#rt_to_markdown` e `to_markdown()` em
  `TableReport` (task/resource/account/material), `BreakdownReport`,
  `TextReport` e `RdoReport` (blocos, galeria e as três tabelas de recursos/
  materiais/charges).
- `Report.generate()` ganha `case "markdown"` + `generateMarkdown()` (título
  `# <projeto> - <título|nome>`, `.md` em `outputFileName`, corpo em `output`).
- Parser: regras `taskReportKeyword`/`resourceReportKeyword`/
  `materialReportKeyword`/`accountReportKeyword` devolvem boolean
  (`_<tipo>report` → false, `_md<tipo>report` → true) e a regra de header usa
  `markdownReportDefaults()` para **presetar** `formats ["markdown"]` só
  quando o corpo não declarar `formats` (independência de ordem preservada).
- Correções de port encontradas no caminho: `TableReport.defaultColumnTitle`
  devolve `null` para coluna desconhecida (Ruby) e `Project#attributeName`
  consulta `tasks` → `resources` (não o dicionário de projeto).

### 11.2 C9 — `defaultaccount` + `to_rti` × 4 (✅ 2026-11-01)

Gramática (extensão SyntaxMesh; não existe no TJ 3.8.4):

```tjp
project p "P" 2026-01-01 - 2026-12-31 {
  defaultaccount cost              # universal (regra 4 para qualquer tipo)
  defaultaccount material m.acc    # variante por tipo (precede a universal)
  defaultaccount resource r.acc
  defaultaccount charge   t.acc    # `charge` = CostType `task`
}
```

- `Project.defaultAccountId` (universal) + `Project.defaultAccountIds:
  Map<CostType, string>` (variantes) e `Project#defaultAccountFor(type)`
  (variante do tipo → universal → `null`). O parser guarda o **ID**, não a
  conta: o bloco `project` precede as declarações de `account`, então a
  resolução é sob demanda em `Project#account(id)` (referência futura). Conta
  inexistente resolve para `null` sem falhar o parse.
- `CostLine.project` (opcional) alimenta `resolveAccount` regra 4: com conta
  default resolvida, `account` passa a ser a conta e `projectDefault` carrega
  essa conta; sem `defaultaccount`, o comportamento anterior
  (`account: null`) é preservado. `resource-scenario.ts` passa `project:` ao
  emitir `resource_effort`.
- i18n `defaultaccount` (pt-BR `contapadrao`, es `cuentapredeterminada`);
  `material`/`resource`/`charge` já são canônicos.
- **`to_rti` × 4**: `ReferenceAttribute#to_rti` (URL+label → `[url label]`)
  e `ListAttributeBase#to_rti` (lista com `query.listItem` → `<nowiki>` por
  item + `query.assignList`) deixam de lançar `NotYetImplementedError`;
  `AttributeBase#to_rti` já estava implementado (RichText) e o
  `Journal#to_rti` já existe desde a 14C.0 (modos de journal). Fechamento
  adicional: `Query#assignList` gera o RTI do texto montado (Ruby
  `Query.rb:234`) — antes gravava `null` com um TODO da Fase 12.
- Testes: `tests/model/default-account_14c_test.ts` (4),
  `tests/accounting/attribution_default-account_14c_test.ts` (5),
  `tests/parser/rules_defaultaccount_14c_test.ts` (7),
  `tests/attributes/to-rti_14c_test.ts` (5).

### 11.3 C10 — MSPDI `<Baseline>` (✅ 2026-11-01)

- Atributo de report `baseline` (`IntegerAttribute`, default `null`, **não**
  cenário-específico) que guarda o **índice** do cenário; aceito no corpo de
  `export` como `baseline <scenario_id>` (reusa `!scenarioId`, logo o índice já
  sai resolvido e um ID desconhecido vira `unknown_scenario_id` sem gravar o
  atributo). Cenário inativo emite o aviso `baseline_sc_disabled` e mantém o
  índice — quem decide omitir o `<Baseline>` é o exportador.
- `MspXmlRE` emite `<Baseline>` do **projeto** (Number 0, antes de `<Tasks>`)
  com o menor `Start` e o maior `Finish` das tarefas agendadas no cenário e
  `<Cost>` = Σ `CostEvent` do cenário; e um `<Baseline>` por tarefa (Start/
  Finish do cenário + `Cost` dos eventos daquela tarefa). Nunca inventa dados:
  sem datas no cenário a tarefa é pulada, e se **nenhuma** tarefa tiver datas
  o `<Baseline>` do projeto é omitido com o aviso `baseline_not_scheduled`.
- Sem o atributo o documento fica idêntico ao atual (golden oracle intocado).
- Testes: `tests/reports/baseline_14c_test.ts` (13 steps), fixtures
  `tests/fixtures/ext/14c-baseline.tjp` (cenário `base` agendado) e
  `14c-baseline-gap.tjp` (cenário `base` inativo), snapshot em
  `reports-extensions.golden.json` (`baseline`).
- `<ExtendedAttribute>` e granularidade de tempo do baseline continuam fora
  de escopo.

### 11.4 C11 — Unit price por alocação e booking; `totalquantity` removido (✅ 2026-11-01)

Precedência do preço unitário efetivo (do mais específico ao mais geral):

1. `MaterialBooking.unitPrice` (valor real do booking);
2. `MaterialAllocation.unitPrice` (valor daquela atribuição de tarefa);
3. preço do material (`unitprice` do bloco / campo `unitPrice`).

- `MaterialAllocation` ganha `unitPrice?: number` (construtor + `unitPriceFor`),
  sintaxe `material "X" <qtd> [modificador] [unitprice <n>]`.
- Novo `MaterialBooking` (`material`, `quantity`, `unitPrice`, `date`,
  `task`) com o atributo de cenário `materialbookings` da tarefa; gramática
  `booking material "X" quantity <q> [unitprice <p>] on <data>` aceita no
  corpo da tarefa **e** no corpo do material (com `task <id>` para amarrar a
  tarefa). O booking alimenta o custo **realizado** do material; o custo
  planejado continua vindo das alocações.
- `totalquantity` sai do bloco de material (gramática, definição de atributo,
  export TJP e leitura de relatório). A quantidade de um material passa a
  ser **derivada**: Σ `MaterialAllocation.quantity` (coluna `allocations`
  lista as alocações; quando não há alocação, 0).
- Timesheet: a sintaxe proposta no §10 (`material "X" { work/remaining/
  unitprice }`) é registrada como requisito da **Fase 18** (dona do bloco de
  timesheet) — o parser de timesheet ainda não tem entrada de material.

#### Detalhes de implementação (2026-11-01)

- **Referência futura no booking.** `booking "<task>" …` no corpo do material
  pode preceder a declaração da tarefa. Em vez de resolver no ponto do parse,
  o parser enfileira em `Project.pendingBookings` (`scenarioIdx` incluído) e o
  fim da regra `project` chama `Project#flushPendingBookings()`, que resolve a
  tarefa e escreve `materialbookings` no cenário certo; bookings que continuam
  sem tarefa permanecem na fila (e o erro já foi reportado no parse).
- **Quantidade derivada no modelo, não no relatório.**
  `Material#allocations(scIdx)`/`#allocatedQuantity`/`#allocatedCost`
  concentram a regra (Σ de `MaterialAllocation.quantity` e
  `quantity × unitPriceFor(this)`), de modo que `materialreport`,
  `breakdownreport` (contribuintes de conta) e `aggregate materials` do
  `AccountScenario` compartilham a mesma semântica. `materialreport` mantém
  `totalquantity` apenas como **coluna calculada** (`materialNumericColumns`),
  não como atributo consultável.
- **Precedência aplicada nos relatórios.** `booking → alocação → material` é
  resolvida por `MaterialAllocation#unitPriceFor` e pelo par
  `taskMaterialAllocations`/`taskMaterialBookings` do `TableReport`:
  `scheduledcost` = `CostEvent` planejado ou, na falta, Σ alocações;
  `actualcost` = `CostEvent` realizado ou Σ bookings; `totalcost` = ambos.
- **`totalquantity` fica reservado.** A palavra continua em
  `CANONICAL_KEYWORDS` (pt-BR `quantidadetotal`, es `cantidadtotal`) **apenas**
  para que a regra dedicada emita `totalquantity_removed` em vez de
  `unexpctd_token` — qualquer outro uso segue rejeitado.
- **Export TJP.** Alocações emitem `unitprice <n>` quando definido e os
  bookings viram `booking material <id> quantity <q> [unitprice <p>] on <data>`
  só sob `taskattributes materialbookings`; nada disso muda a saída de quem não
  usa material.

### 11.5 C12 — Auditoria G1.4 do scheduler (✅ 2026-11-01)

- Inventário dos quatro bugs já corrigidos (PropertyList items, `doneEffort`,
  `propagateDate`, Xref) e probe ao vivo com modelo construído à mão.
- Cada bug remanescente encontrado vira tarefa corretiva **aqui** se for de
  reports/custos; caso contrário é registrado no adendo da Fase 7 com
  evidência (probe + arquivo/linha) para não reabrir a fase.
- **Resultado (2026-11-01):** o probe confirma o placement (start/end/effort
  concluído) em modelo construído à mão; a varredura encontrou **um** bug
  remanescente — `propagateDateToDep()` comparava `toSeconds()` de `null`
  quando a tarefa não tinha a data daquele lado. O guard de nulidade destravou
  `docs/taskjuggler/test/TestSuite/CSV-Reports/alert.tjp`, que estava na lista
  `PENDING_SCHEDULER_FILES` do golden de relatórios: essa lista ficou **vazia**
  e o arquivo passou a ser comparado contra o oracle do `tj3` (112 passos
  verdes). A divergência de `finishScheduling` (que no port marca a tarefa como
  agendada e calcula completion/status/gauge, enquanto o Ruby recursa em
  filhos e consolida `assignedresources` nos pais) foi **registrada** no adendo
  da Fase 7, sem reescrita do scheduler.

### 11.6 Critério de aceite do adendo

- `deno task check:all` exit 0 · suíte verde · `deno task check:stubs` OK.
- `reports.golden.json`, `parser.golden.json` e `mspdi.golden.json`
  byte-idênticos (o adendo só acrescenta comportamento opt-in);
  `reports-extensions.golden.json` idempotente 2×.
- Tabelas de evidência 14C.8–14C.12 preenchidas em
  `fase-14-relatorios-complemento-tarefas.md` e rastreabilidade §11.7.
- `CURRENT.md`, `plano.md` e `AGENTS.md` atualizados.

**Resultado (2026-11-01):** ✅ os quatro critérios cumpridos.

- `deno task check:all` exit 0 (check + lint + fmt + test); `check:stubs` OK.
- Os três goldens do núcleo seguem byte-idênticos ao HEAD;
  `reports-extensions.golden.json` e `attribute-definitions.golden.json` foram
  **regenerados de propósito** (material com quantidade/custo derivados das
  alocações, bloco `baseline` e o atributo `materialbookings` — 167 → 173
  casos), com a geração repetida 2× para provar idempotência.
- As tabelas de evidência 14C.8–14C.12 estão preenchidas no arquivo de tarefas
  (incluindo as 11 steps novas de `MaterialBooking`/booking no parser e as
  3 do custo por booking nos relatórios).
- `CURRENT.md` (linha da Fase 14-C + fechamento do `PENDING_SCHEDULER_FILES`),
  `plano.md` (linha 14-C) e `AGENTS.md` (tabela das 21 fases) atualizados.

> **Nota:** `alert.tjp` deixou de ser exceção — com o guard da 14C.12.3 ele
> agenda e é comparado contra o oracle Ruby, então a única pendência de
> scheduler que restou é a divergência **documentada** de `finishScheduling`.

### 11.7 Rastreabilidade do adendo §10

| Item do §10 | Bloco | Entrega |
|---|---|---|
| `formats markdown` gerando `.md` | C8 | `Report#generateMarkdown` + `outputFileName` `.md` |
| prefixos `md*report` | C8 | `mdtaskreport`/`mdresourcereport`/`mdmaterialreport`/`mdaccountreport` (aliases com `formats` presetado) |
| markdown puro antes de HTML | C8 | `reports/markdown.ts` (pipes, links, imagens, sem `<table>`/`<div>`) |
| `defaultaccount <id>` + variantes | C9 | `Project.defaultAccount(s)` + regra 4 de `resolveAccount` |
| `to_rti` × 4 | C9 | `ReferenceAttribute`/`ListAttributeBase` implementados; base e Journal documentados |
| MSPDI `<Baseline>` via `baseline <scenario>` | C10 | atributo `baseline` + `<Baseline>` de projeto/tarefa |
| `unitprice` na alocação de tarefa | C11 | `MaterialAllocation.unitPrice` + gramática |
| `unitprice` no booking | C11 | `MaterialBooking` + gramática nas duas formas |
| `unitprice` no timesheet | C11 → Fase 18 | requisito registrado como **18.17.9** (record de material com `unitprice` → `MaterialBooking`) + **18.17.10** (parser/sender do sheet) |
| remover `totalquantity` | C11 | gramática/atributo/export removidos; quantidade derivada das alocações |
| G1.4 — bugs remanescentes | C12 | inventário + probe + registro na Fase 7 |

## 12. Adendo Extra

### Material em estoque e saida de estoque

Permitir dentro de material o booking sem task podendo ser com quantidade positiva e negativo, somente neste caso. Quando tem alocação de tarefa, somente positivo.

```tjp

account "Costs" {
  account "Materials" {
    aggregate materials
  }
}

material "Steel" {
  unit "kg"
  unitPrice 25.0
  booking "Foundation" quantity 500 unitprice 26.5 on 2026-11-01 // somente positivo

  chargeset "Costs.Materials"

  booking quantity 100 unitprice 26.5 on 2026-11-01 // sem alocação de tarefa
  booking quantity -100 unitprice 26.5 on 2026-11-02 // negativo e sem alocação de tarefa

  booking "Foundation 2" quantity 100 unitprice 26.5 on 2026-11-02
}
```

Assim, temos a opção de registrar o material que ainda não foi alocado (por exemplo ficou em estoque) mas depois saiu do estoque e foi usado e alocado adequadamente.

Nesta situação de booking em material sem task , é obrigatório que se tenha informado o chargeset padrão daquele material, para o syntaxmesh usar esta conta para incluir o custo do material sem tarefa ou estornar este custo (quantidade negativa)

### Unit Price Calculado

Podemos ter o unit price calculado a partir de componentes informados no material, veja exemplo:

```tjp
material "Cement" {
  unit "kg"
  unitPrice 0.450
}

material "Sand" {
  unit "m³"
  unitPrice 35.0
}

material "Gravel" {
  unit "m³"
  unitPrice 30.0
}

material "Admixtures" {
  unit "vb"
  unitPrice 5.0
}

material "Concrete" {
  unit "m³"
  material "Cement" 420 // 420 kg/m³
  material "Sand" 0.45 // 0.45 m³/m³
  material "Gravel" 0.84 // 0.84 m³/m³
  material "Admixtures" 1 // 1 vb/m³
  // unitPrice - não permitido ele será calculado
  chargeset "Costs.Materials.Concrete"
}
```

O unitprice será calculado , resultando em : 234,95
* Cement: 420 kg × 0,450 = 189,00
* Sand: 0,45 m³ × 35,00 = 15,75
* Gravel: 0,84 m³ × 30,00 = 25,20
* Admixtures: 1 vb × 5,00 = 5,00

Unitprice = Custo Total (1 m³): 189+15,75+25,20+5 = 234,95

### keyword quantity e value

A palavra quantity ou value não são necessárias em booking dentro de tarefas, exemplos:
* booking effort "Engineer" 2026-02-01 - 2026-02-10 { sloppy 2 }
* booking charge "Software" 48000 on 2026-02-15 // does not need keyword value - é um booking charge
* booking material "Steel" 2100 on 2026-02-05 // does not need keyword quantity - é um booking material

nem se o booking for no bloco de origem:
```tjp
# Booking de effort no bloco do resource
resource "Engineer" {
  booking "Foundation" 2026-02-01 - 2026-02-10 { sloppy 2 } // sem keyword effort
}

# Booking de charge no bloco do resource
resource "Engineer 2" {
  booking charge "Foundation" 48000 on 2026-02-15 // sem keyword value
}

# Booking de material no bloco do material
material "Steel" {
  booking "Foundation" 2100 on 2026-02-05 // sem keyword quantity e sem keyword material
}

# Booking de charge no bloco do material
material "Steel 2" {
  booking charge "Foundation" 48000 on 2026-02-15 // sem keyword value
}
```

Permitir o uso de "booking charge" dentro da definição de material, assim como é permitido dentro de resource.

> **Revisão 2026-11-02 (exemplo da linha 560):** `booking charge` no corpo da
> tarefa **não leva referência de recurso** — o `"Software"` do exemplo não é
> recurso nem conta; a forma canônica da tarefa é
> `booking charge ["<descrição>"] [value] <montante> on <data>`, e o `<montante>`
> sozinho já basta (o dono do gasto é a própria tarefa). Especificado em §13.3.


### Observação importante - confirmação sobre turnover

no desenvolvimento de unitprice podendo ser alterado na alocação do tarefa , ou no booking, precisamos garantir que o calculo do custo dentro do account (turnover da conta) utiliza estes novos unitprice adequadamente. na seguinte ordem:
* se tem unitprice em booking usa o unit price do booking;
* senão e existir o unitprice da tarefa usa o unitprice da alocação na tarefa
* se não tiver unitprice da tarefa usa o unitprice informado ou calculado no bloco de definição do material.


### comportamento de scenarios — Diferenças no tratamento de cenários: TaskJuggler × SyntaxMesh

#### TaskJuggler (comportamento oficial)

- **Só um cenário top-level.** O `plan` é o único cenário de primeiro nível; qualquer outro é derivado dele.
- **Cenários são aninhados:** `scenario plan { scenario real { } }`. O keyword `scenario` é aceito dentro de `project` **e** dentro de `scenario`.
- **Herança pelo aninhamento:** `real` herda todos os atributos de `plan` (tasks, resources, datas) exceto os que redefinir.
- **`fullId` reflete a hierarquia:** `plan.real`.
- **`projection` não é herança.** É um atributo que ativa o modo de projeção (bookings fixos até `now`).

#### SyntaxMesh (o que a documentação diz hoje)

- **`fase-9-orquestrador-cache.md` §9.6.1.8:** `scenarios` é `PropertySet` com **`flatNamespace = true`** — IDs curtos (`real`), sem hierarquia.
- **`fase-5-tarefas.md` §5.7.2:** `projection` é `inheritParent = true` — flag que só faz sentido se cenários tiverem parent.
- **`fase-10-tarefas.md` §10.12.4.1:** `rule_scenario` está no `projectBody`, sem indicação de recursão para dentro de `scenarioBody`.

#### Diferenças prováveis (a confirmar no código)

> **Corrigido em C17 (2026-11-02):** a tabela abaixo foi escrita antes da
> sondagem ao código; todas as suspeitas se resolveram a favor do port —
> **não há divergência**. A tabela correta (com evidência Ruby/arquivo/linha) é
> a de §13.5 abaixo. Os testes `scenario-nesting_14c_test.ts` confirmam por
> execução que o SyntaxMesh implementa o comportamento idêntico ao Ruby.

| Ponto | TaskJuggler | SyntaxMesh (conforme doc) → **código real** |
|---|---|---|
| Top-level | Só `plan` | ✅ `clearProperties` garante só o último top-level → igual |
| Aninhamento | Sim (`scenario plan { scenario real { } }`) | ✅ `scenarioAttributes` inclui `p.pattern(["!scenario"])` — recursivo |
| Herança | Pelo aninhamento | ✅ `inheritedFromParent = true` → resolve via parent chain |
| `fullId` de `real` | ~~`plan.real`~~ → **`real`** (`flatNamespace=true`, `PropertyTreeNode.rb:294-303`) | ✅ `real` (flat) — igual |
| `projection` | Atributo de modo **e** herda do pai cenarístico | ✅ `inheritedFromParent = true` → igual |

#### O que verificar no código do SyntaxMesh

1. `src/model/project.ts` — `new PropertySet(this, true)` ou `false`?
2. `src/parser/rules/scenario.ts` — `rule_scenarioBody` inclui `scenario` (recursivo)?
3. `src/model/scenario.ts` — `constructor(..., parent)` usa o `parent` ou força `null`?
4. `packages/core/tests/model/scenario_test.ts` — há teste com 2 níveis de cenário?

**Objetivo:** apenas registrar se o SyntaxMesh implementa o comportamento do TaskJuggler (nested, um top-level) ou diverge (flat, vários top-level). Não é para decidir correção — só para informar a diferença para decidirmos o que fazer . Preciso entender primeiro qual o real comportamento do taskjuggler

## 13. Adendo Extra (§12) — execução (blocos C13–C17)

O §12 virou cinco blocos. A disciplina é a mesma de C8–C12: parser + i18n
en/pt-BR/es, testes BDD, evidência por tarefa, goldens byte-idênticos quando o
syntax novo não aparece em fixture existente.

| Bloco | Conteúdo | Origem no §12 |
|---|---|---|
| **C13** | Booking de **estoque**: `booking [quantity] <n> [unitprice <p>] on <data>` sem referência de tarefa dentro do bloco de material, com quantidade **positiva ou negativa**; conta de destino = `chargeset` do material (obrigatório) | “Material em estoque e saida de estoque” |
| **C14** | **Unit price calculado** por composição: `material <id> <quantidade>` dentro do bloco de material declara componente; `unitprice` passa a ser derivado (Σ componente × preço do componente) e é **proibido** junto com componentes | “Unit Price Calculado” |
| **C15** | Palavras `effort`, `quantity` e `value` **opcionais** em booking (nas duas origens) + `booking charge` aceito também no bloco de material | “keyword quantity e value” |
| **C16** | **Turnover da conta** com a precedência de preço (booking → alocação → material, sendo o material explícito ou calculado) — auditoria com teste por rota | “Observação importante — confirmação sobre turnover” |
| **C17** | **Registro** do comportamento real de cenários (TaskJuggler × SyntaxMesh), sem decidir correção | “comportamento de scenarios” |

### 13.1 C13 — Booking de estoque

- **Dois papéis do mesmo verbo.** `booking` *com* tarefa = consumo realizado
  (C11, sempre positivo). `booking` *sem* tarefa = movimento de estoque:
  entrada (positiva) ou saída/estorno (negativa). A regra zero vale também
  aqui: nada de inventário implícito — se não há tarefa, o dinheiro tem de
  ter para onde ir.
- **Modelo**: `MaterialBooking.taskId: string | null` e `task: Task | null`.
  A validação do construtor passa a rejeitar quantidade negativa **somente
  quando há tarefa** (`MaterialBooking` em `model/material-booking.ts`).
- **Atributo novo**: `stockbookings` (lista, específico de cenário) no
  PropertySet de material — os bookings de estoque vivem no material, porque
  não há tarefa hospedeira.
- **Sinal negativo**: o lexer do port (fiel a `ProjectFileScanner.rb:95-98`)
  não produz número com sinal — `-` cai no literal de caractere único. Nova
  regra `signedNumber` (`!number` | `_- !number`) usada **só** pela gramática
  de estoque; o resto da gramática continua exatamente como o TJ.
- **Conta**: `AccountScenario#turnover` no ramo `aggregate materials` passa a
  somar, além de `Material#allocatedCost`, os bookings de estoque cuja data
  está em `[start, end)` e cuja conta resolvida (`resolveAccount`: regra 2 —
  chargeset do material — senão regra 4 — `defaultaccount material`) é esta
  conta ou descendente dela. Datas filtram (como `@credits` em
  `AccountScenario.rb:57-68`); emissão idempotente de `CostEvent`
  `material_usage` (modo `actual`) para alimentar `breakdownreport`/RDO.
- **Chargeset obrigatório**: se o material não tem `chargeset` **nem** existe
  `defaultaccount material`, o parser emite `stock_booking_without_chargeset`
  (erro, não aviso) — sem conta, o valor se perderia.
- **Fora de escopo de C13**: colunas novas em `materialreport`
  (`stockquantity`/`stockcost`) ficam registradas como pendência; a quantidade
  `totalquantity` do relatório continua sendo Σ alocações (14C.11.10), para
  não misturar planejado com estoque.

### 13.2 C14 — Unit price calculado por composição

- **Gramática**: `material <materialId> <quantidade>` no corpo do material.
  Choca com a declaração de **sub-material** aninhada (`p.pattern(["!material"])`
  em `materialAttributes`): as duas formas começam por `_material` e o FSM só
  admite uma transição por token por estado (`state.ts:139-157`). Decisão: a
  **declaração aninhada de material sai do corpo do material** — nenhum
  fixture, teste ou corpus usa a forma, `report-base.ts:200` já registra que
  materiais não têm raiz própria, e a árvore (`parent` do construtor, IDs
  hierárquicos porque `project.materials` é `flatNamespace = false`) continua
  intacta para uso por código. O espaço semântico de “material dentro de
  material” passa a significar composição.
- **Modelo**: `MaterialComponent { material, quantity }`
  (`model/material-component.ts`) + atributo de cenário `materialcomponents`.
- **Preço** (`Material#unitPriceValue()`): `cost` fornecido → componente →
  campo do construtor. Composição recursiva: o componente pode ter os seus
  próprios componentes.
- **Erros**: `unitprice_with_components` (nas duas ordens — componente depois
  de `unitprice` e `unitprice` depois de componente) e
  `material_composition_cycle` (DFS de alcance antes de anexar).
- **Propagação**: como alocações e bookings já leem o preço por
  `unitPriceFor`, o preço calculado aparece de graça em `materialreport`,
  `breakdownreport`, RDO, MSPDI e no turnover (C16 cobre com teste).

### 13.3 C15 — Keywords opcionais e `booking charge`

- `effort` passa a ser **opcional** nas duas origens (`booking effort "X" …` e
  `booking "X" …`); a forma curta é a canônica do TJ
  (`TjpSyntaxRules.rb:6001`, `:4771`) e a explícita é a da Fase 8.1.
  Desambiguação: `State#transition` prefere o literal ao `$ID` variável, então
  `_effort` antes de `!resourceId`/`!taskId` não cria conflito.
- `quantity` passa a ser opcional em booking de material (tarefa e material),
  `value` opcional em booking de charge (regra `bookingQuantity` /
  `bookingValueKeyword` com `p.optional()` — o sufixo `!rule?` não existe no
  FSM, lição da 14C.11).
- **`booking charge`** — implementado do zero nas três origens, armazenado no
  atributo de cenário `chargebookings` da **tarefa** (o dinheiro é da tarefa,
  quem declara é o outro lado), com a mesma fila de referência futura de
  `pendingBookings`. **Revisão 2026-11-02 (decisão do usuário):** no corpo da
  tarefa **não existe referência de recurso** — booking de charge não consome
  esforço, a outra ponta é a própria tarefa; recurso só é obrigatório no
  booking de effort (`TjpSyntaxRules.rb:6001`). Gramática final:

  ```tjp
  task t "T"     { booking charge ["<descrição>"] [value] <montante> on <data> }
  resource r "R" { booking charge <tarefa> ["<descrição>"] [value] <montante> on <data> }
  material m "M" { booking charge <tarefa> ["<descrição>"] [value] <montante> on <data> }
  ```

  A `description` (`$STRING`, regra `chargeBookingDescription` com
  `p.optional()`) é texto livre — o FSM encadeia os dois opcionais
  (`<descrição>` usa `$STRING`, `value` usa o literal `_value`: tokens
  disjuntos, sem ambiguidade; probe 26/26).
- Modelo `ChargeBooking` (`model/charge-booking.ts`) com montante **podendo
  ser negativo** (estorno) e `description: string | null` — coerente com
  `ExtendedBooking` (Fase 8.1), que é modelo órfão: nada no parser o usava;
  fica como está e não é tocado.
- **Fora de escopo**: carga contábil de `booking charge` (duplicaria com o
  atributo `charge` planejado) e o cálculo de *remaining* a partir de bookings
  (Fase 18 — tracking/timesheet). Registrado em 13.7.

### 13.4 C16 — Turnover com precedência de preço

Roteiro de auditoria (cada rota com teste próprio):

| Rota | Preço efetivo em jogo | Efeito esperado |
|---|---|---|
| `Material#allocatedCost` (agregado `materials`) | alocação → material (explícito ou calculado) | booking não tem alocação a relembrar; já usa `unitPriceFor` |
| Bookings de estoque (novos `CostEvent`) | booking → material | entrada soma, saída negativa estorna, ambos na conta do chargeset |
| `materialreport` `actualcost` | booking → alocação → material | entregue em 14C.11.7; revalidado aqui |
| Booking **com** tarefa no turnover | — | **não** entra: a mesma quantidade já está no planejado da alocação; incluir o booking duplicaria o custo. Decisão explícita, com teste-âncora |

### 13.5 C17 — Cenários: o que o TaskJuggler realmente faz

A tabela do §12 estava parcialmente errada (foi escrita a partir da
_documentação_ das fases, não do código). Verificado contra a fonte Ruby:

| Ponto | TaskJuggler (fonte) | SyntaxMesh (código) |
|---|---|---|
| Namespace | **flat**: `Project.rb:117` `PropertySet.new(self, true)` | `project.ts:259` `new PropertySet(this, true)` — igual |
| `fullId` de `real` aninhado em `plan` | `real` (`PropertyTreeNode.rb:294-303`: com flatNamespace devolve `@subId`) — **não** `plan.real` | idem — igual |
| Top-level único | `TjpSyntaxRules.rb:5184` `clearProperties` quando `@property.nil?` | `scenario.ts:184` `if (!this.property) project.scenarios.clearProperties()` — igual |
| Aninhamento | `rule_scenario` → `!scenarioHeader !scenarioBody` com `@property = @property.parent` (`:5091-5093`) | `scenario.ts:108-120` + `p.pattern(["!scenario"])` em `scenarioAttributes` (`:163`) — recursivo, igual |
| Herança | pelo aninhamento, via `inheritedFromParent` (`Project.rb:122-129`) | `scenario-attributes.ts` idem (`projection`/`active` com `inheritedFromParent = true`) — igual |
| `projection` | flag de modo **e** herda do pai cenarístico (`Project.rb:128-129`) | `scenario-attributes.ts:92-95` — igual |

**Conclusão registrada:** não há divergência de cenários entre SyntaxMesh e
TaskJuggler; as três suspeitas do §12 (flat vs nested, `plan.real`,
`projection` ligada a herança) se resolvem a favor do port. O bloco entrega
**testes de caracterização** (2 níveis, herança, `fullId`, `clearProperties`)
para que a afirmação fique verificável, e corrige a tabela do §12 — sem mudar
comportamento.

### 13.6 Critério de aceite do Adendo Extra

1. Os quatro exemplos do §12 (estoque ±, composição de concreto a 234,95,
   `booking` curto nas três origens, `booking charge` no material) parseiam
   sem erro e produzem os objetos de modelo esperados.
2. `deno task check:all`, `fmt:check`, `lint`, `check:stubs` e a suíte
   completa verdes; goldens inalterados (nenhum fixture novo em `golden/`).
3. Turnover da conta reflete preço de alocação, preço de material e preço
   calculado por composição, e o booking com tarefa não duplica custo.
4. §13.5 registrado com evidência Ruby/arquivo/linha e testes de
   caracterização de cenários de 2 níveis.
5. Status propagado: `plano.md`, `AGENTS.md`, `CURRENT.md`, tabela de
   evidências em `-tarefas.md`.

**Resultado (2026-11-02):** ✅ os cinco critérios cumpridos.

- Os quatro exemplos do §12 parseiam limpos — cobertos pelos testes de parser
  de C13/C14/C15 e pelos testes de modelo/turnover de C16.
- `deno task check:all` exit 0 · suíte core **482 testes / 4934 passos /
  0 falhas** (inclui a revisão 2026-11-02 de `booking charge`: descrição
  opcional nas três origens e remoção da referência de recurso no corpo da
  tarefa, com `rules_booking_charge_14c_test.ts` — 8 steps) · `check:stubs`
  OK · `deno fmt --check` limpo (589 arquivos) ·
  `deno lint` limpo nos arquivos novos.
- Goldens: `reports.golden.json`/`parser.golden.json`/`mspdi.golden.json`/
  `reports-extensions.golden.json` byte-idênticos ao HEAD; único regenerado de
  propósito foi `attribute-definitions.golden.json` (173 → 174 casos, o novo
  atributo `chargebookings` — evidência 14C.15.4).
- Turnover verificado por rota em `turnover-price-precedence_14c_test.ts`
  (11 passos), inclusive a âncora de que booking com tarefa não duplica custo.
- §13.5 registrado com evidência Ruby/arquivo/linha e travado por testes de
  caracterização em `scenario-nesting_14c_test.ts` (5 passos); tabela do §12
  corrigida (14C.17.4).
- `plano.md` (linha 14-C), `AGENTS.md` (tabela das 21 fases) e `CURRENT.md`
  atualizados; tabelas de evidência 14C.13–14C.17 preenchidas em
  `-tarefas.md`.

### 13.7 Rastreabilidade e pendências registradas

| Pedido do §12 | Tarefa |
|---|---|
| Booking sem tarefa ±, chargeset obrigatório | 14C.13.1–13.8 |
| Unit price calculado por composição | 14C.14.1–14C.14.7 |
| `quantity`/`value`/`effort` opcionais; `booking charge` no material | 14C.15.1–14C.15.8 |
| Turnover com precedência | 14C.16.1–14C.16.5 |
| Cenários (registro) | 14C.17.1–14C.17.4 |

**Pendências** (não implementadas aqui, com dono):

- Colunas `stockquantity`/`stockcost` no `materialreport` e nos demais
  conteúdos de material — deixa para a próxima rodada de relatórios de
  material (mesma família do 14C.1.19). **Entregue em 2026-11-02 — ver §14.**
- Carga contábil de `booking charge` e cálculo de *remaining* (planned −
  booking) a partir de bookings — **Fase 18** (tracking/timesheet), onde o
  tracking scenario consome os bookings.
- `ExtendedBooking` (Fase 8.1) continua sem uso: a 14C.15 introduziu
  `ChargeBooking` próprio; uma futura limpeza deve apagar ou unir os dois.

## 14. C18 — Colunas de estoque `stockquantity`/`stockcost` (2026-11-02)

Pendência registrada em §13.7 (origem: “Fora de escopo de C13”, §13.1). Mesma
família do 14C.1.19: material nos conteúdos de relatório.

### 14.1 Especificação

Duas colunas novas, aceitas em `columns` de qualquer relatório de tabela
(extensão SyntaxMesh — não existem no TJ Ruby; o par completo é
`singlePattern` em `reportableAttributes`, `rules/report.ts`):

```tjp
materialreport mr "Materiais" {
  columns no, name, unit, stockquantity, stockcost
}
```

- **`stockquantity`** — Σ algébrico das quantidades dos bookings de **estoque**
  do material (movimentos **sem** tarefa, `isInventory()`, 14C.13.1 —
  atributo de cenário `stockbookings`) cuja data cai no período do relatório
  (`[start, end]` fechado, a mesma convenção do recorte de alocações
  `materialTaskInPeriod`). Entrada positiva, saída/estorno negativa.
- **`stockcost`** — Σ dos valores desses movimentos, com o preço efetivo do
  booking (`unitPriceFor`: booking → material; alocação não se aplica, o
  movimento não tem tarefa).
- **Resolução**: casos `stockquantity`/`stockcost` em
  `TableReport.genMaterialCell` (linhas de `Material`), com as helpers
  `stockBookingsInPeriod`/`materialStockQuantity`/`materialStockCost` —
  portanto valem para **todo conteúdo de tabela que lista materiais**, não só
  o `materialreport` (o dispatch de linhas de material é do `TableReport`
  compartilhado). Booking **com** tarefa (consumo) não entra: âncora de
  separação dos dois papéis (14C.16.4), travada por teste.
- **Metadados**: `materialPropertiesById` (título/align),
  `materialNumericColumns` (Float, align right), `MATERIAL_COLUMN_TITLES`
  (títulos das colunas padrão). Desde C18, `defaultColumnTitle` consulta
  `materialPropertiesById` como segundo dicionário (o núcleo tem prioridade —
  ids como `journal` são compartilhados), de modo que colunas de material
  **declaradas pelo usuário** em `columns` saem com título também em
  relatórios fora do `materialreport`.
- **i18n**: keywords `stockcost`/`stockquantity` em `canonical.ts` + pt-BR
  (`custoestoque`/`quantidadeestoque`) + es (`costoexistencias`/
  `cantidadexistencias`).

### 14.2 Verificação

- Parser: `columns stockquantity, stockcost` aceito com títulos próprios;
  keyword desconhecida continua rejeitada pelo FSM.
- Células: soma algébrica (500 − 100 = 400; × 10 = 4000), precedência de preço
  do booking (100 × 12 − 50 × 10 = 700), recorte de período (movimento de 2027
  fora de um relatório 2026), material sem movimentos = 0, booking com tarefa
  não conta.
- `tests/reports/stock-columns_14c_test.ts` — 2 describes / 7 steps.
- Suíte afetada (parser + reports + golden + query): **213 testes / 2000
  passos / 0 falhas**; suíte core completa **484 testes / 4941 passos /
  0 falhas** · `deno task check:all` exit 0 · `check:stubs` OK; goldens
  byte-idênticos (as keywords novas não aparecem em fixture existente);
  `deno fmt --check` limpo (590 arquivos); `deno lint` limpo nos arquivos
  tocados.
