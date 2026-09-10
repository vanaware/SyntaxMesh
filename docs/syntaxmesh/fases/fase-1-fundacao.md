# Fase 1 — Fundação e Workspace Deno

> **Arquivo:** `docs/syntaxmesh/fases/fase-1-fundacao.md`
> **Status:** ✅ Concluída (revisada e consolidada em 2026-09-10)
> **Duração estimada:** 1–2 dias
> **Depende de:** nada
> **Bloqueia:** todas as fases subsequentes

---

## 1. Contexto

O SyntaxMesh é um monorepo Deno com múltiplos packages internos que precisam ser importados uns pelos outros via nomes lógicos (`@syntaxmesh/core`, `@syntaxmesh/parser`, etc.). Sem uma fundação bem definida — workspace, imports, tasks de qualidade, convenções de teste — todas as fases subsequentes ficam frágeis.

Esta fase estabelece:

1. **Workspace Deno** com `deno.jsonc` raiz e `deno.jsonc` por package.
2. **Estrutura de packages** espelhando a arquitetura em camadas (Core, Parser, Language, RichText, Markdown, Report, Storage, UI, Service Worker, Worker-DB, Utils).
3. **Quality pipeline** com `deno test`, `deno lint`, `deno fmt`.
4. **Padrão de testes** único (`@std/testing/bdd` + `@std/assert`).
5. **ADRs consolidados** cobrindo todas as decisões arquiteturais tomadas até agora.
6. **Documentação de suporte** (princípios, arquitetura, roadmap, MVP).

Esta fase **não implementa lógica de negócio**. Ela apenas prepara o terreno para que as fases 2+ possam ser desenvolvidas de forma incremental, testável e com fronteiras arquiteturais claras.

---

## 2. Objetivo

Ao final desta fase:

- `deno task test`, `deno task lint`, `deno task fmt` executam sem erros.
- Todos os packages existem com `deno.jsonc` próprio e exportam `mod.ts`.
- A regra "Core não importa DOM/Preact/BeerCSS/IndexedDB/OPFS" é **verificável** por teste automatizado.
- Existe um teste smoke que importa todos os `mod.ts` de todos os packages.
- Toda decisão arquitetural relevante tem um ADR registrado.

---

## 3. Arquivos e estrutura de referência

### 3.1 Estrutura de diretórios alvo

```text
syntaxmesh/
├── deno.jsonc                          ← workspace, catalog, imports, tasks
├── README.md
├── LICENSE
├── esbuild.ts
├── build.ts
├── export.ts
│
├── packages/
│   ├── core/
│   │   ├── deno.jsonc
│   │   ├── mod.ts
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── parser/
│   │   ├── deno.jsonc
│   │   ├── mod.ts
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── language/
│   │   ├── deno.jsonc
│   │   ├── mod.ts
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── richtext/
│   │   ├── deno.jsonc
│   │   ├── mod.ts
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── markdown/
│   │   ├── deno.jsonc
│   │   ├── mod.ts
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── report/
│   │   ├── deno.jsonc
│   │   ├── mod.ts
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── storage/
│   │   ├── deno.jsonc
│   │   ├── mod.ts
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── worker-db/
│   │   ├── deno.jsonc
│   │   ├── mod.ts
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── utils/
│   │   ├── deno.jsonc
│   │   ├── mod.ts
│   │   ├── src/
│   │   └── tests/
│   │
│   ├── service-worker/
│   │   ├── deno.jsonc
│   │   ├── mod.ts
│   │   └── src/
│   │
│   └── ui/
│       ├── deno.jsonc
│       ├── mod.ts
│       ├── src/
│       └── public/
│           ├── index.html
│           ├── manifest.json
│           └── icons/
│
├── tests/
│   └── integration/
│       ├── workspace_test.ts
│       ├── core_isolation_test.ts
│       └── smoke_test.ts
│
└── docs/
    ├── syntaxmesh/
    │   ├── 00-index.md
    │   ├── 01-visao.md
    │   ├── 02-principios.md
    │   ├── 03-arquitetura.md
    │   ├── 04-linguagem-multilingue.md
    │   ├── 05-formato-e-compatibilidade.md
    │   ├── 06-testes-e-processo.md
    │   ├── 07-roadmap.md
    │   ├── 08-mvp.md
    │   ├── 09-regras-para-ia.md
    │   ├── 10-futuro.md
    │   ├── decisoes/                    ← ADRs
    │   │   ├── README.md
    │   │   ├── 001-core-independente-do-dom.md
    │   │   ├── 002-parser-isolado-da-logica-de-ui.md
    │   │   ├── 003-storage-nao-contamina-core.md
    │   │   ├── 004-idioma-nao-contamina-core.md
    │   │   ├── 005-typescript-deno-browser-only.md
    │   │   ├── 006-build-pipeline-deno-tasks.md
    │   │   ├── 007-workspace-deno-packages.md
    │   │   ├── 008-biblioteca-de-testes-std-testing-bdd-padrao.md
    │   │   ├── 009-richtext-mantido-markdown-futuro.md  ← NOVO
    │   │   ├── 010-worker-db-centraliza-storage.md     ← NOVO
    │   │   └── 011-port-fiel-taskjuggler.md            ← NOVO
    │   │
    │   └── fases/
    │       ├── fase-1-fundacao.md
    │       ├── fase-2-tempo-geometria.md
    │       └── ...
    │
    ├── taskjuggler/                     ← gema Ruby de referência
    ├── tj3-engine/                      ← blueprints
    └── Learning/                        ← MWEs
```

