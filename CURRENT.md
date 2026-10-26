# Arquivo `CURRENT.md`

Leia os arquivos:
- docs/syntaxmesh/fases/plano.md (plano canônico de 21 fases — fonte da verdade de escopo e andamento)
- docs/syntaxmesh/fases/README.md (convenções de arquivos, protocolo TDD, mapa de fases)
- docs/syntaxmesh/09-regras-para-ia.md (regras de ouro)

Tenha conhecimento da lista de ADR em : docs/syntaxmesh/decisoes/README.md
Reuna dicas e analise-as do arquivo: docs/syntaxmesh/cheat-sheet-ruby-ts.md

Desenvolvimento atual (docs/syntaxmesh/fases/):
- **Fase 10 Complemento** — `fase-10-complemento1.md` + `fase-10-complemento2.md` (especificações) → executar `fase-10-complemento-tarefas.md` (Blocos C0–C4, toca Fases 5/7/8.1/10) e os adendos "Adendo Fase 10 Complemento" nos `-tarefas.md` das Fases 13/14/16/18/19/20/21.
- Em paralelo/sequência: Fase 11 (`fase-11-logica-queries-tarefas.md`) e Fase 12 (`fase-12-richtext-tarefas.md`) — dependem só do que já está concluído.

IMPORTANTE
* os arquivos TaskJuggler Ruby fonte estão em docs/taskjuggler/lib/taskjuggler
* para testes veja a decisão de qual biblioteca e estilo de teste fazer no arquivo: docs/syntaxmesh/decisoes/008-biblioteca-de-testes-std-testing-bdd-padrao.md
* arquivos de documentação na raiz da pasta docs/syntaxmesh, podem estar desatualizados, e podem ser atualizados para manter coerencia com o plano em docs/syntaxmesh/fases
* arquivos da pasta docs/tj3-engine foram usados para elaborar o plano em docs/syntaxmesh/fases mas podem estar desatualizados também por conta da evolução do projeto e podem ser atualizados se precisar tambem

## Resumo do estado atual (2026-10-26)

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
- Fase 10 — Parser e Linguagem ✅ (10.0–10.20 concluídas em 2026-10-26): `TextParser` FSM,
  `Scanner`/`ProjectFileScanner`, `ProjectFileParser`, `TjpSyntaxRules` com as
  348 regras do Ruby portadas (380 registradas, 0 placeholders), i18n
  (`LanguageRegistry` + en/pt-BR/es + diretiva `language`), AST equivalence
  9 MWEs × 3 idiomas, golden parser com 178 casos (5 skipped — dependem de
  RichText, Fase 12). Suíte core: **225 testes / 2828 passos, 0 falhas**;
  `deno task check:all` e `deno fmt --check` verdes. Verificação final em
  `fase-10-parser-linguagem-tarefas.md` (10.20) e smoke test
  `tests/integration/smoke_after_phase_10_test.ts`.

## Fases ativas/próximas

- **Fase 10 Complemento — Extensões RDO/orçamento ⬜ Não iniciada:** tarefas em `fase-10-complemento-tarefas.md` (material no parser + modelo, `note`/`journal` estendidos, `picture`/`format`, `timebasis` #6/#6a com `distribution.ts`, `breakdownreport`/`rdoreport`, i18n, golden) + adendos nas Fases 13/14/16/18/19/20/21.
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
- `docs/syntaxmesh/fases/fase-N-descricao-tarefas.md` — tarefas atômicas com testes unitários
- `docs/syntaxmesh/fases/fase-N-descricao.md` — plano da funcionalidade

## Decisões arquitetônicas (ADR)

Todas as decisões arquitetônicas importantes estão documentadas em `docs/syntaxmesh/decisoes/` (ADRs 001–031). Consulte `docs/syntaxmesh/decisoes/README.md` para a lista completa.

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
- O nome real da task de validação completa é `deno task check:all` (dois-pontos), não `check-all`.
- A Fase 2 está genuinamente implementada (9 arquivos em `packages/core/src/time/`, 14 arquivos de teste em `packages/core/tests/time/`).
- A Fase 8.1 está implementada com 163 testes core e 37 tarefas atômicas — mas **apenas o modelo** de `material`; o parser não conhece `material` (correção no Bloco C3 de `fase-10-complemento-tarefas.md`).
- **Gap conhecido (Fase 7/9):** `Project.schedule()` roda end-to-end sobre modelos
  vindos do parser sem lançar, mas ainda não coloca as datas (`not_scheduled`,
  `task_start_undef`; `TaskDependency.task` não é resolvido no prepare). O tj3
  real agenda o mwe001 com folga — o modelo do parser está correto; o ajuste é
  do scheduler. Documentado no smoke test pós-Fase 10.
- **Semântica do MessageHandler:** `error()` só lança `TjRuntimeError` com
  `trapSetup = true` (Ruby MessageHandler.rb l.291-298); drivers golden e
  testes que esperam abort precisam ativar o trap explicitamente.
- Golden do parser exige fuso UTC por caso (Ruby `TaskJuggler.new` reseta via
  `TjTime.setTimeZone('UTC')`).