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