# Fase 23 — Elemento estendido `template` (Vento)

> **Arquivo:** `docs/syntaxmesh/fases/fase-23-template.md`
> **Tarefas:** `docs/syntaxmesh/fases/fase-23-template-tarefas.md` (~98 tarefas atômicas)
> **Status:** ✅ Concluída (2026-11-06) — 23.0–23.8; verificação final em
> `fase-23-template-tarefas.md` (97/98; **23.7.7** pendente com nota: smoke da
> CLI depende da Fase 24). Referência normativa em `11-referencia-template.md`.
> **Fecho estendido (2026-11-07):** **23.9** — `template` passa a seguir a
> **mesma condição da `macro`** (prolog ou nível de propriedades; nunca dentro
> do bloco `{ }` do cabeçalho); **23.10** — listas como argumento e as três
> formas de `{{ for }}` documentadas e fixadas em fixture/suíte; **23.11** —
> correção do helper do teste 14C.5.1 (`rti.richText.factory`), o único failure
> pré-existente do `deno task tests`.
> **Duração estimada:** 4–6 dias
> **Depende de:** Fase 10 (lexer, macros, parser FSM, i18n) e Fase 14 (relatórios — para validar saída). **Não depende** das Fases 15–21.
> **Bloqueia:** Fase 22 de forma suave — a grammar/completions da extensão VS Code devem cobrir a keyword `template`; rodar a 23 **antes** da 22 evita um adendo de grammar.
> **Natureza:** extensão de linguagem (TS-only, sem correspondente no Ruby) — novo elemento `template` no parser, com expansão via engine Vento
> **Posicionamento (ordem oficial 2026-11-03, `plano.md`):** executada após as Fases 15–18 e **antes** da Fase 24 (CLI) e da 22 — a keyword já nasce coberta pela CLI e pela grammar
> **ADR:** **033** — `decisoes/033-elemento-template.md` (aceita; 034 = CLI, 035 = extensão VS Code).

---

## 1. Contexto

O TaskJuggler original possui apenas **macros**, que realizam substituição
textual simples com argumentos posicionais (`${1}`, `${2}`, ...). Isso é
suficiente para reutilização básica, mas não permite lógica de controle
(condicionais, laços), tornando projetos grandes repetitivos e difíceis de
manter.

