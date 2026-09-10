# Fase 13 — Markdown

> **Arquivo:** `docs/syntaxmesh/fases/fase-13-markdown.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 4–5 dias
> **Depende de:** Fases 11 (Query), 12 (RichText)
> **Bloqueia:** nada (fase aditiva)

---

## ⚠️ Nota de escopo

Esta fase é **aditiva**. Ela não substitui RichText (mantido por compatibilidade `.tjp`) nem bloqueia fases futuras. É o formato **going-forward** do SyntaxMesh para conteúdo nativo (docs, tutoriais, futuras features).

Nenhuma referência ao código-fonte Ruby — Markdown não existe no TaskJuggler. É uma **extensão própria** do SyntaxMesh.

---

## 1. Contexto

O SyntaxMesh convive com **dois formatos de markup**:

1. **RichText** (Fase 12) — dialeto do MediaWiki usado em `.tjp`. Mantido para compatibilidade absoluta com arquivos existentes.

2. **Markdown** (esta fase) — formato **going-forward** para conteúdo nativo do SyntaxMesh. Usado em:
   - Documentação embutida (futuro).
   - Tutoriais.
   - Notas de projetos novos (fora do `.tjp`).
   - Interoperabilidade com ferramentas que já usam Markdown.

O objetivo é ter uma alternativa moderna ao markup MediaWiki, sem perder a capacidade de executar **funções customizadas** (queries, reports, etc.).

### Referência cruzada (ADR 009)

ADR 009 (Fase 1) registra:
- RichText mantido (compatibilidade).
- Markdown adotado como going-forward.
- Ambos coexistem; RichText será depreciado lentamente.

### Estratégia

- **`@deno/gfm`** como parser base. Suporta CommonMark + GFM (tabelas, strikethrough, task lists, autolinks).
- **Extensões próprias** para o que Markdown não cobre:
  - Cor de fonte: `<fcol:red>...</fcol>` (mesmo markup do TJ).
  - HTML inline permitido (com sanitização).
  - Funções customizadas: `[[query:...]]`, `[[report:...]]`, `[[navigator:...]]`.
  - Mini-queries: `<-name->`.

- **AST unificado:** Markdown produz o mesmo `RichTextIntermediate` que RichText, para reutilizar `to_s`, `to_html`, `setQuery`, etc. Isso permite que ambos os formatos sejam consumidos pelos mesmos relatórios.

### Fluxo

```
String Markdown
    ↓ MarkdownFactory.create()
RichTextIntermediate (mesma interface do RichText)
    ↓ to_s() / to_html()
