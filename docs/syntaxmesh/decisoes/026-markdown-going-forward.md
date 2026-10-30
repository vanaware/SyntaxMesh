# ADR 026 — Markdown como formato going-forward

> **Status:** ✅ Aceito
> **Data:** 2026-10-29
> **Autores:** Qoder

## Resumo

Markdown é o formato de markup **nativo** do SyntaxMesh (docs, tutoriais, notas
de projetos novos). RichText (Fase 12) continua sendo o formato dos arquivos
`.tjp`, por compatibilidade absoluta com o TaskJuggler (ADR 009). As decisões
centrais desta fase:

1. **Parser base: `micromark` + `mdast-util-from-markdown` + GFM** — devolvem
   AST (`mdast`), não HTML.
2. **AST unificada** — `MarkdownFactory implements RichTextFactory` e produz o
   mesmo `RichTextIntermediate`/`RichTextElement` da Fase 12; reports consomem
   os dois formatos sem distingui-los.
3. **Extensões via pré/pós-processamento** — `<fcol:…>`, `[[func:…]]` e
   `<-nome->` são extraídos para placeholders (`§COLOR_n§`, `§FUNC_n§`,
   `§MINIQ_n§`), o Markdown é parseado, e os placeholders voltam como nó
   sintético `richtextExtension` na AST.
4. **Não é dependência do parser `.tjp`** — `ProjectFileParser` continua
   usando `RichTextFactoryImpl`; nada no caminho `.tjp` conhece Markdown.
5. **Saída Markdown** — `RichTextElement.to_markdown()` /
   `RichTextIntermediate.to_markdown()`, mais o conversor one-way
   `richTextToMarkdown()` para migração.

> **Nota de numeração:** o plano (`fase-13-markdown.md`) e o arquivo de tarefas
> chamam esta decisão de `ADR 025`, mas o slot 025 foi consumido por
> *RichText e function handlers* (Fase 12). O README já reservava o **026** para
> *Markdown como formato going-forward*; usamos 026.

## Contexto

A Fase 12 entregou o RichText (dialeto MediaWiki do TaskJuggler). Ele é ótimo
para compatibilidade, mas é ruim para conteúdo escrito hoje: tabelas, listas de
tarefas, blocos de código e links exigem markup exótico, e nenhuma ferramenta
externa (editores, LLMs, GitHub) fala esse dialeto.

Precisamos de um formato going-forward sem quebrar nada:

- os `.tjp` existentes têm que continuar renderizando **exatamente** como antes
  (regra de ouro: port fiel, ADR 011);
- relatórios (Fase 14) precisam consumir markup vindo de qualquer um dos dois
  formatos;
- funções customizadas (`[[query:…]]`, `[[report:…]]`, `[[navigator:…]]`) e
  mini-queries (`<-effort->`) têm que continuar funcionando, porque são a ponte
  entre conteúdo e o motor de Queries (Fase 11).

O candidato natural em Deno seria `@deno/gfm`, mas ele é um **renderizador**:
recebe Markdown e devolve HTML. Para construir a árvore `RichTextElement`
precisamos da estrutura, não do markup de saída. As alternativas eram parsear o
HTML de volta (frágil), ou usar um parser que devolve AST.

## Decisão

1. **`micromark` para a AST.** `mdast-util-from-markdown` com
   `micromark-extension-gfm` + `mdast-util-gfm` produz `mdast` (`Root`) com
   CommonMark + GFM (tabelas, `~~strikethrough~~`, autolinks, task lists).
   Adicionado em `packages/core/deno.jsonc` como `npm:` specifiers.
2. **`MarkdownFactory implements RichTextFactory`**
   (`packages/core/src/markdown/factory.ts`). O contrato da Fase 12
   (`create(text, tokenSet?) → RichTextIntermediate`) é preservado, de modo que
   qualquer consumidor de RichText possa receber Markdown trocando a fábrica.
3. **Conversor `MdastToRichText`** (`mdast-to-richtext.ts`) mapeia nós `mdast`
   para categorias `RichTextElement`: `heading`→`title1..4` (com o mesmo
   `sectionCounter` e as mesmas regras de reset do parser RichText),
   `paragraph`→`paragraph`, `emphasis`→`italic`, `strong`→`bold`,
   `inlineCode`→`code`, `code`→`pre`, `list`→`bulletlistN`/`numberlistN` +
   `bulletitemN`/`numberitemN`, `link`→`href`, `image`→`img`
   (`RichTextImage`), `thematicBreak`→`hline`, `html`→`htmlblob`
   (sanitizado), `blockquote`→`paragraph` com prefixo `"> "`.
