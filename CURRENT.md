Sim. Para reduzir o contexto, eu **não manteria esse texto inteiro em um único arquivo/prompt**. Eu dividiria em arquivos pequenos, especializados e carregáveis sob demanda.

A ideia é:

```text
Contexto permanente pequeno
        ↓
Contexto da fase atual
        ↓
Contexto do módulo atual
        ↓
Somente os arquivos necessários para a tarefa
```

Abaixo segue uma sugestão prática de divisão.

---

# 1. Divisão da documentação para reduzir contexto

Crie uma pasta `docs/` e transforme esse documento gigante em vários arquivos pequenos.

## Estrutura recomendada

```text
syntaxmesh/
├── README.md
├── CURRENT.md
├── docs/
│   ├── 00-index.md
│   ├── 01-visao.md
│   ├── 02-principios.md
│   ├── 03-arquitetura.md
│   ├── 04-linguagem-multilingue.md
│   ├── 05-formato-e-compatibilidade.md
│   ├── 06-testes-e-processo.md
│   ├── 07-roadmap.md
│   ├── 08-mvp.md
│   ├── 09-regras-para-ia.md
│   ├── 10-futuro.md
│   │
│   ├── fases/
│   │   ├── fase-1-fundacao.md
│   │   ├── fase-2-core.md
│   │   ├── fase-3-parser-multilingue.md
│   │   ├── fase-4-report.md
│   │   ├── fase-5-storage.md
│   │   ├── fase-6-pwa.md
│   │   ├── fase-7-interface.md
│   │   └── fase-8-compatibilidade-qualidade.md
│   │
│   ├── tarefas/
│   │   ├── fase-2/
│   │   │   ├── 2.01-modelo-de-projeto.md
│   │   │   ├── 2.02-hierarquia-de-tarefas.md
│   │   │   ├── 2.03-duracao.md
│   │   │   └── ...
│   │   ├── fase-3/
│   │   │   ├── 3.01-lexer.md
│   │   │   ├── 3.02-testes-do-lexer.md
│   │   │   └── ...
│   │   └── ...
│   │
│   └── decisoes/
│       ├── adr-001-deno-browser-only.md
│       ├── adr-002-core-sem-dom.md
│       ├── adr-003-idioma-projeto-vs-interface.md
│       ├── adr-004-representacao-canonica.md
│       ├── adr-005-storage-idb-opfs.md
│       └── adr-006-pwa-preact-beercss.md
```

---

# 2. Conteúdo sugerido para cada arquivo de documentação

## `docs/00-index.md`

Esse deve ser o arquivo principal. Ele deve ser curto.

Conteúdo:

- nome do projeto;
- objetivo;
- regras mais importantes;
- índice dos arquivos;
- qual arquivo carregar em cada situação.

Exemplo:

```md
# SyntaxMesh — Índice de Contexto

## Regras globais

- TypeScript + Deno apenas.
- Browser only.
- Nada de Node.js, npm, yarn, pnpm.
- Core não pode depender de DOM, Preact, BeerCSS, IndexedDB ou OPFS.
- Parser não conhece idiomas finais depois da normalização.
- Idioma do projeto é diferente do idioma da interface.
- Storage usa IndexedDB via idb-keyval e OPFS.
- UI usa Preact, Signals e BeerCSS.
- PWA offline com Service Worker.

## Arquivos de contexto

| Arquivo | Quando usar |
|---|---|
| docs/01-visao.md | Entender o produto |
| docs/02-principios.md | Regras técnicas e processo |
| docs/03-arquitetura.md | Arquitetura geral |
| docs/04-linguagem-multilingue.md | Idiomas e keywords canônicas |
| docs/fases/fase-2-core.md | Trabalhar no Core |
| docs/fases/fase-3-parser-multilingue.md | Trabalhar no parser |
```

---

## `docs/01-visao.md`

Conter:

- visão do projeto;
- objetivo do SyntaxMesh;
- definição final do projeto;
- o que o sistema deve fazer;
- o que não é objetivo inicial.

Corresponde aproximadamente às seções:

```text
1. Visão do projeto
26. Definição final do projeto
```

---

