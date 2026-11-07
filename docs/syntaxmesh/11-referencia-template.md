# Referência — elemento `template` (Vento)

> **Status:** ✅ Fase 23 concluída (2026-11-06)
> **ADR:** [033 — Elemento `template` (Vento)](decisoes/033-elemento-template.md)
> **Plano:** [`fases/fase-23-template.md`](fases/fase-23-template.md)
> **Tarefas:** [`fases/fase-23-template-tarefas.md`](fases/fase-23-template-tarefas.md)
> **Consumidor previsto:** grammar/completions/help do `lsp-core` (Fase 22)

Este documento é a **referência normativa** do elemento `template`: o que é
aceito, o que é executado e como cada erro se manifesta. Ele descreve a
implementação atual do port — não uma proposta.

O `template` é uma **extensão SyntaxMesh**, sem correspondente no TaskJuggler
3.8.4. Não existe oracle `tj3` para o que é expandido: a fidelidade é contra
esta referência e contra os snapshots determinísticos em
`packages/core/tests/golden/template.golden.json`. A base que ele estende
(**macros**) é o port fiel do Ruby e está **congelada** — nenhum comportamento
de macro mudou na Fase 23.

---

## 1. Declaração

```taskjuggler
template NOME [ corpo ] (param1, param2, ...)
```

| Aspecto | Regra |
| --- | --- |
| Nome | `[A-Z][A-Za-z0-9_]*` — precisa começar com maiúscula. |
| Corpo | Entre colchetes `[ ]`, com o `]` de fechamento **no fim da linha** (mesma regra da macro). |
| Parâmetros | Lista entre parênteses, separada por vírgula. Pode ser vazia (`()`) ou omitida. |
| Local | **A mesma condição da `macro`**: prolog (antes de `project`) ou nível de propriedades (depois do `}` do cabeçalho). **Nunca** dentro do bloco `{ }` do `project`, nem dentro de `task`, `resource` etc. |
| Momento | O corpo é guardado **cru**: nada é interpretado no registro. |

```taskjuggler
project acme "ACME" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
}

# `template` fica fora do bloco `{ }` — igual à `macro`.
template CARD [
  task {{ id }} "{{ nome }}" {
    effort {{ esforco }}
  }
] (id, nome, esforco)

template HEADER [
  # Projeto: {{ project.name }}
] ()
```

A regra vale também para `template`/`macro` num arquivo de propriedades de
relatório (`reportPropertiesBody`): o namespace é único, a colocação idem.
Definir um `template` dentro do bloco do cabeçalho produz
`Unexpected token 'template' found.` (mesmo erro que a `macro` dava no Ruby).

Uma definição com nome em minúscula (`template card …`) é **erro**, não
reserva silenciosa: `template_bad_name`.

## 2. Chamada

```taskjuggler
${NOME param1=valor1 param2=valor2}
```

| Regra | Detalhe |
| --- | --- |
| Obrigatoriedade | Todo parâmetro declarado precisa ser fornecido (`template_missing_param`). |
| Estrito | Argumento não declarado é erro (`template_unknown_param`) — proteção contra typos. |
| Uma linha | A chamada inteira precisa caber em uma linha (o padrão do scanner é ancorado na linha corrente). |
| Opcional | `${?NOME …}` com template inexistente expande para vazio, sem erro. |
| Sem argumentos | `${NOME}` é resolvido pelo caminho normal de macro quando não existe template com esse nome (`undefined_macro`), preservando o comportamento do Ruby. |

O texto renderizado **reentra no stream** do scanner como se tivesse sido
digitado. É isso que faz uma chamada produzida dentro do render
(`${OUTRO …}`) expandir em cascata.

### 2.1 Tipos de valor aceitos

