# `docs/syntaxmesh/decisoes/031-modelo-contabil-estendido.md`
id: 031
titulo: Modelo Contábil Estendido
status: proposta
data: 2026-10-15
autores: [SyntaxMesh]
depende_de: [011, 019]
relacionado_a: [013, 014, 015, 016, 017, 018]
substitui: —
substituido_por: —
---

# ADR 031 — Modelo Contábil Estendido

> **Status:** 📝 **Proposta em validação.**
>
> Este documento descreve uma **proposta de arquitetura contábil** para o
> SyntaxMesh. As decisões aqui registradas **não estão congeladas**: elas serão
> **validadas, ajustadas ou revertidas durante o desenvolvimento da Fase 8.2**
> (`docs/syntaxmesh/fases/fase-8.2-modelo-contabil-estendido.md`), à medida que
> os testes, golden tests e casos reais forem exercitando o modelo.
>
> Enquanto o status for `proposta`, qualquer implementação que dependa deste ADR
> deve tratar as decisões como **hipóteses verificáveis**, não como contrato
> estável. Ao final da Fase 8.2, este ADR será revisado e promovido a `aceito`,
> `aceito com revisões` ou `rejeitado` — e, se necessário, substituído por um
> novo ADR.

---

## 1. Contexto

O SyntaxMesh nasceu como port fiel do TaskJuggler (ADR 011). A Fase 8 portou o
modelo financeiro do TJ com fidelidade: contas exclusivas (`aggregate tasks` ou
`aggregate resources`), `chargeset` único por task/recurso, meta-account para
balance e `turnover` O(n²) sem cache (ADR 019).

A Fase 8.1 introduziu três extensões que o modelo original não acomoda
naturalmente:

- **`Material`** como entidade de primeira classe.
- **`ExtendedCharge`** com gramática de distribuição temporal não-linear.
- **`ExtendedBooking`** com três tipos (`effort`, `charge`, `material`) e
  cenário próprio, mais o `trackingscenario` redefinido como **papel designado**.

Essas extensões expõem limitações estruturais do port original:

1. **Exclusividade da conta** — uma conta não pode consolidar custo de tarefa,
   effort de recurso e consumo de material ao mesmo tempo.
2. **`chargeset` singular** — não há como ter, na mesma tarefa, um chargeset de
   custo e outro de receita, mesmo apontando para top-levels distintos.
3. **Origem do lançamento não é preservada** — uma vez agregado, o valor perde
   a informação de onde veio.
4. **Imputação implícita** — a regra que decide qual conta recebe o custo não é
   explícita nem auditável.
5. **Booking acoplado ao tracking scenario técnico** — não há flexibilidade
   para cenários independentes com bookings próprios.

A diretriz do SyntaxMesh é **estender o modelo contábil sem quebrar
compatibilidade com `.tjp` existentes** e **sem perder a precisão contábil** do
TaskJuggler. Este ADR registra a proposta nessa direção.

---

## 2. Decisões propostas

As cinco decisões abaixo são **hipóteses de projeto**. Cada uma será validada
isoladamente durante a Fase 8.2, com testes unitários e golden tests.

### 2.1 Conta não exclusiva por padrão

**Proposta:** `Account` deixa de ter `aggregate` como campo obrigatório e
mutuamente exclusivo. Passa a ter `allowedTypes: Set<CostType>` com:

```ts
type CostType = 'task' | 'resource' | 'material';
```

Regras:

- `allowedTypes` **vazio** → conta aceita qualquer tipo (default novo).
- `allowedTypes` **preenchido** → conta aceita apenas os tipos listados.
- A diretiva `aggregate` popula `allowedTypes`:
  - `aggregate tasks` → `{task}` (comportamento idêntico ao TJ).
  - `aggregate resources` → `{resource}`.
  - `aggregate materials` → `{material}`.
  - `aggregate tasks, resources, materials` → os três.
  - Sem `aggregate` → vazio → aceita tudo.

**Motivação:** permitir consolidação em uma única conta folha sem subcontas
artificiais, preservando a semântica dos `.tjp` que já usam `aggregate`.

**Hipótese a validar:** a mudança de default (de exclusivo para livre) não
introduz ambiguidade em `.tjp` existentes nem quebra golden tests da Fase 8.

### 2.2 Subtotais por tipo na conta

**Proposta:** `AccountScenario` mantém três buckets internos:

```ts
interface AccountBuckets {
  task: number;
  resource: number;
  material: number;
}
```

- `turnover(startIdx, endIdx)` continua retornando o **total** (soma dos três
  buckets) — assinatura preservada.
- Novo método `turnoverByType(startIdx, endIdx, type): number` expõe cada bucket.
- Invariante: `sum(buckets) === total` dentro de `1e-6`.

**Motivação:** permitir relatórios consolidados e detalhados sem perder a API
original.

