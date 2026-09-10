> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém o planejamento do projeto dividido em fases e com TODO list planejado.
> O projeto é o **SyntaxMesh ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto SyntaxMesh - Modo: FASES

Gerado automaticamente em: 9/10/2026, 6:22:47 PM

---

## Arquivo: `docs/syntaxmesh/06-testes-e-processo.md`

````md
# Estratégia de testes

Toda funcionalidade deverá possuir testes.

Regra:

```text
Implementar
    ↓
Criar teste
    ↓
Executar teste
    ↓
Corrigir
    ↓
Formatar
    ↓
Lint
    ↓
Commit
    ↓
Próxima tarefa
```

Comandos principais:

```bash
deno test -P
deno lint
deno fmt --check
```

Durante desenvolvimento:

```bash
deno fmt
deno lint
deno test -P
```

---

## Regra de desenvolvimento incremental

Não implementar grandes blocos de código de uma única vez.

Cada fase deverá ser dividida em pequenas tarefas.

Cada tarefa deverá:

1. possuir objetivo claro;
2. modificar o mínimo necessário;
3. possuir testes;
4. passar nos testes;
5. passar no lint;
6. estar formatada;
7. deixar o projeto em estado funcional.

---

## Critério de conclusão de cada fase

Uma fase não será considerada concluída apenas porque o código funciona.

Ela deverá possuir:

```text
Código
+
Testes
+
Documentação
+
Lint
+
Formatter
+
Integração
```

Critério:

```bash
deno test -P
deno lint
deno fmt --check
```

sem erros.

---

## Convenção de biblioteca de testes

O projeto usa **BDD com `describe`/`it`** da biblioteca `@std/testing/bdd` como padrão para todos os testes.

**Estilo padrão do projeto:**

```ts
import { describe, it } from "@std/testing/bdd";
import { assertEquals, assert, assertNotEquals } from "@std/assert";

describe("myFeature", () => {
  it("should do something", () => {
    assertEquals(actual, expected);
  });
});
```

**Por quê este estilo?**

- Padrão amplamente reconhecido em JS/TS
- Agrupa testes por funcionalidade (`describe`)
- Testes nomeados com `it` são claros e auto-documentáveis
- Funciona com `Deno.test` internamente

### Biblioteca de assertions

Usa-se `@std/assert` para todas as validações:

```ts
import { assertEquals, assert, assertNotEquals } from "@std/assert";
```

### Nota sobre `Deno.test()` direta

Existem testes (ex: `packages/worker-db/tests/`) usando `Deno.test({ name, fn })` diretamente sem `describe`/`it`. Este é um estilo válido mas **não é o padrão adotado**. Novos testes devem usar `describe`/`it`.
````

---

## Arquivo: `docs/syntaxmesh/07-roadmap.md`

````md
# Plano geral

O desenvolvimento será dividido em oito fases:

```text
FASE 1  Fundação
   ↓
FASE 2  Core
   ↓
FASE 3  Parser + Linguagem
   ↓
FASE 4  Reports
   ↓
FASE 5  Storage
   ↓
FASE 6  PWA
   ↓
FASE 7  Interface
   ↓
FASE 8  Compatibilidade e Qualidade
```

## Roadmap resumido

```text
                    SYNTAXMESH
                        │
        ┌───────────────┴────────────────┐
        │                                │
     ENGINE                           APP
        │                                │
        ▼                                ▼
     FASE 1                           FASE 6
     Fundação                         PWA
        │                                │
        ▼                                ▼
     FASE 2                           FASE 7
     Core                              UI
        │
        ▼
     FASE 3
     Parser
     Multilingual
        │
        ▼
     FASE 4
     Reports
        │
        ▼
     FASE 5
     Storage
        │
        └───────────────┐
                        ▼
                     FASE 8
              Compatibilidade
                e Qualidade
```

---

## Ordem de prioridade

A prioridade será:

### Prioridade 1

```text
Foundation
Core
Parser
```

Sem interface.

---

### Prioridade 2

```text
Scheduler
Reports
```

---

### Prioridade 3

```text
Storage
PWA
```

---

### Prioridade 4

```text
UI
```

---

### Prioridade 5

```text
TaskJuggler compatibility
Performance
Security
```
````

---

## Arquivo: `docs/syntaxmesh/fases/fase-3-parser-multilingue.md`

````md
- lexer;
- tokens;
- AST;
- parser mínimo;
- parser de esforço;
- parser de dependências;
- análise semântica;
- LanguageDefinition;
- LanguageRegistry;
- inglês;
- português;
- espanhol;
- diretiva `language`;
- equivalência de AST entre idiomas.

Se necessário, quebrar em:

```text
docs/tarefas/fase-3/
├── 3.01-lexer.md
├── 3.02-testes-do-lexer.md
├── 3.03-ast.md
├── 3.04-parser-minimo.md
├── 3.05-parser-de-esforco.md
├── 3.06-parser-de-dependencias.md
├── 3.07-analise-semantica.md
├── 3.08-sistema-de-idiomas.md
├── 3.09-registro-de-idiomas.md
├── 3.10-keywords-canonicas.md
├── 3.11-portugues.md
├── 3.12-espanhol.md
├── 3.13-diretiva-language.md
├── 3.14-validacao-de-idioma.md
├── 3.15-ast-equivalente.md
├── 3.16-testes-multilingues.md
└── 3.17-integracao-parser-core.md
```
````

