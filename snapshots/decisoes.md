> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém a DOCUMENTAÇÃO de Decisões arquitetônicas fundamentais como ADRs (Architecture Decision Record).
> O projeto é o **SyntaxMesh ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto SyntaxMesh - Modo: DECISOES

Gerado automaticamente em: 9/12/2026, 9:38:55 AM

---

## Arquivo: `docs/syntaxmesh/01-visao.md`

````md
# Visão do projeto

O **SyntaxMesh** é um motor de planejamento e gerenciamento de projetos inspirado nos conceitos e na linguagem do TaskJuggler, porém desenvolvido do zero em **TypeScript**, com execução no navegador e sem necessidade de servidor de aplicação.

O sistema deverá ser capaz de:

* interpretar arquivos de planejamento;
* calcular cronogramas;
* resolver dependências;
* trabalhar com recursos;
* calcular esforço, duração e custos;
* gerar relatórios;
* gerar gráficos de Gantt;
* trabalhar offline;
* armazenar projetos localmente;
* funcionar como PWA;
* permitir edição de arquivos de projeto;
* utilizar IndexedDB e OPFS via @syntaxmesh/worker-db;
* funcionar em hospedagem estática (no server functions);
* oferecer uma linguagem de projeto multilíngue.

O objetivo não é simplesmente converter o código Ruby do TaskJuggler para TypeScript.

O objetivo é criar uma **implementação independente**, compatível conceitualmente com o modelo de planejamento do TaskJuggler, utilizando seu comportamento, documentação e exemplos como referência.


## Definição final do projeto

**SyntaxMesh** será:

> Um motor de planejamento de projetos offline, executado integralmente no navegador, escrito em TypeScript e desenvolvido com Deno, capaz de interpretar uma linguagem de planejamento inspirada no TaskJuggler, com sintaxe multilíngue, motor próprio de scheduling, recursos, custos, calendários, relatórios e gráficos de Gantt, funcionando como uma PWA sem necessidade de servidor de aplicação.

A arquitetura central será:

```text
                 ┌─────────────────────┐
                 │      SyntaxMesh      │
                 └──────────┬──────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
       Parser              Core            Report
          │                 │                 │
   ┌──────┼──────┐          │                 │
   ▼      ▼      ▼          │                 │
 English  PT-BR  Outros     │                 │
   │      │      │          │                 │
   └──────┼──────┘          │                 │
          ▼                 │                 │
      Canonical AST ────────┘                 │
                            │                 │
                            ▼                 │
                       Scheduler ─────────────┘
                            │
                            ▼
                         Storage
                            │
                    ┌───────┴───────┐
                    ▼               ▼
                IndexedDB          OPFS
                    │
                    ▼
                  PWA
                    │
                    ▼
                 Browser
```

**Nome oficial do projeto: SyntaxMesh.**

**Objetivo:** construir primeiro um motor sólido e testável; depois uma aplicação completa em cima dele.

````

---

## Arquivo: `docs/syntaxmesh/09-regras-para-ia.md`

```md
# Regras para IA

- Implementar uma tarefa pequena por vez.
- Não implementar várias tarefas simultaneamente.
- Não introduzir Node.js.
- Não introduzir npm.
- Não modificar arquivos fora do escopo da tarefa, exceto se encontrou BUG que deve ser listado para corrigir dentro da tarefa competente anterior
- Core não pode importar DOM.
- Parser não pode conter lógica de UI.
- Storage não pode contaminar Core.
- Idioma não pode contaminar Core.
- Toda funcionalidade nova precisa de teste.
- Decisões arquitetônicas relevantes devem ser registradas em `docs/syntaxmesh/decisoes/` como ADR (Architecture Decision Record).
```

---

## Arquivo: `docs/syntaxmesh/decisoes/001-core-independente-do-dom.md`

````md
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
````

---

## Arquivo: `docs/syntaxmesh/decisoes/002-parser-isolado-da-logica-de-ui.md`

```md
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
```

---

## Arquivo: `docs/syntaxmesh/decisoes/003-storage-nao-contamina-core.md`

````md
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
````

---

## Arquivo: `docs/syntaxmesh/decisoes/004-idioma-nao-contamina-core.md`

````md
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
````

---

## Arquivo: `docs/syntaxmesh/decisoes/005-typescript-deno-browser-only.md`

```md
# 005 — Stack: TypeScript + Deno + Browser only

## Contexto

O SyntaxMesh precisa de uma stack unificada para desenvolvimento, testes e build. A escolha da stack afeta todo o ecossistema: package.json, node_modules, CI e dependências.

**Alternativas consideradas:**

- A) Node.js + npm + TypeScript (ecossistema Node)
- B) Deno + TypeScript + Web APIs (sem package.json)

## Decisão

Adotado a alternativa **B**: **TypeScript + Deno apenas. Browser only. Nada de Node.js.**

- **Linguagem:** TypeScript (todos os arquivos `.ts` / `.tsx`)
- **Runtime:** Deno (desenvolvimento, testes, lint, format, build)
- **Target:** Browser nativo (PWA, Web APIs, Web Workers)
- **UI:** Preact + Signals + BeerCSS
- **Storage:** IndexedDB (`idb-keyval`) + OPFS `@syntaxmesh/worker-db`

Proibido usar: Node.js, npm, yarn, pnpm, package.json, node_modules.

Deno é utilizado como:
- ambiente de desenvolvimento
- executor TypeScript
- executor de testes (`deno test`)
- lint (`deno lint`)
- formatter (`deno fmt`)
- tarefas de build (`build.ts`, `esbuild.ts`)

## Consequências

### Positivas
- Zero configuração de package.json / node_modules
- Single tooling (`deno.json` configura tudo)
- TypeScript nativo no Deno (sem `tsc` separado)
- Bundle do browser via esbuild integrado
- Coerência total entre desenvolvimento e produção

### Negativas / Riscos
- Dependências externas precisam ser importadas via URL (ex: `esm.sh`, `npm:`)
- Alguns pacotes podem exigir workarounds para funcionar no Deno
- Ecossistema mais enxuto que npm (menos pacotes prontos)

### Observações
- Documentado em `docs/syntaxmesh/02-principios.md` (seção *TypeScript + Deno*)
- Documentado em `docs/syntaxmesh/00-index.md` (Regras globais)

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
```

---

## Arquivo: `docs/syntaxmesh/decisoes/006-build-pipeline-deno-tasks.md`

````md
# 006 — Build pipeline: deno task build / dev / export / taskjuggler

## Contexto

O projeto usa um arquivo de configuração Deno (`deno.jsonc`) como ponto único de configuração para todas as tarefas de automação. Não há `package.json`, `npm scripts` ou `Makefile`.

As tasks principais expostas são:

| Task | Comando | Descrição |
|------|---------|-----------|
| `build` | `deno run -A ./esbuild.ts` | Bundle da UI + Service Worker para produção (usa esbuild) |
| `dev` | `deno task --cwd packages/server dev` | Inicia servidor de desenvolvimento (em `packages/server`) |
| `export` | `deno run --allow-read --allow-write ./export.ts` | Gera snapshot do código fonte para distribuição/inspeção |
| `taskjuggler` | `tj3 --no-color ` | Executa o TaskJuggler original (binário Ruby `tj3`) |

## Decisão

Centralizar todas as tarefas de build, dev, export e ferramentas de referência no `deno.jsonc` sob a seção `"tasks"`.

```jsonc
"tasks": {
  "test": "deno test --allow-env --allow-net tests/",
  "check": "deno check build.ts esbuild.ts export.ts tests/**/*.ts",
  "tests": "deno task check && deno task test",
  "dev": "deno task --cwd packages/server dev",
  "start": "deno task --cwd packages/server start",
  "export": "deno run --allow-read --allow-write ./export.ts",
  "build": "deno run -A ./esbuild.ts",
  "build:deno": "deno run --unstable-bundle -A ./build.ts",
  "taskjuggler": "tj3 --no-color "
}
```

**Regras de uso:**

- Sempre invocar com `--config ~/github/syntaxmesh/deno.jsonc` quando fora do diretório do projeto
- Dentro do projeto (`~/github/syntaxmesh`), apenas `deno task <nome>`
- Tasks que precisam de permissões usam `-A` (todas) ou flags específicas (`--allow-read --allow-write`)

## Consequências

### Positivas
- Um único arquivo configura tudo (tasks, imports, compilerOptions, workspace)
- TypeScript nativo no Deno — sem `tsc` separado
- Tasks declarativas, versionadas e reproduzíveis
- `taskjuggler` task permite comparar comportamento com a implementação original

