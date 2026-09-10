> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém a DOCUMENTAÇÃO e diretrizes arquiteturais do projeto.
> O projeto é o **SyntaxMesh ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto SyntaxMesh - Modo: DOCS

Gerado automaticamente em: 9/10/2026, 6:22:47 PM

---

## Arquivo: `LICENSE`

```license
MIT License

Copyright (c) 2026 Vanaware

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

---

## Arquivo: `docs/syntaxmesh/00-index.md`

```md
# SyntaxMesh — Índice de Contexto

## Regras globais

- TypeScript + Deno apenas.
- Browser only.
- Nada de Node.js, npm, yarn, pnpm.
- Core não pode depender de DOM, Preact, BeerCSS, IndexedDB ou OPFS (@syntaxmesh/core).
- Parser não conhece idiomas finais depois da normalização (@syntaxmesh/parser).
- Idioma do projeto é diferente do idioma da interface.
- Storage usa IndexedDB via idb-keyval e OPFS, através do pacote @syntaxmesh/worker-db.
- UI (@syntaxmesh/ui) usa Preact, Signals e BeerCSS.
- PWA offline com Service Worker (@syntaxmesh/service-worker).

## Arquivos de contexto

| Arquivo | Quando usar |
|---|---|
| docs/syntaxmesh/01-visao.md | Entender o produto |
| docs/syntaxmesh/02-principios.md | Regras técnicas e processo |
| docs/syntaxmesh/03-arquitetura.md | Arquitetura geral |
| docs/syntaxmesh/04-linguagem-multilingue.md | Idiomas e keywords canônicas |
| docs/syntaxmesh/05-formato-e-compatibilidade.md | Gramática do TaskJuggler |
| docs/syntaxmesh/06-testes-e-processo.md | Desenvolvimento Incremental |
| docs/syntaxmesh/07-roadmap.md | Fases e Prioridades |
| docs/syntaxmesh/08-mvp.md | Conteúdo da primeira versão estável |
| docs/syntaxmesh/09-regras-para-ia.md | Regras de Ouro |
| docs/syntaxmesh/10-futuro.md | Planos de melhorias |
| docs/syntaxmesh/fases/fase-1-fundacao.md | Trabalhar na arquitetura geral |
| docs/syntaxmesh/fases/fase-2-core.md | Trabalhar no @syntaxmesh/core |
| docs/syntaxmesh/fases/fase-3-parser-multilingue.md | Trabalhar no @syntaxmesh/parser |
| docs/syntaxmesh/fases/fase-4-report.md | Trabalhar no @syntaxmesh/report |
| docs/syntaxmesh/fases/fase-5-storage.md | Trabalhar no @syntaxmesh/utils com @syntaxmesh/worker-db |
| docs/syntaxmesh/fases/fase-6-pwa.md | Trabalhar no @syntaxmesh/service-worker |
| docs/syntaxmesh/fases/fase-7-interface.md | Trabalhar no @syntaxmesh/ui |
| docs/syntaxmesh/fases/fase-8-compatibilidade-qualidade.md | Trabalhar nos testes intergados ./tests |

## Docs de Referência

- docs/taskjuggler/ => contém a gema original do TaskJuggler (tj3) em Ruby (arquivos .tjp de exemplo e código fonte)
- docs/webjuggler/ => app em TypeScript visualizador de arquivos tjp com parser (App.tsx, Gantt.tsx, tjpParser.ts, etc.)
- docs/Learning/ => diretório com Minimal Working Examples (MWEs) para aprendizado do TaskJuggler:
  * mwe001/ a mwe009/ - exemplos incrementais de funcionalidades (básico, hierarquia, finanças, scheduling, tracking, export, cenários, macros)
  * README.md - guia de instalação, lições aprendidas e referência de sintaxe do TaskJuggler v3.8.4
- docs/syntaxmesh/decisoes/ => ADRs (Architecture Decision Records) de decisões arquitetônicas do projeto
- docs/BeerCSS/ => diretório com guia de como usar o beercss material design elements
```

---

## Arquivo: `docs/syntaxmesh/01-visao.md`

````md
# Visão do projeto

O **SyntaxMesh** é um motor de planejamento e gerenciamento de projetos inspirado nos conceitos e na linguagem do TaskJuggler, porém desenvolvido do zero em **TypeScript**, com execução no navegador e sem necessidade de servidor de aplicação.

O sistema deverá ser capaz de:

* interpretar arquivos de planejamento;
* calcular cronogramas;
* resolver dependências;
* trabalhar com recursos;
* calcular esforço, duração e custos;
* gerar relatórios;
* gerar gráficos de Gantt;
* trabalhar offline;
* armazenar projetos localmente;
* funcionar como PWA;
* permitir edição de arquivos de projeto;
* utilizar IndexedDB e OPFS via @syntaxmesh/worker-db;
* funcionar em hospedagem estática (no server functions);
* oferecer uma linguagem de projeto multilíngue.

O objetivo não é simplesmente converter o código Ruby do TaskJuggler para TypeScript.

O objetivo é criar uma **implementação independente**, compatível conceitualmente com o modelo de planejamento do TaskJuggler, utilizando seu comportamento, documentação e exemplos como referência.


## Definição final do projeto

**SyntaxMesh** será:

> Um motor de planejamento de projetos offline, executado integralmente no navegador, escrito em TypeScript e desenvolvido com Deno, capaz de interpretar uma linguagem de planejamento inspirada no TaskJuggler, com sintaxe multilíngue, motor próprio de scheduling, recursos, custos, calendários, relatórios e gráficos de Gantt, funcionando como uma PWA sem necessidade de servidor de aplicação.

A arquitetura central será:

```text
                 ┌─────────────────────┐
                 │      SyntaxMesh      │
                 └──────────┬──────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
       Parser              Core            Report
          │                 │                 │
   ┌──────┼──────┐          │                 │
   ▼      ▼      ▼          │                 │
 English  PT-BR  Outros     │                 │
   │      │      │          │                 │
   └──────┼──────┘          │                 │
          ▼                 │                 │
      Canonical AST ────────┘                 │
                            │                 │
                            ▼                 │
                       Scheduler ─────────────┘
                            │
                            ▼
                         Storage
                            │
                    ┌───────┴───────┐
                    ▼               ▼
                IndexedDB          OPFS
                    │
                    ▼
                  PWA
                    │
                    ▼
                 Browser
```

**Nome oficial do projeto: SyntaxMesh.**

**Objetivo:** construir primeiro um motor sólido e testável; depois uma aplicação completa em cima dele.

````

---

## Arquivo: `docs/syntaxmesh/02-principios.md`

````md
 # Princípios fundamentais

O desenvolvimento deverá obedecer às seguintes regras.

## TypeScript + Deno

O projeto será desenvolvido exclusivamente com:

* TypeScript;
* Deno;
* Web APIs;
* HTML;
* CSS;
* Preact;
* Signals;
* BeerCSS.

Não utilizar:

* Node.js;
* npm;
* yarn;
* pnpm;
* package.json;
* node_modules;
* dependências que exijam Node para execução.

O Deno será utilizado como:

* ambiente de desenvolvimento;
* executor TypeScript;
* executor de testes;
* lint;
* formatter;
* tarefas de build;
* ferramentas auxiliares.


## Estratégia de testes

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
deno test
deno lint
deno fmt --check
```

Durante desenvolvimento:

```bash
deno fmt
deno lint
deno test
```


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

Decisões arquitetônicas relevantes devem ser registradas em `docs/syntaxmesh/decisoes/` como ADR (Architecture Decision Record).

## Tarefas de automação (deno.jsonc)

Todas as tarefas de build, desenvolvimento, exportação e ferramentas de referência ficam centralizadas em `deno.jsonc`.

| Task | Comando | Descrição |
|------|---------|-----------|
| `build` | `deno run -A ./esbuild.ts` | Bundle da UI + Service Worker para produção |
| `dev` | `deno task --cwd packages/server dev` | Inicia servidor de desenvolvimento |
| `export` | `deno run --allow-read --allow-write ./export.ts` | Gera snapshot do código fonte |
| `taskjuggler` | `tj3 --no-color` | Executa o TaskJuggler original (Ruby gem) |
| `check` | `deno check build.ts esbuild.ts export.ts tests/**/*.ts` | Type check dos scripts e testes |
| `test` | `deno test --allow-env --allow-net tests/` | Executa a suíte de testes |

**Uso fora do diretório do projeto:**

```bash
deno task --config ~/github/syntaxmesh/deno.jsonc build
deno task --config ~/github/syntaxmesh/deno.jsonc dev
deno task --config ~/github/syntaxmesh/deno.jsonc export
deno task --config ~/github/syntaxmesh/deno.jsonc taskjuggler
deno task --config ~/github/syntaxmesh/deno.jsonc tests
```

**Uso dentro do diretório do projeto:**

```bash
deno task build
deno task dev
deno task export
deno task taskjuggler
```

---
````

---

## Arquivo: `docs/syntaxmesh/03-arquitetura.md`

````md
# Execução offline

O SyntaxMesh deverá funcionar completamente sem servidor de aplicação.

Arquitetura:

```text
                  Navegador
                     │
              ┌──────▼──────┐
              │ SyntaxMesh  │
              │    PWA      │
              └──────┬──────┘
                     │
       ┌─────────────┼─────────────┐
       │             │             │
       ▼             ▼             ▼
   IndexedDB       OPFS        Cache API
       │             │             │
       └─────────────┼─────────────┘
                     │
                  Offline
```

O servidor de hospedagem terá apenas a função de entregar arquivos estáticos.

Não deverá existir:

```text
Browser → Application Server → Database
```

A arquitetura desejada é:

```text
Browser
   │
   ├── Application
   ├── Core
   ├── Parser
   ├── Reports
   ├── IndexedDB, OPFS no @syntaxmesh/worker-db
   └── Service Worker
```

## Arquitetura geral

A arquitetura principal será:

```text
SyntaxMesh
│
├── core
├── parser
├── report
├── storage
└── app
```

### Core

Responsável pelo modelo e processamento do planejamento.

Não poderá depender de:

* Preact;
* BeerCSS;
* DOM;
* window;
* document;
* worker-db com IndexedDB e OPFS;
* Service Worker.

O Core deverá ser executável em:

* navegador;
* Web Worker;
* Deno;
* testes automatizados.

#### Divisão detalhada do Core

O Core deve ser totalmente independente de DOM.

```text
packages/core/src/
├── mod.ts
├── errors.ts
│
├── model/
│   ├── project.ts
│   ├── task.ts
│   ├── resource.ts
│   ├── account.ts
│   ├── scenario.ts
│   ├── calendar.ts
│   ├── dependency.ts
│   ├── constraint.ts
│   └── assignment.ts
│
├── time/
│   ├── duration.ts
│   ├── effort.ts
│   ├── date-range.ts
│   └── date-math.ts
│
├── calendar/
│   ├── workweek.ts
│   ├── holiday.ts
│   ├── workday.ts
│   └── calendar-resolver.ts
│
├── scheduling/
│   ├── graph.ts
│   ├── cycle-detection.ts
│   ├── topological-order.ts
│   ├── scheduler.ts
│   └── scheduler-result.ts
│
├── resources/
│   ├── availability.ts
│   ├── allocation.ts
│   └── conflicts.ts
│
├── accounting/
│   ├── cost.ts
│   ├── revenue.ts
│   └── balance.ts
│
├── scenarios/
│   ├── scenario.ts
│   └── scenario-comparison.ts
│
├── expressions/
│   ├── expression.ts
│   ├── evaluator.ts
│   └── operators.ts
│
└── validation/
    ├── validation-error.ts
    ├── validation-result.ts
    └── validate-project.ts
```

#### Regra importante

Nenhum arquivo dentro de `packages/core/src/` deve importar:

```ts
import ... from "preact";
import ... from "beercss";
import ... from "idb-keyval";
```

Também não deve usar:

```ts
document
window
navigator
localStorage ou indexedDB
```

Exceção apenas se for tipo Web API isolada e necessária, mas idealmente Core não usa.



### Parser

Responsável por:

* lexer;
* tokens;
* gramática;
* AST;
* análise semântica;
* validação;
* linguagem;
* tradução de palavras-chave para uma representação canônica.

#### Divisão detalhada do Parser

O Parser deve transformar texto em AST e depois em Core Model.

```text
packages/parser/src/
├── mod.ts
│
├── language/
│   ├── types.ts
│   ├── canonical.ts
│   ├── registry.ts
│   ├── en.ts
│   ├── pt-BR.ts
│   └── es.ts
│
├── lexer/
│   ├── token.ts
│   ├── token-type.ts
│   ├── lexer.ts
│   └── lexer-errors.ts
│
├── ast/
│   ├── node.ts
│   ├── project-node.ts
│   ├── task-node.ts
│   ├── resource-node.ts
│   ├── report-node.ts
│   ├── dependency-node.ts
│   ├── effort-node.ts
│   ├── duration-node.ts
│   └── source-location.ts
│
├── parser/
│   ├── parser.ts
│   ├── parser-context.ts
│   ├── project-parser.ts
│   ├── task-parser.ts
│   ├── resource-parser.ts
│   ├── dependency-parser.ts
│   ├── effort-parser.ts
│   ├── duration-parser.ts
│   └── report-parser.ts
│
├── semantic/
│   ├── symbol-table.ts
│   ├── semantic-errors.ts
│   ├── validate-ast.ts
│   ├── resolve-dependencies.ts
│   └── ast-to-core.ts
│
└── diagnostics/
    ├── diagnostic.ts
    └── diagnostic-list.ts
```

em docs/webjuggler temos um exemplo de tjp parser e utils em typescript para usarmos como referência

### Report

Responsável por:

* modelo de relatório;
* filtros;
* colunas;
* agrupamentos;
* Gantt;
* HTML;
* CSV;
* JSON;
* futuras formas de exportação.

##### Divisão detalhada de Report

```text
packages/report/src/
├── mod.ts
│
├── model/
│   ├── report.ts
│   ├── column.ts
│   ├── row.ts
│   ├── cell.ts
│   ├── filter.ts
│   └── grouping.ts
│
├── builders/
│   ├── task-report-builder.ts
│   ├── resource-report-builder.ts
│   └── cost-report-builder.ts
│
├── filters/
│   ├── task-filter.ts
│   ├── resource-filter.ts
│   ├── period-filter.ts
│   ├── status-filter.ts
│   └── hierarchy-filter.ts
│
├── gantt/
│   ├── gantt-model.ts
│   ├── gantt-task.ts
│   ├── gantt-dependency.ts
│   ├── gantt-scale.ts
│   └── gantt-svg.ts
│
└── export/
    ├── json.ts
    ├── csv.ts
    └── html.ts
```

### Storage

Responsável por persistência local:

* IndexedDB;
* OPFS;
* arquivos;
* projetos;
* configurações;
* importação;
* exportação.

#### Divisão detalhada de Storage

Storage deve ser isolado e não deve contaminar o Core.    
Utiliza o @syntaxmesh/worker-db e algumas funções ficarão em @syntaxmesh/utils.    
A hierarquia abaixo pode sofrer mudanças para acomodar as funções em utils

```text
packages/storage/src
├── mod.ts
├── types.ts
│
├── db/
│   ├── worker-db-client.ts
│   ├── project.ts
│   ├── settings.ts
│   └── files.ts
│
├── projects/
│   ├── project-service.ts
│   ├── project-summary.ts
│   ├── autosave.ts
│   └── recovery.ts
│
└── transfer/
    ├── import-tjp.ts
    ├── export-tjp.ts
    └── download.ts
```

#### Recomendação

Crie um wrapper para o `worker-db`:

```text
packages/storage/src/db/worker-db-client.ts
```

Assim o restante do código não depende diretamente da biblioteca.

Exemplo conceitual:

```ts
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}
```

---

### App

Responsável pela interface.

Tecnologias:

* Preact;
* Signals;
* BeerCSS;
* Web APIs.

#### Divisão detalhada da aplicação

A aplicação é a camada mais externa.

```text
packages/ui/src/
├── main.tsx
├── app.tsx
│
├── signals/
│   ├── ui.ts
│   ├── project.ts
│   ├── editor.ts
│   ├── parser.ts
│   ├── report.ts
│   └── settings.ts
│
├── components/
│   ├── Toolbar.tsx
│   ├── Sidebar.tsx
│   ├── StatusBar.tsx
│   ├── ProjectTree.tsx
│   ├── ErrorList.tsx
│   ├── LanguageSelector.tsx
│   └── ThemeAware.tsx
│
├── views/
│   ├── EditorView.tsx
│   ├── ReportView.tsx
│   ├── GanttView.tsx
│   ├── SettingsView.tsx
│   └── ProjectExplorerView.tsx
│
├── services/
│   ├── engine-service.ts
│   ├── parser-service.ts
│   ├── scheduler-service.ts
│   ├── report-service.ts
│   └── storage-service.ts
│
└── workers/
    ├── engine.worker.ts
    └── engine-client.ts
```

---

### Divisão detalhada de linguagem multilíngue

Essa parte é crítica e deve ficar bem isolada.

```text
packages/language/src
├── types.ts
├── canonical.ts
├── registry.ts
├── en.ts
├── pt-BR.ts
└── es.ts
```

#### `types.ts`

Responsável por definir:

```ts
export interface LanguageDefinition {
  id: string;
  name: string;
  keywords: Record<string, string[]>;
  units: Record<string, string[]>;
}
```

#### `canonical.ts`

Responsável por normalizar palavras.

Exemplo conceitual:

```ts
export type CanonicalKeyword =
  | "project"
  | "task"
  | "resource"
  | "depends"
  | "effort"
  | "duration"
  | "report";
```

#### `registry.ts`

Responsável por registrar idiomas.

Exemplo conceitual:

```ts
export class LanguageRegistry {
  get(id: string): LanguageDefinition {}
  register(language: LanguageDefinition): void {}
}
```

#### `en.ts`, `pt-BR.ts`, `es.ts`

Cada arquivo contém apenas um idioma.


## Estrutura de diretórios

Estrutura inicial proposta:

```text
syntaxmesh/
│
├── deno.json
├── README.md
├── LICENSE
│
├── packages/
│   │
│   ├── core/src
│   │   ├── model/
│   │   ├── calendar/
│   │   ├── scheduling/
│   │   ├── accounting/
│   │   ├── resources/
│   │   ├── scenarios/
│   │   ├── expressions/
│   │   └── validation/
│   │
│   ├── parser/src
│   │   ├── lexer/
│   │   ├── grammar/
│   │   ├── ast/
│   │   ├── parser/
│   │   ├── semantic/
│   │   └── language/
│   │       ├── language.ts
│   │       ├── english.ts
│   │       ├── portuguese-br.ts
│   │       └── spanish.ts
│   │
│   ├── report/src
│   │   ├── model/
│   │   ├── filters/
│   │   ├── columns/
│   │   ├── gantt/
│   │   ├── html/
│   │   ├── csv/
│   │   └── json/
│   │
│   ├── storage/src
│   │   ├── indexeddb/
│   │   ├── opfs/
│   │   └── projects/
│   │
│   └── ui/src
│       ├── components/
│       ├── signals/
│       ├── views/
│       ├── workers/
│       └── main.tsx
```
Subpastas /tests dentro de cada package. ex: `packages/core/tests/`    

Somente uma subpasta public em:    
```
├── packages/ui/public/
│   ├── index.html
│   ├── manifest.json
│   └── icons/
``` 
Pasta de exemplos em docs:
```
└── docs/examples/
    ├── minimal.tjp
    └── tutorial.tjp
```
---

## Regra arquitetural mais importante

O fluxo de dependências deve ser sempre aproximadamente:

```text
APP
 │
 ├───────────────┐
 ▼               ▼
REPORT         STORAGE
 │
 ▼
CORE
 ▲
 │
PARSER
```

Mas o Core nunca deverá depender de:

```text
APP
REPORT
STORAGE
DOM
IndexedDB, OPFS
Preact
BeerCSS
```

O objetivo é poder executar:

```ts
import { ... } from "./src/core/...";
```

