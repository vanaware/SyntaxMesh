# Fase 23 — Tarefas Atômicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-23-template-tarefas.md`
> **Plano:** `docs/syntaxmesh/fases/fase-23-template.md`
> **Status:** ⬜ Não iniciada
> **Total:** ~95 tarefas
> **Concluídas:** 0
> **Foco:** elemento `template` (Vento), registro unificado macro/template, expansão em duas fases no scanner

---

## ⚠️ PREÂMBULO — Leia antes de começar

### Regra zero

**Toda tarefa segue TDD.** Antes de implementar:

1. Escrever o teste que falha.
2. `deno task test` → confirmar falha correta.
3. Implementar o mínimo.
4. `deno task test` → passa.
5. `deno task check-all` → verde.
6. Commit atômico.
7. Marcar `[x]`.

**E regra zero do port (ADR 011), com uma nuance própria desta fase:**
`template` é extensão **TS-only sem correspondente Ruby** — a fidelidade dele é
contra a especificação do plano (§4–§6) e a semântica do Vento. Mas a base que
ele estende (**macros**) tem oracle Ruby sim: `TextParser/MacroTable.rb` e
`scanner.rb`, já portados na Fase 10. Portanto: **o caminho de macro é
congelado** — se um teste de macro falhar ao longo desta fase, a correção é da
macro (contra o Ruby), nunca uma adaptação do teste ao novo comportamento.

### Contexto crítico

- **Baseline macro completo na Fase 10** (concluída 2026-10-26): 10.2
  (`Macro`/`MacroTable`), 10.8.6 (`expandMacro`/`addMacro`/`macroDefined`),
  10.8.7/10.9 (`injectMacro`/`macroStack`/`cleanupMacroStack`), 10.11–10.19
  (keyword + i18n + golden). A Fase 23 **estende o lookup com um ramo, não
  re-porta nada** (plano §7.7; auditoria na subfase 23.1b).
- Ponto único de expansão do `${...}`: `expandMacro` em
  `packages/core/src/lexer/scanner.ts` (port de Ruby l.450–464) — é ali que o
  ramo template entra (plano §7.2).
- **Vento importado em um único arquivo**: `src/lexer/template-engine.ts`
  (wrapper fino). Nenhum outro módulo core conhece a lib.
- Corpo de template é **texto puro até a chamada**; nada é interpretado no
  registro. Autoescape **desativado** — garantia documentada (plano §4.8).
- Erros sempre com `SourceFileInfo` do `.tjp` **original** (definição ou
  chamada), nunca do corpo renderizado; via `MessageHandler`, sem throw.
- Keyword `template` registrada no i18n no padrão `material`/`picture`
  (variantes en/pt-BR/es).
- Sem `any` em `src/`; sem FS no core; `npm:`/`jsr:` apenas.
- ADR: número na ordem de criação (034 se a 23 rodar antes da 22; conferir
  `decisoes/README.md` em 23.0.1).
- Commit por subfase: `chore(docs): ADR template`, `feat(parser):
  template-registry`, `fix(lexer): macro-baseline` (se 23.1b apontar),
  `feat(parser): template-declaration`, `feat(lexer): template-expansion`,
  `feat(lexer): named-args`, `test(parser): template-recursion`,
  `feat(lexer): template-context`, `test(golden): template-snapshots`,
  `chore(docs): template-reference`.

### Pré-requisitos

- Fase 10 concluída (macros, scanner, FSM, i18n) — ✅.
- Fase 11 concluída (motor de expressões — usado nos argumentos-expressionais,
  ex. `isMilestone(!t1)`) — ✅.
- Fase 14 concluída (validação de relatório com templates em 23.7) — ✅.
- Fase 24 (CLI) é **opcional** como harness em 23.7; se indisponível, usar a
  fachada `TaskJuggler` diretamente.

### Anti-padrões

- ❌ Reimplementar expansão de macros; duplicar o caminho `${...}`.
- ❌ Macro conter chamada de template (proibido por design, plano §4.4).
- ❌ Habilitar autoescape em qualquer configuração do engine.
- ❌ Interpretar o corpo do template no momento do registro.
- ❌ Usar `eval` próprio para argumentos — usar o motor da Fase 11.
- ❌ Expansão com estado do scheduler "meio agendado" — template é
  pré-processamento, roda antes do modelo.
- ❌ Adicionar sintaxe de interpolação concorrente (`#{}`, `%{}`).

