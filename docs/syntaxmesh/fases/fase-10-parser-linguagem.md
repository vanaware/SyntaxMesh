# Fase 10 — Parser e Linguagem

> **Arquivo:** `docs/syntaxmesh/fases/fase-10-parser-linguagem.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 20–25 dias
> **Depende de:** Fases 2–9
> **Bloqueia:** Fases 11, 12, 14, 16, 18, 21

---

## 1. Contexto

Esta é a fase que **fecha o ciclo**: depois dela, o SyntaxMesh consegue ler um arquivo `.tjp` real e produzir um cronograma. É também a fase que dá suporte a **múltiplos idiomas**, uma das características mais inovadoras do projeto.

O parser do TaskJuggler é **diferente** dos parsers convencionais:

1. **FSM compilado dinamicamente.** O `TextParser` não é um parser LL(1) tradicional. Ele constrói uma **máquina de estados** (FSM) em runtime, a partir de regras declarativas (`rule_*`). Isso permite **estender a sintaxe** durante o parsing (ex: `extend task { ... }` adiciona novos keywords no meio do arquivo).

2. **Regras declarativas.** Cada regra é uma função `rule_<nome>` que chama `pattern([tokens], action)`. A `action` é chamada quando a regra casa. Não há `if/else` de tokens — o FSM resolve.

3. **3 tipos de tokens.** Literal (`_project`), variável (`$STRING`), referência (`!taskBody`). Cada um tem semântica própria no FSM.

4. **Scanner com modos.** O `ProjectFileScanner` muda de modo durante o lexing (`:tjp`, `:dqString`, `:macroCall`, `:szrString`, `:cppComment`). Isso permite sintaxe complexa (heredoc, macros `${N}`, comentários `/* */`).

5. **Macros `${N}`.** O scanner expande macros **antes** do parser ver os tokens. Macros podem ter argumentos, chamar outras macros, e são específicas do TaskJuggler.

6. **Includes aninhados.** `.tjp` pode incluir `.tji` com prefixos de escopo (`taskprefix`, `accountprefix`, etc.).

7. **Documentação embutida.** Cada `pattern` pode ter `doc()`, `arg()`, `example()`. Isso gera o manual do `tj3man` automaticamente. É usado por `SyntaxReference` (Fase 12/14).

**Nota sobre i18n:** esta é a extensão própria do SyntaxMesh. O TaskJuggler original só tem inglês. Nosso parser adiciona:

- `LanguageRegistry` com sinônimos canônicos.
- Diretiva `language "pt-BR"` no `.tjp`.
- AST resultante sempre usa keywords canônicas em inglês.

O parser Ruby tem ~300 regras em `TjpSyntaxRules.rb` (~7000 linhas). Dividimos em 4 subfases.

**Nota crítica:** o parser é **a porta de entrada**. Um bug aqui quebra tudo. Golden tests são obrigatórios e cobrem:
- Cada MWE parseado.
- AST equivalente entre en/pt-BR/es.
- Casos de erro do `TestSuite/Syntax/Errors/`.
- Casos válidos do `TestSuite/Syntax/Correct/`.

---

## 2. Objetivo

Ao final desta fase:

- `TextParser` FSM implementado (Pattern, Rule, State, StateTransition, StackElement, TokenDoc).
- `Scanner` genérico + `ProjectFileScanner` (lexer TJP).
- `ProjectFileParser` completo.
- `TjpSyntaxRules` completo (~300 regras).
- `LanguageRegistry` + `LanguageDefinition` (en, pt-BR, es).
- Diretiva `language "pt-BR"` funcional.
- AST equivalente entre idiomas.
- **≥ 400 testes unitários** + **≥ 100 golden tests** (cada MWE + Syntax/Correct + Syntax/Errors).
- ADR 020 e ADR 021 registrados.
- `deno task check-all` verde.

---

## 3. Referências TaskJuggler

### 3.1 Arquivos Ruby (fonte primária)

Todos em `docs/taskjuggler/lib/taskjuggler/`:

| Arquivo | Linhas aprox. | Complexidade | Prioridade |
|---|---|---|---|
| `TextParser.rb` | ~500 | **Altíssima** | **Crítica** |
| `TextParser/Pattern.rb` | ~350 | Alta | **Crítica** |
| `TextParser/Rule.rb` | ~250 | Alta | **Crítica** |
| `TextParser/State.rb` | ~250 | Alta | **Crítica** |
| `TextParser/Scanner.rb` | ~700 | **Altíssima** | **Crítica** |
| `TextParser/StackElement.rb` | ~100 | Média | **Crítica** |
| `TextParser/MacroTable.rb` | ~80 | Baixa | **Crítica** |
| `TextParser/TokenDoc.rb` | ~40 | Trivial | **Crítica** |
| `ProjectFileScanner.rb` | ~400 | **Altíssima** | **Crítica** |
| `ProjectFileParser.rb` | ~700 | **Altíssima** | **Crítica** |
| `TjpSyntaxRules.rb` | ~7000 | **Altíssima** | **Crítica** |

### 3.2 Blueprints (fonte primária)

| Documento | Seção | Uso |
|---|---|---|
| `docs/tj3-engine/01-blueprint-parser.md` | §2 Scanner (tokens, modos) | Lexer |
| `docs/tj3-engine/01-blueprint-parser.md` | §3 Parser (variáveis, métodos) | Parser |
| `docs/tj3-engine/01-blueprint-parser.md` | §4 TjpSyntaxRules | Gramática |
| `docs/tj3-engine/15-blueprint-others.md` | §1 TextParser | FSM |
| `docs/tj3-engine/15-blueprint-others.md` | §5 TaskDependency (revisitar) | — |

### 3.3 Casos de teste Ruby

- `docs/taskjuggler/test/TestSuite/Syntax/Correct/*.tjp` — arquivos válidos (~200).
- `docs/taskjuggler/test/TestSuite/Syntax/Errors/*.tjp` — arquivos com erro esperado (~50).
- `docs/Learning/mwe001-009/*.tjp` — os 9 MWEs.

### 3.4 Golden tests

- Script Ruby `parser-mwe*.rb` para cada MWE.
- Script Ruby `parser-syntax-correct.rb` itera `TestSuite/Syntax/Correct/`.
- Script Ruby `parser-syntax-errors.rb` itera `TestSuite/Syntax/Errors/` e coleta erros.

Cada script gera:
- AST serializado em JSON.
- Lista de erros (id, mensagem, linha).

Teste TS compara AST + erros.

---

## 4. Decisões de port (Ruby → TypeScript)

### 4.1 FSM com closure-based actions

Ruby: `pattern([...], lambda { ... })`. TS: `pattern([...], function(this: ProjectFileParser) { ... })`.

A `action` recebe `this` = `ProjectFileParser`. Não usar arrow functions (perdem `this`).

### 4.2 `@val` e `@sourceFileInfo` na action

Ruby: `@val[i]` acessa o i-ésimo valor capturado. Em TS: **mesmo padrão**, `this.val[i]` e `this.sourceFileInfo[i]`. Nomes públicos.

### 4.3 `method_missing` para `rule_*`

Ruby descobre regras via `methods.each`. TS: **registro explícito**. Cada `rule_*` é chamada uma vez em `initRules()`:

```ts
initRules(): void {
  this.rule_project();
  this.rule_task();
  // ... ~300 chamadas
}
```

**Alternativa:** usar `Reflect.ownKeys(this)` para descobrir `rule_*` automaticamente. Funciona, mas `initRules` explícito é mais claro e evita surpresas.

**Decisão:** **registro explícito** por meio de um array de nomes. Um helper faz o loop:

```ts
const RULE_NAMES = ['project', 'task', ...];
initRules(): void {
  for (const name of RULE_NAMES) {
    this.newRule(name);
    (this as any)[`rule_${name}`]();
  }
}
```

### 4.4 Scanner com modos

Ruby: `@scannerMode`, `@activePatterns`. TS: mesmos.

`StreamHandle` é classe; `FileStreamHandle` e `BufferStreamHandle` são subclasses. Em browser, `FileStreamHandle` usa `fetch` + `ReadableStream`.

**Decisão:** `FileStreamHandle` no browser carrega o arquivo inteiro em memória (via `fetch`). Sem streaming — arquivos TJP são pequenos.

### 4.5 Macros `${N}` — expansão no scanner

Replicar o algoritmo do `endMacroCall`:
1. Extrair prefixo (`preCall`).
2. Chamar `@macroTable.resolve(args, sfi)`.
3. `injectMacro` no `StreamHandle`.
4. Limpar stack de macros (`macroStack`).

### 4.6 Includes recursivos

`Scanner.include(filename, sfi, onEof)` empilha o arquivo no `@fileStack`. Ao chegar no EOF, chama `onEof` (que faz `popFileStack`).

Replicar com `Promise`? Não — síncrono. `FileStreamHandle` carrega o arquivo inteiro antes de começar.

### 4.7 `LanguageRegistry`

Componente novo. Arquitetura:

- `LanguageDefinition`: `{ id, name, keywords: Map<canonical, synonyms[]>, units: Map<canonical, synonyms[]> }`.
- `LanguageRegistry`: `Map<languageId, LanguageDefinition>`.
- `CanonicalKeyword`: tipo união com todos os keywords canônicos.
- `resolve(word: string, langId: string): canonical | null` — resolve sinônimo para canônico.
- `resolveUnit(unit: string, langId: string): canonical | null` — resolve unidade (`d`, `dia`, `day`).

**Estratégia de uso no scanner:** após reconhecer um token `ID`, se `language` está definido, verificar se é keyword canônica nessa língua; se sim, retornar `[KEYWORD, canonical]` em vez de `[ID, text]`.

### 4.8 Diretiva `language`

A diretiva `language "pt-BR"` deve ser detectada **antes** de qualquer outra keyword. Estratégia:

1. No `ProjectFileParser.open(file, master)`, fazer um **pré-scan** para detectar `language "xxx"`.
2. Se encontrada, setar `this.language = 'pt-BR'`.
3. Só então chamar `parse('project')`.

**Alternativa:** detectar durante o parsing. Complexo, porque keywords `project`, `task` etc. já viram tokens canônicos.

**Decisão:** pré-scan com regex no início do arquivo. Documentar em ADR 021.

### 4.9 Tokens: `:KEYWORD` vs `:ID`

Quando `language` ativo, tokens `ID` que são keywords viram `:KEYWORD` com valor canônico. Isso permite `pattern(['_project', ...])` continuar funcionando independente do idioma.

**Nota:** o scanner faz o mapeamento, não o parser.

### 4.10 `SourceFileInfo` (Fase 9)

Já existe. Reutilizar.

### 4.11 `TextParser.@rules` — `Map<string, Rule>`

Replicar.

### 4.12 `Pattern.tokens` — `Array<[type, name]>`

Replicar com `type: 'reference' | 'variable' | 'literal' | 'eof'`.

### 4.13 FSM — `parseFSM`

O algoritmo do `TextParser.parseFSM` é o **coração**. Replicar exatamente:
- Stack de `StackElement`.
- Loop SHIFT / REDUCE.
- `finishPattern(token)` retorna `true` no EOF.
- Recuperação de erros.

### 4.14 `updateParserTables` — geração de estados

Para cada `Rule`, chama `generateStates` → `addTransitionsToState`. Gera `Map<StateKey, State>`.

`StateKey` é `[rule, pattern|null, index]`.

### 4.15 `TextParser.limitTokenSet`

Limita os tokens aceitos (usado por RichText — Fase 12). Replicar.

### 4.16 Erros

`error(id, text, sfi)` e `warning(id, text, sfi)` delegam para `MessageHandler`. `TjException` é lançado para erros de parse.

### 4.17 `TjpSyntaxRules` — porte

~300 regras. Estrutura:

- `rule_projectHeader`, `rule_projectBody`, `rule_projectBodyAttributes`.
- `rule_taskHeader`, `rule_taskAttributes`, `rule_taskScenarioAttributes`.
- ... etc.

Cada regra vira um método de uma mixin/helper:

```ts
function rule_projectHeader(this: ProjectFileParser): void {
  this.pattern(['_project', '!optionalID', '$STRING', '!optionalVersion', '!interval'], function() {
    this.project = new Project(this.val[1] ?? null, this.val[2], this.val[3] ?? null);
    this.project.set('start', this.val[4].start);
    this.project.set('end', this.val[4].end);
    this.projectId = this.val[1];
    this.setGlobalMacros();
    this.property = null;
    this.reportCounter = 0;
  });
  this.arg(2, 'name', 'The name of the project');
}
```

**Organização:** as ~300 regras são distribuídas em 4 arquivos (subfases 14.11–14.14).

### 4.18 Documentação embutida

`doc()`, `arg()`, `example()`, `also()`, `level()`. Usado por `SyntaxReference` (Fase 14). Nesta fase, **coletamos** as informações nos `Pattern` objects mas não geramos HTML.

### 4.19 `KeywordArray`

Fase 5 já mencionou. Replicar como `string[]` + `keywordListIncludes`.

### 4.20 `newRichText` no parser

O parser chama `newRichText(text, sfi, tokenSet)`. **Fase 12** implementa. Nesta fase, é um wrapper que produz um `RichTextIntermediate` fake (via interface `RichTextFactory`).

---

## 5. Subfases detalhadas

A fase é organizada em **5 blocos**:

**Bloco A — Infraestrutura do parser** (14.0–14.6): ADR, TokenDoc, Macro, StackElement, State, Pattern, Rule.
**Bloco B — FSM e Scanner** (14.7–14.9): TextParser FSM, Scanner, ProjectFileScanner.
**Bloco C — ProjectFileParser e TjpSyntaxRules** (14.10–14.14): parser + ~300 regras.
**Bloco D — i18n** (14.15–14.18): LanguageRegistry, idiomas, diretiva, AST equivalence.
**Bloco E — Golden tests** (14.19).

---

### Bloco A — Infraestrutura do parser

---

### 10.0 — ADRs 020 e 021

#### Contexto

Duas decisões arquiteturais críticas desta fase:

1. **FSM do TextParser** — manter como no Ruby (compilado em runtime) vs. portar para parser combinators/recursive descent.
2. **i18n de keywords** — como injetar sinônimos sem tocar no parser.

#### Objetivo

Criar:
- `docs/syntaxmesh/decisoes/020-fsm-textparser.md`.
- `docs/syntaxmesh/decisoes/021-i18n-keywords.md`.

#### Arquivos

- `docs/syntaxmesh/decisoes/020-fsm-textparser.md` (novo)
- `docs/syntaxmesh/decisoes/021-i18n-keywords.md` (novo)
- `docs/syntaxmesh/decisoes/README.md` (atualizar)

#### Requisitos

**ADR 020 — FSM do TextParser:**

- [ ] **Contexto:** o parser do TJ é FSM compilado em runtime.
- [ ] **Decisão:** manter fielmente (não portar para parser combinators).
- [ ] **Alternativas:** recursive descent, PEG, parser combinators.
- [ ] **Consequências:** fidelidade absoluta (suporta `extend`); complexidade alta.

**ADR 021 — i18n de keywords:**

- [ ] **Contexto:** TJ só tem inglês. SyntaxMesh quer pt-BR, es.
- [ ] **Decisão:**
  - `LanguageRegistry` com sinônimos canônicos.
  - Scanner mapeia sinônimos → canônicos.
  - Diretiva `language "xxx"` via pré-scan com regex.
  - AST usa apenas canônicos.
- [ ] **Alternativas:** parser separado por idioma (duplicação), keywords nativas no parser (complexo).
- [ ] **Consequências:** i18n transparente; AST equivalente entre idiomas.

- [ ] Tabela em `README.md` atualizada.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TextParser.rb`.
- `docs/syntaxmesh/04-linguagem-multilingue.md`.
- Seções 4.7, 4.8.

#### Fora de escopo

- Implementação.

#### Critério de aceite

- ADRs 020 e 021 criados.
- Tabela atualizada.

---

### 10.1 — `TokenDoc`

#### Contexto

`TokenDoc` documenta um argumento de pattern. É usado por `SyntaxReference` (Fase 14) para gerar o manual.

#### Objetivo

Implementar `TokenDoc`.

#### Arquivos

- `packages/parser/src/lexer/token-doc.ts`
- `packages/parser/tests/token-doc_test.ts`

#### Requisitos

- [ ] `class TokenDoc`:
  - `name: string | null`
  - `text: string | null`
  - `typeSpec: string | null`
  - `pattern: Pattern | null`
- [ ] Constructor `(name: string | null, arg: string | Pattern)`:
  - Se `arg` é string, `text = arg`.
  - Senão, `pattern = arg`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TextParser/TokenDoc.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `token-doc_test.ts`:
  - `it("com texto")`.
  - `it("com pattern")`.

---

### 10.2 — `Macro` + `MacroTable`

#### Contexto

Macros `${N}` são expandidas pelo scanner. `MacroTable` guarda as definições.

#### Objetivo

Implementar `Macro` + `MacroTable`.

#### Arquivos

- `packages/parser/src/lexer/macro-table.ts`
- `packages/parser/tests/macro-table_test.ts`

#### Requisitos

**`Macro`:**

- [ ] `class Macro`:
  - `readonly name: string`
  - `readonly value: string`
  - `readonly sourceFileInfo: SourceFileInfo`

**`MacroTable`:**

- [ ] `private macros: Map<string, Macro>`.
- [ ] `add(macro): void`.
- [ ] `clear(): void`.
- [ ] `include?(name): boolean`.
- [ ] `resolve(args: string[], sfi: SourceFileInfo): [Macro, string] | null`:
  - `name = args[0]`.
  - Se `name[0] === '?'`, remove o `?` e retorna `null` se não existe.
  - Se não existe, retorna `null`.
  - `resolved = macro.value`.
  - Para cada arg (a partir de 1): substituir `${i}` por `arg`.
  - Substituir `$${` por `${`.
  - Retorna `[macro, resolved]`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TextParser/MacroTable.rb`.

#### Critério de aceite

```ts
const mt = new MacroTable();
mt.add(new Macro("FOO", "Hello ${1}!", sfi));
const [macro, resolved] = mt.resolve(["FOO", "World"], sfi)!;
assertEquals(resolved, "Hello World!");
```

#### Testes

- `macro-table_test.ts`:
  - `it("add/include")`.
  - `it("resolve sem args")`.
  - `it("resolve com args")`.
  - `it("resolve macro inexistente = null")`.
  - `it("resolve com ? retorna null se não existe")`.
  - `it("escape $${ vira ${")`.

---

### 10.3 — `StackElement`

#### Contexto

Elemento da stack do FSM. Guarda valores capturados pela action.

#### Objetivo

Implementar `StackElement` + `TextParserResultArray`.

#### Arquivos

- `packages/parser/src/parser/stack-element.ts`
- `packages/parser/tests/stack-element_test.ts`

#### Requisitos

**`TextParserResultArray`:**

- [ ] `class TextParserResultArray<T> extends Array<T>`:
  - Sobrescrever `push` para concatenar arrays aninhados.

**`StackElement`:**

- [ ] `val: unknown[]`
- [ ] `sourceFileInfo: Array<SourceFileInfo | null>`
- [ ] `firstSourceFileInfo: SourceFileInfo | null`
- [ ] `private position: number`
- [ ] `function: ((...args: unknown[]) => unknown) | null`
- [ ] `state: State | null`
- [ ] Constructor `(fn, state)`.
- [ ] `insert(index, val, sfi, multiValue): void`.
- [ ] `store(val, sfi): void`.
- [ ] `each(): IterableIterator<unknown>`.
- [ ] `length(): number`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TextParser/StackElement.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `stack-element_test.ts`:
  - `it("insert")`.
  - `it("insert multiValue concatena")`.
  - `it("firstSourceFileInfo")`.
  - `it("store")`.

---

### 10.4 — `StateTransition` + `State`

#### Contexto

FSM states.

#### Objetivo

Implementar as 2 classes.

#### Arquivos

- `packages/parser/src/parser/state.ts`
- `packages/parser/tests/state_test.ts`

#### Requisitos

**`StateTransition`:**

- [ ] `tokenType: string | symbol`
- [ ] `state: State`
- [ ] `stateStack: State[]`
- [ ] `loopBack: boolean`
- [ ] Constructor `(descriptor: [type, name], state, stateStack, loopBack)`.

**`State`:**

- [ ] `rule: Rule`
- [ ] `pattern: Pattern | null`
- [ ] `index: number`
- [ ] `transitions: Map<string, StateTransition>`
- [ ] `noReduce: boolean`
- [ ] Constructor `(rule, pattern?, index = 0)`.
- [ ] `addTransitions(states: Map<StateKey, State>, rules: Map<string, Rule>): void`.
- [ ] `addTransition(token, nextState, stateStack, loopBack): void`.
- [ ] `transition(token): StateTransition | null`.
- [ ] `expectedTokens(): string[]`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TextParser/State.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `state_test.ts`:
  - `it("addTransition detecta ambíguo")`.
  - `it("transition por ID e literal")`.
  - `it("expectedTokens")`.

---

### 10.5 — `Pattern`

#### Contexto

`Pattern` descreve um padrão de tokens. Cada regra pode ter múltiplos patterns.

#### Objetivo

Implementar `Pattern` completo.

#### Arquivos

- `packages/parser/src/parser/pattern.ts`
- `packages/parser/tests/pattern_test.ts`

#### Requisitos

**`Pattern`:**

- [ ] `keyword: string | null`
- [ ] `doc: string | null`
- [ ] `supportLevel: 'experimental' | 'beta' | 'supported' | 'deprecated' | 'removed'`
- [ ] `seeAlso: string[]`
- [ ] `exampleFile: string | null`
- [ ] `exampleTag: string | null`
- [ ] `tokens: Array<[type, name]>`
- [ ] `function: ((this: unknown) => unknown) | null`
- [ ] `args: Array<TokenDoc | null>`
- [ ] `lastSyntaxToken: number`
- [ ] `transitions: []` (não usado — está em State)
- [ ] Constructor `(tokens, fn)` — parse tokens com prefixo `!$_`.
- [ ] `generateStates(rule, rules): State[]`.
- [ ] `addTransitionsToState(states, rules, stateStack, sourceState, destRule, destIndex, loopBack): void`.
- [ ] `setDoc(keyword, doc): void`.
- [ ] `setArg(idx, doc): void`.
- [ ] `setLastSyntaxToken(idx): void`.
- [ ] `setSupportLevel(level): void`.
- [ ] `setSeeAlso(also): void`.
- [ ] `setExample(file, tag): void`.
- [ ] `get(i): unknown`.
- [ ] `each(): IterableIterator<[type, name]>`.
- [ ] `empty(): boolean`.
- [ ] `length(): number`.
- [ ] `optional?(rules): boolean`.
- [ ] `terminalSymbol?(i): boolean`.
- [ ] `terminalTokens(rules, index): Array<[string, Pattern]>`.
- [ ] `to_syntax(argDocs, rules, skip): string`.
- [ ] `to_syntax_r(stack, argDocs, rules, skip): string`.
- [ ] `to_s(): string`.
- [ ] `private optionalToken(index, rules): boolean`.
- [ ] `private addArgDoc(argDocs, argDoc): void`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TextParser/Pattern.rb` — arquivo completo.

#### Critério de aceite

Análogo.

#### Testes

- `pattern_test.ts`:
  - `it("constructor rejeita tipo inválido")`.
  - `it("generateStates")`.
  - `it("setDoc/setArg")`.
  - `it("optional?")`.
  - `it("terminalTokens")`.
  - `it("to_syntax")`.

---

### 10.6 — `Rule`

#### Contexto

Cada `Rule` tem nome único + lista de `Pattern`s.

#### Objetivo

Implementar `Rule`.

#### Arquivos

- `packages/parser/src/parser/rule.ts`
- `packages/parser/tests/rule_test.ts`

#### Requisitos

- [ ] `class Rule`:
  - `name: string`
  - `patterns: Pattern[]`
  - `optional: boolean`
  - `repeatable: boolean`
  - `keyword: string | null`
  - `doc: string | null`
  - `transitiveOptional: boolean | null`
- [ ] Constructor `(name)`.
- [ ] `flushCache(): void`.
- [ ] `addPattern(pattern): void`.
- [ ] `include?(token): boolean`.
- [ ] `setOptional(): void`.
- [ ] `optional?(rules): boolean`.
- [ ] `generateStates(rules): State[]`.
- [ ] `addTransitionsToState(states, rules, stateStack, sourceState, loopBack): void`.
- [ ] `setRepeatable(): void`.
- [ ] `setDoc(keyword, doc): void`.
- [ ] `setArg(idx, doc): void`.
- [ ] `setLastSyntaxToken(idx): void`.
- [ ] `setSupportLevel(level): void`.
- [ ] `setSeeAlso(also): void`.
- [ ] `setExample(file, tag): void`.
- [ ] `pattern(idx): Pattern`.
- [ ] `to_syntax(stack, docs, rules, skip): string`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TextParser/Rule.rb`.

#### Critério de aceite

Análogo.

#### Testes

- `rule_test.ts`:
  - `it("addPattern")`.
  - `it("optional? com cache")`.
  - `it("generateStates")`.
  - `it("setRepeatable")`.
  - `it("to_syntax")`.

---

### Bloco B — FSM e Scanner

---

### 10.7 — `TextParser` FSM (core)

#### Contexto

O FSM que orquestra tudo. É o método `parse()` que o `ProjectFileParser` chama.

#### Objetivo

Implementar `TextParser`.

#### Arquivos

- `packages/parser/src/parser/text-parser.ts`
- `packages/parser/tests/text-parser_test.ts`

#### Requisitos

- [ ] `class TextParser`:
  - `rules: Map<string, Rule>`
  - `variables: string[]`
  - `blockedVariables: Set<string>`
  - `cr: Rule | null`
  - `states: Map<StateKey, State>`
  - `stack: StackElement[] | null`
  - `expectedTokens: string[]`
  - `scanner: ScannerLike | null`
  - `val: unknown[]`
  - `sourceFileInfo: Array<SourceFileInfo | null>`
- [ ] Constructor `()`.
- [ ] `limitTokenSet(tokenSet: string[] | null): void`.
- [ ] `initRules(): void` — **abstrato** (subclasse implementa).
- [ ] `newRule(name: string): void`.
- [ ] `pattern(tokens: string[], fn?: Function): void`.
- [ ] `optional(): void`.
- [ ] `repeatable(): void`.
- [ ] `updateParserTables(): void`.
- [ ] `parse(ruleName: string): unknown`.
- [ ] `sourceFileInfo(): SourceFileInfo | null`.
- [ ] `error(id, text, sfi?, data?): void`.
- [ ] `warning(id, text, sfi?, data?): void`.
- [ ] Private `checkRule(rule): void`.
- [ ] Private `parseFSM(rule): unknown`.
- [ ] Private `finishPattern(token): boolean`.
- [ ] Private `dumpStack(): void`.
- [ ] Private `checkForOldSyntax(state, token): void`.
- [ ] Private `saveFsmStack()`, `restoreFsmStack()`.
- [ ] Private `getNextToken(): Token`.

**Nota:** `nextToken()` e `returnToken()` são **abstratos** — a subclasse implementa.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TextParser.rb` — arquivo completo.

#### Critério de aceite

```ts
class TestParser extends TextParser {
  nextToken(): Token { ... }
  returnToken(token): void { ... }
  initRules(): void {
    this.newRule('test');
    this.pattern(['_foo', '$INTEGER'], function() { return this.val[1]; });
  }
}

const p = new TestParser();
p.updateParserTables();
assertEquals(p.parse('test'), 42);
```

#### Testes

- `text-parser_test.ts`:
  - `it("parse pattern simples")`.
  - `it("parse pattern com referência")`.
  - `it("parse pattern opcional")`.
  - `it("parse pattern repeatable")`.
  - `it("detecta ambiguous transition")`.
  - `it("erro em token inesperado")`.

---

### 10.8 — `Scanner` (genérico)

#### Contexto

Scanner base. Gerencia modos, includes, macros.

#### Objetivo

Implementar `Scanner` + `StreamHandle` + subclasses.

#### Arquivos

- `packages/parser/src/lexer/scanner.ts`
- `packages/parser/src/lexer/stream-handle.ts`
- `packages/parser/tests/scanner_test.ts`

#### Requisitos

**`Scanner`:**

- [ ] `masterFile: string`
- [ ] `messageHandler: MessageHandlerLike`
- [ ] `log: LogLike`
- [ ] `macroTable: MacroTable`
- [ ] `cf: StreamHandle | null`
- [ ] `fileStack: Array<[StreamHandle, Token | null, (() => void) | null]>`
- [ ] `finishLastFile: boolean`
- [ ] `fileNameIsBuffer: boolean`
- [ ] `startOfToken: SourceFileInfo | null`
- [ ] `lineDelta: number`
- [ ] `patternsByMode: Map<string, Array<[type, RegExp, Function | null]>>`
- [ ] `scannerMode: string`
- [ ] `defaultMode: string`
- [ ] `activePatterns: Array<[type, RegExp, Function | null]>`
- [ ] Constructor `(masterFile, log, tokenPatterns, defaultMode)`.
- [ ] `addPattern(type, regExp, mode, postProc?): void`.
- [ ] `set mode(mode: string)`.
- [ ] `open(fileNameIsBuffer = false): void`.
- [ ] `close(): void`.
- [ ] `include(fileName, sfi, onEof?): string`.
- [ ] `sourceFileInfo(): SourceFileInfo`.
- [ ] `fileName(): string`.
- [ ] `lineNo(): number`.
- [ ] `columnNo(): number`.
- [ ] `line(): string`.
- [ ] `nextToken(): Token`.
- [ ] `returnToken(token): void`.
- [ ] `addMacro(macro): void`.
- [ ] `macroDefined?(name): boolean`.
- [ ] `expandMacro(prefix, args, callLength): void`.
- [ ] `error(id, text, sfi?, data?): void`.
- [ ] `warning(id, text, sfi?, data?): void`.
- [ ] Private `scanToken(): Token`.
- [ ] Private `message(type, id, text, sfi, data): void`.

**`StreamHandle`:**

- [ ] `fileName`, `log`, `textScanner`, `stream` (StringIO-like), `scanner` (RegExp scanner), `macroStack`, `nextMacroEnd`.
- [ ] `error(id, message)`, `close()`, `injectText(text, callLength)`, `injectMacro(macro, args, text, callLength)`, `readyNextLine()`, `scan(re)`, `cleanupMacroStack()`, `peek(n)`, `eof()`, `dirname()`, `lineNo()`, `line()`.

**`FileStreamHandle`:**

- [ ] Carrega o arquivo inteiro em memória.
- [ ] No browser: `await fetch(fileName).then(r => r.text())` — mas **síncrono**? Não. **Aceitar que `Scanner.open` é `async`?** Não. **Decisão:** o caller carrega o texto antes e passa via `masterFile` como conteúdo (`fileNameIsBuffer = true`).

**`BufferStreamHandle`:**

- [ ] Opera sobre string.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TextParser/Scanner.rb` — arquivo completo.
- `docs/tj3-engine/01-blueprint-parser.md` — §2.

#### Critério de aceite

Análogo.

#### Testes

- `scanner_test.ts`:
  - `it("tokenize buffer simples")`.
  - `it("modo dqString")`.
  - `it("modo szrString")`.
  - `it("macro expansion")`.
  - `it("include")`.

---

### 10.9 — `ProjectFileScanner`

#### Contexto

Lexer TJP específico. Define os patterns.

#### Objetivo

Implementar `ProjectFileScanner`.

#### Arquivos

- `packages/parser/src/lexer/project-file-scanner.ts`
- `packages/parser/tests/project-file-scanner_test.ts`

#### Requisitos

- [ ] `class ProjectFileScanner extends Scanner`:
  - Constructor `(masterFile, log, language: string = 'en')`.
  - Define todos os token patterns:
    - `nil` para espaços, comentários (`#`, `//`, `/* */`).
    - Macro call `${...}`.
    - Env var `$(...)`.
    - `ID_WITH_COLON`, `ABSOLUTE_ID`, `ID`.
    - `DATE`, `TIME`, `FLOAT`, `INTEGER`.
    - Strings `"..."`, `'...'`, `-8<- ... ->8-`.
    - `MACRO` (`[...]`).
    - `LITERAL` (`<=`, `>=`, `!=`, single chars).
  - **Extensão i18n:** se `language !== 'en'`, aplicar `LanguageRegistry.resolve` sobre tokens `ID`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ProjectFileScanner.rb` — arquivo completo.