### 3.2 Arquivos já existentes (verificar)

- `deno.jsonc` raiz — verificar se contém: `workspace`, `catalog`, `imports`, `tasks`, `compilerOptions`, `fmt`, `lint`.
- `packages/*/deno.jsonc` — verificar se cada um tem `name`, `version`, `exports`.
- `docs/syntaxmesh/decisoes/` — verificar se ADRs 001–008 existem.

### 3.3 Arquivos a criar (se faltarem)

- `packages/language/deno.jsonc` + `mod.ts` (novo — i18n de keywords).
- `packages/richtext/deno.jsonc` + `mod.ts` (novo — compatibilidade TJP).
- `packages/markdown/deno.jsonc` + `mod.ts` (novo — going-forward).
- ADRs 009, 010, 011.
- `tests/integration/workspace_test.ts`.
- `tests/integration/core_isolation_test.ts`.
- `tests/integration/smoke_test.ts`.

---

## 4. Subfases detalhadas

Cada subfase segue o formato de `docs/syntaxmesh/fases/modelo-tarefas.md`:
**Contexto → Objetivo → Arquivos → Requisitos → Referências → Fora de escopo → Critério de aceite → Testes**.

---

### 4.1 — Configuração do workspace raiz (`deno.jsonc`)

#### Contexto

O `deno.jsonc` raiz é o ponto único de configuração do monorepo. Ele define:
- `workspace[]` — lista de packages que compõem o workspace.
- `catalog` — versões compartilhadas de dependências externas.
- `imports` — dependências comuns (`@std/*`, `esbuild`, `preact`, etc.).
- `tasks` — comandos de automação (`test`, `lint`, `fmt`, `check`, `dev`, `build`, `taskjuggler`).
- `compilerOptions` — `strict`, `jsx: react-jsx`, etc.
- `fmt` e `lint` — configurações globais.

#### Objetivo

Garantir que o `deno.jsonc` raiz esteja completo e consistente com todas as decisões arquiteturais.

#### Arquivos

- `deno.jsonc` (raiz)

#### Requisitos

- [ ] `workspace` lista **todos** os packages: `core`, `parser`, `language`, `richtext`, `markdown`, `report`, `storage`, `worker-db`, `utils`, `service-worker`, `ui`, `server`.
- [ ] `catalog` define versões de: `esbuild`, `wrangler`, `preact`, `@std/assert`, `@std/testing`, `@std/fs`, `@std/path`, `@std/collections`, `idb-keyval`.
- [ ] `imports` inclui os prefixos de `@std/*` e `@syntaxmesh/*`.
- [ ] `tasks` define no mínimo:
  - `test`: `deno test --allow-env --allow-net tests/ packages/`
  - `lint`: `deno lint`
  - `fmt`: `deno fmt`
  - `check`: `deno check **/*.ts`
  - `tests`: `deno task check && deno task lint && deno task test && deno task fmt --check`
  - `dev`: `deno task --cwd packages/server dev`
  - `build`: `deno run -A ./esbuild.ts`
  - `taskjuggler`: `tj3 --no-color`