## `docs/02-principios.md`

Conter:

- TypeScript + Deno;
- browser only;
- offline;
- sem Node.js;
- sem npm;
- Web APIs nativas;
- desenvolvimento incremental;
- testes obrigatórios.

Corresponde aproximadamente às seções:

```text
2. Princípios fundamentais
15. Estratégia de testes
16. Regra de desenvolvimento incremental
```

---

## `docs/03-arquitetura.md`

Conter:

- arquitetura geral;
- módulos: core, parser, report, storage, app;
- estrutura de diretórios;
- dependências permitidas;
- regra de que o Core não depende de UI;
- fluxo geral do sistema.

Corresponde aproximadamente às seções:

```text
3. Execução offline
4. Arquitetura geral
5. Estrutura de diretórios
23. Regra arquitetural mais importante
```

---

## `docs/04-linguagem-multilingue.md`

Conter:

- idioma do projeto;
- idioma da interface;
- diferença entre os dois;
- linguagem canônica;
- LanguageDefinition;
- keywords canônicas;
- diretiva `language`;
- suporte inicial a `en`, `pt-BR`, `es`.

Corresponde aproximadamente às seções:

```text
6. Sintaxe multilíngue
7. Idioma do projeto x idioma da interface
8. Arquitetura da linguagem
9. Representação canônica
10. LanguageDefinition
11. Declaração do idioma no arquivo
12. Compatibilidade e tradução
```

---

## `docs/05-formato-e-compatibilidade.md`

Conter:

- formato inspirado em `.tjp`;
- exemplos mínimos;
- estratégia de compatibilidade com TaskJuggler;
- compatibilidade conceitual, não conversão mecânica.

Corresponde aproximadamente às seções:

```text
13. Arquivos inicialmente suportados
14. Estratégia de compatibilidade com TaskJuggler
```

---

## `docs/06-testes-e-processo.md`

Conter:

- testes;
- lint;
- formatter;
- critério de conclusão;
- fluxo de implementação;
- regressão.

Corresponde aproximadamente às seções:

```text
15. Estratégia de testes
16. Regra de desenvolvimento incremental
21. Critério de conclusão de cada fase
```

---

## `docs/07-roadmap.md`

Conter:

- fases do projeto;
- prioridades;
- roadmap resumido;
- ordem de implementação.

Corresponde aproximadamente às seções:

```text
17. Plano geral
18. Roadmap resumido
19. Ordem de prioridade
```

---

## `docs/08-mvp.md`

Conter somente o MVP.

Corresponde à seção:

```text
20. MVP
```

Esse arquivo deve ser pequeno e muito objetivo.

Exemplo:

```md
# MVP

O MVP mínimo é:

1. Ler um arquivo .tjp em pt-BR.
2. Interpretar linguagem canônica.
3. Criar AST.
4. Converter para Core.
5. Resolver dependências.
6. Calcular datas.
7. Gerar relatório simples.
8. Gerar Gantt simples.
```

---

## `docs/09-regras-para-ia.md`

Conter as regras para desenvolvimento assistido por IA.

Corresponde à seção:

```text
22. Regra para a IA que irá desenvolver o projeto
```

Exemplo:

```md
# Regras para IA

- Implementar uma tarefa pequena por vez.
- Não implementar várias tarefas simultaneamente.
- Não introduzir Node.js.
- Não introduzir npm.
- Não modificar arquivos fora do escopo da tarefa.
- Core não pode importar DOM.
- Parser não pode conter lógica de UI.
- Storage não pode contaminar Core.
- Idioma não pode contaminar Core.
- Toda funcionalidade nova precisa de teste.
```

---

## `docs/10-futuro.md`

Conter:

- visão futura;
- filosofia;
- extensões possíveis;
- novos idiomas;
- tradução;
- cenários;
- dashboards;
- plugins.

Corresponde aproximadamente às seções:

```text
24. Visão futura
25. Filosofia do SyntaxMesh
```

---

# 3. Divisão das fases em arquivos separados

A parte mais importante para reduzir contexto é não colocar todas as fases juntas.

Crie um arquivo por fase.

---

## `docs/fases/fase-1-fundacao.md`