4. **Extensões em pré/pós-processamento** (`extensions/`), orquestradas por
   `ExtractionPipeline` na ordem **color → functions → mini-queries**. O parser
   Markdown **não é modificado** — nenhuma extensão de `micromark` própria é
   escrita. O conteúdo interno de `<fcol:…>` é reprocessado pelos estágios
   seguintes, então `<fcol:red>[[query:attribute=effort]]</fcol>` funciona.
5. **Nó sintético tipado.** O módulo `mdast` é aumentado
   (`markdown/types.ts`) com `RichTextExtensionNode` (`type:
   "richtextExtension"`, `category`, `payload`, `children`) registrado em
   `ContentMap`/`PhrasingContentMap`, o que mantém a árvore tipada sem `any` e
   sem um segundo sistema de tipos.
6. **HTML inline com allow-list** (`extensions/html-sanitizer.ts`): tags
   seguras (`span`, `div`, `a`, `b`, `i`, `em`, `strong`, `code`, `pre`, `br`,
   `hr`, `p`, `ul`, `ol`, `li`, `blockquote`) e atributos
   `class`/`id`/`href`/`title`/`target`/`style`; tags perigosas têm o *tag*
   removido e o conteúdo preservado; atributos de evento (`on*`) e URLs
   `javascript:`/`data:text/html`/`vbscript:` são descartados.
7. **`blockfunc` vs `inlinefunc`** decidido no pós-processamento: função listada
   como bloco (`report`, `navigator` — os handlers da Fase 12 com
   `blockFunction = true`) e sozinha no parágrafo vira `blockfunc`. Função
   desconhecida vira **texto cru** (nada de exceção em `to_s`).
8. **`to_markdown()` one-way.** Adicionado a `RichTextElement` e
   `RichTextIntermediate`. `richTextToMarkdown(texto)` converte RichText →
   Markdown; o caminho inverso não é garantido byte-a-byte, apenas
   semanticamente equivalente em texto puro.
9. **Markdown não entra no `.tjp`** — `ProjectFileParser` não é tocado. Se um
   dia aceitarmos Markdown dentro de `.tjp`, será por keyword explícita
   (`markdownnote`), em fase futura.

## Consequências

### Positivas

- Reports (Fase 14), `to_html`, `to_s`, `setQuery` e os handlers da Fase 12
  passam a servir os dois formatos sem mudança.
- CommonMark + GFM corretos por construção (usamos o parser de referência do
  ecossistema, o mesmo que o Deno usa internamente para `@deno/gfm`).
- Extensões permanecem isoladas e testáveis individualmente; um bug de `<fcol>`
  não pode corromper o parse do resto do documento.
- Migração de conteúdo antigo é mecanicamente possível (`richTextToMarkdown`).

### Negativas / Riscos

- **Mais dependências npm** (`micromark`, `mdast-util-*`, `@types/mdast`) num
  projeto que até aqui era stdlib+jsr. Mitigação: versões fixadas por
  `^major` no `deno.jsonc` do core e um único módulo (`parse-mdast.ts`) encosta
  na API de terceiros.
- **Dois parsers de markup** (RichText + Markdown) — duplicação aceita por
  ADR 009/026; o RichText será depreciado lentamente.
- `to_markdown` **perde** informação que só existe em RichText (ex.:
  `htmlblob` não sanitizado volta cru; `table` RichText não existe). Aceito: a
  conversão é declarada one-way.
- Placeholders com `§` colidem se o usuário escrever `§COLOR_0§` literalmente.
  Risco baixo; o delimitador é incomum e a substituição é estável (a extração
  sempre vence o texto cru).
- `mdast` é um tipo em evolução; mudanças de maior versão quebrariam o
  conversor. Mitigação: snapshot tests (13.12) congelam o comportamento.

### Neutras / Observações

- `micromark` (o renderizador HTML) fica registrado nas imports mas não é usado
  pelo pipeline de AST; mantém-se para o futuro caminho de export HTML direto.
- Tabelas Markdown não têm equivalente em RichText: viram sequência de
  `paragraph` (fallback documentado em 13.2.16).
- Strikethrough (`delete` em `mdast`) também não tem categoria RichText; é
  preservado como texto `~~…~~` para não perder conteúdo.
- Adendo 13.14 (imagens em Markdown, origem Fase 10 Complemento #5): a
  classificação URL externa × caminho relativo e o seam `ImageResolver` são
  entregues aqui; a resolução real em OPFS/`FileStore` fica ancorada na
  Fase 19.

---

**Status:** Aceito
**Data:** 2026-10-29
**Autor(es):** Qoder
**Implementação:** `packages/core/src/markdown/` (Fase 13)
**Referências:** ADR 009, ADR 025, `docs/syntaxmesh/fases/fase-13-markdown.md`