- `docs/tj3-engine/01-blueprint-parser.md` — §2.

#### Critério de aceite

```ts
const scanner = new ProjectFileScanner("project prj \"Test\" 2026-01-01 - 2026-12-31 {}", log);
scanner.open(true);
assertEquals(scanner.nextToken()[0], 'KEYWORD'); // 'project' é keyword
// ...
```

#### Testes

- `project-file-scanner_test.ts`:
  - `it("tokenize keyword")`.
  - `it("tokenize ID")`.
  - `it("tokenize ABSOLUTE_ID")`.
  - `it("tokenize date")`.
  - `it("tokenize time")`.
  - `it("tokenize string")`.
  - `it("tokenize heredoc")`.
  - `it("tokenize macro call")`.
  - `it("tokenize env var")`.
  - `it("tokenize comentário")`.
  - `it("tokenize macro def")`.
  - `it("i18n: keyword pt-BR vira canônica")`.

---

### Bloco C — ProjectFileParser e TjpSyntaxRules

---

### 10.10 — `ProjectFileParser` (estrutura)

#### Contexto

Especializa `TextParser` para TJP. Define `@variables`, `open`, `close`, helpers.

#### Objetivo

Implementar a **estrutura** (não as regras).

#### Arquivos

- `packages/parser/src/parser/project-file-parser.ts`
- `packages/parser/tests/project-file-parser-structure_test.ts`

