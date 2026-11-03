# Novo Elemento `template` no TaskJuggler Port

## 1. Motivação

O TaskJuggler original possui apenas **macros**, que realizam substituição textual simples com argumentos posicionais (`${1}`, `${2}`, ...). Isso é suficiente para reutilização básica, mas não permite lógica de controle (condicionais, laços), tornando projetos grandes repetitivos e difíceis de manter.

Para resolver isso **sem quebrar a compatibilidade** com arquivos `.tjp` existentes, o port introduz um novo elemento: **`template`**, alimentado pela engine [Vento](https://vento.js.org/).

A convivência dos dois mecanismos é um princípio de projeto:

- **Macros** continuam com semântica idêntica ao TaskJuggler original (substituição textual pura).
- **Templates** adicionam lógica, expressões e composição via Vento.
- **Macros podem ser chamadas dentro de templates**, permitindo migração incremental.
- **Templates podem ser chamados dentro de templates**, permitindo composição.

---

## 2. Sintaxe de Definição

Um template é declarado com a palavra-chave `template`, seguido do nome, do corpo entre **colchetes `[ ]`** (igual às macros) e da **lista de parâmetros nomeados** entre parênteses.

```taskjuggler
template NOME [ corpo do template ] (param1, param2, ...)
```

### Regras

| Aspecto | Regra |
|---|---|
| Nome | Deve começar com **letra maiúscula** (mesma regra das macros). Nomes em minúsculas são reservados para futuras expansões internas. |
| Corpo | Delimitado por `[ ]`, com o `]` de fechamento sendo o **último caractere da linha** (mesma regra das macros). |
| Parâmetros | Lista entre `( )`, separada por vírgulas. Cada parâmetro é um identificador válido. A lista pode ser vazia ou omitida. |
| Escopo de definição | Global (nível superior do projeto), processado antes das chamadas. |

### Exemplo mínimo

```taskjuggler
template CARD [ 
  task {{ id }} "{{ nome }}" { effort {{ esforco }} }
] (id, nome, esforco)
```

### Exemplo sem parâmetros

```taskjuggler
template HEADER [ 
  # Projeto: {{ project.name }}
] ()
```

---

## 3. Sintaxe de Chamada

Templates são chamados com a mesma notação `${ ... }` das macros, mas com **argumentos nomeados**:

```taskjuggler
${NOME param1=valor1 param2=valor2}
```

### Regras

- Argumentos são **obrigatórios para cada parâmetro declarado**. Faltas geram erro com o nome do parâmetro ausente.
- Argumentos **não declarados** também geram erro (proteção contra typos silenciosos).
- Valores podem ser:
  - **String**: `"texto com espaços"` ou `"texto"`.
  - **Número**: `42`, `3.14`.
  - **Booleano**: `true`, `false`.
  - **Referência a ID do TaskJuggler**: `!t1`, `!res1` (preserva a sintaxe nativa).
  - **Lista**: `[!t1, !t2, !t3]`.
  - **Objeto literal**: `{ chave: valor, ... }`.
  - **Expressão**: `1 + 2`, `isMilestone(!t1)` (avaliada no contexto do projeto).

### Exemplo

```taskjuggler
${CARD id="t1" nome="Design" esforco="5d"}
${CARD id="t2" nome="Implementação" esforco="10d"}
```

---

## 4. Interpolação e Expressões (Vento)

Dentro do corpo do template, você usa a sintaxe do Vento. **O escape HTML está desativado por padrão**, então tudo é tratado como texto puro — ideal para gerar `.tjp`.

### 4.1 Impressão de valores

```taskjuggler
{{ variavel }}
{{ expression.q }
{{ project.name }}
{{ tarefa.esforco * 2 }}
```

### 4.2 Condicionais

```taskjuggler
{{ if disponivel }}
  allocate {{ recurso }}
{{ else if alternativo }}
  allocate {{ alternativo }}
{{ else }}
  # Sem alocação
{{ /if }}
```

### 4.3 Laços

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

### 4.4 Variáveis locais

```taskjuggler
{{ set total = 0 }}
{{ for t of tarefas }}
  {{ set total = total + parseDuration(t.esforco) }}
{{ /for }}
# Total: {{ total }}
```

### 4.5 Pipes e filtros

```taskjuggler
{{ nome |> toUpperCase }}
{{ lista |> JSON.stringify }}
{{ descricao |> escape }}
{{ lista |> empty }}
```

---

## 5. Macros Dentro de Templates

Uma das grandes vantagens da convivência: **macros continuam funcionando normalmente dentro de templates**. Isso permite:

- Migrar projetos gradualmente (um template pode reaproveitar macros existentes).
- Reaproveitar lógica textual já validada.
- Manter a compatibilidade de código legado.

### Exemplo

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

### Como funciona tecnicamente

A expansão de macros dentro de um template ocorre **em duas fases**:

1. **Fase 1 — Expansão de macros**: antes de renderizar o template com o Vento, o port percorre o corpo do template substituindo todas as chamadas `${MACRO}` e `${MACRO "arg"}` pelos seus corpos expandidos. Macros com argumentos posicionais são resolvidas nesta fase.
2. **Fase 2 — Renderização com Vento**: o texto resultante (agora com macros já expandidas) é passado para `env.runString()` do Vento com o contexto dos parâmetros nomeados.

Essa ordem garante que:

- Uma macro pode **conter** uma chamada a template? **Não** — macros são estritamente textuais e a expansão é linear; chamadas `${TEMPLATE ...}` dentro de uma macro só funcionariam se o template fosse resolvido antes, o que não é o caso.
- Um template **pode conter** chamadas de macro. ✅
- Um template **pode conter** chamadas de outro template, desde que o template chamado já esteja definido e que a chamada esteja dentro de `{{ }}` ou em uma tag do Vento. ✅

### Chamada de templates dentro de templates

Um template pode chamar outro usando a sintaxe nativa do Vento ou uma extensão. Recomendamos a forma explícita via interpolação para permitir composição:

```taskjuggler
template WRAPPER [
  {{ set inner = expandTemplate("CARD", { id: id, nome: nome, esforco: esforco }) }}
  {{ inner }}
] (id, nome, esforco)
```

Onde `expandTemplate(nome, args)` é uma função exposta pelo port ao contexto do Vento. Isso permite encadear templates com controle total sobre a ordem de avaliação.

---

## 6. Resolução de Nomes e Namespaces

Para eliminar ambiguidade no parser, as **macro e template compartilham o mesmo espaço de nomes**.

### Regras de unicidade

- Dois elementos com o mesmo nome (dois templates, duas macros, ou um de cada) **geram erro na definição**.
- A mensagem de erro identifica o tipo do primeiro registro:

  ```
  'ALLOCATE' já definido como macro; não pode ser redefinido como template
  ```

### Por que compartilhar o namespace?

Se permitíssemos coexistência de `macro FOO` e `template FOO`, a chamada `${FOO}` seria ambígua e o parser precisaria de heurísticas. Compartilhar o namespace elimina essa classe de erros.

### Lookup em tempo de expansão

Quando o parser encontra `${NOME ...}`:

1. Busca `NOME` no registro unificado.
2. Se for `macro` → caminho de substituição textual (compatível com TJ original).
3. Se for `template` → caminho de renderização Vento com contexto de parâmetros nomeados.
4. Se não existir → verifica se é uma chamada opcional (`${?NOME}`) e, se sim, expande para vazio; senão, erro.

---

## 7. Ordem de Avaliação

A avaliação segue uma ordem determinística, projetada para permitir composição sem surpresas:

1. **Parse do arquivo** — todas as definições (`macro`, `template`) são coletadas.
2. **Registro com validação** — colisões de nome são detectadas aqui.
3. **Expansão de chamadas, top-down**:
   - Chamada de macro → substituição textual + expansão de argumentos posicionais.
   - Chamada de template → expansão de macros no corpo, depois renderização Vento.
4. **Pós-processamento** — o resultado (texto puro) segue para o interpretador TaskJuggler.

### Proteções

- **Detecção de recursão**: se um template ou macro se referenciar direta ou indiretamente, o port lança erro com a cadeia de chamadas.
- **Ordem de definição**: um template pode chamar apenas templates definidos anteriormente no arquivo (ou qualquer macro já registrada).

---

## 8. Contexto de Execução do Template

Ao renderizar um template, o contexto fornecido ao Vento é um objeto plano com:

| Chave | Origem | Exemplo |
|---|---|---|
| `<cada parâmetro>` | Argumentos nomeados da chamada | `id`, `nome`, `esforco` |
| `project` | Metadados do projeto (somente leitura) | `project.name`, `project.start` |
| `ids` | Função para resolver referências a IDs do projeto | `ids("t1")` |
| `expandTemplate` | Função para invocar outro template | `expandTemplate("CARD", {...})` |
| `expandMacro` | Função para invocar uma macro a partir de string | `expandMacro("ALLOCATE_TEAM")` |

Os parâmetros nomeados têm **precedência** sobre as chaves globais em caso de colisão (mas isso gera um aviso se ocorrer).

### Exemplo

```taskjuggler
template SUMMARY [
  # {{ project.name }}
  {{ for t of expandTemplateList("TASK_LINE", tarefas) }}
    {{ t }}
  {{ /for }}
] (tarefas)
```

> `expandTemplateList` é uma conveniência opcional que renderiza o mesmo template para cada item de uma lista e retorna o array de resultados.

---

## 9. Escape e Texto Puro

Como o port gera **TaskJuggler** (não HTML), o escape HTML é **indesejado e desativado**.

- O Vento, por padrão, **não escapa** — comportamento adotado.
- Se você precisar do comportamento oposto (por exemplo, escapar entidades em uma string que vai virar nome de tarefa), use o filtro `escape` explicitamente:
  ```taskjuggler
  {{ nome |> escape }}
  ```
- O port **não** habilita autoescape em nenhum momento. Isso é uma garantia documentada.

---

## 10. Exemplos Completos

### 10.1 Geração de tarefas parametrizadas

```taskjuggler
macro TEAM [ allocate dev1, dev2 ]

template TASK_WITH_TEAM [
  task {{ id }} "{{ nome }}" {
    effort {{ esforco }}
    ${TEAM}
    {{ if depends }}
      depends {{ depends }}
    {{ /if }}
  }
] (id, nome, esforco, depends)

${TASK_WITH_TEAM id="t1" nome="Análise" esforco="3d" depends=""}
${TASK_WITH_TEAM id="t2" nome="Implementação" esforco="10d" depends="!t1"}
```

### 10.2 Laço com dados compostos

```taskjuggler
template TASKS_BULK [
  {{ for t of tarefas }}
    task {{ t.id }} "{{ t.nome }}" {
      effort {{ t.esforco }}
      {{ if t.milestone }}milestone{{ /if }}
    }
  {{ /for }}
] (tarefas)

${TASKS_BULK tarefas=[
  { id: "a", nome: "Planejamento", esforco: "2d", milestone: false },
  { id: "b", nome: "Kickoff", esforco: "0d", milestone: true }
]}
```

### 10.3 Composição de templates

```taskjuggler
template HEADER [
  project {{ nome }} "{{ titulo }}" {{ versao }} {{ dataInicio }} +{{ duracao }}
] (nome, titulo, versao, dataInicio, duracao)

template FOOTER [
  # Fim do relatório — gerado em {{ timestamp }}
] (timestamp)

template REPORT [
  {{ expandTemplate("HEADER", { nome: nome, titulo: titulo, versao: versao, dataInicio: inicio, duracao: dur }) }}
  {{ for t of tarefas }}
    task {{ t.id }} "{{ t.nome }}" { effort {{ t.esforco }} }
  {{ /for }}
  {{ expandTemplate("FOOTER", { timestamp: now }) }}
] (nome, titulo, versao, inicio, dur, tarefas)
```

---

## 11. Erros e Validações

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

Todos os erros apontam para a **linha e coluna do arquivo `.tjp` original**, não para o corpo renderizado — isso é essencial para usabilidade.

---

## 12. Compatibilidade e Migração

### 12.1 Compatibilidade com TaskJuggler original

- Arquivos `.tjp` sem `template` são processados **exatamente** como no TaskJuggler original.
- Macros mantêm semântica, sintaxe e ordem de expansão originais.
- Nenhuma macro existente precisa ser alterada para continuar funcionando.

### 12.2 Migração incremental

A coexistência permite que um projeto migre aos poucos:

1. Comece adicionando um `template` que apenas reaproveita macros existentes.
2. Introduza condicionais onde antes havia duplicação.
3. Substitua laços manuais por `{{ for }}`.
4. Ao final, macros puramente textuais podem ser convertidas em templates (desde que o nome seja mantido — o namespace é compartilhado).

---

## 13. Resumo

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

O novo elemento `template` amplia o poder do port sem sacrificar a compatibilidade, oferece uma sintaxe familiar (colchetes como nas macros) e uma separação clara de responsabilidades: **macros para texto, templates para lógica**.