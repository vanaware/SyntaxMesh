# 002 — Parser isolado da lógica de UI

## Contexto

O Parser transforma texto `.tjp` em AST e depois em Core Model. Ele precisa de cobertura total de testes e potencialmente em execução em Web Workers. Se o Parser conhecer Preact, BeerCSS, DOM ou Signals, ele:

- Não será testado sem mocks de UI
- Não será movido para Web Workers sem refatoração
- Criará acoplamento artificial com a camada de apresentação

**Alternativas consideradas:**

- A) Permitir que o Parser retorne componentes Preact diretamente
- B) Parser produz apenas AST/Core Model; UI consome via *service*

## Decisão

Adotado a alternativa **B**: **o Parser não contém lógica de UI.** Ele produz apenas:

1. **AST** (estrutura de nós com localização de origem)
2. **Core Model** (tipos do `@syntaxmesh/core`)
3. **Diagnostics** (lista de erros com localização)

A UI consome o Parser via `@syntaxmesh/parser-service`, que atua como adaptador entre o Parser e os Signals/Preact.

## Consequências

### Positivas
- Parser é testável 100% no Deno
- Parser pode rodar em Web Worker sem mudanças
- UI pode trocar de framework sem tocar o Parser
- Mensagens de erro são formatadas pela UI, não pelo Parser

### Negativas / Riscos
- A camada de serviço (`parser-service`) precisa ser mantida como adaptador
- Ajustes de UX (ex: realce de sintaxe) exigem mapeamento AST → posição no texto

### Observações
- Documentado em `docs/syntaxmesh/09-regras-para-ia.md`: "Parser não pode conter lógica de UI."
- A arquitetura proposta em `docs/syntaxmesh/03-arquitetura.md` já contempla `parser-service.ts` em `packages/ui/src/services/`

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)