diretamente no Deno e nos testes.

Decisões arquitetônicas fundamentais estão documentadas em `docs/syntaxmesh/decisoes/` como ADRs (Architecture Decision Record).

## Divisão dos testes

Testes devem espelhar os módulos.

```text
packages/
├── core/tests
│   ├── project_test.ts
│   ├── task_test.ts
│   ├── duration_test.ts
│   ├── effort_test.ts
│   ├── calendar_test.ts
│   ├── dependency_test.ts
│   ├── scheduler_test.ts
│   ├── cycle_detection_test.ts
│   └── cost_test.ts
│
├── parser/tests
│   ├── lexer_test.ts
│   ├── parser_minimal_test.ts
│   ├── parser_effort_test.ts
│   ├── parser_dependency_test.ts
│   ├── language_registry_test.ts
│   ├── language_equivalence_test.ts
│   └── semantic_validation_test.ts
│
├── report/tests
│   ├── task_report_test.ts
│   ├── filter_test.ts
│   ├── csv_export_test.ts
│   ├── json_export_test.ts
│   └── gantt_svg_test.ts
│
├── storage/tests
│   ├── project_repository_fake_test.ts
│   ├── opfs_fake_test.ts
│   ├── autosave_test.ts
│   └── recovery_test.ts
``` 
Testes de integração na pasta tests raiz:
``` 
tests/integration/
    ├── mvp_ptbr_test.ts
    ├── mvp_en_test.ts
    └── mvp_es_test.ts
```
````

---

## Arquivo: `docs/syntaxmesh/04-linguagem-multilingue.md`

````md
# Sintaxe multilíngue

Uma das características fundamentais do SyntaxMesh será permitir que a linguagem dos arquivos de projeto seja escolhida pelo usuário.

Inicialmente serão previstas:

* English;
* Português do Brasil;
* Español.

A arquitetura deverá permitir adicionar outros idiomas futuramente.


## Idioma do projeto x idioma da interface

Esses dois conceitos devem permanecer separados.

```text
Project Language != Application UI Language
```

Por exemplo:

Um usuário pode utilizar a interface em português e abrir um projeto escrito em inglês:

```text
UI: Português
Projeto: English
```

Ou:

```text
UI: English
Projeto: Português
```

O idioma da interface não deverá alterar automaticamente o idioma do arquivo de projeto.

---

## Arquitetura da linguagem

O fluxo será:

```text
                 SyntaxMesh
                     │
              ┌──────▼──────┐
              │ Language    │
              │ Dictionary  │
              └──────┬──────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
     English     Português      Outros
        │            │            │
        └────────────┼────────────┘
                     ▼
                  Lexer
                     │
                     ▼
                  Parser
                     │
                     ▼
                    AST
                     │
                     ▼
                   Core
```

O Core não deverá conhecer idiomas.

---

## Representação canônica

Os idiomas serão convertidos para uma representação interna única.

Por exemplo:

```text
task
tarefa
tarea
```

deverão resultar no mesmo conceito:

```ts
{
    type: "Task"
}
```

Da mesma forma:

```text
project
projeto
proyecto
```

deverão produzir:

```ts
{
    type: "Project"
}
```

Isso evita que o Core tenha que conhecer cada idioma.

---

## LanguageDefinition

A arquitetura deverá possuir uma definição semelhante a:

```ts
interface LanguageDefinition {
    id: string;
    name: string;

    keywords: Record<string, string[]>;

    units: Record<string, string[]>;
}
```

Exemplo:

```ts
const english: LanguageDefinition = {
    id: "en",
    name: "English",

    keywords: {
        project: ["project"],
        task: ["task"],
        resource: ["resource"],
        depends: ["depends"],
        effort: ["effort"],
        duration: ["duration"],
        report: ["report"]
    },

    units: {
        day: ["d", "day", "days"],
        hour: ["h", "hour", "hours"]
    }
};
```

Português:

```ts
const portugueseBR: LanguageDefinition = {
    id: "pt-BR",
    name: "Português (Brasil)",

    keywords: {
        project: ["projeto"],
        task: ["tarefa"],
        resource: ["recurso"],
        depends: ["depende"],
        effort: ["esforço"],
        duration: ["duração"],
        report: ["relatório"]
    },

    units: {
        day: ["d", "dia", "dias"],
        hour: ["h", "hora", "horas"]
    }
};
```

A implementação real deverá ser refinada durante a fase do parser.

---

## Declaração do idioma no arquivo

A linguagem poderá ser explicitamente definida:

```tjp
language "pt-BR"

projeto "Minha Obra" {
    tarefa "Fundação" {
        esforço 10d
    }
}
```

Em inglês:

```tjp
language "en"

project "My Project" {
    task "Foundation" {
        effort 10d
    }
}
```

A diretiva `language` deverá ser tratada pelo parser antes da interpretação das demais palavras-chave.

---

## Compatibilidade e tradução

O projeto deverá considerar futuramente a possibilidade de traduzir:

```text
Português → English
English → Português
English → Español
```

Entretanto, isso não será requisito obrigatório da primeira versão do parser.

A prioridade inicial será:

```text
English
      ↓
Canonical AST
      ↑
Português
```
````

---

## Arquivo: `docs/syntaxmesh/05-formato-e-compatibilidade.md`

````md
# Arquivos inicialmente suportados

O formato principal será inspirado no `.tjp`.

Exemplo:

```tjp
project "Minha Obra" {

    task "Fundação" {
        effort 10d
    }

    task "Estrutura" {
        depends "Fundação"
        effort 15d
    }
}
```

O objetivo inicial não será suportar imediatamente toda a gramática do TaskJuggler.

A implementação deverá evoluir progressivamente.

---

## Estratégia de compatibilidade com TaskJuggler

O TaskJuggler será utilizado como:

* referência conceitual;
* referência de sintaxe;
* referência de comportamento;
* fonte de exemplos;
* fonte para testes de compatibilidade.

Não será feita uma simples tradução mecânica:

```text
Ruby → TypeScript
```

A abordagem será:

```text
TaskJuggler
     │
     ├── documentação
     ├── exemplos
     ├── comportamento
     └── código-fonte
             │
             ▼
      Especificação
             │
             ▼
       SyntaxMesh
```

````

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

## Arquivo: `docs/syntaxmesh/08-mvp.md`

````md
# MVP

O primeiro MVP deverá ser pequeno.

Objetivo:

```text
arquivo .tjp
      ↓
parser
      ↓
AST
      ↓
Core
      ↓
scheduler
      ↓
Gantt
```

Exemplo mínimo:

```tjp
language "en"

project "Minha Obra" {

    task "Fundação" {
        effort 10d
    }

    task "Estrutura" {
        depends "Fundação"
        effort 15d
    }
}
```

O sistema deverá:

1. ler o arquivo;
2. reconhecer português;
3. construir AST;
4. criar tarefas;
5. resolver dependência;
6. calcular datas;
7. gerar relatório;
8. gerar Gantt.

Depois disso, adicionar poutuguês brasileiro e opcionalmente espanhol.

---
````

---

## Arquivo: `docs/syntaxmesh/09-regras-para-ia.md`

```md
# Regras para IA

- Implementar uma tarefa pequena por vez.
- Não implementar várias tarefas simultaneamente.
- Não introduzir Node.js.
- Não introduzir npm.
- Não modificar arquivos fora do escopo da tarefa, exceto se encontrou BUG que deve ser listado para corrigir dentro da tarefa competente anterior
- Core não pode importar DOM.
- Parser não pode conter lógica de UI.
- Storage não pode contaminar Core.
- Idioma não pode contaminar Core.
- Toda funcionalidade nova precisa de teste.
- Decisões arquitetônicas relevantes devem ser registradas em `docs/syntaxmesh/decisoes/` como ADR (Architecture Decision Record).
```

---

## Arquivo: `docs/syntaxmesh/10-futuro.md`

````md
# Visão futura

O SyntaxMesh deverá evoluir para uma plataforma capaz de:

```text
              SyntaxMesh
                   │
       ┌───────────┼───────────┐
       │           │           │
       ▼           ▼           ▼
   Parser        Core       Reports
       │           │           │
       └───────────┼───────────┘
                   │
             Project Model
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
     Gantt      Dashboard    Export
```

Com possibilidade futura de:

* novos idiomas;
* tradução de arquivos;
* múltiplos calendários;
* cenários;
* planejamento de recursos;
* custos;
* receitas;
* análise financeira;
* dashboards;
* colaboração através de arquivos;
* integração com outros formatos;
* plugins;
* extensões da linguagem;
* grandes projetos;
* processamento em Web Worker.

---

# Filosofia do SyntaxMesh

O projeto deverá seguir quatro princípios:

## Simplicidade

Começar pequeno e crescer progressivamente.

## Independência

O motor não depende da interface ou de um servidor.

## Compatibilidade

Utilizar o TaskJuggler como referência de comportamento, sem ficar preso à implementação Ruby.

## Extensibilidade

A arquitetura deverá permitir que novas linguagens, relatórios e funcionalidades sejam adicionados sem modificar o Core.

---
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

## Arquivo: `docs/syntaxmesh/decisoes/README.md`

````md
# Decisões Arquitetônicas (ADR)

Este diretório armazena **Architecture Decision Records (ADRs)** — decisões técnicas importantes que afetam a arquitetura, design ou processo do SyntaxMesh.

## Quando criar um ADR

Crie um ADR quando a decisão:

- Afeta múltiplos pacotes ou camadas (Core, Parser, Report, Storage, UI)
- Envolve trade-offs não triviais (performance vs. simplicidade, compatibilidade vs. inovação)
- Define convenções que outros desenvolvedores devem seguir
- Resolve um bug difícil ou comportamento inesperado
- Introduz ou remove uma dependência significativa
- Altera o formato de dados, API pública ou contrato entre módulos

## Formato do arquivo

Nome: `NNN-titulo-kebab-case.md` (ex: `001-core-independente-do-dom.md`)

Estrutura:

```markdown
# Título da Decisão

## Contexto

Qual o problema ou oportunidade que motivou esta decisão?
Quais foram as alternativas consideradas?

## Decisão

O que foi decidido? Seja específico e acionável.

## Consequências

### Positivas
- Benefício 1
- Benefício 2

### Negativas / Riscos
- Custo/Trade-off 1
- Mitigação planejada

### Neutras / Observações
- Detalhe de implementação
- Referência a issues, PRs ou discussões relacionadas

---

**Status:** Aceito / Proposto / Obsoleto / Substituído por NNN
**Data:** YYYY-MM-DD
**Autor(es):** Nome(s)
```

## Lista de ADRs

| ID | Título | Status | Data |
|---|---|---|---|
| 001 | Core independente de DOM e Storage | Aceito | 2026-09-08 |
| 002 | Parser isolado da lógica de UI | Aceito | 2026-09-08 |
| 003 | Storage não contamina Core | Aceito | 2026-09-08 |
| 004 | Idioma não contamina Core (AST canônica) | Aceito | 2026-09-08 |
| 005 | Stack: TypeScript + Deno + Browser only | Aceito | 2026-09-08 |
| 006 | Build pipeline: deno task build / dev / export / taskjuggler | Aceito | 2026-09-08 |
| 007 | Workspace Deno com packages independentes | Aceito | 2026-09-08 |
| 008 | Biblioteca de testes: `@std/testing/bdd` padrão | Aceito | 2026-09-08 |

> **Nota:** Manter esta tabela atualizada manualmente ou via script ao adicionar novos ADRs.
````

---

## Arquivo: `docs/syntaxmesh/decisoes/001-core-independente-do-dom.md`

````md
# 001 — Core independente de DOM e Storage

## Contexto

O SyntaxMesh deve ser executado em múltiplos ambientes: navegador, Web Worker, Deno e testes automatizados. O Core contém o modelo de domínio e o scheduler — a lógica mais crítica e reutilizável do projeto.

Se o Core depender de `window`, `document`, IndexedDB, OPFS ou bibliotecas de UI (Preact, BeerCSS), ele **não poderá ser importado diretamente no Deno** para testes, nem executado em Web Workers.

**Alternativas consideradas:**

- A) Permitir importações leves de DOM no Core (ex: `window` para detecção de ambiente)
- B) Isolar totalmente o Core, injetando dependências via interfaces

## Decisão

Adotado a alternativa **B**: **o Core não importa nada de DOM, Preact, BeerCSS, IndexedDB, OPFS ou `idb-keyval`.**

```ts
// NÃO permitido em packages/core/src/
import ... from "preact";
import ... from "beercss";
import ... from "idb-keyval";
document; window; navigator; localStorage; indexedDB;
```

Se o Core precisar de funcionalidades de ambiente (ex: leitura de arquivos), deve-se:
- Definir uma interface (ex: `FileSystemPort`)
- Ter a implementação fornecida pelo *caller* (Storage, UI, Worker)

## Consequências

### Positivas
- Core é executável diretamente no Deno: `import { ... } from "./src/core/..."`
- Testes de Core rodam sem mocks de DOM
- Core pode rodar em Web Workers sem importações condicionais
- Storage e UI podem evoluir independentemente

### Negativas / Riscos
- Interfaces de infraestrutura precisam ser definidas cuidadosamente
- Maior verbosidade em pontos de integração (injeção de dependências)

### Observações
- Documentado em `docs/syntaxmesh/03-arquitetura.md` (seção *Regra arquitetural mais importante*)
- Reforçado por `docs/syntaxmesh/09-regras-para-ia.md`: "Core não pode importar DOM."

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
````

---

## Arquivo: `docs/syntaxmesh/decisoes/002-parser-isolado-da-logica-de-ui.md`

```md
# 002 — Parser isolado da lógica de UI

## Contexto

O Parser transforma texto `.tjp` em AST e depois em Core Model. Ele precisa de cobertura total de testes e potencialmente em execução em Web Workers. Se o Parser conhecer Preact, BeerCSS, DOM ou Signals, ele:

- Não será testado sem mocks de UI
- Não será movido para Web Workers sem refatoração
- Criará acoplamento artificial com a camada de apresentação

**Alternativas consideradas:**

- A) Permitir que o Parser retorne componentes Preact diretamente
- B) Parser produz apenas AST/Core Model; UI consome via *service*

## Decisão

Adotado a alternativa **B**: **o Parser não contém lógica de UI.** Ele produz apenas:

1. **AST** (estrutura de nós com localização de origem)
2. **Core Model** (tipos do `@syntaxmesh/core`)
3. **Diagnostics** (lista de erros com localização)

A UI consome o Parser via `@syntaxmesh/parser-service`, que atua como adaptador entre o Parser e os Signals/Preact.

## Consequências

### Positivas
- Parser é testável 100% no Deno
- Parser pode rodar em Web Worker sem mudanças
- UI pode trocar de framework sem tocar o Parser
- Mensagens de erro são formatadas pela UI, não pelo Parser

### Negativas / Riscos
- A camada de serviço (`parser-service`) precisa ser mantida como adaptador
- Ajustes de UX (ex: realce de sintaxe) exigem mapeamento AST → posição no texto

### Observações
- Documentado em `docs/syntaxmesh/09-regras-para-ia.md`: "Parser não pode conter lógica de UI."
- A arquitetura proposta em `docs/syntaxmesh/03-arquitetura.md` já contempla `parser-service.ts` em `packages/ui/src/services/`

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
```

---

## Arquivo: `docs/syntaxmesh/decisoes/003-storage-nao-contamina-core.md`

````md
# 003 — Storage não contamina Core

## Contexto

A camada de Storage (@syntaxmesh/storage / @syntaxmesh/worker-db) lida com IndexedDB, OPFS e arquivos. O Core (@syntaxmesh/core) é puro e sem dependências de infraestrutura.

Se o Core importar diretamente `idb-keyval` ou APIs de OPFS:

- Core se torna acoplado a storage
- Testes do Core exigem IndexedDB mockado
- Core não roda em Deno sem polyfills

**Alternativas consideradas:**

- A) Deixar Core usar IndexedDB diretamente para persistência de cálculos
- B) Manter Storage totalmente separado; Core é sempre in-memory

## Decisão

Adotado a alternativa **B**: **Storage não contamina Core.** O fluxo de dados é:

```
Browser
   │
Storage  ←→  Core Model  ←→  Scheduler
   │                    ↑
   └────────────────────┘
         (apenas dados, nunca importações)
```

- **Core** produz apenas modelos em memória
- **Storage** persiste projetos, autosave e arquivos via `@syntaxmesh/worker-db`
- Core **nunca** importa `idb-keyval`, `OPFS`, `localStorage` etc.

## Consequências

### Positivas
- Core mantém dependências mínimas (zero)
- Storage pode migrar de IndexedDB para OPFS sem tocar Core
- Testes de Core são puros e rápidos
- Web Worker pode conter apenas Core + Parser (sem Storage)

### Negativas / Riscos
- Projetos grandes precisam de estratégia de memória (Core carrega tudo na RAM)
- Autosave exige cópia de dados entre Worker e main thread

### Observações
- Documentado em `docs/syntaxmesh/09-regras-para-ia.md`: "Storage não pode contaminar Core."
- `docs/syntaxmesh/03-arquitetura.md` recomenda wrapper `worker-db-client.ts` para isolar a API da biblioteca

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
````

---

## Arquivo: `docs/syntaxmesh/decisoes/004-idioma-nao-contamina-core.md`

````md
# 004 — Idioma não contamina Core (AST canônica)

## Contexto

O SyntaxMesh suporta multilíngue (English, Português-BR, Español). O Core precisa de uma representação única para que o scheduler, relatórios e validações funcionem independentemente do idioma do arquivo `.tjp`.

Se o Core tivesse que conhecer palavras em vários idiomas:

- Cada módulo (Core, Report, UI) precisaria de dicionários
- Adicionar um novo idioma exigiu mudanças em Core
- Testes precisariam cobrir todas as variantes de idioma

**Alternativas consideradas:**

- A) Core conhece todas as palavras-chave em todos os idiomas
- B) Parser traduz tudo para uma AST canônica; Core nunca vê idiomas

## Decisão

Adotado a alternativa **B**: **Idioma não contamina Core.** O fluxo é:

```
                 SyntaxMesh
                     │
              ┌──────▼──────┐
              │ Language    │
              │ Dictionary  │
              └──────┬──────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
     English     Português      Outros
        │            │            │
        └────────────┼────────────┘
                     ▼
                  Lexer
                     │
                     ▼
                  Parser
                     │
                     ▼
                    AST canônica
                     │  (idioma transparente)
                     ▼
                   Core
```

- O Parser, com a ajuda do `LanguageRegistry`, converte palavras-chave do idioma do arquivo para **canonical keywords** (ex: `tarefa` → `task`)
- A AST resultante usa apenas strings canônicas
- O Core nunca importa ni sabe de `en.ts`, `pt-BR.ts` ou `es.ts`

## Consequências

### Positivas
- Adicionar um novo idioma: apenas novo arquivo em `packages/language/src/` + registro
- Core, Report e testes são 100% independentes de idioma
- AST comparison entre idiomas (ex: inglês vs português produzem a mesma AST)
- UI seleciona idioma do projeto separadamente do idioma da interface

### Negativas / Riscos
- Parser precisa de dicionário completo e bem testado
- Tradução reversa (.tjp → linguagem-alvo) requer mapeamento adicional (não exigido no MVP)

### Observações
- Documentado em `docs/syntaxmesh/04-linguagem-multilingue.md` (seção *Representação canônica*)
- Documentado em `docs/syntaxmesh/09-regras-para-ia.md`: "Idioma não pode contaminar Core."

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
````

---

## Arquivo: `docs/syntaxmesh/decisoes/005-typescript-deno-browser-only.md`