### Negativas / Riscos
- `tj3` (Ruby gem) deve estar instalado no sistema host
- `build:deno` usa `--unstable-bundle` (API experimental)
- Workspace Deno (`deno.jsonc` raiz) exige estrutura de packages compatível

### Observações
- `esbuild.ts` usa `@deno/esbuild-plugin` para bundling da UI (Preact + Signals + BeerCSS)
- `export.ts` gera snapshots do código fonte (útil para IA, documentação, auditoria)
- `packages/server` contém o servidor de desenvolvimento estático (PWA)

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
````

---

## Arquivo: `docs/syntaxmesh/decisoes/007-workspace-deno-packages.md`

````md
# 007 — Workspace Deno com packages independentes

## Contexto

O projeto é um monorepo Deno com múltiplos packages internos que precisam ser importados uns pelos outros. O `deno.jsonc` raiz define o workspace e as dependências compartilhadas.

## Decisão

Configurar `"workspace"` no `deno.jsonc` raiz apontando para cada package:

```jsonc
"workspace": [
  "./packages/worker-db",
  "./packages/server",
  "./packages/ui",
  "./packages/utils",
  "./packages/service-worker"
]
```

Cada package tem seu próprio `deno.jsonc` (ou `deno.json`) com `"name"` e `"exports"` próprios.

O `deno.jsonc` raiz também define:
- `"catalog"` para versões compartilhadas (ex: `esbuild`, `wrangler`)
- `"imports"` para dependências externas comuns (`@std/fs`, `@std/path`, `esbuild`)
- `"compilerOptions"` globais (strict, jsx: react-jsx para Preact)

## Consequências

### Positivas
- Packages podem importar uns aos outros via nomes lógicos (`@syntaxmesh/core`, `@syntaxmesh/parser`, etc.)
- Versões de dependências externas centralizadas no catálogo
- Type checking unificado com `deno check` na raiz
- Publicação independente de cada package para JSR/npm futura

### Negativas / Riscos
- Estrutura de diretórios fixa (packages/ como filhos diretos)
- Mudança de workspace exige atualização no root `deno.jsonc`
- `nodeModulesDir: "auto"` e `vendor: true` geram pasta `vendor/` no root

### Observações
- Package `@vanaware/syntaxmesh` (raiz) exporta `./esbuild.ts` como entry point
- `@syntaxmesh/worker-db` isola IndexedDB/OPFS via Web Worker
- `@syntaxmesh/ui` contém a aplicação Preact + Signals + BeerCSS

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
````

---

## Arquivo: `docs/syntaxmesh/decisoes/008-biblioteca-de-testes-std-testing-bdd-padrao.md`

````md
# 008 — Biblioteca de testes padrão: `@std/testing/bdd`

## Contexto

O projeto possui múltiplos pacotes (`@syntaxmesh/core`, `@syntaxmesh/parser`, `@syntaxmesh/utils`, `@syntaxmesh/worker-db`, `@syntaxmesh/ui`, etc.) e cada um tinha um padrão de testes diferente:

- `packages/worker-db/tests/` → `Deno.test({ name, fn })` direto + `@std/assert`
- `packages/utils/tests/esbuild/` → `describe`/`it` de `@std/testing/bdd` + `@std/assert`

Esta inconsistência dificulta:

- Aprendizado de novos desenvolvedores
- Reuso de helpers e fixtures entre pacotes
- Manutenção de testes de forma consistente
- Integração com ferramentas de cobertura (ex: cobertura por teste)

**Alternativas consideradas:**

- A) Manter dois estilos (Deno.test direto e BDD) conforme o pacote
- B) Adotar `Deno.test()` direto como padrão em todos os pacotes
- C) Adotar `describe`/`it` de `@std/testing/bdd` como padrão em todos os pacotes

## Decisão

Adotado a alternativa **C**: **`@std/testing/bdd` é o padrão para todos os testes do projeto.**

Novos testes devem usar:

```ts
import { describe, it } from "@std/testing/bdd";
import { assertEquals, assert, assertNotEquals } from "@std/assert";

describe("myFeature", () => {
  it("deve fazer algo", () => {
    assertEquals(actual, expected);
  });
});
```

**Regras:**

- Todo teste novo usa `describe`/`it`
- Todo teste novo usa `@std/assert` para assertions
- `Deno.test()` direto é permitido apenas para migração gradual de pacotes antigos
- Não se deve misturar `Deno.test()` direto e `describe`/`it` no mesmo arquivo
- Helpers e fixtures devem ser escritos para funcionar com o padrão BDD

## Consequências

### Positivas
- Um único padrão para todos os pacotes
- Testes mais organizados por funcionalidade
- Melhor documentação automática (nomes dos testes)
- Facilita migração futura de pacotes antigos
- Alinha com convenções comuns de JavaScript/TypeScript

### Negativas / Riscos
- `packages/worker-db/tests/` ainda usam `Deno.test()` direto (migração gradual)
- `describe`/`it` adiciona uma camada extra de abstração
- Algumas pessoas preferem `Deno.test()` direto por ser mais simples

### Observações
- Documentado em `docs/syntaxmesh/06-testes-e-processo.md` (seção *Convenção de biblioteca de testes*)
- O padrão já está presente em `packages/utils/tests/esbuild/` e `packages/utils/tests/export/`

---

**Status:** Aceito  
**Data:** 2026-09-08  
**Autor(es):** Vanaware (desenvolvedor do projeto)
````

---

## Arquivo: `docs/syntaxmesh/decisoes/README.md`

````md
# Decisões Arquitetônicas (ADR)

Este diretório armazena **Architecture Decision Records (ADRs)** — decisões técnicas importantes que afetam a arquitetura, design ou processo do SyntaxMesh.

## Quando criar um ADR

Crie um ADR quando a decisão:

- Afeta múltiplos pacotes ou camadas (Core, Parser, Report, Storage, UI)
- Envolve trade-offs não triviais (performance vs. simplicidade, compatibilidade vs. inovação)
- Define convenções que outros desenvolvedores devem seguir
- Resolve um bug difícil ou comportamento inesperado
- Introduz ou remove uma dependência significativa
- Altera o formato de dados, API pública ou contrato entre módulos

## Formato do arquivo

Nome: `NNN-titulo-kebab-case.md` (ex: `001-core-independente-do-dom.md`)

Estrutura:

```markdown
# Título da Decisão

## Contexto

Qual o problema ou oportunidade que motivou esta decisão?
Quais foram as alternativas consideradas?

## Decisão

O que foi decidido? Seja específico e acionável.

## Consequências

### Positivas
- Benefício 1
- Benefício 2

### Negativas / Riscos
- Custo/Trade-off 1
- Mitigação planejada

### Neutras / Observações
- Detalhe de implementação
- Referência a issues, PRs ou discussões relacionadas

---

**Status:** Aceito / Proposto / Obsoleto / Substituído por NNN
**Data:** YYYY-MM-DD
**Autor(es):** Nome(s)
```

## Lista de ADRs

## Lista de ADRs

| ID | Título | Status | Data |
|---|---|---|---|
| 001 | Core independente de DOM e Storage | Aceito | 2026-09-08 |
| 002 | Parser isolado da lógica de UI | Aceito | 2026-09-08 |
| 003 | Storage não contamina Core | Aceito | 2026-09-08 |
| 004 | Idioma não contamina Core (AST canônica) | Aceito | 2026-09-08 |
| 005 | Stack: TypeScript + Deno + Browser only | Aceito | 2026-09-08 |
| 006 | Build pipeline: deno task build / dev / export / taskjuggler | Aceito | 2026-09-08 |
| 007 | Workspace Deno com packages independentes | Aceito | 2026-09-08 |
| 008 | Biblioteca de testes: `@std/testing/bdd` padrão | Aceito | 2026-09-08 |
| 009 | RichText mantido, Markdown futuro | Aceito | 2026-09-11 |
| 010 | worker-db centraliza storage | Aceito | 2026-09-11 |
| 011 | Port fiel do TaskJuggler | Aceito | 2026-09-11 |
| 012 | TjTime em TypeScript | Aceito | 2026-09-11 |
| 013 | Flag global `compat.keepRubyBugs` para bugs do Ruby | Aceito | 2026-09-12 |
| 014 | Attribute mode global em TypeScript | Aceito | 2026-09-12 |
| 015 | Metaprogramação em PropertyTreeNode | Aceito | 2026-09-12 |

> **Nota:** Manter esta tabela atualizada manualmente ou via script ao adicionar novos ADRs.

````

---

## Arquivo: `docs/syntaxmesh/decisoes/009-richtext-mantido-markdown-futuro.md`