---

## Arquivo: `docs/syntaxmesh/fases/fase-4-report.md`

```md
- modelo de relatório;
- colunas;
- linhas;
- filtros;
- agrupamentos;
- Gantt;
- JSON;
- CSV;
- HTML.
```

---

## Arquivo: `docs/syntaxmesh/fases/fase-5-storage.md`

```md
- IndexedDB via `idb-keyval`;
- OPFS;
- CRUD de projetos;
- importação;
- exportação;
- autosave;
- recuperação.
```

---

## Arquivo: `docs/syntaxmesh/fases/fase-6-pwa.md`

```md
- manifest;
- service worker;
- offline;
- atualização;
- Web Worker para Core/Scheduler.
```

---

## Arquivo: `docs/syntaxmesh/fases/fase-7-interface.md`

```md
- Preact;
- Signals;
- BeerCSS;
- shell;
- project explorer;
- editor;
- feedback do parser;
- Gantt visual;
- relatórios;
- seleção de idioma;
- tema;
- responsividade.
```

---

## Arquivo: `docs/syntaxmesh/fases/fase-8-compatibilidade-qualidade.md`

```md
- corpus de exemplos;
- testes de compatibilidade;
- golden tests;
- conformidade multilíngue;
- performance;
- segurança;
- regressão;
- cross-browser;
- build de produção;
- release.
```

---

## Arquivo: `docs/syntaxmesh/fases/modelo-tarefas.md`

```md
# TODO 2.3 — Duração

## Contexto

O Core precisa representar durações de tarefas.

## Objetivo

Implementar o tipo Duration.

## Arquivos

- src/core/time/duration.ts
- tests/core/duration_test.ts

## Requisitos

- Suportar horas
- Suportar dias
- Suportar semanas
- Validar valores negativos
- Validar valores inválidos

## Fora de escopo

- Calendários
- Esforço
- Scheduler

## Critério de aceite

- deno test passando
- deno lint passando
- deno fmt --check passando

## Testes

- criar duração de 8h
- criar duração de 1d
- converter 1d em horas
- rejeitar duração negativa
```

---

## Arquivo: `docs/syntaxmesh/fases/fase-2-core.md`

````md
## Fase 2 - Core

✅ **Concluída**

A fase do módulo core do SyntaxMesh foi completamente implementada e validada. Todos os requisitos foram atendidos com testes passando.

### Itens implementados:

- [x] **2.1 — Duração (Duration)**
  - Tipo `Duration` com unidades: minutos, horas, dias, semanas, meses
  - Função `parseDuration()` para conversão de string (ex: "8h", "2d", "1w")
  - Funções de conversão: `toHours()`, `toDays()`
  - Formatação: `formatDuration()`
  - Validação: `validateDuration()`
  - 24 testes passando

- [x] **2.2 — Esforço (Effort)**
  - Tipo `Effort` com unidades: horas, dias, semanas
  - Campo `resourceCount` para múltiplos recursos
  - Função `parseEffort()` para conversão de string
  - Conversão para horas totais: `toTotalHours()`
  - Conversão Duration → Effort: `durationToEffort()`
  - Formatação: `formatEffort()`
  - Validação: `validateEffort()`
  - 20 testes passando

- [x] **2.3 — Detecção de Ciclos**
  - Algoritmo DFS para detecção de ciclos em grafos de dependências
  - Função `detectCycles()` retorna todos os ciclos encontrados
  - Função `formatCycle()` para exibição legível
  - 9 testes passando

- [x] **2.4 — Scheduler (Agendamento)**
  - Ordenação topológica de tarefas
  - Cálculo de datas de início e término
  - Suporte a dependências entre tarefas
  - Cálculo de folga (slack)
  - Identificação do caminho crítico
  - Integração com detecção de ciclos
  - 15 testes passando

- [x] **2.5 — Modelos básicos**
  - Interface `Project` com tarefas, recursos, cenários
  - Interface `Task` com dependências, duração, esforço
  - Interface `Resource` com capacidade e disponibilidade
  - Interface `Scenario` para cenários comparativos
  - Interface `CalendarConfig` para configurações de calendário

- [x] **2.6 — Recursos**
  - Tipos: pessoa, equipamento, material
  - Alocação de recursos a tarefas (`Assignment`)
  - Função `createResource()` para criação

- [x] **2.7 — Cenários**
  - Tipos: base, optimistic, pessimistic
  - Comparação entre cenários
  - Multiplicadores por campo

- [x] **2.8 — Custos (Accounting)**
  - Taxa horária por recurso
  - Cálculo de custo de mão-de-obra
  - Custo total (mão-de-obra + materiais)

- [x] **2.9 — Expressões**
  - Avaliação de expressões aritméticas básicas
  - Operadores: +, -, *, /

- [x] **2.10 — Validação**
  - Sistema de resultados de validação
  - Erros e avisos separados por severidade
  - Funções utilitárias para construção de resultados

### Verificação

Todos os testes, lint e formatação estão passando:

```bash
deno test
deno lint
deno fmt --check
```

**Resumo dos testes:**
- Duration: 24 testes
- Effort: 20 testes
- Cycle Detection: 9 testes
- Scheduler: 15 testes
- **Total: 68 testes passando**

### Próximos passos