| Tipo | Sintaxe | Valor em Vento |
| --- | --- | --- |
| String | `nome="Design"`, `nome='Design'` | `string` |
| Número | `esforco=5`, `fator=3.14` | `number` |
| Booleano | `fim=true`, `fim=false` | `boolean` |
| Referência a ID | `dep=!t1` | `string` — o `!` é preservado para o TJP |
| Lista | `tarefas=[!a, !b]` | `Array` |
| Objeto literal | `meta={ chave: "v", n: 2 }` | objeto plano |
| Aritmética | `dias=1 + 2 * 3` | `number` (parser recursivo próprio) |
| Chamada de função | `ms=isMilestone(!m1)` | avaliada pelo motor lógico (Fase 11), quando injetado; senão permanece texto |

```taskjuggler
${CARD id="t1" nome="Design" esforco="5d"}
${PHASE id="f1" tarefas=[!a, !b] meta={ dono: "tux", sprint: 2 }}
```

## 3. Corpo: sintaxe do Vento

O corpo é renderizado pelo Vento (`env.runString`), com **autoescape
desativado** — o alvo é TaskJuggler, não HTML. O filtro `escape` continua
disponível quando alguém quiser o comportamento oposto.

```taskjuggler
template PHASE [
  {{ if marco }}
    milestone {{ id }} "{{ nome }}"
  {{ else }}
    task {{ id }} "{{ nome }}" {
      effort {{ esforco }}
      {{ for r of recursos }}
        allocate {{ r }}
      {{ /for }}
    }
  {{ /if }}
] (id, nome, esforco, marco, recursos)
```

Suportado: `{{ valor }}`, `{{ if }}`/`{{ else if }}`/`{{ else }}`/`{{ /if }}`,
`{{ for x of lista }}`/`{{ for k, v of obj }}`/`{{ /for }}`, `{{ set x = … }}`,
pipes (`{{ nome |> toUpperCase }}`).

### 3.1 Listas e `for`

Listas entram como argumento em três sabores (ver §2.1):

| Sabor | Chamada | Cada item é… |
| --- | --- | --- |
| Lista de strings/números | `passos=["Análise", "Design"]` | o valor |
| Lista de objetos | `pessoas=[{ id: "ana", nome: "Ana" }]` | objeto — acessível por `.campo` |
| Lista de referências | `deps=[!t1, !t2]` | o texto `!t1`, `!t2` |

No corpo, o `for` do Vento tem três formas — **a ordem dos nomes importa**:

```taskjuggler
template STEPS [
{{ for i, passo of passos }}
  task {{ id }}_{{ i }} "{{ passo }}" { effort 1d }
{{ /for }}
] (id, passos)

${STEPS id="s" passos=["Análise", "Design", "Build"]}
```

| Forma | Produz |
| --- | --- |
| `{{ for x of lista }}` | `x` = valor |
| `{{ for i, x of lista }}` | `i` = **índice 0-based**, `x` = valor |
| `{{ for k, v of mapa }}` | `k` = chave, `v` = valor (equivalente a `Object.entries`) |

`toIterator` aceita array, objeto, string e número. Lista vazia **não** gera
texto nem erro.

> **Não existe `loop`.** `{{ loop.index }}` estoura com
> `template_render_error` — use `for i, x of …`, que já entrega o índice.

Um exemplo completo e copiável vive em
`packages/core/tests/fixtures/templates/lists-for.tjp` (task por item de lista
de strings, resource por item de lista de objetos, `allocate` por entrada de
mapa e `depends` montado com o filtro `join`); o comportamento é fixado por
`packages/core/tests/lexer/template-lists_test.ts`.

## 4. Macros dentro de templates (as duas fases)

Macros continuam valendo dentro do corpo — é o caminho de migração gradual.

```taskjuggler
macro ALLOCATE_TEAM [ allocate tux1, tux2, tux3 ]

template DEV_TASK [
  task {{ id }} "{{ nome }}" {
    effort {{ esforco }}
    ${ALLOCATE_TEAM}
  }
] (id, nome, esforco)
```

A expansão tem **duas fases**:

1. **Fase 1 — macros do corpo.** Cada `${MACRO}` e `${MACRO "arg"}` do corpo é
   substituído textualmente antes de qualquer render.