```md
# 005 — Stack: TypeScript + Deno + Browser only

## Contexto

O SyntaxMesh precisa de uma stack unificada para desenvolvimento, testes e build. A escolha da stack afeta todo o ecossistema: package.json, node_modules, CI e dependências.

**Alternativas consideradas:**

- A) Node.js + npm + TypeScript (ecossistema Node)
- B) Deno + TypeScript + Web APIs (sem package.json)

## Decisão

Adotado a alternativa **B**: **TypeScript + Deno apenas. Browser only. Nada de Node.js.**

- **Linguagem:** TypeScript (todos os arquivos `.ts` / `.tsx`)
- **Runtime:** Deno (desenvolvimento, testes, lint, format, build)
- **Target:** Browser nativo (PWA, Web APIs, Web Workers)
- **UI:** Preact + Signals + BeerCSS
- **Storage:** IndexedDB (`idb-keyval`) + OPFS `@syntaxmesh/worker-db`

Proibido usar: Node.js, npm, yarn, pnpm, package.json, node_modules.

Deno é utilizado como:
- ambiente de desenvolvimento
- executor TypeScript
- executor de testes (`deno test`)
- lint (`deno lint`)
- formatter (`deno fmt`)
- tarefas de build (`build.ts`, `esbuild.ts`)

## Consequências

### Positivas
- Zero configuração de package.json / node_modules
- Single tooling (`deno.json` configura tudo)
- TypeScript nativo no Deno (sem `tsc` separado)
- Bundle do browser via esbuild integrado
- Coerência total entre desenvolvimento e produção

### Negativas / Riscos
- Dependências externas precisam ser importadas via URL (ex: `esm.sh`, `npm:`)
- Alguns pacotes podem exigir workarounds para funcionar no Deno
- Ecossistema mais enxuto que npm (menos pacotes prontos)

### Observações
- Documentado em `docs/syntaxmesh/02-principios.md` (seção *TypeScript + Deno*)
- Documentado em `docs/syntaxmesh/00-index.md` (Regras globais)

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
```

---

## Arquivo: `docs/syntaxmesh/decisoes/006-build-pipeline-deno-tasks.md`

````md
# 006 — Build pipeline: deno task build / dev / export / taskjuggler

## Contexto

O projeto usa um arquivo de configuração Deno (`deno.jsonc`) como ponto único de configuração para todas as tarefas de automação. Não há `package.json`, `npm scripts` ou `Makefile`.

As tasks principais expostas são:

| Task | Comando | Descrição |
|------|---------|-----------|
| `build` | `deno run -A ./esbuild.ts` | Bundle da UI + Service Worker para produção (usa esbuild) |
| `dev` | `deno task --cwd packages/server dev` | Inicia servidor de desenvolvimento (em `packages/server`) |
| `export` | `deno run --allow-read --allow-write ./export.ts` | Gera snapshot do código fonte para distribuição/inspeção |
| `taskjuggler` | `tj3 --no-color ` | Executa o TaskJuggler original (binário Ruby `tj3`) |

## Decisão

Centralizar todas as tarefas de build, dev, export e ferramentas de referência no `deno.jsonc` sob a seção `"tasks"`.

```jsonc
"tasks": {
  "test": "deno test --allow-env --allow-net tests/",
  "check": "deno check build.ts esbuild.ts export.ts tests/**/*.ts",
  "tests": "deno task check && deno task test",
  "dev": "deno task --cwd packages/server dev",
  "start": "deno task --cwd packages/server start",
  "export": "deno run --allow-read --allow-write ./export.ts",
  "build": "deno run -A ./esbuild.ts",
  "build:deno": "deno run --unstable-bundle -A ./build.ts",
  "taskjuggler": "tj3 --no-color "
}
```

**Regras de uso:**

- Sempre invocar com `--config ~/github/syntaxmesh/deno.jsonc` quando fora do diretório do projeto
- Dentro do projeto (`~/github/syntaxmesh`), apenas `deno task <nome>`
- Tasks que precisam de permissões usam `-A` (todas) ou flags específicas (`--allow-read --allow-write`)

## Consequências

### Positivas
- Um único arquivo configura tudo (tasks, imports, compilerOptions, workspace)
- TypeScript nativo no Deno — sem `tsc` separado
- Tasks declarativas, versionadas e reproduzíveis
- `taskjuggler` task permite comparar comportamento com a implementação original

### Negativas / Riscos
- `tj3` (Ruby gem) deve estar instalado no sistema host
- `build:deno` usa `--unstable-bundle` (API experimental)
- Workspace Deno (`deno.jsonc` raiz) exige estrutura de packages compatível

### Observações
- `esbuild.ts` usa `@deno/esbuild-plugin` para bundling da UI (Preact + Signals + BeerCSS)
- `export.ts` gera snapshots do código fonte (útil para IA, documentação, auditoria)
- `packages/server` contém o servidor de desenvolvimento estático (PWA)

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
````

---

## Arquivo: `docs/syntaxmesh/decisoes/007-workspace-deno-packages.md`

````md
# 007 — Workspace Deno com packages independentes

## Contexto

O projeto é um monorepo Deno com múltiplos packages internos que precisam ser importados uns pelos outros. O `deno.jsonc` raiz define o workspace e as dependências compartilhadas.

## Decisão

Configurar `"workspace"` no `deno.jsonc` raiz apontando para cada package:

```jsonc
"workspace": [
  "./packages/worker-db",
  "./packages/server",
  "./packages/ui",
  "./packages/utils",
  "./packages/service-worker"
]
```

Cada package tem seu próprio `deno.jsonc` (ou `deno.json`) com `"name"` e `"exports"` próprios.

O `deno.jsonc` raiz também define:
- `"catalog"` para versões compartilhadas (ex: `esbuild`, `wrangler`)
- `"imports"` para dependências externas comuns (`@std/fs`, `@std/path`, `esbuild`)
- `"compilerOptions"` globais (strict, jsx: react-jsx para Preact)

## Consequências

### Positivas
- Packages podem importar uns aos outros via nomes lógicos (`@syntaxmesh/core`, `@syntaxmesh/parser`, etc.)
- Versões de dependências externas centralizadas no catálogo
- Type checking unificado com `deno check` na raiz
- Publicação independente de cada package para JSR/npm futura

### Negativas / Riscos
- Estrutura de diretórios fixa (packages/ como filhos diretos)
- Mudança de workspace exige atualização no root `deno.jsonc`
- `nodeModulesDir: "auto"` e `vendor: true` geram pasta `vendor/` no root

### Observações
- Package `@vanaware/syntaxmesh` (raiz) exporta `./esbuild.ts` como entry point
- `@syntaxmesh/worker-db` isola IndexedDB/OPFS via Web Worker
- `@syntaxmesh/ui` contém a aplicação Preact + Signals + BeerCSS

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
````

---

## Arquivo: `docs/syntaxmesh/decisoes/008-biblioteca-de-testes-std-testing-bdd-padrao.md`

````md
# 008 — Biblioteca de testes padrão: `@std/testing/bdd`

## Contexto

O projeto possui múltiplos pacotes (`@syntaxmesh/core`, `@syntaxmesh/parser`, `@syntaxmesh/utils`, `@syntaxmesh/worker-db`, `@syntaxmesh/ui`, etc.) e cada um tinha um padrão de testes diferente:

- `packages/worker-db/tests/` → `Deno.test({ name, fn })` direto + `@std/assert`
- `packages/utils/tests/esbuild/` → `describe`/`it` de `@std/testing/bdd` + `@std/assert`

Esta inconsistência dificulta:

- Aprendizado de novos desenvolvedores
- Reuso de helpers e fixtures entre pacotes
- Manutenção de testes de forma consistente
- Integração com ferramentas de cobertura (ex: cobertura por teste)

**Alternativas consideradas:**

- A) Manter dois estilos (Deno.test direto e BDD) conforme o pacote
- B) Adotar `Deno.test()` direto como padrão em todos os pacotes
- C) Adotar `describe`/`it` de `@std/testing/bdd` como padrão em todos os pacotes

## Decisão

Adotado a alternativa **C**: **`@std/testing/bdd` é o padrão para todos os testes do projeto.**

Novos testes devem usar:

```ts
import { describe, it } from "@std/testing/bdd";
import { assertEquals, assert, assertNotEquals } from "@std/assert";

describe("myFeature", () => {
  it("deve fazer algo", () => {
    assertEquals(actual, expected);
  });
});
```

**Regras:**

- Todo teste novo usa `describe`/`it`
- Todo teste novo usa `@std/assert` para assertions
- `Deno.test()` direto é permitido apenas para migração gradual de pacotes antigos
- Não se deve misturar `Deno.test()` direto e `describe`/`it` no mesmo arquivo
- Helpers e fixtures devem ser escritos para funcionar com o padrão BDD

## Consequências

### Positivas
- Um único padrão para todos os pacotes
- Testes mais organizados por funcionalidade
- Melhor documentação automática (nomes dos testes)
- Facilita migração futura de pacotes antigos
- Alinha com convenções comuns de JavaScript/TypeScript

### Negativas / Riscos
- `packages/worker-db/tests/` ainda usam `Deno.test()` direto (migração gradual)
- `describe`/`it` adiciona uma camada extra de abstração
- Algumas pessoas preferem `Deno.test()` direto por ser mais simples

### Observações
- Documentado em `docs/syntaxmesh/06-testes-e-processo.md` (seção *Convenção de biblioteca de testes*)
- O padrão já está presente em `packages/utils/tests/esbuild/` e `packages/utils/tests/export/`

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
````

---

## Arquivo: `README.md`

````md
# SyntaxMesh

## Offline Multilingual Project Planning Engine

**Versão do documento:** 1.0
**Status:** Especificação-base para desenvolvimento
**Tecnologia principal:** TypeScript + Deno + Web APIs
**Execução:** 100% offline no navegador
**Modelo:** PWA / Static Web Application

---

# 1. Visão do projeto

O **SyntaxMesh** é um motor de planejamento e gerenciamento de projetos inspirado nos conceitos e na linguagem do TaskJuggler, porém desenvolvido do zero em **TypeScript**, com execução no navegador e sem necessidade de servidor de aplicação.

O sistema deverá ser capaz de:

* interpretar arquivos de planejamento;
* calcular cronogramas;
* resolver dependências;
* trabalhar com recursos;
* calcular esforço, duração e custos;
* gerar relatórios;
* gerar gráficos de Gantt;
* trabalhar offline;
* armazenar projetos localmente;
* funcionar como PWA;
* permitir edição de arquivos de projeto;
* utilizar IndexedDB e OPFS;
* funcionar em hospedagem estática;
* oferecer uma linguagem de projeto multilíngue.

