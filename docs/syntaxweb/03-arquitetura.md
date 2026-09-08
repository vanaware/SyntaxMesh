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

# 5. Divisão detalhada do Core

O Core deve ser totalmente independente de DOM.

```text
src/core/
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

## Regra importante

Nenhum arquivo dentro de `src/core/` deve importar:

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
localStorage
indexedDB
```

Exceção apenas se for tipo Web API isolada e necessária, mas idealmente Core não usa.

---


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
# 6. Divisão detalhada do Parser

O Parser deve transformar texto em AST e depois em Core Model.

```text
src/parser/
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

# 8. Divisão detalhada de Report

```text
src/report/
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

---
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

# 9. Divisão detalhada de Storage

Storage deve ser isolado e não deve contaminar o Core.

```text
src/storage/
├── mod.ts
├── types.ts
│
├── idb/
│   ├── keyval-client.ts
│   ├── project-repository.ts
│   └── settings-repository.ts
│
├── opfs/
│   ├── opfs-files.ts
│   ├── opfs-project-files.ts
│   └── opfs-errors.ts
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
    └── file-download.ts
```

## Recomendação

Crie um wrapper para o `idb-keyval`:

```text
src/storage/idb/keyval-client.ts
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

## 4.5 App

Responsável pela interface.

Tecnologias:

* Preact;
* Signals;
* BeerCSS;
* Web APIs.

# 10. Divisão detalhada da aplicação

A aplicação é a camada mais externa.

```text
src/app/
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

# 7. Divisão detalhada de linguagem multilíngue

Essa parte é crítica e deve ficar bem isolada.

```text
src/parser/language/
├── types.ts
├── canonical.ts
├── registry.ts
├── en.ts
├── pt-BR.ts
└── es.ts
```

## `types.ts`

Responsável por definir:

```ts
export interface LanguageDefinition {
  id: string;
  name: string;
  keywords: Record<string, string[]>;
  units: Record<string, string[]>;
}
```

## `canonical.ts`

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

## `registry.ts`

Responsável por registrar idiomas.

Exemplo conceitual:

```ts
export class LanguageRegistry {
  get(id: string): LanguageDefinition {}
  register(language: LanguageDefinition): void {}
}
```

## `en.ts`, `pt-BR.ts`, `es.ts`

Cada arquivo contém apenas um idioma.


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

# 11. Divisão dos testes

Testes devem espelhar os módulos.

```text
tests/
├── core/
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
├── parser/
│   ├── lexer_test.ts
│   ├── parser_minimal_test.ts
│   ├── parser_effort_test.ts
│   ├── parser_dependency_test.ts
│   ├── language_registry_test.ts
│   ├── language_equivalence_test.ts
│   └── semantic_validation_test.ts
│
├── report/
│   ├── task_report_test.ts
│   ├── filter_test.ts
│   ├── csv_export_test.ts
│   ├── json_export_test.ts
│   └── gantt_svg_test.ts
│
├── storage/
│   ├── project_repository_fake_test.ts
│   ├── opfs_fake_test.ts
│   ├── autosave_test.ts
│   └── recovery_test.ts
│
└── integration/
    ├── mvp_ptbr_test.ts
    ├── mvp_en_test.ts
    └── mvp_es_test.ts
```