# Fase 14 Complemento — Relatórios: Materiais, RDO, MspXml e Markdown

> **Arquivo:** `docs/syntaxmesh/fases/fase-14-relatorios-complemento.md`
> **Tarefas:** `docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md`
> **Status:** 🟡 em andamento — C0 ✅ 2026-10-31 · C1 ✅ 2026-11-01 · C2 ✅ 2026-11-01 · C3 ✅ 2026-11-01 · C4 ✅ 2026-11-01 · C5–C7 pendentes
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
> calendário vêm dos recursos) e `hideMaterial` fica inerte até a C6.

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
