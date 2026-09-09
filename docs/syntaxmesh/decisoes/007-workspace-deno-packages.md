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