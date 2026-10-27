# ADR 024 — Expressões lógicas sem precedência

> **Status:** ✅ Concluído
> **Data:** 2026-10-27
> **Autores:** Qwen Code

## Resumo

O motor de expressões lógicas (`LogicalOperation`/`LogicalExpression`) avalia a
árvore **estritamente da esquerda para a direita, sem precedência entre
operadores**, e com `&`/`|` **lazy (short-circuit)**. Isso replica o
comportamento do TaskJuggler 3.8.4 em Ruby (`LogicalOperation.rb`).

> **Nota de numeração:** o arquivo de tarefas da Fase 11 referenciava este ADR
> como `ADR 023`, mas o slot 023 já foi alocado ao ADR de *i18n de keywords*
> (Fase 10). O README já reservava o **024** para esta decisão; usamos 024.

## Contexto

Em TJP, uma expressão lógica é uma cadeia plana de operandos e operadores. O
parser (`TjpSyntaxRules.rb` → `logic.ts`) monta essa cadeia associando **cada
operador ao acumulador da esquerda**, sem aplicar qualquer tabela de
precedência. Consequências diretas:

- `a | b & c` é lido como `(a | b) & c`, **não** como `a | (b & c)`.
- `a & b | c` é lido como `(a & b) | c`.
- Não existe precedência entre `&` e `|`, nem entre operadores relacionais
  (`>`, `<`, `=`, …) e lógicos.

Além disso, `&` e `|` são avaliados com curto-circuito: em Ruby `&&`/`||` não
avaliam o segundo operando quando o primeiro já decide o resultado. Como os
operandos podem ter efeitos colaterais (uma `Query` pode lançar erro), a ordem
e o lazy-evaluation são **parte do contrato observável**.

A coerção para comparação binária é feita **pelo tipo do `operand1`** (não do
`operand2`): se o primeiro operando é `TjTime`, ambos viram data; se é número,
ambos viram número; se é string (ou RichText), ambos viram string.

## Decisão

Manter fidelidade ao Ruby:

1. **Sem precedência.** A árvore é construída associativa à esquerda e `eval`
   desce por ela na ordem em que foi montada.
2. **`&` e `|` lazy.** Usar `&&` e `||` nativos do TypeScript, avaliando o
   segundo operando apenas quando necessário.
3. **Coerção pelo `operand1`.** O tipo do primeiro operando decide como o
   segundo é convertido.

Exemplos explícitos (parênteses são **obrigatórios** para mudar o agrupamento):

```
# TJP interpreta como:
a | b & c        →  (a | b) & c
a & b | c        →  (a & b) | c
~a & b           →  (~a) & b
effort > 5 & istask()   →  (effort > 5) & istask()
```

## Alternativas consideradas e rejeitadas

- **Introduzir precedência convencional (`&` antes de `|`).** Rejeitada:
  quebraria a compatibilidade com qualquer `.tjp` já escrito e com os golden
  tests; expressões como `a | b & c` mudariam de valor. É exatamente o oposto
  do princípio de *port fiel* (ADR 011).
- **Avaliação estrita (sem short-circuit) de `&`/`|`.** Rejeitada: mudaria
  efeitos colaterais observáveis (erros de `Query` que o Ruby não dispara em
  ramo curto-circuitado).

## Consequências

- **Positivas:** comportamento idêntico ao Ruby; golden tests de expressões
  são reprodutíveis; sem surpresas para quem migra `.tjp`.
- **Negativas / cuidados:** usuários precisam escrever **parênteses explícitos**
  quando quiserem o agrupamento "matematicamente usual"; a documentação e os
  exemplos devem reforçar a ausência de precedência. A coerção pelo `operand1`
  pode pegar desprevenidos quando o `operand1` é uma string literal e o
  `operand2` numérico (compara como string).