#### Requisitos

- [ ] `class ProjectFileParser extends TextParser`:
  - `variables = ['INTEGER', 'FLOAT', 'DATE', 'TIME', 'STRING', 'LITERAL', 'ID', 'ID_WITH_COLON', 'ABSOLUTE_ID', 'MACRO', 'KEYWORD']`.
  - `project: Project | null`
  - `property: PropertyTreeNode | null`
  - `scenarioIdx: number`
  - `idStack: string[]`
  - `fileStack: Array<Record<string, string>>`
  - `fileStackVariables: string[]`
  - `taskprefix`, `resourceprefix`, `accountprefix`, `reportprefix`: string
  - `allocate: Allocation | null`
  - `booking: Booking | null`
  - `journalEntry: JournalEntry | null`
  - `navigator: Navigator | null`
  - `limits: Limits | null`
  - `limitInterval: ScoreboardInterval | null`
  - `limitResources: Resource[]`
  - `shiftAssignments: ShiftAssignments | null`
  - `column: TableColumnDefinition | null`
  - `timeSheet: TimeSheet | null`
  - `timeSheetRecord: TimeSheetRecord | null`
  - `sheetAuthor: Resource | null`
  - `sheetStart: TjTime | null`
  - `sheetEnd: TjTime | null`
  - `reportCounter: number`
  - `projectId: string`
  - `sortProperty: 'task' | 'resource' | 'account' | null`
  - `ruleToExtend: Rule | null`
  - `ruleToExtendWithScenario: Rule | null`
  - `propertySet: PropertySet | null`
  - `language: string` (novo — i18n)
