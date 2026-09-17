# Fase 13 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-13-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-13-markdown.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~115 tarefas
> **Concluídas:** 0
> **Fonte:** Extensão SyntaxMesh (não existe no TaskJuggler). Depende de `micromark` + `mdast-util-from-markdown` + `mdast-util-gfm`.

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Esta fase é aditiva.** Não substitui RichText (Fase 12). Não bloqueia fases futuras. É o formato **going-forward** do SyntaxMesh para conteúdo nativo.

Não há referência Ruby. Toda implementação segue **ADR 009** (RichText mantido + Markdown futuro) e **ADR 025** (criado nesta fase).

### ⚠️ ORDEM DE EXECUÇÃO

A Fase 13 depende de:
- **Fase 11** (`Query` — usado em `RTFQuery`).
- **Fase 12** (`RichTextIntermediate` — reaproveitado para AST unificada).

**Não é dependência do parser `.tjp`.** `ProjectFileParser` continua usando `RichTextFactory` (Fase 12). Markdown é apenas para **conteúdo nativo** (futuro).

### ADRs relevantes

- **ADR 009** — RichText mantido, Markdown futuro (Fase 1).
- **ADR 011** — Port fiel do TaskJuggler (não aplicável — Markdown não existe no TJ).
- **ADR 012–022** — Fases 2–10 (contexto geral).
- **ADR 023** — Expressões lógicas sem precedência (Fase 11).
- **ADR 024** — RichText e function handlers (Fase 12).
- **ADR 025** — Markdown como formato going-forward (**criado nesta fase**).

### Convenções CRÍTICAS

- **Parser base:** `micromark` (retorna **AST**, não HTML).
- **AST unificada:** Markdown produz o mesmo `RichTextIntermediate` que RichText.
- **Extensões via pré/pós-processamento.**
- **Placeholders únicos:** `§COLOR_n§`, `§FUNC_n§`, `§MINIQ_n§`.
- **Sanitização de HTML** com allow-list.
- **`to_markdown` é one-way.** Não esperar round-trip perfeito.
- **`richTextToMarkdown` preserva funções customizadas.**
- **Não é dependência do parser `.tjp`.**
- **Snapshot tests** são o critério final.
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não substituir RichText por Markdown.
- ❌ Não usar `@deno/gfm` (retorna HTML, não AST). Usar `micromark`.
- ❌ Não modificar o parser Markdown — só pré/pós-processar.
- ❌ Não editar `ProjectFileParser` (Fase 10).
- ❌ Não usar placeholders curtos (`§E0§`) — usar nomes descritivos.
- ❌ Não permitir tags perigosas no HTML sanitizer.
- ❌ Não usar `Proxy`.
- ❌ Não inventar sintaxe que conflite com GFM.

---

## Progresso

```
[ ] 13.0  ADR 025 (Markdown going-forward)         —  0/5
[ ] 13.1  Integração micromark                     —  0/12
[ ] 13.2  MdastToRichText                          —  0/14
[ ] 13.3  MarkdownFactory                          —  0/6
[ ] 13.4  Extensão: color                          —  0/6
[ ] 13.5  Extensão: HTML sanitizer                 —  0/8
[ ] 13.6  Extensão: functions                      —  0/10
[ ] 13.7  Extensão: mini-queries                   —  0/5
[ ] 13.8  Pipeline pré/pós-processamento           —  0/6
[ ] 13.9  to_markdown em RichTextIntermediate      —  0/14
[ ] 13.10 richTextToMarkdown                       —  0/8
[ ] 13.11 Integração                               —  0/5
[ ] 13.12 Snapshot tests                           —  0/8
[ ] 13.13 Verificação final                        —  0/8
─────────────────────────────────────────────────────
TOTAL: ~115
```

---

## Bloco A — Fundação

### 13.0 — ADR 025 (Markdown como formato going-forward)

**Objetivo:** formalizar a implementação do Markdown e a coexistência com RichText.

