# ADR 029 — Journal e AlertLevel em TypeScript

> **Status:** ✅ Aceito
> **Data:** 2026-11-03
> **Autores:** Qoder

## Resumo

O status de acompanhamento (tracking) do TaskJuggler não é um campo: é um
**histórico** de entradas datadas (`JournalEntry`) por propriedade, cada uma
com um nível de severidade (`alertLevel`) indexado numa paleta configurável
(`AlertLevelDefinitions`). O SyntaxMesh porta esse subsistema dentro do
`Project` (`project.journal`), com `JournalEntry.property` podendo ser `null`
(entradas globais do projeto) e `AlertLevelDefinition` como **classe** (e não
interface estrutural), porque o Ruby a define como `Struct.new(:id, :name,
:color)` com `to_s` próprio.

> **Nota de numeração:** o plano `fase-16-apoio.md` citou "ADR 026/027/028"
> em versões anteriores. Na numeração real: 026 = Markdown (Fase 13),
> 027 = reports no browser (Fase 14), 028 = Gantt (Fase 15). O
> `decisoes/README.md` já reservava o **029** para Journal e AlertLevel.

## Contexto

### Como o TaskJuggler modela status

- `Journal` (`Journal.rb`) guarda uma `JournalEntryList` global e um índice
  `property → JournalEntryList`. Cada `JournalEntry` tem `date`, `headline`,
  `property`, `author`, `summary`, `details`, `alertLevel`, `flags` e
  `timeSheetRecord`.
- `AlertLevelDefinitions` define uma lista **ordenada por severidade**
  (`green` < `yellow` < `red`). O `alertLevel` de uma entrada é o **índice**
  nessa lista — não o nome —, e é isso que os filtros `alerts_*`, a coluna
  `alert` e o `query_alerttrend` comparam.
- `Project#journal` é criado no construtor do projeto; `Project#cleanup`
  poda entradas de propriedades removidas.

### O que a Fase 14 antecipou

Para os relatórios não ficarem esperando, a Fase 14 Complemento trouxe
(`14C.0`/`14C.1.7`) uma versão mínima de `Journal` (índices por entidade,
`currentEntriesR`, `alertLevel`, `alertEntries`, `to_rti` para os modos
`journal`/`journal_sub`/`journalmessages`/`journalsummaries`) e um
`alert-levels.ts` com um `interface` + funções (`alertLevelIndexById` etc.).
A Fase 16 herda e completa: classes reais, `JournalEntryList`, os modos
`status_*`/`alerts_*` de `to_rti` e `entriesBy{Task,TaskR,Resource}`.

## Decisão

### 1. `Journal` é parte do `Project`

`Project` cria o `journal` no construtor (como no Ruby) e o expõe como
`readonly journal: Journal`. Não existe journal "solto": os `query_*` de
propriedade leem `query.project.journal`. A poda em cascata usa
`journal.deleteIf(e => e.property === removida)` — equivalente ao
`delete_if` do Ruby, que mantém o índice coerente.

### 2. `JournalEntry.property` é `PropertyTreeNode | null`

`null` = entrada global do projeto (equivalente ao `journalentry` de nível
de projeto sem `task`/`resource`). O índice só recebe entradas com
propriedade não-nula; entradas globais vivem apenas na lista principal e são
alcançadas por `Journal#entries(...)`.

### 3. Alert levels configuráveis com 3 defaults

`AlertLevelDefinitions` nasce com `green`/`yellow`/`red` (severidade
ascendente) e `modified = false`. A diretiva `alertlevels` do `.tjp`
substitui a lista inteira (mínimo 2 níveis, ids e nomes únicos) — a
validação de unicidade fica no parser, que reporta erro de sintaxe com
`SourceFileInfo`, exatamente como o `TjParser` faz.

### 4. `AlertLevelDefinition` é classe, não interface

Trocar o `interface` antecipado pela classe é o que torna `to_tjp()` fiel:
no Ruby `AlertLevelDefinitions#to_tjp` faz `join(", ")` chamando o `to_s`
da `Struct` (`id 'name' 'color'`). Como o único ponto do port que construía
o valor estruturalmente era a regra `alertLevelDefinition` do parser, a
migração custou uma linha (`new AlertLevelDefinition(...)`).

### 5. `to_rti` cobre os 6 modos e é síncrono

`journal`, `journal_sub`, `status_up`, `status_down`/`status_dep`,
`alerts_down`/`alerts_dep` (e os dois modos "messages/summaries" usados
pelas colunas de journal). O resultado vai para `query.rti` (ADR 027:
reports no browser devolvem dados, não escrevem em disco). O
`DataCache` do `currentEntriesR` fica **omitido** — é otimização pura no
Ruby e não altera resultado; o cálculo é O(entradas) por consulta, o que é
irrelevante para os volumes de um `.tjp`.

## Alternativas consideradas

1. **Campo `status` por tarefa (snapshot).** Simples de renderizar, mas
   perde histórico, tendência (`alerttrend`), flags por entrada e o
   `journalmessages`/`journalsummaries` que os reports usam. Rejeitado.
2. **Manter o `interface` + funções livres de `alert-levels.ts`.** Evitaria
   a migração, mas obrigaria a reimplementar `to_tjp` fora do tipo e
   divergeria do Ruby em `modified`/`clear`/`add`. Rejeitado.
3. **`Map<string, AlertLevelDefinition>` em vez de lista.** Perde a ordem
   de severidade, que é a semântica do índice. Rejeitado.
4. **Cache (`DataCache`) no `currentEntriesR`.** Fiel ao Ruby, mas exige
   invalidação em toda mutação do journal; sem ganho mensurável no browser.
   Adiado (não bloqueia nenhum resultado).

## Consequências

**Positivas**

- `query_journal`, `query_alert`, `query_alerttrend`, `query_alertmessages`,
  `query_alertsummaries`, `query_journalmessages`, `query_journalsummaries` e
  `query_dashboard` deixam de ser stubs; a Fase 18 (status sheets) consome o
  mesmo subsistema.
- Golden tests podem comparar `to_rti`/`to_rText` contra o oráculo Ruby.
- `Leave`/`LeaveAllowance` passam a alimentar as colunas `sickleave`,
  `annualleave`, `annualleavebalance`, `specialleave`, `unpaidleave` e
  `timeoffdays`.

**Negativas / limites**

- O journal em memória cresce com o histórico; em projetos com many
  scenarios cada entrada é um objeto. Aceitável (Ruby idem).
- `timeSheetRecord` continua `unknown` até a Fase 18: o `to_rText` do Ruby
  tem um ramo de timesheet que só será exercitado lá.
- Sem `DataCache`, consultas repetidas de `alertLevel` recalculam. Custo
  linear, sem impacto observável nos corpora atuais.

## Referências

- `docs/taskjuggler/lib/taskjuggler/Journal.rb`
- `docs/taskjuggler/lib/taskjuggler/AlertLevelDefinitions.rb`
- `docs/taskjuggler/lib/taskjuggler/LeaveList.rb`
- `docs/syntaxmesh/fases/fase-16-apoio.md` (Bloco A/B)
- ADR 011 (port fiel "regra zero"), ADR 013 (`compat.keepRubyBugs`),
  ADR 027 (reports devolvem strings), ADR 030 (core em `packages/core`)