```md
# RichText mantido, Markdown futuro

## Contexto

O formato de arquivo `.tjp` do TaskJuggler usa RichText (similar a MediaWiki markup) para descrições de tarefas, recursos e outros elementos. Durante a Fase 1, identificamos que o SyntaxMesh precisava suportar tanto o formato legado do TaskJuggler quanto um formato going-forward mais moderno.

## Decisão

Manter o RichText como formato legado para compatibilidade com arquivos `.tjp` existentes, enquanto introduz o Markdown como formato going-forward para conteúdo nativo do SyntaxMesh.

- `@syntaxmesh/richtext` implementa fielmente o RichText do TJ 3.8.4 para leitura e escrita de arquivos `.tjp`.
- `@syntaxmesh/markdown` (novo) é o formato going-forward para conteúdo nativo criado dentro do SyntaxMesh.
- Ambos coexistem no ecossistema. O RichText será depreciado lentamente em favor do Markdown para novos projetos.
- Conversores entre RichText e Markdown serão implementados em fases futuras para facilitar a migração.

## Consequências

### Positivas
- Compatibilidade total com arquivos `.tjp` existentes do TaskJuggler
- Uso de Markdown (formato amplamente conhecido) para novo conteúdo
- Separação clara entre preocupações de legado e inovação
- Comunidade já familiarizada com sintaxe Markdown

### Negativas / Riscos
- Duplicação de esforço em dois parsers de markup (RichText e Markdown)
- Necessidade de conversores para migração entre formatos
- Complexidade adicional na camada de armazenamento e exportação

### Neutras / Observações
- A decisão é um trade-off entre compatibilidade e modernidade
- O RichText será mantido indefinidamente para arquivos legado
- Novos projetos podem usar exclusivamente Markdown desde o início
- Esta decisão valida a criação dos pacotes `@syntaxmesh/richtext` e `@syntaxmesh/markdown` no ADR 009

---

**Status:** Aceito
**Data:** 2026-09-11
**Autor(es):** Vanaware
```

---

## Arquivo: `docs/syntaxmesh/decisoes/010-worker-db-centraliza-storage.md`

```md
# worker-db centraliza storage

## Contexto

O SyntaxMesh precisa de armazenamento persistente para projetos, configurações e arquivos associados. As APIs disponíveis no navegador são IndexedDB e OPFS (Origin Private File System), ambas com interfaces assíncronas e específicas do navegador. O Core do SyntaxMesh deve permanecer independente dessas APIs para ser executável em Deno, Web Workers e testes.

## Decisão

Centralizar toda interação com IndexedDB e OPFS através do pacote `@syntaxmesh/worker-db`, que atua como uma camada de abstração sobre essas APIs de armazenamento.

- O `@syntaxmesh/worker-db` expõe uma interface simples `KeyValueStore` com métodos `get`, `set`, `del`, `keys`, etc.
- O `@syntaxmesh/storage` consome exclusivamente a interface do `worker-db`, nunca acessando `idb-keyval` ou OPFS diretamente.
- O Core nunca importa nada relacionado a storage ou worker-db.
- Trocar entre IndexedDB e OPFS (ou adicionar novos backends) não afeta as camadas superiores (storage, Core, etc.).
- Testes do Storage podem usar um fake do `worker-db` para isolamento.

## Consequências

### Positivas
- Fronteira clara entre lógica de aplicação e detalhes de armazenamento
- Independência do Core em relação a APIs de navegador
- Facilidade de troca ou atualização de mecanismos de storage
- Testabilidade aprimorada através de injeção de dependência/fakes
- Conformidade com ADR 001 (Core independente de DOM) e ADR 003 (Storage não contamina Core)

### Negativas / Riscos
- Indireção adicional na camada de storage
- Necessidade de manter e atualizar o worker-db conforme APIs evoluem
- Sobrecarga mínima de performance devido à camada adicional

### Neutras / Observações
- Esta decisão valida e expande o conceito introduzido no ADR 003
- O worker-db se torna um ponto único de verdade para todas as operações de storage
- Facilita a implementação de recursos como backup, sincronização e versionamento
- A interface KeyValueStore pode ser expandida com operações avançadas (transactions, índices) conforme necessário

---

**Status:** Aceito
**Data:** 2026-09-11
**Autor(es):** Vanaware
```

---

## Arquivo: `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md`

```md
# Port fiel do TaskJuggler

## Contexto

O SyntaxMesh é uma implementação independente inspirada no TaskJuggler 3.8.4. A decisão inicial era implementar com arquitetura própria. Após análise mais profunda, ficou claro que a fidelidade ao comportamento original é mais importante que a originalidade da arquitetura.

## Decisão

Portar **fielmente** o algoritmo, classes e semântica do TaskJuggler 3.8.4 do Ruby para TypeScript/Deno.

- Adaptações Ruby → TypeScript apenas quando a linguagem exigir (ex: `method_missing` → Proxy, blocos → funções de callback).
- Golden tests comparativos (`tj3` real vs `tj3-ts`) são o critério de aceite principal.
- Não inventar arquitetura nova onde o TJ já tem solução estabelecida.
- A estrutura de diretórios do Core espelha `lib/taskjuggler/` do TJ original.
- Nomes de classes e métodos permanecem em inglês (consistentes com o código fonte original).

## Consequências

### Positivas
- Comportamento idêntico ao TaskJuggler original
- Compatibilidade garantida com arquivos `.tjp` existentes
- Validação direta via golden tests
- Redução de riscos de bugs por divergência de comportamento

### Negativas / Riscos
- Limitação criativa para inovações arquiteturais
- Dependência de decisões de design do TJ original (mesmo que subótimas)
- Esforço adicional para mapear conceitos Ruby → TypeScript

### Neutras / Observações
- Esta decisão **substitui** o plano anterior de "implementação independente com arquitetura própria"
- A fidelidade é comportamental, não textual (não é um wrapper ou binding)
- O código fonte do TJ 3.8.4 (`docs/taskjuggler/`) é a principal referência
- A decisão não afeta a camada de UI, que pode ter sua própria arquitetura

---

**Status:** Aceito
**Data:** 2026-09-11
**Autor(es):** Vanaware
```

---

## Arquivo: `docs/syntaxmesh/decisoes/012-tjtime-typescript.md`

````md
# 012 — TjTime em TypeScript

## Contexto

O `TjTime.rb` do TaskJuggler usa `Time` do Ruby + `ENV['TZ']` global para representar timestamps. TypeScript/JavaScript não tem equivalente direto:

- Não há `Time` nativo com precisão de segundos estável
- Não há variável de ambiente global equivalente a `ENV['TZ']`
- `Date` é mutável e tem semântica de timezone inconsistente
- `Temporal` ainda não está estável no Deno

Além disso, o código Ruby contém **bugs conhecidos** que afetam o output. Precisamos decidir: replicar (para paridade com `tj3`) ou corrigir.

## Decisão

### Representação

- `TjTime` armazena `private readonly seconds: number` (inteiro, segundos desde epoch **UTC**)
- Nunca expõe `Date` na API pública
- Precisão de **segundos** (granularidade mínima do TJ é 1 minuto)

### Timezone

- Estado module-level `currentTimeZone: string` (default `'UTC'`)
- `setTimeZone(zone)` retorna timezone anterior
- Helper `Intl.DateTimeFormat` para offset e partes locais
- Replica `ENV['TZ']` global do Ruby (documentado: **não thread-safe**)

### Factory methods

Construtor privado. Factory estáticos substituem o construtor polimórfico do Ruby:

```
TjTime.now()                                 → tempo atual
TjTime.fromSeconds(secs)                     → segundos desde epoch
TjTime.fromDate(date)                        → Date → TjTime
TjTime.fromString(str)                       → "YYYY-MM-DD[-HH:MM[:SS][-TZ]]"
TjTime.fromParts(y, m, d, h, min, s, tz?)    → partes + timezone
```

### Parsing

Formato: `YYYY-MM-DD[-HH:MM[:SS][-TZ]]`, split em até **5 partes** por `-`.

Validações:
- Ano: 1970–2035
- Mês: 1–12
- Dia: 1–`lastDayOfMonth(month, year)`
- Hora: 0–23, Minuto: 0–59, Segundo: 0–59
- Timezone: `±HHMM`, range `[-1200, +1400]`

Timezone presente → `Time.utc` + subtrair offset. Ausente → `currentTimeZone`.

Mensagens de erro **idênticas** ao Ruby (incluindo `)` final faltante do erro de range).

### `strftime` mínimo

Suporta apenas: `%Y %m %d %H %M %S %A %a %B %b %z %Q %%`.

