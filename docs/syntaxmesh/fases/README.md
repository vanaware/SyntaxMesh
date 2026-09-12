# Fases — Guia

Este diretório contém o planejamento do projeto dividido em **21 fases**. Cada fase tem **até 3 arquivos** com propósitos distintos.

## Convenção de nomes

| Tipo | Padrão | Propósito | Exemplo |
|---|---|---|---|
| **Plano** | `fase-N-<slug>.md` | Especificação completa da fase (contexto, objetivo, subfases detalhadas, referências Ruby) | `fase-3-modelo-atributos.md` |
| **Tarefas** | `fase-N-tarefas.md` | Lista executável de tarefas atômicas (TDD, ≤ 2h cada) | `fase-3-tarefas.md` |
| **Complementar** | `fase-N-tarefas-complementar<N>.md` | Revisões pós-implementação (após feedback do Ruby ou testes) | `fase-2-tarefas-complementar1.md` |

**Regras:**

- `<slug>` é kebab-case, descritivo, sem numeração.
- Um arquivo de **plano** é escrito **antes** de implementar.
- Um arquivo de **tarefas** é derivado do plano.
- Um arquivo **complementar** só existe se houver revisão. Numerado (`complementar1`, `complementar2`, ...).
- `N` é o número da fase sem zero-padding (`fase-2-*`, não `fase-02-*`).

### Renomeações pendentes

| Atual | Novo |
|---|---|
| `fase-2-tempo-geometria-tarefas.md` | `fase-2-tarefas.md` |
| `fase-2-tempo-geometria-tarefas-complementar1.md` | `fase-2-tarefas-complementar1.md` |

## Diferença entre plano, tarefas e complementar

### Plano (`fase-N-<slug>.md`)

- **Destinado ao autor/IA** que vai projetar a fase.
- Contém **contexto**, **objetivo**, **decisões de port**, **subfases** com justificativas, **referências cruzadas**.
- **Não é executável.** Não tem checkboxes.
- Escrito **antes** da implementação.
- Pode referenciar o Ruby diretamente (`⚠️ RUBY: arquivo:linha`).

### Tarefas (`fase-N-tarefas.md`)

- **Destinado ao executor (IA ou dev)** que vai implementar.
- Contém **tarefas atômicas** com: `# | Tarefa | Arquivos | Verificação`.
- Cada tarefa é **TDD** (teste antes), **≤ 2h**, **1 verbo**.
- Tem **checkboxes** e **progresso**.
- Escrito **depois** do plano, **antes** da implementação.
- Deve ser **completo** em relação ao plano (toda subfase do plano vira ≥ 1 tarefa).

### Complementar (`fase-N-tarefas-complementar<N>.md`)

- **Destinado ao revisor** após implementação.
- Corrige divergências descobertas **durante** ou **depois** da implementação.
- Segue o mesmo formato de tarefas, mas com prefixo `N.R` (ex: `5.4.R.1`).
- **Não apaga** marcações originais — adiciona nota `(revisado em 5.X.R.Y)`.
- Pode reabrir tarefas já marcadas.

## Formato de tarefa

Toda tarefa segue o formato:

```markdown
| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 3.1.4 | Criar classe `AttributeBase<T>` vazia com `constructor(property: PropertyLike, type: AttributeDefinition<T>, container: AttributeContainer)` | `src/attributes/attribute-base.ts` | `deno check` |
```

**Colunas:**

- **#** — identificador único (`subfase.subtarefa`).
- **Tarefa** — ação no imperativo, 1 verbo. Não caber em 2h → quebrar.
- **Arquivos** — caminhos relativos exatos (sem `<...>`).
- **Verificação** — comando objetivo (`deno check`, `deno test`, `grep`, contagem, etc.).

**Marcadores especiais:**

- `⚠️ RUBY: <arquivo>:<linha>` — leia o Ruby antes de implementar.
- `🔎 CHEAT: §N` — consultar seção do cheat sheet.
- `// TODO Fase N: <razão>` — stub com dependência futura.
- `// RUBY-COMPAT-FIX: <desc>` — correção de bug Categoria A (ADR 013).
- `// RUBY-COMPAT-FLAG: <desc>` — bug Categoria B (usa `compat.keepRubyBugs`).
- `// RUBY-COMPAT-DOC: <link>` — comportamento documentado (Categoria C).