**⚠️ Nota:** o plano usa `ADR 024`, mas o ADR 024 foi alocado para `richtext-handlers` (Fase 12). Aqui usamos **ADR 025**.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.0.1 | Criar `docs/syntaxmesh/decisoes/025-markdown-going-forward.md` com frontmatter | idem | arquivo existe |
| 13.0.2 | Seção **Contexto:** coexistência RichText/Markdown; `@deno/gfm` retorna HTML (falta AST); `micromark` retorna AST | idem | — |
| 13.0.3 | Seção **Decisões:** parser base `micromark`; `MarkdownFactory implements RichTextFactory`; extensões via pré/pós-processamento; `RichTextIntermediate` reutilizado; **não é dependência do parser `.tjp`** | idem | — |
| 13.0.4 | **Alternativas** (`@deno/gfm`, `marked`, `remark`) + **Consequências** (AST unificada; mais dependência) | idem | — |
| 13.0.5 | Atualizar linha `025` em `decisoes/README.md` | idem | 25 linhas |

---

## Bloco B — Core

### 13.1 — Integração com `micromark`

**⚠️ Contexto:** `micromark` + `mdast-util-from-markdown` + `mdast-util-gfm` produzem AST `mdast`.

**Pré-requisitos:** `packages/markdown/deno.jsonc` configurado.

#### 13.1.1 — Dependências

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.1.1.1 | Adicionar `micromark` em `imports` (`npm:micromark@^4`) | `packages/markdown/deno.jsonc` | `deno check` |
| 13.1.2.1 | Adicionar `mdast-util-from-markdown` (`npm:mdast-util-from-markdown@^2`) | idem | `deno check` |
| 13.1.3.1 | Adicionar `mdast-util-gfm` (`npm:mdast-util-gfm@^3`) | idem | `deno check` |
| 13.1.4.1 | Adicionar `micromark-extension-gfm` (`npm:micromark-extension-gfm@^3`) | idem | `deno check` |

#### 13.1.2 — `parseMdast`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.1.2.1 | Criar `packages/markdown/src/parse-mdast.ts` com `function parseMdast(text: string): MdastRoot` | idem | `deno check` |
| 13.1.2.2 | Configurar `micromark` com extensão `gfm` e `fromMarkdown` | idem | 2 testes |
| 13.1.2.3 | Tipos de nós `mdast`: importar de `mdast` | idem | `deno check` |

#### 13.1.3 — Testes por nó

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.1.3.1 | Teste: `heading` (depth 1–6) | `packages/markdown/tests/parse-mdast_test.ts` | 6 testes |
| 13.1.3.2 | Teste: `paragraph` | idem | 1 teste |
| 13.1.3.3 | Teste: `emphasis` / `strong` | idem | 2 testes |
| 13.1.3.4 | Teste: `list` ordered/unordered + `listItem` | idem | 4 testes |
| 13.1.3.5 | Teste: `code` (block) + `inlineCode` | idem | 2 testes |
| 13.1.3.6 | Teste: `link` + `image` | idem | 2 testes |
| 13.1.3.7 | Teste: `blockquote` + `thematicBreak` | idem | 2 testes |
| 13.1.3.8 | Teste: `table` (GFM) + `tableRow` + `tableCell` | idem | 3 testes |
| 13.1.3.9 | Teste: `html` (inline + block) | idem | 2 testes |
| 13.1.3.10 | Teste: `text` + `break` | idem | 2 testes |
| 13.1.3.11 | Teste: `strikethrough` (GFM) | idem | 1 teste |
| 13.1.3.12 | Re-exportar `parseMdast` em `packages/markdown/mod.ts` | idem | `deno check` |

---

### 13.2 — `MdastToRichText`

**⚠️ Contexto:** converter AST `mdast` para `RichTextElement[]` (Fase 12).

