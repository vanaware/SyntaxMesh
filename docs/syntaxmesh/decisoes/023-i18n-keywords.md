# Decisão: i18n de keywords via LanguageRegistry

## Contexto

O TaskJuggler Ruby só tem keywords em inglês. O SyntaxMesh quer suportar **pt-BR, es** (e futuramente outros idiomas) sem alterar o parser.

Precisamos registrar:
1. A decisão de usar um `LanguageRegistry` com sinônimos canônicos.
2. O mecanismo de pré-scan com regex para detectar a diretiva `language "xxx"`.
3. O mapeamento transparente no scanner: sinônimos → canônicos, sem alterar o parser.

**Alternativas consideradas e rejeitadas:**

- A) **Um parser por idioma** — rejeitada: ~300 regras duplicadas por idioma; violaria o port fiel (ADR 011) e a manutenção.
- B) **Keywords nativas não-canônicas no parser** — rejeitada: o parser passaria a conhecer idiomas, quebrando a regra de ouro "parser não conhece idiomas finais depois da normalização" e impedindo ASTs equivalentes entre idiomas.
- C) **`LanguageRegistry` (escolhida)** — sinônimos resolvidos no scanner; parser opera sempre em keywords canônicos (inglês).

## Decisão

Criar `LanguageRegistry` (extensão do SyntaxMesh, não está no TJ) com:
- **Sinônimos canônicos:** cada keyword canônico (ex: `task`) tem uma lista de sinônimos por idioma (ex: `tarefa` em pt-BR).
- **Pré-scan:** regex `/^\s*language\s+"([^"]+)"/m` detecta a diretiva `language` no início do arquivo.
- **Mapeamento no scanner:** quando `language !== 'en'`, o scanner aplica `LanguageRegistry.resolve(word, language)` sobre tokens `ID`. Se sinônimo encontrado, retorna `[KEYWORD, canonical]` em vez de `[ID, text]`.

O parser continua operando em keywords canônicos (inglês). O i18n é transparente.

## Consequências

### Positivas
- Fidelidade ao Ruby: parser unchanged, keywords canônicos.
- Extensão: idiomas adicionais via registry, sem alterar parser.
- AST equivalente: normaliza `name` para canônico, facilita comparação entre idiomas.

### Negativas / Riscos
- Sinônimos precisam ser mantidos manualmente por idioma.
- Pré-scan com regex pode falhar em casos edge (comentários, strings).
- Ambiguidade: sinônimos que coincidem com IDs normais.

### Neutras / Observações
- Idiomas iniciais: en, pt-BR, es.
- Fase 10.16 implementa os idiomas.
- Fase 10.17 implementa a diretiva `language` no parser.
- Fase 10.18 testa AST equivalence entre idiomas.

## Referências

- `docs/taskjuggler/lib/taskjuggler/ProjectFileScanner.rb` — scanner Ruby.
- `docs/syntaxmesh/cheat-sheet-ruby-ts.md` — mapeamentos de tradução.
- ADR 011 (Port fiel), ADR 022 (FSM).

## Fora de escopo

- Tradução automática de keywords.
- Suporte a idiomas dinâmicos (carregados em runtime).

## Critério de aceite

- ADR 023 criado.
- Tabela em `decisoes/README.md` atualizada.

**Status:** Aceito
**Data:** 2026-10-23
**Autor:** Qwen Code