- [ ] `compilerOptions` com `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `jsx: "react-jsx"`, `jsxImportSource: "preact"`.
- [ ] `fmt` com `lineWidth: 80`, `indentWidth: 2`, `singleQuote: false`.
- [ ] `lint` com `rules.tags` apropriadas.

#### Referências

- `docs/syntaxmesh/decisoes/006-build-pipeline-deno-tasks.md` — formato exato das tasks.
- `docs/syntaxmesh/decisoes/007-workspace-deno-packages.md` — formato do `workspace[]`, `catalog`, `imports`.
- `docs/syntaxmesh/02-principios.md` — TypeScript + Deno, sem Node.js.
- `docs/syntaxmesh/03-arquitetura.md` — lista de packages e camadas.

#### Fora de escopo

- Configuração de CI remota (GitHub Actions, etc.) — fica para a subfase 4.6.
- Configuração de tasks específicas de deployment — fica para a Fase 20 (PWA).
- Configuração de coverage (`deno coverage`) — adiado.

#### Critério de aceite

```bash
deno task test    # passa (sem testes ainda, mas sem erro)
deno task lint    # passa
deno task fmt     # passa
deno task check   # passa
```

#### Testes

- `tests/integration/workspace_test.ts`:
  - `describe("deno.jsonc raiz")`
  - `it("declara workspace com todos os packages")`
  - `it("declara catalog com versões das deps externas")`
  - `it("declara tasks obrigatórias")`
  - `it("compilerOptions em modo estrito")`

---

### 4.2 — Estrutura de packages (pastas + `mod.ts`)

#### Contexto

Cada package deve existir como diretório próprio com `deno.jsonc`, `mod.ts` (entry point público) e subpastas `src/` e `tests/`. O `mod.ts` exporta a API pública do package; `src/` contém a implementação; `tests/` espelha `src/`.

#### Objetivo

Criar os 12 packages com estrutura mínima para que fases subsequentes possam preencher `src/` sem precisar mexer na infraestrutura.

#### Arquivos

Para **cada** package (exceto os já existentes):

- `packages/<nome>/deno.jsonc`
- `packages/<nome>/mod.ts`
- `packages/<nome>/src/.gitkeep` (placeholder)
- `packages/<nome>/tests/.gitkeep` (placeholder)

#### Requisitos

- [ ] Cada `deno.jsonc` de package segue o formato:
  ```jsonc
  {
    "name": "@syntaxmesh/<nome>",
    "version": "0.0.0",
    "exports": {
      ".": "./mod.ts"
    }
  }
  ```
- [ ] Cada `mod.ts` é vazio (ou com comentário `// TODO: implementar na fase X`).
- [ ] Estrutura de subpastas `src/` e `tests/` consistente entre packages.
- [ ] Package `ui` tem também `public/` com `index.html`, `manifest.json`, `icons/`.

#### Referências

- `docs/syntaxmesh/03-arquitetura.md` — divisão detalhada de cada package (core, parser, report, storage, ui, language).
- `docs/syntaxmesh/decisoes/007-workspace-deno-packages.md` — formato de `deno.jsonc` por package.

#### Fora de escopo

- Implementação real de qualquer `mod.ts` — cada fase preenche o seu.
- Configuração de build do `ui` — Fase 20.
- Configuração do `service-worker` — Fase 20.

#### Critério de aceite

- Todos os diretórios existem.
- `deno task check` passa (nenhum `mod.ts` quebrado).
- `import { } from "@syntaxmesh/core"` funciona (ainda que vazio).

#### Testes

- `tests/integration/workspace_test.ts`:
  - `it("todos os packages têm deno.jsonc")`
  - `it("todos os packages têm mod.ts")`
  - `it("todos os packages têm src/ e tests/")`
  - `it("cada package tem name @syntaxmesh/*")`

---

### 4.3 — Regra de isolamento do Core

#### Contexto

O ADR 001 estabelece que o Core **não pode** importar DOM, Preact, BeerCSS, IndexedDB, OPFS, `window`, `document`, `navigator`, `localStorage`. Esta regra é a mais importante do projeto — ela permite que o Core rode em Deno puro, em Web Worker e em testes.

Esta subfase **não implementa** o Core, apenas cria um **teste automatizado** que valida a regra para todas as fases futuras.

#### Objetivo

Ter um teste que falhe se qualquer arquivo em `packages/core/src/` importar algo proibido.

#### Arquivos

- `tests/integration/core_isolation_test.ts`

#### Requisitos

- [ ] O teste varre recursivamente `packages/core/src/`.
- [ ] Para cada arquivo `.ts`, verifica se contém imports proibidos:
  - `from "preact"` (ou `preact/*`)
  - `from "beercss"` (ou `beercss/*`)
  - `from "idb-keyval"`
  - `from "@syntaxmesh/worker-db"`
  - `from "@syntaxmesh/storage"`
  - `from "@syntaxmesh/ui"`
  - `from "@syntaxmesh/service-worker"`