`%Q` = quarter (extensão TJ). Formatos fora da lista lançam `TjArgumentError`.

### Operações

Comparação, aritmética, normalizações, avanços, diferenças e timezone — todos seguindo o Ruby fielmente (com exceção dos bugs, abaixo).

### `deep_clone` e imutabilidade

`TjTime` é imutável (todas as operações retornam novo). `deepClone(tjtime)` retorna `tjtime` (mesma referência).

## Bugs do Ruby: replicar ou corrigir?

O código Ruby do TJ 3.8.4 contém bugs conhecidos. Dividimos em 3 categorias.

### Categoria A — Latentes (sempre corrigir)

Nunca disparam em uso normal. Corrigir é invisível para o usuário.

| Bug | Comportamento Ruby | Correção TS |
|---|---|---|
| `Interval#combine` tipo inconsistente | Retorna `[Interval]` em 2 branches, `Interval` no 3º | Retorna `Interval` sempre |
| `Scoreboard#idxToDate` typo `kdx` | `NameError` se `forceIntoProject && idx < 0` | Usa `idx` corretamente |
| `WorkingHours.@days` shared array | 7 referências ao mesmo `[]` | `Array.from({length:7}, () => [])` |

**Decisão:** sempre corrigir. Não há flag. Registrar divergência aqui.

### Categoria B — Afetam output (flag global)

Produzem resultados diferentes em casos legítimos. Precisamos de paridade com `tj3` **e** opção de correção.

| Bug | Ruby faz | Correto seria |
|---|---|---|
| `TjTime#sameTimeNextMonth` clamp em mês antigo | `2024-01-31 → 2024-03-02` (rollover) | `2024-01-31 → 2024-02-29` |
| `TjTime#sameTimeNextQuarter` sem clamp | `2024-01-31 → 2024-05-01` (rollover) | `2024-01-31 → 2024-04-30` |
| `TjTime#sameTimeNextYear` sem clamp | `2024-02-29 → 2025-03-01` | `2024-02-29 → 2025-02-28` |
| `Integer#round` para `-X.5` | `-2.5.round == -3` | `-2.5.round == -2` (JS native) |
| `TjTime#to_s` usa `sec` original | Formato depende do UTC original | Usar sec local |
| `Scoreboard#collectIntervals` sentinel `0` | Slots que começam em 0 são deslocados | Usar `-1` como sentinel |

**Decisão:** flag global.

```ts
// packages/core/src/compat.ts
export const compat = {
  /**
   * Quando `true` (default), replica bugs do TaskJuggler 3.8.4 para
   * garantir paridade bit-a-bit em golden tests.
   *
   * Quando `false`, aplica comportamento corrigido.
   */
  keepRubyBugs: true,
};
```

Cada método afetado:

```ts
sameTimeNextMonth(): TjTime {
  if (compat.keepRubyBugs) {
    // comportamento Ruby (bug)
  } else {
    // comportamento corrigido
  }
}
```

Golden tests: não trocam a flag (default `true`).
Produção: usuário troca em `main.tsx` se quiser comportamento corrigido.

### Categoria C — Documentados no Ruby (sempre replicar)

Não são bugs — são comportamentos documentados.

| Comportamento | Justificativa |
|---|---|
| `Interval#compareTo` retorna 0 em overlap | Documentado: "only works for non-overlapping intervals" |
| `String#to_i` retorna 0 em string inválida | Comportamento canônico do Ruby |
| `Time.mktime` faz rollover em dia inválido | Comportamento documentado do `Time` |
| `Integer#round` half-up em positivos | Mesmo que `Math.round` |

**Decisão:** replicar sempre. Sem flag.

## Alternativas consideradas

- **`Temporal`**: API moderna, mas ainda fase 3 no Deno
- **`luxon` / `date-fns-tz`**: dependência externa, desnecessária
- **Sem flag, sempre replicar bugs**: mais simples, mas engessa o usuário
- **Flag por método**: poluído demais

## Consequências

### Positivas

- Comportamento idêntico ao `TjTime.rb` (validado por golden tests)
- Sem dependências externas
- API imutável e determinística
- Paridade com `tj3` **por padrão**, correção opcional
- Bugs documentados como ADR (rastreáveis)

### Negativas / Riscos

- Precisão limitada a segundos
- Estado module-level `currentTimeZone` (documentado — idêntico ao Ruby)
- Flag global muda comportamento em runtime — cuidado em testes que assumem paridade
- Manutenção dupla dos branches `keepRubyBugs: true|false`

### Neutras / Observações

- Golden tests usam `keepRubyBugs: true`
- Usuários podem trocar para `false` em `main.tsx` via `compat.keepRubyBugs = false`
- Quando `Temporal` estabilizar, migração futura possível
- Bugs de Categoria A são divergências documentadas (não rastreáveis por flag)
- Ver `docs/syntaxmesh/cheat-sheet-ruby-ts.md` §12 para lista completa

---

**Status:** Aceito
**Data:** 2026-09-11
**Autor(es):** Vanaware
````

---

## Arquivo: `docs/syntaxmesh/decisoes/013-compat-flag-ruby-bugs.md`

````md
# 013 — Flag global `compat.keepRubyBugs` para bugs do Ruby

## Contexto

O TaskJuggler 3.8.4, escrito em Ruby, contém **bugs conhecidos** que afetam o output de datas, formatação numérica e contagem de intervalos. O ADR 011 estabelece que o SyntaxMesh deve ser um **port fiel**, com paridade bit-a-bit validada por golden tests contra o `tj3` real.

Isso cria uma tensão:

- **Fidelidade**: replicar o comportamento do Ruby, mesmo quando buggy, para garantir que arquivos `.tjp` existentes produzam cronogramas idênticos.
- **Correção**: usuários novos podem querer comportamento correto, especialmente em casos onde o bug produz resultados visivelmente errados (ex: `2024-01-31 + 1 mês = 2024-03-02`).

Além disso, bugs têm **naturezas diferentes**:

- Alguns **nunca disparam** em uso normal (código morto, typos em branches raros).
- Outros **afetam output** em casos legítimos.
- Outros são **comportamentos documentados** que parecem bugs mas não são.

Sem uma política clara, cada fase decide localmente, gerando inconsistência.

**Alternativas consideradas:**

- **A) Sempre corrigir bugs.** Quebra paridade com `tj3`, invalida golden tests.
- **B) Sempre replicar bugs.** Engessa o usuário, força comportamento errado em produção.
- **C) Flag global `keepRubyBugs` + categorização.** Complexidade adicional, mas permite os dois.
- **D) Flag por método.** Poluído, difícil de manter.
- **E) Flag por classe.** Melhor que D, mas ainda fragmenta a decisão.

## Decisão

Adotado a alternativa **C**: uma **flag global** `compat.keepRubyBugs` combinada com **categorização formal dos bugs** em 3 classes.

### Categorização

Toda divergência entre o Ruby e o TS deve ser classificada em uma das 3 categorias:

#### Categoria A — Latentes (sempre corrigir)

**Definição:** bugs que **nunca disparam** em uso normal, ou que causam crash em branches inalcançáveis.

| Bug | Comportamento Ruby | Correção TS |
|---|---|---|
| `Interval#combine` retorna `[Interval]` em 2 branches, `Interval` no 3º | Tipo inconsistente | Sempre retorna `Interval` |
| `Scoreboard#idxToDate` typo `kdx` | `NameError` se `forceIntoProject && idx < 0` | Usa `idx` corretamente |
| `WorkingHours.@days` compartilha `[]` entre dom/sáb | 7 referências ao mesmo array | `Array.from({length:7}, () => [])` |

**Política:** sempre corrigir. **Sem flag.** Comentário `// RUBY-COMPAT-FIX: <descrição>` no código.

**Golden tests:** comportamento esperado é o **corrigido**. Se o `tj3` diverge, o golden é ajustado com nota.

#### Categoria B — Afetam output (flag `keepRubyBugs`)

**Definição:** bugs que produzem resultados **diferentes** do correto em casos legítimos.

| Bug | Ruby faz | Correto seria |
|---|---|---|
| `TjTime#sameTimeNextMonth` clamp em mês antigo | `2024-01-31 → 2024-03-02` (rollover) | `2024-01-31 → 2024-02-29` |
| `TjTime#sameTimeNextQuarter` sem clamp | `2024-01-31 → 2024-05-01` (rollover) | `2024-01-31 → 2024-04-30` |
| `TjTime#sameTimeNextYear` sem clamp | `2024-02-29 → 2025-03-01` | `2024-02-29 → 2025-02-28` |
| `Integer#round` half-away-from-zero em negativos | `(-2.5).round == -3` | `-2.5 → -2` (JS native) |
| `TjTime#to_s` usa `@time.sec` original | Formato depende do UTC original | Usar sec local |
| `Scoreboard#collectIntervals` sentinel `0` | Slots que começam em 0 são deslocados | Usar `-1` como sentinel |