String / XMLElementLike
```

### Não substitui RichText

`RichTextIntermediate` (Fase 12) já tem todos os campos (`blockMode`, `sectionNumbers`, `indent`, etc.). Markdown **reutiliza** a mesma classe. A diferença está no **parser**: Markdown usa `@deno/gfm` + extensões; RichText usa `RichTextParser`.

---

## 2. Objetivo

Ao final desta fase:

- `@deno/gfm` integrado como dependência.
- `MarkdownFactory` implementando `RichTextFactory` (Fase 12).
- Extensões:
  - **Cor**: `<fcol:red>...</fcol>` → inline.
  - **HTML inline**: sanitizado.
  - **Funções customizadas**: `[[query:...]]`, `[[report:...]]`, `[[navigator:...]]`.
  - **Mini-queries**: `<-name->`.
- `to_s` (plain text) para Markdown.
- `to_tagged` (usado em testes) equivalente ao RichText.
- Conversor `richTextToMarkdown` (one-way, para migração).
- **≥ 80 testes unitários**.
- ADR 024 registrado.
- `deno task check-all` verde.

---

## 3. Referências

### 3.1 Bibliotecas

- **`@deno/gfm`** — parser GFM para Deno. https://jsr.io/@deno/gfm
- Alternativa: **`marked`** (mais leve, mas menos correto em edge cases).
- Alternativa: **`micromark`** (mais correto, mais complexo).

**Decisão:** `@deno/gfm` (simples, mantido pelo time Deno, cobre CommonMark + GFM).

### 3.2 Arquivos de referência (do próprio SyntaxMesh)

- `docs/syntaxmesh/04-linguagem-multilingue.md` — i18n de keywords.
- `docs/syntaxmesh/decisoes/009-richtext-mantido-markdown-futuro.md` — decisão de coexistência.
- `docs/syntaxmesh/decisoes/023-richtext-handlers.md` — function handlers.
- Fase 12 — `RichTextIntermediate`, `RTFQuery`, `RTFReport`, etc.

### 3.3 Sem referência TaskJuggler

TaskJuggler não tem Markdown. Esta é uma extensão própria do SyntaxMesh.

---

## 4. Decisões de port

### 4.1 Reuso de `RichTextIntermediate`

O `MarkdownFactory` produz o **mesmo** `RichTextIntermediate` que o RichText. Isso permite que reports consumam ambos sem distinguir.

**Implicação:** `MarkdownFactory` precisa construir a árvore `RichTextElement` a partir do AST do `@deno/gfm`.

### 4.2 Extensões são pré/pós-processadas

`@deno/gfm` não entende `<fcol>`, `[[query:...]]`, `<-name->`. Estratégia:

- **Pré-processar** o texto: extrair ocorrências de extensões e substituí-las por placeholders únicos (`§EXT_0§`, `§EXT_1§`).
- Rodar `@deno/gfm` no texto com placeholders.
- **Pós-processar** a AST: substituir placeholders por nós `RichTextElement` correspondentes.

**Justificativa:** mantém o parser GFM intacto; extensões isoladas.

### 4.3 Cor (`<fcol:red>`)

Markdown não tem cor. Extensão:
- Sintaxe: `<fcol:red>texto</fcol>` (igual ao TJ).
- Valores aceitos: cores nomeadas (`red`, `blue`, etc.) e hex (`#RRGGBB`).
- Compatível com `<fcol>` do RichText — mesma sintaxe, mesmo AST.

### 4.4 HTML inline permitido

Markdown com `allowDangerousHtml: true` permite HTML. **Decisão:** permitir apenas tags seguras:
- `<span>`, `<div>`, `<a>`, `<b>`, `<i>`, `<em>`, `<strong>`, `<code>`, `<pre>`, `<br>`, `<hr>`, `<p>`.
- **Sem** `<script>`, `<iframe>`, `<object>`, `<embed>`, `<style>`.

Sanitização com **allow-list**.

### 4.5 Funções customizadas

Markdown não tem `[[query:...]]`. Extensão:
- Sintaxe: `[[function:args]]` (igual ao RichText).
- Parse do conteúdo: `function:arg1=val1 arg2=val2` ou `function:path arg1 arg2`.
- Mesmo comportamento dos `RichTextFunctionHandler` (Fase 12).

### 4.6 Mini-queries (`<-name->`)

Markdown não tem. Extensão:
- Sintaxe: `<-attributeId->` inline.
- Equivalente ao RichText.

### 4.7 `RichTextIntermediate.to_s` para Markdown

O `to_s` do RichText produz plain text (sem markup). Para Markdown, precisamos de **duas saídas**:
- `to_s()` — plain text (herdado do RichText).
- `to_markdown()` — Markdown (nova).

**Decisão:** adicionar `to_markdown()` em `RichTextIntermediate`. Retorna Markdown.

### 4.8 `richTextToMarkdown` — conversor one-way

Para migração, conversor de `RichText` para `Markdown`. Não é reverso (não perderemos informação; só garantimos que RichText → Markdown funciona).

**Uso:** documentação antiga em RichText pode ser convertida.

### 4.9 Não é dependência do parser `.tjp`

`ProjectFileParser` (Fase 10) usa `RichTextFactory` (RichText). Markdown é usado apenas em **conteúdo nativo** (futuro). O parser `.tjp` **não** aceita Markdown.

**Nota:** se no futuro o usuário quiser Markdown em `.tjp`, será via keyword específica (ex: `markdownnote "..."`). Fase futura.

### 4.10 `@deno/gfm` — API

```ts
import { markdown } from "@deno/gfm";
const html: string = markdown("**bold**", { allowDangerousHtml: true });
```

**Não retorna AST.** Retorna HTML direto. Para construir `RichTextIntermediate`, temos duas opções:

- **A) Parsear o HTML resultante** (via `HTMLParser`) e converter para `RichTextElement`. Complexo.
- **B) Rodar um parser de Markdown alternativo que retorna AST** (ex: `micromark`, `remark`).