- [ ] Verifica se o código usa APIs globais proibidas:
  - `document`, `window`, `navigator`, `localStorage`, `indexedDB`, `navigator.storage` (OPFS).
- [ ] Reporta o arquivo e a linha exata da violação.
- [ ] Ignora comentários (linhas que começam com `//` ou estão dentro de `/* */`).

#### Referências

- `docs/syntaxmesh/decisoes/001-core-independente-do-dom.md` — lista completa de restrições.
- `docs/syntaxmesh/03-arquitetura.md` — seção "Regra arquitetural mais importante".
- `docs/syntaxmesh/09-regras-para-ia.md` — "Core não pode importar DOM."

#### Fora de escopo

- Verificação equivalente para outros packages (Parser, Report) — pode ser feita depois.
- Lint customizado em `deno lint` — pode ser avaliado no futuro.

#### Critério de aceite

```bash
deno task test  # core_isolation_test passa (nada em core/src ainda)
```

#### Testes

- `tests/integration/core_isolation_test.ts`:
  - `describe("Core isolation")`
  - `it("não importa preact")`
  - `it("não importa beercss")`
  - `it("não importa idb-keyval")`
  - `it("não importa @syntaxmesh/worker-db")`
  - `it("não importa @syntaxmesh/storage")`
  - `it("não usa document/window/navigator")`
  - `it("não usa localStorage/indexedDB")`

**Nota de implementação:** o teste pode ser escrito como um único `it` que agrega todas as violações em uma lista e usa `assertEquals(violations, [])`. Isso é mais legível que 8 testes separados.

---

### 4.4 — Padrão de testes (`@std/testing/bdd` + `@std/assert`)

#### Contexto

O ADR 008 define `@std/testing/bdd` (`describe`/`it`) como padrão único do projeto. Testes antigos que usam `Deno.test()` direto devem ser migrados aos poucos.

#### Objetivo

Garantir que todos os novos testes sigam o padrão BDD, que os helpers estejam disponíveis e que exista um teste de exemplo canônico.

#### Arquivos

- `deno.jsonc` — adicionar `@std/testing` ao `imports` ou `catalog`.
- `packages/utils/tests/bdd_example_test.ts` — teste canônico de exemplo (opcional, serve de referência).
- `docs/syntaxmesh/06-testes-e-processo.md` — já documenta o padrão.

#### Requisitos

- [ ] `@std/testing/bdd` e `@std/assert` disponíveis via imports do workspace.
- [ ] Documentar em `docs/syntaxmesh/06-testes-e-processo.md` (já existe — verificar se está atualizado).
- [ ] Criar teste de exemplo que demonstre:
  - `describe` aninhado.
  - `it` com `assertEquals`, `assert`, `assertNotEquals`, `assertThrows`.
  - Uso de `beforeEach`/`afterEach` (se aplicável).
- [ ] Adicionar regra de lint customizada (se suportado) que proíbe `Deno.test()` direto em novos arquivos — **opcional**.

#### Referências

- `docs/syntaxmesh/decisoes/008-biblioteca-de-testes-std-testing-bdd-padrao.md` — decisão formal.
- `docs/syntaxmesh/06-testes-e-processo.md` — convenções.

#### Fora de escopo

- Migração dos testes existentes em `packages/worker-db/tests/` — fica para quando o worker-db for tocado.

#### Critério de aceite

```bash
deno task test  # testes rodam com describe/it
```

#### Testes

- `packages/utils/tests/bdd_example_test.ts`:
  - `describe("exemplo BDD")`
  - `it("demonstra assertEquals")`
  - `it("demonstra assertThrows")`

---

### 4.5 — ADRs consolidados

#### Contexto

Os ADRs 001–008 já existem. As decisões recentes (RichText mantido + Markdown futuro, worker-db centralizando storage, port fiel do TaskJuggler) precisam ser registradas.

#### Objetivo

Ter ADRs que cubram todas as decisões arquiteturais do projeto, servindo como fonte de verdade para as fases futuras.

#### Arquivos

