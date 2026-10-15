# Fase 8.2 — Modelo Contábil Estendido

> **Arquivo:** `docs/syntaxmesh/fases/fase-8.2-modelo-contabil-estendido.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 5–8 dias
> **Depende de:** Fases 2–8, 8.1
> **Bloqueia:** Fases 9, 14, 21

---

## 1. Contexto

A Fase 8 portou fielmente o modelo financeiro do TaskJuggler: contas exclusivas
(`aggregate tasks` ou `aggregate resources`), `chargeset` único por task/recurso,
e meta-account para balance. A Fase 8.1 introduziu `Material`, `ExtendedCharge`,
`ExtendedBooking` e redefiniu o `trackingscenario`.

Esta fase (8.2) **reescreve o motor de agregação contábil** para acomodar a nova
diretriz do SyntaxMesh:

1. **Conta deixa de ser exclusiva.** Uma conta aceita, por padrão, custos de task
   (`charge`), de recurso (`effort`) e de material (`usage`). O `aggregate` passa
   a ser **filtro opcional**.
2. **Subtotais por tipo.** Cada conta mantém, internamente, buckets separados por
   origem (`task`, `resource`, `material`), além do total. Relatórios podem quebrar
   por tipo.
3. **`CostEvent`.** Todo lançamento de custo passa a ser um evento auditável, com
   origem, tipo, cenário e regra de imputação usada.
4. **Múltiplos `chargeset` por propriedade.** Task, Resource e Material podem ter
   **mais de um** chargeset, desde que cada um aponte para um **top-level account
   diferente** (ex.: um de custo, outro de receita).
5. **Motor de precedência de imputação.** Define, para cada lançamento, qual conta
   recebe o valor, com regra explícita e configurável (`force` vs `fallback`).
6. **Suporte a cenários em bookings.** Cada booking pertence a um cenário. Qualquer
   cenário com bookings entra em **projection mode**. `trackingscenario` marca o
   cenário "oficial real" para relatórios.

Isso **não é incompatível** com o TaskJuggler: `.tjp` existentes continuam
funcionando (contas com `aggregate tasks` seguem restritas; `chargeset` único
segue aceito). O que muda é a **capacidade** do modelo, não a semântica dos casos
existentes.

### 1.1 Motivação

Os limites do modelo original ficam claros quando o usuário precisa:
- Consolidar, numa única conta folha, custos fixos de tarefa + effort de recurso
  + consumo de material.
- Distinguir custo e receita na mesma tarefa (dois chargesets para top-levels
  diferentes).
- Comparar plan × real por tipo de custo.
- Auditar de onde veio cada valor.

O TaskJuggler contorna isso com subcontas artificiais e árvores paralelas. O
SyntaxMesh faz melhor mantendo **a mesma precisão contábil** e adicionando
**origem** e **tipo** como dimensões de primeira classe.

### 1.2 Relação com Fase 8 e 8.1

- **Fase 8** implementa o modelo original (port fiel).
- **Fase 8.1** adiciona entidades novas (`Material`, `ExtendedCharge`,
  `ExtendedBooking`, `TrackingScenario`) e a diretriz "cenário por booking".
- **Fase 8.2** (esta) reescreve o **motor de agregação** para integrar 8 e 8.1
  sem perda.

A ordem é importante: 8.2 pressupõe 8 e 8.1 concluídas.

---

## 2. Objetivo

Ao final desta fase:

- **Conta não exclusiva** por padrão; `aggregate` opcional como filtro.
- **Subtotais por tipo** em `AccountScenario` (`turnoverByType`).
- **`CostEvent`** como unidade auditável de lançamento.
- **Múltiplos `chargeset`** por task/recurso/material (no máximo um por top-level).
- **Motor de precedência** explícito, com modo `force` e `fallback`.
- **Booking scenario-aware**: cada booking pertence a um cenário; `trackingscenario`
  marca o real.
- **Relatórios consolidados** com quebra por task/recurso/material e comparação
  plan × real.
- **≥ 100 testes unitários** + **≥ 30 golden tests**.
- ADR 031 registrado.
- `deno task check-all` verde.

---

## 3. Referências

### 3.1 Ruby (fonte primária)

- `docs/taskjuggler/lib/taskjuggler/Account.rb`
- `docs/taskjuggler/lib/taskjuggler/AccountScenario.rb`
- `docs/taskjuggler/lib/taskjuggler/ChargeSet.rb`
- `docs/taskjuggler/lib/taskjuggler/Charge.rb`
- `docs/taskjuggler/lib/taskjuggler/TaskScenario.rb` (`turnover`)
- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` (`turnover`, `cost`)
- `docs/taskjuggler/lib/taskjuggler/reports/AccountListRE.rb` (balance)