**Decisão:** usar **`micromark`** com `mdast-util-from-markdown` para obter uma AST. Mais trabalho inicial, mas muito mais limpo.

**Alternativa B1:** usar `remark-parse` (baseado em micromark).

**Nota final:** dado que SyntaxMesh é Deno-puro, é mais natural usar `@deno/gfm` para HTML e não ter AST. Mas precisamos de AST.

**Reavaliação:** usar **`micromark`** diretamente.

### 4.11 Sem precedência de estilos (igual RichText)

Manter a mesma semântica do RichText: `sectionNumbers`, `blockMode`, `indent`.

### 4.12 Suporte a i18n?

Markdown não tem i18n de keywords (não é a mesma sintaxe do `.tjp`). Não aplicável.

---

## 5. Subfases detalhadas

**Bloco A — Core** (17.0–17.3)
**Bloco B — Extensões** (17.4–17.8)
**Bloco C — Conversão e integração** (17.9–17.11)
**Bloco D — Testes** (17.12)

---

### Bloco A — Core

---

### 17.0 — ADR 024 (Markdown como formato going-forward)

#### Contexto

ADR 009 (Fase 1) registra a coexistência RichText + Markdown, mas sem detalhes de implementação. Esta fase formaliza:

1. Parser base: `micromark` + `mdast-util-from-markdown`.
2. Reuso de `RichTextIntermediate` para AST unificada.
3. Extensões via pré/pós-processamento.
4. Não é dependência do parser `.tjp`.

#### Objetivo

Criar `docs/syntaxmesh/decisoes/024-markdown-going-forward.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/024-markdown-going-forward.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar tabela)

#### Requisitos

- [ ] **Contexto:** coexistência RichText/Markdown; falta de AST em `@deno/gfm`.
- [ ] **Decisões:**
  - Parser base: `micromark` (retorna AST).
  - `MarkdownFactory implements RichTextFactory`.
  - Extensões via pré/pós-processamento.
  - `RichTextIntermediate` reutilizado.
  - Não é dependência do parser `.tjp`.
- [ ] **Alternativas:** `@deno/gfm` (HTML apenas), `marked`, `remark`.
- [ ] **Consequências:** AST unificada; mais dependência.
- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/syntaxmesh/decisoes/009-richtext-mantido-markdown-futuro.md`.
- `docs/syntaxmesh/decisoes/023-richtext-handlers.md`.

#### Fora de escopo

- Implementação.

#### Critério de aceite

- ADR 024 criado.
- Tabela atualizada.

---

### 17.1 — Integração com `micromark`

#### Contexto

`micromark` é o parser de Markdown mais correto disponível. Produz AST no formato `mdast`.

#### Objetivo

Configurar `micromark` + `mdast-util-from-markdown` + `mdast-util-gfm` para produzir AST.

#### Arquivos

- `packages/markdown/deno.jsonc` — adicionar dependências:
  ```jsonc
  "imports": {
    "micromark": "npm:micromark@^4",
    "mdast-util-from-markdown": "npm:mdast-util-from-markdown@^2",
    "mdast-util-gfm": "npm:mdast-util-gfm@^3"
  }
  ```
- `packages/markdown/src/parse-mdast.ts`
- `packages/markdown/tests/parse-mdast_test.ts`

#### Requisitos

- [ ] `parseMdast(text: string): MdastRoot`:
  - Usa `micromark` com extensão `gfm`.
  - Retorna AST `mdast`.
- [ ] Tipos de nós esperados:
  - `root`, `paragraph`, `heading` (depth 1–6), `list`, `listItem`, `blockquote`, `code`, `inlineCode`, `emphasis`, `strong`, `link`, `image`, `text`, `break`, `thematicBreak`, `html`, `table`, `tableRow`, `tableCell`.
- [ ] Suportar `mdast` do tipo `gfm` (tables, strikethrough, autolinks).

#### Referências

- https://github.com/micromark/micromark
- https://github.com/syntax-tree/mdast

#### Critério de aceite

```ts
const ast = parseMdast("# Hello\n\n**World**.");
assertEquals(ast.type, "root");
assertEquals(ast.children[0].type, "heading");
assertEquals(ast.children[1].type, "paragraph");
```

#### Testes