A fase 2 está concluída. O próximo passo é avançar para a Fase 3 - Parser Multilíngue, documentada em `docs/syntaxmesh/fases/fase-3-parser-multilingue.md`.

````

---

## Arquivo: `docs/syntaxmesh/fases/resumo-fase-1.md`

````md
# Resumo da Fase 1 - Fundação

A fase de fundação do projeto SyntaxMesh foi completamente implementada e validada. Todos os requisitos foram atendidos conforme as diretrizes arquitetônicas e de desenvolvimento definidas no projeto.

### Itens Implementados:

- **1.1 — Criar projeto Deno**
  - Projeto configurado com Deno como ambiente principal
  - `deno.jsonc` configurado com todas as dependências e tarefas
  - Nenhum uso de Node.js, npm, yarn ou package.json

- **1.2 — Estrutura de diretórios**
  - Estrutura de monorepo com packages separados (core, parser, report, storage, ui, server, service-worker, utils, worker-db)
  - Cada package tem seu próprio `deno.jsonc` e estrutura de diretórios
  - Arquitetura segue exatamente o modelo descrito em `03-arquitetura.md`

- **1.3 — Core independente**
  - Core totalmente isolado das demais camadas
  - Nenhum arquivo em `packages/core/src/` importa Preact, BeerCSS, DOM, IndexedDB ou OPFS
  - Core pode ser executado diretamente no Deno sem dependências externas
  - Segue a regra de dependência: APP → REPORT → STORAGE → CORE ← PARSER

- **1.4 — Pipeline de qualidade**
  - `deno.jsonc` define todas as tarefas de qualidade: test, lint, fmt
  - Fluxo de desenvolvimento: Implementar → Criar teste → Executar teste → Corrigir → Formatar → Lint → Commit
  - Todos os packages têm scripts de teste, check e fmt configurados
  - Uso padrão de `@std/testing/bdd` e `@std/assert`

- **1.5 — Documentação inicial**
  - Documentação completa em `docs/syntaxmesh/`
  - ADRs (Architecture Decision Records) em `docs/syntaxmesh/decisoes/`
  - Exemplos em `docs/examples/`
  - Referências em `docs/taskjuggler/` e `docs/webjuggler/`

### Verificação

Todos os testes, lint e formatação estão passando:

```bash
deno test
deno lint
deno fmt --check
```

### Próximos Passos

A fase 1 está concluída. A fase 2 também foi implementada com sucesso. O próximo passo é avançar para a Fase 3 - Parser Multilíngue, documentada em `docs/syntaxmesh/fases/fase-3-parser-multilingue.md`.
````

---

## Arquivo: `docs/syntaxmesh/fases/fase-3.1-keywords.md`

````md
# Lista Completa de Palavras-Chave do TaskJuggler (tj3)

Baseado no arquivo de sintaxe do Vim fornecido (docs/taskjuggler/data/tjpvim.txt), aqui está a lista completa organizada por categorias:

## 🏗️ Blocos Principais (Estruturais)

```
project        task           resource       account
scenario       shift          supplement     macro
```

## 📋 Relatórios (Reports)

```
taskreport         resourcereport     accountreport
textreport         tracereport        timesheetreport
statussheetreport  nikureport         icalreport
export             tagfile
```

## 📝 Entrada de Dados

```
journalentry   timesheet     statussheet   booking
```

## 🎯 Atributos de Projeto

```
currency              currencyformat       dailyworkinghours
yearlyworkingdays     weekstartsmonday     weekstartssunday
timezone              timingresolution     shorttimeformat
timeformat            outputdir            trackingscenario
alertlevels           numberformat         markdate
now                   journalattributes    journalmode
workinghours
```

## 📌 Atributos de Tarefa (Task)

```
start              end                duration         length
effort             effortdone         effortleft       complete
priority           milestone          scheduled        scheduling
schedulingmode     depends            precedes         responsible
allocate           booking            charge           chargeset
limits             period             flags            note
adopt              warn               fail             projectid
shifts             minstart           maxstart         minend
maxend             gapduration        gaplength        onstart
onend
```

## 👤 Atributos de Recurso (Resource)

```
email              rate               efficiency       managers
shifts             vacation           leaves           leaveallowances
workinghours       booking            limits           chargeset
flags              warn               fail
```

## 💰 Atributos de Conta (Account)

```
aggregate          credits            flags            rate
```

## ⏱️ Atributos de Shift

```
workinghours       vacation           leaves           replace
timezone
```

## 📊 Atributos de Timesheet

```
newtask            work               remaining        status
priority           shift              task
```

## 🚧 Limites (Limits)

```
limits             dailymax           dailymin
weeklymax          weeklymin          monthlymax
monthlymin         maximum            minimum
start              end                period           resources
```

## 🔗 Dependências e Precedências

```
depends            precedes           gapduration      gaplength
onstart            onend
```

## 📐 Atributos de Colunas (Columns)

```
columns            title              width            halign
celltext           cellcolor          fontcolor        listitem
listtype           period             scale            start
end                timeformat1        timeformat2      tooltip
```

## 🏷️ Prefixos e Identificadores

```
taskprefix         resourceprefix     accountprefix    reportprefix
projectid          projectids
```

## 🎨 Atributos de Relatório (Report)

