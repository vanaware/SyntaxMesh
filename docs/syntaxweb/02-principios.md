 # 2. Princípios fundamentais

O desenvolvimento deverá obedecer às seguintes regras.

## 2.1 TypeScript + Deno

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

---

# 15. Estratégia de testes

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

---

# 16. Regra de desenvolvimento incremental

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

---