- [ ] Constructor `()`.
- [ ] `open(file: string, master: boolean, fileNameIsBuffer = false): void`.
- [ ] `close(): void`.
- [ ] `nextToken(): Token`.
- [ ] `returnToken(token): void`.
- [ ] `setGlobalMacros(): void`.
- [ ] `parseReportAttributes(report: Report, attributes: string): void`.
- [ ] Private helpers: `weekDay`, `checkContainer`, `checkInterval`, `checkBooking`, `extendPropertySetDefinition`, `newRichText`, `newReport`, `setLimit`, `setDurationAttribute`, `allOrNothingListRule`, `listRule`, `commaListRule`, `optionsRule`, `singlePattern`, `doc`, `descr`, `arg`, `lastSyntaxToken`, `level`, `also`, `example`, `columnTitle`, `initFileStack`, `pushFileStack`, `popFileStack`, `appendScListAttribute`.
- [ ] **Extensão i18n:** `detectLanguage(fileContent: string): string` — pré-scan com regex.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/ProjectFileParser.rb` — arquivo completo.
- `docs/tj3-engine/01-blueprint-parser.md` — §3.

#### Critério de aceite

Análogo.

#### Testes

- `project-file-parser-structure_test.ts`:
  - `it("constructor inicializa")`.
  - `it("open/close")`.
  - `it("setGlobalMacros")`.
  - `it("detectLanguage")`.

---

### 10.11 — `TjpSyntaxRules` — bloco 1 (project + task)

#### Contexto

~300 regras. Dividimos em 4 blocos. Cada bloco é uma **mixin** que adiciona métodos `rule_*` a `ProjectFileParser`.

#### Objetivo

Implementar ~80 regras do bloco 1: `project`, `task`, `optionalID`, `date`, `interval`, `duration`, `number`, `string`, `id`, `taskId`, etc.

#### Arquivos

- `packages/parser/src/parser/rules/rules-project.ts`
- `packages/parser/src/parser/rules/rules-task.ts`
- `packages/parser/src/parser/rules/rules-common.ts`
- `packages/parser/tests/rules-project_test.ts`
- `packages/parser/tests/rules-task_test.ts`

#### Requisitos

**Regras obrigatórias (bloco 1):**

- `rule_project`, `rule_projectHeader`, `rule_projectBody`, `rule_projectBodyAttributes`, `rule_projectProlog`, `rule_projectDeclaration`.
- `rule_task`, `rule_taskHeader`, `rule_taskBody`, `rule_taskAttributes`, `rule_taskScenarioAttributes`, `rule_taskId`, `rule_taskIdUnverifd`, `rule_absoluteTaskId`, `rule_taskList`.
- `rule_optionalID`, `rule_optionalVersion`, `rule_optionalMinus`, `rule_optionalPercent`, `rule_optionalScenarioIdCol`.
- `rule_date`, `rule_dateCalcedOrNot`, `rule_valDate`, `rule_interval`, `rule_intervalOrDate`, `rule_intervalEnd`, `rule_intervalOptionalEnd`, `rule_intervalOptional`, `rule_intervals`, `rule_intervalsOptional`, `rule_valInterval`, `rule_valIntervalOrDate`, `rule_valIntervals`.
- `rule_number`, `rule_valNumber`, `rule_nonZeroWorkingDuration`, `rule_workingDuration`, `rule_workingDurationPercent`, `rule_durationUnit`, `rule_durationUnitOrPercent`, `rule_calendarDuration`, `rule_intervalDuration`.
- `rule_optionalID`, `rule_optionalMinus`.
- `rule_idOrAbsoluteId`, `rule_relativeId`, `rule_moreBangs`.
- `rule_scenarioId`, `rule_scenarioIdx`, `rule_scenarioIdList`, `rule_moreScnarioIdList`, `rule_scenarioIdCol`.
- `rule_yesNo`, `rule_allOrNone`.
- `rule_weekDay`, `rule_weekDayInterval`, `rule_weekDayIntervalEnd`, `rule_listOfDays`, `rule_moreListOfDays`.
- `rule_timeInterval`, `rule_listOfTimes`, `rule_moreTimeIntervals`.
- `rule_plusOrMinus`.
- `rule_includeFile`, `rule_includeFileName`, `rule_includeAttributes`, `rule_includeAttributesBody`, `rule_includeProperties`, `rule_includePropertiesFile`, `rule_projectBodyInclude`, `rule_prologInclude`.
- `rule_macro`, `rule_supplement`, `rule_supplementTask`.

**Regras de task (bloco 1):**

- `rule_taskDep`, `rule_taskDepHeader`, `rule_taskDepBody`, `rule_taskDepAttributes`, `rule_taskDepId`, `rule_taskDepList`, `rule_moreDepTasks`.
- `rule_taskPred`, `rule_taskPredHeader`, `rule_taskPredList`, `rule_morePredTasks`.
- `rule_taskBooking`, `rule_taskBookingHeader`, `rule_bookingBody`, `rule_bookingAttributes`.
- `rule_taskShiftAssignments`, `rule_taskShiftsAssignments`, `rule_shiftAssignments`, `rule_shiftAssignment`, `rule_moreShiftAssignments`.

**Cada regra:**

- [ ] Chama `this.pattern([...], function() { ... })`.
- [ ] Pode ter `this.doc(...)`, `this.arg(...)`, `this.example(...)`, `this.also(...)`, `this.level(...)`.
- [ ] Segue o Ruby **fielmente**.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb` — bloco de `rule_project` até `rule_task`.

