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

# 21. Critério de conclusão de cada fase

Uma fase não será considerada concluída apenas porque o código funciona.

Ela deverá possuir:

```text
Código
+
Testes
+
Documentação
+
Lint
+
Formatter
+
Integração
```

Critério:

```bash
deno test
deno lint
deno fmt --check
```

sem erros.