Para resolver isso **sem quebrar a compatibilidade** com arquivos `.tjp`
existentes, o port introduz um novo elemento: **`template`**, alimentado pela
engine [Vento](https://vento.js.org/).

É a segunda extensão de linguagem do port depois dos elementos de Fase 10
Complemento (`material`, `picture`, `timebasis`, flags) — e, como eles, **não
existe no Ruby**: a fidelidade é garantida por snapshots próprios (pipeline
TS-only, conforme decisão registrada sobre golden de extensões), nunca por
oracle `tj3`.

### Pontos de junção já existentes no repositório

| Junção | Onde | Papel na Fase 23 |
|---|---|---|
| `Macro` / `MacroTable` | `packages/core/src/lexer/macro-table.ts` | registro unificado macro+template (namespace compartilhado, §4.5) |
| `expandMacro` | `packages/core/src/lexer/scanner.ts` (Ruby `l.450-464`) | caminho de `${...}` — ganha o ramo de template (§7.2) |
| `macroStack` / `injectMacro` | `packages/core/src/lexer/project-file-scanner.ts` | reentrada de texto expandido no stream |
| Keywords de extensão + i18n | `packages/core/src/i18n/` | registro da keyword `template` no padrão já usado por `material` etc. |
| Mensagens com `file:line:col` | `SourceFileInfo` / `MessageHandler` | erros apontando o arquivo original (§5) |

> **Baseline de macros — já portado (Fase 10, concluída 2026-10-26):**
> `TextParser/MacroTable.rb` inteiro em 10.2 (10/10); `expandMacro`/`addMacro`/
> `macroDefined` em 10.8.6; `injectMacro`/`macroStack`/`cleanupMacroStack` em
> 10.8.7/10.9; keyword `macro` + i18n + golden em 10.11–10.19 (testes em
> `packages/core/tests/lexer/macro-table_test.ts`, `scanner_test.ts`). A Fase 23
> **estende** essa base, não a re-porta — mas a audita antes (ver §7.7 e 23.1b).

---

## 2. Objetivo

Ao final desta fase:

- Parser reconhece `template NOME [ corpo ] (params)` no corpo do projeto, com
  as mesmas regras de delimitação das macros.
- Chamadas `${NOME param=valor ...}` expandem em duas fases (macros no corpo →
  render Vento) e o texto resultante reentra no scanner como input normal.
- Namespace macro/template unificado, com erro de colisão na definição.
- Contexto de execução exposto ao Vento: parâmetros nomeados, `project`, `ids`,
  `expandTemplate`, `expandMacro` (+ convenção opcional `expandTemplateList`).
- Proteções: parâmetro faltante/não declarado, recursão com cadeia de chamadas,
  ordem de definição, sintaxe Vento inválida — todas com `file:line:col` do
  `.tjp` original.
- Escape HTML desativado por padrão (garantia documentada; filtro `escape`
  explícito disponível).
- Macros continuam com semântica idêntica ao TaskJuggler original; `.tjp` sem
  `template` processa exatamente como hoje (teste de regressão).
- Snapshots TS-only da expansão commits em `packages/core/tests/golden/`;
  integração: tasks geradas por template agendam/idêmicas às escritas à mão.
- ADR desta fase registrado (033 pela cadeia da ordem oficial — ver cabeçalho);
  `CURRENT.md`/`plano.md` atualizados; nota para a Fase 22
  (grammar já cobre `template`).

---

## 3. Princípio de projeto: convivência

A convivência dos dois mecanismos é um princípio de projeto:

- **Macros** continuam com semântica idêntica ao TaskJuggler original
  (substituição textual pura).
- **Templates** adicionam lógica, expressões e composição via Vento.
- **Macros podem ser chamadas dentro de templates**, permitindo migração
  incremental.
- **Templates podem ser chamados dentro de templates**, permitindo composição.

---

## 4. Especificação de sintaxe

### 4.1 Definição

Um template é declarado com a palavra-chave `template`, seguido do nome, do
corpo entre **colchetes `[ ]`** (igual às macros) e da **lista de parâmetros
nomeados** entre parênteses.

```taskjuggler
template NOME [ corpo do template ] (param1, param2, ...)
```

#### Regras

| Aspecto | Regra |
|---|---|
| Nome | Deve começar com **letra maiúscula** (mesma regra das macros). Nomes em minúsculas são reservados para futuras expansões internas. |
| Corpo | Delimitado por `[ ]`, com o `]` de fechamento sendo o **último caractere da linha** (mesma regra das macros). |
| Parâmetros | Lista entre `( )`, separada por vírgulas. Cada parâmetro é um identificador válido. A lista pode ser vazia ou omitida. |
| Escopo de definição | Global (nível superior do projeto), processado antes das chamadas. |

#### Exemplo mínimo

```taskjuggler
template CARD [ 
  task {{ id }} "{{ nome }}" { effort {{ esforco }} }
] (id, nome, esforco)
```

#### Exemplo sem parâmetros

```taskjuggler
template HEADER [ 
  # Projeto: {{ project.name }}
] ()
```

### 4.2 Chamada

Templates são chamados com a mesma notação `${ ... }` das macros, mas com
**argumentos nomeados**:

```taskjuggler
${NOME param1=valor1 param2=valor2}
```

#### Regras

- Argumentos são **obrigatórios para cada parâmetro declarado**. Faltas geram
  erro com o nome do parâmetro ausente.
- Argumentos **não declarados** também geram erro (proteção contra typos
  silenciosos).
- Valores podem ser:
  - **String**: `"texto com espaços"` ou `"texto"`.
  - **Número**: `42`, `3.14`.
  - **Booleano**: `true`, `false`.
  - **Referência a ID do TaskJuggler**: `!t1`, `!res1` (preserva a sintaxe
    nativa).
  - **Lista**: `[!t1, !t2, !t3]`.
  - **Objeto literal**: `{ chave: valor, ... }`.
  - **Expressão**: `1 + 2`, `isMilestone(!t1)` (avaliada no contexto do
    projeto).

#### Exemplo

```taskjuggler
${CARD id="t1" nome="Design" esforco="5d"}
${CARD id="t2" nome="Implementação" esforco="10d"}
```

### 4.3 Interpolação e expressões (Vento)

Dentro do corpo do template, você usa a sintaxe do Vento. **O escape HTML está
desativado por padrão**, então tudo é tratado como texto puro — ideal para
gerar `.tjp`.

#### 4.3.1 Impressão de valores

```taskjuggler
{{ variavel }}
{{ expression.q }}
{{ project.name }}
{{ tarefa.esforco * 2 }}
```

#### 4.3.2 Condicionais

```taskjuggler
{{ if disponivel }}
  allocate {{ recurso }}
{{ else if alternativo }}
  allocate {{ alternativo }}
{{ else }}
  # Sem alocação
{{ /if }}
```

#### 4.3.3 Laços

```taskjuggler
{{ for tarefa of tarefas }}
  task {{ tarefa.id }} "{{ tarefa.nome }}" {
    effort {{ tarefa.esforco }}
  }
{{ /for }}
```

Também suporta:

- `{{ for key, value of objeto }}` — iteração com chave.
- `{{ for i of 5 }}` — iteração numérica (0..4).
- `{{ for await item of asyncIterable }}` — iteração assíncrona.

#### 4.3.4 Variáveis locais

```taskjuggler
{{ set total = 0 }}
{{ for t of tarefas }}
  {{ set total = total + parseDuration(t.esforco) }}
{{ /for }}
# Total: {{ total }}
```

#### 4.3.5 Pipes e filtros

```taskjuggler
{{ nome |> toUpperCase }}
{{ lista |> JSON.stringify }}
{{ descricao |> escape }}
{{ lista |> empty }}
```

### 4.4 Macros dentro de templates

Uma das grandes vantagens da convivência: **macros continuam funcionando
normalmente dentro de templates**. Isso permite:

- Migrar projetos gradualmente (um template pode reaproveitar macros
  existentes).
- Reaproveitar lógica textual já validada.
- Manter a compatibilidade de código legado.

#### Exemplo

```taskjuggler
macro ALLOCATE_TEAM [ allocate tux1, tux2, tux3 ]

template DEV_TASK [
  task {{ id }} "{{ nome }}" {
    effort {{ esforco }}
    ${ALLOCATE_TEAM}
  }
] (id, nome, esforco)
```

Resultado da chamada `${DEV_TASK id="t1" nome="Setup" esforco="3d"}`:

```taskjuggler
task t1 "Setup" {
  effort 3d
  allocate tux1, tux2, tux3
}
```

#### Como funciona tecnicamente

A expansão de macros dentro de um template ocorre **em duas fases**:

1. **Fase 1 — Expansão de macros**: antes de renderizar o template com o Vento,
   o port percorre o corpo do template substituindo todas as chamadas
   `${MACRO}` e `${MACRO "arg"}` pelos seus corpos expandidos. Macros com
   argumentos posicionais são resolvidas nesta fase.
2. **Fase 2 — Renderização com Vento**: o texto resultante (agora com macros já
   expandidas) é passado para `env.runString()` do Vento com o contexto dos
   parâmetros nomeados.

Essa ordem garante que:

- Uma macro pode **conter** uma chamada a template? **Não** — macros são
  estritamente textuais e a expansão é linear; chamadas `${TEMPLATE ...}`
  dentro de uma macro só funcionariam se o template fosse resolvido antes, o
  que não é o caso.
- Um template **pode conter** chamadas de macro. ✅
- Um template **pode conter** chamadas de outro template, desde que o template
  chamado já esteja definido e que a chamada esteja dentro de `{{ }}` ou em
  uma tag do Vento. ✅

#### Chamada de templates dentro de templates

Um template pode chamar outro usando a sintaxe nativa do Vento ou uma
extensão. Recomendamos a forma explícita via interpolação para permitir
composição:

```taskjuggler
template WRAPPER [
  {{ set inner = expandTemplate("CARD", { id: id, nome: nome, esforco: esforco }) }}
  {{ inner }}
] (id, nome, esforco)
```

Onde `expandTemplate(nome, args)` é uma função exposta pelo port ao contexto do
Vento. Isso permite encadear templates com controle total sobre a ordem de
avaliação.

### 4.5 Resolução de nomes e namespaces

Para eliminar ambiguidade no parser, as **macro e template compartilham o
mesmo espaço de nomes**.

#### Regras de unicidade

- Dois elementos com o mesmo nome (dois templates, duas macros, ou um de cada)
  **geram erro na definição**.
- A mensagem de erro identifica o tipo do primeiro registro:

  ```
  'ALLOCATE' já definido como macro; não pode ser redefinido como template
  ```

#### Por que compartilhar o namespace?

Se permitíssemos coexistência de `macro FOO` e `template FOO`, a chamada
`${FOO}` seria ambígua e o parser precisaria de heurísticas. Compartilhar o
namespace elimina essa classe de erros.

#### Lookup em tempo de expansão

Quando o parser encontra `${NOME ...}`:

1. Busca `NOME` no registro unificado.
2. Se for `macro` → caminho de substituição textual (compatível com TJ
   original).
3. Se for `template` → caminho de renderização Vento com contexto de
   parâmetros nomeados.
4. Se não existir → verifica se é uma chamada opcional (`${?NOME}`) e, se sim,
   expande para vazio; senão, erro.

### 4.6 Ordem de avaliação

A avaliação segue uma ordem determinística, projetada para permitir composição
sem surpresas:

1. **Parse do arquivo** — todas as definições (`macro`, `template`) são
   coletadas.
2. **Registro com validação** — colisões de nome são detectadas aqui.
3. **Expansão de chamadas, top-down**:
   - Chamada de macro → substituição textual + expansão de argumentos
     posicionais.
   - Chamada de template → expansão de macros no corpo, depois renderização
     Vento.
4. **Pós-processamento** — o resultado (texto puro) segue para o
   interpretador TaskJuggler.

#### Proteções

- **Detecção de recursão**: se um template ou macro se referenciar direta ou
  indiretamente, o port lança erro com a cadeia de chamadas.
- **Ordem de definição**: um template pode chamar apenas templates definidos
  anteriormente no arquivo (ou qualquer macro já registrada).

### 4.7 Contexto de execução do template

Ao renderizar um template, o contexto fornecido ao Vento é um objeto plano com:

| Chave | Origem | Exemplo |
|---|---|---|
| `<cada parâmetro>` | Argumentos nomeados da chamada | `id`, `nome`, `esforco` |
| `project` | Metadados do projeto (somente leitura) | `project.name`, `project.start` |
| `ids` | Função para resolver referências a IDs do projeto | `ids("t1")` |
| `expandTemplate` | Função para invocar outro template | `expandTemplate("CARD", {...})` |
| `expandMacro` | Função para invocar uma macro a partir de string | `expandMacro("ALLOCATE_TEAM")` |

Os parâmetros nomeados têm **precedência** sobre as chaves globais em caso de
colisão (mas isso gera um aviso se ocorrer).

#### Exemplo

```taskjuggler
template SUMMARY [
  # {{ project.name }}
  {{ for t of expandTemplateList("TASK_LINE", tarefas) }}
    {{ t }}
  {{ /for }}
] (tarefas)
```

> `expandTemplateList` é uma conveniência opcional que renderiza o mesmo
> template para cada item de uma lista e retorna o array de resultados.

### 4.8 Escape e texto puro

Como o port gera **TaskJuggler** (não HTML), o escape HTML é **indesejado e
desativado**.

- O Vento, por padrão, **não escapa** — comportamento adotado.
- Se você precisar do comportamento oposto (por exemplo, escapar entidades em
  uma string que vai virar nome de tarefa), use o filtro `escape`
  explicitamente:

  ```taskjuggler
  {{ nome |> escape }}
  ```

- O port **não** habilita autoescape em nenhum momento. Isso é uma garantia
  documentada.

---

## 5. Erros e validações

O port deve emitir erros claros e localizados para todos os casos abaixo:

| Situação | Mensagem esperada |
|---|---|
| Parâmetro não fornecido | `template 'CARD': parâmetro 'esforco' não fornecido` |
| Parâmetro não declarado | `template 'CARD': parâmetro 'esforcoo' não declarado` |
| Colisão de nomes | `'CARD' já definido como macro; não pode ser redefinido como template` |
| Nome com minúscula inicial | `nome de template deve começar com letra maiúscula: 'card'` |
| Recursão detectada | `recursão detectada: CARD → CARD` (ou cadeia completa) |
| Template chamado mas não definido | `'CARD' não definido` |
| Sintaxe Vento inválida | `template 'CARD': erro de sintaxe na linha X: ...` |

Todos os erros apontam para a **linha e coluna do arquivo `.tjp` original**,
não para o corpo renderizado — isso é essencial para usabilidade. Na
implementação, isso significa carregar o `SourceFileInfo` da chamada através do
lookup, da validação de argumentos e da renderização (padrão já usado pelo
MessageHandler).

> A exemplo das demais extensões de linguagem do port, as mensagens seguem o
> sistema i18n de mensagens; na v1 multilíngue do motor, a diretiva
> `language "..."` do arquivo rege o idioma da mensagem.

---

## 6. Compatibilidade e migração

### 6.1 Compatibilidade com TaskJuggler original

- Arquivos `.tjp` sem `template` são processados **exatamente** como no
  TaskJuggler original.
- Macros mantêm semântica, sintaxe e ordem de expansão originais.
- Nenhuma macro existente precisa ser alterada para continuar funcionando.

### 6.2 Migração incremental

A coexistência permite que um projeto migre aos poucos:

1. Comece adicionando um `template` que apenas reaproveita macros existentes.
2. Introduza condicionais onde antes havia duplicação.
3. Substitua laços manuais por `{{ for }}`.
4. Ao final, macros puramente textuais podem ser convertidas em templates
   (desde que o nome seja mantido — o namespace é compartilhado).

---

## 7. Decisões de implementação no port

### 7.1 Dependência

- **Vento** via `npm:ventojs` (nome/versão confirmados no kickoff; padrão do
  repo: dependência declarada no `imports` do `packages/core/deno.jsonc`, sem
  `node_modules`). Precedente de dep npm no core: `micromark` (Fase 13).
- Instância do engine configurada **sem autoescape** (garantia §4.8) e com as
  funções do contexto (§4.7) injetadas por render.

### 7.2 Ponto de expansão: o scanner, como no Ruby

- A definição `template` é coletada no **corpo do projeto** pelo parser FSM
  (mesma transição das macros; subfase 23.2).
- O caminho `${...}` existente em `scanner.ts::expandMacro` (port de Ruby
  `l.450-464`) ganha o **ramo único** do lookup unificado (§4.5): macro →
  comportamento atual intocado; template → Fase 1 (macros no corpo) + Fase 2
  (`env.runString`).
- O texto expandido **reentra no stream do scanner** como input normal (mesma
  mecânica das macros), o que dá composição e recursão de graça — e é onde a
  proteção anti-recursão conta a profundidade/cadeia (§4.6).

### 7.3 Registro unificado

- `MacroTable` passa a guardar entradas tipadas `{ kind: "macro" | "template" }`
  (ou registro paralelo com chave comum — decidir em 23.1 mantendo o contrato
  `macroDefined` existente).
- Colisão de nome é erro **na definição**, com mensagem do §5.

### 7.4 Contexto por chamada

- `project`, `ids`, `expandTemplate`, `expandMacro` são fechados sobre a
  instância do projeto no momento da expansão (I/O zero, fiel à regra de core
  puro).
- Expressões na chamada (argumentos, §4.2) avaliam no mesmo contexto —
  `isMilestone(!t1)` usa o motor de expressões lógicas já portado (Fase 11).

### 7.5 i18n e keywords

- A keyword `template` é registrada no sistema i18n seguindo o **padrão das
  extensões já existentes** (`material`, `picture`, `timebasis`), com variantes
  PT/ES alongside.

### 7.6 Golden e regressão

- Por ser extensão **sem correspondente Ruby**, os snapshots de expansão vivem
  no pipeline TS-only (política já registrada para extensões), não no golden
  oracle `tj3`.
- Regressão macro: os suites de parser/lexer da Fase 10 servem de guarda —
  arquivo sem `template` não pode ter comportamento alterado.

### 7.7 Baseline macro: auditoria antes da expansão (não é re-port)

O port completo das macros é da **Fase 10** (§1, nota de baseline). Ainda assim,
a Fase 23 assume a guarda dessa base, porque todo o design de template depende
dela (Fase 1 da expansão §4.4, lookup unificado §4.5, reentrada no stream §7.2).
No kickoff:

1. Rodar as suítes de macro/lexer (`packages/core/tests/lexer/`) e os golden
   que exercitam `${...}`.
2. Conferir ponto a ponto contra `TextParser/MacroTable.rb` e `scanner.rb`:
   `resolve` (`${1}`/`${?OPT}`/`$${`), mensagem de macro não definida,
   `macroStack`/`cleanupMacroStack` no fim de stream, corpo `macro` com `]`
   no fim da linha.
3. **Qualquer divergência encontrada é corrigida nesta fase** (convenção do
   repo: dívida detectada se corrige imediatamente, não se adia), em commit
   próprio `fix(lexer): macro-baseline` **antes** de iniciar 23.2.
4. Nada daqui justifica re-port: se a auditoria passar (caso esperado), segue
   direto para 23.1 com o checklist registrado no arquivo de tarefas.

---

## 8. Estratégia de testes

Convenções: TDD com BDD (`@std/testing/bdd` + `@std/assert`); sem `any` em
`src/`.

| Alvo | Método | Critério |
|---|---|---|
| Definição `template ... [ ] ( ... )` no FSM | unit (parser/lexer) | corpo multi-linha, `]` no fim da linha, params vazios/omitidos |
| Lookup unificado e colisões | unit | macro+macro, template+template, macro+template → erro com tipo do 1º registro |
| Fase 1 (macros dentro de corpo) | unit | `${MACRO}` e `${MACRO "arg"}` expandidos antes do Vento |
| Fase 2 (render Vento) | unit | `{{ }}`, if/for/set/pipes; `{{ /for }}` etc. |
| Argumentos nomeados | unit | faltante, não declarado, string/número/bool/`!id`/lista/objeto/expressão |
| Contexto | unit | `project.*`, `ids()`, `expandTemplate`, `expandMacro`, precedência de parâmetros (aviso em colisão) |
| Recursão | unit | auto-recursão e mutua com **cadeia completa** na mensagem |
| Ordem de definição | unit | template chamando template futuro → erro |
| Escape | unit | sem autoescape; filtro `escape` explícito funciona |
| Localização de erro | unit | `file:line:col` do `.tjp` original em todos os erros do §5 |
| Regressão macro | unit/suite existente | suítes da Fase 10 verdes sem ajustes de comportamento |
| Snapshots TS-only | golden extension | expansão de fixtures `template-*.tjp` congelada em `packages/core/tests/golden/` |
| Integração com motor | integração | tasks geradas por template agendam idênticas às equivalentes escritas à mão (esforço, dependências, alocações) |
| Extensão ↔ relatório | integração (opcional, se CLI Fase 24 disponível) | `syntaxmesh` CLI processa fixture com template e gera relatório |

---

## 9. Convenções e anti-padrões

### Convenções

1. Extensão TS-only: **nunca** comparável ao oracle Ruby; snapshots próprios.
2. Macro não tocada: comportamento de `${...}` de macro permanece byte-a-byte
   fiel ao port da Fase 10.
3. Corpo de template é **texto** até a chamada; nada é interpretado no registro.
4. Erros com `SourceFileInfo` da **chamada/definição original**, nunca do
   corpo renderizado.
5. Keyword registrada no i18n no padrão das extensões existentes.
6. Recursão é erro, não stack overflow — sempre com cadeia de chamadas.

### Anti-padrões

- ❌ Reimplementar a expansão de macros na Fase 23 — ela já existe (Fase 10);
  estender o lookup com um ramo, não duplicar o caminho (§7.7).
- ❌ Macro conter chamada de template (proibido por design, §4.4).
- ❌ Permitir autoescape (quebraria geração de `.tjp`).
- ❌ Renderizar template com estado do scheduler "meio agendado" — expansão é
  pré-processamento, antes do modelo.
- ❌ Dois registos (macro/template) separados que exigem heurística no `${FOO}`.
- ❌ Avaliar argumentos com `eval` próprio — usar o motor de expressões da
  Fase 11.
- ❌ Adicionar sintaxe de escape/interpolação concorrente (`#{}`, `%{}` etc.).

---

## 10. Subfases (índice para o arquivo de tarefas)

O detalhamento atômico está em [`fase-23-template-tarefas.md`](./fase-23-template-tarefas.md),
no padrão dos blocos das fases anteriores:

| # | Subfase | Entrega | Pré-requisito |
|---|---|---|---|
| 23.0 | ADR da fase | `decisoes/0NN-elemento-template.md` (número na ordem de criação) + linha no README | — |
| 23.1 | Fundação: dep Vento + registro unificado | `ventojs` no core; `MacroTable` com `kind` macro/template; erros de colisão | 23.0 |
| 23.1b | Auditoria do baseline macro (Fase 10) | checklist §7.7 no arquivo de tarefas; divergência vira `fix(lexer): macro-baseline` antes de 23.2 | 23.1 |
| 23.2 | Parser: declaração `template` | keyword i18n; transição FSM no corpo do projeto; corpo `[ ]` + params `( )` | 23.1b (gate) |
| 23.3 | Expansão em duas fases | Fase 1 macros no corpo; Fase 2 `env.runString` com contexto (§4.7); reentrada no stream | 23.2 |
| 23.4 | Chamada com argumentos nomeados | parser de argumentos (§4.2: string/número/bool/`!id`/lista/objeto/expressão); validação faltante/não declarado | 23.3 |
| 23.5 | Proteções | recursão com cadeia; ordem de definição; erros localizados (`file:line:col`) | 23.3–23.4 |
| 23.6 | Composição | `expandTemplate`/`expandMacro`/`expandTemplateList` no contexto; templates chamando templates | 23.4 |
| 23.7 | Testes e snapshots | suíte BDD completa (§8); golden TS-only; regressão macro verde | 23.5 |
| 23.8 | Documentação e verificação final | docs de referência da keyword (insumo p/ `lsp-core` da Fase 22); `check-all`+`test`; `CURRENT.md`/`plano.md` | todas |

Ordem de execução: 23.0 → 23.1 → … → 23.8 (linear).

Commits por subfase: `feat(parser): template-registry`, `feat(parser):
template-declaration`, `feat(lexer): template-expansion`, `feat(lexer):
named-args`, `test(parser): template-recursion`, `chore(docs): ADR template`,
`test(golden): template-snapshots`.

---

## 11. Quadro-resumo

| Recurso | Macro | Template |
|---|---|---|
| Palavra-chave | `macro` | `template` |
| Delimitador do corpo | `[ ... ]` | `[ ... ]` |
| Argumentos | Posicionais (`${1}`, `${2}`) | Nomeados (`id=...`, `nome=...`) |
| Semântica | Substituição textual pura | Renderização via Vento |
| Lógica (`if`/`for`) | ❌ | ✅ |
| Expressões JS | ❌ | ✅ |
| Chamadas dentro de si | ❌ | ✅ (via `expandTemplate`) |
| Uso dentro do outro | ✅ (dentro de template) | ❌ (dentro de macro) |
| Escape HTML | N/A | Desativado por padrão |
| Namespace | Compartilhado | Compartilhado |

O novo elemento `template` amplia o poder do port sem sacrificar a
compatibilidade, oferece uma sintaxe familiar (colchetes como nas macros) e
uma separação clara de responsabilidades: **macros para texto, templates para
lógica**.

---

## 12. Referências cruzadas

- **Especificação completa** deste documento: §4 (sintaxe), §5 (erros), §6
  (compatibilidade), §7 (implementação).
- `docs/syntaxmesh/fases/fase-10-parser-linguagem.md` /
  `fase-10-parser-linguagem-tarefas.md` — macros, scanner, FSM (base que não
  pode regredir).
- `packages/core/src/lexer/macro-table.ts`,
  `packages/core/src/lexer/scanner.ts` (`expandMacro`),
  `packages/core/src/lexer/project-file-scanner.ts` — pontos de junção.
- `docs/syntaxmesh/fases/fase-10-complemento-tarefas.md` — padrão de registro
  de extensões de linguagem (material/picture/timebasis) e suas keywords i18n.
- `docs/syntaxmesh/fases/fase-11-logica-queries.md` — motor de expressões usado
  nos argumentos-expressionais.
- `docs/syntaxmesh/fases/fase-22-vscode-extension.md` — grammar/completions e
  manual (`lsp-core`) devem incluir `template`; rodar a 23 antes da 22.
- `scripts/golden/README.md` — política de snapshots de extensões TS-only.
- Vento: https://vento.js.org/ (`env.runString`, pipes, `set`, loops).
- `docs/syntaxmesh/cheat-sheet-ruby-ts.md` — diferenças Ruby↔TS relevantes ao
  mexer no scanner.
- `docs/taskjuggler/lib/taskjuggler/TextParser/MacroTable.rb` e
  `docs/taskjuggler/lib/taskjuggler/parser/scanner.rb` — ground truth do
  baseline macro auditado em §7.7.

---

**Fim do plano da Fase 23 (elemento estendido `template` — Vento).**