**Regras de granularidade:**

- 1 verbo, 1 entregável, verificação objetiva.
- Não caber em 2h → quebrar em 2 tarefas.
- Tarefa que depende de decisão de arquitetura → criar ADR antes.

## Protocolo TDD

Toda tarefa segue:

1. **Escrever o teste** que falha.
2. `deno task test` → confirmar falha correta.
3. **Implementar o mínimo.**
4. `deno task test` → passa.
5. `deno task check-all` → verde.
6. **Commit atômico** (ver abaixo).
7. Marcar `[x]`.

Se `check-all` falha em `fmt` ou `lint` → **não commitar**.

## Convenções git

### Branches

| Uso | Padrão | Exemplo |
|---|---|---|
| Desenvolvimento de fase | `phase-N-<slug>` | `phase-3-modelo-atributos` |
| Correção de bug | `fix/<slug>` | `fix/tjtime-parsing-rollover` |
| Revisão (complementar) | `phase-N-review-<slug>` | `phase-2-review-ruby-bugs` |

### Commits

- **Formato:** `<tipo>(<escopo>): <descrição>` (Conventional Commits).
- **Tipos:** `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.
- **Escopo:** package (`core`, `parser`, `report`, `storage`, `ui`) ou área (`decisoes`, `fases`, `golden`).
- **Exemplos:**
  - `feat(core): attribute-base com mode global`
  - `fix(core): corrigir sameTimeNextMonth (Categoria B)`
  - `docs(decisoes): ADR 014 attribute mode global`
  - `test(core): golden tests TjTime parsing`
  - `chore(fases): renomear fase-2-tarefas.md`

### Tags

- **Fase concluída:** `phase-N-done` (ex: `phase-2-done`).
- **Release:** `vX.Y.Z` (ex: `v1.0.0`).
- **Golden baseline:** `golden-vN` (ex: `golden-v1`).

### Regras

- **1 commit por tarefa** ou **por subfase** (decisão do executor).
- **Não commitar** se `check-all` falhar.
- **Não commitar** com `[WIP]` no `main`.
- **Rodar `deno task golden:generate`** antes de commitar mudanças que afetam golden.
- **Atualizar `fases/fase-N-tarefas.md`** no mesmo commit.

## Smoke tests por fase

Toda fase concluída deve adicionar um teste de fumaça:

**Arquivo:** `tests/integration/smoke_after_phase_N_test.ts`

**Conteúdo mínimo:**

1. Importar todos os `mod.ts` de todos os packages afetados.
2. Verificar exports públicos (contagem de símbolos).
3. Rodar um cenário trivial end-to-end (ex: criar objeto, chamar método, verificar output).
4. Garantir que a fase N **não quebrou** N-1.

**Exemplo (Fase 3):**

```ts
import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals } from "@std/assert";
import * as core from "@syntaxmesh/core";

describe("Smoke after Phase 3", () => {
  it("Core exporta AttributeBase", () => {
    assert(core.AttributeBase !== undefined);
  });

  it("AttributeBase.setMode existe", () => {
    assertEquals(typeof core.AttributeBase.setMode, "function");
  });

  it("Fase 2 não regrediu: TjTime.fromString funciona", () => {
    const t = core.TjTime.fromString("2026-01-01");
    assert(t.toSeconds() > 0);
  });
});
```

**Regra:** smoke test é **obrigatório** para fechar uma fase (ver Bloco C de cada `fase-N-tarefas.md`).

## Auditoria de completude

Antes de fechar uma fase:

1. Para cada subfase do plano (`fase-N-<slug>.md`), verificar que existe ≥ 1 tarefa correspondente em `fase-N-tarefas.md`.
2. Para cada arquivo mencionado no plano, verificar que existe tarefa de criação.
3. Para cada ADR mencionada, verificar que foi criada.
4. Rodar `grep` por termos-chave do plano no arquivo de tarefas.

**Verificação rápida:**

```bash
# Contar subfases no plano
grep -cE "^### [0-9]+\.[0-9]+" docs/syntaxmesh/fases/fase-N-<slug>.md