#### Fora de escopo

- Reports, tracking, financial, resource, account, shift — blocos 2, 3, 4.

#### Critério de aceite

```ts
const parser = new ProjectFileParser();
parser.open("project prj \"Test\" 1.0 2026-01-01 - 2026-12-31 { ... }", true, true);
const project = parser.parse('project');
assert(project instanceof Project);
```

#### Testes

- `rules-project_test.ts`:
  - `it("parse project minimal")`.
  - `it("parse project com timezone")`.
  - `it("parse project com workinghours")`.
  - `it("parse project com include")`.
- `rules-task_test.ts`:
  - `it("parse task minimal")`.
  - `it("parse task com depends")`.
  - `it("parse task com effort")`.
  - `it("parse task com allocate")`.
  - `it("parse task com milestone")`.
  - `it("parse task com shift")`.
  - `it("parse task com booking")`.

---

### 10.12 — `TjpSyntaxRules` — bloco 2 (resource + account + shift + scenario)

#### Objetivo

Implementar ~60 regras de resource, account, shift, scenario.

#### Arquivos

- `packages/parser/src/parser/rules/rules-resource.ts`
- `packages/parser/src/parser/rules/rules-account.ts`
- `packages/parser/src/parser/rules/rules-shift.ts`
- `packages/parser/src/parser/rules/rules-scenario.ts`

#### Requisitos

**Resource:**

- `rule_resource`, `rule_resourceHeader`, `rule_resourceBody`, `rule_resourceAttributes`, `rule_resourceScenarioAttributes`, `rule_resourceId`, `rule_resourceLeafList`, `rule_resourceList`, `rule_moreResources`, `rule_moreResourceLeafList`, `rule_leafResourceId`, `rule_undefResourceId`.
- `rule_bookingList`, `rule_resourceBooking`, `rule_resourceBookingHeader`, `rule_resourceShiftAssignments`, `rule_resourceShiftsAssignments`.
- `rule_leaves`, `rule_leaveList`, `rule_leave`, `rule_leaveType`, `rule_leaveName`, `rule_leaveAllowances`, `rule_leaveAllowance`, `rule_leaveAllowanceList`, `rule_moreLeaveAllowanceList`.
- `rule_workinghours`, `rule_workinghoursResource`, `rule_workinghoursProject`, `rule_workinghoursShift`.

**Account:**

- `rule_account`, `rule_accountHeader`, `rule_accountBody`, `rule_accountAttributes`, `rule_accountScenarioAttributes`, `rule_accountId`, `rule_accountCredits`, `rule_accountCredit`, `rule_moreAccountCredits`.

**Shift:**

- `rule_shift`, `rule_shiftHeader`, `rule_shiftBody`, `rule_shiftAttributes`, `rule_shiftScenarioAttributes`, `rule_shiftId`.

