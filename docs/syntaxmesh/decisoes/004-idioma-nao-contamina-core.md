# 004 — Idioma não contamina Core (AST canônica)

## Contexto

O SyntaxMesh suporta multilíngue (English, Português-BR, Español). O Core precisa de uma representação única para que o scheduler, relatórios e validações funcionem independentemente do idioma do arquivo `.tjp`.

Se o Core tivesse que conhecer palavras em vários idiomas:

- Cada módulo (Core, Report, UI) precisaria de dicionários
- Adicionar um novo idioma exigiu mudanças em Core
- Testes precisariam cobrir todas as variantes de idioma

**Alternativas consideradas:**

- A) Core conhece todas as palavras-chave em todos os idiomas
- B) Parser traduz tudo para uma AST canônica; Core nunca vê idiomas

## Decisão

Adotado a alternativa **B**: **Idioma não contamina Core.** O fluxo é:

```
                 SyntaxMesh
                     │
              ┌──────▼──────┐
              │ Language    │
              │ Dictionary  │
              └──────┬──────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
     English     Português      Outros
        │            │            │
        └────────────┼────────────┘
                     ▼
                  Lexer
                     │
                     ▼
                  Parser
                     │
                     ▼
                    AST canônica
                     │  (idioma transparente)
                     ▼
                   Core
```

- O Parser, com a ajuda do `LanguageRegistry`, converte palavras-chave do idioma do arquivo para **canonical keywords** (ex: `tarefa` → `task`)
- A AST resultante usa apenas strings canônicas
- O Core nunca importa ni sabe de `en.ts`, `pt-BR.ts` ou `es.ts`

## Consequências

### Positivas
- Adicionar um novo idioma: apenas novo arquivo em `packages/language/src/` + registro
- Core, Report e testes são 100% independentes de idioma
- AST comparison entre idiomas (ex: inglês vs português produzem a mesma AST)
- UI seleciona idioma do projeto separadamente do idioma da interface

### Negativas / Riscos
- Parser precisa de dicionário completo e bem testado
- Tradução reversa (.tjp → linguagem-alvo) requer mapeamento adicional (não exigido no MVP)

### Observações
- Documentado em `docs/syntaxmesh/04-linguagem-multilingue.md` (seção *Representação canônica*)
- Documentado em `docs/syntaxmesh/09-regras-para-ia.md`: "Idioma não pode contaminar Core."

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)