**Política:** flag global controla o comportamento.

```ts
// packages/core/src/compat.ts
export const compat = {
  /**
   * Quando `true` (default), replica bugs do TaskJuggler 3.8.4 para
   * garantir paridade bit-a-bit em golden tests.
   *
   * Quando `false`, aplica comportamento corrigido.
   *
   * ATENÇÃO: mudar para `false` é uma decisão do usuário e pode
   * quebrar compatibilidade com projetos `.tjp` existentes.
   */
  keepRubyBugs: true,
};
```

Cada método afetado implementa ambos os branches:

```ts
sameTimeNextMonth(): TjTime {
  if (compat.keepRubyBugs) {
    // comportamento Ruby (bug)
  } else {
    // comportamento corrigido
  }
}
```

**Golden tests:** rodam com `keepRubyBugs: true` (default). A Fase 2 complementar (5.14.R.3) adiciona um golden paralelo para `false`, opcional.

**Comentário obrigatório:** `// RUBY-COMPAT-FLAG: <descrição do bug>`.

#### Categoria C — Documentados (sempre replicar)

**Definição:** comportamentos que **parecem bugs** mas são **documentados** no Ruby ou na linguagem.

| Comportamento | Justificativa |
|---|---|
| `Interval#compareTo` retorna 0 em overlap | Documentado: "only works for non-overlapping intervals" |
| `String#to_i` retorna 0 em string inválida | Comportamento canônico do Ruby |
| `Time.mktime` faz rollover em dia inválido | Comportamento documentado de `Time` |
| `Integer#round` half-up em positivos | Mesmo que `Math.round` |

**Política:** sempre replicar. **Sem flag.** Comentário `// RUBY-COMPAT-DOC: <link para doc>`.

### API pública

```ts
// packages/core/src/compat.ts

/**
 * Flag global que controla o comportamento de bugs Categoria B.
 * Ver ADR 013 para detalhes.
 */
export const compat: { keepRubyBugs: boolean } = {
  keepRubyBugs: true,
};

/**
 * Helper para arredondamento de negativos.
 * `Math.round` do JS difere do `Integer#round` do Ruby em `-X.5`.
 */
export function rubyRound(n: number): number {
  if (compat.keepRubyBugs) {
    // Ruby: -2.5.round == -3 (half-away-from-zero)
    return n < 0 ? -Math.round(-n) : Math.round(n);
  }
  return Math.round(n);
}
```

## Política de migração (R5)

Bugs podem **migrar entre categorias** ao longo do tempo. Isso é esperado e precisa de política.

### Migração Categoria B → Categoria A

**Cenário:** um bug B é descoberto como nunca-disparável em prática.

**Ação:**
1. Documentar o caso no ADR 013 (adicionar linha em Categoria A).
2. Remover o branch `if (compat.keepRubyBugs)` do código.
3. Rodar `deno task golden:test` — se golden divergir, ajustar golden com nota.
4. **Breaking change:** usuários com `keepRubyBugs: false` **não são afetados** (já tinham correção). Usuários com `true` veem correção.

**Versionamento:** patch se golden não muda; minor se golden muda.

### Migração Categoria C → Categoria B

**Cenário:** comportamento "documentado" é reclassificado como bug (ex: TJ upstream anuncia fix).

**Ação:**
1. Documentar em Categoria B.
2. Adicionar branch `if (compat.keepRubyBugs)`.
3. **Não é breaking:** usuários com `true` (default) não são afetados.

**Versionamento:** patch.

### Migração Categoria A → Categoria B

**Cenário:** um "fix" da Categoria A é descoberto como divergente do Ruby de forma relevante.

**Ação:**
1. Documentar em Categoria B.
2. Adicionar branch `if (compat.keepRubyBugs)`.
3. **Breaking change:** usuários com `false` que dependiam do fix precisam adaptar.

**Versionamento:** minor.

### Deprecação da flag (2.0)

**Cenário:** uma versão futura quer remover a flag e sempre corrigir.

**Ação:**
1. Release N: emitir warning se `keepRubyBugs: true` for detectado em runtime.
2. Release N+1 (major): flag é **ignorada**. Bugs Categoria B migram para A.

**Versionamento:** major.

## Alternativas consideradas

- **Sem flag, sempre replicar:** paridade perfeita, mas produz resultados errados em produção.
- **Sem flag, sempre corrigir:** rompe golden tests e compatibilidade.
- **Flag por método:** poluído, decisão fragmentada.
- **Flag por classe:** melhor, mas ainda permite inconsistência entre classes relacionadas.
- **Namespace `compat.<classe>.<método>`:** granularidade excessiva.

## Consequências

### Positivas

- **Paridade default:** `tj3` e `tj3-ts` produzem output idêntico por padrão.
- **Flexibilidade:** usuário pode optar por comportamento corrigido.
- **Rastreabilidade:** cada bug documentado na ADR 013 (com link para golden).
- **Consistência:** todos os métodos afetados usam a mesma flag.
- **Categorização explícita:** bugs A nunca veem flag; bugs C nunca são corrigidos.

### Negativas / Riscos

- **Estado global mutável:** `compat.keepRubyBugs` pode ser alterado em runtime. Documentar: alterar apenas em `main.tsx` antes de qualquer parse.
- **Branches duplicados:** cada bug B tem 2 branches para manter.
- **Testes precisam cobrir ambos:** golden tests `true` (obrigatório) + `false` (opcional, Fase 2 complementar 5.14.R.3).
- **Migração A↔B↔C é breaking em alguns casos:** política acima define semver.
- **Não thread-safe:** idêntico ao `AttributeBase._mode` (ADR 014 futuro). Aceito — single-threaded.

### Neutras / Observações

- Bugs Categoria A **não têm flag** — são sempre corrigidos. Documentados aqui como divergências conhecidas.
- Bugs Categoria C **não têm flag** — são comportamento correto.
- A flag **não substitui golden tests** — apenas permite que o usuário final escolha.
- O `tj3` real nunca muda — se um bug for corrigido upstream, isso é uma **nova versão** do TJ, tratada em ADR separada.
- Referência cruzada: cheat sheet Ruby→TS §12 (lista completa de bugs) e §15 (flag).

---

**Status:** Aceito
**Data:** 2026-09-12
**Autor(es):** Vanaware
````

---

## Arquivo: `docs/syntaxmesh/decisoes/014-attribute-mode-global.md`

````md
# 014 — Attribute mode global em TypeScript

## Contexto

O `AttributeBase.rb` do TaskJuggler usa uma **class variable** `@@mode` compartilhada entre `AttributeBase` e todas as suas ~40 subclasses. O `mode` é um inteiro `0`, `1` ou `2` que influencia o comportamento de `set()` e `inherit()`:

- **`mode = 0` (provided):** o valor foi definido pelo usuário (no `.tjp` ou programaticamente). Ao chamar `set()`, a flag `provided` do atributo é marcada como `true`.
- **`mode = 1` (inherited):** o valor veio do pai ou do projeto. Ao chamar `set()`, a flag `inherited` é marcada como `true`.
- **`mode = 2` (computed):** o valor foi calculado pelo scheduler. Ao chamar `set()`, nenhuma flag é marcada (é o resultado de um cálculo interno).

O scheduler alterna entre os modos durante o pipeline:

```
prepareScenario   → AttributeBase.setMode(1)   // herança do pai/projeto
scheduleScenario  → AttributeBase.setMode(2)   // cálculo interno
finishScenario    → AttributeBase.setMode(0)   // volta ao default
```

Isso permite que o mesmo `set()` seja usado em contextos diferentes sem passar uma flag explícita. O `mode` é um estado **global do processo**, não do atributo.

**Problema:** em TypeScript, não existe equivalente direto a `@@classvar` compartilhada entre subclasses. Precisamos decidir como representar esse estado global.

**Alternativas consideradas:**

- **A) `static` em `AttributeBase`.** Simples, direto, herda o mesmo comportamento do Ruby.
- **B) `AsyncLocalStorage`.** Permite concorrência entre projetos no mesmo worker, mas adiciona complexidade e não é necessário nesta fase.
- **C) Context-passing explícito.** `set(value, mode)` — mais verboso, exige mudar ~40 subclasses.
- **D) `Symbol` no valor.** Cada valor carrega seu modo — poluído, quebra a serialização.
- **E) Map global `modeByProperty`.** Cada propriedade tem seu próprio mode — mais granular, mas diverge do Ruby.
- **F) Instância estática por classe.** Cada subclasse tem seu próprio `mode` — diverge do Ruby (que é compartilhado).

## Decisão

Adotado a alternativa **A**: `static` em `AttributeBase`, com getter/setter estáticos.

```ts
// packages/core/src/attributes/attribute-base.ts

