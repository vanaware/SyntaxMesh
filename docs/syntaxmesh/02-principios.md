 # Princípios fundamentais

O desenvolvimento deverá obedecer às seguintes regras.

## TypeScript + Deno

O projeto será desenvolvido exclusivamente com:

* TypeScript;
* Deno;
* Web APIs;
* HTML;
* CSS;
* Preact;
* Signals;
* BeerCSS.

Não utilizar:

* Node.js;
* npm;
* yarn;
* pnpm;
* package.json;
* node_modules;
* dependências que exijam Node para execução.

O Deno será utilizado como:

* ambiente de desenvolvimento;
* executor TypeScript;
* executor de testes;
* lint;
* formatter;
* tarefas de build;
* ferramentas auxiliares.


## Estratégia de testes

Toda funcionalidade deverá possuir testes.

Regra:

```text
Implementar
    ↓
Criar teste
    ↓
Executar teste
    ↓
Corrigir
    ↓
Formatar
    ↓
Lint
    ↓
Commit
    ↓
Próxima tarefa
```

Comandos principais:

```bash
deno test
deno lint
deno fmt --check
```

Durante desenvolvimento:

```bash
deno fmt
deno lint
deno test
```


## Regra de desenvolvimento incremental

Não implementar grandes blocos de código de uma única vez.

Cada fase deverá ser dividida em pequenas tarefas.

Cada tarefa deverá:

1. possuir objetivo claro;
2. modificar o mínimo necessário;
3. possuir testes;
4. passar nos testes;
5. passar no lint;
6. estar formatada;
7. deixar o projeto em estado funcional.

Decisões arquitetônicas relevantes devem ser registradas em `docs/syntaxmesh/decisoes/` como ADR (Architecture Decision Record).

## Tarefas de automação (deno.jsonc)

Todas as tarefas de build, desenvolvimento, exportação e ferramentas de referência ficam centralizadas em `deno.jsonc`.

| Task | Comando | Descrição |
|------|---------|-----------|
| `build` | `deno run -A ./esbuild.ts` | Bundle da UI + Service Worker para produção |
| `dev` | `deno task --cwd packages/server dev` | Inicia servidor de desenvolvimento |
| `export` | `deno run --allow-read --allow-write ./export.ts` | Gera snapshot do código fonte |
| `taskjuggler` | `tj3 --no-color` | Executa o TaskJuggler original (Ruby gem) |
| `check` | `deno check build.ts esbuild.ts export.ts tests/**/*.ts` | Type check dos scripts e testes |
| `test` | `deno test --allow-env --allow-net tests/` | Executa a suíte de testes |

**Uso fora do diretório do projeto:**

```bash
deno task --config ~/github/syntaxmesh/deno.jsonc build
deno task --config ~/github/syntaxmesh/deno.jsonc dev
deno task --config ~/github/syntaxmesh/deno.jsonc export
deno task --config ~/github/syntaxmesh/deno.jsonc taskjuggler
```

**Uso dentro do diretório do projeto:**

```bash
deno task build
deno task dev
deno task export
deno task taskjuggler
```

---