- `docs/syntaxmesh/decisoes/009-richtext-mantido-markdown-futuro.md` (novo)
- `docs/syntaxmesh/decisoes/010-worker-db-centraliza-storage.md` (novo)
- `docs/syntaxmesh/decisoes/011-port-fiel-taskjuggler.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

**ADR 009 — RichText mantido, Markdown futuro:**

- **Contexto:** RichText (MediaWiki markup) é usado em `.tjp` original. Substituir por Markdown quebraria compatibilidade.
- **Decisão:**
  - `@syntaxmesh/richtext` implementa fielmente o RichText do TJ 3.8.4.
  - `@syntaxmesh/markdown` (novo) é o formato going-forward para conteúdo nativo.
  - Ambos coexistem. RichText será depreciado lentamente.
- **Consequências:**
  - Duplicação de esforço em dois parsers de markup.
  - Migração gradual exige conversores `richTextToMarkdown` (futuro).
  - Compatibilidade total com `.tjp` preservada.

**ADR 010 — worker-db centraliza storage:**

- **Contexto:** IndexedDB e OPFS são APIs de browser. Não devem ser usadas diretamente pelo Core nem pelo Storage.
- **Decisão:**
  - Toda interação com IndexedDB e OPFS passa por `@syntaxmesh/worker-db`.
  - O `worker-db` expõe interface `KeyValueStore` (`get`, `set`, `del`, `keys`).
  - `@syntaxmesh/storage` consome `worker-db`, nunca `idb-keyval` diretamente.
  - Core nunca importa nada disso.
- **Consequências:**
  - Fronteira clara entre armazenamento e lógica.
  - Trocar IndexedDB por OPFS (ou vice-versa) não afeta Storage.
  - Testes do Storage usam fake do `worker-db`.

**ADR 011 — Port fiel do TaskJuggler:**

- **Contexto:** O SyntaxMesh não é uma tradução mecânica; é uma implementação independente inspirada no TJ. Mas o comportamento precisa ser idêntico.
- **Decisão:**
  - Portar **fielmente** o algoritmo, classes e semântica do TJ 3.8.4.
  - Adaptações Ruby → TypeScript apenas quando a linguagem exigir (ex: `method_missing` → `Proxy`).
  - Golden tests comparativos (`tj3` real vs `tj3-ts`) são o critério de aceite.
- **Consequências:**
  - Não inventar arquitetura nova onde o TJ já tem solução.
  - Estrutura de diretórios do Core espelha `lib/taskjuggler/`.
  - Nomes de classes e métodos permanecem em inglês.
- **Observação:** esta decisão **substitui** o plano anterior de "implementação independente com arquitetura própria".

#### Referências

- `docs/syntaxmesh/decisoes/README.md` — formato de ADR.
- Conversas consolidadas com o autor do projeto (decisões de 2026-09-10).

#### Fora de escopo

- ADRs para fases específicas (ex: algoritmo do GanttRouter) — criados quando a fase for trabalhada.

#### Critério de aceite

- ADRs 009, 010, 011 criados seguindo o template.
- Tabela em `README.md` atualizada.

#### Testes

- Nenhum teste automatizado. Validação manual do formato.

---

### 4.6 — Pipeline de qualidade (CI local)

#### Contexto

O projeto já tem `deno task test`, `deno task lint`, `deno task fmt`. Falta um comando único que agregue tudo e um script de CI local que sirva para pré-commit.

#### Objetivo

Ter `deno task check-all` que roda: type-check → lint → fmt-check → test, na ordem, e falha no primeiro erro.

#### Arquivos

- `deno.jsonc` — adicionar task `check-all`.
- `docs/syntaxmesh/06-testes-e-processo.md` — documentar.

#### Requisitos

- [ ] Task `check-all`:
  ```jsonc
  "check-all": "deno task check && deno task lint && deno task fmt --check && deno task test"
  ```
- [ ] Documentar a ordem e o porquê (falha rápida).
- [ ] (Opcional) Hook de pré-commit via `deno task check-all` — se o time usar git hooks.

#### Referências

- `docs/syntaxmesh/02-principios.md` — fluxo de desenvolvimento.
- `docs/syntaxmesh/06-testes-e-processo.md` — comandos principais.

#### Fora de escopo

- CI remota (GitHub Actions, GitLab CI) — pode ser adicionada depois, na Fase 21.
- Hooks de git específicos de plataforma.

#### Critério de aceite

```bash
deno task check-all  # roda tudo, sem erros
```

#### Testes

- Smoke test garantindo que `deno task check-all` existe e está acessível via `deno task --list`.

---

### 4.7 — Documentação inicial

#### Contexto

A documentação `docs/syntaxmesh/` já existe (00 a 10 + ADRs + fases). Precisa ser revisada para refletir as decisões recentes (RichText mantido, worker-db centralizado, port fiel).

#### Objetivo

Garantir que `docs/syntaxmesh/` reflete o estado atual do projeto.

#### Arquivos

- `docs/syntaxmesh/00-index.md` — atualizar mapa.
- `docs/syntaxmesh/02-principios.md` — confirmar.
- `docs/syntaxmesh/03-arquitetura.md` — atualizar lista de packages (adicionar `richtext`, `markdown`, `language`).
- `docs/syntaxmesh/05-formato-e-compatibilidade.md` — adicionar seção sobre RichText vs Markdown.
- `docs/syntaxmesh/07-roadmap.md` — **substituir** pelas 21 fases do plano consolidado.
- `docs/syntaxmesh/09-regras-para-ia.md` — atualizar.

#### Requisitos

- [ ] `03-arquitetura.md` lista os 12 packages.
- [ ] `05-formato-e-compatibilidade.md` explica a coexistência RichText/Markdown.
- [ ] `07-roadmap.md` tem a lista das 21 fases.
- [ ] `00-index.md` aponta para os novos arquivos.

#### Referências

- Todo o material consolidado nas conversas de 2026-09-09 e 2026-09-10.

#### Fora de escopo

- Manuais de usuário (docs finais) — Fase 21.
- Tutoriais — Fase 21.

#### Critério de aceite

- Documentação revisada e sem referências a versões antigas.

---

## 5. Ordem de execução sugerida

```text
4.1  deno.jsonc raiz
      ↓