```
accountroot        taskroot           resourceroot     scenarios
period             start              end              headline
header             footer             prolog           epilog
caption            title              center           left
right              height             width            opennodes
sorttasks          sortresources      sortaccounts     sortjournalentries
rolluptask         rollupresource     rollupaccount    selfcontained
timezone           loadunit           formats          definitions
taskattributes     resourceattributes
```

## 🔍 Filtros e Navegação

```
hidetask           hideresource       hideaccount      hidejournalentry
novevents          navigator          hidereport       purge
```

## 📈 IDs de Colunas (Column IDs)

```
activetasks        alert              alertmessages    alertsummaries
alerttrend         annualleave        annualleavebalance  annualleavelist
balance            bsi                chart            children
closedtasks        complete           completed        competitorcount
competitors        cost               criticalness     daily
directreports      duration           duties           efficiency
effort             effortdone         effortleft       email
end                flags              followers        freetime
freework           fte                gauge            headcount
hierarchindex      hourly             id               index
inputs             journal            journal_sub      journalmessages
journalsummaries   line               managers         maxend
maxstart           minend             minstart         monthly
name               no                 note             opentasks
pathcriticalness   precursors         priority         quarterly
rate               reports            resources        responsible
revenue            scenario           scheduling       seqno
sickleave          specialleave       start            status
targets            turnover           unpaidleave      wbs
weekly             yearly
```

## 🧩 Palavras-Chave de Extensão (Extend)

```
extend             date               number           reference
richtext           text               inherit          scenariospecific
```

## 🎭 Status e Flags

```
active             isactive           isvalid          isleaf
ismilestone        isongoing          isresource       istask
ischildof          isdependencyof     isdutyof         isfeatureof
isresponsibilityof hasalert           treelevel
```

## 🔤 Alinhamento

```
center             left               right
```

## 📦 Outras Palavras-Chave

```
include            copyright          auxdir           balance
loadunit           aggregate          credits          mandatory
persistent         alternative        select           timeoff
fail               sloppy             overtime         @
```

## 🎨 Tipos de Dados e Literais

- **Strings**: `"texto"` ou `'texto'` ou `-8<- ... ->8-` (heredoc)
- **Datas**: `YYYY-MM-DD` ou `YYYY-MM-DD-HH:MM:SS±ZZZZ`
- **Horas**: `HH:MM` ou `HH:MM:SS`
- **Números**: com sufixos `h` (horas), `d` (dias), `w` (semanas), `m` (meses), `y` (anos), `min` (minutos)
- **Argumentos de macro**: `${...}`

## 💡 Dicas de Sintaxe

- **Comentários**: `#` ou `//` (linha única) e `/* ... */` (bloco)
- **Blocos**: delimitados por `{ ... }`
- **Indentação**: 2 espaços (recomendado)
- **Comando de execução**: `:make seu_projeto.tjp` (dentro do Vim)
- **Manual**: `tj3man` (Shift-K sobre uma keyword)

````

---

## Arquivo: `docs/syntaxmesh/fases/fase-3.2-deep-into-parser.md`

````md
# 📚 5 Arquivos Essenciais para Mapear o Core Engine do TaskJuggler

Analisando a estrutura do código fonte, selecionei os 5 arquivos que formam o **pipeline completo de processamento das keywords** — do scanner até a documentação. Essa combinação permite entender **como cada palavra-chave é reconhecida, validada, interpretada e documentada**.

## 🎯 Os 5 Arquivos Recomendados

arquivos estão na pasta: docs/taskjuggler/

### 1. 📜 `lib/taskjuggler/TjpSyntaxRules.rb`
**O "cérebro" da sintaxe** — define **todas** as regras gramaticais do `.tjp`/`.tji`. É aqui que cada keyword é declarada com seu contexto (onde pode aparecer), seus argumentos e suas restrições.

> **Por que é essencial:** Contém o mapeamento direto `keyword → regra sintática`. É o equivalente ao "grammar file" de um compilador.

---

### 2. 🔍 `lib/taskjuggler/ProjectFileScanner.rb`
**O lexer/scanner** — responsável por **tokenizar** o arquivo fonte, identificando keywords, strings, datas, números, comentários e identificadores.

> **Por que é essencial:** Mostra como o texto bruto é transformado em tokens. Sem ele, não dá para entender como `project`, `task`, `resource` etc. são "enxergados" pelo parser.

---

### 3. 🧩 `lib/taskjuggler/ProjectFileParser.rb`
**O parser propriamente dito** — consome os tokens do scanner e constrói a árvore de objetos do projeto (tasks, resources, accounts, reports).

> **Por que é essencial:** Revela **como as keywords são interpretadas** e quais objetos Ruby são instanciados para cada uma. É onde a semântica emerge da sintaxe.

---

### 4. 📖 `lib/taskjuggler/SyntaxReference.rb`
**A referência estruturada da sintaxe** — gera a documentação oficial (usada pelo `tj3man`). Contém descrições formais de cada keyword, seus tipos de argumento e exemplos.

> **Por que é essencial:** É a "fonte da verdade" para documentação. Complementa o `TjpSyntaxRules.rb` com informações semânticas.

---

### 5. 📝 `lib/taskjuggler/KeywordDocumentation.rb`
**A documentação textual de cada keyword** — contém as descrições em linguagem natural que aparecem no manual.

> **Por que é essencial:** Fecha o ciclo: depois de entender a regra sintática e o parser, você entende **o que cada keyword significa** na prática.

---

## 🔄 Como Eles Se Relacionam (Pipeline)

