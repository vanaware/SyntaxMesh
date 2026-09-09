# 003 — Storage não contamina Core

## Contexto

A camada de Storage (@syntaxmesh/storage / @syntaxmesh/worker-db) lida com IndexedDB, OPFS e arquivos. O Core (@syntaxmesh/core) é puro e sem dependências de infraestrutura.

Se o Core importar diretamente `idb-keyval` ou APIs de OPFS:

- Core se torna acoplado a storage
- Testes do Core exigem IndexedDB mockado
- Core não roda em Deno sem polyfills

**Alternativas consideradas:**

- A) Deixar Core usar IndexedDB diretamente para persistência de cálculos
- B) Manter Storage totalmente separado; Core é sempre in-memory

## Decisão

Adotado a alternativa **B**: **Storage não contamina Core.** O fluxo de dados é:

```
Browser
   │
Storage  ←→  Core Model  ←→  Scheduler
   │                    ↑
   └────────────────────┘
         (apenas dados, nunca importações)
```

- **Core** produz apenas modelos em memória
- **Storage** persiste projetos, autosave e arquivos via `@syntaxmesh/worker-db`
- Core **nunca** importa `idb-keyval`, `OPFS`, `localStorage` etc.

## Consequências

### Positivas
- Core mantém dependências mínimas (zero)
- Storage pode migrar de IndexedDB para OPFS sem tocar Core
- Testes de Core são puros e rápidos
- Web Worker pode conter apenas Core + Parser (sem Storage)

### Negativas / Riscos
- Projetos grandes precisam de estratégia de memória (Core carrega tudo na RAM)
- Autosave exige cópia de dados entre Worker e main thread

### Observações
- Documentado em `docs/syntaxmesh/09-regras-para-ia.md`: "Storage não pode contaminar Core."
- `docs/syntaxmesh/03-arquitetura.md` recomenda wrapper `worker-db-client.ts` para isolar a API da biblioteca

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)