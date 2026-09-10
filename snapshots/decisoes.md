> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém a DOCUMENTAÇÃO de Decisões arquitetônicas fundamentais como ADRs (Architecture Decision Record).
> O projeto é o **SyntaxMesh ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto SyntaxMesh - Modo: DECISOES

Gerado automaticamente em: 9/10/2026, 6:22:47 PM

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