**Scenario:**

- `rule_scenario`, `rule_scenarioHeader`, `rule_scenarioBody`, `rule_scenarioAttributes`.

**Extend:**

- `rule_extendProperty`, `rule_extendPropertyId`, `rule_extendBody`, `rule_extendAttributes`, `rule_extendOptions`, `rule_extendOptionsBody`, `rule_extendId`.

**ChargeSet:**

- `rule_chargeset`, `rule_chargeSetItem`, `rule_moreChargeSetItems`, `rule_optionalPercent`.

**Charge:**

- `rule_charge` (via `_charge !number !chargeMode`), `rule_chargeMode`.

**Limits:**

- `rule_limits`, `rule_limitsHeader`, `rule_limitsBody`, `rule_limitsAttributes`, `rule_limitsAttributesBody`, `rule_limitAttributes`, `rule_limitAttributesBody`, `rule_limitValue`, `rule_moreLimitAttributes`.

**Flags:**

- `rule_flags`, `rule_flagList`, `rule_moreFlagList`, `rule_flag`, `rule_declareFlagList`, `rule_moreDeclareFlagList`.

**Fail/warn:**

- `rule_fail`, `rule_warn`.

**Supplement:**

- `rule_supplementAccount`, `rule_supplementResource`, `rule_supplementTask`.

**Todos com `pattern`, `doc`, `arg`, `example`.**

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb` — blocos correspondentes.

#### Critério de aceite

Análogo.

#### Testes

- 4 arquivos de teste, um por entidade.
- Cada entidade com 3–5 testes.

---

### 10.13 — `TjpSyntaxRules` — bloco 3 (reports)

#### Objetivo

Implementar ~80 regras de reports (task, resource, account, text, trace, export, ical, niku, timesheet, statussheet, tagfile).

#### Arquivos

- `packages/parser/src/parser/rules/rules-reports.ts`
- `packages/parser/src/parser/rules/rules-columns.ts`
- `packages/parser/tests/rules-reports_test.ts`
- `packages/parser/tests/rules-columns_test.ts`

#### Requisitos

**Report headers:**

- `rule_taskReport`, `rule_taskReportHeader`, `rule_resourceReport`, `rule_resourceReportHeader`, `rule_accountReport`, `rule_accountReportHeader`, `rule_textReport`, `rule_textReportHeader`, `rule_traceReport`, `rule_traceReportHeader`, `rule_export`, `rule_exportHeader`, `rule_iCalReport`, `rule_iCalReportHeader`, `rule_nikuReport`, `rule_nikuReportHeader`, `rule_tagfile`, `rule_tagfileHeader`, `rule_ssReportHeader`, `rule_tsReportHeader`.

**Report body / attrs:**

- `rule_reportBody`, `rule_reportAttributes`, `rule_reportEnd`, `rule_reportStart`, `rule_reportPeriod`, `rule_reportTitle`, `rule_reportId`, `rule_reportIdUnverifd`, `rule_reportName`.
- `rule_hidetask`, `rule_hideresource`, `rule_hideaccount`, `rule_hidejournalentry`.
- `rule_rolluptask`, `rule_rollupresource`, `rule_rollupaccount`.
- `rule_sortTasks`, `rule_sortResources`, `rule_sortAccounts`, `rule_sortCriteria`, `rule_sortCriterium`, `rule_sortTree`, `rule_sortNonTree`, `rule_moreSortCriteria`, `rule_sortTasksKeyword`, `rule_sortResourcesKeyword`, `rule_sortAccountsKeyword`, `rule_sortJournalEntries`, `rule_journalSortCriteria`, `rule_journalSortCriterium`.
- `rule_columns`, `rule_moreColumnDef`, `rule_columnDef`, `rule_columnId`, `rule_columnBody`, `rule_columnOptions`, `rule_columnTitle`.
- `rule_reportableAttributes` (grande enum de colunas).
- `rule_outputFormats`, `rule_moreOutputFormats`, `rule_outputFormat`, `rule_exportFormats`, `rule_moreExportFormats`, `rule_exportFormat`.
- `rule_headline`, `rule_caption`, `rule_header`, `rule_footer`, `rule_center`, `rule_left`, `rule_right`, `rule_epilog`, `rule_prolog`.
- `rule_numberFormat`, `rule_currencyFormat`.
- `rule_loadunit`, `rule_loadunitName`.
- `rule_reportProperties`, `rule_reportPropertiesBody`, `rule_reportPropertiesFile`.
- `rule_journalReportAttributes`, `rule_journalReportMode`.
- `rule_exportAttributes`, `rule_exportBody`, `rule_exportDefinitions`, `rule_exportableTaskAttributes`, `rule_exportableResourceAttributes`.
- `rule_nikuReportAttributes`, `rule_nikuReportBody`.
- `rule_iCalReportAttributes`, `rule_iCalReportBody`.
- `rule_tagfileAttributes`, `rule_tagfileBody`.
- `rule_ssReportAttributes`, `rule_ssReportBody`, `rule_statusSheetReport`, `rule_ssStatus`, `rule_ssStatusHeader`, `rule_ssStatusBody`, `rule_ssStatusAttributes`.
- `rule_tsReportAttributes`, `rule_tsReportBody`.

**Columns:**

- `rule_hAlignment`, `rule_listType`, `rule_chartScale`, `rule_color`, `rule_alertLevel`.

**Nota:** `rule_reportableAttributes` tem ~80 patterns. É o maior bloco individual.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb` — blocos de reports.

#### Critério de aceite

Análogo.

#### Testes

- `rules-reports_test.ts`:
  - `it("parse taskreport minimal")`.
  - `it("parse resourcereport")`.
  - `it("parse textreport")`.
  - `it("parse export")`.
- `rules-columns_test.ts`:
  - `it("parse columns")`.
  - `it("parse celltext")`.
  - `it("parse tooltip")`.
  - `it("parse halign")`.

---

### 10.14 — `TjpSyntaxRules` — bloco 4 (tracking + lógica)

#### Objetivo

Implementar ~60 regras de tracking (timesheet, statussheet, journal) + lógica + utilitários.

#### Arquivos

- `packages/parser/src/parser/rules/rules-timesheet.ts`
- `packages/parser/src/parser/rules/rules-statussheet.ts`
- `packages/parser/src/parser/rules/rules-journal.ts`
- `packages/parser/src/parser/rules/rules-logical.ts`
- `packages/parser/tests/rules-timesheet_test.ts`
- `packages/parser/tests/rules-logical_test.ts`

#### Requisitos

**TimeSheet:**

- `rule_timeSheet`, `rule_timeSheetHeader`, `rule_timeSheetBody`, `rule_timeSheetAttributes`, `rule_timeSheetFile`.
- `rule_tsTaskHeader`, `rule_tsTaskBody`, `rule_tsTaskAttributes`, `rule_tsNewTaskHeader`, `rule_tsStatus`, `rule_tsStatusHeader`, `rule_tsStatusBody`, `rule_tsStatusAttributes`.

**StatusSheet:**

- `rule_statusSheet`, `rule_statusSheetHeader`, `rule_statusSheetBody`, `rule_statusSheetAttributes`, `rule_statusSheetFile`, `rule_statusSheetTask`, `rule_statusSheetTaskHeader`, `rule_statusSheetTaskBody`, `rule_statusSheetTaskAttributes`.

**Journal:**

- `rule_journalEntry`, `rule_journalEntryHeader`, `rule_journalEntryBody`, `rule_journalEntryAttributes`, `rule_details`, `rule_summary`, `rule_author`.

**Lógica:**

- `rule_logicalExpression`, `rule_operation`, `rule_operationChain`, `rule_operatorAndOperand`, `rule_operand`, `rule_operator`, `rule_functions`, `rule_functionsBody`, `rule_functionPatterns`, `rule_argument`, `rule_argumentList`, `rule_argumentListBody`, `rule_moreArguments`.
- `rule_flagLogicalExpression`, `rule_flagOperation`, `rule_flagOperationChain`, `rule_flagOperatorAndOperand`, `rule_flagOperand`, `rule_flagOperator`.

**Chargeset extensions:**

- `rule_allocation`, `rule_allocationHeader`, `rule_allocationBody`, `rule_allocationAttributes`, `rule_allocations`, `rule_moreAllocations`, `rule_allocate`, `rule_allocationSelectionMode`, `rule_allocateShiftAssignments`, `rule_allocateShiftsAssignments`.

**Outros:**

- `rule_alertLevel`, `rule_alertLevelDefinition`, `rule_alertLevelDefinitions`, `rule_moreAlertLevelDefinitions`.
- `rule_navigator`, `rule_navigatorHeader`, `rule_navigatorBody`, `rule_navigatorAttributes`.
- `rule_nodeId`, `rule_nodeIdList`, `rule_moreNodeIdList`, `rule_subNodeId`.
- `rule_monthlyYearly`.
- `rule_projectIDs`, `rule_moreProjectIDs`.