Conteúdo:

- TODO 1.1 — Criar projeto Deno;
- TODO 1.2 — Estrutura de diretórios;
- TODO 1.3 — Core independente;
- TODO 1.4 — Pipeline de qualidade;
- TODO 1.5 — Documentação inicial.

---

## `docs/fases/fase-2-core.md`

Conteúdo:

- modelo de projeto;
- tarefas;
- recursos;
- contas;
- cenários;
- calendários;
- duração;
- esforço;
- dependências;
- scheduler;
- ciclos;
- custos;
- restrições;
- validação.

Se ficar grande, quebre em arquivos por TODO.

Exemplo:

```text
docs/tarefas/fase-2/
├── 2.01-modelo-de-projeto.md
├── 2.02-hierarquia-de-tarefas.md
├── 2.03-duracao.md
├── 2.04-esforco.md
├── 2.05-calendarios.md
├── 2.06-dependencias.md
├── 2.07-scheduler.md
├── 2.08-deteccao-de-ciclos.md
├── 2.09-recursos.md
├── 2.10-custos.md
├── 2.11-receitas.md
├── 2.12-restricoes.md
├── 2.13-cenarios.md
├── 2.14-expressoes.md
├── 2.15-validacao.md
└── 2.16-testes-do-core.md
```

---

## `docs/fases/fase-3-parser-multilingue.md`

Conteúdo:

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

---

## `docs/fases/fase-4-report.md`

Conteúdo:

- modelo de relatório;
- colunas;
- linhas;
- filtros;
- agrupamentos;
- Gantt;
- JSON;
- CSV;
- HTML.

---

## `docs/fases/fase-5-storage.md`

Conteúdo:

- IndexedDB via `idb-keyval`;
- OPFS;
- CRUD de projetos;
- importação;
- exportação;
- autosave;
- recuperação.

---

## `docs/fases/fase-6-pwa.md`

Conteúdo:

- manifest;
- service worker;
- offline;
- atualização;
- Web Worker para Core/Scheduler.

---

## `docs/fases/fase-7-interface.md`

Conteúdo:

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

---

## `docs/fases/fase-8-compatibilidade-qualidade.md`

Conteúdo:

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

---

# 4. Divisão sugerida do código-fonte

Além da documentação, o código também deve ser bem particionado.

Uma boa divisão seria:

```text
syntaxmesh/
├── deno.json
├── README.md
├── CURRENT.md
│
├── docs/
│
├── public/
│   ├── index.html
│   ├── manifest.webmanifest
│   ├── sw.js
│   ├── icons/
│   └── styles/
│       ├── beercss.css
│       └── app.css
│
├── examples/
│   ├── minimal.en.tjp
│   ├── minimal.pt-BR.tjp
│   └── minimal.es.tjp
│
├── src/
│   ├── core/
│   ├── parser/
│   ├── report/
│   ├── storage/
│   └── app/
│
└── tests/
    ├── core/
    ├── parser/
    ├── report/
    ├── storage/
    └── integration/
```

---

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

---

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

---

# 12. Mapeamento do texto original para arquivos

Aqui está uma sugestão direta de como dividir o documento atual.

