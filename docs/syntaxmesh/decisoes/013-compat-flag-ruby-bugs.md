# 013 — Flag global `compat.keepRubyBugs` para bugs do Ruby

## Contexto

O TaskJuggler 3.8.4, escrito em Ruby, contém **bugs conhecidos** que afetam o output de datas, formatação numérica e contagem de intervalos. O ADR 011 estabelece que o SyntaxMesh deve ser um **port fiel**, com paridade bit-a-bit validada por golden tests contra o `tj3` real.

Isso cria uma tensão:

- **Fidelidade**: replicar o comportamento do Ruby, mesmo quando buggy, para garantir que arquivos `.tjp` existentes produzam cronogramas idênticos.
- **Correção**: usuários novos podem querer comportamento correto, especialmente em casos onde o bug produz resultados visivelmente errados (ex: `2024-01-31 + 1 mês = 2024-03-02`).

Além disso, bugs têm **naturezas diferentes**:

- Alguns **nunca disparam** em uso normal (código morto, typos em branches raros).
- Outros **afetam output** em casos legítimos.
- Outros são **comportamentos documentados** que parecem bugs mas não são.

Sem uma política clara, cada fase decide localmente, gerando inconsistência.

**Alternativas consideradas:**

- **A) Sempre corrigir bugs.** Quebra paridade com `tj3`, invalida golden tests.
- **B) Sempre replicar bugs.** Engessa o usuário, força comportamento errado em produção.
- **C) Flag global `keepRubyBugs` + categorização.** Complexidade adicional, mas permite os dois.
- **D) Flag por método.** Poluído, difícil de manter.
- **E) Flag por classe.** Melhor que D, mas ainda fragmenta a decisão.

## Decisão

Adotado a alternativa **C**: uma **flag global** `compat.keepRubyBugs` combinada com **categorização formal dos bugs** em 3 classes.

### Categorização

Toda divergência entre o Ruby e o TS deve ser classificada em uma das 3 categorias:

#### Categoria A — Latentes (sempre corrigir)

**Definição:** bugs que **nunca disparam** em uso normal, ou que causam crash em branches inalcançáveis.

| Bug | Comportamento Ruby | Correção TS |
|---|---|---|
| `Interval#combine` retorna `[Interval]` em 2 branches, `Interval` no 3º | Tipo inconsistente | Sempre retorna `Interval` |
| `Scoreboard#idxToDate` typo `kdx` | `NameError` se `forceIntoProject && idx < 0` | Usa `idx` corretamente |
| `WorkingHours.@days` compartilha `[]` entre dom/sáb | 7 referências ao mesmo array | `Array.from({length:7}, () => [])` |

**Política:** sempre corrigir. **Sem flag.** Comentário `// RUBY-COMPAT-FIX: <descrição>` no código.

**Golden tests:** comportamento esperado é o **corrigido**. Se o `tj3` diverge, o golden é ajustado com nota.

#### Categoria B — Afetam output (flag `keepRubyBugs`)

**Definição:** bugs que produzem resultados **diferentes** do correto em casos legítimos.

| Bug | Ruby faz | Correto seria |
|---|---|---|
| `TjTime#sameTimeNextMonth` clamp em mês antigo | `2024-01-31 → 2024-03-02` (rollover) | `2024-01-31 → 2024-02-29` |
| `TjTime#sameTimeNextQuarter` sem clamp | `2024-01-31 → 2024-05-01` (rollover) | `2024-01-31 → 2024-04-30` |
| `TjTime#sameTimeNextYear` sem clamp | `2024-02-29 → 2025-03-01` | `2024-02-29 → 2025-02-28` |
| `Integer#round` half-away-from-zero em negativos | `(-2.5).round == -3` | `-2.5 → -2` (JS native) |
| `TjTime#to_s` usa `@time.sec` original | Formato depende do UTC original | Usar sec local |
| `Scoreboard#collectIntervals` sentinel `0` | Slots que começam em 0 são deslocados | Usar `-1` como sentinel |

**Política:** flag global controla o comportamento.

```ts
// packages/core/src/compat.ts
export const compat = {
  /**
   * Quando `true` (default), replica bugs do TaskJuggler 3.8.4 para
   * garantir paridade bit-a-bit em golden tests.
   *
   * Quando `false`, aplica comportamento corrigido.
   *
   * ATENÇÃO: mudar para `false` é uma decisão do usuário e pode
   * quebrar compatibilidade com projetos `.tjp` existentes.
   */
  keepRubyBugs: true,
};
```

Cada método afetado implementa ambos os branches:

```ts
sameTimeNextMonth(): TjTime {
  if (compat.keepRubyBugs) {
    // comportamento Ruby (bug)
  } else {
    // comportamento corrigido
  }
}
```

**Golden tests:** rodam com `keepRubyBugs: true` (default). A Fase 2 complementar (5.14.R.3) adiciona um golden paralelo para `false`, opcional.

**Comentário obrigatório:** `// RUBY-COMPAT-FLAG: <descrição do bug>`.

#### Categoria C — Documentados (sempre replicar)

**Definição:** comportamentos que **parecem bugs** mas são **documentados** no Ruby ou na linguagem.