#### Referências

- `docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb` — blocos finais.

#### Critério de aceite

Análogo.

#### Testes

- `rules-timesheet_test.ts`:
  - `it("parse timesheet")`.
  - `it("parse statussheet")`.
  - `it("parse journalentry")`.
- `rules-logical_test.ts`:
  - `it("parse logical expression simples")`.
  - `it("parse isleaf()")`.
  - `it("parse hasalert()")`.

---

### Bloco D — i18n

---

### 10.15 — `LanguageDefinition` + `LanguageRegistry` + `CanonicalKeyword`

#### Contexto

Extensão própria do SyntaxMesh. Registra sinônimos de keywords por idioma.

#### Objetivo

Implementar a infraestrutura de i18n.

#### Arquivos

- `packages/language/src/types.ts`
- `packages/language/src/canonical.ts`
- `packages/language/src/registry.ts`
- `packages/language/tests/registry_test.ts`

#### Requisitos

**`types.ts`:**

- [ ] `interface LanguageDefinition`:
  ```ts
  interface LanguageDefinition {
    id: string;
    name: string;
    keywords: Record<string, string[]>;
    units: Record<string, string[]>;
  }
  ```

**`canonical.ts`:**

- [ ] `type CanonicalKeyword = ...` (união de ~200 keywords).
- [ ] Exporta constantes.

**`registry.ts`:**

- [ ] `class LanguageRegistry`:
  - `private languages: Map<string, LanguageDefinition>`.
  - `private keywordIndex: Map<string, Map<string, string>>` (per lang).
  - `private unitIndex: Map<string, Map<string, string>>`.
  - `register(lang: LanguageDefinition): void`.
  - `get(id: string): LanguageDefinition | null`.
  - `all(): LanguageDefinition[]`.
  - `resolve(word: string, langId: string): string | null` — busca em `keywordIndex`.
  - `resolveUnit(unit: string, langId: string): string | null`.
  - `canonicalizeKeywords(langId: string): Map<string, string>` — retorna `synonym → canonical`.

**Nota:** a indexação é invertida: `canonical → [synonyms]` em `LanguageDefinition`, mas o registry constrói `synonym → canonical` para lookup O(1).

#### Referências

- `docs/syntaxmesh/04-linguagem-multilingue.md`.
- ADR 021.

#### Critério de aceite

```ts
const reg = new LanguageRegistry();
reg.register(enDef);
reg.register(ptBRDef);
assertEquals(reg.resolve("task", "en"), "task");
assertEquals(reg.resolve("tarefa", "pt-BR"), "task");
assertEquals(reg.resolve("unknown", "en"), null);
```

#### Testes

- `registry_test.ts`:
  - `it("register")`.
  - `it("get")`.
  - `it("resolve por idioma")`.
  - `it("resolve retorna null para desconhecido")`.
  - `it("canonicalizeKeywords")`.

---

### 10.16 — Idiomas: `en`, `pt-BR`, `es`

#### Contexto

Definições dos 3 idiomas.

#### Objetivo

Implementar as 3 `LanguageDefinition`.

#### Arquivos

- `packages/language/src/en.ts`
- `packages/language/src/pt-BR.ts`
- `packages/language/src/es.ts`
- `packages/language/tests/languages_test.ts`

#### Requisitos

**`en.ts`:**

- [ ] `export const en: LanguageDefinition = { id: 'en', name: 'English', keywords: {...}, units: {...} }`.
- [ ] `keywords` com todos os ~200 keywords canônicos, cada um com `[canonical]` como sinônimo (ex: `project: ['project']`, `task: ['task']`).
- [ ] `units`: `day: ['d', 'day', 'days']`, `hour: ['h', 'hour', 'hours']`, `week: ['w', 'week', 'weeks']`, `month: ['m', 'month', 'months']`, `year: ['y', 'year', 'years']`, `minute: ['min', 'minute', 'minutes']`.

**`pt-BR.ts`:**

- [ ] `keywords` com sinônimos em pt-BR. Ex:
  - `project: ['projeto']`
  - `task: ['tarefa']`
  - `resource: ['recurso']`
  - `account: ['conta']`
  - `shift: ['turno']`
  - `scenario: ['cenário']`
  - `report: ['relatório']`
  - `depends: ['depende']`
  - `precedes: ['precede']`
  - `allocate: ['aloca']`
  - `effort: ['esforço']`
  - `duration: ['duração']`
  - `start: ['início']`
  - `end: ['fim']`
  - `priority: ['prioridade']`
  - `milestone: ['marco']`
  - ... (~200 no total)
- [ ] `units`: `day: ['d', 'dia', 'dias']`, `hour: ['h', 'hora', 'horas']`, ...

**`es.ts`:**

- [ ] Similar. `task: ['tarea']`, `resource: ['recurso']`, `project: ['proyecto']`, `account: ['cuenta']`, ...

**Nota:** a tradução completa dos ~200 keywords é trabalhosa. Sugerimos priorizar:
- Estruturais (project, task, resource, ...): 30 keywords.
- Atributos mais usados (effort, duration, depends, ...): 80 keywords.
- Reports (taskreport, ...): 20 keywords.
- Outros: 70 keywords.

#### Referências

- `docs/syntaxmesh/04-linguagem-multilingue.md`.
- `docs/taskjuggler/data/tjpvim.txt` (lista de keywords).

#### Critério de aceite

Análogo.

#### Testes

- `languages_test.ts`:
  - `it("en tem todos os canônicos")`.
  - `it("pt-BR cobre todos os canônicos")`.
  - `it("es cobre todos os canônicos")`.
  - `it("nenhum sinônimo colide entre idiomas")`.

---

### 10.17 — Diretiva `language` no parser

#### Contexto

A diretiva `language "pt-BR"` deve ser processada antes do parser principal.

#### Objetivo

Implementar detecção e aplicação.

#### Arquivos

- `packages/parser/src/parser/project-file-parser.ts` (estender)
- `packages/parser/tests/language-directive_test.ts`

#### Requisitos

- [ ] `private detectLanguage(content: string): string`:
  - Regex: `/^\s*language\s+"([^"]+)"/m` (primeira ocorrência).
  - Se casar, valida que o ID existe em `LanguageRegistry`; senão, `en`.
  - Retorna o ID.
- [ ] Em `open(file, master, fileNameIsBuffer)`:
  - Se `fileNameIsBuffer`, `content = file`.
  - Senão, `content = loadFile(file)`.
  - `this.language = this.detectLanguage(content)`.
  - Chama `super.open(content, true)` (sempre buffer interno).
  - Aplica `this.scanner.limitTokenSet` se necessário.
- [ ] O scanner recebe `this.language` e usa `LanguageRegistry.resolve` para tokens `ID`.

**Nota:** a diretiva em si **não é removida** do conteúdo. O parser deve ter uma regra `rule_language` para consumi-la.

#### Referências

- `docs/syntaxmesh/04-linguagem-multilingue.md` — seção "Declaração do idioma no arquivo".
- ADR 021.

#### Critério de aceite

```ts
const parser = new ProjectFileParser();
parser.open(`language "pt-BR"\nprojeto prj "Test" 1.0 2026-01-01 - 2026-12-31 {}`, true, true);
const project = parser.parse('project');
assert(project instanceof Project);
```

#### Testes

- `language-directive_test.ts`:
  - `it("detecta en")`.
  - `it("detecta pt-BR")`.
  - `it("detecta es")`.
  - `it("fallback para en sem diretiva")`.
  - `it("rejeita language desconhecido")`.

---

### 10.18 — AST equivalence entre idiomas

#### Contexto

Um dos critérios de aceite mais importantes: o mesmo projeto em en/pt-BR/es deve produzir **a mesma AST**.

#### Objetivo

Testar equivalência em todos os MWEs.

#### Arquivos

- `packages/parser/tests/ast-equivalence_test.ts`
- `docs/Learning/mwe001-009/*.pt-BR.tjp` (novos)
- `docs/Learning/mwe001-009/*.es.tjp` (novos)

#### Requisitos

- [ ] Traduzir os 9 MWEs para pt-BR e es (novos arquivos `.pt-BR.tjp` e `.es.tjp`).
- [ ] Para cada MWE:
  - Parsear versão en → AST1.
  - Parsear versão pt-BR → AST2.
  - Parsear versão es → AST3.
  - Comparar AST1 === AST2 === AST3 (estruturalmente).
- [ ] AST inclui: `id`, `name`, `start`, `end`, `effort`, `depends`, etc.
- [ ] Ignora strings (nomes podem estar traduzidos).

**Estratégia de comparação:** serializar AST normalizada (com `name` de tasks como `"__TASK__"`), comparar JSON.

#### Referências

- `docs/syntaxmesh/04-linguagem-multilingue.md`.
- ADR 021.

#### Critério de aceite