---

## Progresso

```
[ ] 23.0   ADR + posicionamento                      —   0/6
[ ] 23.1   Fundação: dep Vento + registro unificado  —   0/10
[ ] 23.1b  Auditoria do baseline macro (Fase 10)     —   0/6
[ ] 23.2   Parser: declaração `template`             —   0/12
[ ] 23.3   Expansão em duas fases                    —   0/12
[ ] 23.4   Chamada com argumentos nomeados           —   0/12
[ ] 23.5   Proteções (recursão, ordem, limites)      —   0/8
[ ] 23.6   Contexto e composição                     —   0/10
[ ] 23.7   Testes, snapshots e integração            —   0/11
[ ] 23.8   Documentação e verificação final          —   0/8
─────────────────────────────────────────────────────────
TOTAL: ~95
```

---

## Bloco A — Fundação

### 23.0 — ADR + posicionamento

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 23.0.1 | Definir o número do ADR conferindo `decisoes/README.md` (034 se a 23 roda antes da 22; senão o próximo livre) | idem | número sem colisão |
| 23.0.2 | Criar `docs/syntaxmesh/decisoes/0NN-elemento-template.md` com frontmatter | idem | arquivo existe |
| 23.0.3 | Seção **Contexto:** macros são textuais, sem lógica; repetição em projetos grandes; necessidade de `if`/`for` sem quebrar `.tjp` legado | idem | — |
| 23.0.4 | Seção **Decisões:** keyword `template` com corpo `[ ]` (regra da macro) + params `( )`; Vento sem autoescape; namespace único macro/template; expansão em duas fases no scanner; recursão = erro com cadeia; snapshots TS-only | idem | — |
| 23.0.5 | Seções **Alternativas** (template literals JS, mini-linguagem própria, Mustache/Handlebars, autoescape ligado) e **Consequências** | idem | — |
| 23.0.6 | Atualizar `decisoes/README.md`, `plano.md` (inserir Fase 23, recomendada antes da 22) e `CURRENT.md` (ordem de execução) | idem | índice consistente |

---

## Bloco B — Base técnica

### 23.1 — Dependência Vento + registro unificado

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 23.1.1 | Spike: adicionar `vento: npm:ventojs` ao `packages/core/deno.jsonc`; `deno check` + `runString("{{ 1+1 }}")` num scratch test | idem | `"2"`; sem erro de type |
| 23.1.2 | Confirmar o spike no **browser** (sem APIs de runtime) — Vento roda em JS puro; registrar versão fixada | idem | bundle do ui ainda compila |
| 23.1.3 | Criar `src/lexer/template-engine.ts`: wrapper fino `renderTemplate(body, context): string` (engine configurado sem autoescape; import do Vento **só aqui**) | idem | grep: `ventojs` aparece em 1 arquivo |
| 23.1.4 | Unit do wrapper: `{{ expr }}`, `{{ if }}`, `{{ for }}`, `{{ set }}`, pipes (`toUpperCase`, `escape`, custom) | `tests/lexer/template-engine_test.ts` | ≥ 6 testes |
| 23.1.5 | Estender `MacroTable` para entradas tipadas `{ kind: "macro" \| "template" }` **mantendo o contrato `get`/`add`/`macroDefined` inalterado** (RAMIFICAÇÃO interna, não novo registro paralelo) | `macro-table.ts` | suíte macro existente verde |
| 23.1.6 | `Template` type/fields: `name`, `body` (texto cru), `params: string[]`, `sourceFileInfo` | idem | `deno check` |
| 23.1.7 | `addTemplate(...)` com validação de nome maiúsculo (erro do plano §5) | idem | 3 testes |
| 23.1.8 | Colisão de namespace na definição: macro+macro, template+template, macro+template → erro citando o tipo do 1º registro (mensagem §5) com `sfi` da 2ª definição | idem | 3 testes |
| 23.1.9 | Lookup: `resolve` inalterado p/ macros; novo acesso `lookup(name): entry \| null` para o ramo do scanner | idem | 2 testes |
| 23.1.10 | `deno task check-all` + commit `feat(parser): template-registry` | — | exit 0; git log |

### 23.1b — Auditoria do baseline macro (plano §7.7)