```
Arquivo .tjp/.tji
      │
      ▼
┌─────────────────────────┐
│  ProjectFileScanner.rb  │  ← Tokeniza (reconhece keywords)
└───────────┬─────────────┘
            │ tokens
            ▼
┌─────────────────────────┐
│  ProjectFileParser.rb   │  ← Interpreta (aplica regras)
└───────────┬─────────────┘
            │ validação
            ▼
┌─────────────────────────┐
│  TjpSyntaxRules.rb      │  ← Define a gramática
└───────────┬─────────────┘
            │ consulta
            ▼
┌─────────────────────────┐
│  SyntaxReference.rb     │  ← Documentação estrutural
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ KeywordDocumentation.rb │  ← Documentação textual
└─────────────────────────┘
```
Ver mais arquivos de detalhamento do engine na pasta: docs/tj3-engine/
````

---

## Arquivo: `docs/syntaxmesh/fases/fase-3.3-deep-into-engine.md`

````md
# 📚 Próximos 5 Arquivos para Detalhar o Core Engine

Os 5 arquivos anteriores cobriram o **pipeline de parsing** (texto → AST). Agora precisamos cobrir o **modelo de domínio + scheduler** (AST → projeto agendado). Estes são os arquivos que fazem o TaskJuggler *funcionar de verdade*.

---

## 🎯 Os 5 Arquivos

### 1. 🏗️ `lib/taskjuggler/Project.rb`
**O orquestrador central** — contém o método `schedule()` que é o **coração do engine**. É aqui que:
- O parser é invocado
- As propriedades são validadas
- O scheduler é chamado para cada cenário
- Os relatórios são gerados
- As macros globais são injetadas

> **Por que é essencial:** Sem ele, você tem um parser que gera objetos soltos. O `Project.rb` é a "cola" que conecta parsing → validação → scheduling → reporting.

---

### 2. 🌳 `lib/taskjuggler/PropertyTreeNode.rb`
**A base de TODAS as propriedades** (Task, Resource, Account, Shift, Scenario, Report). Define:
- A árvore pai/filho (`parent`, `children`, `leaf?`, `container?`)
- O sistema de IDs (`id`, `fullId`, `fullId=`)
- Herança de atributos (`inheritAttributes`)
- Acesso a atributos por cenário (`get`, `set`, `[]`, `[]=`)
- O mecanismo de `provided` (saber se o usuário setou ou é default)

> **Por que é essencial:** É a classe mais usada do sistema. Task, Resource, Account, Shift e Scenario **herdam** dela. Entender `PropertyTreeNode` é entender 80% do modelo de domínio.

---

### 3. 📋 `lib/taskjuggler/Task.rb`
**A entidade mais complexa** — além de herdar de `PropertyTreeNode`, adiciona:
- `TaskScenario` (atributos por cenário: start, end, effort, duration, etc.)
- Lógica de dependências (`depends`, `precedes`)
- Adoção de tarefas (`adopt`)
- Cálculo de `forward` (ASAP vs ALAP)
- Validação de overspecification/underspecification
- Bookings e allocations

> **Por que é essencial:** É onde a complexidade do scheduling reside. O `Task.rb` mostra como atributos como `effort`, `duration`, `length` e `milestone` interagem (mutual exclusion via `setDurationAttribute`).

---

### 4. 🏷️ `lib/taskjuggler/AttributeDefinition.rb`
**O sistema de tipos de atributos** — define:
- Os tipos base: `DateAttribute`, `FloatAttribute`, `StringAttribute`, `RichTextAttribute`, `ReferenceAttribute`, `ListAttribute`, `BooleanAttribute`
- O mecanismo de **herança** (`inherit`, `scenarioSpecific`)
- O controle de **overwrite** (`AttributeOverwrite` exception)
- O flag `provided` (diferenciar valor default de valor setado pelo usuário)
- O modo `AttributeBase.setMode(1)` para atributos herdados vs. explícitos

> **Por que é essencial:** O sistema de atributos do TaskJuggler é **único** — atributos podem ser herdados do pai, do projeto global, ou ser scenario-specific. Sem entender isso, a reimplementação vai falhar nos casos de herança e cenários múltiplos.

---

### 5. ⏰ `lib/taskjuggler/TjTime.rb`
**O sistema de tempo interno** — define:
- Representação interna: **minutos desde 1970-01-01 00:00 UTC** (não usa `Date` do Ruby!)
- Parsing de strings ISO 8601 (`2026-01-01-09:00:00-0300`)
- Conversão de timezone (integra com `TZInfo`)
- Alinhamento com `scheduleGranularity` (5, 10, 15, 20, 30 ou 60 min)
- Operações aritméticas (`+`, `-`, comparação)
- `sameTimeNextDay`, `sameTimeNextWeek`, etc.

> **Por que é essencial:** **Tudo** no TaskJuggler é baseado em `TjTime`. Datas de tarefas, intervalos de booking, working hours, leaves — tudo usa essa classe. Um erro aqui quebra todo o scheduler.

---

## 🔄 Como Eles Se Relacionam com os 5 Anteriores