Análogo.

#### Testes

- `ast-equivalence_test.ts`:
  - `it("mwe001 en == pt-BR == es")`.
  - ... para os 9 MWEs.

---

### Bloco E — Golden tests

---

### 10.19 — Golden tests (parser)

#### Contexto

Validar parser contra `tj3`.

#### Objetivo

Rodar `tj3` em todos os arquivos válidos e de erro do `TestSuite`.

#### Arquivos

- `scripts/golden/parser-mwe*.rb`
- `scripts/golden/parser-syntax-correct.rb`
- `scripts/golden/parser-syntax-errors.rb`
- `packages/parser/tests/golden/parser.golden.json`
- `packages/parser/tests/golden/parser_golden_test.ts`
- `deno.jsonc` — atualizar `golden:generate`

#### Requisitos

**Script `parser-mwe*.rb`:**

- [ ] Para cada MWE, extrai AST do `tj3` (via `tj3 --print-ast`? Não existe — usar XML output ou parser HTML + parsing de atributos conhecidos).

**Alternativa:** rodar `tj3 --check-syntax <arquivo>` e capturar output. Se exit 0, válido.

**Script `parser-syntax-correct.rb`:**

- [ ] Para cada `*.tjp` em `TestSuite/Syntax/Correct/`:
  - Roda `tj3 --check-syntax <file>`.
  - Se exit 0, registra `{ file, ok: true }`.
  - Senão, registra `{ file, ok: false, error }`.

**Script `parser-syntax-errors.rb`:**

- [ ] Para cada `*.tjp` em `TestSuite/Syntax/Errors/`:
  - Roda `tj3 --check-syntax <file>`.
  - Se exit != 0, captura mensagem de erro.
  - Registra `{ file, ok: false, errorId, errorMsg, lineNo }`.

**Teste TS:**

- [ ] Itera casos.
- [ ] Para cada `*.tjp`, parsear com `ProjectFileParser`.
- [ ] Comparar sucesso/erro.
- [ ] Cobertura ≥ 100 casos.

#### Referências

- `docs/taskjuggler/test/TestSuite/Syntax/`.
- Fase 2, subfase 5.14.

#### Critério de aceite

```bash
deno task golden:generate
deno task test
```

- ≥ 100 casos.
- Todos passam.

#### Testes

- `parser_golden_test.ts`:
  - `describe("Golden parser")` — itera casos.

---

## 6. Ordem de execução sugerida

```text
14.0  ADRs 020, 021
      ↓
14.1  TokenDoc
14.2  Macro + MacroTable
14.3  StackElement
14.4  State
14.5  Pattern
14.6  Rule
      ↓
14.7  TextParser FSM
      ↓
14.8  Scanner genérico
      ↓
14.9  ProjectFileScanner
      ↓
14.10 ProjectFileParser (estrutura)
      ↓
14.11 TjpSyntaxRules bloco 1 (project + task)
14.12 TjpSyntaxRules bloco 2 (resource + account + shift + scenario)
14.13 TjpSyntaxRules bloco 3 (reports)
14.14 TjpSyntaxRules bloco 4 (tracking + lógica)
      ↓
14.15 LanguageRegistry
14.16 Idiomas
14.17 Diretiva language
14.18 AST equivalence
      ↓
14.19 Golden tests
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão da fase

A Fase 10 é considerada concluída quando:

```bash
deno task check-all
```

passa, e:

- [ ] `TextParser` FSM completo.
- [ ] `Scanner` + `ProjectFileScanner`.
- [ ] `ProjectFileParser` completo.
- [ ] `TjpSyntaxRules` (~300 regras) completas.
- [ ] `LanguageRegistry` + 3 idiomas.
- [ ] Diretiva `language` funcional.
- [ ] AST equivalente entre en/pt-BR/es.
- [ ] **≥ 400 testes unitários**.
- [ ] **≥ 100 golden tests**.
- [ ] Nenhum `any` em `src/` (exceto onde justificado).
- [ ] Nenhum import proibido em `packages/parser/src/`.
- [ ] ADRs 020 e 021 criados.
- [ ] Scripts `parser-*.rb` funcionais.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| FSM divergir do Ruby | **Altíssimo** | Golden tests em 100+ arquivos |
| `Pattern.generateStates` erra árvore | Alto | Testes com patterns variados |
| `Scanner` modos errados | Alto | Golden tests de tokenização |
| `TjpSyntaxRules` incompleto (~300 regras) | Alto | Dividir em 4 blocos; cobrir 100% |
| i18n: sinônimo colide com ID | Médio | Validação no registry |
| Diretiva `language` mal detectada | Médio | Testes com 3 idiomas |
| Macros recursivas infinitas | Médio | Limite de 20 no `StreamHandle` |
| Includes aninhados com prefixos | Alto | Testes específicos |
| Performance do FSM | Médio | Benchmarks; otimizar se > 1s |
| AST equivalence falsos positivos | Médio | Normalizar names |

---

## 9. Referências cruzadas

### Arquivos Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/TextParser.rb`
- `docs/taskjuggler/lib/taskjuggler/TextParser/*.rb`
- `docs/taskjuggler/lib/taskjuggler/ProjectFileScanner.rb`
- `docs/taskjuggler/lib/taskjuggler/ProjectFileParser.rb`
- `docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb`

### Blueprints

- `docs/tj3-engine/01-blueprint-parser.md`
- `docs/tj3-engine/15-blueprint-others.md`

### Documentos do projeto

- `docs/syntaxmesh/decisoes/020-fsm-textparser.md` (novo)
- `docs/syntaxmesh/decisoes/021-i18n-keywords.md` (novo)
- `docs/syntaxmesh/04-linguagem-multilingue.md`
- `docs/syntaxmesh/03-arquitetura.md`

### Casos de teste

- `docs/taskjuggler/test/TestSuite/Syntax/Correct/`
- `docs/taskjuggler/test/TestSuite/Syntax/Errors/`
- `docs/Learning/mwe001-009/`

### Fases dependentes

- **Fase 11 — Query** (usa Parser).
- **Fase 12 — RichText** (`newRichText` no parser).
- **Fase 14 — Reports** (`SyntaxReference` usa parser).
- **Fase 16 — Journal** (parser cria `JournalEntry`).
- **Fase 21 — Compatibilidade** (golden tests de parser).

---

## 10. Notas para a IA

1. **O FSM é o coração.** Não simplificar.
2. **`parseFSM` copia o Ruby linha-a-linha.** SHIFT/REDUCE exatos.
3. **`StackElement.function` precisa de `this` bind correto.** Não usar arrow.
4. **`Pattern.addTransitionsToState` tem 7 parâmetros.** Atenção.
5. **`Rule.optional?` é recursivo com cache.** Não esquecer `transitiveOptional`.
6. **`Scanner.mode` muda durante lexing.** Modos: `:tjp`, `:dqString`, `:sqString`, `:szrString`, `:szrString1`, `:macroCall`, `:macroDef`, `:cppComment`.
7. **Macros `${N}` são expandidas no scanner.** Antes do parser.
8. **Includes aninhados usam `@fileStack`.** Prefixos (`taskprefix`, etc.) empilhados.
9. **`TjpSyntaxRules` tem ~300 regras.** Não inventar; seguir o Ruby.
10. **`LanguageRegistry` é extensão do SyntaxMesh.** Não está no TJ.
11. **Diretiva `language` via pré-scan.** Regex `/^\s*language\s+"([^"]+)"/m`.
12. **`rule_reportableAttributes` é a maior regra.** ~80 patterns.
13. **`extend task { ... }` modifica regras em runtime.** `updateParserTables` deve suportar.
14. **Golden tests cobrem Syntax/Correct e Syntax/Errors.** ≥ 100 casos.
15. **AST equivalence normaliza `name`.** Nomes podem estar traduzidos.
16. **Sem `any`.** Use `unknown` + narrowing.
17. **Commit por subfase.** `feat(parser): text-parser`, `feat(parser): rules-task`, etc.

---

## 11. ADRs 020, 021 (referência rápida)

**ADR 020 — FSM do TextParser:**

- **Título:** FSM do TextParser compilado em runtime
- **Contexto:** TJ usa FSM, não recursive descent.
- **Decisão:** manter fidelidade.
- **Alternativas:** recursive descent, PEG.
- **Consequências:** suporta `extend`; complexidade.

**ADR 021 — i18n de keywords:**

- **Título:** Sistema de i18n de keywords
- **Contexto:** TJ só tem inglês; SyntaxMesh quer pt-BR, es.
- **Decisão:**
  - `LanguageRegistry` + sinônimos.
  - Scanner mapeia sinônimos → canônicos.
  - Diretiva `language "xxx"` via pré-scan.
- **Alternativas:** parser separado, keywords no parser.
- **Consequências:** AST equivalente; i18n transparente.

---

**Fim da Fase 10.**