**Objetivo:** guardar a base que a Fase 23 estende. Divergência encontrada é
corrigida **aqui**, antes de 23.2.

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 23.1b.1 | Rodar suítes `tests/lexer/` + golden que exercitam `${...}`; registrar resultado no checklist deste arquivo | — | tudo verde |
| 23.1b.2 | Conferir `MacroTable.resolve` ponto a ponto contra `TextParser/MacroTable.rb`: `${1}`/`${2}`, `${?OPT}`, `$${` → `${`, texto vazio | `macro-table.ts` vs Ruby | linha a linha anotada |
| 23.1b.3 | Conferir `expandMacro`/`addMacro`/`macroDefined` contra `scanner.rb` (l.450–464 e vizinhos): mensagem de macro não definida e comportamento `${?...}` | `scanner.ts` vs Ruby | idem |
| 23.1b.4 | Conferir `injectMacro`/`macroStack`/`cleanupMacroStack` e corpo `macro` com `]` no fim da linha contra o Ruby | `project-file-scanner.ts`, FSM | idem |
| 23.1b.5 | Se qualquer divergência: corrigir fiel ao Ruby + teste de regressão, commit `fix(lexer): macro-baseline` (não adiar) | — | suíte verde |
| 23.1b.6 | Registrar resultado da auditoria (✔/✘ por item, com `file:line` Ruby) ao fim deste arquivo, seção "Auditoria 23.1b" | idem | checklist preenchido |

---

## Bloco C — Linguagem

### 23.2 — Parser: declaração `template`

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 23.2.1 | Teste que falha: `template CARD [ task t1 "x" ] (id)` produz registro `kind: "template"` no scanner após parse do corpo do projeto | `tests/parser/template-decl_test.ts` | falha correta |
| 23.2.2 | Registrar keyword `template` no i18n (en/pt-BR/es) no padrão `material`/`picture` | `packages/core/src/i18n/` | 3 variantes resolvem |
| 23.2.3 | Transição FSM no corpo do projeto (mesma família da `macro`): `template` + `NAME` (maiúscula) | `tjp-syntax-rules` / parser do projeto | 2 testes |
| 23.2.4 | Corpo `[ ... ]` reusando o mecanismo de coleta da macro (fechamento por `]` no fim da linha; corpo multi-linha) | idem | 3 testes |
| 23.2.5 | Lista de parâmetros `( a, b, c )` após o corpo; `()` e omissão aceitas | idem | 3 testes |
| 23.2.6 | Corpo tratado como **texto cru** no registro: `{{ }}` e `${...}` permanecem literais, nada é interpretado antes da chamada | idem | 1 teste (corpo preserva literal) |
| 23.2.7 | Nome minúsculo → erro do plano §5 com `sfi` da definição | idem | 1 teste |
| 23.2.8 | Definições são globais ao projeto (inclusive vindo de `include`): template definido em `.tji` chamável no master | fixture | 2 testes |
| 23.2.9 | AST-equivalence da keyword nos 3 idiomas (padrão 10.18) | `tests/parser/` | 3 casos |
| 23.2.10 | Golden parser: fixture `template-basic.tjp` parseado (registro correto, sem expansão ainda) | `tests/golden/` | snapshot aditivo |
| 23.2.11 | Regressão: suítes da Fase 10 + `mwe001` parse inalterados | `deno task test` | verde |
| 23.2.12 | `check-all` + commit `feat(parser): template-declaration` | — | exit 0 |

