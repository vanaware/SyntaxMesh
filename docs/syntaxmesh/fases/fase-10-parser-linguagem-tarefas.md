# Fase 10 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-10-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-10-parser-linguagem.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~345 tarefas
> **Concluídas:** 0
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/{TextParser,TextParser/*,ProjectFileScanner,ProjectFileParser,TjpSyntaxRules}.rb`

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa é um port.** Antes de escrever o teste:

1. Abrir o arquivo Ruby indicado em `⚠️ RUBY:`
2. Ler **o arquivo inteiro** (não só o método)
3. Consultar `docs/syntaxmesh/cheat-sheet-ruby-ts.md`
4. Se encontrar bug ou comportamento estranho, consultar cheat sheet §12 e categorizar (A/B/C)

### ADRs relevantes

- **ADR 011** — Port fiel do TaskJuggler.
- **ADR 013** — `compat.keepRubyBugs` (Fase 2).
- **ADR 014** — `mode` global (Fase 3).
- **ADR 015** — Metaprogramação em `PropertyTreeNode` (Fase 4).
- **ADR 016** — Pré-carregamento em `*Scenario` (Fase 5).
- **ADR 017** — Scoreboard bit encoding (Fase 6).
- **ADR 018** — Heurística do scheduler (Fase 7).
- **ADR 019** — Modelo financeiro (Fase 8).
- **ADR 020** — Orquestrador e pipeline (Fase 9).
- **ADR 021** — FSM do TextParser (**criado nesta fase**).
- **ADR 022** — i18n de keywords (**criado nesta fase**).

### Convenções CRÍTICAS

- **O FSM é o coração.** Não simplificar.
- **`parseFSM` copia o Ruby linha-a-linha.** SHIFT/REDUCE exatos.
- **`StackElement.function` precisa de `this` bind correto.** Não usar arrow functions.
- **`Pattern.addTransitionsToState` tem 7 parâmetros.** Atenção.
- **`Rule.optional?` é recursivo com cache.**
- **`Scanner.mode` muda durante lexing.** Modos exatos.
- **Macros `${N}` são expandidas no scanner.** Antes do parser.
- **Includes aninhados usam `@fileStack`.**
- **`TjpSyntaxRules` tem ~300 regras.** Não inventar; seguir o Ruby.
- **`LanguageRegistry` é extensão do SyntaxMesh.** Não está no TJ.
- **Diretiva `language` via pré-scan** com regex `/^\s*language\s+"([^"]+)"/m`.
- **`rule_reportableAttributes` é a maior regra.** ~80 patterns.
- **Golden tests cobrem `Syntax/Correct` e `Syntax/Errors`.** ≥ 100 casos.
- **AST equivalence normaliza `name`.**
- Sem `any` em `src/`.

### Anti-padrões

- ❌ Não usar `Proxy` (ADR 015).
- ❌ Não simplificar `parseFSM`.
- ❌ Não reordenar tokens/patterns.
- ❌ Não inventar keywords canônicas.
- ❌ Não editar `@fileStack` fora de `pushFileStack`/`popFileStack`.
- ❌ Não usar `async` no FSM.
- ❌ Não usar arrow functions nas actions.

---

## Progresso

```
[ ] 10.0  ADRs 021 e 022 (FSM + i18n)                  —  0/8
[ ] 10.1  TokenDoc                                     —  0/4
[ ] 10.2  Macro + MacroTable                           —  0/10
[ ] 10.3  StackElement + TextParserResultArray         —  0/8
[ ] 10.4  StateTransition + State                      —  0/12
[ ] 10.5  Pattern                                      —  0/24
[ ] 10.6  Rule                                         —  0/18
[ ] 10.7  TextParser FSM                               —  0/22
[ ] 10.8  Scanner genérico + StreamHandle              —  0/20
[ ] 10.9  ProjectFileScanner                           —  0/20
[ ] 10.10 ProjectFileParser (estrutura)                —  0/18
[ ] 10.11 TjpSyntaxRules: project + task               —  0/32
[ ] 10.12 TjpSyntaxRules: resource + account + shift   —  0/26
[ ] 10.13 TjpSyntaxRules: reports                      —  0/30
[ ] 10.14 TjpSyntaxRules: tracking + logic             —  0/24
[ ] 10.15 LanguageRegistry                             —  0/12
[ ] 10.16 Idiomas (en, pt-BR, es)                      —  0/10
[ ] 10.17 Diretiva `language` no parser                —  0/8
[ ] 10.18 AST equivalence entre idiomas                —  0/8
[ ] 10.19 Golden tests (parser)                        —  0/12
[ ] 10.20 Verificação final                            —  0/10
────────────────────────────────────────────────────────
TOTAL: ~345
```

---

## Bloco A — Fundação

### 10.0 — ADRs 021 e 022

**Objetivo:** formalizar a FSM do `TextParser` e o sistema de i18n.

**⚠️ Nota:** o plano usa `ADR 020/021`, mas ADR 020 é `orquestrador-pipeline` (Fase 9). Aqui usamos **ADR 021** (FSM) e **ADR 022** (i18n).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.0.1 | Criar `docs/syntaxmesh/decisoes/021-fsm-textparser.md` com frontmatter | idem | arquivo existe |
| 10.0.2 | ADR 021 — Seção **Contexto:** TJ usa FSM compilado em runtime; não é recursive descent; suporta `extend` | idem | — |
| 10.0.3 | ADR 021 — Seção **Decisão:** manter fidelidade absoluta; **Alternativas:** recursive descent, PEG, parser combinators; **Consequências:** suporta `extend`; complexidade alta | idem | — |
| 10.0.4 | Criar `docs/syntaxmesh/decisoes/022-i18n-keywords.md` com frontmatter | idem | arquivo existe |
| 10.0.5 | ADR 022 — Seção **Contexto:** TJ só tem inglês; SyntaxMesh quer pt-BR, es | idem | — |
| 10.0.6 | ADR 022 — Seção **Decisão:** `LanguageRegistry` com sinônimos canônicos; scanner mapeia sinônimos → canônicos; diretiva `language "xxx"` via pré-scan com regex | idem | — |
| 10.0.7 | ADR 022 — **Alternativas** (parser separado por idioma, keywords nativas no parser) + **Consequências** (i18n transparente; AST equivalente) | idem | — |
| 10.0.8 | Atualizar linhas `021` e `022` em `decisoes/README.md` | idem | 22 linhas |

---

## Bloco B — Infraestrutura do parser

### 10.1 — `TokenDoc`

**⚠️ RUBY: `TextParser/TokenDoc.rb` (arquivo inteiro — ~40 linhas)**

**Pré-requisitos:** nenhum.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.1.1 | Criar `packages/parser/src/lexer/token-doc.ts` com `class TokenDoc` | idem | `deno check` |
| 10.1.2 | Campos: `name: string \| null`, `text: string \| null`, `typeSpec: string \| null`, `pattern: Pattern \| null` | idem | `deno check` |
| 10.1.3 | ⚠️ Constructor `(name: string \| null, arg: string \| Pattern)` — se `arg` é string, `text = arg`; senão, `pattern = arg` | idem | 4 testes (name null/válido, text, pattern) |
| 10.1.4 | Re-exportar em `lexer/mod.ts` e `packages/parser/mod.ts` | idem | `deno check` |

---

### 10.2 — `Macro` + `MacroTable`

**⚠️ RUBY: `TextParser/MacroTable.rb` (arquivo inteiro — ~80 linhas)**
**🔎 CHEAT: §5 `String#gsub` → `replaceAll`, §3 `Hash` → `Map`**

**Pré-requisitos:** Fase 9 (`SourceFileInfo`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.2.1 | Criar `packages/parser/src/lexer/macro-table.ts` com `class Macro` | idem | `deno check` |
| 10.2.2 | `Macro`: campos `readonly name: string`, `readonly value: string`, `readonly sourceFileInfo: SourceFileInfo` | idem | `deno check` |
| 10.2.3 | `Macro` — Constructor `(name, value, sfi)` + valida `name` não vazio | idem | 3 testes |
| 10.2.4 | Criar `class MacroTable` com `private macros: Map<string, Macro>` | idem | `deno check` |
| 10.2.5 | ⚠️ `add(macro: Macro): void` — armazena em `macros` | idem | 2 testes |
| 10.2.6 | ⚠️ `clear(): void` — limpa o Map | idem | 1 teste |
| 10.2.7 | ⚠️ `include?(name: string): boolean` | idem | 2 testes |
| 10.2.8 | ⚠️ `resolve(args: string[], sfi: SourceFileInfo): [Macro, string] \| null` — `name = args[0]`; se `name[0] === '?'`, remove `?`; se não existe, `null` | idem | 4 testes |
| 10.2.9 | `resolve` — `resolved = macro.value`; para cada arg (a partir de 1), substituir `${i}` por `arg`; substituir `$${` por `${` | idem | 5 testes |
| 10.2.10 | Re-exportar em `lexer/mod.ts` e `packages/parser/mod.ts` | idem | `deno check` |

---

### 10.3 — `StackElement` + `TextParserResultArray`

**⚠️ RUBY: `TextParser/StackElement.rb` (arquivo inteiro — ~100 linhas)**
**🔎 CHEAT: §3 `Array#push` que concatena, §8 `multiValue`**

**Pré-requisitos:** Fases 9 (`SourceFileInfo`), 10.1 (`TokenDoc`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.3.1 | Criar `packages/parser/src/parser/stack-element.ts` com `class TextParserResultArray<T> extends Array<T>` | idem | `deno check` |
| 10.3.2 | ⚠️ `TextParserResultArray.push(...items)` — se algum item é Array, concatena em vez de aninhar | idem | 4 testes |
| 10.3.3 | Criar `class StackElement` com `val: unknown[]`, `sourceFileInfo: Array<SourceFileInfo \| null>`, `firstSourceFileInfo: SourceFileInfo \| null`, `private position: number` | idem | `deno check` |
| 10.3.4 | Campos `function: ((...args: unknown[]) => unknown) \| null`, `state: State \| null` | idem | `deno check` |
| 10.3.5 | Constructor `(fn, state)` — `position = 0` | idem | 2 testes |
| 10.3.6 | ⚠️ `insert(index, val, sfi, multiValue): void` — insere em `index`; se `multiValue`, concatena arrays | idem | 4 testes |
| 10.3.7 | ⚠️ `store(val, sfi): void` — push em `val` e `sourceFileInfo` | idem | 3 testes |
| 10.3.8 | ⚠️ `each(): IterableIterator<unknown>` + `length(): number` | idem | 3 testes |

---

### 10.4 — `StateTransition` + `State`

**⚠️ RUBY: `TextParser/State.rb` (arquivo inteiro — ~250 linhas)**

**Pré-requisitos:** 10.5 (`Pattern`), 10.6 (`Rule`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.4.1 | Criar `packages/parser/src/parser/state.ts` com `class StateTransition` | idem | `deno check` |
| 10.4.2 | `StateTransition`: campos `tokenType: string \| symbol`, `state: State`, `stateStack: State[]`, `loopBack: boolean` | idem | `deno check` |
| 10.4.3 | Constructor `(descriptor: [type, name], state, stateStack, loopBack)` | idem | 3 testes |
| 10.4.4 | Criar `class State` com `rule`, `pattern`, `index`, `transitions: Map<string, StateTransition>`, `noReduce: boolean` | idem | `deno check` |
| 10.4.5 | Constructor `(rule, pattern?, index = 0)` | idem | 3 testes |
| 10.4.6 | ⚠️ `addTransitions(states: Map<StateKey, State>, rules: Map<string, Rule>): void` — delega a `pattern.addTransitionsToState` se pattern existe | idem | 4 testes |
| 10.4.7 | ⚠️ `addTransition(token, nextState, stateStack, loopBack): void` — detecta ambíguo (`TjError` "Ambiguous transition") | idem | 4 testes |
| 10.4.8 | ⚠️ `transition(token): StateTransition \| null` — busca por ID e literal | idem | 3 testes |
| 10.4.9 | ⚠️ `expectedTokens(): string[]` — lista os tokens válidos | idem | 3 testes |
| 10.4.10 | Teste: `state.to_s()` retorna descrição legível (rule, pattern, index) | idem | 1 teste |
| 10.4.11 | `type StateKey = [string, string \| null, number]` — tipo exportado | idem | `deno check` |
| 10.4.12 | Re-exportar em `parser/mod.ts` e `packages/parser/mod.ts` | idem | `deno check` |

---

### 10.5 — `Pattern`

**⚠️ RUBY: `TextParser/Pattern.rb` (arquivo inteiro — ~350 linhas)**
**🔎 CHEAT: §3 `arr.each` → `for-of`, §5 strings**

**Pré-requisitos:** 10.1 (`TokenDoc`), 10.4 (`State`), 10.6 (`Rule`).

#### 10.5.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.5.1.1 | Criar `packages/parser/src/parser/pattern.ts` com `class Pattern` | idem | `deno check` |
| 10.5.1.2 | Campos: `keyword: string \| null`, `doc: string \| null`, `supportLevel`, `seeAlso: string[]`, `exampleFile: string \| null`, `exampleTag: string \| null` | idem | `deno check` |
| 10.5.1.3 | Campos: `tokens: Array<[type, name]>`, `function`, `args: Array<TokenDoc \| null>`, `lastSyntaxToken: number` | idem | `deno check` |
| 10.5.1.4 | ⚠️ Constructor `(tokens, fn)` — parse tokens com prefixo `!$_` | idem | 3 testes |
| 10.5.1.5 | Constructor rejeita tipo inválido de token (`TjError`) | idem | 2 testes |

#### 10.5.2 — Geração de FSM

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.5.2.1 | ⚠️ `generateStates(rule, rules): State[]` — gera `State` por token | idem | 3 testes |
| 10.5.2.2 | ⚠️ `addTransitionsToState(states, rules, stateStack, sourceState, destRule, destIndex, loopBack): void` — **7 parâmetros** | idem | 5 testes |

#### 10.5.3 — Documentação

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.5.3.1 | ⚠️ `setDoc(keyword, doc): void` | idem | 2 testes |
| 10.5.3.2 | ⚠️ `setArg(idx, doc): void` | idem | 2 testes |
| 10.5.3.3 | ⚠️ `setLastSyntaxToken(idx): void` | idem | 1 teste |
| 10.5.3.4 | ⚠️ `setSupportLevel(level): void` | idem | 2 testes |
| 10.5.3.5 | ⚠️ `setSeeAlso(also): void` | idem | 1 teste |
| 10.5.3.6 | ⚠️ `setExample(file, tag): void` | idem | 2 testes |

#### 10.5.4 — Acessores

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.5.4.1 | ⚠️ `get(i): unknown` | idem | 2 testes |
| 10.5.4.2 | ⚠️ `each(): IterableIterator<[type, name]>` | idem | 1 teste |
| 10.5.4.3 | ⚠️ `empty(): boolean` e `length(): number` | idem | 3 testes |

#### 10.5.5 — Análise estrutural

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.5.5.1 | ⚠️ `optional?(rules): boolean` — verifica se o último token é `EOF` implícito | idem | 3 testes |
| 10.5.5.2 | ⚠️ `private optionalToken(index, rules): boolean` — recursivo | idem | 3 testes |
| 10.5.5.3 | ⚠️ `terminalSymbol?(i): boolean` | idem | 3 testes |
| 10.5.5.4 | ⚠️ `terminalTokens(rules, index): Array<[string, Pattern]>` | idem | 4 testes |

#### 10.5.6 — Serialização

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.5.6.1 | ⚠️ `to_syntax(argDocs, rules, skip): string` | idem | 3 testes |
| 10.5.6.2 | ⚠️ `to_syntax_r(stack, argDocs, rules, skip): string` — recursivo | idem | 3 testes |
| 10.5.6.3 | ⚠️ `to_s(): string` — debug | idem | 1 teste |
| 10.5.6.4 | ⚠️ `private addArgDoc(argDocs, argDoc): void` | idem | 2 testes |

---

### 10.6 — `Rule`

**⚠️ RUBY: `TextParser/Rule.rb` (arquivo inteiro — ~250 linhas)**

**Pré-requisitos:** 10.4 (`State`), 10.5 (`Pattern`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.6.1 | Criar `packages/parser/src/parser/rule.ts` com `class Rule` | idem | `deno check` |
| 10.6.2 | Campos: `name`, `patterns: Pattern[]`, `optional`, `repeatable`, `keyword`, `doc`, `transitiveOptional` | idem | `deno check` |
| 10.6.3 | ⚠️ Constructor `(name: string)` — inicializa vazio | idem | 2 testes |
| 10.6.4 | ⚠️ `flushCache(): void` — reseta `transitiveOptional` | idem | 2 testes |
| 10.6.5 | ⚠️ `addPattern(pattern): void` | idem | 2 testes |
| 10.6.6 | ⚠️ `include?(token): boolean` — verifica se algum pattern inclui o token | idem | 3 testes |
| 10.6.7 | ⚠️ `setOptional(): void` | idem | 1 teste |
| 10.6.8 | ⚠️ `optional?(rules): boolean` — **recursivo com cache** em `transitiveOptional` | idem | 5 testes |
| 10.6.9 | ⚠️ `generateStates(rules): State[]` — delega a cada pattern | idem | 3 testes |
| 10.6.10 | ⚠️ `addTransitionsToState(states, rules, stateStack, sourceState, loopBack): void` | idem | 3 testes |
| 10.6.11 | ⚠️ `setRepeatable(): void` | idem | 1 teste |
| 10.6.12 | ⚠️ `setDoc(keyword, doc): void` | idem | 2 testes |
| 10.6.13 | ⚠️ `setArg(idx, doc): void` | idem | 2 testes |
| 10.6.14 | ⚠️ `setLastSyntaxToken(idx): void` | idem | 1 teste |
| 10.6.15 | ⚠️ `setSupportLevel(level): void` | idem | 2 testes |
| 10.6.16 | ⚠️ `setSeeAlso(also): void` | idem | 1 teste |
| 10.6.17 | ⚠️ `setExample(file, tag): void` | idem | 2 testes |
| 10.6.18 | ⚠️ `pattern(idx): Pattern`; `to_syntax(stack, docs, rules, skip): string` | idem | 3 testes |

---

## Bloco C — FSM e Scanner

### 10.7 — `TextParser` FSM

**⚠️ RUBY: `TextParser.rb` (arquivo inteiro — ~500 linhas)**
**🔎 CHEAT: §3 `Array#pop/push` → stack, §12 Categoria B (transition)**

**Pré-requisitos:** 10.1–10.6.

#### 10.7.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.7.1.1 | Criar `packages/parser/src/parser/text-parser.ts` com `abstract class TextParser` | idem | `deno check` |
| 10.7.1.2 | Campos: `rules: Map<string, Rule>`, `variables: string[]`, `blockedVariables: Set<string>`, `cr: Rule \| null`, `states: Map<StateKey, State>` | idem | `deno check` |
| 10.7.1.3 | Campos: `stack: StackElement[] \| null`, `expectedTokens: string[]`, `scanner`, `val: unknown[]`, `sourceFileInfo: Array<SourceFileInfo \| null>` | idem | `deno check` |
| 10.7.1.4 | ⚠️ `limitTokenSet(tokenSet: string[] \| null): void` | idem | 3 testes |

#### 10.7.2 — Configuração

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.7.2.1 | ⚠️ `abstract initRules(): void` — subclasse implementa | idem | `deno check` |
| 10.7.2.2 | ⚠️ `newRule(name: string): void` — cria `Rule` e adiciona em `rules` | idem | 3 testes |
| 10.7.2.3 | ⚠️ `pattern(tokens: string[], fn?: Function): void` — adiciona `Pattern` à última rule | idem | 4 testes |
| 10.7.2.4 | ⚠️ `optional(): void` — marca última rule como optional | idem | 2 testes |
| 10.7.2.5 | ⚠️ `repeatable(): void` | idem | 1 teste |

#### 10.7.3 — Compilação

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.7.3.1 | ⚠️ `updateParserTables(): void` — gera `states` para cada rule | idem | 4 testes |
| 10.7.3.2 | ⚠️ `private checkRule(rule: Rule): void` — valida rule | idem | 2 testes |

#### 10.7.4 — Execução

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.7.4.1 | ⚠️ `parse(ruleName: string): unknown` — entry point; chama `parseFSM` | idem | 3 testes |
| 10.7.4.2 | ⚠️ `private parseFSM(rule: Rule): unknown` — **coração**; loop SHIFT/REDUCE | idem | 5 testes |
| 10.7.4.3 | ⚠️ `private finishPattern(token): boolean` — retorna `true` no EOF | idem | 4 testes |
| 10.7.4.4 | ⚠️ `private getNextToken(): Token` — abstrato | idem | `deno check` |
| 10.7.4.5 | ⚠️ `nextToken(): Token` — abstrato; subclasse implementa | idem | `deno check` |
| 10.7.4.6 | ⚠️ `returnToken(token): void` — abstrato | idem | `deno check` |
| 10.7.4.7 | ⚠️ `sourceFileInfo(): SourceFileInfo \| null` | idem | 2 testes |

#### 10.7.5 — Erros e debug

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.7.5.1 | ⚠️ `error(id, text, sfi?, data?): void` | idem | 3 testes |
| 10.7.5.2 | ⚠️ `warning(id, text, sfi?, data?): void` | idem | 2 testes |
| 10.7.5.3 | ⚠️ `private dumpStack(): void` — debug | idem | 1 teste |
| 10.7.5.4 | ⚠️ `private checkForOldSyntax(state, token): void` | idem | 2 testes |
| 10.7.5.5 | ⚠️ `private saveFsmStack()`, `restoreFsmStack()` | idem | 3 testes |
| 10.7.5.6 | Teste agregado: parser de teste `TestParser` que implementa `nextToken`/`returnToken` | idem | 3 testes |

---

### 10.8 — `Scanner` genérico + `StreamHandle`

**⚠️ RUBY: `TextParser/Scanner.rb` (arquivo inteiro — ~700 linhas)**
**🔎 CHEAT: §5 regex, §3 `arr` → `[]`, §12 Categoria B (line tracking)**

**Pré-requisitos:** 10.2 (`MacroTable`).

#### 10.8.1 — Estrutura

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.8.1.1 | Criar `packages/parser/src/lexer/scanner.ts` com `class Scanner` | idem | `deno check` |
| 10.8.1.2 | Campos: `masterFile: string`, `messageHandler`, `log`, `macroTable: MacroTable`, `cf: StreamHandle \| null` | idem | `deno check` |
| 10.8.1.3 | Campos: `fileStack: Array<[StreamHandle, Token \| null, (() => void) \| null]>`, `finishLastFile: boolean`, `fileNameIsBuffer: boolean` | idem | `deno check` |
| 10.8.1.4 | Campos: `startOfToken: SourceFileInfo \| null`, `lineDelta: number`, `patternsByMode: Map<string, ...>` | idem | `deno check` |
| 10.8.1.5 | Campos: `scannerMode: string`, `defaultMode: string`, `activePatterns` | idem | `deno check` |
| 10.8.1.6 | Constructor `(masterFile, log, tokenPatterns, defaultMode)` | idem | 2 testes |

#### 10.8.2 — Padrões

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.8.2.1 | ⚠️ `addPattern(type, regExp, mode, postProc?): void` | idem | 3 testes |
| 10.8.2.2 | ⚠️ `set mode(mode: string)` — muda `activePatterns` | idem | 4 testes |

#### 10.8.3 — File handling

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.8.3.1 | ⚠️ `open(fileNameIsBuffer = false): void` | idem | 3 testes |
| 10.8.3.2 | ⚠️ `close(): void` | idem | 2 testes |
| 10.8.3.3 | ⚠️ `include(fileName, sfi, onEof?): string` — push em `fileStack` | idem | 4 testes |

#### 10.8.4 — Source info

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.8.4.1 | ⚠️ `sourceFileInfo(): SourceFileInfo` | idem | 3 testes |
| 10.8.4.2 | ⚠️ `fileName(): string`, `lineNo(): number`, `columnNo(): number` | idem | 4 testes |
| 10.8.4.3 | ⚠️ `line(): string` — retorna linha atual | idem | 2 testes |

#### 10.8.5 — Tokens

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.8.5.1 | ⚠️ `nextToken(): Token` — chama `scanToken` | idem | 3 testes |
| 10.8.5.2 | ⚠️ `returnToken(token): void` — push de volta | idem | 3 testes |
| 10.8.5.3 | ⚠️ `private scanToken(): Token` — casa `activePatterns` | idem | 5 testes |

#### 10.8.6 — Macros

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.8.6.1 | ⚠️ `addMacro(macro): void` | idem | 2 testes |
| 10.8.6.2 | ⚠️ `macroDefined?(name): boolean` | idem | 2 testes |
| 10.8.6.3 | ⚠️ `expandMacro(prefix, args, callLength): void` — **algoritmo exato** | idem | 4 testes |

#### 10.8.7 — `StreamHandle`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.8.7.1 | Criar `packages/parser/src/lexer/stream-handle.ts` com `class StreamHandle` | idem | `deno check` |
| 10.8.7.2 | Campos: `fileName`, `log`, `textScanner`, `stream`, `scanner`, `macroStack`, `nextMacroEnd` | idem | `deno check` |
| 10.8.7.3 | ⚠️ `error(id, message)`, `close()`, `injectText(text, callLength)` | idem | 3 testes |
| 10.8.7.4 | ⚠️ `injectMacro(macro, args, text, callLength)` — `macroStack.push`, `nextMacroEnd` | idem | 4 testes |
| 10.8.7.5 | ⚠️ `readyNextLine()`, `scan(re)`, `cleanupMacroStack()`, `peek(n)`, `eof()` | idem | 5 testes |
| 10.8.7.6 | ⚠️ `dirname()`, `lineNo()`, `line()` | idem | 3 testes |
| 10.8.7.7 | Criar `class BufferStreamHandle extends StreamHandle` — string in-memory | idem | 3 testes |
| 10.8.7.8 | Criar `class FileStreamHandle extends StreamHandle` — carrega arquivo inteiro em browser | idem | 2 testes |

---

### 10.9 — `ProjectFileScanner`

**⚠️ RUBY: `ProjectFileScanner.rb` (arquivo inteiro — ~400 linhas)**

**Pré-requisitos:** 10.8, Fase 10.15–10.16 (`LanguageRegistry` — parcial).

#### 10.9.1 — Constructor + patterns

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.9.1.1 | Criar `packages/parser/src/lexer/project-file-scanner.ts` com `class ProjectFileScanner extends Scanner` | idem | `deno check` |
| 10.9.1.2 | Constructor `(masterFile, log, language = 'en')` — chama `super(masterFile, log, {}, ':tjp')` | idem | 2 testes |
| 10.9.1.3 | Registrar pattern `nil` para espaços + comentários (`#`, `//`, `/* */`) | idem | 3 testes |
| 10.9.1.4 | Registrar `${...}` para macro call; `$(...)` para env var | idem | 3 testes |
| 10.9.1.5 | Registrar `ID_WITH_COLON`, `ABSOLUTE_ID`, `ID` | idem | 4 testes |
| 10.9.1.6 | Registrar `DATE`, `TIME` | idem | 3 testes |
| 10.9.1.7 | Registrar `FLOAT`, `INTEGER` | idem | 3 testes |
| 10.9.1.8 | Registrar strings `"..."`, `'...'`, `-8<- ... ->8-` (heredoc) | idem | 4 testes |
| 10.9.1.9 | Registrar `MACRO` (`[...]`) | idem | 2 testes |
| 10.9.1.10 | Registrar `LITERAL` (`<=`, `>=`, `!=`, single chars) | idem | 4 testes |

#### 10.9.2 — Modos

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.9.2.1 | Modo `:tjp` (default) | idem | 1 teste |
| 10.9.2.2 | Modo `:dqString`, `:sqString`, `:szrString` | idem | 3 testes |
| 10.9.2.3 | Modo `:macroCall`, `:macroDef` | idem | 2 testes |
| 10.9.2.4 | Modo `:cppComment` | idem | 1 teste |

#### 10.9.3 — i18n (extensão)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.9.3.1 | ⚠️ Se `language !== 'en'`, aplicar `LanguageRegistry.resolve(word, language)` sobre tokens `ID` | idem | 5 testes (en, pt-BR, es, desconhecido, sem idioma) |
| 10.9.3.2 | Se sinônimo encontrado, retorna `[KEYWORD, canonical]` em vez de `[ID, text]` | idem | 4 testes |
| 10.9.3.3 | Re-exportar em `lexer/mod.ts` e `packages/parser/mod.ts` | idem | `deno check` |

---

## Bloco D — Parser TJP

### 10.10 — `ProjectFileParser` (estrutura)

**⚠️ RUBY: `ProjectFileParser.rb` (arquivo inteiro — ~700 linhas)**
**🔎 CHEAT: §3 `each` → `for-of`, §5 strings, §8 `method_missing` → registro explícito**

**Pré-requisitos:** Fases 1–9 completas, 10.7 (`TextParser`), 10.9 (`ProjectFileScanner`).

#### 10.10.1 — Campos

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.10.1.1 | Criar `packages/parser/src/parser/project-file-parser.ts` com `class ProjectFileParser extends TextParser` | idem | `deno check` |
| 10.10.1.2 | Campo `variables = ['INTEGER', 'FLOAT', 'DATE', 'TIME', 'STRING', 'LITERAL', 'ID', 'ID_WITH_COLON', 'ABSOLUTE_ID', 'MACRO', 'KEYWORD']` | idem | 1 teste |
| 10.10.1.3 | Campos: `project`, `property`, `scenarioIdx`, `idStack: string[]`, `fileStack`, `fileStackVariables: string[]` | idem | `deno check` |
| 10.10.1.4 | Campos de prefixo: `taskprefix`, `resourceprefix`, `accountprefix`, `reportprefix` | idem | `deno check` |
| 10.10.1.5 | Campos de estado: `allocate`, `booking`, `journalEntry`, `navigator`, `limits`, `limitInterval`, `limitResources`, `shiftAssignments` | idem | `deno check` |
| 10.10.1.6 | Campos: `column`, `timeSheet`, `timeSheetRecord`, `sheetAuthor`, `sheetStart`, `sheetEnd`, `reportCounter`, `projectId` | idem | `deno check` |
| 10.10.1.7 | Campos: `sortProperty`, `ruleToExtend`, `ruleToExtendWithScenario`, `propertySet`, `language: string` (novo — i18n) | idem | `deno check` |
| 10.10.1.8 | Constructor `()` — `language = 'en'`, `AttributeBase.setMode(0)` | idem | 3 testes |

#### 10.10.2 — Open/close

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.10.2.1 | ⚠️ `open(file, master, fileNameIsBuffer = false): void` — cria `ProjectFileScanner` | idem | 3 testes |
| 10.10.2.2 | `open` — se `master`, `setGlobalMacros()` | idem | 2 testes |
| 10.10.2.3 | `open` — detecta `language` via `detectLanguage` (subfase 10.17) | idem | 3 testes |
| 10.10.2.4 | ⚠️ `close(): void` | idem | 2 testes |

#### 10.10.3 — Tokens

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.10.3.1 | ⚠️ `nextToken(): Token` — delega para `scanner.nextToken` | idem | 2 testes |
| 10.10.3.2 | ⚠️ `returnToken(token): void` | idem | 2 testes |

#### 10.10.4 — Macros globais

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.10.4.1 | ⚠️ `setGlobalMacros(): void` — define macros `now`, `projectstart`, `projectend`, `projectid` | idem | 5 testes |

#### 10.10.5 — Helpers (parcial)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.10.5.1 | ⚠️ `weekDay(arg: number): string` — retorna nome do dia | idem | 3 testes |
| 10.10.5.2 | ⚠️ `checkContainer(): void` | idem | 2 testes |
| 10.10.5.3 | ⚠️ `checkInterval(iv: TimeInterval): void` | idem | 2 testes |
| 10.10.5.4 | ⚠️ `checkBooking(booking: Booking): void` | idem | 3 testes |
| 10.10.5.5 | ⚠️ `extendPropertySetDefinition()` — para `extend` | idem | 3 testes |
| 10.10.5.6 | ⚠️ `newRichText(text, sfi, tokenSet): RichTextIntermediate` — usa `RichTextFactory` (stub em Fase 10; real na Fase 12) | idem | 3 testes |
| 10.10.5.7 | ⚠️ `newReport(id, name, parent, typeSpec): Report` | idem | 3 testes |
| 10.10.5.8 | ⚠️ `setLimit(name, value, interval, resource)` | idem | 3 testes |
| 10.10.5.9 | ⚠️ `setDurationAttribute(id, value)` | idem | 2 testes |
| 10.10.5.10 | ⚠️ `allOrNothingListRule`, `listRule`, `commaListRule`, `optionsRule`, `singlePattern` | idem | 5 testes |
| 10.10.5.11 | ⚠️ Helpers de documentação: `doc`, `descr`, `arg`, `lastSyntaxToken`, `level`, `also`, `example`, `columnTitle` | idem | 8 testes |
| 10.10.5.12 | ⚠️ File stack: `initFileStack`, `pushFileStack`, `popFileStack` | idem | 4 testes |
| 10.10.5.13 | ⚠️ `appendScListAttribute(id, value)` — para listas scenario-specific | idem | 3 testes |
| 10.10.5.14 | ⚠️ `parseReportAttributes(report, attributes): void` | idem | 3 testes |
| 10.10.5.15 | ⚠️ `initRules()` — chamada a cada `rule_*` (registro explícito via array) | idem | 2 testes |
| 10.10.5.16 | ⚠️ `updateParserTables()` — override de `TextParser` se necessário | idem | 2 testes |
| 10.10.5.17 | Re-exportar em `parser/mod.ts` e `packages/parser/mod.ts` | idem | `deno check` |
| 10.10.5.18 | Teste agregado: `open` + `parse('project')` de um `.tjp` mínimo vazio | idem | 1 teste |

---

## Bloco E — TjpSyntaxRules (4 blocos)

### 10.11 — `TjpSyntaxRules`: bloco 1 (project + task)

**⚠️ RUBY: `TjpSyntaxRules.rb` — bloco `rule_project` até `rule_task`**
**🔎 CHEAT: §3 `each` → `for-of`, §5 strings, §8 `pattern` com `this`**

**Pré-requisitos:** 10.10.

**Objetivo:** ~80 regras. Organizar em 3 arquivos (`rules-project.ts`, `rules-task.ts`, `rules-common.ts`).

#### 10.11.1 — `rules-common.ts` (regras base)

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.11.1.1 | Criar `packages/parser/src/parser/rules/rules-common.ts` com `rule_optionalID` | idem | 3 testes |
| 10.11.1.2 | `rule_optionalVersion`, `rule_optionalMinus`, `rule_optionalPercent`, `rule_optionalScenarioIdCol` | idem | 8 testes |
| 10.11.1.3 | `rule_date`, `rule_dateCalcedOrNot`, `rule_valDate` | idem | 6 testes |
| 10.11.1.4 | `rule_interval`, `rule_intervalOrDate`, `rule_intervalEnd`, `rule_intervalOptionalEnd`, `rule_intervalOptional`, `rule_intervals`, `rule_intervalsOptional`, `rule_valInterval`, `rule_valIntervalOrDate`, `rule_valIntervals` | idem | 18 testes |
| 10.11.1.5 | `rule_number`, `rule_valNumber`, `rule_nonZeroWorkingDuration`, `rule_workingDuration`, `rule_workingDurationPercent`, `rule_durationUnit`, `rule_durationUnitOrPercent`, `rule_calendarDuration`, `rule_intervalDuration` | idem | 16 testes |
| 10.11.1.6 | `rule_idOrAbsoluteId`, `rule_relativeId`, `rule_moreBangs` | idem | 6 testes |
| 10.11.1.7 | `rule_scenarioId`, `rule_scenarioIdx`, `rule_scenarioIdList`, `rule_moreScnarioIdList`, `rule_scenarioIdCol` | idem | 8 testes |
| 10.11.1.8 | `rule_yesNo`, `rule_allOrNone`, `rule_weekDay`, `rule_weekDayInterval`, `rule_weekDayIntervalEnd`, `rule_listOfDays`, `rule_moreListOfDays` | idem | 12 testes |
| 10.11.1.9 | `rule_timeInterval`, `rule_listOfTimes`, `rule_moreTimeIntervals`, `rule_plusOrMinus` | idem | 6 testes |
| 10.11.1.10 | `rule_macro`, `rule_supplement`, `rule_supplementTask` | idem | 6 testes |

#### 10.11.2 — `rules-project.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.11.2.1 | `rule_project`, `rule_projectHeader` — cria `Project` | idem | 5 testes |
| 10.11.2.2 | `rule_projectBody`, `rule_projectBodyAttributes` — itera atributos | idem | 5 testes |
| 10.11.2.3 | `rule_projectProlog`, `rule_projectDeclaration` | idem | 4 testes |
| 10.11.2.4 | `rule_includeFile`, `rule_includeFileName` | idem | 4 testes |
| 10.11.2.5 | `rule_includeAttributes`, `rule_includeAttributesBody` | idem | 4 testes |
| 10.11.2.6 | `rule_includeProperties`, `rule_includePropertiesFile` | idem | 3 testes |
| 10.11.2.7 | `rule_projectBodyInclude`, `rule_prologInclude` | idem | 4 testes |
| 10.11.2.8 | Teste agregado: parse de `project prj "Test" 1.0 2026-01-01 - 2026-12-31 { ... }` | idem | 1 teste |

#### 10.11.3 — `rules-task.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.11.3.1 | `rule_task`, `rule_taskHeader` — cria `Task` | idem | 4 testes |
| 10.11.3.2 | `rule_taskBody`, `rule_taskAttributes`, `rule_taskScenarioAttributes` | idem | 5 testes |
| 10.11.3.3 | `rule_taskId`, `rule_taskIdUnverifd`, `rule_absoluteTaskId`, `rule_taskList` | idem | 6 testes |
| 10.11.3.4 | `rule_taskDep`, `rule_taskDepHeader`, `rule_taskDepBody`, `rule_taskDepAttributes`, `rule_taskDepId`, `rule_taskDepList`, `rule_moreDepTasks` | idem | 10 testes |
| 10.11.3.5 | `rule_taskPred`, `rule_taskPredHeader`, `rule_taskPredList`, `rule_morePredTasks` | idem | 6 testes |
| 10.11.3.6 | `rule_taskBooking`, `rule_taskBookingHeader`, `rule_bookingBody`, `rule_bookingAttributes` | idem | 7 testes |
| 10.11.3.7 | `rule_taskShiftAssignments`, `rule_taskShiftsAssignments`, `rule_shiftAssignments`, `rule_shiftAssignment`, `rule_moreShiftAssignments` | idem | 8 testes |
| 10.11.3.8 | Teste agregado: parse de `task t1 "Task 1" { effort 8d }` | idem | 1 teste |
| 10.11.3.9 | Teste agregado: parse de `task t2 { depends t1 }` | idem | 1 teste |
| 10.11.3.10 | Teste agregado: parse de `task t3 { milestone }` | idem | 1 teste |

---

### 10.12 — `TjpSyntaxRules`: bloco 2 (resource + account + shift + scenario)

**⚠️ RUBY: `TjpSyntaxRules.rb` — bloco resource até scenario**

**Pré-requisitos:** 10.11.

#### 10.12.1 — `rules-resource.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.12.1.1 | `rule_resource`, `rule_resourceHeader`, `rule_resourceBody`, `rule_resourceAttributes`, `rule_resourceScenarioAttributes` | idem | 10 testes |
| 10.12.1.2 | `rule_resourceId`, `rule_resourceLeafList`, `rule_resourceList`, `rule_moreResources`, `rule_moreResourceLeafList`, `rule_leafResourceId`, `rule_undefResourceId` | idem | 12 testes |
| 10.12.1.3 | `rule_bookingList`, `rule_resourceBooking`, `rule_resourceBookingHeader`, `rule_resourceShiftAssignments`, `rule_resourceShiftsAssignments` | idem | 8 testes |
| 10.12.1.4 | `rule_leaves`, `rule_leaveList`, `rule_leave`, `rule_leaveType`, `rule_leaveName` | idem | 8 testes |
| 10.12.1.5 | `rule_leaveAllowances`, `rule_leaveAllowance`, `rule_leaveAllowanceList`, `rule_moreLeaveAllowanceList` | idem | 6 testes |
| 10.12.1.6 | `rule_workinghours`, `rule_workinghoursResource`, `rule_workinghoursProject`, `rule_workinghoursShift` | idem | 6 testes |

#### 10.12.2 — `rules-account.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.12.2.1 | `rule_account`, `rule_accountHeader`, `rule_accountBody`, `rule_accountAttributes`, `rule_accountScenarioAttributes` | idem | 8 testes |
| 10.12.2.2 | `rule_accountId`, `rule_accountCredits`, `rule_accountCredit`, `rule_moreAccountCredits` | idem | 6 testes |
| 10.12.2.3 | Teste agregado: parse de `account dev "Development" { credit 2026-01-01 -1000 }` | idem | 1 teste |

#### 10.12.3 — `rules-shift.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.12.3.1 | `rule_shift`, `rule_shiftHeader`, `rule_shiftBody`, `rule_shiftAttributes`, `rule_shiftScenarioAttributes` | idem | 8 testes |
| 10.12.3.2 | `rule_shiftId` | idem | 2 testes |

#### 10.12.4 — `rules-scenario.ts` + `extend` + `chargeset` + `charge` + `limits` + `flags` + `fail/warn`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.12.4.1 | `rule_scenario`, `rule_scenarioHeader`, `rule_scenarioBody`, `rule_scenarioAttributes` | idem | 6 testes |
| 10.12.4.2 | `rule_extendProperty`, `rule_extendPropertyId`, `rule_extendBody`, `rule_extendAttributes`, `rule_extendOptions`, `rule_extendOptionsBody`, `rule_extendId` | idem | 10 testes |
| 10.12.4.3 | `rule_chargeset`, `rule_chargeSetItem`, `rule_moreChargeSetItems`, `rule_optionalPercent` | idem | 6 testes |
| 10.12.4.4 | `rule_charge`, `rule_chargeMode` | idem | 4 testes |
| 10.12.4.5 | `rule_limits`, `rule_limitsHeader`, `rule_limitsBody`, `rule_limitsAttributes`, `rule_limitsAttributesBody`, `rule_limitAttributes`, `rule_limitAttributesBody`, `rule_limitValue`, `rule_moreLimitAttributes` | idem | 12 testes |
| 10.12.4.6 | `rule_flags`, `rule_flagList`, `rule_moreFlagList`, `rule_flag`, `rule_declareFlagList`, `rule_moreDeclareFlagList` | idem | 8 testes |
| 10.12.4.7 | `rule_fail`, `rule_warn` | idem | 4 testes |
| 10.12.4.8 | `rule_supplementAccount`, `rule_supplementResource`, `rule_supplementTask` | idem | 4 testes |
| 10.12.4.9 | Teste agregado: parse de `resource r1 "Resource" { rate 100 }` | idem | 1 teste |
| 10.12.4.10 | Teste agregado: parse de `shift morning "Morning" { workinghours mon 9:00 - 17:00 }` | idem | 1 teste |

---

### 10.13 — `TjpSyntaxRules`: bloco 3 (reports)

**⚠️ RUBY: `TjpSyntaxRules.rb` — bloco reports**

**Pré-requisitos:** 10.12.

**Objetivo:** ~80 regras. O maior bloco individual é `rule_reportableAttributes` (~80 patterns).

#### 10.13.1 — Headers de reports

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.13.1.1 | `rule_taskReport`, `rule_taskReportHeader` | idem | 4 testes |
| 10.13.1.2 | `rule_resourceReport`, `rule_resourceReportHeader` | idem | 4 testes |
| 10.13.1.3 | `rule_accountReport`, `rule_accountReportHeader` | idem | 4 testes |
| 10.13.1.4 | `rule_textReport`, `rule_textReportHeader` | idem | 4 testes |
| 10.13.1.5 | `rule_traceReport`, `rule_traceReportHeader` | idem | 4 testes |
| 10.13.1.6 | `rule_export`, `rule_exportHeader`, `rule_exportBody`, `rule_exportDefinitions`, `rule_exportableTaskAttributes`, `rule_exportableResourceAttributes`, `rule_exportFormats`, `rule_moreExportFormats`, `rule_exportFormat`, `rule_exportAttributes` | idem | 12 testes |
| 10.13.1.7 | `rule_iCalReport`, `rule_iCalReportHeader`, `rule_iCalReportAttributes`, `rule_iCalReportBody` | idem | 6 testes |
| 10.13.1.8 | `rule_nikuReport`, `rule_nikuReportHeader`, `rule_nikuReportAttributes`, `rule_nikuReportBody` | idem | 6 testes |
| 10.13.1.9 | `rule_tagfile`, `rule_tagfileHeader`, `rule_tagfileAttributes`, `rule_tagfileBody` | idem | 6 testes |
| 10.13.1.10 | `rule_ssReportHeader`, `rule_ssReportAttributes`, `rule_ssReportBody`, `rule_statusSheetReport`, `rule_ssStatus`, `rule_ssStatusHeader`, `rule_ssStatusBody`, `rule_ssStatusAttributes` | idem | 12 testes |
| 10.13.1.11 | `rule_tsReportHeader`, `rule_tsReportAttributes`, `rule_tsReportBody` | idem | 4 testes |

#### 10.13.2 — Body e attrs

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.13.2.1 | `rule_reportBody`, `rule_reportAttributes`, `rule_reportEnd`, `rule_reportStart`, `rule_reportPeriod`, `rule_reportTitle`, `rule_reportId`, `rule_reportIdUnverifd`, `rule_reportName` | idem | 12 testes |
| 10.13.2.2 | `rule_hidetask`, `rule_hideresource`, `rule_hideaccount`, `rule_hidejournalentry` | idem | 6 testes |
| 10.13.2.3 | `rule_rolluptask`, `rule_rollupresource`, `rule_rollupaccount` | idem | 4 testes |
| 10.13.2.4 | `rule_sortTasks`, `rule_sortResources`, `rule_sortAccounts`, `rule_sortCriteria`, `rule_sortCriterium`, `rule_sortTree`, `rule_sortNonTree`, `rule_moreSortCriteria`, `rule_sortTasksKeyword`, `rule_sortResourcesKeyword`, `rule_sortAccountsKeyword` | idem | 14 testes |
| 10.13.2.5 | `rule_sortJournalEntries`, `rule_journalSortCriteria`, `rule_journalSortCriterium` | idem | 4 testes |
| 10.13.2.6 | `rule_outputFormats`, `rule_moreOutputFormats`, `rule_outputFormat` | idem | 4 testes |
| 10.13.2.7 | `rule_headline`, `rule_caption`, `rule_header`, `rule_footer`, `rule_center`, `rule_left`, `rule_right`, `rule_epilog`, `rule_prolog` | idem | 12 testes |
| 10.13.2.8 | `rule_numberFormat`, `rule_currencyFormat`, `rule_loadunit`, `rule_loadunitName` | idem | 6 testes |
| 10.13.2.9 | `rule_reportProperties`, `rule_reportPropertiesBody`, `rule_reportPropertiesFile` | idem | 4 testes |
| 10.13.2.10 | `rule_journalReportAttributes`, `rule_journalReportMode` | idem | 4 testes |

#### 10.13.3 — Colunas

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.13.3.1 | `rule_columns`, `rule_moreColumnDef`, `rule_columnDef`, `rule_columnId`, `rule_columnBody`, `rule_columnOptions`, `rule_columnTitle` | idem | 8 testes |
| 10.13.3.2 | ⚠️ `rule_reportableAttributes` — grande enum com ~80 patterns | idem | 80 testes (1 por pattern) |
| 10.13.3.3 | `rule_hAlignment`, `rule_listType`, `rule_chartScale`, `rule_color`, `rule_alertLevel` | idem | 6 testes |
| 10.13.3.4 | Teste agregado: parse de `taskreport r1 { formats html; columns name, effort, chart }` | idem | 1 teste |

---

### 10.14 — `TjpSyntaxRules`: bloco 4 (tracking + logic)

**⚠️ RUBY: `TjpSyntaxRules.rb` — bloco tracking + logic**

**Pré-requisitos:** 10.13.

#### 10.14.1 — `rules-timesheet.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.14.1.1 | `rule_timeSheet`, `rule_timeSheetHeader`, `rule_timeSheetBody`, `rule_timeSheetAttributes`, `rule_timeSheetFile` | idem | 8 testes |
| 10.14.1.2 | `rule_tsTaskHeader`, `rule_tsTaskBody`, `rule_tsTaskAttributes`, `rule_tsNewTaskHeader` | idem | 6 testes |
| 10.14.1.3 | `rule_tsStatus`, `rule_tsStatusHeader`, `rule_tsStatusBody`, `rule_tsStatusAttributes` | idem | 6 testes |

#### 10.14.2 — `rules-statussheet.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.14.2.1 | `rule_statusSheet`, `rule_statusSheetHeader`, `rule_statusSheetBody`, `rule_statusSheetAttributes`, `rule_statusSheetFile` | idem | 8 testes |
| 10.14.2.2 | `rule_statusSheetTask`, `rule_statusSheetTaskHeader`, `rule_statusSheetTaskBody`, `rule_statusSheetTaskAttributes` | idem | 6 testes |

#### 10.14.3 — `rules-journal.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.14.3.1 | `rule_journalEntry`, `rule_journalEntryHeader`, `rule_journalEntryBody`, `rule_journalEntryAttributes` | idem | 6 testes |
| 10.14.3.2 | `rule_details`, `rule_summary`, `rule_author` | idem | 5 testes |

#### 10.14.4 — `rules-logical.ts`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.14.4.1 | `rule_logicalExpression`, `rule_operation`, `rule_operationChain` | idem | 6 testes |
| 10.14.4.2 | `rule_operatorAndOperand`, `rule_operand`, `rule_operator` | idem | 6 testes |
| 10.14.4.3 | `rule_functions`, `rule_functionsBody`, `rule_functionPatterns` | idem | 6 testes |
| 10.14.4.4 | `rule_argument`, `rule_argumentList`, `rule_argumentListBody`, `rule_moreArguments` | idem | 6 testes |
| 10.14.4.5 | `rule_flagLogicalExpression`, `rule_flagOperation`, `rule_flagOperationChain`, `rule_flagOperatorAndOperand`, `rule_flagOperand`, `rule_flagOperator` | idem | 8 testes |
| 10.14.4.6 | Teste agregado: parse de `hidetask isleaf()` | idem | 1 teste |
| 10.14.4.7 | Teste agregado: parse de `hidetask a | b & c` (sem precedência) | idem | 1 teste |

#### 10.14.5 — Allocations + chargeset extensions + outros

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.14.5.1 | `rule_allocation`, `rule_allocationHeader`, `rule_allocationBody`, `rule_allocationAttributes`, `rule_allocations`, `rule_moreAllocations` | idem | 8 testes |
| 10.14.5.2 | `rule_allocate`, `rule_allocationSelectionMode`, `rule_allocateShiftAssignments`, `rule_allocateShiftsAssignments` | idem | 6 testes |
| 10.14.5.3 | `rule_alertLevel`, `rule_alertLevelDefinition`, `rule_alertLevelDefinitions`, `rule_moreAlertLevelDefinitions` | idem | 6 testes |
| 10.14.5.4 | `rule_navigator`, `rule_navigatorHeader`, `rule_navigatorBody`, `rule_navigatorAttributes` | idem | 6 testes |
| 10.14.5.5 | `rule_nodeId`, `rule_nodeIdList`, `rule_moreNodeIdList`, `rule_subNodeId` | idem | 6 testes |
| 10.14.5.6 | `rule_monthlyYearly`, `rule_projectIDs`, `rule_moreProjectIDs` | idem | 4 testes |

---

## Bloco F — i18n

### 10.15 — `LanguageRegistry` + `CanonicalKeyword`

**Pré-requisitos:** nenhum (independente).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.15.1 | Criar `packages/language/src/types.ts` com `interface LanguageDefinition` (campos: `id`, `name`, `keywords`, `units`) | idem | `deno check` |
| 10.15.2 | Criar `packages/language/src/canonical.ts` com `type CanonicalKeyword` (união de ~200 keywords) | idem | 1 teste (contagem ≥ 200) |
| 10.15.3 | Criar `packages/language/src/registry.ts` com `class LanguageRegistry` | idem | `deno check` |
| 10.15.4 | Campos: `private languages: Map<string, LanguageDefinition>`, `private keywordIndex`, `private unitIndex` | idem | `deno check` |
| 10.15.5 | ⚠️ `register(lang: LanguageDefinition): void` | idem | 2 testes |
| 10.15.6 | ⚠️ `get(id: string): LanguageDefinition \| null` | idem | 3 testes |
| 10.15.7 | ⚠️ `all(): LanguageDefinition[]` | idem | 1 teste |
| 10.15.8 | ⚠️ `resolve(word: string, langId: string): string \| null` — busca em `keywordIndex` | idem | 5 testes |
| 10.15.9 | ⚠️ `resolveUnit(unit: string, langId: string): string \| null` | idem | 4 testes |
| 10.15.10 | ⚠️ `canonicalizeKeywords(langId: string): Map<string, string>` — retorna `synonym → canonical` | idem | 2 testes |
| 10.15.11 | Re-exportar em `packages/language/mod.ts` | idem | `deno check` |
| 10.15.12 | Teste agregado: 2 idiomas registrados; `resolve` retorna canônico correto para cada um | idem | 1 teste |

---

### 10.16 — Idiomas: `en`, `pt-BR`, `es`

**Pré-requisitos:** 10.15.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.16.1 | Criar `packages/language/src/en.ts` com `export const en: LanguageDefinition` | idem | `deno check` |
| 10.16.2 | `en.keywords` com todos os ~200 keywords canônicos (cada um com `[canonical]` como sinônimo) | idem | 1 teste (contagem 200) |
| 10.16.3 | `en.units`: `day`, `hour`, `week`, `month`, `year`, `minute` | idem | 6 testes |
| 10.16.4 | Criar `packages/language/src/pt-BR.ts` — tradução completa dos ~200 keywords | idem | 1 teste (contagem 200) |
| 10.16.5 | `pt-BR.units`: `d`, `dia`, `dias`, `h`, `hora`, `horas`, etc. | idem | 6 testes |
| 10.16.6 | Criar `packages/language/src/es.ts` — tradução completa | idem | 1 teste |
| 10.16.7 | `es.units`: `d`, `día`, `días`, `h`, `hora`, `horas`, etc. | idem | 6 testes |
| 10.16.8 | Teste: todos os 3 idiomas cobrem os mesmos ~200 keywords canônicos | idem | 1 teste |
| 10.16.9 | Teste: nenhum sinônimo colide entre idiomas (dentro do mesmo idioma) | idem | 1 teste |
| 10.16.10 | Criar `packages/language/tests/languages_test.ts` com teste agregado | idem | 1 teste |

---

### 10.17 — Diretiva `language` no parser

**⚠️ RUBY: extensão SyntaxMesh (não existe no TJ)**

**Pré-requisitos:** 10.10 (`ProjectFileParser`), 10.15 (`LanguageRegistry`).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.17.1 | ⚠️ `private detectLanguage(content: string): string` — regex `/^\s*language\s+"([^"]+)"/m` | `project-file-parser.ts` | 5 testes |
| 10.17.2 | `detectLanguage` — se casou, valida que o ID existe em `LanguageRegistry`; senão, `en` | idem | 4 testes |
| 10.17.3 | ⚠️ Em `open(file, master, fileNameIsBuffer)`: se `fileNameIsBuffer`, `content = file`; senão, `content = loadFile(file)` | idem | 3 testes |
| 10.17.4 | `open` — `this.language = this.detectLanguage(content)` | idem | 2 testes |
| 10.17.5 | `open` — chama `super.open(content, true)` (sempre buffer interno) | idem | 2 testes |
| 10.17.6 | Adicionar `rule_language` em `rules-project.ts` para consumir a diretiva no parser | idem | 3 testes |
| 10.17.7 | Teste agregado: `open('language "pt-BR"\nprojeto p1 ...')` → `this.language === 'pt-BR'` | idem | 1 teste |
| 10.17.8 | Teste agregado: `open('language "es"\nproyecto p1 ...')` → `this.language === 'es'` | idem | 1 teste |

---

### 10.18 — AST equivalence entre idiomas

**Pré-requisitos:** 10.15–10.17, 10.11–10.14 (parser completo).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.18.1 | Traduzir `mwe001/tutorial.tjp` para `pt-BR` e `es` (novos arquivos `.pt-BR.tjp`, `.es.tjp`) | `tests/fixtures/i18n/` | arquivos existem |
| 10.18.2 | Repetir para `mwe002–mwe009` (8 traduções × 2 idiomas) | idem | 16 arquivos |
| 10.18.3 | Criar `packages/parser/tests/ast-equivalence_test.ts` | idem | `deno check` |
| 10.18.4 | Função helper `normalizeAST(ast)` — substitui `name` de tasks/resources por `"__TASK__"`/`"__RESOURCE__"` | idem | 3 testes |
| 10.18.5 | ⚠️ Para cada MWE: parsear versão `en` → AST1 | idem | 9 testes |
| 10.18.6 | Para cada MWE: parsear versão `pt-BR` → AST2 | idem | 9 testes |
| 10.18.7 | Para cada MWE: parsear versão `es` → AST3 | idem | 9 testes |
| 10.18.8 | Para cada MWE: comparar `AST1 === AST2 === AST3` (estruturalmente) | idem | 9 testes |

---

## Bloco G — Golden tests

### 10.19 — Golden tests (parser)

**⚠️ RUBY: `TestSuite/Syntax/Correct/*.tjp` + `TestSuite/Syntax/Errors/*.tjp`**

**Pré-requisitos:** 10.10–10.14 (parser completo).

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 10.19.1 | Atualizar `scripts/golden/README.md` com seção de `parser` | idem | existe |
| 10.19.2 | Criar `scripts/golden/parser-mwe001.rb` a `parser-mwe009.rb` (9 scripts) | idem | 9 arquivos |
| 10.19.3 | Cada script roda `tj3 --check-syntax <file>` e captura `{ file, ok }` | idem | roda |
| 10.19.4 | Criar `scripts/golden/parser-syntax-correct.rb` — itera `TestSuite/Syntax/Correct/` (~150 `.tjp`) | idem | roda |
| 10.19.5 | Criar `scripts/golden/parser-syntax-errors.rb` — itera `TestSuite/Syntax/Errors/` (~50 `.tjp`); captura `{ file, ok: false, errorId, errorMsg, lineNo }` | idem | roda |
| 10.19.6 | Serializar em `parser.golden.json` | idem | ≥ 100 casos |
| 10.19.7 | Task `golden:generate` atualizada em `deno.jsonc` | `deno.jsonc` | roda |
| 10.19.8 | Criar `packages/parser/tests/golden/parser_golden_test.ts` — itera casos | idem | verde |
| 10.19.9 | Para cada caso, parsear com `ProjectFileParser`; comparar sucesso/erro | idem | ≥ 100 casos |
| 10.19.10 | Se erro, comparar `errorId`, `errorMsg` (ou equivalente), `lineNo` | idem | 5 testes |
| 10.19.11 | Cobertura ≥ 100 casos; commitar JSON em `packages/parser/tests/golden/` | idem | versionado |
| 10.19.12 | Teste de regressão: rodar novamente `tj3` e comparar com o JSON commitado | idem | 1 teste |

---

## Bloco H — Verificação final

### 10.20 — Verificação final

| # | Tarefa | Verificação |
|---|---|---|
| 10.20.1 | `deno task check-all` verde | exit 0 |
| 10.20.2 | `deno task golden:generate && deno task test` verde | exit 0 |
| 10.20.3 | `grep -r "NotYetImplementedError" packages/parser/src/` — apenas `newRichText` (Fase 12) | ≤ 1 ocorrência |
| 10.20.4 | ADRs 021 e 022 criadas e commitadas | git log |
| 10.20.5 | Todos os ~300 `rule_*` implementados em `TjpSyntaxRules` | `grep -c "rule_" packages/parser/src/parser/rules/` ≥ 300 |
| 10.20.6 | `LanguageRegistry`, `en`, `pt-BR`, `es` exportados em `packages/language/mod.ts` | `deno check` |
| 10.20.7 | `tests/integration/smoke_after_phase_10_test.ts` — parseia `mwe001/tutorial.tjp`, verifica AST; parseia `mwe001/tutorial.pt-BR.tjp`, compara AST; verifica Fase 9 (`Project.schedule`) | 1 teste |
| 10.20.8 | Auditoria: cada subfase do plano `fase-10-parser-linguagem.md` tem tarefas correspondentes | grep |
| 10.20.9 | Corrigir numeração em `fase-10-parser-linguagem.md` (`### 14.X` → `### 10.X`, `ADR 020/021` → `ADR 021/022`) | grep |
| 10.20.10 | Teste agregado: parsear todos os 9 MWEs em `en`, `pt-BR`, `es` e comparar ASTs normalizadas | 1 teste |

---

## Notas para a IA

1. **Ordem:** 10.0 → 10.1 → 10.2 → 10.3 → 10.4 → 10.5 → 10.6 → 10.7 → 10.8 → 10.9 → 10.10 → 10.11 → 10.12 → 10.13 → 10.14 → 10.15 → 10.16 → 10.17 → 10.18 → 10.19 → 10.20.
   - Exceção: 10.15–10.16 podem rodar em paralelo com 10.11–10.14.
2. **Sempre ler o Ruby primeiro.** Cada tarefa com `⚠️ RUBY:` exige leitura do arquivo inteiro.
3. **`parseFSM` é o coração.** Não simplificar.
4. **`StackElement.function` precisa de `this` bind correto.** Não usar arrow functions nas actions.
5. **`Pattern.addTransitionsToState` tem 7 parâmetros.** Atenção.
6. **`Rule.optional?` é recursivo com cache.**
7. **`Scanner.mode` muda durante lexing.** Modos exatos.
8. **Macros `${N}` são expandidas no scanner.** Antes do parser.
9. **Includes aninhados usam `@fileStack`.**
10. **`TjpSyntaxRules` tem ~300 regras.** Não inventar.
11. **`LanguageRegistry` é extensão do SyntaxMesh.**
12. **Diretiva `language` via pré-scan** com regex `/^\s*language\s+"([^"]+)"/m`.
13. **`rule_reportableAttributes` é a maior regra.**
14. **Golden tests cobrem `Syntax/Correct` e `Syntax/Errors`.**
15. **AST equivalence normaliza `name`.**
16. **Sem `any`.** Use `unknown` + narrowing.
17. **Commit por subfase.** `feat(parser): text-parser`, `feat(parser): rules-task`, etc.
18. **`newRichText` é stub** nesta fase (Fase 12 implementa o real).
19. **ADR 021** (FSM) e **ADR 022** (i18n) — não 020/021.
20. **`ProjectFileParser` usa `RichTextFactory` stub** — Fase 12 substitui.

---

## Notas específicas por subfase

### 10.0 — ADRs 021 e 022

- **ADR 021** formaliza a decisão de manter FSM (não portar para recursive descent).
- **ADR 022** formaliza o i18n via `LanguageRegistry`.

### 10.1–10.6 — Infraestrutura

- **`TokenDoc`** é trivial.
- **`MacroTable.resolve`** lida com `?` (opcional) e substitue `${i}`.
- **`StackElement.insert`** com `multiValue` concatena arrays.
- **`State`** tem transições com loop-back.
- **`Pattern`** tem 7 parâmetros em `addTransitionsToState`.
- **`Rule.optional?`** tem cache.

### 10.7 — TextParser FSM

- **Coração da fase.** Replicar `parseFSM` linha-a-linha.
- **SHIFT / REDUCE** exatos.
- **`finishPattern` retorna `true` no EOF.**
- **Testes com `TestParser` mínimo.**

### 10.8 — Scanner

- **`StreamHandle`** tem `injectMacro` com stack.
- **`FileStreamHandle` no browser:** carrega arquivo inteiro.
- **`mode` muda durante lexing.**

### 10.9 — ProjectFileScanner

- **~30 patterns.**
- **Modos** (`:tjp`, `:dqString`, etc.).
- **i18n** aplicado sobre `ID`.

### 10.10 — ProjectFileParser estrutura

- **`open` faz pré-scan para `language`.**
- **`setGlobalMacros`** define macros iniciais.
- **Helpers** de parsing.

### 10.11–10.14 — TjpSyntaxRules

- **~300 regras divididas em 4 blocos.**
- **`rule_reportableAttributes`** tem ~80 patterns.
- **Seguir a ordem do Ruby.**

### 10.15–10.16 — i18n

- **`LanguageRegistry` com 3 idiomas.**
- **~200 keywords canônicos por idioma.**
- **Unidades traduzidas.**

### 10.17 — Diretiva language

- **Pré-scan com regex.**
- **`rule_language`** consome a diretiva.

### 10.18 — AST equivalence

- **9 MWEs × 3 idiomas.**
- **Normalizar `name`.**

### 10.19 — Golden tests

- **~150 `Syntax/Correct` + ~50 `Syntax/Errors`.**
- **Comparação de sucesso/erro + errorId.**

### 10.20 — Verificação

- **Sem stubs além de `newRichText`.**
- **~300 regras.**
- **AST equivalence 100%.**

---

**Fim do arquivo de tarefas da Fase 10.**