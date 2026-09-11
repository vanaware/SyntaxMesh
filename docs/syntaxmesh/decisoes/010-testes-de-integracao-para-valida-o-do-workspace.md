# Testes de integração para validação do workspace

## Contexto

Após a expansão do workspace com três novos pacotes (language, richtext, markdown), identificamos a necessidade de testes de integração robustos que validem:

1. A estrutura completa do workspace Deno
2. A regra de isolamento do Core (ADR 001)
3. A funcionalidade básica de importação de todos os pacotes principais

Esses testes garantem que o workspace funcione como um todo coeso e que as decisões arquitetônicas sejam respeitadas.

## Decisão

Criar três testes de integração no diretório `tests/integration/`:

1. **workspace_test.ts** - Valida que todos os pacotes esperados estão presentes e têm configurações adequadas
2. **core_isolation_test.ts** - Verifica que o Core respeita a regra de isolamento (sem DOM, Preact, BeerCSS, IndexedDB, OPFS, window, document, navigator, localStorage)
3. **smoke_test.ts** - Testa a importação básica de todos os pacotes principais para garantir que estão funcionais

Esses testes seguem o padrão BDD (@std/testing/bdd) conforme definido no ADR 008.

## Consequências

### Positivas
- Validação automatizada da estrutura do workspace
- Garantia de que as regras de isolamento do Core são respeitadas
- Verificação rápida da saúde do sistema (smoke test)
- Testes de integração que crescem com o workspace

### Negativas / Riscos
- Testes de integração podem ser mais lentos que testes unitários
- Manutenção de testes que validam estrutura em vez de comportamento
- Possível necessidade de atualizações quando novos pacotes são adicionados

### Neutras / Observações
- Testes seguem o padrão BDD para consistência
- Testes são independentes e podem ser executados em qualquer ordem
- Testes documentam as decisões arquitetônicas (ADR 001, ADR 007, ADR 008)

---

**Status:** Aceito
**Data:** 2026-09-10
**Autor(es):** Qwen Code