### 23.3 — Expansão em duas fases

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 23.3.1 | Teste que falha: `${CARD id="t1" nome="Design" esforco="5d"}` produz `task t1 "Design" { effort 5d }` no stream (render Vento com params) | `tests/lexer/template-expansion_test.ts` | falha correta |
| 23.3.2 | Ramo único no lookup em `expandMacro` (scanner): `kind === "template"` → caminho template; `kind === "macro"` → **código atual intocado**; ausente → comportamento `${?}`/erro atual | `scanner.ts` | suíte macro continua verde |
| 23.3.3 | Fase 1 — expandir `${MACRO ...}` **dentro do corpo** antes do render (reusar a máquina de macro com o texto do corpo); sem tocar em `{{ }}` | idem | 2 testes |
| 23.3.4 | Fase 2 — `renderTemplate(bodyExpandido, context)` com params nomeados no contexto (contexto mínimo agora; completo em 23.6) | idem | 2 testes |
| 23.3.5 | Reinjectar o resultado no stream (mesma mecânica `injectMacro`) — texto expandido reentra como input normal | `project-file-scanner.ts` | 2 testes |
| 23.3.6 | Template sem parâmetros: `template HEADER [ # {{ project.name }} ]` ainda não renderiza sem contexto → adiar assert para 23.6; aqui testar com params vazios e corpo literal | idem | 1 teste |
| 23.3.7 | Erro de sintaxe Vento no corpo → mensagem `template 'CARD': erro de sintaxe...` com `sfi` da **definição** (mapear linha do corpo p/ linha original + offset) | idem | 2 testes |
| 23.3.8 | Erro na **chamada** (args, §5) reporta `sfi` do ponto da chamada | idem | 1 teste |
| 23.3.9 | Composição básica: texto reentrante contendo nova chamada `${OUTRO ...}` de template **já definido** expande (top-down) | idem | 2 testes |
| 23.3.10 | Golden TS-only: snapshot da expansão do fixture `template-basic` (pipeline de extensões, nunca oracle `tj3`) | `tests/golden/` | snapshot aditivo |
| 23.3.11 | Regressão macro + parser completa | `deno task test` | verde |
| 23.3.12 | `check-all` + commit `feat(lexer): template-expansion` | — | exit 0 |

### 23.4 — Chamada com argumentos nomeados

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 23.4.1 | Teste que falha: parser de argumentos de `${NAME k=v ...}` extrai pares `nome→valor` (string com aspas e espaços) | `tests/lexer/template-args_test.ts`, impl em `scanner.ts`/novo helper | falha correta |
| 23.4.2 | Valores: string `"..."`, número, booleano (tipados no contexto) | idem | 3 testes |
| 23.4.3 | Valor `!id` (referência TaskJuggler) preservado como texto nativo | idem | 1 teste |
| 23.4.4 | Valor lista `[a, b, c]` e objeto `{ k: v }` (balanced, sem `eval` próprio) | idem | 3 testes |
| 23.4.5 | Valor expressão aritmética (`1 + 2`, `esforco * 2`) avaliada numericamente | idem | 2 testes |
| 23.4.6 | Valor expressão lógica via **motor da Fase 11** (`isMilestone(!t1)`) — ligar no momento da expansão | idem | 2 testes |
| 23.4.7 | Parâmetro obrigatório faltante → erro exato do §5 (`parâmetro 'esforco' não fornecido`) com `sfi` da chamada | idem | 1 teste |
| 23.4.8 | Argumento não declarado → erro `parâmetro 'esforcoo' não declarado` | idem | 1 teste |
| 23.4.9 | `${?TEMPLATE ...}` (opcional): template inexistente → vazio silencioso (mesma semântica da macro, plano §4.5.4) | idem | 1 teste |
| 23.4.10 | Matriz de argumentos: fixture com chamada usando todos os tipos (§4.2) gera texto esperado | golden | 1 snapshot |
| 23.4.11 | Regressão macro (caminho posicional `${MACRO "arg"}` intocado) | `deno task test` | verde |
| 23.4.12 | `check-all` + commit `feat(lexer): named-args` | — | exit 0 |

---

## Bloco D — Segurança do modelo

### 23.5 — Proteções

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 23.5.1 | Teste que falha: template que chama a si mesmo → erro `recursão detectada: CARD → CARD` (mensagem §5), sem stack overflow | `tests/lexer/template-recursion_test.ts` | falha correta |
| 23.5.2 | Pilha de expansão (nomes em avaliação) no ramo template; limite de profundidade documentado e alinhado ao mecanismo de macro | `scanner.ts` | 1 teste |
| 23.5.3 | Recursão mútua `A → B → A` com **cadeia completa** na mensagem | idem | 1 teste |
| 23.5.4 | Ordem de definição: template chamando template definido **mais adiante** no arquivo → erro (plano §4.6) | idem | 1 teste |
| 23.5.5 | Macro chamando template (proibido, plano §4.4): `${TEMPLATE...}` dentro de corpo de macro **não** resolve como template → comportamento de lookup de macro preservado + teste de guarda | idem | 1 teste |
| 23.5.6 | Todos os erros do §5 passam por `MessageHandler` com `file:line:col` original (sem throw, `errors > 0`) | tabela driver de testes | ≥ 7 casos |
| 23.5.7 | Expansão não enxerga estado de scheduler (pré-processamento): asserção de ordem — `parse` expande antes de `schedule` | teste de integração | 1 teste |
| 23.5.8 | `check-all` + commit `test(parser): template-recursion` | — | exit 0 |

