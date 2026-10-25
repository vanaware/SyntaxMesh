# Arquivo `CURRENT.md`

Leia os arquivos:
- docs/syntaxmesh/fases/plano.md (plano canônico de 21 fases)
- docs/syntaxmesh/09-regras-para-ia.md (regras de ouro)

Tenha conhecimento da lista de ADR em : docs/syntaxmesh/decisoes/README.md
Reuna dicas e analise-as do arquivo: docs/syntaxmesh/cheat-sheet-ruby-ts.md

Implementar a tarefa (docs/syntaxmesh/fases/):
- docs/syntaxmesh/fases/fase-1-fundacao.md (caso precise de algum ajuste - opcional)
- docs/syntaxmesh/fases/fase-1-fundacao-tarefas.md (veja se estão todas executadas)
- docs/syntaxmesh/fases/fase-2-tempo-geometria.md
- docs/syntaxmesh/fases/fase-2-tempo-geometria-tarefas.md (veja se estão todas executadas)
- docs/syntaxmesh/fases/_ajustes-r1-r12.md
- docs/syntaxmesh/fases/fase-2-tempo-geometria-tarefas-complementar1.md

IMPORTANTE
* os arquivos TaskJuggler Ruby fonte estão em docs/taskjuggler/lib/taskjuggler
* para testes veja a decisão de qual biblioteca e estilo de teste fazer no arquivo: docs/syntaxmesh/decisoes/008-biblioteca-de-testes-std-testing-bdd-padrao.md
* arquivos de documentação na raiz da pasta docs/syntaxmesh, podem estar desatualizados, e podem ser atualizados para manter coerencia com o plano em docs/syntaxmesh/fases
* arquivos da pasta docs/tj3-engine foram usados para elaborar o plano em docs/syntaxmesh/fases mas podem estar desatualizados também por conta da evolução do projeto e podem ser atualizados se precisar tambem

## Resumo do estado atual (2026-10-24)

**Arquitetura de pacotes (ADR 030 — aceita):** todo código principal vive em
`packages/core`. Não criar pacotes `parser`, `language`, `richtext`, `markdown`,
`report`, `storage`. Pacotes de apoio: apenas `server`, `service-worker`, `ui`.
Parser/lexer da Fase 10 em `packages/core/src/parser/` e `packages/core/src/lexer/`;
i18n (10.15+) em `packages/core/src/i18n/`.

**Fases concluídas:**
- Fase 1 — Fundação e Workspace Deno ✅ (63/63 tarefas)
- Fase 2 — Tempo e Geometria ✅ (142 + 52 tarefas complementares)
- Fase 3 — Modelo de Atributos ✅ (140 tarefas atômicas)
- Fase 4 — Árvore de Propriedades ✅ (118 tarefas atômicas)
- Fase 5 — Entidades Concretas ✅ (108 tarefas atômicas)
- Fase 6 — Scoreboard e Estruturas Base ✅ (145 testes)
- Fase 7 — Scheduler Core ✅ (215 tarefas; arquivo de tarefas concluído)
- Fase 8 — Sistema Financeiro ✅ (125 tarefas)
- Fase 8.1 — Nova funcionalidade de custos ✅ (163 testes core, 37 tarefas atômicas)
- Fase 8.2 — Modelo Contábil Estendido ✅ (130 tarefas)
- Fase 9 — Orquestrador e Cache ✅ (~195 tarefas)

**Fases ativas/próximas:**
- Fase 10 — Parser e Linguagem 🟡 Em andamento (10.1–10.7 implementadas e testadas em core — `TextParser` FSM com 41 testes; ADRs da 10.0 concluídos como 022/023; próxima 10.8 — Scanner genérico + StreamHandle). Total do suite: 154 testes / 2337 passos.
- Fase 11 — Expressões Lógicas e Queries ⬜ Não iniciada
- Fase 12 — RichText (compatibilidade TJP) ⬜ Não iniciada
- Fase 13 — Markdown (novo, futuro) ⬜ Não iniciada
- Fase 14 — Relatórios ⬜ Não iniciada
- Fase 15 — Gantt ⬜ Não iniciada
- Fase 16 — Apoio ⬜ Não iniciada
- Fase 17 — HTML/XML ⬜ Não iniciada
- Fase 18 — Time/Status Sheets ⬜ Não iniciada
- Fase 19 — Storage ⬜ Não iniciada
- Fase 20 — PWA + UI ⬜ Não iniciada
- Fase 21 — Compatibilidade e Qualidade ⬜ Não iniciada

## Arquivos de tarefas atômicas (TDD)

Cada fase tem um arquivo de tarefas atômicas separado:
- `docs/syntaxmesh/fases/fase-N-descricaoo-tarefas.md` — tarefas atômicas com testes unitários
- `docs/syntaxmesh/fases/fase-N-descricaoo.md` — plano da funcionalidade

## Decisões arquitetônicas (ADR)

Todas as decisões arquitetônicas importantes estão documentadas em `docs/syntaxmesh/decisoes/` (ADRs 001–029). Consulte `docs/syntaxmesh/decisoes/README.md` para a lista completa.

## Regras de ouro para IA

As regras de ouro para desenvolvimento estão em `docs/syntaxmesh/09-regras-para-ia.md`. Estas incluem:
- Uma tarefa de cada vez
- Sem Node.js/npm (puro Deno)
- Core não pode importar DOM/Preact/BeerCSS/IndexedDB/OPFS/UI
- Parser não conhece idiomas finais depois da normalização
- Idioma do projeto é diferente do idioma da interface
- Storage usa IndexedDB via idb-keyval e OPFS, através do pacote @syntaxmesh/worker-db
- UI (@syntaxmesh/ui) usa Preact, Signals e BeerCSS
- PWA offline com Service Worker (@syntaxmesh/service-worker)
- Testes obrigatórios (regra 12)
- ADRs para decisões arquitetônicas
- TJ Ruby sources em `docs/taskjuggler/lib/taskjuggler`

## Pipeline de qualidade

Execute `deno task check-all` para validação completa:
- `deno check` (type check)
- `deno lint` (lint)
- `deno fmt --check` (formatação)
- `deno test` (testes)

## Comando tj3

O ambiente está pré-configurado para rodar TaskJuggler. Execute `tj3` diretamente via shell para processar arquivos `.tjp`.

## Observações sobre o repositório

- `deno task --list` retorna `error: unexpected argument '--list'` — Deno 2.x lista tarefas executando `deno task` sem argumentos.
- A Fase 2 está genuinamente implementada (9 arquivos em `packages/core/src/time/`, 14 arquivos de teste em `packages/core/tests/time/`).
- A Fase 8.1 está implementada com 163 testes core e 37 tarefas atômicas.
- A Fase 7 está em andamento (7.2 TaskDependency concluída).