- `parse-mdast_test.ts`:
  - `it("heading 1-6")`.
  - `it("paragraph")`.
  - `it("bold / italic")`.
  - `it("list ordered/unordered")`.
  - `it("code block")`.
  - `it("inline code")`.
  - `it("link")`.
  - `it("image")`.
  - `it("blockquote")`.
  - `it("hr")`.
  - `it("table (GFM)")`.
  - `it("strikethrough (GFM)")`.

---

### 17.2 — `MdastToRichText` (conversor AST → `RichTextElement`)

#### Contexto

Precisamos converter AST `mdast` para a árvore `RichTextElement` (Fase 12). Isso permite reuso de `to_s`, `to_html`, `setQuery`.

#### Objetivo

Implementar `MdastToRichText`.

#### Arquivos

- `packages/markdown/src/mdast-to-richtext.ts`
- `packages/markdown/tests/mdast-to-richtext_test.ts`

#### Requisitos

- [ ] `class MdastToRichText`:
  - `convert(root: MdastRoot): RichTextElement[]`.
- [ ] Mapeamento:
  - `root` → array de `RichTextElement` de nível superior.
  - `heading` (depth 1) → `title1`.
  - `heading` (depth 2) → `title2`.
  - `heading` (depth 3) → `title3`.
  - `heading` (depth 4+) → `title4`.
  - `paragraph` → `paragraph`.
  - `emphasis` → `italic`.
  - `strong` → `bold`.
  - `inlineCode` → `code`.
  - `code` → `pre`.
  - `list` (ordered) → `numberlist1`.
  - `list` (unordered) → `bulletlist1`.
  - `listItem` → `bulletitem1` ou `numberitem1`.
  - `blockquote` → `paragraph` com prefixo especial.
  - `link` → `href`.
  - `image` → `img` (`RichTextImage`).
  - `text` → `text`.
  - `break` → `LINEBREAK`.
  - `thematicBreak` → `hline`.
  - `html` → `htmlblob` (sanitizado).
  - `table` → sequência de `paragraph` (não suportado nativamente).