### 23.6 — Contexto e composição

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 23.6.1 | Construtor de contexto por chamada: params + `project` (view somente leitura: `name`, `start`, ...), `ids()` | `template-engine.ts`/`scanner.ts` | 3 testes |
| 23.6.2 | `expandTemplate(name, argsObj)` no contexto — template renderiza template (exemplo WRAPPER do plano §4.4) | idem | 2 testes |
| 23.6.3 | `expandMacro(name, ...args)` no contexto (chamada explícita de macro a partir de string) | idem | 1 teste |
| 23.6.4 | `expandTemplateList(name, list)` (conveniência opcional, plano §4.7): decide implementar ou registrar como futuro no ADR | idem | 1 teste ou nota |
| 23.6.5 | Precedência: parâmetro **sobrescreve** chave global homônima; colisão emite **aviso** com `sfi` da chamada | idem | 2 testes |
| 23.6.6 | Garantias de imutabilidade: `project` view não expõe setters; mutação durante expansão é impossível em TS | idem | `deno check` + teste de tipo |
| 23.6.7 | Exemplo do plano §4.7 (`SUMMARY` com `expandTemplateList`/`for`) vira teste de integração | fixture | 1 teste |
| 23.6.8 | Exemplo canônico §4.4 (`DEV_TASK` com `${ALLOCATE_TEAM}` dentro) ponta a ponta: macro no corpo + params + render | fixture | 1 teste |
| 23.6.9 | Snapshots TS-only dos novos cenários de composição | `tests/golden/` | aditivo |
| 23.6.10 | `check-all` + commit `feat(lexer): template-context` | — | exit 0 |

---

## Bloco E — Qualidade e fecho

### 23.7 — Testes, snapshots e integração

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 23.7.1 | Organizar fixtures `packages/core/tests/fixtures/templates/` (basic, args-matrix, composition, macros-in-template, errors) com README de índice | idem | ≥ 5 fixtures |
| 23.7.2 | Snapshots de expansão consolidados em `tests/golden/template.golden.json` seguindo a política TS-only (`scripts/golden/README.md`) | idem | regenerável |
| 23.7.3 | Suíte de regressão macro explícita: suíte da Fase 10 roda sem **nenhum** ajuste de comportamento nesta fase | — | verde sem diff nos testes antigos |
| 23.7.4 | Integração com o motor: projeto com tasks geradas por template vs projeto equivalente escrito à mão → schedules idênticos (effort, deps, alocações, datas) | `tests/integration/` | 2 testes |
| 23.7.5 | Integração com financeiro: template gerando `account`/`booking` produz mesmos totais do equivalente manual | idem | 1 teste |
| 23.7.6 | Integração com relatórios: fixture com template gera relatório via fachada `TaskJuggler.generateReports` sem erro | idem | 1 teste |
| 23.7.7 | (Opcional, se CLI Fase 24 disponível) `syntaxmesh template-fixture.tjp --no-reports` exit 0 | — | 1 teste |
| 23.7.8 | i18n: AST-equivalence `template` en/pt-BR/es consolidada nos casos 10.18 | `tests/parser/` | 3 casos |
| 23.7.9 | Matriz de erros §5 como suíte table-driven commitada | `tests/` | ≥ 7 casos |
| 23.7.10 | Cobertura ≥ 80% nos módulos novos (`template-engine.ts`, ramos template em `macro-table.ts`/`scanner.ts`) | relatório | meta atingida |
| 23.7.11 | `deno task golden:generate && deno task test` + commit `test(golden): template-snapshots` | — | exit 0 |

### 23.8 — Documentação e verificação final