**Pré-requisitos:** 13.1, Fase 12 (`RichTextElement`, `RichTextImage`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.2.1 | Criar `packages/markdown/src/mdast-to-richtext.ts` com `class MdastToRichText` | idem | `deno check` |
| 13.2.2 | Campo `private sectionCounter: number[]` (inicializado `[0,0,0,0]`) | idem | `deno check` |
| 13.2.3 | Método `convert(root: MdastRoot): RichTextElement[]` — itera children | idem | 3 testes |
| 13.2.4 | ⚠️ `heading` (depth 1) → `title1` | idem | 2 testes |
| 13.2.5 | `heading` (depth 2) → `title2` | idem | 2 testes |
| 13.2.6 | `heading` (depth 3) → `title3` | idem | 2 testes |
| 13.2.7 | `heading` (depth 4+) → `title4` | idem | 3 testes (depth 4, 5, 6) |
| 13.2.8 | `paragraph` → `paragraph` | idem | 2 testes |
| 13.2.9 | `emphasis` → `italic`; `strong` → `bold` | idem | 2 testes |
| 13.2.10 | `inlineCode` → `code`; `code` → `pre` | idem | 2 testes |
| 13.2.11 | `list` (ordered) → `numberlist1` + `numberitem1`; (unordered) → `bulletlist1` + `bulletitem1` | idem | 4 testes |
| 13.2.12 | `blockquote` → `paragraph` com prefixo especial | idem | 2 testes |
| 13.2.13 | `link` → `href`; `image` → `img` (`RichTextImage`) | idem | 3 testes |
| 13.2.14 | `text` → `text`; `break` → `LINEBREAK`; `thematicBreak` → `hline` | idem | 3 testes |
| 13.2.15 | ⚠️ `html` → `htmlblob` (sanitizado via `sanitizeHtml` — subfase 13.5) | idem | 3 testes |
| 13.2.16 | `table` → sequência de `paragraph` (não suportado nativamente) | idem | 3 testes |
| 13.2.17 | `sectionCounter` incrementado em cada título | idem | 2 testes |
| 13.2.18 | Re-exportar em `packages/markdown/mod.ts` | idem | `deno check` |

---

### 13.3 — `MarkdownFactory`

**⚠️ Contexto:** implementa `RichTextFactory` (Fase 12).

**Pré-requisitos:** 13.2, Fase 12 (`RichTextFactory`, `RTFHandlers`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.3.1 | Criar `packages/markdown/src/factory.ts` com `class MarkdownFactory implements RichTextFactory` | idem | `deno check` |
| 13.3.2 | Constructor `(project: Project \| null, sfi: SourceFileInfo \| null)` | idem | 2 testes |
| 13.3.3 | ⚠️ `create(text: string): RichTextIntermediate` — pipeline: pré-processar → `parseMdast` → `MdastToRichText.convert` → construir `RichTextIntermediate` | idem | 4 testes |
| 13.3.4 | Pipeline: registra handlers de `RTFHandlers.create(project, sfi)` no `rti` | idem | 2 testes |
| 13.3.5 | `createFromMdast(mdast: MdastRoot): RichTextIntermediate` — variante que pula o `parseMdast` | idem | 2 testes |
| 13.3.6 | Re-exportar em `packages/markdown/mod.ts` | idem | `deno check` |

---

## Bloco C — Extensões

### 13.4 — Extensão: cor (`<fcol:...>`)

**⚠️ Contexto:** Markdown não tem cor. Extensão com mesma sintaxe do TJ (`<fcol:red>...</fcol>`).

**Pré-requisitos:** nenhum.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.4.1 | Criar `packages/markdown/src/extensions/color.ts` | idem | `deno check` |
| 13.4.2 | `type ColorExtraction = { placeholder: string; color: string; content: string }` | idem | `deno check` |
| 13.4.3 | ⚠️ `preprocessColor(text: string): { text: string; extractions: ColorExtraction[] }` — regex `/<fcol:([a-z]+|#[0-9A-Fa-f]{3,6})>(.*?)<\/fcol>/g` | idem | 4 testes |
| 13.4.4 | Validação: cores nomeadas (`red`, `blue`, `green`, etc.) + hex (`#RGB` / `#RRGGBB`) | idem | 5 testes |
| 13.4.5 | `postprocessColor(node, extractions): MdastNode` — substitui placeholders por nós especiais | idem | 4 testes |
| 13.4.6 | Teste agregado: 3 cores em texto → 3 extrações | idem | 1 teste |

---

### 13.5 — Extensão: HTML sanitizer

**⚠️ Contexto:** Markdown com GFM aceita HTML. Precisamos permitir apenas tags seguras.

**Pré-requisitos:** nenhum.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.5.1 | Criar `packages/markdown/src/extensions/html-sanitizer.ts` | idem | `deno check` |
| 13.5.2 | Definir **allow-list**: `span`, `div`, `a`, `b`, `i`, `em`, `strong`, `code`, `pre`, `br`, `hr`, `p`, `ul`, `ol`, `li`, `blockquote` | idem | 1 teste |
| 13.5.3 | Definir **block-list**: `script`, `iframe`, `object`, `embed`, `style`, `link`, `meta` | idem | 1 teste |
| 13.5.4 | ⚠️ `sanitizeHtml(html: string): string` — parseia tags; remove block-list; preserva allow-list | idem | 6 testes |
| 13.5.5 | Atributos permitidos: `class`, `id`, `href`, `title`, `target`, `style` | idem | 4 testes |
| 13.5.6 | Atributos de eventos (`onclick`, `onerror`, etc.) removidos | idem | 3 testes |
| 13.5.7 | Teste com OWASP vectors básicos (XSS) | idem | 4 testes |
| 13.5.8 | Teste agregado: `<a href="x" onclick="y">z</a>` → `<a href="x">z</a>` | idem | 1 teste |

---

### 13.6 — Extensão: funções customizadas

**⚠️ Contexto:** Markdown não tem `[[query:...]]`. Extensão própria.

**Pré-requisitos:** nenhum.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.6.1 | Criar `packages/markdown/src/extensions/functions.ts` | idem | `deno check` |
| 13.6.2 | `type FunctionExtraction = { placeholder: string; name: string; args: Record<string, string> }` | idem | `deno check` |
| 13.6.3 | ⚠️ `preprocessFunctions(text: string): { text: string; extractions: FunctionExtraction[] }` — regex `/\[\[([a-z]+):([^\]]+)\]\]/g` | idem | 4 testes |
| 13.6.4 | ⚠️ Parse de args: pares `key=value` ou posicionais via `/([a-z]+)="([^"]*)"\|(\S+)/g` | idem | 6 testes |
| 13.6.5 | Suportar `[[query:attribute=effort]]` | idem | 1 teste |
| 13.6.6 | Suportar `[[query:attribute="effort total"]]` (valor com aspas) | idem | 1 teste |
| 13.6.7 | Substituição por placeholder `§FUNC_n§` | idem | 3 testes |
| 13.6.8 | ⚠️ `postprocessFunctions(node, extractions): MdastNode` — `[[report:...]]`/`[[navigator:...]]` são `blockfunc` se sozinhos em parágrafo | idem | 4 testes |
| 13.6.9 | Teste agregado: 3 funções em texto → 3 extrações | idem | 1 teste |
| 13.6.10 | Função desconhecida → texto simples | idem | 2 testes |

---

### 13.7 — Extensão: mini-queries (`<-name->`)

**⚠️ Contexto:** Markdown não tem `<-name->`. Extensão própria.

**Pré-requisitos:** nenhum.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.7.1 | Criar `packages/markdown/src/extensions/mini-query.ts` | idem | `deno check` |
| 13.7.2 | ⚠️ `preprocessMiniQueries(text: string): { text: string; extractions: Extraction[] }` — regex `/<-([a-zA-Z][_a-zA-Z]*)->/g` | idem | 4 testes |
| 13.7.3 | Substituição por `§MINIQ_n§` | idem | 2 testes |
| 13.7.4 | ⚠️ `postprocessMiniQueries(node, extractions): MdastNode` — substitui por `['query', { attribute }]` | idem | 3 testes |
| 13.7.5 | Teste agregado: múltiplas mini-queries | idem | 1 teste |

---

### 13.8 — Pipeline pré/pós-processamento

**⚠️ Contexto:** orquestrar todas as extensões em ordem.

**Pré-requisitos:** 13.4–13.7.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.8.1 | Criar `packages/markdown/src/extensions/pipeline.ts` | idem | `deno check` |
| 13.8.2 | `type Extraction = { placeholder: string; category: 'fontCol' \| 'inlinefunc' \| 'blockfunc'; data: unknown }` | idem | `deno check` |
| 13.8.3 | `class ExtractionPipeline` com `private extractions: Map<string, Extraction>` | idem | `deno check` |
| 13.8.4 | ⚠️ `preprocess(text: string): string` — ordem: `color` → `functions` → `mini-queries` | idem | 4 testes |
| 13.8.5 | ⚠️ `postprocessMdast(mdast: MdastRoot): MdastRoot` — substitui placeholders | idem | 4 testes |
| 13.8.6 | Teste agregado: texto com color + functions + mini-query → placeholders únicos | idem | 1 teste |

---

## Bloco D — Conversão

### 13.9 — `to_markdown` em `RichTextIntermediate`

**⚠️ Contexto:** para reports que pedem Markdown, precisamos de `to_markdown()`.

**Pré-requisitos:** Fase 12 (`RichTextIntermediate`, `RichTextElement`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.9.1 | Adicionar `to_markdown(): string` em `RichTextIntermediate` | `packages/richtext/src/rich-text-intermediate.ts` | `deno check` |
| 13.9.2 | ⚠️ Delega para `tree?.to_markdown() ?? ''` | idem | 2 testes |
| 13.9.3 | Adicionar `to_markdown(): string` em `RichTextElement` | `packages/richtext/src/rich-text-element.ts` | `deno check` |
| 13.9.4 | ⚠️ `title1-4` → `#`–`####` + texto | idem | 4 testes |
| 13.9.5 | `paragraph` → texto + `\n\n` | idem | 2 testes |
| 13.9.6 | `italic` → `*texto*`; `bold` → `**texto**` | idem | 2 testes |
| 13.9.7 | `code` → `` `código` ``; `pre` → ` ```\n...\n``` ` | idem | 2 testes |
| 13.9.8 | `bulletitem1-4` → `- ` com indentação | idem | 4 testes |
| 13.9.9 | `numberitem1-4` → `1. ` com indentação | idem | 4 testes |
| 13.9.10 | `href` → `[texto](url)`; `ref` → `[[ref]]`; `img` → `![alt](file)` | idem | 3 testes |
| 13.9.11 | `hline` → `---` | idem | 1 teste |
| 13.9.12 | `fontCol` → `<fcol:cor>texto</fcol>` (mantém extensão) | idem | 2 testes |
| 13.9.13 | `inlinefunc` / `blockfunc` → `[[func:args]]` | idem | 3 testes |
| 13.9.14 | `htmlblob` → HTML puro; `text` → texto puro | idem | 2 testes |

---

### 13.10 — `richTextToMarkdown`

**⚠️ Contexto:** conversor one-way de `RichText` (MediaWiki) para `Markdown`. Não é reverso — só garantimos que `RichText → Markdown` funciona.

**Pré-requisitos:** 13.9, Fase 12 (`RichText`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.10.1 | Criar `packages/markdown/src/convert-rich-to-md.ts` | idem | `deno check` |
| 13.10.2 | ⚠️ `richTextToMarkdown(richText: string): string` — cria `RichText`, gera `RichTextIntermediate`, chama `to_markdown()` | idem | 4 testes |
| 13.10.3 | Comentário no topo do output (opcional): `<!-- converted from RichText -->` | idem | 2 testes |
| 13.10.4 | ⚠️ Funções customizadas são preservadas (`[[query:...]]` etc.) | idem | 3 testes |
| 13.10.5 | Teste: `"== Title ==\n\n'''bold'''"` → `"# Title\n\n**bold**"` | idem | 1 teste |
| 13.10.6 | Teste: listas | idem | 1 teste |
| 13.10.7 | Teste: links | idem | 1 teste |
| 13.10.8 | Re-exportar em `packages/markdown/mod.ts` | idem | `deno check` |

---

## Bloco E — Integração

### 13.11 — Integração com `MarkdownFactory`

**⚠️ Contexto:** consolidar integração end-to-end.

**Pré-requisitos:** 13.3, 13.8, Fases 11, 12.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.11.1 | Criar `packages/markdown/tests/integration_test.ts` | idem | `deno check` |
| 13.11.2 | ⚠️ `MarkdownFactory.create(texto)` com todas as extensões | idem | 3 testes |
| 13.11.3 | ⚠️ `RTFQuery` funciona dentro de Markdown | idem | 2 testes |
| 13.11.4 | ⚠️ `to_s`, `to_html`, `to_markdown` consistentes | idem | 3 testes |
| 13.11.5 | ⚠️ Migração: `RichText → Markdown → RichText` deve produzir resultados equivalentes em texto (não byte-a-byte) | idem | 2 testes |

---

## Bloco F — Snapshot tests

### 13.12 — Snapshot tests

**⚠️ Contexto:** sem referência Ruby. Snapshot **congela** o output na primeira execução.

**Pré-requisitos:** 13.11.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 13.12.1 | Criar `packages/markdown/tests/golden/markdown-snapshots.json` (gerado) | idem | `deno check` |
| 13.12.2 | Lista de fixtures: Markdown simples (heading, paragraph, lists) | idem | ≥ 5 fixtures |
| 13.12.3 | Fixtures: Markdown com extensões (color, functions, mini-query) | idem | ≥ 5 fixtures |
| 13.12.4 | Fixtures: HTML inline (com sanitização) | idem | ≥ 5 fixtures |
| 13.12.5 | Fixtures: blockquotes, code blocks, imagens, links | idem | ≥ 5 fixtures |
| 13.12.6 | Criar `packages/markdown/tests/golden/snapshot_test.ts` | idem | `deno check` |
| 13.12.7 | ⚠️ Para cada fixture: `to_s`, `to_html`, `to_markdown` congelados | idem | 4 testes |
| 13.12.8 | Se snapshot divergir, mostrar diff | idem | 2 testes |

---

## Bloco G — Verificação final

### 13.13 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 13.13.1 | `deno task check-all` verde | exit 0 |
| 13.13.2 | `deno task test` verde | exit 0 |
| 13.13.3 | `grep -r "NotYetImplementedError" packages/markdown/src/` = 0 (sem stubs) | grep |
| 13.13.4 | ADR 025 criada e commitada | git log |
| 13.13.5 | `MarkdownFactory`, `parseMdast`, `richTextToMarkdown` exportados em `packages/markdown/mod.ts` | `deno check` |
| 13.13.6 | `tests/integration/smoke_after_phase_13_test.ts` — cria `MarkdownFactory`, gera `rti`, verifica `to_s`; verifica Fase 12 (`RichText`) | 1 teste |
| 13.13.7 | Auditoria: cada subfase do plano `fase-13-markdown.md` tem tarefas correspondentes | grep |
| 13.13.8 | Corrigir numeração em `fase-13-markdown.md` (`### 17.X` → `### 13.X`, `ADR 024` → `ADR 025`) | grep |

---

## Notas para a IA

1. **Fase aditiva.** Não substitui RichText (Fase 12).
2. **`micromark` retorna AST**; `@deno/gfm` retorna HTML. Usar `micromark`.
3. **Reuso de `RichTextIntermediate`.** Fase 12 define a classe; Markdown reusa.
4. **Extensões via pré/pós-processamento.** Não modificar o parser Markdown.
5. **Placeholders únicos** (`§COLOR_n§`, `§FUNC_n§`, `§MINIQ_n§`).
6. **Sanitização de HTML é crítica.** OWASP vectors nos testes.
7. **`to_markdown` é one-way.** Não esperar round-trip perfeito.
8. **`richTextToMarkdown` preserva funções customizadas.**
9. **Não é dependência do parser `.tjp`.** Markdown é conteúdo nativo.
10. **Snapshot tests** são o critério final.
11. **Commit por subfase.** `feat(markdown): factory`, etc.
12. **Sem `any`.** Use `unknown` + narrowing.
13. **ADR 025** (não 024). **ADR 024** é RichText handlers (Fase 12).
14. **`MarkdownFactory` implementa `RichTextFactory`** — Fase 12 define a interface.
15. **`MdastToRichText`** cobre nós comuns; alguns nós (table) usam fallback.
16. **`sanitizeHtml`** é usado em `MdastToRichText` ao converter `html`.
17. **Ordem de pré-processamento:** color → functions → mini-queries.
18. **`.tjp` continua usando RichText.** Markdown é só para conteúdo nativo.
19. **`@deno/gfm` não é usado.** Só `micromark`.
20. **`ProjectFileParser` não é tocado.** Markdown é independente.

---

## Notas específicas por subfase

### 13.0 — ADR 025

- **Documenta a coexistência RichText/Markdown.**
- **Justifica `micromark` (AST) em vez de `@deno/gfm` (HTML).**

### 13.1 — Integração micromark

- **4 dependências:** `micromark`, `mdast-util-from-markdown`, `mdast-util-gfm`, `micromark-extension-gfm`.
- **`parseMdast` retorna `MdastRoot`.**
- **Testes por tipo de nó.**

### 13.2 — MdastToRichText

- **Mapa de nós `mdast` → `RichTextElement`.**
- **`sectionCounter` incrementa em títulos.**
- **`table` não é suportado nativamente — fallback para `paragraph`.**

### 13.3 — MarkdownFactory

- **Pipeline:** pré-processar → `parseMdast` → `convert` → `RichTextIntermediate`.
- **Registra `RTFHandlers`** no `rti`.

### 13.4 — Extensão color

- **Regex:** `/<fcol:([a-z]+|#[0-9A-Fa-f]{3,6})>(.*?)<\/fcol>/g`.
- **Cores nomeadas + hex.**
- **Placeholder:** `§COLOR_n§`.

### 13.5 — Extensão HTML sanitizer

- **Allow-list + block-list.**
- **Atributos de eventos removidos.**
- **OWASP vectors.**

### 13.6 — Extensão functions

- **Regex:** `/\[\[([a-z]+):([^\]]+)\]\]/g`.
- **Args:** `key=value` ou posicionais.
- **Placeholder:** `§FUNC_n§`.
- **`blockfunc` vs `inlinefunc`** conforme contexto.

### 13.7 — Extensão mini-queries

- **Regex:** `/<-([a-zA-Z][_a-zA-Z]*)->/g`.
- **Placeholder:** `§MINIQ_n§`.
- **Equivalente a `[[query:attribute=...]]`.**

### 13.8 — Pipeline

- **Ordem:** color → functions → mini-queries.
- **`Map<string, Extraction>`** por placeholder.

### 13.9 — to_markdown

- **~14 categorias de `RichTextElement`.**
- **`fontCol` e `inlinefunc`/`blockfunc` mantêm extensões.**

### 13.10 — richTextToMarkdown

- **One-way.**
- **Preserva funções.**
- **Não é round-trip.**

### 13.11 — Integração

- **`RTFQuery` funciona em Markdown.**
- **Migração preserva estrutura.**

### 13.12 — Snapshot tests

- **~20 fixtures.**
- **Snapshot é o critério final.**

### 13.13 — Verificação

- **Sem stubs.**
- **ADR 025 (não 024).**

---

**Fim do arquivo de tarefas da Fase 13.**