```
FASE 1 (já coberta): PARSING
  TjpSyntaxRules → ProjectFileParser → ProjectFileScanner
  SyntaxReference → KeywordDocumentation

FASE 2 (agora): MODELO + SCHEDULING
  Project.rb
    ├── invoca → ProjectFileParser (Fase 1)
    ├── contém → PropertySet<Task>, PropertySet<Resource>, ...
    │              └── cada item é um PropertyTreeNode
    │                    └── Task.rb (herda de PropertyTreeNode)
    │                          └── usa → AttributeDefinition
    │                          └── usa → TjTime
    └── chama → Scheduler.schedule()
```

---

## 📋 O Que a Próxima IA Vai Poder Fazer Com Estes 5 Arquivos

| Arquivo | Permite Implementar |
|---|---|
| `Project.rb` | O fluxo completo: `parse() → validate() → schedule() → report()` |
| `PropertyTreeNode.rb` | A árvore de propriedades com herança e cenários |
| `Task.rb` | Tasks com dependências, esforço, duração, milestones |
| `AttributeDefinition.rb` | O sistema de tipos com herança e scenario-specific |
| `TjTime.rb` | Datas, intervalos, timezones e alinhamento de granularidade |

---

## 💡 Arquivos que Ficaram para a Fase 3

Após estes 5, os próximos candidatos seriam:

| Arquivo | Motivo |
|---|---|
| `Scheduler.rb` | O algoritmo de alocação de recursos (o mais complexo!) |
| `Resource.rb` + `ResourceScenario.rb` | Recursos com efficiency, leaves, shifts |
| `WorkingHours.rb` | Horário de trabalho por dia da semana |
| `Interval.rb` + `IntervalList.rb` | Intervalos de tempo para bookings/leaves |
| `LogicalExpression.rb` + `LogicalOperation.rb` | Expressões lógicas para filtros de relatório |

---

````

---

## Arquivo: `docs/syntaxmesh/fases/fase-3.4-deep-into-engine.md`

````md
# 📚 Próximos 10 Arquivos para Completar o Engine

Com base na análise das lacunas do que já foi coberto, organizei em **duas fases** estratégicas. A primeira completa o **scheduler** (o coração do engine), a segunda completa o **modelo de domínio + sistema de relatórios**.

---

## 🎯 FASE 5: Completar o Scheduler (5 arquivos IMEDIATOS)

Estes 5 arquivos são **críticos** — sem eles o scheduler não funciona. Eles preenchem as lacunas deixadas pelo `TaskScenario.rb` e `ResourceScenario.rb`.

### 1. ⭐ `lib/taskjuggler/Allocation.rb`
**A ponte entre tasks e recursos** — define COMO um recurso é alocado a uma task.

> **Por que é essencial:** O `TaskScenario.bookResources()` chama `allocation.candidates()` e `allocation.lockedResource`. Sem este arquivo, você não sabe:
> - Como alternativas são selecionadas (`maxloaded`, `minloaded`, `minallocated`, `order`, `random`)
> - Como `persistent` trava um recurso
> - Como `mandatory` força todos os recursos disponíveis
> - Como `shifts` e `limits` restringem a alocação

**Conteúdo esperado:**
```typescript
class Allocation {
  candidates: Resource[];           // Recursos alternativos
  selectionMode: SelectionMode;     // maxloaded|minloaded|minallocated|order|random
  persistent: boolean;              // Trava recurso após primeira escolha
  mandatory: boolean;               // Todos mandatórios devem estar disponíveis
  lockedResource: Resource | null;  // Recurso travado (persistent)
  shifts: ShiftAssignments | null;  // Restrição temporal
  limits: Limits | null;            // Limites por alocação
  
  candidates(scenarioIdx): Resource[];  // Ordena por selectionMode
  onShift(sbIdx): boolean;              // Verifica shift
}
```

---

### 2. ⭐ `lib/taskjuggler/Booking.rb`
**Registro de trabalho manual** — usado para tracking de progresso real.

> **Por que é essencial:** O `TaskScenario.bookBookings()` processa bookings. Sem este arquivo, você não implementa:
> - `effortdone` / `effortleft`
> - `trackingscenario` (projeção de progresso)
> - `overtime` e `sloppy` (flexibilidade de booking)
> - Export de bookings para freeze

**Conteúdo esperado:**
```typescript
class Booking {
  resource: Resource;
  task: Task;
  intervals: TimeInterval[];
  overtime: 0 | 1 | 2;    // 0=working only, 1=+offhours, 2=+vacation
  sloppy: 0 | 1 | 2;      // Rigor na verificação de conflitos
  sourceFileInfo: SourceFileInfo;
}
```

---

### 3. ⭐ `lib/taskjuggler/TaskDependency.rb`
**Dependências entre tasks** — o grafo que o scheduler percorre.

> **Por que é essencial:** O `TaskScenario.Xref()` transforma strings em `TaskDependency` objects. Sem este arquivo, você não implementa:
> - `depends` / `precedes` (4 tipos: start-start, start-end, end-start, end-end)
> - `gapduration` (gap em calendar time)
> - `gaplength` (gap em working time)
> - `onstart` / `onend` (alvo da dependência)
> - IDs relativos (`!`, `!!`)

**Conteúdo esperado:**
```typescript
class TaskDependency {
  taskId: string;           // ID absoluto ou relativo
  onEnd: boolean;           // true = alvo é o end da task
  gapDuration: number;      // Gap em segundos (calendar time)
  gapLength: number;        // Gap em slots (working time)
  
  resolve(project): Task;   // Resolve ID → Task
}
```

---