O objetivo não é simplesmente converter o código Ruby do TaskJuggler para TypeScript.

O objetivo é criar uma **implementação independente**, compatível conceitualmente com o modelo de planejamento do TaskJuggler, utilizando seu comportamento, documentação e exemplos como referência.

---

# 2. Princípios fundamentais

O desenvolvimento deverá obedecer às seguintes regras.

## 2.1 TypeScript + Deno

O projeto será desenvolvido exclusivamente com:

* TypeScript;
* Deno;
* Web APIs;
* HTML;
* CSS;
* Preact;
* Signals;
* BeerCSS.

Não utilizar:

* Node.js;
* npm;
* yarn;
* pnpm;
* package.json;
* node_modules;
* dependências que exijam Node para execução.

O Deno será utilizado como:

* ambiente de desenvolvimento;
* executor TypeScript;
* executor de testes;
* lint;
* formatter;
* tarefas de build;
* ferramentas auxiliares.

---

# 3. Execução offline

O SyntaxMesh deverá funcionar completamente sem servidor de aplicação.

Arquitetura:

```text
                  Navegador
                     │
              ┌──────▼──────┐
              │ SyntaxMesh  │
              │    PWA      │
              └──────┬──────┘
                     │
       ┌─────────────┼─────────────┐
       │             │             │
       ▼             ▼             ▼
   IndexedDB       OPFS        Cache API
       │             │             │
       └─────────────┼─────────────┘
                     │
                  Offline
```

O servidor de hospedagem terá apenas a função de entregar arquivos estáticos.

Não deverá existir:

```text
Browser → Application Server → Database
```

A arquitetura desejada é:

```text
Browser
   │
   ├── Application
   ├── Core
   ├── Parser
   ├── Reports
   ├── IndexedDB
   ├── OPFS
   └── Service Worker
```

---

# 4. Arquitetura geral

A arquitetura principal será:

```text
SyntaxMesh
│
├── core
├── parser
├── report
├── storage
└── app
```

## 4.1 Core

Responsável pelo modelo e processamento do planejamento.

Não poderá depender de:

* Preact;
* BeerCSS;
* DOM;
* window;
* document;
* IndexedDB;
* OPFS;
* Service Worker.

O Core deverá ser executável em:

* navegador;
* Web Worker;
* Deno;
* testes automatizados.

---

## 4.2 Parser

Responsável por:

* lexer;
* tokens;
* gramática;
* AST;
* análise semântica;
* validação;
* linguagem;
* tradução de palavras-chave para uma representação canônica.

---

## 4.3 Report

Responsável por:

* modelo de relatório;
* filtros;
* colunas;
* agrupamentos;
* Gantt;
* HTML;
* CSV;
* JSON;
* futuras formas de exportação.

---

## 4.4 Storage

Responsável por persistência local:

* IndexedDB;
* OPFS;
* arquivos;
* projetos;
* configurações;
* importação;
* exportação.

---

## 4.5 App

Responsável pela interface.

Tecnologias:

* Preact;
* Signals;
* BeerCSS;
* Web APIs.

---

# 5. Estrutura de diretórios

Estrutura inicial proposta:

```text
syntaxmesh/
│
├── deno.json
├── README.md
├── LICENSE
│
├── src/
│   │
│   ├── core/
│   │   ├── model/
│   │   ├── calendar/
│   │   ├── scheduling/
│   │   ├── accounting/
│   │   ├── resources/
│   │   ├── scenarios/
│   │   ├── expressions/
│   │   └── validation/
│   │
│   ├── parser/
│   │   ├── lexer/
│   │   ├── grammar/
│   │   ├── ast/
│   │   ├── parser/
│   │   ├── semantic/
│   │   └── language/
│   │       ├── language.ts
│   │       ├── english.ts
│   │       ├── portuguese-br.ts
│   │       └── spanish.ts
│   │
│   ├── report/
│   │   ├── model/
│   │   ├── filters/
│   │   ├── columns/
│   │   ├── gantt/
│   │   ├── html/
│   │   ├── csv/
│   │   └── json/
│   │
│   ├── storage/
│   │   ├── indexeddb/
│   │   ├── opfs/
│   │   └── projects/
│   │
│   └── app/
│       ├── components/
│       ├── signals/
│       ├── views/
│       ├── workers/
│       └── main.tsx
│
├── tests/
│   ├── core/
│   ├── parser/
│   ├── report/
│   ├── storage/
│   └── integration/
│
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
│
└── examples/
    ├── minimal.tjp
    └── tutorial.tjp
```

---

# 6. Sintaxe multilíngue

Uma das características fundamentais do SyntaxMesh será permitir que a linguagem dos arquivos de projeto seja escolhida pelo usuário.

Inicialmente serão previstas:

* English;
* Português do Brasil;
* Español.

A arquitetura deverá permitir adicionar outros idiomas futuramente.

---

# 7. Idioma do projeto x idioma da interface

Esses dois conceitos devem permanecer separados.

```text
Project Language != Application UI Language
```

Por exemplo:

Um usuário pode utilizar a interface em português e abrir um projeto escrito em inglês:

```text
UI: Português
Projeto: English
```

Ou:

```text
UI: English
Projeto: Português
```

O idioma da interface não deverá alterar automaticamente o idioma do arquivo de projeto.

---

# 8. Arquitetura da linguagem

O fluxo será:

```text
                 SyntaxMesh
                     │
              ┌──────▼──────┐
              │ Language    │
              │ Dictionary  │
              └──────┬──────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
     English     Português      Español
        │            │            │
        └────────────┼────────────┘
                     ▼
                  Lexer
                     │
                     ▼
                  Parser
                     │
                     ▼
                    AST
                     │
                     ▼
                   Core
```

O Core não deverá conhecer idiomas.

---

# 9. Representação canônica

Os idiomas serão convertidos para uma representação interna única.

Por exemplo:

```text
task
tarefa
tarea
```

deverão resultar no mesmo conceito:

```ts
{
    type: "Task"
}
```

Da mesma forma:

```text
project
projeto
proyecto
```

deverão produzir:

```ts
{
    type: "Project"
}
```

Isso evita que o Core tenha que conhecer cada idioma.

---

# 10. LanguageDefinition

A arquitetura deverá possuir uma definição semelhante a:

```ts
interface LanguageDefinition {
    id: string;
    name: string;

    keywords: Record<string, string[]>;

    units: Record<string, string[]>;
}
```

Exemplo:

```ts
const english: LanguageDefinition = {
    id: "en",
    name: "English",

    keywords: {
        project: ["project"],
        task: ["task"],
        resource: ["resource"],
        depends: ["depends"],
        effort: ["effort"],
        duration: ["duration"],
        report: ["report"]
    },

    units: {
        day: ["d", "day", "days"],
        hour: ["h", "hour", "hours"]
    }
};
```

Português:

```ts
const portugueseBR: LanguageDefinition = {
    id: "pt-BR",
    name: "Português (Brasil)",

    keywords: {
        project: ["projeto"],
        task: ["tarefa"],
        resource: ["recurso"],
        depends: ["depende"],
        effort: ["esforço"],
        duration: ["duração"],
        report: ["relatório"]
    },

    units: {
        day: ["d", "dia", "dias"],
        hour: ["h", "hora", "horas"]
    }
};
```

A implementação real deverá ser refinada durante a fase do parser.

---

# 11. Declaração do idioma no arquivo

A linguagem poderá ser explicitamente definida:

```tjp
language "pt-BR"

projeto "Minha Obra" {
    tarefa "Fundação" {
        esforço 10d
    }
}
```

Em inglês:

```tjp
language "en"

project "My Project" {
    task "Foundation" {
        effort 10d
    }
}
```

A diretiva `language` deverá ser tratada pelo parser antes da interpretação das demais palavras-chave.

---

# 12. Compatibilidade e tradução

O projeto deverá considerar futuramente a possibilidade de traduzir:

```text
Português → English
English → Português
English → Español
```

Entretanto, isso não será requisito obrigatório da primeira versão do parser.

A prioridade inicial será:

```text
English
      ↓
Canonical AST
      ↑
Português
      ↑
Español
```

---

# 13. Arquivos inicialmente suportados

O formato principal será inspirado no `.tjp`.

Exemplo:

```tjp
project "Minha Obra" {

    task "Fundação" {
        effort 10d
    }

    task "Estrutura" {
        depends "Fundação"
        effort 15d
    }
}
```

O objetivo inicial não será suportar imediatamente toda a gramática do TaskJuggler.

A implementação deverá evoluir progressivamente.

---

# 14. Estratégia de compatibilidade com TaskJuggler

O TaskJuggler será utilizado como:

* referência conceitual;
* referência de sintaxe;
* referência de comportamento;
* fonte de exemplos;
* fonte para testes de compatibilidade.

Não será feita uma simples tradução mecânica:

```text
Ruby → TypeScript
```

A abordagem será:

```text
TaskJuggler
     │
     ├── documentação
     ├── exemplos
     ├── comportamento
     └── código-fonte
             │
             ▼
      Especificação
             │
             ▼
       SyntaxMesh
```

---