| # | Tarefa | Arquivos | Verificação |
|---|---|---|---|
| 23.8.1 | Criar `docs/syntaxmesh/11-referencia-template.md`: gramática, contexto de execução, tabela de erros (é o insumo do manual/help `lsp-core` da Fase 22) | idem | revisão |
| 23.8.2 | Registrar no plano da Fase 22 (`fase-22-vscode-extension.md`) que grammar/completions/help já têm referência disponível (link de 23.8.1) | idem | linha adicionada |
| 23.8.3 | Grep de fronteira: `ventojs` importado só em `template-engine.ts`; nenhum `as any` em `src/`; nenhum FS nos módulos novos | — | vazio |
| 23.8.4 | `deno task check-all` (workspace inteiro) verde | — | exit 0 |
| 23.8.5 | ADR da fase commitado e indexado em `decisoes/README.md` (número de 23.0.1 confirmado) | git log | presente |
| 23.8.6 | `CURRENT.md`: "Fase 23 concluída; `template` (Vento) disponível; macros intocadas; insumo lsp-core pronto" + status em `plano.md` | idem | revisão |
| 23.8.7 | Progresso deste arquivo 100% (`[x]`, contadores, seção Auditoria 23.1b preenchida) | idem | revisão |
| 23.8.8 | Commit final `chore(docs): template-reference` | — | git log |

---

## Notas para a IA

1. **Ordem:** 23.0 → 23.1 → **23.1b (gate)** → 23.2 → 23.3 → 23.4 → 23.5 →
   23.6 → 23.7 → 23.8. A auditoria 23.1b é pré-condição: divergência de macro
   corrigida **antes** de tocar no scanner para templates.
2. **O caminho de macro é congelado.** Se teste antigo de macro falhar durante
   esta fase, corrija a implementação contra o Ruby — nunca ajuste o teste ao
   comportamento novo (regra zero ADR 011).
3. Toda alteração do scanner em 23.3.2 é um **ramo de lookup**: o fluxo Ruby
   `l.450-464` permanece legível, com comentário apontando a extensão TS-only.
4. Vento **não vaza** para além de `template-engine.ts`; se precisar de um pipe
   novo, ele nasce ali com teste próprio.
5. Argumentos-expressionais reutilizam o motor da Fase 11 — proibido `eval`
   próprio (anti-padrão do plano §9).
6. Ao fim de cada subfase: `deno task check-all` + `deno task test` + commit
   atômico (AGENTS.md §7).
7. Se a Fase 24 ainda não estiver pronta, marque 23.7.7 como **pendente com
   nota** (política de pendências), não a pule em silêncio.

---

## Auditoria 23.1b (preencher no kickoff)

| Item | Ruby (file:line) | TS | Resultado |
|---|---|---|---|
| `resolve` `${1}`/`${2}` | `TextParser/MacroTable.rb` | `macro-table.ts` | ⬜ |
| `${?OPT}` opcional | idem | idem | ⬜ |
| `$${` → `${` | idem | idem | ⬜ |
| Valor vazio | idem | idem | ⬜ |
| Macro não definida (mensagem) | `parser/scanner.rb` | `scanner.ts` | ⬜ |
| `expandMacro` fluxo | `parser/scanner.rb` l.450-464 | `scanner.ts` | ⬜ |
| `injectMacro`/`macroStack`/`cleanup` | `parser/scanner.rb` | `project-file-scanner.ts` | ⬜ |
| Corpo `macro` com `]` no fim da linha | parser/scanner | FSM | ⬜ |

---

## Referências cruzadas

- `docs/syntaxmesh/fases/fase-23-template.md` — plano desta fase (§4 sintaxe,
  §5 erros, §7 decisões de implementação, §8 testes).
- `docs/syntaxmesh/fases/fase-10-parser-linguagem-tarefas.md` — tarefas 10.2,
  10.8.6–10.8.7, 10.9 (baseline macro concluído em 2026-10-26).
- `docs/taskjuggler/lib/taskjuggler/TextParser/MacroTable.rb` e
  `docs/taskjuggler/lib/taskjuggler/parser/scanner.rb` — ground truth da
  auditoria 23.1b e do caminho de macro congelado.
- `packages/core/src/lexer/macro-table.ts`, `scanner.ts`,
  `project-file-scanner.ts` — pontos de junção (ramo template em `expandMacro`).
- `packages/core/src/i18n/` — padrão de registro de keyword de extensão
  (`material`/`picture`/`timebasis`).
- `docs/syntaxmesh/fases/fase-11-logica-queries.md` — motor de expressões para
  argumentos (23.4.6).
- `scripts/golden/README.md` — política de snapshots TS-only (23.7.2).
- `docs/syntaxmesh/fases/fase-22-vscode-extension.md` — consumirá a referência
  de 23.8.1 no manual/help (`lsp-core`).
- Vento: https://vento.js.org/ (`env.runString`, pipes, `set`, loops).

---

**Fim das tarefas da Fase 23 (elemento estendido `template` — Vento).**