**Hipótese a validar:** a invariante se mantém em todos os caminhos recursivos
(container, meta-account, leaf, aggregate) e sob floats.

### 2.3 `CostEvent` como unidade auditável

**Proposta:** todo lançamento de custo gera um `CostEvent` registrado em
`Project.costEvents` (append-only):

```ts
interface CostEvent {
  type: 'task_charge' | 'resource_effort' | 'material_usage';
  amount: number;
  accountId: string;
  taskId: string;
  resourceId?: string;
  materialId?: string;
  scenarioIdx: number;
  mode: 'planned' | 'actual';
  attributionRule:
    | 'explicit'
    | 'origin_chargeset'
    | 'task_chargeset_force'
    | 'task_chargeset_fallback'
    | 'project_default';
  date: TjTime;
}
```

**Motivação:** auditar de onde veio cada valor; alimentar relatórios por tipo;
depurar precedência; habilitar plan × actual.

**Hipótese a validar:** emitir um evento por linha de custo (não por conta
destino) não infla memória em projetos médios e não altera o resultado de
`turnover`.

### 2.4 Múltiplos `chargeset` por propriedade

**Proposta:** `Task`, `Resource` e `Material` passam a ter um
`ChargeSetCollection` em vez de um `chargeset` único. A coleção é indexada por
**top-level account**, com a restrição:

- **No máximo um chargeset por top-level account**.
- Chargesets para top-levels diferentes coexistem (ex.: custo + receita).

```ts
class ChargeSetCollection {
  private sets: Map<Account, ChargeSet>; // key = top-level
  add(set: ChargeSet): void;             // valida duplicata
  forTop(top: Account): ChargeSet | null;
  forType(type: CostType): ChargeSet | null;
  all(): Iterable<ChargeSet>;
}
```

**Motivação:** permitir custo e receita na mesma propriedade, agregados em
árvores distintas, sem ambiguidade.

**Hipótese a validar:** a restrição por top-level (e não por tipo) é suficiente
para eliminar ambiguidade; `.tjp` com chargeset único continuam funcionando.

### 2.5 Motor de precedência explícito

**Proposta:** um módulo `src/core/accounting/attribution.ts` resolve, para cada
linha de custo, a conta destino e a regra usada.

Ordem padrão (**fallback mode**):

1. `explicitAccount` na linha → regra `explicit`.
2. Chargeset da **origem** (resource/material) → regra `origin_chargeset`.
3. Chargeset da **tarefa** → regra `task_chargeset_fallback`.
4. Conta default do projeto → regra `project_default`.

Modo **force** (`task.chargesetmode = force`):

- O step (2) é ignorado; o chargeset da tarefa domina → regra
  `task_chargeset_force`.
- Se a tarefa não tiver chargeset para o tipo, cai em (2) naturalmente.

**Motivação:** tornar explícita uma decisão que no TJ está implícita; permitir
duas filosofias (origem vence vs tarefa vence) sem ambiguidade.

**Hipótese a validar:** a ordem escolhida é intuitiva para usuários; o modo
`force` cobre os casos em que a tarefa é o centro de custo.

### 2.6 Booking scenario-aware + `trackingscenario` como papel

**Proposta:**

- Cada `ExtendedBooking` tem `scenarioIdx`.
- Qualquer cenário com ≥ 1 booking entra em **projection mode** automaticamente.
- Diretiva `trackingscenario <id>` marca o cenário "oficial real" — **não** muda
  comportamento técnico; só orienta relatórios.
- `CostEvent.mode` é `'actual'` para lançamentos do cenário marcado; `'planned'`
  caso contrário.

**Motivação:** desacoplar projection de uma hierarquia rígida de cenários;
permitir cenários independentes com bookings próprios; manter compatibilidade
com relatórios do TJ (tracking = REAL).

**Hipótese a validar:** a presença de bookings é critério suficiente para
projection; o `trackingscenario` como papel é opcional e não introduz estado
oculto.

---

## 3. Alternativas consideradas

| Alternativa | Por que não (nesta proposta) |
|---|---|
| Manter exclusividade e forçar subcontas artificiais | Já é o que o TJ faz; contraria a diretriz de consolidação. |
| `Decimal` para valores monetários | Quebra fidelidade com o TJ; adiada para fase futura se necessário. |
| Cachear `AccountScenario.turnover` | Divergiria do comportamento do TJ; ADR 019 já decidiu por O(n²). |
| Múltiplos chargesets sem restrição de top-level | Ambiguidade na agregação; difícil auditar. |
| `chargeset` com semântica puramente por tipo (task/resource/material) | Não cobre o caso custo + receita na mesma propriedade. |
| Projection obrigatório só em tracking scenario | Rígido; contraria a diretriz de cenários independentes (8.1). |
| `CostEvent` calculado on-demand em vez de armazenado | Perde auditabilidade; relatórios teriam que recalcular. |