| Seção original | Arquivo sugerido |
|---|---|
| 1. Visão do projeto | `docs/01-visao.md` |
| 2. Princípios fundamentais | `docs/02-principios.md` |
| 3. Execução offline | `docs/03-arquitetura.md` |
| 4. Arquitetura geral | `docs/03-arquitetura.md` |
| 5. Estrutura de diretórios | `docs/03-arquitetura.md` |
| 6. Sintaxe multilíngue | `docs/04-linguagem-multilingue.md` |
| 7. Idioma do projeto x interface | `docs/04-linguagem-multilingue.md` |
| 8. Arquitetura da linguagem | `docs/04-linguagem-multilingue.md` |
| 9. Representação canônica | `docs/04-linguagem-multilingue.md` |
| 10. LanguageDefinition | `docs/04-linguagem-multilingue.md` |
| 11. Declaração do idioma | `docs/04-linguagem-multilingue.md` |
| 12. Compatibilidade e tradução | `docs/04-linguagem-multilingue.md` |
| 13. Arquivos suportados | `docs/05-formato-e-compatibilidade.md` |
| 14. Compatibilidade com TaskJuggler | `docs/05-formato-e-compatibilidade.md` |
| 15. Estratégia de testes | `docs/06-testes-e-processo.md` |
| 16. Desenvolvimento incremental | `docs/06-testes-e-processo.md` |
| 17. Plano geral | `docs/07-roadmap.md` |
| Fase 1 | `docs/fases/fase-1-fundacao.md` |
| Fase 2 | `docs/fases/fase-2-core.md` |
| Fase 3 | `docs/fases/fase-3-parser-multilingue.md` |
| Fase 4 | `docs/fases/fase-4-report.md` |
| Fase 5 | `docs/fases/fase-5-storage.md` |
| Fase 6 | `docs/fases/fase-6-pwa.md` |
| Fase 7 | `docs/fases/fase-7-interface.md` |
| Fase 8 | `docs/fases/fase-8-compatibilidade-qualidade.md` |
| 18. Roadmap resumido | `docs/07-roadmap.md` |
| 19. Ordem de prioridade | `docs/07-roadmap.md` |
| 20. MVP | `docs/08-mvp.md` |
| 21. Critério de conclusão | `docs/06-testes-e-processo.md` |
| 22. Regras para IA | `docs/09-regras-para-ia.md` |
| 23. Regra arquitetural | `docs/03-arquitetura.md` |
| 24. Visão futura | `docs/10-futuro.md` |
| 25. Filosofia | `docs/10-futuro.md` |
| 26. Definição final | `docs/01-visao.md` |

---

# 13. Arquivo `CURRENT.md`

Esse arquivo é muito útil para reduzir contexto.

Ele representa a tarefa atual.

Exemplo:

```md
# Tarefa atual

## Fase

Fase 2 — Core

## Tarefa

TODO 2.3 — Duração

## Arquivos permitidos

- src/core/time/duration.ts
- tests/core/duration_test.ts
- src/core/mod.ts

## Objetivo

Implementar representação de duração com horas, dias e semanas.

## Fora de escopo

- Calendários
- Scheduler
- Recursos
- UI
- Storage

## Testes obrigatórios

- Conversão de horas para minutos
- Conversão de dias para horas
- Duração zero
- Duração inválida
```

Quando for trabalhar em outra tarefa, você troca apenas o `CURRENT.md`.

---

# 14. Template recomendado para arquivo de tarefa

Para cada tarefa pequena, use um arquivo assim:

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

# 15. Divisão mínima para começar agora

Se você quiser reduzir o contexto imediatamente, eu começaria com estes arquivos:

```text
syntaxmesh/
├── README.md
├── CURRENT.md
├── deno.json
│
├── docs/
│   ├── 00-index.md
│   ├── 01-visao.md
│   ├── 02-principios.md
│   ├── 03-arquitetura.md
│   ├── 04-linguagem-multilingue.md
│   ├── 08-mvp.md
│   ├── 09-regras-para-ia.md
│   └── fases/
│       ├── fase-1-fundacao.md
│       ├── fase-2-core.md
│       └── fase-3-parser-multilingue.md
│
├── src/
│   ├── core/
│   │   ├── mod.ts
│   │   └── model/
│   │       └── project.ts
│   │
│   ├── parser/
│   │   └── language/
│   │       ├── types.ts
│   │       ├── canonical.ts
│   │       ├── registry.ts
│   │       ├── en.ts
│   │       ├── pt-BR.ts
│   │       └── es.ts
│   │
│   └── app/
│       └── main.tsx
│
├── tests/
│   ├── core/
│   │   └── project_test.ts
│   └── parser/
│       └── language_registry_test.ts
│
└── examples/
    └── minimal.pt-BR.tjp
```

---

# 16. Como usar esses arquivos em prompts

Em vez de colar a especificação inteira, use algo assim:

## Para trabalhar no Core

```text
Leia apenas:

- docs/00-index.md
- docs/02-principios.md
- docs/03-arquitetura.md
- docs/fases/fase-2-core.md
- CURRENT.md

Implemente somente a tarefa atual.
Não modifique parser, storage, report ou app.
```

