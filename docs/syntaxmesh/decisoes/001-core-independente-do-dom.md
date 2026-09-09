# 001 — Core independente de DOM e Storage

## Contexto

O SyntaxMesh deve ser executado em múltiplos ambientes: navegador, Web Worker, Deno e testes automatizados. O Core contém o modelo de domínio e o scheduler — a lógica mais crítica e reutilizável do projeto.

Se o Core depender de `window`, `document`, IndexedDB, OPFS ou bibliotecas de UI (Preact, BeerCSS), ele **não poderá ser importado diretamente no Deno** para testes, nem executado em Web Workers.

**Alternativas consideradas:**

- A) Permitir importações leves de DOM no Core (ex: `window` para detecção de ambiente)
- B) Isolar totalmente o Core, injetando dependências via interfaces

## Decisão

Adotado a alternativa **B**: **o Core não importa nada de DOM, Preact, BeerCSS, IndexedDB, OPFS ou `idb-keyval`.**

```ts
// NÃO permitido em packages/core/src/
import ... from "preact";
import ... from "beercss";
import ... from "idb-keyval";
document; window; navigator; localStorage; indexedDB;
```

Se o Core precisar de funcionalidades de ambiente (ex: leitura de arquivos), deve-se:
- Definir uma interface (ex: `FileSystemPort`)
- Ter a implementação fornecida pelo *caller* (Storage, UI, Worker)

## Consequências

### Positivas
- Core é executável diretamente no Deno: `import { ... } from "./src/core/..."`
- Testes de Core rodam sem mocks de DOM
- Core pode rodar em Web Workers sem importações condicionais
- Storage e UI podem evoluir independentemente

### Negativas / Riscos
- Interfaces de infraestrutura precisam ser definidas cuidadosamente
- Maior verbosidade em pontos de integração (injeção de dependências)

### Observações
- Documentado em `docs/syntaxmesh/03-arquitetura.md` (seção *Regra arquitetural mais importante*)
- Reforçado por `docs/syntaxmesh/09-regras-para-ia.md`: "Core não pode importar DOM."

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)