# 15. Estratégia de testes

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
deno test
deno lint
deno fmt --check
```

Durante desenvolvimento:

```bash
deno fmt
deno lint
deno test
```

---

# 16. Regra de desenvolvimento incremental

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

# 17. Plano geral

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

---

# FASE 1 — FUNDAÇÃO

## Objetivo

Criar a base técnica do projeto.

### TODO 1.1 — Criar projeto Deno

Criar:

```text
deno.json
```

Configurar:

* TypeScript;
* imports;
* tasks;
* lint;
* formatter;
* testes.

### Testes

Verificar que:

```bash
deno test
deno lint
deno fmt --check
```

funcionam em um projeto vazio.

---

## TODO 1.2 — Estrutura de diretórios

Criar:

```text
src/
tests/
examples/
public/
```

e os módulos:

```text
core/
parser/
report/
storage/
app/
```

### Teste

Criar pelo menos um teste de sanidade.

---

## TODO 1.3 — Core independente

Criar um primeiro módulo do Core.

Exemplo:

```ts
export interface Project {
    name: string;
}
```

### Teste

Criar projeto em memória e verificar seus dados.

---

## TODO 1.4 — Pipeline de qualidade

Configurar:

* formatter;
* lint;
* test;
* tasks Deno.

### Critério

Nenhum warning ou erro.

---

## TODO 1.5 — Documentação inicial

Criar:

```text
README.md
LICENSE
```

Documentar:

* objetivo;
* arquitetura;
* instalação;
* execução;
* testes;
* princípios do projeto.

---

# FASE 2 — CORE

## Objetivo

Construir o motor de planejamento sem interface.

---

## TODO 2.1 — Modelo de projeto

Criar entidades:

```text
Project
Task
Resource
Account
Scenario
Calendar
```

Testar criação e validação.

---

## TODO 2.2 — Hierarquia de tarefas

Suportar:

```text
Project
 ├── Task A
 ├── Task B
 │    ├── Task B1
 │    └── Task B2
 └── Task C
```

Testar:

* pai;
* filho;
* profundidade;
* identificação;
* caminho.

---

## TODO 2.3 — Duração

Implementar:

* horas;
* dias;
* semanas;
* meses, quando aplicável;
* duração zero;
* duração inválida.

Criar testes de conversão.

---

## TODO 2.4 — Esforço

Implementar:

```text
effort
```

e sua representação interna.

Testar:

```text
10h
1d
5d
```

---

## TODO 2.5 — Calendários

Implementar:

* dias úteis;
* finais de semana;
* feriados;
* horários de trabalho;
* calendário padrão;
* calendários personalizados.

Testar cálculo de datas.

---

## TODO 2.6 — Dependências

Implementar relações entre tarefas.

Inicialmente:

```text
A → B
```

onde B depende de A.

Posteriormente:

* finish-to-start;
* start-to-start;
* finish-to-finish;
* start-to-finish, se necessário.

Testar todos os tipos suportados.

---

## TODO 2.7 — Scheduler

Criar o primeiro algoritmo de agendamento.

Entrada:

```text
tasks
dependencies
calendar
effort/duration
```

Saída:

```text
start
end
```

Testar cronogramas simples.

---

## TODO 2.8 — Detecção de ciclos

Detectar:

```text
A → B
B → C
C → A
```

Retornar erro sem entrar em loop infinito.

---

## TODO 2.9 — Recursos

Criar:

```text
Resource
ResourceAssignment
```

Implementar:

* disponibilidade;
* capacidade;
* alocação;
* conflitos básicos.

---

## TODO 2.10 — Custos

Implementar:

* custo por recurso;
* custo da tarefa;
* custo acumulado;
* custo do projeto.

---

## TODO 2.11 — Receitas

Preparar suporte para:

* revenue;
* custo;
* lucro;
* margem.

---

## TODO 2.12 — Restrições

Criar modelo para:

* início mínimo;
* término máximo;
* datas fixas;
* deadlines;
* restrições de calendário.

---

## TODO 2.13 — Cenários

Criar estrutura para cenários:

```text
Base
Optimistic
Pessimistic
```

ou equivalente.

O modelo deverá permitir futuramente comparar cronogramas.

---

## TODO 2.14 — Expressões

Criar infraestrutura para expressões utilizadas pelo formato.

Exemplo conceitual:

```text
cost * 1.1
```

Não é necessário implementar toda a linguagem de expressões nesta tarefa.

---

## TODO 2.15 — Validação

Criar sistema centralizado de erros:

```ts
ValidationError
SchedulingError
DependencyError
ResourceError
```

---

## TODO 2.16 — Testes do Core

Criar uma suíte ampla cobrindo:

* projetos;
* tarefas;
* hierarquia;
* calendário;
* duração;
* esforço;
* dependências;
* scheduler;
* recursos;
* custos;
* restrições;
* cenários;
* expressões.

---

# FASE 3 — PARSER + MULTILINGUAL

## Objetivo

Criar o compilador/interpreter dos arquivos SyntaxMesh.

Pipeline:

```text
Source
  ↓
Lexer
  ↓
Tokens
  ↓
Parser
  ↓
AST
  ↓
Semantic Analysis
  ↓
Core Model
```

---

# TODO 3.1 — Lexer

Criar tokens para:

* identificadores;
* strings;
* números;
* unidades;
* operadores;
* chaves;
* parênteses;
* comentários;
* palavras-chave.

---

# TODO 3.2 — Testes do Lexer

Exemplo:

```text
task "Foundation"
```

deverá produzir tokens previsíveis.

Testar cada categoria.

---

# TODO 3.3 — AST

Criar representação intermediária.

Exemplo:

```ts
interface TaskNode {
    type: "Task";
    name: string;
}
```

---

# TODO 3.4 — Parser mínimo

Implementar:

```tjp
project "Test" {
    task "A"
}
```

Gerar AST.

---

# TODO 3.5 — Parser de esforço

Suportar:

```tjp
effort 10d
```

---

# TODO 3.6 — Parser de dependências

Suportar:

```tjp
depends "A"
```

---

# TODO 3.7 — Análise semântica

Validar:

* tarefas inexistentes;
* dependências inválidas;
* nomes duplicados;
* tipos inválidos;
* recursos inexistentes;
* ciclos.

---

# TODO 3.8 — Sistema de idiomas

Criar:

```text
src/parser/language/
```

com:

```text
language.ts
english.ts
portuguese-br.ts
spanish.ts
```

---

# TODO 3.9 — Registro de idiomas

Criar um registry:

```ts
LanguageRegistry
```

permitindo:

```ts
registry.get("en");
registry.get("pt-BR");
registry.get("es");
```

---

# TODO 3.10 — Keywords canônicas

Definir um vocabulário interno.

Exemplo:

```text
project
task
resource
depends
effort
duration
report
```

Os idiomas deverão mapear para esses conceitos.

---

# TODO 3.11 — Português

Implementar primeira versão:

```text
project → projeto
task → tarefa
resource → recurso
depends → depende
effort → esforço
duration → duração
report → relatório
```

---

# TODO 3.12 — Español

Implementar equivalente em espanhol.

---

# TODO 3.13 — Diretiva language

Implementar:

```tjp
language "pt-BR"
```

e:

```tjp
language "en"
```

---

# TODO 3.14 — Validação de idioma

Detectar:

* idioma inexistente;
* idioma duplicado;
* linguagem incompatível;
* keyword desconhecida.

---

# TODO 3.15 — AST equivalente entre idiomas

Este será um teste fundamental.

Os três arquivos:

```tjp
project "X" {
    task "A"
}
```

```tjp
projeto "X" {
    tarefa "A"
}
```

```tjp
proyecto "X" {
    tarea "A"
}
```

deverão produzir ASTs semanticamente equivalentes.

---

# TODO 3.16 — Testes multilíngues

Criar testes comparando:

```text
English AST
Portuguese AST
Spanish AST
```

e garantir equivalência.

---

# TODO 3.17 — Integração Parser → Core

Converter:

```text
Source
→ AST
→ Core Model
→ Scheduler
```

e testar o resultado completo.

---

# FASE 4 — REPORT

## Objetivo

Criar o sistema de relatórios independente da UI.

---

# TODO 4.1 — Report Model

Criar:

```text
Report
Column
Row
Cell
Filter
Grouping
```

---

# TODO 4.2 — Relatório de tarefas

Mostrar:

* ID;
* nome;
* início;
* término;
* duração;
* esforço;
* custo.

---

# TODO 4.3 — Filtros

Implementar filtros por:

* tarefa;
* recurso;
* período;
* status;
* hierarquia.

---

# TODO 4.4 — Colunas

Permitir definir colunas dinamicamente.

---

# TODO 4.5 — Agrupamento

Suportar agrupamento hierárquico.

---

# TODO 4.6 — Gantt

Criar motor de Gantt.

Inicialmente gerar SVG.

Deverá representar:

* tarefas;
* dependências;
* datas;
* marcos;
* hierarquia.

---

# TODO 4.7 — Exportação JSON

Exportar relatórios em JSON.

---

# TODO 4.8 — Exportação CSV

Exportar dados tabulares em CSV.

---

# TODO 4.9 — HTML

Gerar HTML independente da aplicação.

---

# TODO 4.10 — Testes de reports

Validar:

* conteúdo;
* ordenação;
* filtros;
* colunas;
* Gantt;
* JSON;
* CSV;
* HTML.

---

# FASE 5 — STORAGE

## Objetivo

Implementar persistência totalmente local.

---

# TODO 5.1 — IndexedDB

Criar camada de abstração:

```text
ProjectRepository
```

Não deixar o restante da aplicação depender diretamente da API do IndexedDB.

---

# TODO 5.2 — CRUD de projetos

Implementar:

```text
create
read
update
delete
list
```

---

# TODO 5.3 — OPFS

Utilizar OPFS para arquivos do projeto.

Suportar:

```text
.tjp
```

e arquivos relacionados.

---

# TODO 5.4 — Importação

Permitir importar:

```text
.tjp
```

---

# TODO 5.5 — Exportação

Permitir exportar arquivos.

---

# TODO 5.6 — Autosave

Criar mecanismo de salvamento automático.

---

# TODO 5.7 — Recuperação

Implementar recuperação de projeto após:

* fechamento;
* reload;
* perda de conexão;
* interrupção inesperada.

---

# TODO 5.8 — Testes de storage

Testar:

* CRUD;
* persistência;
* importação;
* exportação;
* recuperação.

---

# FASE 6 — PWA

## Objetivo

Transformar o sistema em aplicação instalável e offline.

---

# TODO 6.1 — Manifest

Criar:

```text
manifest.json
```

Definir:

* nome;
* short_name;
* ícones;
* display;
* start_url;
* theme;
* background.

---

# TODO 6.2 — Service Worker

Criar:

```text
sw.js
```

Implementar cache dos recursos necessários.

---

# TODO 6.3 — Offline

Garantir que depois do primeiro carregamento:

```text
Internet = não necessária
```

---

# TODO 6.4 — Atualização

Criar estratégia para:

* detectar nova versão;
* atualizar cache;
* evitar versões parcialmente misturadas.

---

# TODO 6.5 — Web Worker

Avaliar execução do Core/Scheduler em Worker.

Objetivo:

```text
UI
 │
 ▼