### 3.2 Blueprints

- `docs/tj3-engine/10-blueprint-finance.md` (§1–§7)

### 3.3 Documentos da Fase 8 e 8.1

- `docs/syntaxmesh/fases/fase-8-financeiro.md`
- `docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md`

### 3.4 Casos de teste

- `docs/Learning/mwe004/tutorial.tjp`
- Novos: `docs/syntaxmesh/exemplos/8.2-*.tjp` (a criar)

---

## 4. Decisões de projeto (Ruby → TypeScript, com extensões)

### 4.1 Conta sem exclusividade obrigatória

**Original (TJ):** `Account` tem um campo `aggregate` que é `'tasks'` ou
`'resources'`, mutuamente exclusivo. O motor rejeita custo de recurso em conta
`aggregate tasks`.

**SyntaxMesh:** `Account` tem `allowedTypes: Set<CostType>` (vazio = aceita
todos). A diretiva `aggregate` popula esse conjunto. Se vazia, qualquer tipo é
aceito; se preenchida, valida.

```ts
type CostType = 'task' | 'resource' | 'material';

class Account {
  allowedTypes: Set<CostType>;  // vazio = todos
  canAccept(type: CostType): boolean {
    return this.allowedTypes.size === 0 || this.allowedTypes.has(type);
  }
}
```

Sintaxe:

```tjp
account "Custos" {
  aggregate tasks, resources, materials   # aceita os três
}
account "Livre" {
  # sem aggregate => aceita tudo
}
account "Só Tarefas" {
  aggregate tasks
}
```

**Compatibilidade:** `.tjp` com `aggregate tasks` funciona exatamente como antes.

### 4.2 Subtotais por tipo

`AccountScenario` passa a manter:

```ts
interface AccountBuckets {
  task: number;
  resource: number;
  material: number;
}
```

`turnover(startIdx, endIdx)` continua retornando o **total** (soma dos três
buckets), preservando a API do TaskJuggler. Novo método:

```ts
turnoverByType(startIdx: number, endIdx: number, type: CostType): number
```

`turnoverByType(.., 'task')` é o que a Fase 8 já fazia internamente. A novidade é
poder pedir os três separadamente.

### 4.3 `CostEvent` — unidade auditável

Toda vez que um valor é lançado numa conta, um `CostEvent` é registrado:

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

Os `CostEvent`s são armazenados em `Project.costEvents` (ou em
`AccountScenario`) e usados por relatórios e por debug de precedência.

### 4.4 Múltiplos `chargeset` por propriedade

Task, Resource e Material podem ter `chargeset` como lista. Regra: **no máximo um
por top-level account**.

```ts
class ChargeSetCollection {
  private sets: Map<Account, ChargeSet>; // key = top-level account

  add(set: ChargeSet): void {
    const top = set.master;
    if (top === null) throw new TjArgumentError('chargeset vazio');
    if (this.sets.has(top)) {
      throw new TjArgumentError(
        `já existe chargeset para top-level ${top.id}`
      );
    }
    this.sets.set(top, set);
  }

  forTop(top: Account): ChargeSet | null;
  forType(type: CostType): ChargeSet | null;   // resolve por tipo
  all(): Iterable<ChargeSet>;
}
```

Sintaxe:

```tjp
task "Foundation" {
  chargeset "Costs.Dev"          # custo
  chargeset "Revenues.Client"    # receita
}
```

**Compatibilidade:** `.tjp` com um chargeset continua funcionando.

### 4.5 Motor de precedência

Módulo novo: `src/core/accounting/attribution.ts`.

```ts
interface CostLine {
  type: 'task_charge' | 'resource_effort' | 'material_usage';
  amount: number;
  explicitAccount?: Account;
  task: Task;
  resource?: Resource;
  material?: Material;
}

function resolveAccount(line: CostLine): {
  account: Account;
  rule: CostEvent['attributionRule'];
}
```

**Ordem padrão (fallback mode):**

1. `explicitAccount` se presente → regra `explicit`.
2. Chargeset da **origem** para o tipo:
   - `resource_effort` → `resource.chargeset`
   - `material_usage` → `material.chargeset`
   - `task_charge` → cai em (3) diretamente
   Regra: `origin_chargeset`.