- [ ] `sectionCounter` incrementado em títulos.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/RichText/Element.rb` — categorias.
- Fase 12 — `RichTextElement`.

#### Critério de aceite

```ts
const conv = new MdastToRichText();
const elements = conv.convert(parseMdast("# H1\n\nParagraph."));
assertEquals(elements.length, 2);
assertEquals(elements[0].category, "title1");
assertEquals(elements[1].category, "paragraph");
```

#### Testes

- `mdast-to-richtext_test.ts`:
  - `it("heading")`.
  - `it("paragraph")`.
  - `it("bold")`.
  - `it("italic")`.
  - `it("inline code")`.
  - `it("code block")`.
  - `it("list ordered")`.
  - `it("list unordered")`.
  - `it("link")`.
  - `it("image")`.
  - `it("hr")`.
  - `it("blockquote")`.
  - `it("table → paragraph fallback")`.

---

### 17.3 — `MarkdownFactory`

#### Contexto

Implementa `RichTextFactory` (Fase 12) produzindo `RichTextIntermediate`.

#### Objetivo

Implementar `MarkdownFactory`.

#### Arquivos

- `packages/markdown/src/factory.ts`
- `packages/markdown/tests/factory_test.ts`
- `packages/markdown/mod.ts`

#### Requisitos

- [ ] `class MarkdownFactory implements RichTextFactory`:
  - Constructor `(project: Project | null, sfi: SourceFileInfo | null)`.
- [ ] `create(text: string): RichTextIntermediate`:
  - Pré-processa extensões (ver 17.4–17.8).
  - `mdast = parseMdast(preprocessed)`.
  - `elements = new MdastToRichText().convert(mdast)`.
  - Constrói `RichTextIntermediate` com os `elements`.
  - Registra handlers de `RTFHandlers.create(project, sfi)`.
- [ ] `createFromMdast(mdast: MdastRoot): RichTextIntermediate`.

#### Referências

- Fase 12 — `RichTextFactory`.

#### Critério de aceite

```ts
const factory = new MarkdownFactory(project, sfi);
const rti = factory.create("# Title\n\nParagraph.");
assertEquals(rti.to_s(), "1) Title\n\nParagraph.");
```

#### Testes

- `factory_test.ts`:
  - `it("create com markup simples")`.
  - `it("create com título")`.
  - `it("create com extensões")`.

---

### Bloco B — Extensões

---

### 17.4 — Extensão: cor (`<fcol:...>`)

#### Contexto

Markdown não tem cor. Extensão própria.

#### Objetivo

Implementar extração e conversão.

#### Arquivos

- `packages/markdown/src/extensions/color.ts`
- `packages/markdown/tests/extensions/color_test.ts`

#### Requisitos

- [ ] `preprocessColor(text: string): { text: string, extractions: Extraction[] }`:
  - Regex: `/<fcol:([a-z]+|#[0-9A-Fa-f]{3,6})>(.*?)<\/fcol>/g`.
  - Substituir por placeholder `§COLOR_n§`.
  - Registrar `{ placeholder, color, content }`.
- [ ] `postprocessColor(node: MdastNode, extractions: Extraction[]): MdastNode`.
  - Substituir placeholders por nós especiais `{ type: 'richtextExtension', category: 'fontCol', data: color, content }`.
- [ ] Validação de cor:
  - Cores nomeadas permitidas: `black`, `maroon`, `green`, `olive`, `navy`, `purple`, `teal`, `silver`, `gray`, `red`, `lime`, `yellow`, `blue`, `fuchsia`, `aqua`, `white`.
  - Hex: `#RGB` ou `#RRGGBB`.

#### Referências

- Fase 12 — `RichTextScanner.fontColorStart`.

#### Critério de aceite

Análogo.

#### Testes

- `color_test.ts`:
  - `it("cor nomeada")`.
  - `it("cor hex")`.
  - `it("cor inválida → texto simples")`.
  - `it("múltiplas cores")`.

---

### 17.5 — Extensão: HTML inline permitido

#### Contexto

Markdown com GFM aceita HTML. Precisamos sanitizar.

#### Objetivo

Implementar allow-list.

#### Arquivos

- `packages/markdown/src/extensions/html-sanitizer.ts`
- `packages/markdown/tests/extensions/html-sanitizer_test.ts`

#### Requisitos

- [ ] `sanitizeHtml(html: string): string`:
  - Parse tags.
  - **Allow-list:** `span`, `div`, `a`, `b`, `i`, `em`, `strong`, `code`, `pre`, `br`, `hr`, `p`, `ul`, `ol`, `li`, `blockquote`.
  - **Block-list:** `script`, `iframe`, `object`, `embed`, `style`, `link`, `meta`.
  - Se encontrar tag fora da allow-list ou na block-list, remove tag, mantém conteúdo.
  - Atributos permitidos: `class`, `id`, `href`, `title`, `target`, `style` (com validação).
  - Atributos de eventos (`onclick`, etc.) removidos.

#### Referências

- Segurança em HTML; sem referência direta no TJ.

#### Critério de aceite

```ts
assertEquals(sanitizeHtml('<script>alert(1)</script>'), '');
assertEquals(sanitizeHtml('<span>ok</span>'), '<span>ok</span>');
assertEquals(sanitizeHtml('<a href="x" onclick="y">z</a>'), '<a href="x">z</a>');
```

#### Testes

- `html-sanitizer_test.ts`:
  - `it("allow-list tag")`.
  - `it("remove script")`.
  - `it("remove atributo de evento")`.
  - `it("preserva href")`.

---

### 17.6 — Extensão: funções customizadas

#### Contexto

Markdown não tem `[[query:...]]`. Extensão própria.

#### Objetivo

Implementar extração e conversão.

#### Arquivos

- `packages/markdown/src/extensions/functions.ts`
- `packages/markdown/tests/extensions/functions_test.ts`

#### Requisitos

- [ ] `preprocessFunctions(text: string): { text: string, extractions: Extraction[] }`:
  - Regex: `/\[\[([a-z]+):([^\]]+)\]\]/g`.
  - `functionName = match[1]`.
  - `argsRaw = match[2]`.
  - Parse de args: pares `key=value` ou posicionais.
- [ ] Args em `key=value`:
  - Regex: `/([a-z]+)="([^"]*)"|(\S+)/g`.
  - Suporta `[[query:attribute=effort]]` e `[[query:attribute="effort total"]]`.
- [ ] Substituição por placeholder `§FUNC_n§`.
- [ ] `postprocessFunctions(node, extractions)`: substitui placeholders por `{ type: 'richtextExtension', category: 'inlinefunc', data: [name, args] }`.

**Nota:** `[[report:...]]` e `[[navigator:...]]` são `blockfunc` se sozinhos em parágrafo; `inlinefunc` se inline.

#### Referências

- Fase 12 — `RichTextSyntaxRules.rule_inlineFunction`, `rule_blockFunction`.

#### Critério de aceite

```ts
const { text, extractions } = preprocessFunctions('Result: [[query:attribute=effort]]');
assertEquals(text, 'Result: §FUNC_0§');
assertEquals(extractions[0].functionName, 'query');
assertEquals(extractions[0].args, { attribute: 'effort' });
```

#### Testes

- `functions_test.ts`:
  - `it("query simples")`.
  - `it("query com args key=value")`.
  - `it("query com valor entre aspas")`.
  - `it("report inline")`.
  - `it("report block (parágrafo isolado)")`.
  - `it("múltiplas funções")`.
  - `it("função desconhecida → texto simples")`.

---

### 17.7 — Extensão: mini-queries (`<-name->`)

#### Contexto

Markdown não tem `<-name->`. Extensão própria.

#### Objetivo

Implementar extração e conversão.

#### Arquivos

- `packages/markdown/src/extensions/mini-query.ts`
- `packages/markdown/tests/extensions/mini-query_test.ts`

#### Requisitos

- [ ] `preprocessMiniQueries(text: string): { text: string, extractions: Extraction[] }`:
  - Regex: `/<-([a-zA-Z][_a-zA-Z]*)->/g`.
  - Substituição por `§MINIQ_n§`.
- [ ] `postprocessMiniQueries(node, extractions)`: substitui por `{ type: 'richtextExtension', category: 'inlinefunc', data: ['query', { attribute }] }`.

#### Referências

- Fase 12 — `RichTextSyntaxRules.rule_wordWithQueries`.

#### Critério de aceite

Análogo.

#### Testes

- `mini-query_test.ts`:
  - `it("simples")`.
  - `it("múltiplas")`.
  - `it("inválida → texto simples")`.

---

### 17.8 — Pipeline de pré/pós-processamento

#### Contexto

Cada extensão tem seu `preprocess` e `postprocess`. Precisamos orquestrar.

#### Objetivo

Implementar pipeline unificado.

#### Arquivos

- `packages/markdown/src/extensions/pipeline.ts`
- `packages/markdown/tests/extensions/pipeline_test.ts`

#### Requisitos

- [ ] `class ExtractionPipeline`:
  - `private extractions: Map<string, Extraction>`.
  - `preprocess(text: string): string`:
    - Ordem: color → functions → mini-queries.
    - Cada extensão registra extrações.
  - `postprocessMdast(mdast: MdastRoot): MdastRoot`:
    - Substitui placeholders por nós especiais.
- [ ] `interface Extraction`:
  - `placeholder: string`
  - `category: 'fontCol' | 'inlinefunc' | 'blockfunc'`
  - `data: unknown`

#### Referências

- Seções 4.2, 17.4, 17.6, 17.7.

#### Critério de aceite

Análogo.

#### Testes

- `pipeline_test.ts`:
  - `it("ordem de processamento")`.
  - `it("múltiplas extensões no mesmo texto")`.
  - `it("placeholder único por extração")`.

---

### Bloco C — Conversão e integração

---

### 17.9 — `to_markdown` em `RichTextIntermediate`

#### Contexto

Para reports que pedem Markdown, precisamos de `to_markdown()`.

#### Objetivo

Adicionar `to_markdown()` em `RichTextIntermediate` (Fase 12).

#### Arquivos

- `packages/richtext/src/rich-text-intermediate.ts` (estender)
- `packages/richtext/tests/rich-text-intermediate-markdown_test.ts`

#### Requisitos

- [ ] `to_markdown(): string`:
  - Itera `tree` recursivamente.
  - Categorias:
    - `title1-4` → `#`–`####` + texto.
    - `paragraph` → texto + `\n\n`.
    - `italic` → `*texto*`.
    - `bold` → `**texto**`.
    - `code` → `` `código` ``.
    - `pre` → ` ```\n...\n``` `.
    - `bulletitem1-4` → `- ` com indentação.
    - `numberitem1-4` → `1. ` com indentação.
    - `href` → `[texto](url)`.
    - `ref` → `[[ref]]`.
    - `img` → `![alt](file)`.
    - `hline` → `---`.
    - `fontCol` → `<fcol:cor>texto</fcol>` (mantém extensão).
    - `inlinefunc` / `blockfunc` → `[[func:args]]`.
    - `htmlblob` → HTML puro.
    - `text` → texto puro.

#### Referências

- Fase 12 — `RichTextElement.to_s`.

#### Critério de aceite

```ts
const rti = /* ... */;
assertEquals(rti.to_markdown(), "# Title\n\nParagraph.");
```

#### Testes

- `rich-text-intermediate-markdown_test.ts`:
  - `it("title1-4")`.
  - `it("paragraph")`.
  - `it("italic")`.
  - `it("bold")`.
  - `it("code inline")`.
  - `it("code block")`.
  - `it("bullet list")`.
  - `it("number list")`.
  - `it("href")`.
  - `it("img")`.
  - `it("hr")`.
  - `it("fontCol")`.
  - `it("inlinefunc")`.

---

### 17.10 — Conversor `richTextToMarkdown`

#### Contexto

Para migração de conteúdo, converter `RichText` (MediaWiki) em Markdown.

#### Objetivo

Implementar `richTextToMarkdown`.

#### Arquivos

- `packages/markdown/src/convert-rich-to-md.ts`
- `packages/markdown/tests/convert-rich-to-md_test.ts`

#### Requisitos

- [ ] `richTextToMarkdown(richText: string): string`:
  - Cria `RichText` (Fase 12), gera `RichTextIntermediate`.
  - Chama `to_markdown()`.
- [ ] Marca no output que a conversão é **one-way** (comentário no topo opcional).
- [ ] Funções customizadas são preservadas (`[[query:...]]` etc.).

#### Referências

- Seção 4.8.

#### Critério de aceite

```ts
assertEquals(
  richTextToMarkdown("== Title ==\n\n'''bold'''"),
  "# Title\n\n**bold**"
);
```

#### Testes

- `convert-rich-to-md_test.ts`:
  - `it("títulos")`.
  - `it("bold/italic")`.
  - `it("listas")`.
  - `it("links")`.
  - `it("preserva funções")`.

---

### 17.11 — Integração com `MarkdownFactory`

#### Contexto

Consolidar a integração.

#### Objetivo

Testes end-to-end.

#### Arquivos

- `packages/markdown/tests/integration_test.ts`

#### Requisitos

- [ ] `MarkdownFactory.create(texto)` com todas as extensões.
- [ ] `RTFQuery` funciona dentro de Markdown.
- [ ] `to_s`, `to_html`, `to_markdown` consistentes.
- [ ] Migração: RichText → Markdown → RichText deve produzir resultados equivalentes em texto (não byte-a-byte).

#### Referências

- Fases 11, 12.

#### Critério de aceite

Análogo.

#### Testes

- `integration_test.ts`:
  - `it("create com todas as extensões")`.
  - `it("to_html consistente")`.
  - `it("to_markdown consistente")`.
  - `it("RTFQuery dentro de Markdown")`.

---

### Bloco D — Testes

---

### 17.12 — Golden tests (snapshot)

#### Contexto

Sem referência Ruby. Golden tests são **snapshot** — o output é congelado.

#### Objetivo

Congelar snapshots.

#### Arquivos

- `packages/markdown/tests/golden/markdown-snapshots.json` (gerado no primeiro run)
- `packages/markdown/tests/golden/snapshot_test.ts`

#### Requisitos

- [ ] Lista de fixtures:
  - Markdown simples (heading, paragraph, lists).
  - Markdown com extensões (color, functions, mini-query).
  - HTML inline (com sanitização).
- [ ] Para cada fixture:
  - Input Markdown.
  - `to_s`, `to_html`, `to_markdown` congelados.
- [ ] Se snapshot divergir, mostra diff.

#### Referências

- Seção 3.3.

#### Critério de aceite

- ≥ 20 fixtures.
- Snapshots estão em sync com o código.

#### Testes

- `snapshot_test.ts`:
  - `describe("Markdown snapshots")` — itera fixtures.

---

## 6. Ordem de execução sugerida

```text
17.0  ADR 024
      ↓
17.1  Integração micromark
      ↓
17.2  MdastToRichText
      ↓
17.4  Extensão color
17.5  Extensão HTML sanitizer
17.6  Extensão functions
17.7  Extensão mini-queries
17.8  Pipeline
      ↓
17.3  MarkdownFactory
      ↓
17.9  to_markdown
17.10 Conversor RichText → Markdown
      ↓
17.11 Integração
      ↓
17.12 Snapshot tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 13 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `MarkdownFactory` funcional com todas as extensões.
- [ ] `MdastToRichText` cobre nós comuns.
- [ ] `to_markdown()` em `RichTextIntermediate`.
- [ ] `richTextToMarkdown` funcional.
- [ ] Sanitização de HTML.
- [ ] **≥ 80 testes unitários**.
- [ ] **≥ 20 snapshot tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] ADR 024 criado.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| `micromark` gera AST que não cobre tudo | Médio | Fallback para `@deno/gfm` HTML |
| Sanitização incompleta | **Alto** | Testes com OWASP vectors |
| Extensões mal pré-processadas | Alto | Pipeline com testes exaustivos |
| `to_markdown` perde informação | Médio | Aceito; conversão one-way |
| `Micromark` performance lenta | Médio | Benchmarks; cache se necessário |
| Duplicação de parsers (RichText + Markdown) | Médio | Aceito por ADR 009/024 |
| `mdast` muda de versão | Médio | Fixar versões |
| Funções customizadas com args complexos | Médio | Parse robusto |
| Colisão de placeholders (`§`) no input | Baixo | Escolha de delimitador raro |
| HTML inline em Markdown aninhado | Médio | Testes com blocos aninhados |

---

## 9. Referências cruzadas

### Documentos do projeto

- `docs/syntaxmesh/decisoes/009-richtext-mantido-markdown-futuro.md`
- `docs/syntaxmesh/decisoes/024-markdown-going-forward.md` (novo)
- `docs/syntaxmesh/04-linguagem-multilingue.md`

### Bibliotecas

- `micromark` — https://github.com/micromark/micromark
- `mdast` — https://github.com/syntax-tree/mdast
- `mdast-util-from-markdown` — https://github.com/syntax-tree/mdast-util-from-markdown
- `mdast-util-gfm` — https://github.com/syntax-tree/mdast-util-gfm

### Fases dependentes

- **Fase 14 — Reports** (conteúdo de reports pode ser Markdown).
- **Fase 20 — UI** (editor Markdown).
- **Fase 21 — Compatibilidade** (fixtures Markdown).

---

## 10. Notas para a IA

1. **Fase aditiva.** Não substitui RichText.
2. **`micromark` retorna AST**; `@deno/gfm` retorna HTML. Usar `micromark`.
3. **Reuso de `RichTextIntermediate`.** Fase 12 define a classe; Markdown reusa.
4. **Extensões via pré/pós-processamento.** Não modificar o parser Markdown.
5. **Placeholders devem ser únicos** (`§COLOR_n§`).
6. **Sanitização de HTML é crítica.** OWASP vectors nos testes.
7. **`to_markdown` é one-way.** Não esperar round-trip perfeito.
8. **`richTextToMarkdown` preserva funções customizadas.**
9. **Não é dependência do parser `.tjp`.** Markdown é conteúdo nativo.
10. **Snapshot tests** são o critério final.
11. **Commit por subfase.** `feat(markdown): factory`, etc.
12. **Sem `any`.** Use `unknown` + narrowing.

---

## 11. ADR 024 (referência rápida)

Criado como subfase 17.0. Conteúdo esperado:

- **Título:** Markdown como formato going-forward
- **Contexto:** coexistência RichText/Markdown; falta de AST em `@deno/gfm`.
- **Decisões:**
  - Parser: `micromark` (AST).
  - `MarkdownFactory implements RichTextFactory`.
  - Extensões via pré/pós-processamento.
  - `RichTextIntermediate` reutilizado.
  - Não é dependência do parser `.tjp`.
- **Alternativas:** `@deno/gfm`, `marked`, `remark`.
- **Consequências:** AST unificada; mais dependência.

---

**Fim da Fase 13.**