export type AttributeMode = 0 | 1 | 2;

export abstract class AttributeBase<T> {
  private static _mode: AttributeMode = 0;

  static get mode(): AttributeMode {
    return AttributeBase._mode;
  }

  static setMode(mode: AttributeMode): void {
    AttributeBase._mode = mode;
  }

  // ... resto dos métodos
}
```

**Regras de uso:**

- `setMode(0)` é o **default**. Sempre resetar em `beforeEach` de testes.
- `setMode(1)` antes de `prepareScenario`, `setMode(2)` antes de `scheduleScenario`.
- Nunca chamar `setMode` durante a construção de atributos (o modo é irrelevante no `constructor`).
- Documentar qualquer uso de `mode` no código com um comentário.

**Relação com o ADR 013 (`compat.keepRubyBugs`):**

São decisões **independentes**:

| Decisão | Escopo | ADR |
|---|---|---|
| `mode` global | Comportamento de `set()`/`inherit()` | **014** (este) |
| `keepRubyBugs` | Comportamento de bugs do Ruby | **013** |

Nenhuma das duas é subconjunto da outra. Podem coexistir sem conflito.

**Relação com o ADR 015 (`PropertyTreeNode`):**

O `PropertyTreeNode` (Fase 4) **não** usa `mode` diretamente. Ele apenas chama `attribute(id)` ou `scenarioAttribute(id)` que criam `AttributeBase` — a leitura de `mode` acontece dentro do `set()` do atributo. Isso mantém a separação de responsabilidades.

## Consequências

### Positivas

- **Simplicidade:** `static get/set` é direto e legível.
- **Paridade com Ruby:** mesmo comportamento de `@@mode` global.
- **Sem boilerplate:** nenhuma subclasse precisa declarar `mode`.
- **Zero overhead:** uma variável estática, sem `AsyncLocalStorage` ou `Map`.
- **Compatibilidade com golden tests:** o pipeline do scheduler segue o mesmo.

### Negativas / Riscos

- **Sem concorrência entre projetos:** dois `Project.schedule()` simultâneos no mesmo worker clobberariam o `mode` um do outro.
  - **Mitigação:** aceito. O SyntaxMesh roda single-threaded no worker. Se concorrência for necessária no futuro, migrar para `AsyncLocalStorage`.
- **Vazamento entre testes:** esquecer `beforeEach(() => AttributeBase.setMode(0))` faz o teste seguinte herdar o modo anterior.
  - **Mitigação:** obrigatório em `beforeEach`/`afterEach` (documentado em `fase-3-tarefas.md` e no preâmbulo).
- **Estado mutável global:** difícil de testar isoladamente.
  - **Mitigação:** testes explícitos cobrindo os 3 modos (tarefa `3.1.5`, `3.1.9`).

### Neutras / Observações

- O `mode` **não é uma preferência do usuário** — é um detalhe interno do pipeline. Nunca deve ser exposto na UI.
- O `mode` **não afeta** `get()`, `reset()`, `isNil()`, `to_s()` — apenas `set()` e `inherit()`.
- A flag `compat.keepRubyBugs` do ADR 013 **não interfere** no `mode`. São decisões ortogonais.
- Ver `docs/taskjuggler/lib/taskjuggler/AttributeBase.rb` linhas 20–40 para o `@@mode` original.
- Ver `docs/tj3-engine/02-bluprint-engine1.md` §2.5 para o pipeline de scheduling.

---

**Status:** Aceito
**Data:** 2026-09-12
**Autor(es):** Vanaware
**Relacionado:** ADR 013 (compat.keepRubyBugs), ADR 015 (PropertyTreeNode)
````

---

## Arquivo: `docs/syntaxmesh/decisoes/015-metaprogramacao-propertytreenode.md`

````md
# 015 — Metaprogramação em PropertyTreeNode

## Contexto

O `PropertyTreeNode.rb` do TaskJuggler usa **duas formas de metaprogramação** que não têm equivalente direto em TypeScript:

### 1. `Hash.new { |h, k| ... }` — lazy attribute creation

O `@attributes` é um `Hash` com um bloco default que **cria o atributo sob demanda** quando acessado:

```ruby
@attributes = Hash.new do |hash, key|
  if (aDef = attributeDefinition(key))
    hash[key] = aDef.objClass.new(self, aDef, self)
  else
    raise TjException.new, "Unknown attribute #{key}"
  end
end
```

Isso permite `@attributes[id]` ser transparente: o `PropertyTreeNode` nunca precisa saber **quais** atributos existem — só consulta o `attributeDefinition(id)` e cria.

O mesmo padrão aparece em `@scenarioAttributes[scenarioIdx]`, mas com um bloco default diferente (busca no `ScenarioData`).

### 2. `method_missing` — delegação automática

O `PropertyTreeNode` delega métodos não encontrados para o `ScenarioData` do cenário ativo:

```ruby
def method_missing(name, *args, &block)
  if @data[@scenarioIdx]
    @data[@scenarioIdx].send(name, *args, &block)
  else
    super
  end
end
```

Isso permite `task.readyForScheduling?(scIdx)` ser resolvido automaticamente para `task.scenarioData(scIdx).readyForScheduling?()`.

O `PTNProxy.rb` usa `method_missing` de forma similar para delegar ao `PropertyTreeNode` original.

**Problema:** TypeScript não tem `Hash.new { }` nem `method_missing`. Precisamos decidir como adaptar essas duas metaprogramações sem perder a semântica.

**Alternativas consideradas para lazy creation:**

- **A) `Proxy` no `PropertyTreeNode`.** Intercepta acessos a atributos. Fiel ao Ruby, mas complexo de debugar e de tipar.
- **B) Método explícito `attribute(id)`.** Cada acesso a atributo passa por um método que cria sob demanda. Explícito, testável.
- **C) Inicialização antecipada.** Criar todos os ~40 atributos no construtor. Simples, mas desperdiça memória (~40 × milhares de propriedades).
- **D) `Map` com getter customizado.** Não resolve a criação sob demanda automaticamente.

**Alternativas consideradas para `method_missing`:**

- **E) `Proxy` no `PropertyTreeNode`.** Intercepta chamadas de método. Fiel ao Ruby, mas mesmos problemas de A.
- **F) Métodos explícitos nas subclasses.** Cada subclasse (`TaskScenario`, `ResourceScenario`) define os métodos que delegam. Mais código, mas explícito.
- **G) Helper `scenarioData(scIdx)`.** Expõe `this.data[scIdx]` publicamente; subclasses chamam `this.scenarioData(scIdx).<method>()`. Compromisso.
- **H) `Object.defineProperty` dinâmico.** Gera métodos em runtime. Complexo, foge do TS idiomático.

## Decisão

### Lazy creation → método `attribute(id)` (alternativa B)

Em vez de `Hash.new { }`, expomos um método explícito:

```ts
class PropertyTreeNode implements AttributeContainer {
  private attributes = new Map<string, AttributeBase<unknown>>();

  /**
   * Retorna (criando sob demanda) o atributo não-scenario-specific `id`.
   */
  attribute(id: string): AttributeBase<unknown> {
    let attr = this.attributes.get(id);
    if (attr === undefined) {
      const aDef = this.attributeDefinition(id);
      if (!aDef) {
        throw new TjArgumentError(`Unknown attribute ${id}`);
      }
      attr = new aDef.objClass(this, aDef, this);
      this.attributes.set(id, attr);
    }
    return attr;
  }

  /**
   * Retorna (criando sob demanda) o atributo scenario-specific `id`.
   */
  private scenarioAttribute(scIdx: number, id: string): AttributeBase<unknown> {
    let attr = this.scenarioAttributes[scIdx]!.get(id);
    if (attr === undefined) {
      const aDef = this.attributeDefinition(id);
      if (!aDef) throw new TjArgumentError(`Unknown attribute ${id}`);
      if (!aDef.scenarioSpecific) throw new TjArgumentError(...);
      attr = new aDef.objClass(this, aDef, this.data[scIdx]!);
      this.scenarioAttributes[scIdx]!.set(id, attr);
    }
    return attr;
  }
}
```

Os métodos públicos (`get`, `set`, `force`, `provided`, `inherited`) usam `attribute(id)` internamente:

```ts
get(id: string): unknown {
  return this.attribute(id).get();
}
```

### `method_missing` → helper `scenarioData(scIdx)` (alternativa G)

Em vez de interceptar métodos inexistentes, subclasses **definem métodos explícitos** que delegam:

```ts
class Task extends PropertyTreeNode {
  scenarioData(scIdx: number): TaskScenario {
    return this.data[scIdx] as TaskScenario;
  }

