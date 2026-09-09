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