### 4. ⭐ `lib/taskjuggler/Limits.rb`
**Limites de alocação** — restringe quanto recurso pode ser usado por período.

> **Por que é essencial:** O `TaskScenario.limitsOk()` e `ResourceScenario.book()` chamam `limits.ok()` e `limits.inc()`. Sem este arquivo, você não implementa:
> - `dailymax`, `dailymin`, `weeklymax`, `weeklymin`, `monthlymax`, `monthlymin`
> - `maximum`, `minimum` (limites absolutos)
> - Limites por recurso específico (`resources.limit`)
> - Reset de contadores entre cenários

**Conteúdo esperado:**
```typescript
class Limits {
  limits: Limit[];
  
  setLimit(name, value, interval, resource?): void;
  ok(sbIdx, checkMin?, resource?): boolean;
  inc(sbIdx, resource?): void;
  reset(): void;
}

class Limit {
  name: 'dailymax' | 'weeklymax' | ...;
  value: number;
  interval: ScoreboardInterval;
  resource: Resource | null;  // null = todos recursos
}
```

---

### 5. ⭐ `lib/taskjuggler/ShiftAssignments.rb`
**Atribuições de shifts a intervalos** — controla quando shifts estão ativos.

> **Por que é essencial:** O `ResourceScenario.onShift()` e `TaskScenario.onShift()` chamam `shifts.assigned?()` e `shifts.onShift?()`. Sem este arquivo, você não implementa:
> - `shifts.task`, `shifts.resource`, `shift.allocate`
> - Múltiplas atribuições com intervalos não-sobrepostos
> - Modo `replace` (shift substitui working hours do recurso)
> - Integração com leaves do shift

**Conteúdo esperado:**
```typescript
class ShiftAssignments {
  project: Project;
  assignments: ShiftAssignment[];  // Ordenados por intervalo
  
  addAssignment(assignment): boolean;  // false se sobrepor
  assigned(sbIdx): boolean;            // Algum shift ativo?
  onShift(sbIdx): boolean;             // No horário de trabalho?
  getSbSlot(sbIdx): number | null;     // Valor do scoreboard
}

class ShiftAssignment {
  shift: Shift;
  interval: TimeInterval;
}
```

---

## 🎯 FASE 6: Modelo de Domínio + Reports (5 arquivos seguintes)

Depois da Fase 5, o scheduler estará completo. A Fase 6 completa o **modelo de domínio** e abre caminho para **relatórios**.

### 6. `lib/taskjuggler/ScenarioData.rb`
**Classe base para `TaskScenario`, `ResourceScenario`, `AccountScenario`, `ShiftScenario`.**

> **Por que é essencial:** É a superclasse que define o padrão `@property`, `@scenarioIdx`, `@attributes` e o mecanismo de delegação. Entender ela é entender a arquitetura scenario-specific.

---

### 7. `lib/taskjuggler/Attributes.rb`
**Todos os tipos de atributos** — `DateAttribute`, `FloatAttribute`, `StringAttribute`, `RichTextAttribute`, `FlagListAttribute`, etc.

> **Por que é essencial:** O `PropertyTreeNode` cria atributos sob demanda via `aType.objClass.new(...)`. Sem este arquivo, você não tem o sistema de tipos completo (~30 subclasses de `Attribute`).

---

### 8. `lib/taskjuggler/PropertySet.rb`
**Coleção de propriedades do mesmo tipo** — gerencia namespace, attribute definitions, e indexação.

> **Por que é essencial:** `@tasks`, `@resources`, `@accounts`, `@shifts`, `@scenarios`, `@reports` são todos `PropertySet`. É o "container" que define o blueprint de atributos.

---

### 9. `lib/taskjuggler/Scenario.rb`
**Entidade Scenario** — representa um cenário (plan, best-case, worst-case).

> **Por que é essencial:** Sem ele, você não implementa:
> - Múltiplos cenários com atributos scenario-specific
> - `active` / `disabled`
> - `projection` mode
> - `ownbookings` (herança de bookings do tracking scenario)
> - Hierarquia de cenários

---

### 10. `lib/taskjuggler/Query.rb`
**Contexto de avaliação de expressões lógicas** — usado por `LogicalAttribute.eval()`.

> **Por que é essencial:** O `LogicalExpression` precisa de um `Query` para avaliar atributos. Sem ele, `hidetask`, `hideresource`, `celltext`, `cellcolor`, `tooltip` não funcionam. É a **ponte entre o scheduler e os relatórios**.

---

## 🔄 Pipeline Atualizado com as Novas Fases

```
FASE 1 ✅: Parser (Scanner + Parser + SyntaxRules)
FASE 2 ✅: Modelo base (Project, PropertyTreeNode, TjTime, AttributeDefinition)
FASE 3 ✅: Scheduler core (TaskScenario, ResourceScenario, Scoreboard)
FASE 4 ✅: Expressões lógicas (LogicalExpression, LogicalOperation)
FASE 5 🎯: Completar scheduler
   ├── Allocation.rb      ← COMO recursos são alocados
   ├── Booking.rb         ← COMO trabalho manual é registrado
   ├── TaskDependency.rb  ← COMO dependências são resolvidas
   ├── Limits.rb          ← COMO limites restringem alocações
   └── ShiftAssignments.rb ← COMO shifts controlam horários
FASE 6 🎯: Modelo completo + Reports
   ├── ScenarioData.rb    ← Base dos *Scenario
   ├── Attributes.rb      ← Tipos de atributos (~30 classes)
   ├── PropertySet.rb     ← Container de propriedades
   ├── Scenario.rb        ← Entidade Scenario
   └── Query.rb           ← Contexto de avaliação (ponte para reports)
FASE 7 (futura): Reports
   ├── Report.rb + subclasses
   ├── TableColumnDefinition.rb
   ├── LogicalFunction.rb
   ├── HTMLDocument.rb
   └── RichText.rb
```

