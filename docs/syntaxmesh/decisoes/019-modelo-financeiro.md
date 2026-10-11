# ADR 019 — Modelo Financeiro

> **Arquivo:** `docs/syntaxmesh/decisoes/019-modelo-financeiro.md`
> **Fase:** 8 — Financeiro
> **Status:** ✅ Concluída
> **Data:** 2026-10-11
> **Autor:** SyntaxMesh Core Team
> **Supersedes:** nenhuma

---

## Contexto

O sistema financeiro do SyntaxMesh (Fase 8) implementa o pipeline de custos do TaskJuggler:

```
Charge → ChargeSet → AccountScenario → balance (meta-account)
```

- **`Charge`** representa um custo com valor e modo de distribuição (`onStart`, `onEnd`, `perDiem`).
- **`ChargeSet`** distribui o custo entre contas (`Account`) com shares.
- **`AccountScenario.turnover`** calcula o movimento financeiro por período, agregando créditos manuais, containeres, meta-contas e `aggregate`.
- **`TaskScenario.turnover`** e **`ResourceScenario.turnover`** calculam o custo de tarefas e recursos.
- **Meta-account** (`createBalanceAccount`) gera uma conta temporária para relatórios de P&L.

Três decisões foram **implícitas** na implementação original do Ruby e precisam ser formalizadas para evitar regressões e inconsistências entre fases.

---

## Decisão 1 — Tipos monetários: `Float` (number JS), sem `Decimal`

**Problema:** valores monetários (custos, receitas, shares) devem ser representados com precisão decimal, mas o Ruby usa `Float` (ponto flutuante de dupla precisão).

**Decisão:** usar `number` (IEEE 754 double) para todos os valores monetários. Não implementar `Decimal` nem `BigInt`.

**Justificativa:**
- Paridade exata com o Ruby TaskJuggler 3.8.4, que usa `Float`.
- O Ruby não tem `BigDecimal` nativo no pipeline financeiro; golden tests são comparados com tolerância `1e-6`.
- Adicionar `Decimal` quebraria a paridade e introduziria overhead desnecessário.

**Regra:**
- Todos os campos monetários são `number`.
- Golden tests comparam floats com tolerância `1e-6` (ver ADR 013).
- Nenhum arredondamento explícito no código de produção.

---

## Decisão 2 — Meta-account e sinal de P&L

**Problema:** como representar uma conta "Total" que soma custos e receitas em um único valor de P&L?

**Decisão:** o meta-account criado por `createBalanceAccount` adota **exatamente dois** filhos na ordem `[cost, revenue]`, e seu turnover é calculado como:

```
turnover = -cost.turnover + revenue.turnover
```

**Justificativa:**
- `adoptees[0]` = conta de custo (sinal negativo, despesa).
- `adoptees[1]` = conta de receita (sinal positivo, ganho).
- Sinal `-cost + revenue` reflete o P&L canônico do Ruby.

**Regra:**
- `adoptees[0]` é sempre `costAccount`, `adoptees[1]` é sempre `revenueAccount`.
- Qualquer outra ordem viola o contrato do meta-account.

---

## Decisão 3 — Sem cache em `AccountScenario.turnover`

**Problema:** `turnover` é chamado repetidamente durante o escalonamento; um cache poderia acelerar, mas introduz complexidade de invalidação.

**Decisão:** replicar a implementação **O(n²)** do Ruby sem cache.

**Justificativa:**
- O Ruby não usa cache; paridade é o critério primário (ADR 011).
- O custo de re-calculo é aceitável para o escopo atual.
- Um cache exigiria invalidação por mudança de cenário/periodo, aumentando risco de bugs.

**Alternativas consideradas:**
1. **Cache com invalidação por versão de cenário** — mais rápido, mas complexo; risco de stale.
2. **Memoização por período** — não resolve chamadas com parâmetros diferentes (`account`, `resource`).
3. **O(n²) sem cache** — escolhido: simples, fiel ao Ruby, fácil de auditar.

**Consequências:**
- ✅ Simplicidade e fidelidade ao Ruby.
- ✅ Sem risco de cache stale.
- ⚠️ Performance O(n²) em projetos grandes — otimização futura possível, mas não prioridade.

---

## Consequências

- **Positivas:**
  - Paridade com o Ruby garantida.
  - Comportamento monetário previsível e documentado.
  - Implementação simples e auditável.

- **Negativas / Riscos:**
  - `number` pode perder precisão em valores extremos (aceito, paridade com Ruby).
  - O(n²) pode ser lento em projetos muito grandes (monitorar).

---

## Referências

- `docs/taskjuggler/lib/taskjuggler/Charge.rb`
- `docs/taskjuggler/lib/taskjuggler/ChargeSet.rb`
- `docs/taskjuggler/lib/taskjuggler/AccountScenario.rb`
- `docs/taskjuggler/lib/taskjuggler/reports/AccountListRE.rb`
- ADR 011 (port fiel), ADR 013 (compat.keepRubyBugs)