  // Método delegado explícito (Fase 7)
  readyForScheduling?(scIdx: number): boolean {
    return this.scenarioData(scIdx).readyForScheduling?();
  }

  schedule(scIdx: number): boolean {
    return this.scenarioData(scIdx).schedule();
  }
}
```

**Regras:**

- `scenarioData(scIdx)` é o helper público que substitui `method_missing`.
- Subclasses **não** sobrescrevem `data[]` diretamente — sempre via `scenarioData(scIdx)`.
- Métodos que precisam delegar são **declarados explicitamente** na subclasse.
- O `PTNProxy` (Fase 4, subfase 7.9) **não** usa `Proxy` — implementa os métodos delegados manualmente.

## Consequências

### Positivas

- **Explícito e debugável:** stack traces mostram o método real, não um `Proxy`.
- **Tipagem forte:** `scenarioData(scIdx)` pode ter retorno tipado por subclasse (`TaskScenario`, `ResourceScenario`, etc.).
- **Sem overhead de `Proxy`:** nada de traps em runtime.
- **Testabilidade:** cada método pode ser testado isoladamente.
- **Compatível com deno lint:** sem `any` implícito.

### Negativas / Riscos

- **Mais código:** cada subclasse precisa declarar métodos delegados.
  - **Mitigação:** aceito — a verbosidade é o preço da clareza.
- **Menos transparente:** `task.readyForScheduling?(scIdx)` no Ruby vira `task.readyForScheduling?(scIdx)` em TS — mesma assinatura, mas o desenvolvedor precisa saber que existe um método delegado.
  - **Mitigação:** documentado em cada subclasse.
- **`Proxy` não é usado em nenhum lugar do projeto.**
  - **Regra:** se um caso futuro parecer precisar de `Proxy`, **parar e consultar o autor** antes de implementar.

### Neutras / Observações

- **`AttributeContainer` permanece:** `PropertyTreeNode` e `ScenarioData` implementam `getStoredValue`/`setStoredValue`, e o `AttributeBase` continua armazenando valores neles. Isso **não muda**.
- **`attribute(id)` é `public`:** necessário porque `ScenarioData.attribute(id)` delega para o `PropertyTreeNode` pai.
- **`scenarioAttribute(scIdx, id)` é `private`:** só o `PropertyTreeNode` cria atributos scenario-specific.
- **`data[scIdx]` é `readonly`** e sempre do tipo `ScenarioData` (não `ScenarioData | null`) após o construtor rodar. Subclasses fazem narrowing via `scenarioData(scIdx)`.
- **`PTNProxy`** (Fase 4, subfase 7.9) **não** usa `Proxy` — expõe métodos delegados manualmente (`get`, `set`, `level`, `isChildOf?`, `getIndicies`, `logicalId`).
- Ver `docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb` para o `Hash.new` original.
- Ver `docs/taskjuggler/lib/taskjuggler/PTNProxy.rb` para o `method_missing` do proxy.

---

**Status:** Aceito
**Data:** 2026-09-12
**Autor(es):** Vanaware
**Relacionado:** ADR 014 (attribute mode), ADR 012 (TjTime)
````

---

## Arquivo: `docs/syntaxmesh/03-arquitetura.md`

````md
# Execução offline

O SyntaxMesh deverá funcionar completamente sem servidor de aplicação.

Arquitetura:

```text
                  Navegador
                     │
              ┌──────▼──────┐
              │ SyntaxMesh  │
              │    PWA      │
              └──────┬──────┘
                     │
       ┌─────────────┼─────────────┐
       │             │             │
       ▼             ▼             ▼
   IndexedDB       OPFS        Cache API
       │             │             │
       └─────────────┼─────────────┘
                     │
                  Offline
```

O servidor de hospedagem terá apenas a função de entregar arquivos estáticos.

Não deverá existir:

```text
Browser → Application Server → Database
```

A arquitetura desejada é:

```text
Browser
   │
   ├── Application
   ├── Core
   ├── Parser
   ├── Reports
   ├── IndexedDB, OPFS no @syntaxmesh/worker-db
   └── Service Worker
```

## Arquitetura geral

A arquitetura principal será:

```text
SyntaxMesh
│
├── core
├── parser
├── language
├── richtext
├── markdown
├── report
├── storage
├── worker-db
├── utils
├── service-worker
├── ui
└── server
```

### Core

Responsável pelo modelo e processamento do planejamento.

Não poderá depender de:

* Preact;
* BeerCSS;
* DOM;
* window;
* document;
* worker-db com IndexedDB e OPFS;
* Service Worker.

O Core deverá ser executável em:

* navegador;
* Web Worker;
* Deno;
* testes automatizados.

#### Divisão detalhada do Core

O Core deve ser totalmente independente de DOM.

```text
packages/core/src/
├── mod.ts
├── errors.ts
│
├── model/
│   ├── project.ts
│   ├── task.ts
│   ├── resource.ts
│   ├── account.ts
│   ├── scenario.ts
│   ├── calendar.ts
│   ├── dependency.ts
│   ├── constraint.ts
│   └── assignment.ts
│
├── time/
│   ├── duration.ts
│   ├── effort.ts
│   ├── date-range.ts
│   └── date-math.ts
│
├── calendar/
│   ├── workweek.ts
│   ├── holiday.ts
│   ├── workday.ts
│   └── calendar-resolver.ts
│
├── scheduling/
│   ├── graph.ts
│   ├── cycle-detection.ts
│   ├── topological-order.ts
│   ├── scheduler.ts
│   └── scheduler-result.ts
│
├── resources/
│   ├── availability.ts
│   ├── allocation.ts
│   └── conflicts.ts
│
├── accounting/
│   ├── cost.ts
│   ├── revenue.ts
│   └── balance.ts
│
├── scenarios/
│   ├── scenario.ts
│   └── scenario-comparison.ts
│
├── expressions/
│   ├── expression.ts
│   ├── evaluator.ts
│   └── operators.ts
│
└── validation/
    ├── validation-error.ts
    ├── validation-result.ts
    └── validate-project.ts
```

#### Regra importante

Nenhum arquivo dentro de `packages/core/src/` deve importar:

```ts
import ... from "preact";
import ... from "beercss";
import ... from "idb-keyval";
```

Também não deve usar:

```ts
document
window
navigator
localStorage ou indexedDB
```

Exceção apenas se for tipo Web API isolada e necessária, mas idealmente Core não usa.



### Parser

Responsável por:

* lexer;
* tokens;
* gramática;
* AST;
* análise semântica;
* validação;
* linguagem;
* tradução de palavras-chave para uma representação canônica.

#### Divisão detalhada do Parser

O Parser deve transformar texto em AST e depois em Core Model.

```text
packages/parser/src/
├── mod.ts
│
├── language/
│   ├── types.ts
│   ├── canonical.ts
│   ├── registry.ts
│   ├── en.ts
│   ├── pt-BR.ts
│   └── es.ts
│
├── lexer/
│   ├── token.ts
│   ├── token-type.ts
│   ├── lexer.ts
│   └── lexer-errors.ts
│
├── ast/
│   ├── node.ts
│   ├── project-node.ts
│   ├── task-node.ts
│   ├── resource-node.ts
│   ├── report-node.ts
│   ├── dependency-node.ts
│   ├── effort-node.ts
│   ├── duration-node.ts
│   └── source-location.ts
│
├── parser/
│   ├── parser.ts
│   ├── parser-context.ts
│   ├── project-parser.ts
│   ├── task-parser.ts
│   ├── resource-parser.ts
│   ├── dependency-parser.ts
│   ├── effort-parser.ts
│   ├── duration-parser.ts
│   └── report-parser.ts
│
├── semantic/
│   ├── symbol-table.ts
│   ├── semantic-errors.ts
│   ├── validate-ast.ts
│   ├── resolve-dependencies.ts
│   └── ast-to-core.ts
│
└── diagnostics/
    ├── diagnostic.ts
    └── diagnostic-list.ts