---

## Para trabalhar no Parser

```text
Leia apenas:

- docs/00-index.md
- docs/04-linguagem-multilingue.md
- docs/fases/fase-3-parser-multilingue.md
- CURRENT.md

Implemente somente a tarefa atual.
Não modifique Core, Report, Storage ou App.
```

---

## Para trabalhar no MVP

```text
Leia apenas:

- docs/00-index.md
- docs/08-mvp.md
- docs/04-linguagem-multilingue.md
- docs/fases/fase-3-parser-multilingue.md
- CURRENT.md

Objetivo: implementar o MVP mínimo em pt-BR.
```

---

# 17. Regra de ouro para reduzir contexto

Use esta regra:

```text
Nunca carregar o projeto inteiro.
Carregar apenas:

1. Índice
2. Regras globais
3. Fase atual
4. Tarefa atual
5. Arquivos da tarefa atual
```

Se um arquivo de documentação ficar maior que aproximadamente:

```text
150–250 linhas
```

considere dividir.

Se um arquivo de código ficar maior que aproximadamente:

```text
200–300 linhas
```

considere dividir, a menos que exista um motivo forte para mantê-lo único.

---

# 18. Divisão recomendada para o `deno.json`

O `deno.json` pode centralizar tarefas e imports.

Exemplo conceitual:

```json
{
  "tasks": {
    "test": "deno test",
    "lint": "deno lint",
    "fmt": "deno fmt",
    "fmt:check": "deno fmt --check",
    "check": "deno fmt --check && deno lint && deno test"
  },
  "imports": {
    "preact": "...",
    "preact/hooks": "...",
    "@preact/signals": "...",
    "idb-keyval": "..."
  }
}
```

Lembrando:

- nada de `npm install`;
- nada de `node_modules`;
- nada de `package.json` como fonte principal;
- usar apenas Deno, JSR/ESM compatível;
- para PWA offline, idealmente cachear/vendoring os assets necessários.

---

# 19. Recomendação final de organização

Eu usaria esta hierarquia:

```text
docs/00-index.md
docs/02-principios.md
docs/09-regras-para-ia.md
CURRENT.md
```

como contexto global mínimo.

Depois:

```text
docs/fases/fase-X.md
docs/tarefas/fase-X/Y.md
```

como contexto da tarefa.

Depois:

```text
src/core/...
src/parser/...
src/report/...
src/storage/...
src/app/...
tests/...
```

como código.

---

# 20. Minha recomendação prática

A divisão mais eficiente para o seu caso seria:

## Documentação principal

```text
docs/00-index.md
docs/01-visao.md
docs/02-principios.md
docs/03-arquitetura.md
docs/04-linguagem-multilingue.md
docs/05-formato-e-compatibilidade.md
docs/06-testes-e-processo.md
docs/07-roadmap.md
docs/08-mvp.md
docs/09-regras-para-ia.md
docs/10-futuro.md
```

## Fases

```text
docs/fases/fase-1-fundacao.md
docs/fases/fase-2-core.md
docs/fases/fase-3-parser-multilingue.md
docs/fases/fase-4-report.md
docs/fases/fase-5-storage.md
docs/fases/fase-6-pwa.md
docs/fases/fase-7-interface.md
docs/fases/fase-8-compatibilidade-qualidade.md
```

## Tarefas, se quiser contexto ainda menor

```text
docs/tarefas/fase-2/2.01-modelo-de-projeto.md
docs/tarefas/fase-2/2.02-hierarquia-de-tarefas.md
docs/tarefas/fase-2/2.03-duracao.md
...
```

## Código

```text
src/core/...
src/parser/...
src/report/...
src/storage/...
src/app/...
tests/...
```

Com isso, você consegue trabalhar sempre com um contexto pequeno, por exemplo:

```text
docs/00-index.md
docs/09-regras-para-ia.md
docs/fases/fase-2-core.md
docs/tarefas/fase-2/2.03-duracao.md
src/core/time/duration.ts
tests/core/duration_test.ts
```

Em vez de carregar a especificação inteira.