3. Chargeset padrão da tarefa → regra `task_chargeset_fallback`.
4. Conta default do projeto → regra `project_default`.

**Modo force:**

Se `task.chargesetMode === 'force'`, o step (2) é ignorado, e o chargeset da
tarefa domina tudo → regra `task_chargeset_force`. O chargeset da origem só é
usado se a tarefa não tiver chargeset para aquele tipo.

Configuração:

```tjp
task "Foundation" {
  chargeset "Costs.Dev"
  chargesetmode force    # opcional; default = fallback
}
```

### 4.6 Booking scenario-aware

Cada `ExtendedBooking` tem `scenarioIdx`. O `Project` sabe quais cenários têm
bookings. Regra:

- Se um cenário tem ≥ 1 booking → entra em **projection mode** automaticamente.
- `trackingscenario real` marca `real` como o cenário oficial.
- `CostEvent.mode` é `'actual'` para lançamentos originados de bookings no
  cenário marcado; `'planned'` caso contrário.

### 4.7 Integração com `turnover`

`TaskScenario.turnover` e `ResourceScenario.turnover` passam a:

1. Delegar ao motor de atribuição para resolver a conta de cada lançamento.
2. Emitir `CostEvent`s (ou chamar um callback que o `Project` registra).
3. Somar nos buckets corretos do `AccountScenario`.

Sem cache, sem otimização — replicar o O(n²) do Ruby.

### 4.8 Relatórios

`AccountScenario` expõe:

```ts
total(startIdx, endIdx): number
taskTotal(startIdx, endIdx): number
resourceTotal(startIdx, endIdx): number
materialTotal(startIdx, endIdx): number
planVsActual(startIdx, endIdx): {
  planned: number;
  actual: number;
  variance: number;
}
```

`AccountListRE` (Fase 14) consumirá isso. Aqui só a API.

### 4.9 Compatibilidade `.tjp`

- `aggregate tasks` → `allowedTypes = {'task'}` (comportamento idêntico).
- `aggregate resources` → `allowedTypes = {'resource'}`.
- Um chargeset único → `ChargeSetCollection` com 1 entrada.
- Sem `chargesetmode` → `'fallback'` (comportamento idêntico ao TJ quando não há
  chargeset na origem).
- Sem bookings → sem projection mode.

### 4.10 Erros

- `TjArgumentError` para: `chargeset` duplicado no mesmo top-level; tipo não
  aceito pela conta; `chargesetmode` inválido.
- `TjInternalError` para: tipo desconhecido no dispatch de `turnoverByType`.

### 4.11 Performance

Mantém-se O(n²) do Ruby. Sem cache. Sem memoização.

### 4.12 Sem `Decimal`, sem `any`

`Float` (number JS). `unknown` + narrowing. Tolerância `1e-6` nos golden tests.

---

## 5. Subfases detalhadas

### 8.2.0 — ADR 031 (modelo contábil estendido)

Documenta: (1) contas não exclusivas + subtotais por tipo; (2) `CostEvent` como
unidade auditável; (3) múltiplos chargesets com restrição por top-level; (4)
motor de precedência e `chargesetmode`; (5) booking scenario-aware e
`trackingscenario` como papel.

### 8.2.1 — `Account.allowedTypes`

Campo novo + `canAccept(type)`. Parser aceita lista em `aggregate`. Compatibilidade
preservada.

### 8.2.2 — `AccountScenario.turnoverByType` + buckets

Buckets internos por tipo; `turnover` continua somando tudo; `turnoverByType`
expõe separadamente.

### 8.2.3 — `CostEvent`

Classe + coleção no `Project`. Todo lançamento emite um evento.

### 8.2.4 — `ChargeSetCollection`

Substitui `chargeset` singular em Task/Resource/Material. Validação por top-level.

### 8.2.5 — Motor de precedência (`attribution.ts`)

Resolve conta + regra para um `CostLine`. Suporta `force` e `fallback`.

### 8.2.6 — Integração material

Material participa do motor; custo = `quantity × unitPrice`; distribuição
temporal via `MaterialAllocation`.

### 8.2.7 — Booking scenario-aware

`ExtendedBooking` ganha `scenarioIdx`; `Project` detecta projection mode;
`trackingscenario` marca o cenário oficial.

### 8.2.8 — Integração `turnover`

`TaskScenario.turnover` e `ResourceScenario.turnover` usam o motor e emitem
`CostEvent`s.