```

em docs/webjuggler temos um exemplo de tjp parser e utils em typescript para usarmos como referência

### Report

Responsável por:

* modelo de relatório;
* filtros;
* colunas;
* agrupamentos;
* Gantt;
* HTML;
* CSV;
* JSON;
* futuras formas de exportação.

##### Divisão detalhada de Report

```text
packages/report/src/
├── mod.ts
│
├── model/
│   ├── report.ts
│   ├── column.ts
│   ├── row.ts
│   ├── cell.ts
│   ├── filter.ts
│   └── grouping.ts
│
├── builders/
│   ├── task-report-builder.ts
│   ├── resource-report-builder.ts
│   └── cost-report-builder.ts
│
├── filters/
│   ├── task-filter.ts
│   ├── resource-filter.ts
│   ├── period-filter.ts
│   ├── status-filter.ts
│   └── hierarchy-filter.ts
│
├── gantt/
│   ├── gantt-model.ts
│   ├── gantt-task.ts
│   ├── gantt-dependency.ts
│   ├── gantt-scale.ts
│   └── gantt-svg.ts
│
└── export/
    ├── json.ts
    ├── csv.ts
    └── html.ts
```

### Storage

Responsável por persistência local:

* IndexedDB;
* OPFS;
* arquivos;
* projetos;
* configurações;
* importação;
* exportação.

#### Divisão detalhada de Storage

Storage deve ser isolado e não deve contaminar o Core.    
Utiliza o @syntaxmesh/worker-db e algumas funções ficarão em @syntaxmesh/utils.    
A hierarquia abaixo pode sofrer mudanças para acomodar as funções em utils

```text
packages/storage/src
├── mod.ts
├── types.ts
│
├── db/
│   ├── worker-db-client.ts
│   ├── project.ts
│   ├── settings.ts
│   └── files.ts
│
├── projects/
│   ├── project-service.ts
│   ├── project-summary.ts
│   ├── autosave.ts
│   └── recovery.ts
│
└── transfer/
    ├── import-tjp.ts
    ├── export-tjp.ts
    └── download.ts
```

#### Recomendação

Crie um wrapper para o `worker-db`:

```text
packages/storage/src/db/worker-db-client.ts
```

Assim o restante do código não depende diretamente da biblioteca.

Exemplo conceitual:

```ts
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}
```

---

### App

Responsável pela interface.

Tecnologias:

* Preact;
* Signals;
* BeerCSS;
* Web APIs.

#### Divisão detalhada da aplicação

A aplicação é a camada mais externa.

```text
packages/ui/src/
├── main.tsx
├── app.tsx
│
├── signals/
│   ├── ui.ts
│   ├── project.ts
│   ├── editor.ts
│   ├── parser.ts
│   ├── report.ts
│   └── settings.ts
│
├── components/
│   ├── Toolbar.tsx
│   ├── Sidebar.tsx
│   ├── StatusBar.tsx
│   ├── ProjectTree.tsx
│   ├── ErrorList.tsx
│   ├── LanguageSelector.tsx
│   └── ThemeAware.tsx
│
├── views/
│   ├── EditorView.tsx
│   ├── ReportView.tsx
│   ├── GanttView.tsx
│   ├── SettingsView.tsx
│   └── ProjectExplorerView.tsx
│
├── services/
│   ├── engine-service.ts
│   ├── parser-service.ts
│   ├── scheduler-service.ts
│   ├── report-service.ts
│   └── storage-service.ts
│
└── workers/
    ├── engine.worker.ts
    └── engine-client.ts
```

---

### Divisão detalhada de linguagem multilíngue

Essa parte é crítica e deve ficar bem isolada.

```text
packages/language/src
├── types.ts
├── canonical.ts
├── registry.ts
├── en.ts
├── pt-BR.ts
└── es.ts
```

#### `types.ts`

Responsável por definir:

```ts
export interface LanguageDefinition {
  id: string;
  name: string;
  keywords: Record<string, string[]>;
  units: Record<string, string[]>;
}
```

#### `canonical.ts`

Responsável por normalizar palavras.

Exemplo conceitual:

```ts
export type CanonicalKeyword =
  | "project"
  | "task"
  | "resource"
  | "depends"
  | "effort"
  | "duration"
  | "report";
```

#### `registry.ts`

Responsável por registrar idiomas.

Exemplo conceitual:

```ts
export class LanguageRegistry {
  get(id: string): LanguageDefinition {}
  register(language: LanguageDefinition): void {}
}
```

#### `en.ts`, `pt-BR.ts`, `es.ts`

Cada arquivo contém apenas um idioma.


### Divisão detalhada de RichText e Markdown

```text
packages/richtext/src
├── mod.ts
├── parser.ts
├── serializer.ts
└── types.ts

packages/markdown/src
├── mod.ts
├── parser.ts
├── serializer.ts
└── types.ts
```

O `@syntaxmesh/richtext` implementa o formato RichText do TaskJuggler (similar a MediaWiki markup) para compatibilidade com arquivos `.tjp` existentes.

O `@syntaxmesh/markdown` implementa o formato Markdown como formato going-forward para conteúdo nativo do SyntaxMesh.

Ambos coexistem. O RichText será depreciado lentamente em favor do Markdown para novos projetos. Conversores entre os formatos serão implementados em fases futuras.


## Estrutura de diretórios

Estrutura inicial proposta:

```text
syntaxmesh/
│
├── deno.json
├── README.md
├── LICENSE
│
├── packages/
│   │
│   ├── core/src
│   │   ├── model/
│   │   ├── calendar/
│   │   ├── scheduling/
│   │   ├── accounting/
│   │   ├── resources/
│   │   ├── scenarios/
│   │   ├── expressions/
│   │   └── validation/
│   │
│   ├── parser/src
│   │   ├── lexer/
│   │   ├── grammar/
│   │   ├── ast/
│   │   ├── parser/
│   │   ├── semantic/
│   │   └── language/
│   │       ├── language.ts
│   │       ├── english.ts
│   │       ├── portuguese-br.ts
│   │       └── spanish.ts
│   │
│   ├── report/src
│   │   ├── model/
│   │   ├── filters/
│   │   ├── columns/
│   │   ├── gantt/
│   │   ├── html/
│   │   ├── csv/
│   │   └── json/
│   │
│   ├── storage/src
│   │   ├── indexeddb/
│   │   ├── opfs/
│   │   └── projects/
│   │
│   └── ui/src
│       ├── components/
│       ├── signals/
│       ├── views/
│       ├── workers/
│       └── main.tsx
```
Subpastas /tests dentro de cada package. ex: `packages/core/tests/`    

Somente uma subpasta public em:    
```
├── packages/ui/public/
│   ├── index.html
│   ├── manifest.json
│   └── icons/
``` 
Pasta de exemplos em docs:
```
└── docs/examples/
    ├── minimal.tjp
    └── tutorial.tjp
```
---

## Regra arquitetural mais importante

O fluxo de dependências deve ser sempre aproximadamente:

```text
APP
 │
 ├───────────────┐
 ▼               ▼
REPORT         STORAGE
 │
 ▼
CORE
 ▲
 │
PARSER
```

Mas o Core nunca deverá depender de:

```text
APP
REPORT
STORAGE
DOM
IndexedDB, OPFS
Preact
BeerCSS
```

O objetivo é poder executar:

```ts
import { ... } from "./src/core/...";
```

diretamente no Deno e nos testes.

Decisões arquitetônicas fundamentais estão documentadas em `docs/syntaxmesh/decisoes/` como ADRs (Architecture Decision Record).

## Divisão dos testes

Testes devem espelhar os módulos.

```text
packages/
├── core/tests
│   ├── project_test.ts
│   ├── task_test.ts
│   ├── duration_test.ts
│   ├── effort_test.ts
│   ├── calendar_test.ts
│   ├── dependency_test.ts
│   ├── scheduler_test.ts
│   ├── cycle_detection_test.ts
│   └── cost_test.ts
│
├── parser/tests
│   ├── lexer_test.ts
│   ├── parser_minimal_test.ts
│   ├── parser_effort_test.ts
│   ├── parser_dependency_test.ts
│   ├── language_registry_test.ts
│   ├── language_equivalence_test.ts
│   └── semantic_validation_test.ts
│
├── report/tests
│   ├── task_report_test.ts
│   ├── filter_test.ts
│   ├── csv_export_test.ts
│   ├── json_export_test.ts
│   └── gantt_svg_test.ts
│
├── storage/tests
│   ├── project_repository_fake_test.ts
│   ├── opfs_fake_test.ts
│   ├── autosave_test.ts
│   └── recovery_test.ts
``` 
Testes de integração na pasta tests raiz:
``` 
tests/integration/
    ├── mvp_ptbr_test.ts
    ├── mvp_en_test.ts
    └── mvp_es_test.ts
```
````

---