Worker
 │
 ├── Parser
 ├── Core
 └── Scheduler
```

Isso permitirá manter a interface responsiva em projetos grandes.

---

# TODO 6.6 — Testes PWA

Testar:

* instalação;
* carregamento offline;
* cache;
* atualização;
* worker.

---

# FASE 7 — INTERFACE

## Objetivo

Criar a aplicação visual.

Tecnologias:

```text
Preact
Signals
BeerCSS
```

---

# TODO 7.1 — Shell da aplicação

Criar:

* layout;
* navegação;
* área principal;
* barra de ferramentas;
* status.

---

# TODO 7.2 — Project Explorer

Criar árvore:

```text
Projetos
 ├── Projeto A
 ├── Projeto B
 └── Projeto C
```

---

# TODO 7.3 — Editor

Criar editor para arquivos `.tjp`.

---

# TODO 7.4 — Feedback do parser

Mostrar:

* erros;
* warnings;
* linha;
* coluna;
* mensagem.

---

# TODO 7.5 — Signals

Criar estado reativo para:

* projeto atual;
* arquivo atual;
* idioma;
* erros;
* seleção;
* relatório;
* preferências.

---

# TODO 7.6 — Editor + Scheduler

Quando o arquivo for alterado:

```text
Editor
  ↓
Parser
  ↓
Semantic Analysis
  ↓
Core
  ↓
Scheduler
  ↓
Report
```

---

# TODO 7.7 — Gantt visual

Integrar o Gantt SVG ao aplicativo.

---

# TODO 7.8 — Relatórios

Criar interface para:

* selecionar relatório;
* filtros;
* colunas;
* exportação.

---

# TODO 7.9 — Seleção do idioma da interface

Permitir:

```text
Português
English
Español
```

independentemente do idioma do projeto.

---

# TODO 7.10 — Seleção do idioma do projeto

Permitir definir:

```text
English
Português (Brasil)
Español
```

---

# TODO 7.11 — Tema

Seguir inicialmente:

```css
prefers-color-scheme
```

Não criar inicialmente um toggle próprio de tema.

---

# TODO 7.12 — Responsividade

Garantir funcionamento em:

* desktop;
* tablet;
* celular.

---

# FASE 8 — COMPATIBILIDADE E QUALIDADE

## Objetivo

Aproximar o comportamento do SyntaxMesh do modelo do TaskJuggler e preparar uma versão robusta.

---

# TODO 8.1 — Corpus de exemplos

Criar coleção de arquivos de teste.

```text
examples/
tests/fixtures/
```

---

# TODO 8.2 — Testes de compatibilidade

Para cada exemplo:

```text
Input
 ↓
SyntaxMesh
 ↓
AST
 ↓
Schedule
 ↓
Report
```

validar resultados esperados.

---

# TODO 8.3 — Golden tests

Criar arquivos contendo:

```text
input
expected AST
expected schedule
expected report
```

---

# TODO 8.4 — Conformidade multilíngue

Cada exemplo importante deverá possuir versões:

```text
example.en.tjp
example.pt-BR.tjp
example.es.tjp
```

Os resultados deverão ser equivalentes.

---

# TODO 8.5 — Performance

Criar benchmarks para:

* lexer;
* parser;
* scheduler;
* relatórios;
* Gantt.

Testar projetos:

```text
100 tarefas
1.000 tarefas
10.000 tarefas
```

quando possível.

---

# TODO 8.6 — Segurança

Validar:

* arquivos malformados;
* expressões maliciosas;
* loops;
* consumo excessivo de memória;
* entrada muito grande;
* HTML gerado;
* SVG;
* nomes contendo HTML/JS.

Nunca executar conteúdo do arquivo como JavaScript.

---

# TODO 8.7 — Testes de regressão

Toda correção de bug deverá resultar em um novo teste.

Regra:

```text
Bug
 ↓
Regression Test
 ↓
Fix
```

---

# TODO 8.8 — Testes cross-browser

Avaliar:

* Chrome;
* Edge;
* Firefox;
* Safari.

Principalmente:

* IndexedDB;
* OPFS;
* Service Worker;
* Web Workers;
* Speech/Web APIs quando utilizadas.

---

# TODO 8.9 — Build de produção

Criar processo:

```text
Deno
 ↓
TypeScript
 ↓
Bundle
 ↓
Static Files
 ↓
Hosting
```

Sem Node/npm.

---

# TODO 8.10 — Release

Definir:

* versionamento;
* changelog;
* documentação;
* exemplos;
* testes;
* build final.

---

# 18. Roadmap resumido

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

# 19. Ordem de prioridade

A prioridade será:

## Prioridade 1

```text
Foundation
Core
Parser
```

Sem interface.

---

## Prioridade 2

```text
Scheduler
Reports
```

---

## Prioridade 3

```text
Storage
PWA
```

---

## Prioridade 4

```text
UI
```

---

## Prioridade 5

```text
TaskJuggler compatibility
Performance
Security
```

---

# 20. MVP

O primeiro MVP deverá ser pequeno.

Objetivo:

```text
arquivo .tjp
      ↓
parser
      ↓
AST
      ↓
Core
      ↓
scheduler
      ↓
Gantt
```

Exemplo mínimo:

```tjp
language "pt-BR"

projeto "Minha Obra" {

    tarefa "Fundação" {
        esforço 10d
    }

    tarefa "Estrutura" {
        depende "Fundação"
        esforço 15d
    }
}
```

O sistema deverá:

1. ler o arquivo;
2. reconhecer português;
3. construir AST;
4. criar tarefas;
5. resolver dependência;
6. calcular datas;
7. gerar relatório;
8. gerar Gantt.

Depois disso, adicionar inglês e espanhol.

---

# 21. Critério de conclusão de cada fase

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
deno test
deno lint
deno fmt --check
```

sem erros.

---

# 22. Regra para a IA que irá desenvolver o projeto

A IA deverá seguir estas regras:

### Regra 1

Não implementar várias tarefas simultaneamente.

### Regra 2

Executar uma tarefa pequena por vez.

### Regra 3

Depois de cada implementação:

```text
test
→ fix
→ lint
→ format
```

### Regra 4

Não introduzir Node.js.

### Regra 5

Não introduzir npm.

### Regra 6

Não introduzir dependências sem necessidade.

### Regra 7

Preferir Web APIs nativas.

### Regra 8

Core não pode depender da UI.

### Regra 9

Parser não deve conter lógica de apresentação.

### Regra 10

Storage não deve contaminar Core.

### Regra 11

Idioma não deve contaminar Core.

### Regra 12

Toda funcionalidade nova deve possuir testes.

### Regra 13

Todo bug corrigido deve ganhar um teste de regressão.

### Regra 14

Não fazer refatorações gigantescas durante uma tarefa pequena.

### Regra 15

Manter o projeto executável ao final de cada tarefa.

---

# 23. Regra arquitetural mais importante

O fluxo de dependências deve ser sempre aproximadamente:

```text
APP
 │
 ├───────────────┐
 ▼               ▼
REPORT         STORAGE
 │
 ▼
CORE
 ▲
 │
PARSER
```

Mas o Core nunca deverá depender de:

```text
APP
REPORT
STORAGE
DOM
IndexedDB
OPFS
Preact
BeerCSS
```

O objetivo é poder executar:

```ts
import { ... } from "./src/core/...";
```

diretamente no Deno e nos testes.

---

# 24. Visão futura

O SyntaxMesh deverá evoluir para uma plataforma capaz de:

```text
              SyntaxMesh
                   │
       ┌───────────┼───────────┐
       │           │           │
       ▼           ▼           ▼
   Parser        Core       Reports
       │           │           │
       └───────────┼───────────┘
                   │
             Project Model
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
     Gantt      Dashboard    Export
```

Com possibilidade futura de:

* novos idiomas;
* tradução de arquivos;
* múltiplos calendários;
* cenários;
* planejamento de recursos;
* custos;
* receitas;
* análise financeira;
* dashboards;
* colaboração através de arquivos;
* integração com outros formatos;
* plugins;
* extensões da linguagem;
* grandes projetos;
* processamento em Web Worker.

---

# 25. Filosofia do SyntaxMesh

O projeto deverá seguir quatro princípios:

## Simplicidade

Começar pequeno e crescer progressivamente.

## Independência

O motor não depende da interface ou de um servidor.

## Compatibilidade

Utilizar o TaskJuggler como referência de comportamento, sem ficar preso à implementação Ruby.

## Extensibilidade

A arquitetura deverá permitir que novas linguagens, relatórios e funcionalidades sejam adicionados sem modificar o Core.

---

# 26. Definição final do projeto

**SyntaxMesh** será:

> Um motor de planejamento de projetos offline, executado integralmente no navegador, escrito em TypeScript e desenvolvido com Deno, capaz de interpretar uma linguagem de planejamento inspirada no TaskJuggler, com sintaxe multilíngue, motor próprio de scheduling, recursos, custos, calendários, relatórios e gráficos de Gantt, funcionando como uma PWA sem necessidade de servidor de aplicação.

A arquitetura central será:

```text
                 ┌─────────────────────┐
                 │      SyntaxMesh      │
                 └──────────┬──────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
       Parser              Core            Report
          │                 │                 │
   ┌──────┼──────┐          │                 │
   ▼      ▼      ▼          │                 │
 English  PT-BR  Español     │                 │
   │      │      │           │                 │
   └──────┼──────┘           │                 │
          ▼                  │                 │
      Canonical AST ─────────┘                 │
                            │                  │
                            ▼                  │
                       Scheduler ──────────────┘
                            │
                            ▼
                         Storage
                            │
                    ┌───────┴───────┐
                    ▼               ▼
                IndexedDB          OPFS
                    │
                    ▼
                  PWA
                    │
                    ▼
                 Browser
```

**Nome oficial do projeto: SyntaxMesh.**

**Objetivo:** construir primeiro um motor sólido e testável; depois uma aplicação completa em cima dele.
````

---