### 8.2.9 — API de relatórios (consolidado + breakdown + plan×actual)

Métodos no `AccountScenario`. Sem HTML (isso é Fase 14).

### 8.2.10 — Golden tests

Cenários com múltiplos tipos por conta, múltiplos chargesets por propriedade,
`force` vs `fallback`, plan × actual.

### 8.2.11 — Verificação final

`deno task check-all` verde, sem stubs, docs atualizadas, ADR 031 commitada.

---

## 6. Ordem de execução

```text
8.2.0  ADR 031
      ↓
8.2.1  Account.allowedTypes
      ↓
8.2.2  AccountScenario.turnoverByType + buckets
      ↓
8.2.3  CostEvent
      ↓
8.2.4  ChargeSetCollection
      ↓
8.2.5  Motor de precedência
      ↓
8.2.6  Integração material
      ↓
8.2.7  Booking scenario-aware
      ↓
8.2.8  Integração turnover
      ↓
8.2.9  API de relatórios
      ↓
8.2.10 Golden tests
      ↓
8.2.11 Verificação
```

Cada subfase fecha com `deno task check-all` verde.

---

## 7. Critério de conclusão

```bash
deno task check-all
```

E:

- [ ] `Account.allowedTypes` implementado; `aggregate` aceita lista.
- [ ] `AccountScenario.turnoverByType` + buckets.
- [ ] `CostEvent` emitido em todo lançamento.
- [ ] `ChargeSetCollection` com validação por top-level.
- [ ] Motor de precedência com `force` e `fallback`.
- [ ] Material integrado ao motor.
- [ ] Booking scenario-aware + projection mode automático.
- [ ] `turnover` de task/recurso emite eventos.
- [ ] API de relatórios (consolidado + breakdown + plan × actual).
- [ ] **≥ 100 testes unitários**.
- [ ] **≥ 30 golden tests**.
- [ ] Sem `any` em `src/`.
- [ ] ADR 031 criado.
- [ ] Compatibilidade `.tjp` verificada.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Quebra de compatibilidade `.tjp` | Alto | Golden tests da Fase 8 continuam verdes |
| `chargeset` duplicado no mesmo top-level | Médio | Validação explícita + erro claro |
| Ambiguidade na precedência | Alto | Regra documentada em ADR; golden tests por modo |
| `force` com origem divergente | Médio | Teste com task force + resource com chargeset próprio |
| `CostEvent` inflar memória | Médio | Documentar; opcional descartar em projetos grandes |
| Buckets divergirem do total | Alto | Teste de invariante: `sum(buckets) === total` |
| `turnoverByType` quebrar API da Fase 8 | Alto | `turnover` permanece com assinatura original |
| Múltiplos chargesets confundirem resolução | Médio | Resolver por `top-level account` + `type` explicitamente |

---

## 9. Referências cruzadas

- `docs/syntaxmesh/decisoes/020-modelo-contabil-estendido.md` (novo)
- `docs/syntaxmesh/fases/fase-8-financeiro.md`
- `docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md`
- `docs/taskjuggler/lib/taskjuggler/Account.rb`
- `docs/taskjuggler/lib/taskjuggler/AccountScenario.rb`
- `docs/taskjuggler/lib/taskjuggler/ChargeSet.rb`
- `docs/tj3-engine/10-blueprint-finance.md`

### Fases dependentes

- **Fase 9 — Orquestrador** (chama o motor de atribuição no scheduling).
- **Fase 14 — Reports** (`AccountListRE` com breakdown por tipo e plan × actual).
- **Fase 21 — Compatibilidade** (golden tests mwe004).

---

## 10. Notas para a IA

1. **Compatibilidade primeiro.** Nenhum `.tjp` da Fase 8 pode quebrar.
2. **`turnover` mantém assinatura.** `turnoverByType` é a API nova.
3. **`CostEvent` é emitido, não acumulado em duplicidade.** Se uma conta recebe
   via distribuição por shares, um único evento por linha de custo.
4. **Múltiplos chargesets: no máximo um por top-level.** Validar na inserção.
5. **`force` só na tarefa.** Recurso/material não têm modo force.
6. **Buckets somam ao total.** Invariante testada.
7. **Sem cache.** O(n²) replicado.
8. **`Float` sem `Decimal`.**
9. **Sem `any`.** `unknown` + narrowing.
10. **ADR 031** (não 019). ADR 019 é modelo financeiro base (Fase 8).

---

**Fim da Fase 8.2 (plano).**
