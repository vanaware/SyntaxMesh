# Fase 22 — Tarefas atômicas

> **Fase:** 22 — Extensão VS Code (`lsp-core` + `doc-core` + tooling de edição)
> **Plan:** [Major blocks P1–P7](fase-22-vscode-extension.md#0-major-blocks-and-subblocks)
> and original subphases 22.0–22.11 in §13.
> **Status:** `PAR` — CLI-facing `doc-core` delivered; editor extension not started.
> **Recorded progress:** 86/108 tasks in 22.1b only; not a phase-wide total.
> **Scope of this update:** planning organization, no implementation or reopened tasks.
> **Decisão de escopo:** varredura `docs/syntaxmesh/xray.md` §3.2/§8 — decisão do
> usuário em **2026-11-03**: todo o núcleo de documentação e sintaxe sai da
> Fase 16 e passa a viver **nesta fase**, na subfase **22.1b `doc-core`**
> (`@vanaware/syntaxmesh/doc-core`), portado de `docs/taskjuggler/lib/taskjuggler/`.
> **Regra zero (ADR 011):** port fiel; divergências só onde o runtime não permite
> (escrita a disco, ANSI, `$stderr`) — sempre anotadas com `⚠️ ADAPTAÇÃO`.

## Escopo deste arquivo

This is a **partially detailed** task document: only 22.1b has atomic tasks
(C–H, integration I, verification J). The major planning blocks are navigation
and dependency boundaries, not a second execution list. All original task IDs,
consumer annotations, and the historical progress section below remain intact.

### Major-block navigation

| Planning block | Subblocks | Original owners | Atomic detail |
|---|---|---|---|
| [P1 — Scope and architecture](fase-22-vscode-extension.md#p1-scope-and-architecture) | P1.1 baseline; P1.2 layers; P1.3 ADR | 22.0 (A) | Pending |
| [P2 — Shared language/documentation cores](fase-22-vscode-extension.md#p2-shared-language-and-documentation-cores) | P2.1 workspace; P2.2 docs; P2.3 highlight; P2.4 pure LSP; P2.5 bridges/verification | 22.1 (B), 22.1b (C–J) | 22.1b detailed; remaining 22.1 pending |
| [P3 — Editor foundation](fase-22-vscode-extension.md#p3-editor-foundation-and-language-tooling) | P3.1 shell; P3.2 grammar/snippets; P3.3 transport integration | 22.2–22.4 | Pending |
| [P4 — Execution, reports and UX](fase-22-vscode-extension.md#p4-project-execution-reports-and-editor-ux) | P4.1 API audit; P4.2 daemon; P4.3 reports; P4.4 commands/views/trust | 22.5–22.7 | Pending |
| [P5 — Web and storage](fase-22-vscode-extension.md#p5-web-host-and-storage-adaptation) | P5.1 browser graph; P5.2 writes; P5.3 storage fallbacks | 22.8 | Pending |
| [P6 — Standalone LSP](fase-22-vscode-extension.md#p6-standalone-lsp-adapter) | P6.1 stdio bootstrap; P6.2 build/protocol smoke | 22.9 | Pending |
| [P7 — Packaging and handoff](fase-22-vscode-extension.md#p7-packaging-acceptance-and-handoff) | P7.1 builds; P7.2 acceptance; P7.3 closure/F21² | 22.10–22.11 | Pending |

### Original task owners and recorded implementation

`OK` = delivered, `PAR` = partial, `PLA` = planned/not implemented. Detail and
implementation are separate: a written task table is not a completed deliverable.
Counts below mirror the historical 22.1b progress table, not a new verification.

| Task block | Subphase | P-subblock | Subject | Detail | Recorded implementation |
|---|---|---|---|---|---|
| A | 22.0 | P1.1–P1.3 | ADR 035 and index entry | Pending | `PLA` |
| B | 22.1 | P2.1, P2.4 | Existing rename; remaining workspace and pure `lsp-core` | Pending | `PAR` — rename delivered |
| C | 22.1b | P2.2 | `TernarySearchTree` | Detailed below | `PAR` — 11/12 |
| D | 22.1b | P2.2 | `SyntaxReference` | Detailed below | `PAR` — 12/15 |
| E | 22.1b | P2.2 | `KeywordDocumentation` (E.1 data, E.2 text, E.3 HTML) | Detailed below | `PAR` — 27/29 |
| F | 22.1b | P2.2 | Examples (`TjpExample`, delivered as `ExampleSnippet`) | Detailed below | `OK` — 10/10 |
| G | 22.1b | P2.2 | `UserManual` (G.1 sources, G.2 class) | Detailed below | `OK` — 14/14, recorded adaptations retained |
| H | 22.1b | P2.3 | `SyntaxCore` shared highlight data | Detailed below | `PLA` — 0/10; 6.9 outside v1 |
| I | 22.1b | P2.5 | Exports/purity, editor bridges, CLI, smoke/cache | Detailed below | `PAR` — 7/10 |
| J | 22.1b | P2.5 | Oracle/gates/coverage/documentation | Detailed below | `PAR` — 5/8 |
| To assign at detailing | 22.2 | P3.1 | Extension shell | Pending | `PLA` |
| To assign at detailing | 22.3 | P3.2 | Grammar, snippets, snapshots | Pending | `PLA` |
| To assign at detailing | 22.4 | P3.3 | Desktop/Web LSP integration | Pending | `PLA` |
| To assign at detailing | 22.5 | P4.1–P4.2 | F24 API audit, then explicit daemon/cache | Pending | `PLA` |
| To assign at detailing | 22.6 | P4.3 | Shared execution contract and report output policy | Pending | `PLA` |
| To assign at detailing | 22.7 | P4.4 | Export/input-language/help, config, views and trust | Pending | `PLA` |
| To assign at detailing | 22.8 | P5.1–P5.3 | Web runtime, writes and storage fallbacks | Pending | `PLA` |
| To assign at detailing | 22.9 | P6.1–P6.2 | Standalone stdio server/build | Pending | `PLA` |
| To assign at detailing | 22.10 | P7.1–P7.2 | Packaging and clean-install acceptance | Pending | `PLA` |
| To assign at detailing | 22.11 | P7.2–P7.3 | Final verification and F21² handoff | Pending | `PLA` |

The old `K–S` range was an undetailed placeholder, not assigned task IDs; it
compressed ten subphases into nine letters. Use the explicit 22.2–22.11 owners
above until each is detailed, without renumbering A–J or any 22.1b task.

Before execution, detail one original subphase at a time (≤ 2h per task, tests
first). In P2, docs/highlight can use the existing engine; I 7.5–7.7 requires
P2.4's analysis foundation and the corresponding docs APIs. In P4, audit the
F24 contract before deciding the daemon/report model seam. F21¹ remains the
kickoff gate; P6 may proceed after 22.4 independently of P4/P5. Follow the
entry/exit criteria in plan §0 and the original-ID dependency map in §13.

## Convenções

- Formato `| # | Tarefa | Arquivos | Verificação |`; TDD (teste junto da
  implementação), tarefa ≤ 2h, um verbo.
- ⚠️ = exige conferência linha a linha com o Ruby. Sem emoji quando é cópia direta.
- `deno check` na coluna Verificação = `deno task check:all`.

### Legenda de consumidor (o que serve a quem)

| Marca | Significado |
|---|---|
| **【24】** | Consumido pela **Fase 24** via `syntaxmesh man` (`fase-24-cli-tarefas.md` 24.9.1–24.9.3) — texto, HTML e busca de keyword |
| **【LSP】** | Fica **restrito ao `lsp-core`/extensão** (F22): o CLI não consome |
| **【24+LSP】** | Núcleo compartilhado: serve os dois consumidores a partir da mesma API |
| **【novo】** | Sem correspondente Ruby — extensão TS (markdown p/ hover, API de retorno) |

> **Regra de fronteira:** o `doc-core` **não escreve em disco e não fala com o
> terminal**. Toda saída é devolvida como dado (`string`, `Record<nome, conteúdo>`,
> arrays de tipos). Quem decide *onde* pôr o arquivo é a Fase 24 (`Deno.writeTextFile`)
> ou a extensão (buffer em memória). Padrão já usado em
> `richtext/rich-text-document.ts::generateHTML` → `Record<string, string>` e na seam
> `richtext/html-shell.ts` (ADR 025).

### Nota de planejamento (2026-11-07) — reaproveitamento da API `execute` (Fase 24)

As camadas **daemon** (22.5 — *tj3d/tj3client simulado*) e **relatórios**
(22.6 — *tj3webd simulado*) usam **a mesma API de execução da CLI**:
`core.execute(request)` → envelope JSON (`fase-24-cli-adendo.md`, v2/v2.1 —
entrada `request.files` de `{ path, content }` com o fechamento de `include`s,
sem provedor; conteúdos não voltam no envelope; `messages`/`exitCode` como
dados). **Não existe fork de API para a extensão.** P4.1–P4.3 (original owners
22.5/22.6), when detailed at kickoff, must include these tasks:

- **Auditoria de compatibilidade** do contrato atual com os conceitos
  `tj3d`/`tj3client`/`tj3webd` (alimentar `request.files` com buffer
  `document.getText()` + `workspace.fs`; consumir `listReports`/`reports`/`check`
  no Problems panel, webview e `workspace.fs.writeFile`).
- **Ampliação, se necessária, planejada**: p. ex. modelo de projeto persistente
  no core (gerar relatório sem re-parse), semântica load/unload/list-projects —
  o delta entra como **adendo à Fase 24** (source of truth da API), propagado
  ao plano/tarefas da F24 e registrado em `CURRENT.md`; nunca improvisar API
  paralela dentro da extensão.
- **Alternativa sem delta já contratada**: fachada passo-a-passo
  (`parse`/`parseContent` com provedor → `schedule` →
  `generateReports`/`renderReports`), compartilhada com o caminho UI/PWA
  (Fase 20) — usar apenas para manter o modelo em memória, jamais para
  reorquestrar o fluxo que o `execute` já cobre.

---

## Mapa Ruby → TypeScript (22.1b)

| Fonte Ruby (`docs/taskjuggler/lib/taskjuggler/`) | Linhas | Destino TS | Consumidor |
|---|---|---|---|
| `TernarySearchTree.rb` (16.9 **movido** da F16) | 206 | `src/utils/ternary-search-tree.ts` | 【24+LSP】 |
| `SyntaxReference.rb` | 300 | `src/docgen/syntax-reference.ts` | 【24+LSP】 |
| `KeywordDocumentation.rb` | 764 | `src/docgen/keyword-documentation.ts` | 【24+LSP】 |
| `TjpExample.rb` | 123 | `src/docgen/tjp-example.ts` | 【24+LSP】 |
| `UserManual.rb` | 243 | `src/docgen/user-manual.ts` | 【24】 (HTML) 【LSP】 (TOC/páginas) |
| `KateSyntax.rb` — só `initialize`/`keywords`/`contexts` (16.14 **movido**) | 214 | `src/docgen/syntax-core.ts` | 【LSP】 |
| `VimSyntax.rb` — só `initialize`/`setLocal`/`keywords`/`regions` (16.14 **movido**) | 250 | `src/docgen/syntax-core.ts` | 【LSP】 |
| `apps/Tj3Man.rb` (referência de uso, **não** portado aqui) | 133 | — (Fase 24, 24.9) | — |
| `Term::ANSIColor` (gem) | — | `src/docgen/ansi.ts` (mínimo próprio) | 【24】 |

`SyntaxReference`/`KeywordDocumentation` consomem a engine **já existente**:
`parser/text-parser.ts` (`rules: Map<string, Rule>`, `updateParserTables()`),
`parser/pattern.ts` (`keyword`, `doc`, `supportLevel`, `seeAlso`,
`terminalTokens()`, `to_syntax()`), `lexer/token-doc.ts`, `utils/text-formatter.ts`,
`richtext/{rich-text-document,toc-entry,table-of-contents,html-shell}.ts` e
`richtext/handlers/function-example.ts` (`RichTextFunctionExample`). Nada novo
nessas camadas além do §I.1 abaixo.

---

## Bloco C — 22.1b.1 `TernarySearchTree` (movido da Fase 16, tarefa 16.9)

**⚠️ RUBY: `TernarySearchTree.rb`** — árvore ternária clássica sobre elementos
comparáveis (String/Array); `find(str, true)` devolve **todos os prefixos**.
**🔎 CHEAT: §3 recursão, §12 Categoria B (partial match)**
**Consumidor:** 【24+LSP】 — `syntaxmesh man` usa para busca por prefixo/fuzzy
(`Tj3Man.rb:30,76`); o LSP usa em `completion`/`workspaceSymbol`.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.1.1 | Criar `class TernarySearchTree<T extends string = string>` com campos `value`, `smaller`, `equal`, `larger`, `last` e `private clear()` | `src/utils/ternary-search-tree.ts` | `deno check` |
| 22.1b.1.2 | ⚠️ Constructor `(arg?: T \| T[] \| null)`: array → `sortForBalancedTree(...)` + inserção; senão `insert(arg)` | idem | 3 testes (vazio, string única, lista) |
| 22.1b.1.3 | ⚠️ `insert(str, index = 0)` com `ArgumentError` para `null`/vazio e índice fora de `[0..len-1]` | idem | 4 testes (menor/igual/maior/fim, 2 de erro) |
| 22.1b.1.4 | `insertList(list: T[])` e alias de método `add` (≡ `<<`) | idem | 2 testes |
| 22.1b.1.5 | ⚠️ `find(str, partialMatch = false, index = 0): T \| T[] \| null` — caso de prefixo: `collect` remontando `str[0..-2]` | idem | 6 testes (exato, inexistente, prefixo único, prefixo múltiplo, `null`, string vazia) |
| 22.1b.1.6 | ⚠️ `collect(prefix: T \| null, fn: (s: T) => U): U[]` — ordem smaller → equal → larger (ordem **alfabética** garantida) | idem | 3 testes |
| 22.1b.1.7 | ⚠️ `length(): number` e `maxDepth(depth = 0): number` | idem | 4 testes |
| 22.1b.1.8 | ⚠️ `toArray(): T[]`, `balance(): void` (≡ `balance!`) e `balanced(): TernarySearchTree<T>` | idem | 4 testes (round-trip, idempotência, profundidade cai) |
| 22.1b.1.9 | ⚠️ `private sortForBalancedTree(list: T[]): T[]` — pivô central em camadas (fiel a `TernarySearchTree.rb:184-201`) | idem | 3 testes (lista ordenada, tamanho 1, tamanho ímpar/par) |
| 22.1b.1.10 | ⚠️ `private split(str)` com `ArgumentError` em `null`/vazio (no Ruby é um método privado sem chamadores conhecidos — portar e marcar `// deno-lint-ignore` para o unused) | idem | 2 testes (vazio → erro, normal) |
| 22.1b.1.11 | Teste comparativo vs oracle Ruby: fixture `tests/docgen/fixtures/tst-cases.golden.json` (insert/find partial sobre ~30 keywords) | `tests/utils/ternary-search-tree_test.ts` | 1 teste golden |
| 22.1b.1.12 | Re-exportar em `src/docgen/mod.ts` (e **não** no `mod.ts` raiz — ver 22.1b.7.2) | `src/docgen/mod.ts` | `deno check` |

> **Nota:** o `inspect()` do Ruby é debug-only → **não portado** (registro em
> `xray.md` §1.7). Comparação de caracteres: usar `<`/`>` em `string` (UTF-8 por
> code point em JS é equivalente ao `String#<` do Ruby para as keywords ASCII).

---

## Bloco D — 22.1b.2 `SyntaxReference`

**⚠️ RUBY: `SyntaxReference.rb`** — construtor percorre **todas** as regras do
`ProjectFileParser` e extrai os patterns documentados; depois faz duas passadas
de pós-processamento (`crossReference`, `computeInheritance`).
**Consumidor:** 【24+LSP】 — `syntaxmesh man` (lista + texto + HTML) e hover/completion do LSP.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.2.1 | Criar `class SyntaxReference` com `readonly keywords: Map<string, KeywordDocumentation>` e constructor `(manual: UserManual \| null = null, ignoreOld = false)` | `src/docgen/syntax-reference.ts` | `deno check` |
| 22.1b.2.2 | ⚠️ No construtor: `new ProjectFileParser(...)` + `updateParserTables()`; iterar `rules` → `pattern` pulando `doc === null` e, com `ignoreOld`, os `supportLevel` `deprecated`/`removed` | idem | 3 testes (nº de keywords > 0, `ignoreOld` reduz, filtro de doc) |
| 22.1b.2.3 | ⚠️ Criar o `KeywordDocumentation` de cada pattern com `to_syntax(argDocs, rules)` + `optionalAttributes(pattern, {})`; **lançar** se a mesma keyword aparecer 2× | idem | 2 testes (montagem, duplicata → throw) |
| 22.1b.2.4 | ⚠️ `private optionalAttributes(pattern, stack): Map<Pattern, boolean>` — guard de recursão infinita, skip de pattern documentado, detecção do bloco `{ ... }` (`pattern[0][1] === '{' && pattern[2][1] === '}'`) | idem | 5 testes (sem attrs, bloco opcional, referência única, referência multi-pattern, recursão) |
| 22.1b.2.5 | ⚠️ `private attributes(token, scenarioSpecific): Map<Pattern, boolean>` — literal → atributo; `:scenarioIdCol` → merge com `scenarioSpecific = true`; referência não documentada → segue; documentada → usa o próprio pattern; senão `throw` | idem | 5 testes (cada ramo) |
| 22.1b.2.6 | ⚠️ Passadas do construtor: `crossReference(keywords, rules)` em todos e depois `computeInheritance()` em todos (ordem fiel a `SyntaxReference.rb:69-77`) | idem | 2 testes (contexts populados, flags de herança) |
| 22.1b.2.7 | ⚠️ `all(): string[]` — chaves ordenadas **e** encadeamento `predecessor`/`successor` para barra de navegação | idem | 3 testes (ordenado, vizinhos, pontas `null`) |
| 22.1b.2.8 | ⚠️ `tableOfContents(toc: TableOfContents, sectionPrefix: string)` — entrada `Syntax Reference` + `A.1..A.N` com `title()` | `src/docgen/syntax-reference.ts` | 2 testes (contagem, prefixos `A.x`) |
| 22.1b.2.9 | ⚠️ `internalReferences(): Record<string, string[]>` (uniq por keyword, omitindo vazios) | idem | 2 testes |
| 22.1b.2.10 | ⚠️ `toText(keyword: string): string` (≡ Ruby `to_s`) — devolve `''` em keyword desconhecida | idem | 3 testes (conhecida, desconhecida, `null`) |
| 22.1b.2.11 | ⚠️ `checkKeyword(keyword)`: caso inválido → montar **lista de top-level** (`contexts` vazio ou único == self) e devolver o texto de ajuda em vez de escrever em `$stderr` 【novo】 (`stderrLines(): string[]`) | idem | 3 testes (válida, top-level listada, mensagem de erro) |
| 22.1b.2.12 | ⚠️ `generateHTMLreference(directory, keyword): { name, content } \| null` — delega a `KeywordDocumentation.generateHTML`; **sem escrever arquivo** ⚠️ ADAPTAÇÃO (Ruby faz `File.write`) | idem | 2 testes (nome do arquivo = `<keyword>.html`, conteúdo contém a keyword) |
| 22.1b.2.13 | ⚠️ `generateHTMLnavbar(directory, keywords): { navbar: string, alphabet: string }` — agrupamento por letra inicial (título normalizado), `<base target>`, âncoras; **sem** o formulário de busca do Google 【novo: omitido — serviço externo obsoleto】 | `src/docgen/html-navbar.ts` | 4 testes (letras, ordenação por título, âncoras, `br` após cada item) |
| 22.1b.2.14 | Golden Ruby: criar `scripts/golden/syntax-reference.rb` (oracle: `SyntaxReference.new.all` + `to_s` de ~12 keywords representativas + `internalReferences`) → `tests/golden/syntax-reference.golden.json` | `scripts/golden/syntax-reference.rb` + `scripts/golden/gantt-common.rb`-style harness | `deno task golden:generate` produz JSON estável |
| 22.1b.2.15 | Teste golden Deno contra o JSON de 22.1b.2.14 (lista idêntica, texto com marcação ANSI desligada) | `tests/docgen/syntax-reference_golden_test.ts` | verde (1 teste parametrizado por keyword) |

---

## Bloco E — 22.1b.3 `KeywordDocumentation`

**⚠️ RUBY: `KeywordDocumentation.rb` (764 linhas)** — a maior classe da subfase.
Dividir em três arquivos internos: dados/cross-ref, saída de texto, saída HTML.
**Consumidor:** 【24+LSP】 (`toText` → `syntaxmesh man`; HTML → `syntaxmesh man --format html`;
`toMarkdown` → hover do LSP).

### E.1 — Estrutura e referências cruzadas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.3.1 | Criar `class KeywordDocumentation` com constructor `(rule, pattern, syntax, args, optAttrPatterns, manual)` e campos `keyword`, `names: string[]`, `pattern`, `references: RichText[]`, `optionalAttributes: KeywordDocumentation[]`, `contexts`, `scenarioSpecific`, `inheritedFromProject`, `inheritedFromParent`, `predecessor`, `successor`, `seeAlso` | `src/docgen/keyword-documentation.ts` | `deno check` |
| 22.1b.3.2 | ⚠️ `isProperty(): boolean` — lista fixa dos 7 tipos de relatório + `optionalAttributes.includes(this)` | idem | 4 testes (property, attribute, `taskreport`, auto-referência) |
| 22.1b.3.3 | ⚠️ `globalScope(): boolean` — `contexts` vazio **ou** algum context `properties` | idem | 3 testes |
| 22.1b.3.4 | ⚠️ `crossReference(keywords, rules)` parte 1: `names` via `pattern.terminalTokens(rules)` com `break` no token `{` | idem | 3 testes (nome único, `.` de escopo, bloco opcional → sem nome) |
| 22.1b.3.5 | ⚠️ `crossReference` parte 2: args que referenciam patterns documentados → `kwd.contexts.push(self)` sem duplicar | idem | 3 testes |
| 22.1b.3.6 | ⚠️ `crossReference` parte 3: `optAttrPatterns` — keyword ausente e **não** deprecated/removed → acumular aviso `undocumented_optional_attribute`; presente → `optionalAttributes.push`, context, `scenarioSpecific = true` quando marcado | idem | 4 testes (resolvido, ausente documentado, ausente deprecated silencioso, scenarioSpecific) |
| 22.1b.3.7 | ⚠️ `crossReference` parte 4: `seeAlso` ordenado e **throw** em referência desconhecida | idem | 2 testes |
| 22.1b.3.8 | ⚠️ `private checkReference(pattern): boolean` (pattern precisa ser referência a regra com keyword documentada) | idem | 2 testes |
| 22.1b.3.9 | ⚠️ `private findPropertySet(): PropertySet \| null` — varrer `contexts` em busca dos 9 keywords de escopo (`task`, `resource`, `account`, `shift`, `scenario`, `accountreport`, `resourcereport`, `taskreport`, `textreport`) e criar um `Project` `'id'/'dummy'/'1.0'` **descartável** (fiel a `KeywordDocumentation.rb:730-759`) | idem | 3 testes (task, relatório, sem context → `null`) |
| 22.1b.3.10 | Adicionar ao `PropertySet` os três delegados que faltam 【novo — API ausente】: `listAttribute(id)`, `inheritedFromProject(id)`, `inheritedFromParent(id)` (semântica de `PropertySet.rb:121-145`, incluindo `false` para atributo inexistente/hardwired) | `src/model/property-set.ts` | 4 testes em `tests/model/property-set_test.ts` |
| 22.1b.3.11 | ⚠️ `listAttribute(): boolean` — keyword sem o sufixo `.escopo` → `propertySet.listAttribute(...)`; `false` sem property set | idem | 3 testes |
| 22.1b.3.12 | ⚠️ `computeInheritance(): void` — preencher `inheritedFromProject`/`inheritedFromParent` pelo property set | idem | 3 testes (ambos, só um, nenhum) |
| 22.1b.3.13 | ⚠️ `title(): string` — `foo.bar` → `foo (bar)`; `foo` → `foo` | idem | 3 testes |

### E.2 — Saída de texto (`syntaxmesh man`)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.3.14 | Criar `src/docgen/ansi.ts` 【novo — substitui a gem `term/ansicolor`】: `blue/red/cyan/bold/reset` + flag `ansiEnabled(bool)` (desligado devolve a string pura) | `src/docgen/ansi.ts` | 4 testes (cada cor, modo desligado, aninhamento) |
| 22.1b.3.15 | ⚠️ `private format(width, str, textWidth): string` e `private indent(width, str): string` sobre `utils/text-formatter.ts` | `src/docgen/keyword-documentation.ts` | 3 testes |
| 22.1b.3.16 | ⚠️ `toText(): string` parte 1 (cabeçalho): `Keyword:` + **bold**(keyword) + ` (List Attribute)` quando `listAttribute()`; bloco de aviso quando `supportLevel !== "supported"` (⚠️ usar o **texto cru** de `TextFormatter`, sem HTML — divergência registrada em `xray.md`) | idem | 4 testes (keyword simples, list attribute, deprecated, removed) |
| 22.1b.3.17 | ⚠️ `toText()` parte 2: mensagem de `supportLevel` + `Please use a, b instead!` quando deprecated/removed com `seeAlso`; **retorno antecipado** quando `removed` | idem | 3 testes |
| 22.1b.3.18 | ⚠️ `toText()` parte 3: `Purpose:` (RichText `to_s`), `Syntax:` (só quando `syntax !== '[{ <attributes> }]'`) e `Arguments:` (`none` quando vazio; `name:` ou `name [type]:` com o `<`/`>` convertidos em `[`/`]`) | idem | 5 testes |
| 22.1b.3.19 | ⚠️ `toText()` parte 4: `Context:` (`Global scope` quando vazio) e `Attributes:` com as tags `[sc]`/`[ig]`/`[ip]` e a legenda quando qualquer flag aparecer | idem | 5 testes (global, contexts múltiplos, tags combinadas, legenda, `none`) |
| 22.1b.3.20 | ⚠️ `toText()` parte 5: `See also:`; ordenar `optionalAttributes` **por keyword** antes de imprimir (mutação do Ruby ⚠️ usar cópia ordenada) | idem | 3 testes |
| 22.1b.3.21 | `toMarkdown(): string` 【novo — LSP-only】 — mesmo conteúdo em Markdown (título `### keyword`, negrito nos rótulos, blocos ```tjp``` para a sintaxe), **sem ANSI** e sem a legenda de colunas | `src/docgen/keyword-markdown.ts` | 5 testes (keyword, arguments, context, seeAlso, removed) |
| 22.1b.3.22 | Teste de regressão: `toText()` de 12 keywords do golden (22.1b.2.14) com ANSI desligado bate byte a byte | `tests/docgen/keyword-documentation_golden_test.ts` | verde |

### E.3 — Saída HTML (manual)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.3.23 | ⚠️ `generateHTML(directory): { name, content }` — `HTMLDocument` via seam `createHtmlShell()`, `<head>` com description/keywords + `@manual.generateStyleSheet`, corpo = header/nav/purpose/syntax/args/context/attributes/seeAlso/example/nav; **devolver o conteúdo** e não escrever ⚠️ ADAPTAÇÃO | `src/docgen/keyword-html.ts` | 3 testes (nome do arquivo, presença da keyword, ausência de escrita) |
| 22.1b.3.24 | ⚠️ Partes da página: `generateHTMLSupportLevel`, `generateHTMLKeywordBox` (tabela Keyword/List/Inherited), `generateHTMLDescriptionBox` | idem | 3 testes (badge deprecated, box de keyword, rich text renderizado) |
| 22.1b.3.25 | ⚠️ Partes da página: `generateHTMLPurposeLine`, `generateHTMLSyntaxLine`, `generateHTMLArgumentsLine` (colunas nome/tipo/descrição) | idem | 4 testes (sem args, arg com typeSpec, arg referenciado, multiline) |
| 22.1b.3.26 | ⚠️ Partes da página: `generateHTMLContextLine`, `generateHTMLAlsoLine`, `generateHTMLTableLine(col1, col2, col3?, col1rows?)` | idem | 3 testes (rowspan, coluna vazia, links) |
| 22.1b.3.27 | ⚠️ `generateHTMLOptionalAttributesBox` — tabela com as marcações `sc`/`ig`/`ip` e a legenda em HTML | idem | 4 testes |
| 22.1b.3.28 | ⚠️ `generateHTMLExampleBox` — usa `TjpExample` (22.1b.4) via loader injetado; sem exemplo → omitir a caixa | idem | 3 testes (com tag, sem tag, sem exemplo) |
| 22.1b.3.29 | ⚠️ `supportLevelMessage()` / `useInsteadMessage()` — textos fiéis (comparar com o Ruby; `include MessageHandler` só para os rótulos) | `src/docgen/keyword-documentation.ts` | 3 testes (supported, experimental, deprecated) |

---

## Bloco F — 22.1b.4 `TjpExample`

**⚠️ RUBY: `TjpExample.rb`** — extrai snips anotados de um arquivo `.tjp`;
anotação `# *** EXAMPLE: <tag> +|−`.
**Consumidor:** 【24+LSP】 — exemplos dentro das páginas HTML do `syntaxmesh man`
e snippets de `completion`/hover do LSP.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.4.1 | Criar `class TjpExample` com `private snippets: Map<string, string[]>` semeado com `'full text'` | `src/docgen/tjp-example.ts` | `deno check` |
| 22.1b.4.2 | ⚠️ `parse(text: string): void` — `process()` linha a linha (sem `File`/`StringIO`) | idem | 3 testes (snip único, full text, texto sem anotação) |
| 22.1b.4.3 | ⚠️ `open(fileName: string, text: string): void` 【novo — assinaturas adaptadas】: recebe o **conteúdo** lido pelo chamador (CLI/Deno.readTextFile) e delega a `parse`; mantém a semântica de fechar o arquivo | idem | 2 testes |
| 22.1b.4.4 | ⚠️ `private process()` parte 1: marcador `# *** EXAMPLE: `, tokens `[3]`=tag `[4]`=indicador; `+` duplicado → throw; `−` sem `+` → throw; indicador inválido → throw | idem | 4 testes |
| 22.1b.4.5 | ⚠️ `private process()` parte 2: linhas normais vão para **todos** os snips ativos **e** para `full text`; linhas de anotação **não** entram em `full text` | idem | 3 testes |
| 22.1b.4.6 | ⚠️ Remoção final de linha vazia à direita de cada snip (`snip[-1] === "\n"`, **uma** só) | idem | 2 testes |
| 22.1b.4.7 | ⚠️ `toString(tag: string \| null = null): string \| null` — `null` para tag inexistente (Ruby devolve `nil`; **não** devolver string vazia) | idem | 3 testes |
| 22.1b.4.8 | `tags(): string[]` 【novo】 — lista as snips (para o `syntaxmesh man` validar tag e para completion de snippets) | idem | 2 testes |
| 22.1b.4.9 | Ligar ao handler existente: implementar o `ExampleLoader` de `richtext/handlers/function-example.ts` sobre `TjpExample` (cache por arquivo) | `src/docgen/example-loader.ts` | 3 testes (tag, arquivo inteiro, tag ausente) |
| 22.1b.4.10 | Teste com fixtures reais de `docs/Learning/mwe00*/*.tjp` (cópia em `tests/docgen/fixtures/`) — 3 tags extraídas corretamente | `tests/docgen/tjp-example_test.ts` | verde |

---

## Bloco G — 22.1b.5 `UserManual` + fontes do manual

**⚠️ RUBY: `UserManual.rb`** — especializa `RichTextDocument`; gera capa, índice
de frames, navegação e a **Appendix A** com o `SyntaxReference`.
**Consumidor:** 【24】 para o HTML completo (`syntaxmesh man -m` / `--format html`);
【LSP】 para TOC e páginas em Markdown (`getManualToc`/`getManualPage`).

### G.1 — Fontes (assets)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.5.1 | Copiar os 14 snips do manual (`Intro`, `TaskJuggler_2x_Migration`, `Reporting_Bugs`, `Installation`, `How_To_Contribute`, `Getting_Started`, `Tutorial`, `The_TaskJuggler_Syntax`, `Rich_Text_Attributes`, `List_Attributes`, `Software`, `Day_To_Day_Juggling`, `TaskJuggler_Internals`, `fdl`) de `docs/taskjuggler/manual/` para `packages/core/data/manual/` **na ordem da lista Ruby** | `packages/core/data/manual/*.txt` | `ls` com 14 arquivos + teste de ordem |
| 22.1b.5.2 | Copiar a folha de estilo `css/tjmanual.css` para `packages/core/data/manual/css/` (equivalente ao `FileUtils.cp_r` de `UserManual.rb:73`) | `packages/core/data/manual/css/tjmanual.css` | 1 teste (arquivo presente, `body.manual` no conteúdo) |
| 22.1b.5.3 | Copiar os arquivos de exemplo referenciados pelo manual (`AppConfig.dataDirs('data/test/TestSuite/Syntax/Correct'`-style) para `packages/core/data/examples/`, via lista explícita — **sem** varrer disco em runtime | `packages/core/data/examples/` | 2 testes (lista não vazia, `TjpExample` consegue parsear um deles) |
| 22.1b.5.4 | Criar o carregador de assets `src/docgen/manual-sources.ts`: `loadSnipSources(): { name, text }[]` e `loadExample(name): string \| null` sobre `import … with { type: "text" }` (Deno) **com alternativa injetável** para o bundle do browser ⚠️ ADAPTAÇÃO (fronteira de IO, ADR 001) | `src/docgen/manual-sources.ts` | 3 testes (14 snips, ordem, loader alternativo) |

### G.2 — Classe

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.5.5 | Criar `class UserManual extends RichTextDocument` — `reference = new SyntaxReference(this)`, `registerFunctionHandler(new RichTextFunctionExample(loader))`, `linkTarget = '_top'` | `src/docgen/user-manual.ts` | 2 testes (instancia, handler registrado) |
| 22.1b.5.6 | ⚠️ `generate(): Record<string, string>` — adicionar snips na ordem, `cssClass = 'manual'`, `tableOfContents()`, `generateHTML()`, `checkInternalReferences()`; **devolver o mapa nome→conteúdo** (a fase 24 escreve em disco; o Ruby chamava `generate(directory)` + `File.write`) ⚠️ ADAPTAÇÃO | idem | 4 testes (todos os `.html` nomeados, `index.html` presente, uma página por snip, referência interna checada) |
| 22.1b.5.7 | ⚠️ `generateHTML(directory)` adaptado: `index` + páginas do `SyntaxReference` + merge de `internalReferences` no mapa devolvido | idem | 3 testes (uma página por keyword, `navbar/alphabet/toc` no mapa, referências mescladas) |
| 22.1b.5.8 | ⚠️ `private tableOfContents()` — `super()` + `reference.tableOfContents(toc, 'A')` + âncoras das keywords | idem | 2 testes (capítulo `A`, contagem = nº de keywords) |
| 22.1b.5.9 | ⚠️ Callbacks de shell: `generateStyleSheet` (`<link … css/tjmanual.css>`), `generateHTMLCover` (nome/copyright/autores/data/versão via `app-config.ts` + `version.ts`), `generateHTMLHeader`, `generateHTMLFooter` | `src/docgen/user-manual.ts` | 4 testes (cada um, com `appConfig` fake) |
| 22.1b.5.10 | ⚠️ `generateHTMLNavigationBar(predLabel, predURL, succLabel, succURL)` — tabela `<<` / TOC / `>>`, omitindo a tabela quando não há vizinhos | idem | 3 testes (sem vizinhos, só sucessor, ambos) |
| 22.1b.5.11 | ⚠️ `generateHTMLindex()` — documento `:frameset` (`cols 15%,85%`; `rows 140,*`; frames `alphabet`, `navigator`, `display`) | idem | 2 testes (estrutura de frames, nomes) |
| 22.1b.5.12 | ⚠️ `private generateHTMLReference()` — navbar + uma página por keyword no mapa devolvido | idem | 2 testes |
| 22.1b.5.13 | `getManualToc(): { id, title, level }[]` 【novo — LSP-only】 — projeção da TOC para `lsp-core` | idem | 2 testes (ordem, ids estáveis) |
| 22.1b.5.14 | `getManualPage(id): string \| null` 【novo — LSP-only】 — snip renderizado como Markdown (RichText `to_s`, sem HTML) | `src/docgen/manual-pages.ts` | 4 testes (id válido, id de keyword, inexistente → `null`, sem HTML cru no resultado) |

---

## Bloco H — 22.1b.6 `SyntaxCore` (núcleo de highlight Kate/Vim)

**⚠️ RUBY: `KateSyntax.rb:24-40,160-190` + `VimSyntax.rb:24-44,80-96,147-183,98-145`**
— **somente a lógica de coleta/classificação**. Os geradores finais de arquivo
`.xml`/`.vim` continuam **cancelados** (16.15), e o `AlgorithmDiff` (16.10) também.
**Consumidor:** 【LSP】 quase em sua totalidade (semantic tokens, completion,
grammar TextMate, folding). A CLI **não** consome este bloco.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.6.1 | Criar `class SyntaxCore` com `private reference: SyntaxReference` e as coleções `properties`, `attributes`, `optionBlocks` — constructor `(reference = new SyntaxReference(null, true))`, separando por `isProperty()` e por `optionalAttributes.length > 0` (fiel a `KateSyntax.rb:31-37` e `VimSyntax.rb:32-41`) | `src/docgen/syntax-core.ts` | 3 testes (propriedade, atributo, option block) |
| 22.1b.6.2 | ⚠️ `keywordList(): string[]` — união dos nomes com os filtros dos dois geradores: ignorar `supplement` nas propriedades; pular `resourcereport`/`taskreport`/`textreport` nos atributos; `break` em `%`, `(`, `~`, `include`, `macro`, `project`, `supplement` | idem | 5 testes (cada regra de filtragem) |
| 22.1b.6.3 | ⚠️ `categories(): { keywords: string[]; builtin: string[]; types: string[] }` — as três `<list>` do Kate (`keywords` fixo `macro/project/supplement`, `builtinfuncs` = propriedades, `types` = atributos) | idem | 3 testes (conteúdo, ausência de `supplement` em builtin, filtros em types) |
| 22.1b.6.4 | ⚠️ `tokenRules(): TokenRule[]` 【novo formato de dados】 — os `contexts` do Kate como **dados** (date, time, duration, include, arguments `{…}`, strings `'`/`"`/`-8<−…→8-`, comentários `#`/`//`/`/*…*/`, braces `{}[]` com region folding), **sem** emitir XML | `src/docgen/syntax-core.ts` | 4 testes (cada família, contagem, ordem) |
| 22.1b.6.5 | ⚠️ `optionBlockRegions(): Region[]` — fiel a `VimSyntax#regions`: nome normalizado (`.` → `_`), sufixo `_name` quando há vários nomes, `tag` = `keyword` com `.`→espaço para `supplement`, `fold` para propriedades + `task.timesheet`/`project`, `contains=@tjpcommon,tjp_<name>` + por atributo opcional (+ `tjpblk_` quando o opcional tem opcional), `contained` quando `!globalScope()` | idem | 6 testes (single vs multi nome, `supplement`, fold, contained, contains de aninhamento, normalização) |
| 22.1b.6.6 | ⚠️ `indentSettings(): { softtabstop, shiftwidth, tabstop, expandtab, cinoptions, cinwords: string[], cinkeys }` — `cinwords` = nomes dos option blocks, `uniq` + `sort` (fiel a `VimSyntax#setLocal`) | idem | 3 testes (ordem, unicidade, valores literais) |
| 22.1b.6.7 | ⚠️ `normalize(str: string): string` (`.` → `_`) exportado (usado por regions e keywords) | idem | 2 testes |
| 22.1b.6.8 | Teste de paridade estrutural: `categories().builtin` contém `task`/`resource`/`account`; `types` **não** contém `resourcereport`; `tokenRules()` tem 1 regra de comentário de linha com `#` | `tests/docgen/syntax-core_test.ts` | verde |
| 22.1b.6.9 | **Adendo opcional (fora do v1):** `generateKateXml(): string` e `generateVimSyntax(): string` como funções puras sobre a API acima (sem escrita em disco) — só se um consumidor real aparecer | `src/docgen/kate-generator.ts`, `src/docgen/vim-generator.ts` | ⬜ não iniciar sem consumidor |
| 22.1b.6.10 | **Consumidor real do v1:** exportar `categories()`/`tokenRules()` para a grammar TextMate (22.3) e para `semantic-tokens.ts`/`completion.ts` (22.1/22.4) 【LSP】 — registrar a junção aqui quando aqueles blocos forem detalhados | — | nota de plano |

---

## Bloco I — 22.1b.7 Integração do `doc-core`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.7.1 | Criar `src/docgen/mod.ts` exportando `TernarySearchTree`, `SyntaxReference`, `KeywordDocumentation`, `TjpExample`, `UserManual`, `SyntaxCore`, `ansi`, `manual-sources` | `src/docgen/mod.ts` | `deno check` |
| 22.1b.7.2 | Adicionar o subpath export `"./doc-core": "./src/docgen/mod.ts"` em `packages/core/deno.jsonc` 【novo】 e usar `@vanaware/syntaxmesh/doc-core` no `imports` da F22/F24 | `packages/core/deno.jsonc`, `deno.jsonc` (raiz) | `deno check` |
| 22.1b.7.3 | **Não** re-exportar o `doc-core` pelo `"."` raiz: manter o bundle da PWA leve; documentar a decisão em comentário no `mod.ts` 【novo — inversão da prática da F16, que re-exportava em `mod.ts`】 | `packages/core/mod.ts` | 1 teste de grep (ausente do `mod.ts`) |
| 22.1b.7.4 | Proibição de IO/ANSI-forçado verificável: `doc-core` não importa `Deno.*`, `node:`, `vscode` nem escreve arquivo 【novo — gate no padrão do §5.1 do plano】 | `scripts/check-stubs.ts`-style grep em `src/docgen/` | 1 teste/checagem `deno task check:doccore` (novo task) |
| 22.1b.7.5 | Ponte `lsp-core` → `doc-core`: `getKeywordHelp(keyword, locale)` (contrato §5) implementada sobre `KeywordDocumentation.toMarkdown()` + cache memoizado por keyword 【LSP】 | `src/lsp/help.ts` (bloco 22.1) | 4 testes (keyword conhecida, inexistente, cache, locale ignorado em v1) |
| 22.1b.7.6 | Ponte `lsp-core` → `doc-core`: `getManualToc()`/`getManualPage(id)` expostos por `src/lsp/help.ts` sobre 22.1b.5.13/5.14 【LSP】 | idem | 3 testes |
| 22.1b.7.7 | Ponte `lsp-core` → `doc-core`: completion de keywords usando `SyntaxCore.categories()` + `TernarySearchTree` para prefixo 【LSP】 | `src/lsp/completion.ts` | 3 testes |
| 22.1b.7.8 | Registrar em `fase-24-cli-tarefas.md` 24.9.1–24.9.3 que a fonte é `@vanaware/syntaxmesh/doc-core` (já dito) **e** fixar o contrato: `SyntaxReference.toText/all`, `generateHTMLreference`, `generateHTMLnavbar`, `UserManual.generate(): Record<string,string>`, `TernarySearchTree.find(prefix)` 【24】 | `docs/syntaxmesh/fases/fase-24-cli-tarefas.md` | revisão cruzada |
| 22.1b.7.9 | Smoke test da subfase: montar `SyntaxReference` + `UserManual` e exigir ≥ 200 keywords documentadas e ≥ 250 páginas no mapa HTML 【novo】 | `tests/docgen/docgen-smoke_test.ts` | verde |
| 22.1b.7.10 | Cache de construção: memoizar o `SyntaxReference` por processo (é caro — varre as ~380 regras) e expor `resetSyntaxReferenceCache()` só para testes 【novo】 | `src/docgen/syntax-reference.ts` | 2 testes |

---

## Bloco J — 22.1b.8 Verificação da subfase

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 22.1b.8.1 | Rodar o golden novo (`scripts/golden/syntax-reference.rb`) e commitar o JSON | `packages/core/tests/golden/syntax-reference.golden.json` | `deno task golden:generate` determinístico (2 execuções iguais) |
| 22.1b.8.2 | Confrontar a saída de texto de 12 keywords com `tj3man`/`tj3 --man` real (shell disponível no ambiente) e registrar divergências em `xray.md` | `docs/syntaxmesh/xray.md` | tabela de divergências |
| 22.1b.8.3 | `deno task check:all` + `deno task lint` + `deno fmt` nos arquivos novos | — | verdes |
| 22.1b.8.4 | `deno task tests` (gate completo: `check:all` + `lint` + `fmt:check` + `lint:doc:all` + `test`) | — | 0 falhas |
| 22.1b.8.5 | `deno task check:stubs` + `deno task gaps:audit` | — | OK |
| 22.1b.8.6 | Cobertura ≥ 80% nos módulos de `src/docgen/` (padrão da subfase 22.1) | — | relatório de cobertura |
| 22.1b.8.7 | Atualizar `CURRENT.md`, `plano.md` (linha da Fase 22) e `xray.md` §1.7/§8 com o resultado da subfase | `CURRENT.md`, `docs/syntaxmesh/fases/plano.md`, `docs/syntaxmesh/xray.md` | docs coerentes |
| 22.1b.8.8 | Marcar as tarefas **históricas** 16.9.* e 16.14.* de `fase-16-apoio-tarefas.md` como "entregues em 22.1b.x" (tabela de progresso da F16) | `docs/syntaxmesh/fases/fase-16-apoio-tarefas.md` | revisão cruzada |

---

## Resumo de quem consome o quê

| Entrega 22.1b | Fase 24 (`syntaxmesh man`, 24.9) | `lsp-core` / extensão (22.1–22.9) |
|---|---|---|
| `TernarySearchTree` | ✅ busca por prefixo (`syntaxmesh man <parcial>`) — 24.9.2 | ✅ completion + `workspaceSymbol` |
| `SyntaxReference.all()` | ✅ listagem de keywords | ✅ lista de keywords do hover |
| `SyntaxReference.toText()` | ✅ **saída padrão** `syntaxmesh man <kw>` (texto ANSI) | — (o LSP usa `toMarkdown`) |
| `SyntaxReference.generateHTMLreference/navbar` | ✅ `syntaxmesh man --format html` (escreve no `--output-dir`) | — |
| `KeywordDocumentation.toText()` | ✅ corpo da página de manual | — |
| `KeywordDocumentation.toMarkdown()` 【novo】 | — | ✅ `getKeywordHelp` (hover/comando de ajuda) |
| `KeywordDocumentation.generateHTML()` | ✅ páginas `<keyword>.html` | — |
| `TjpExample` + `ExampleLoader` | ✅ caixas de exemplo no HTML | ✅ snippet de completion |
| `UserManual.generate()` | ✅ manual completo em `--output-dir` (24.9.3) | — |
| `UserManual.getManualToc/getManualPage` 【novo】 | — | ✅ painel "Manual" da extensão |
| `SyntaxCore.categories/tokenRules/optionBlockRegions` | — | ✅ **exclusivo**: grammar TextMate, semantic tokens, folding |
| `ansi.ts`, `manual-sources.ts` | ✅ suporte (CLI habilita ANSI no TTY) | ✅ suporte (ANSI desligado) |
| Kate `.xml` / Vim `.vim` (geradores finais) | ❌ cancelados (16.15) | ❌ idem — só os dados estruturais acima |

---

## Progresso (subfase 22.1b)

> **Entrega parcial 2026-11-08 (blocos C–G + I):** o `doc-core` foi construído
> para desbloquear `syntaxmesh man` (F24, 24.9.1–24.9.3) — que era o único item
> pendente da Fase 24. Todo o caminho `SyntaxReference` → `KeywordDocumentation`
> → `UserManual` → `generateMan` está implementado, puro e coberto por teste
> (`tests/docgen/`), e `man` responde nos três formatos. Ficaram de fora, por
> serem consumidos **só** pela extensão/revisão, os blocos **H** (`SyntaxCore`
> de highlight) e as pontes `lsp-core` de **I** (7.5–7.7), além dos oráculos
> golden do Ruby (1.11, 2.14/2.15, 3.22) e de **J** 8.1/8.2/8.6.
> Os capítulos do manual (G.1) não são os assets originais: são textos novos em
> inglês, sem menção ao projeto de origem e citando apenas `.smx`.

| Bloco | Tarefas | Concluídas | Observação |
|---|---|---|---|
| C — `TernarySearchTree` | 12 | 11 | falta só 1.11 (golden vs oracle Ruby) |
| D — `SyntaxReference` | 15 | 12 | faltam 2.11 (`checkKeyword`) e 2.14/2.15 (golden) |
| E — `KeywordDocumentation` | 29 | 27 | faltam 3.21 (`toMarkdown`, LSP) e 3.22 (golden) |
| F — `TjpExample` | 10 | 10 | classe renomeada `ExampleSnippet` |
| G — `UserManual` + fontes | 14 | 14 | capítulos em inglês (sem `.tjp`/`.tji`) + `manual-css.ts` |
| H — `SyntaxCore` (highlight) | 10 | 0 | exclusivo da extensão; não bloqueia a F24 |
| I — Integração | 10 | 7 | faltam 7.5–7.7 (pontes `lsp-core`) |
| J — Verificação | 8 | 5 | 8.3–8.5 verdes; 8.1/8.2/8.6 pendentes |
| **Total 22.1b** | **108** | **86** | |

Checklist de conclusão da subfase:

- [~] 22.1b.1 `TernarySearchTree` (C) — 11/12
- [~] 22.1b.2 `SyntaxReference` (D) — 12/15
- [~] 22.1b.3 `KeywordDocumentation` (E) — 27/29
- [x] 22.1b.4 `TjpExample` (F) — 10/10
- [x] 22.1b.5 `UserManual` + fontes (G) — 14/14
- [ ] 22.1b.6 `SyntaxCore` (H) — 0/10
- [~] 22.1b.7 Integração (I) — 7/10
- [~] 22.1b.8 Verificação (J) — 5/8

**Critério de aceite da subfase:** `deno task tests` verde; o golden
`syntax-reference` igual ao oracle Ruby; `syntaxmesh man <keyword>` (F24, quando existir)
consegue ser servido **só** por `@vanaware/syntaxmesh/doc-core` sem tocar em
`Deno.*`; e `src/lsp/help.ts` não reimplementa nada — apenas projeta o doc-core.

## Notas de entrega (2026-11-08)

- **Fachada `generateMan`** (`src/docgen/man.ts`): única porta usada pela Fase 24.
  Formatos `text` (lista de keywords ou `to_s`), `html` (manual completo ou página
  única) e `smx` (recorte colável: exemplo anotado do corpus, ou o esqueleto da
  sintaxe). Erros de resolução (keyword inexistente, prefixo ambíguo) voltam
  como `messages`, nunca como exceção — quem decide o `exitCode` é o `execute`.
- **Gate de pureza** `deno task check:doccore` (`scripts/check-doccore.ts`)
  varre `src/docgen/` e falha em `Deno.*`, `node:` ou `process.*`. Entra no
  composite `deno task tests`.
- **Exemplo do corpus** (`Pattern.exampleFile`/`exampleTag`): o `setExample`
  passou a aceitar `null` (antes `""`), sem o que o bloco `smx` e a caixa
  `<pre>` do HTML perdiam o exemplo da keyword.
- **RichText dos `p.doc`**: três textos de regra (\`date\`, \`macro\`, \`template\`)
  tinham `[`…`]` solto, que o scanner lia como HREF e quebrava a página;
  passaram a usar `<nowiki>`. As referências `[[kw]]` sem âncora viraram
  `''''kw''''` (código), e o texto de `p.doc` deixou de nomear o projeto de origem
  (`alertlevels`, `now`, `markdate`, `aggregate`) ou a extensão antiga
  (`include`).

## Planning organization evidence (2026-11-11)

This update organizes the existing phase, not its implementation. It does not
increment the 86/108 recorded completions, close remaining 22.x tasks, or create
ADR 035. The older implementation and adaptation notes above remain unchanged.

| Planning action | Evidence | Verification |
|---|---|---|
| Group existing scope into P1–P7 and 23 subblocks | Plan §0: purposes, boundaries, entry/exit criteria and detailing protocol | Every original subphase 22.0–22.11 mapped in §13 |
| Align atomic-task navigation | Navigation/owner tables at the start of this file | C–J IDs and historical progress preserved; undetailed 22.2–22.11 listed explicitly |
| Preserve scheduling and architecture | Plan §§0/1/13/14; P2 foundation/bridge order; P4.1 F24 API audit | F21¹ gate retained; no execution API or phase-order change |
| Propagate planning references | `CURRENT.md`, `plano.md`, phase `README.md`, `AGENTS.md` F22 entry | References point to the existing plan/task files |

Validation: `git diff --check` passed; navigation targets and all 13 original
subphase owners (22.0–22.11, including 22.1b) were checked. The C–J atomic task
bodies and historical 86/108 progress were preserved. Full `deno task tests`
passed with exit 0: 839 passed (6902 steps), 0 failed, 2 ignored steps. This
includes `check:all`, `lint`, `fmt:check`, `lint:doc:all`, `check:doccore`, and
`check:stubs`. No code or new tests were added for this planning-only update.

Future implementation evidence remains attached to the original atomic task
IDs, not new P-block task IDs.
