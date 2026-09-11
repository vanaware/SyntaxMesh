# Novos pacotes: language, richtext, markdown

## Contexto

Durante a Fase 1 (Fundação e Workspace Deno), identificamos três novos pacotes essenciais que estavam ausentes da estrutura monorepo:

- `language`: Processamento de linguagem e análise léxica
- `richtext`: Manipulação de rich text e formatação
- `markdown`: Conversão e processamento de Markdown

Esses pacotes são necessários para suportar as funcionalidades principais do SyntaxMesh, mas não estavam presentes no workspace inicial.

## Decisão

Criar três novos pacotes no workspace Deno:

1. **@syntaxmesh/language** - Processamento de linguagem, análise léxica e construção de AST
2. **@syntaxmesh/richtext** - Manipulação de rich text, formatação e estruturas de conteúdo
3. **@syntaxmesh/markdown** - Conversão de Markdown para rich text e processamento de sintaxe

Cada pacote terá:
- `deno.jsonc` com configuração adequada
- `mod.ts` como ponto de entrada
- Testes unitários e de integração
- Dependências apropriadas

## Consequências

### Positivas
- Estrutura modular completa com todos os pacotes necessários
- Cada pacote pode evoluir independentemente
- Melhor separação de preocupações
- Suporte completo para processamento de linguagem, rich text e Markdown

### Negativas / Riscos
- Aumento da complexidade do workspace (12 pacotes no total)
- Mais arquivos de configuração para manter
- Possível duplicação de código entre pacotes relacionados

### Neutras / Observações
- Pacotes criados com configurações mínimas para permitir desenvolvimento rápido
- Testes de integração criados para validar a estrutura do workspace
- ADR 007 (Workspace Deno com packages independentes) validado com esta expansão

---

**Status:** Aceito
**Data:** 2026-09-10
**Autor(es):** Qwen Code