---

## 4. Consequências

### 4.1 Positivas

- **Consolidação real** em uma conta folha, sem subcontas artificiais.
- **Custo e receita** na mesma propriedade, em árvores distintas.
- **Auditabilidade** por `CostEvent`.
- **Plan × actual** viável por tipo.
- **Imputação explícita**, testável e depurável.
- **Compatibilidade `.tjp`** preservada (aggregate e chargeset único seguem
  válidos).

### 4.2 Negativas

- **Modelo mais complexo** que o do TJ; exige disciplina do usuário.
- **`CostEvent` aumenta uso de memória** em projetos grandes.
- **Múltiplos chargesets** exigem validação por top-level em cada inserção.
- **Risco de divergência** entre buckets e total se a invariante não for
  testada em todos os caminhos.

### 4.3 Mitigações

- Golden tests da Fase 8 continuam como regressão obrigatória.
- Invariante `sum(buckets) === total` testada em ≥ 5 cenários.
- `CostEvent` pode ser descartável em produção (flag de projeto).
- ADR é **proposta**; ajustes durante a Fase 8.2 são esperados.

---

## 5. Plano de validação

Este ADR será validado durante a Fase 8.2, nas seguintes frentes:

| Frente | Como será validado | Onde |
|---|---|---|
| Conta não exclusiva | Golden tests da Fase 8 continuam verdes; novos golden com 3 tipos | 8.2.10 |
| Subtotais por tipo | Invariante testada em ≥ 5 cenários | 8.2.2, 8.2.11 |
| `CostEvent` | Um evento por linha; resultado de `turnover` inalterado | 8.2.3, 8.2.8 |
| Múltiplos chargesets | Caso custo + receita na mesma task | 8.2.4, 8.2.10 |
| Motor de precedência | Golden com `force` e `fallback` | 8.2.5, 8.2.10 |
| Booking scenario-aware | Cenário com bookings entra em projection; `trackingscenario` marca real | 8.2.7, 8.2.10 |

Ao final da Fase 8.2, este ADR será promovido a `aceito`, `aceito com revisões`
ou `rejeitado`. Se houver mudanças materiais, um novo ADR poderá substituí-lo.

---

## 6. Escopo

**Dentro do escopo:**

- Modelo de conta (`allowedTypes`), buckets por tipo.
- `CostEvent`.
- `ChargeSetCollection` e motor de precedência.
- Integração com `Material` e `ExtendedBooking`.
- `trackingscenario` como papel.
- API de relatórios (breakdown, plan × actual).

**Fora do escopo:**

- Renderização de relatórios (Fase 14).
- Otimização do motor de agregação (O(n²) aceito).
- `Decimal` para valores monetários.
- Interface visual.
- Integração com sistemas externos de contabilidade.

---

## 7. Referências

- ADR 011 — Port fiel do TaskJuggler.
- ADR 019 — Modelo financeiro (Fase 8).
- `docs/syntaxmesh/fases/fase-8-financeiro.md`.
- `docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md`.
- `docs/syntaxmesh/fases/fase-8.2-modelo-contabil-estendido.md`.
- `docs/taskjuggler/lib/taskjuggler/Account.rb`.
- `docs/taskjuggler/lib/taskjuggler/AccountScenario.rb`.
- `docs/taskjuggler/lib/taskjuggler/ChargeSet.rb`.
- `docs/tj3-engine/10-blueprint-finance.md`.

---

## 8. Nota final

Este ADR é, por natureza, **provisório**. Ele existe para dar direção à Fase 8.2
e para registrar o raciocínio por trás das decisões propostas. Durante o
desenvolvimento, cada decisão será confrontada com:

- Testes unitários que exercitam o comportamento.
- Golden tests que comparam com o `tj3` real quando aplicável.
- Casos reais de uso (mwe004, variações, exemplos próprios do SyntaxMesh).

Ajustes são esperados. O que **não** é esperado é:

- Quebra de compatibilidade com `.tjp` existentes.
- Divergência entre buckets e total.
- Ambiguidade na resolução de conta.

Se algum desses três invariantes for violado, a decisão correspondente deve ser
revisada antes de promover o ADR a `aceito`.

---

### Observações sobre esta proposta de ADR

1. **Status `proposta`** no frontmatter e aviso explícito no topo do documento.
2. **Plano de validação** dedicado (§5) — cada decisão tem uma frente de teste na Fase 8.2.
3. **Três invariantes não-negociáveis** (§8) — mesmo em proposta, alguns pontos não podem ser violados (compatibilidade `.tjp`, soma dos buckets, ausência de ambiguidade).
4. **Referência cruzada com 8.2** — o ADR aponta para a fase onde será validado.
