# Configuração do deno.jsonc para Fase 1

## Contexto

A configuração do deno.jsonc no root do projeto precisava ser atualizada para suportar as necessidades da Fase 1 (Fundação e Workspace Deno). Requisitos específicos incluíam:

1. Adicionar três novos pacotes (language, richtext, markdown) ao workspace
2. Incluir catálogo de dependências para todas as bibliotecas padrão (@std/assert, @std/testing, @std/fs, @std/path, @std/collections)
3. Adicionar dependências para preact e idb-keyval
4. Atualizar as configurações de lint e fmt para corresponder às especificações da Fase 1
5. Adicionar tarefa `check-all` para validação completa
6. Corrigir configurações de lineWidth (80) e singleQuote (false) no fmt

## Decisão

Atualizar o deno.jsonc raiz com as seguintes mudanças:

1. **Workspace**: Adicionar `language`, `richtext`, `markdown` aos pacotes listados
2. **Catálogo**: Adicionar entradas para @std/assert, @std/testing, @std/fs, @std/path, @std/collections, preact e idb-keyval
3. **Imports**: Adicionar @std/assert, @std/testing/bdd e @std/collections às importações
4. **Tasks**: Adicionar `fmt-check`, `lint-fix` e `check-all` (que combina check + lint + fmt + test)
5. **Fmt**: Corrigir lineWidth para 80, singleQuote para false, e atualizar include/exclude padrões
6. **Lint**: Manter configuração existente com regras recomendadas

## Consequências

### Positivas
- Workspace completo com todos os pacotes necessários
- Configuração consistente com especificações da Fase 1
- Validação completa através da tarefa check-all
- Formatação e linting padronizados

### Negativas / Riscos
- Atualização da configuração pode afetar pipelines de CI existentes
- Mais dependências no catálogo aumentam tempo de resolução
- Tarefa check-all pode demorar mais para executar

### Neutras / Observações
- Configuração segue as especificações exatas da Fase 1
- Manutenção do estilo e formatação consistentes
- Suporte para desenvolvimento rápido com tarefas úteis

---

**Status:** Aceito
**Data:** 2026-09-10
**Autor(es):** Qwen Code