# Contar subfases no arquivo de tarefas
grep -cE "^### [0-9]+\.[0-9]+" docs/syntaxmesh/fases/fase-N-tarefas.md

# Números devem bater (ou tarefas ≥ plano)
```

**Script sugerido (futuro):**

```bash
deno task audit:phase N
```

## Como uma IA deve usar estes arquivos

**Fluxo típico:**

1. Ler `fase-N-<slug>.md` (plano) — entender contexto e decisões.
2. Ler `fase-N-tarefas.md` (tarefas) — encontrar a próxima tarefa não marcada.
3. Para cada tarefa:
   - Se `⚠️ RUBY:` → ler o arquivo Ruby indicado.
   - Se `🔎 CHEAT:` → consultar seção do cheat sheet.
   - Escrever teste, implementar, verificar, commitar.
4. Se houver `fase-N-tarefas-complementar*.md`:
   - Executar **após** todas as tarefas principais.
   - Não apagar marcações originais.

**Regras para a IA:**

- **1 tarefa por vez.** Não avançar sem fechar a atual.
- **Não modificar arquivos fora do escopo.** Se descobrir bug, abrir issue no arquivo da fase competente.
- **Não inventar.** Se não está no plano nem no Ruby, não existe.
- **Sem `any` em `src/`.** Use `unknown` + narrowing.
- **Commit atômico.** `feat(core): attribute-base` etc.
- **Não corrigir bugs de outras fases.** Abrir issue no arquivo competente.
- **Ler o cheat sheet** antes de portar qualquer construção Ruby.

## Mapa das 21 fases

| Fase | Arquivo do plano | Status |
|---|---|---|
| 1 | `fase-1-fundacao.md` | ✅ Concluída |
| 2 | `fase-2-tempo-geometria.md` | 🟡 Em andamento |
| 3 | `fase-3-modelo-atributos.md` | ⬜ Não iniciada |
| 4 | `fase-4-arvore-propriedades.md` | ⬜ Não iniciada |
| 5 | `fase-5-entidades-concretas.md` | ⬜ Não iniciada |
| 6 | `fase-6-scoreboard-estruturas.md` | ⬜ Não iniciada |
| 7 | `fase-7-scheduler-core.md` | ⬜ Não iniciada |
| 8 | `fase-8-financeiro.md` | ⬜ Não iniciada |
| 9 | `fase-9-orquestrador-cache.md` | ⬜ Não iniciada |
| 10 | `fase-10-parser-linguagem.md` | ⬜ Não iniciada |
| 11 | `fase-11-logica-queries.md` | ⬜ Não iniciada |
| 12 | `fase-12-richtext.md` | ⬜ Não iniciada |
| 13 | `fase-13-markdown.md` | ⬜ Não iniciada |
| 14 | `fase-14-relatorios.md` | ⬜ Não iniciada |
| 15 | `fase-15-gantt.md` | ⬜ Não iniciada |
| 16 | `fase-16-apoio.md` | ⬜ Não iniciada |
| 17 | `fase-17-html-xml.md` | ⬜ Não iniciada |
| 18 | `fase-18-time-status-sheets.md` | ⬜ Não iniciada |
| 19 | `fase-19-storage.md` | ⬜ Não iniciada |
| 20 | `fase-20-pwa-ui.md` | ⬜ Não iniciada |
| 21 | `fase-21-compatibilidade-qualidade.md` | ⬜ Não iniciada |

> **Nota:** atualizar esta tabela manualmente ao concluir uma fase (mover `⬜` → `🟡` → `✅`).

## Referências cruzadas

- `docs/syntaxmesh/decisoes/` — ADRs (001–015).
- `docs/syntaxmesh/cheat-sheet-ruby-ts.md` — mapeamento Ruby→TS + bugs.
- `docs/syntaxmesh/06-testes-e-processo.md` — protocolo TDD.
- `docs/syntaxmesh/07-roadmap.md` — lista consolidada das 21 fases.
- `docs/syntaxmesh/03-arquitetura.md` — arquitetura geral.

---

**Última atualização:** 2026-09-12