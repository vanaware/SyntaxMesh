# Decisão: FSM do TextParser compilado em runtime

## Contexto

O TaskJuggler Ruby usa um **autômato finito (FSM) compilado em runtime** para o `TextParser`. O FSM é gerado dinamicamente a partir das regras de sintaxe (`TjpSyntaxRules`) e contém transições SHIFT/REDUCE exatas que correspondem ao parser LR(1) do Ruby.

Precisamos registrar:
1. A decisão de manter a fidelidade absoluta do FSM (sem simplificar para recursive descent, PEG, parser combinators).
2. O pipeline exato de geração de FSM (`parseFSM`) que copia o Ruby linha-a-linha.
3. A necessidade de suportar `extend` (herança de regras) e `language` i18n.

## Decisão

Manter o **FSM compilado em runtime** como o coração do `TextParser`. O FSM é gerado por `Pattern.generateStates()` e armazenado em `State` objetos com transições `StateTransition` exatas.

O pipeline exato de geração de FSM:

```
para cada Rule:
  para cada Pattern na rule:
    Pattern.generateStates(rule, rules) → State[]
    State.addTransitionsToState(states, rules, stateStack, sourceState, destRule, destIndex, loopBack)
```

O `TextParser.parseFSM()` executa loop SHIFT/REDUCE exato, copiando o Ruby linha-a-linha.

## Consequências

### Positivas
- Fidelidade ao Ruby: comportamento exato, incluindo bugs do Ruby (via `compat.keepRubyBugs`).
- Suporta `extend`: regras herdadas são compiladas em tempo de execução.
- Suporta i18n: keywords são mapeadas para sinônimos canônicos via `LanguageRegistry`.
- Fácil de depurar: FSM explícito, não oculto em funções recursivas.

### Negativas / Riscos
- Complexidade alta: muitos arquivos gerados, difícil de manter.
- Performance: compilação em tempo de execução vs. parser pré-compilado.
- Manutenção: mudanças no Ruby exigem re-geração.

### Neutras / Observações
- Web Workers para paralelismo de geração de FSM em fase futura.
- `AsyncLocalStorage` para modo global em vez de estático (futuro).

## Referências

- `docs/taskjuggler/lib/taskjuggler/TextParser.rb` — arquivo inteiro.
- `docs/syntaxmesh/cheat-sheet-ruby-ts.md` — mapeamentos de tradução.
- ADR 011 (Port fiel), ADR 013 (`compat.keepRubyBugs`).

## Fora de escopo

- Implementação de parser alternativo (ex: recursive descent).
- Otimizações de performance (pré-compilação, JIT).

## Critério de aceite

- ADR 022 criado.
- Tabela em `decisoes/README.md` atualizada.

**Status:** Aceito
**Data:** 2026-10-23
**Autor:** Qwen Code