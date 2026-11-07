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

## Ferramenta internacional em inglês (fase atual)

Decisão 2026-11-07: durante a consolidação do engine/CLI/extensão do TaskJuggler, o SyntaxMesh é uma ferramenta **English-first em todas as superfícies que emite**:

- Todas as **saídas** do código — mensagens de erro/aviso (`MessageHandler`, envelope `messages`), `help`, `version`, `man`, templates e corpo de emails de sheets, rótulos de interface de CLI — são **exclusivamente em inglês**. Nada de respostas do código em português ou espanhol nesta etapa.
- O **i18n de keywords (Fase 10) é capacidade de entrada**: projetos `.smx`/`.tjp` com `language "pt-BR"` / `"es"` continuam sendo parseados (regra zero, goldens F21, corpus multilíngue). A diretiva `language` afeta **somente** o parsing do arquivo — nunca o idioma em que o tool responde.
- ⚠️ **Parser pt-BR/es é experimental** (decisão 2026-11-07): vocabulário, sinônimos, unidades e cobertura de `man`/help estão **sujeitos a mudanças**. A **recomendação atual** é usar o **parser original em inglês** — `en` é a única superfície estável auditada pela regra zero (ADR 011) e a via recomendada nos goldens F21. Os fixtures pt/es permanecem como **piso de compatibilidade**, não como superfície publicitada. Ver `04-linguagem-multilingue.md`.
- Consolidar o SyntaxMesh como ferramenta **internacional em inglês primeiro**; multilíngue de **saída/interface** é expansão futura (UI da Fase 20; adendo PT/ES da Fase 22 pós-Fase 21), sempre como adendo, nunca desvio silencioso.

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
deno task --config ~/github/syntaxmesh/deno.jsonc tests
```

**Uso dentro do diretório do projeto:**

```bash
deno task build
deno task dev
deno task export
deno task taskjuggler
```

---