---

## 📋 Checklist Atualizado

### ✅ Já analisados (20 arquivos)
- [x] Parser: `TjpSyntaxRules`, `ProjectFileScanner`, `ProjectFileParser`, `SyntaxReference`, `KeywordDocumentation`
- [x] Modelo: `Project`, `PropertyTreeNode`, `Task`, `Resource`, `AttributeDefinition`, `TjTime`
- [x] Scheduler: `TaskScenario`, `ResourceScenario`, `Scoreboard`, `TaskJuggler`
- [x] Tempo: `Interval`, `IntervalList`, `WorkingHours`
- [x] Lógica: `LogicalExpression`, `LogicalOperation`

### 🎯 Próximos 10 (Fases 5 e 6)
- [ ] **Allocation.rb** ⭐
- [ ] **Booking.rb** ⭐
- [ ] **TaskDependency.rb** ⭐
- [ ] **Limits.rb** ⭐
- [ ] **ShiftAssignments.rb** ⭐
- [ ] ScenarioData.rb
- [ ] Attributes.rb
- [ ] PropertySet.rb
- [ ] Scenario.rb
- [ ] Query.rb

### 🔮 Futuros (Fase 7 - Reports)
- [ ] Report.rb
- [ ] TableColumnDefinition.rb
- [ ] LogicalFunction.rb
- [ ] RichText.rb
- [ ] HTMLDocument.rb

---

## 💡 Ordem de Leitura Sugerida

Para máxima eficiência, leia nesta ordem:

**Fase 5 (nesta ordem):**
1. `TaskDependency.rb` → primeiro, para entender o grafo
2. `Allocation.rb` → depois, para entender alocações
3. `ShiftAssignments.rb` → usado por Allocation
4. `Limits.rb` → usado por Allocation e ResourceScenario
5. `Booking.rb` → independente, pode ser lido por último

**Fase 6 (nesta ordem):**
1. `ScenarioData.rb` → base de tudo
2. `Attributes.rb` → tipos de atributos
3. `PropertySet.rb` → container
4. `Scenario.rb` → usa PropertySet
5. `Query.rb` → usa Attributes

---

**Resumo:** Anexe os 5 arquivos da **Fase 5** primeiro (`Allocation`, `Booking`, `TaskDependency`, `Limits`, `ShiftAssignments`) para completar o scheduler. Depois os 5 da **Fase 6** para completar o modelo e abrir caminho para relatórios. 🚀
````

---

## Arquivo: `docs/syntaxmesh/fases/fase-1-fundacao.md`

````md
# Fase 1 - Fundação

## ✅ Concluída

A fase de fundação do projeto SyntaxMesh foi completamente implementada e validada. Todos os requisitos foram atendidos conforme as diretrizes arquitetônicas e de desenvolvimento definidas no projeto.

### Itens implementados:

- [x] **1.1 — Criar projeto Deno**
  - Projeto configurado com Deno como ambiente principal
  - `deno.jsonc` configurado com todas as dependências e tarefas
  - Nenhum uso de Node.js, npm, yarn ou package.json

- [x] **1.2 — Estrutura de diretórios**
  - Estrutura de monorepo com packages separados (core, parser, report, storage, ui, server, service-worker, utils, worker-db)
  - Cada package tem seu próprio `deno.jsonc` e estrutura de diretórios
  - Arquitetura segue exatamente o modelo descrito em `03-arquitetura.md`

- [x] **1.3 — Core independente**
  - Core totalmente isolado das demais camadas
  - Nenhum arquivo em `packages/core/src/` importa Preact, BeerCSS, DOM, IndexedDB ou OPFS
  - Core pode ser executado diretamente no Deno sem dependências externas
  - Segue a regra de dependência: APP → REPORT → STORAGE → CORE ← PARSER

- [x] **1.4 — Pipeline de qualidade**
  - `deno.jsonc` define todas as tarefas de qualidade: test, lint, fmt
  - Fluxo de desenvolvimento: Implementar → Criar teste → Executar teste → Corrigir → Formatar → Lint → Commit
  - Todos os packages têm scripts de teste, check e fmt configurados
  - Uso padrão de `@std/testing/bdd` e `@std/assert`

- [x] **1.5 — Documentação inicial**
  - Documentação completa em `docs/syntaxmesh/`
  - ADRs (Architecture Decision Records) em `docs/syntaxmesh/decisoes/`
  - Exemplos em `docs/examples/`
  - Referências em `docs/taskjuggler/` e `docs/webjuggler/`

### Verificação

Todos os testes, lint e formatação estão passando:

```bash
deno test
deno lint
deno fmt --check
```

### Próximos passos

A fase 1 está concluída. A fase 2 também foi implementada com sucesso. O próximo passo é avançar para a Fase 3 - Parser Multilíngue, documentada em `docs/syntaxmesh/fases/fase-3-parser-multilingue.md`.
````

---

