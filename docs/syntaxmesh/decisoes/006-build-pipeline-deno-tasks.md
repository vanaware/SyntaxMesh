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