2. **Fase 2 — render Vento.** O texto resultante é renderizado com os
   parâmetros; o resultado é injetado no stream e reescaneado como TJP.

Consequências diretas:

- Um template **pode** conter chamadas de macro. ✅
- Uma macro **não pode** conter chamada de template — macros são textuais e a
  expansão é linear; a chamada `${TEMPLATE …}` só existe depois do render. ❌
- Um template **pode** chamar outro template, desde que o chamado já esteja
  definido, usando `expandTemplate` (§5).

## 5. Composição

| Global | Assinatura | Efeito |
| --- | --- | --- |
| `expandTemplate` | `(nome, args) → string` | Renderiza outro template **inline**, sem injetar no stream. |
| `expandTemplateList` | `(nome, lista) → string[]` | Renderiza o template para cada item da lista. Item primitivo é ligado ao **primeiro** parâmetro declarado. |
| `expandMacro` | `(nome, …args) → string` | Resolve uma macro textual a partir de string. |
| `ids` | `(id) → string` | Devolve o `fullId` do nó, ou o próprio id se não existir. |
| `project` | objeto congelado | `id`, `name`, `version`, `start`, `end`, `now`, `currency`. |

```taskjuggler
template WRAPPER [
  {{ set linha = expandTemplate("CARD", { id: id, nome: nome, esforco: "5d" }) }}
  {{ linha }}
  {{ for l of expandTemplateList("CARD", extras) }}
    {{ l }}
  {{ /for }}
] (id, nome, extras)
```

`project` é `Object.isFrozen(project) === true` no corpo: leitura apenas. Um
parâmetro com o mesmo nome de uma global **tem precedência** e emite o warning
`template_shadowed_global` (a renderização continua).

## 6. Namespace e i18n

Macros e templates compartilham **um único namespace**. Motivo: `${NOME}`
seria ambíguo se os dois pudessem coexistir.

- `macro FOO` + `template FOO` → `template_redefined` (cita o tipo do primeiro
  registro: `'FOO' já definido como macro; não pode ser redefinido como template`).
- `template FOO` + `macro FOO` → o caminho da macro mantém a mensagem do Ruby
  (`name_redefined`), e a macro substitui a entrada.

O keyword é traduzido como as demais keywords de extensão:

| Idioma | Keyword |
| --- | --- |
| `en` | `template` |
| `pt-BR` | `modelo` |
| `es` | `plantilla` |

Equivalência de AST entre os três idiomas: `packages/core/tests/ast-equivalence_test.ts`
(23.7.8).

## 7. Proteções

| Proteção | Comportamento |
| --- | --- |
| Recursão | Detectada antes de renderizar. A mensagem traz a cadeia completa: `recursão detectada: A → B → A`. |
| Profundidade | Teto de 20 chamadas de template aninhadas; acima disso, `macro_stack_overflow`. |
| Ordem | Só é possível chamar templates já definidos; um erro claro substitui o comportamento indefinido. |
| Opcional | `${?NOME …}` inexistente é vazio silencioso (mesma semântica da macro opcional). |
| Falha do Vento | Erro de sintaxe ou de execução interrompe **só** aquele template, com `template_syntax_error` / `template_render_error`, e o parse continua. |

## 8. Tabela de erros

Todos os erros saem pelo `MessageHandler` (nada lança), com o `SourceFileInfo`
do `.tjp` **original** — nunca do corpo renderizado. Matriz executável:
`packages/core/tests/lexer/template-errors_test.ts`.

