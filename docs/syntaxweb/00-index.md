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
| docs/syntaxweb/01-visao.md | Entender o produto |
| docs/syntaxweb/02-principios.md | Regras técnicas e processo |
| docs/syntaxweb/03-arquitetura.md | Arquitetura geral |
| docs/syntaxweb/04-linguagem-multilingue.md | Idiomas e keywords canônicas |
| docs/syntaxweb/fases/fase-2-core.md | Trabalhar no Core |
| docs/syntaxweb/fases/fase-3-parser-multilingue.md | Trabalhar no parser |