| Comportamento | Justificativa |
|---|---|
| `Interval#compareTo` retorna 0 em overlap | Documentado: "only works for non-overlapping intervals" |
| `String#to_i` retorna 0 em string inválida | Comportamento canônico do Ruby |
| `Time.mktime` faz rollover em dia inválido | Comportamento documentado de `Time` |
| `Integer#round` half-up em positivos | Mesmo que `Math.round` |

**Política:** sempre replicar. **Sem flag.** Comentário `// RUBY-COMPAT-DOC: <link para doc>`.

### API pública

```ts
// packages/core/src/compat.ts

/**
 * Flag global que controla o comportamento de bugs Categoria B.
 * Ver ADR 013 para detalhes.
 */
export const compat: { keepRubyBugs: boolean } = {
  keepRubyBugs: true,
};

/**
 * Helper para arredondamento de negativos.
 * `Math.round` do JS difere do `Integer#round` do Ruby em `-X.5`.
 */
export function rubyRound(n: number): number {
  if (compat.keepRubyBugs) {
    // Ruby: -2.5.round == -3 (half-away-from-zero)
    return n < 0 ? -Math.round(-n) : Math.round(n);
  }
  return Math.round(n);
}
```

## Política de migração (R5)

Bugs podem **migrar entre categorias** ao longo do tempo. Isso é esperado e precisa de política.

### Migração Categoria B → Categoria A

**Cenário:** um bug B é descoberto como nunca-disparável em prática.

**Ação:**
1. Documentar o caso no ADR 013 (adicionar linha em Categoria A).
2. Remover o branch `if (compat.keepRubyBugs)` do código.
3. Rodar `deno task golden:test` — se golden divergir, ajustar golden com nota.
4. **Breaking change:** usuários com `keepRubyBugs: false` **não são afetados** (já tinham correção). Usuários com `true` veem correção.

**Versionamento:** patch se golden não muda; minor se golden muda.

### Migração Categoria C → Categoria B

**Cenário:** comportamento "documentado" é reclassificado como bug (ex: TJ upstream anuncia fix).

**Ação:**
1. Documentar em Categoria B.
2. Adicionar branch `if (compat.keepRubyBugs)`.
3. **Não é breaking:** usuários com `true` (default) não são afetados.

**Versionamento:** patch.

### Migração Categoria A → Categoria B

**Cenário:** um "fix" da Categoria A é descoberto como divergente do Ruby de forma relevante.

**Ação:**
1. Documentar em Categoria B.
2. Adicionar branch `if (compat.keepRubyBugs)`.
3. **Breaking change:** usuários com `false` que dependiam do fix precisam adaptar.

**Versionamento:** minor.

### Deprecação da flag (2.0)

**Cenário:** uma versão futura quer remover a flag e sempre corrigir.

**Ação:**
1. Release N: emitir warning se `keepRubyBugs: true` for detectado em runtime.
2. Release N+1 (major): flag é **ignorada**. Bugs Categoria B migram para A.

**Versionamento:** major.

## Alternativas consideradas

- **Sem flag, sempre replicar:** paridade perfeita, mas produz resultados errados em produção.
- **Sem flag, sempre corrigir:** rompe golden tests e compatibilidade.
- **Flag por método:** poluído, decisão fragmentada.
- **Flag por classe:** melhor, mas ainda permite inconsistência entre classes relacionadas.
- **Namespace `compat.<classe>.<método>`:** granularidade excessiva.

## Consequências

### Positivas

- **Paridade default:** `tj3` e `tj3-ts` produzem output idêntico por padrão.
- **Flexibilidade:** usuário pode optar por comportamento corrigido.
- **Rastreabilidade:** cada bug documentado na ADR 013 (com link para golden).
- **Consistência:** todos os métodos afetados usam a mesma flag.
- **Categorização explícita:** bugs A nunca veem flag; bugs C nunca são corrigidos.

### Negativas / Riscos

- **Estado global mutável:** `compat.keepRubyBugs` pode ser alterado em runtime. Documentar: alterar apenas em `main.tsx` antes de qualquer parse.
- **Branches duplicados:** cada bug B tem 2 branches para manter.
- **Testes precisam cobrir ambos:** golden tests `true` (obrigatório) + `false` (opcional, Fase 2 complementar 5.14.R.3).
- **Migração A↔B↔C é breaking em alguns casos:** política acima define semver.
- **Não thread-safe:** idêntico ao `AttributeBase._mode` (ADR 014 futuro). Aceito — single-threaded.

### Neutras / Observações

- Bugs Categoria A **não têm flag** — são sempre corrigidos. Documentados aqui como divergências conhecidas.
- Bugs Categoria C **não têm flag** — são comportamento correto.
- A flag **não substitui golden tests** — apenas permite que o usuário final escolha.
- O `tj3` real nunca muda — se um bug for corrigido upstream, isso é uma **nova versão** do TJ, tratada em ADR separada.
- Referência cruzada: cheat sheet Ruby→TS §12 (lista completa de bugs) e §15 (flag).

---

**Status:** Aceito
**Data:** 2026-09-12
**Autor(es):** Vanaware