| Situação | id | Mensagem |
| --- | --- | --- |
| Parâmetro não fornecido | `template_missing_param` | `template 'CARD': parâmetro 'esforco' não fornecido` |
| Parâmetro não declarado | `template_unknown_param` | `template 'CARD': parâmetro 'esforcoo' não declarado` |
| Colisão de nomes | `template_redefined` | `'CARD' já definido como macro; não pode ser redefinido como template` |
| Nome com minúscula inicial | `template_bad_name` | `nome de template deve começar com letra maiúscula: 'card'` |
| Recursão detectada | `template_recursion` | `recursão detectada: CARD → CARD` |
| Template chamado mas não definido | `template_not_defined` | `'CARD' não definido` |
| Sintaxe Vento inválida | `template_syntax_error` | `template 'CARD': erro de sintaxe na linha N: …` |
| Execução Vento inválida | `template_render_error` | `template 'CARD': erro de execução na linha N: …` |
| Parâmetro sombreia global | `template_shadowed_global` (warning) | `template 'CARD': parâmetro 'project' sobrescreve a chave global de mesmo nome` |
| Profundidade/limite do stream | `macro_stack_overflow` | `Too many nested macro calls.` |

`template_unknown_param` vem antes de `template_missing_param`: um typo
(`esforcoo`) é a causa mais comum do "parâmetro faltante", e a mensagem do typo
aponta o conserto certo.

## 9. Onde está no código

| Arquivo | Papel |
| --- | --- |
| `packages/core/src/lexer/template-engine.ts` | Único importador de `ventojs`; wrapper fino (`render`). |
| `packages/core/src/lexer/macro-table.ts` | `MacroTable` unificado, `Template`, `kindOf`, `lookup`, `addTemplate`. |
| `packages/core/src/lexer/template-arguments.ts` | Leitura e tipagem dos argumentos nomeados (sem `eval`). |
| `packages/core/src/lexer/scanner.ts` | Ramo de expansão de template em `expandMacro` (§4.4), duas fases, contexto, proteções. |
| `packages/core/src/lexer/project-file-scanner.ts` | Padrão de chamada `${NOME k=v …}` e token `TEMPLATE`. |
| `packages/core/src/parser/rules/common.ts` | Rules `macro`/`template`: registro, colisão, nome inválido. |
| `packages/core/src/parser/rules/project.ts` | Colocação (23.9): `!template` em `projectProlog` e `propertiesBody` — **não** em `projectBodyAttributes`. |
| `packages/core/src/parser/rules/report.ts` | `!template` em `reportPropertiesBody`, ao lado de `!macro`. |
| `packages/core/src/parser/project-file-parser.ts` | Provedores de contexto (`project`, `ids`) ligados no `open`. |

Testes e fixtures:

| Caminho | Cobre |
| --- | --- |
| `tests/lexer/template-engine_test.ts` | Wrapper do Vento. |
| `tests/lexer/template-arguments_test.ts` | Parser de argumentos (tipos e falhas). |
| `tests/lexer/template-args_test.ts` | Integração dos argumentos no scanner. |
| `tests/lexer/template-expansion_test.ts` | Expansão em duas fases e reentrância. |
| `tests/lexer/template-recursion_test.ts` | Recursão, profundidade, ordem. |
| `tests/lexer/template-context_test.ts` | Contexto e composição. |
| `tests/lexer/template-errors_test.ts` | Matriz do §8 (table-driven). |
| `tests/lexer/template-lists_test.ts` | Listas como argumento + as três formas de `for` (§3.1). |
| `tests/parser/template-decl_test.ts` | Declaração, namespace e **colocação** (23.9). |
| `tests/lexer/macro-baseline-regression_test.ts` | Cerca do caminho de macro congelado. |
| `tests/fixtures/templates/` | Fixtures + índice (`README.md`); `lists-for.tjp` é o exemplo de listas/`for`. |
| `tests/golden/template_golden_test.ts` | Golden TS-only (6 seções). |
| `tests/integration/template-integration_23_test.ts` | Schedule/financeiro equivalentes ao manual + relatórios. |

Regenerar o golden:

```bash
deno task golden:generate:template
```

## 10. Não suportado (por decisão)

- Interpolação concorrente (`#{…}`, `%{…}`) — a única sintaxe é a do Vento.
- Autoescape de HTML — desativado em todas as configurações.
- Macro contendo chamada de template (ver §4).
- Interpretar o corpo no momento do registro.
- Template com estado de agenda: a expansão é pré-processamento, acontece
  **antes** do modelo existir.
