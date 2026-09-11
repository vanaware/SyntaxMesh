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
├── language
├── richtext
├── markdown
├── report
├── storage
├── worker-db
├── utils
├── service-worker
├── ui
└── server
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


### Divisão detalhada de RichText e Markdown

```text
packages/richtext/src
├── mod.ts
├── parser.ts
├── serializer.ts
└── types.ts

packages/markdown/src
├── mod.ts
├── parser.ts
├── serializer.ts
└── types.ts
```

O `@syntaxmesh/richtext` implementa o formato RichText do TaskJuggler (similar a MediaWiki markup) para compatibilidade com arquivos `.tjp` existentes.

O `@syntaxmesh/markdown` implementa o formato Markdown como formato going-forward para conteúdo nativo do SyntaxMesh.

Ambos coexistem. O RichText será depreciado lentamente em favor do Markdown para novos projetos. Conversores entre os formatos serão implementados em fases futuras.


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