4.2  estrutura de packages
      ↓
4.3  core_isolation_test
      ↓
4.4  padrão BDD
      ↓
4.5  ADRs 009-011
      ↓
4.6  check-all
      ↓
4.7  documentação
```

Cada subfase fecha com `deno task check-all` verde.

---

## 6. Critério de conclusão da fase

A Fase 1 é considerada concluída quando:

```bash
deno task check-all
```

passa sem erros, e:

- [ ] Workspace configurado com 12 packages.
- [ ] `core_isolation_test` ativo.
- [ ] ADRs 001–011 registrados.
- [ ] Documentação revisada.
- [ ] Nenhum teste quebrado.

---

## 7. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| `deno.jsonc` com `workspace` incompleto quebra imports | Teste `workspace_test.ts` valida a lista |
| Core importar algo proibido em fase futura | `core_isolation_test.ts` falha automaticamente |
| ADRs desatualizados | Revisão manual ao final de cada fase |
| Duplicação RichText/Markdown | Aceita como trade-off pelo ADR 009 |
| CI remota ausente | `check-all` local cobre desenvolvimento; CI remota vem na Fase 21 |

---

## 8. Referências cruzadas

### Documentos do projeto

- `docs/syntaxmesh/00-index.md`
- `docs/syntaxmesh/01-visao.md`
- `docs/syntaxmesh/02-principios.md`
- `docs/syntaxmesh/03-arquitetura.md`
- `docs/syntaxmesh/04-linguagem-multilingue.md`
- `docs/syntaxmesh/05-formato-e-compatibilidade.md`
- `docs/syntaxmesh/06-testes-e-processo.md`
- `docs/syntaxmesh/07-roadmap.md`
- `docs/syntaxmesh/08-mvp.md`
- `docs/syntaxmesh/09-regras-para-ia.md`
- `docs/syntaxmesh/10-futuro.md`
- `docs/syntaxmesh/decisoes/001` a `011`

### Código-fonte de referência (TaskJuggler)

- **Nenhum.** Esta fase é infraestrutura pura do SyntaxMesh.

### Fases dependentes

- **Fase 2 — Tempo e Geometria** (`docs/syntaxmesh/fases/fase-2-tempo-geometria.md`) — bloqueada até Fase 1 concluída.

---

## 9. Notas para a IA

1. **Não implementar lógica de negócio** nesta fase. Apenas infraestrutura.
2. **Verificar antes de criar.** Muitos arquivos podem já existir. Não sobrescrever sem ler.
3. **Um commit por subfase.** Cada subfase 4.x deve ser um commit atômico.
4. **Rodar `deno task check-all` antes de cada commit.**
5. **Se um ADR existente conflitar com as decisões recentes, atualizar o ADR** em vez de criar um novo (exceto se a decisão for realmente nova).
6. **Registrar qualquer desvio do plano** como comentário em `docs/syntaxmesh/fases/fase-1-fundacao.md`.

---

**Fim da Fase 1.**