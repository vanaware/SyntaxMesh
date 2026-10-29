# Fase 11 (Gaps) — Fechamento e Auditoria das Fases 2–11

> **Arquivo:** `docs/syntaxmesh/fases/fase-11-logical-gaps.md`
> **Status:** ⬜ Não iniciada
> **Duração estimada:** 5–8 dias
> **Depende de:** Fases 2–12 concluídas
> **Bloqueia:** Fase 13 (e todas as subsequentes)
> **Natureza:** **fase de auditoria e fechamento**, não de features
> **Referência central:** `fase-11-logical-complemento.md` §6.10, §6.11

---

## 0. Nota de timing (2026-10-28)

Esta fase foi originalmente planejada para bloquear a Fase 12. **O plano mudou:**
a Fase 12 **já está em andamento** (12.0, 12.1, 12.2, 12.11 concluídas) e **vai
até o fim** antes desta fase começar. Portanto:

- **Fase 12 prossegue normalmente** (12.3–12.20), com awareness dos gaps.
- **Esta fase roda após a Fase 12 concluir** (por decisão do autor).
- **O gate real é para a Fase 13**, não para 12.
- **Testes da Fase 12 que dependem de G1–G4** (scheduler funcional) ficam
  **deferidos** durante 12 e são **varridos e reabilitados** aqui (Bloco K).
- **G5 (`to_rti` × 5)** é **entregue na Fase 12** (subfase 12.18), não ancorada
  para outra fase; aqui apenas **verificamos** que foi entregue.
- **Nada nesta fase impede 12.x de progredir.** Qualquer bloqueio em 12.x que
  aparecer é resolvido dentro da própria 12 (marcando o teste como `ignore: true`
  com `// Gate: fase-11-logical-gaps` até esta fase começar).

> **Consequência prática:** a Fase 12 chega ao fim com:
> - 12.0–12.18 entregues (incluindo `to_rti` × 5 = G5).
> - 12.19/12.20 possivelmente **parcialmente** entregues, com casos que dependem
>   de `Project.schedule()` marcados como `ignore: true` e com tag
>   `// Gate: fase-11-logical-gaps`.
> - A lista desses testes deferidos é **input explícito** para o Bloco K desta fase.

---

## 1. Contexto

As Fases 2–11 estão marcadas como concluídas individualmente (e a Fase 12 em
andamento). Porém, a auditoria final da 2ª onda do Complemento Fase 11 (§6.11) e
o adendo do `fase-7-scheduler-core-tarefas.md` registraram que:

- **o pipeline `Project.schedule()` não coloca datas nem bookings** num modelo
  mínimo, apesar de 215 itens de tarefa da Fase 7 estarem marcados como
  concluídos;
- **o teste-sentinela `logical-scheduler-driven_test.ts` foi relaxado** (§6.11),
  enfraquecendo a rede de proteção que deveria detectar regressões do scheduler;
- **os golden tests do scheduler passam** apesar do gap — sinal de que não estão
  comparando `start`/`end` de forma efetiva;
- **não existem testes end-to-end com o parser real** (Fase 10) validando
  `parse → schedule → report`;
- **12 stubs `NotYetImplementedError`** permanecem nas Fases 2–11, dos quais
  alguns são legítimos (ancorados em 12+) e outros podem esconder gaps reais.

Antes de iniciar a Fase 13, é preciso:

1. **Provar** (com testes) que as Fases 2–11 entregaram o que dizem ter entregado;
2. **Fechar** os gaps que são escopo de 2–11;
3. **Verificar** que G5 foi entregue pela Fase 12 (12.18);
4. **Ancorar formalmente** o que legitima ou depende de 13+;
5. **Sweep** dos testes deferidos da Fase 12;
6. **Criar um gate de saída** que impeça o início da Fase 13 sem essa garantia.

Esta fase **não implementa features novas**. Ela diagnostica, corrige, audita e
ancora.

---

## 2. Objetivo

Ao final desta fase:

- **Todos os gaps** identificados nas Fases 2–12 estão **fechados**,
  **entregues pela Fase 12** ou **formalmente ancorados** (com referência cruzada
  na fase dona).
- **Nenhum `NotYetImplementedError`** permanece sem anotação
  `// Ancorado: Fase N — <razão>` e sem entrada na matriz de completude.
- **`Project.schedule()` funciona end-to-end** em modelos construídos à mão
  **e** em `.tjp` parseados pela Fase 10.
- **Golden tests do scheduler comparam `start`/`end`/`effort` de cada task** e
  **falham** se um deles divergir do `tj3` real.
- **`logical-scheduler-driven_test.ts` reapertado**: metade 1 falha hoje (de
  propósito, como sentinela), metade 2 descomentada após o fix.
- **Testes deferidos da Fase 12 reabilitados** (Bloco K) — a lista é input
  explícito desta fase.
- **Matriz de completude** por fase (2–12) com status `verde`, `entregue` ou
  `ancorado`.
- **≥ 70 testes unitários + ≥ 30 golden tests + ≥ 15 invariantes** novos.
- **ADR 032** registrado: gate de saída para Fase 13 e política de stubs.
- `deno task check:all` verde.
- **Fase 13 pode começar** com a certeza documentada de que nada de 2–12 falta.

---

## 3. Inventário de gaps

Esta tabela é a **fonte da verdade**. Cada linha será verificada e fechada (ou
ancorada) por uma tarefa em `fase-11-logical-gaps-tarefas.md`.

| ID | Gap | Origem documentada | Fase dona | Ação nesta fase |
|---|---|---|---|---|
| **G1** | Placement de datas em `Project.schedule()` — `end` permanece `null` em modelo mínimo | §6.10 de `fase-11-logical-complemento.md`; adendo em `fase-7-scheduler-core-tarefas.md` | 7 | **Fechar aqui** (P0) |
| **G2** | `logical-scheduler-driven_test.ts` relaxado (§6.11) — sentinela enfraquecido | §6.11 | 7 | **Fechar aqui** (reapertar) |
| **G3** | Golden tests do scheduler não comparam `start`/`end` (passam apesar do G1) | Avaliação 2026-10-28 | 7/21 | **Fechar aqui** (regenerar) |
| **G4** | Testes end-to-end com parser real ausentes (`parse → schedule → report`) | Avaliação 2026-10-28 | 7/9/10 | **Fechar aqui** |
| **G5** | `to_rti` × 5 stubs: `attribute-base.ts:232`, `reference-attribute.ts:42`, `resource-list-attribute.ts:54`, `query.ts:608`, `project-file-parser.ts:463` | §6.11 | 12 | **Verificar entrega em 12.18** |
| **G6** | `isoncriticalpath` — stub; não existe slack/float nem no Ruby vendorizado | §6.6, §6.11 | 14 | **Ancorar em 14** |
| **G7** | `TaskJuggler#freeze` — stub; escreve arquivo (OPFS/Storage) | §6.11 | 14 | **Ancorar em 14** |
| **G8** | `project.defaultAccount` — regra 4 do `resolveAccount` é no-op | §6.11 | 8.2 | **Ancorar em 8.2** |
| **G9** | `checkTimeSheet`/`checkStatusSheet`/`istaskstatus` — stubs; dependem de sheets (Fase 18) | §6.6, §6.11 | 18 | **Ancorar em 18** |
| **G10** | `hasalert`/`LogicalFlag` (ramo Journal)/leave-allowance — stubs; dependem de Journal (Fase 16) | §6.6 | 16 | **Ancorar em 16** |
| **G11** | `TaskJuggler#parse`/`parseFile`/`parseContent` — stubs; transporte de arquivo (Fase 19) | §6.11 | 19 | **Ancorar em 19** |
| **G12** | `query_*` concretos de `TaskScenario`/`ResourceScenario` — métodos dependem de scheduling/finance (7/8/14/18) | §6.9, §6.11 | 7/8/14/18 | **Verificar viáveis + ancorar** |
| **G13** | Blocos C0–C4 do Complemento Fase 10 (material, picture, format, timebasis, breakdownreport, rdoreport) | `fase-10-complemento-tarefas.md` | 10 | **Verificar entregue** |
| **G14** | Migração `MockProject → Project` (§9.10 da Fase 9) — verificar 100% | `fase-9-tarefas.md` §9.10 | 9 | **Verificar 100%** |
| **G15** | Contas não exclusivas + buckets + `CostEvent` + múltiplos chargesets + plan×actual funcionam end-to-end | `fase-8.2-tarefas.md` | 8/8.1/8.2 | **Verificar end-to-end** |
| **G16** | Motor lógico + Query + AST equivalence (3 idiomas) da Fase 11 | `fase-11-logica-queries-tarefas.md` | 11 | **Verificar completo** |
| **G17** | `ScenarioData#error/warning/info` roteiam para `MessageHandlerInstance` | §6.11 | 9 | **Verificar com teste** |
| **G18** | `TaskJuggler#errors` reflete `MessageHandlerInstance.errors` | §6.11 | 9 | **Verificar com teste** |
| **G19** | Atributos pré-carregados via ADR 016 em `*Scenario` (Fase 5) | `fase-5-entidades-concretas-tarefas.md` §5.1 | 5 | **Verificar end-to-end** |
| **G20** | `backupAttributes`/`restoreAttributes` (Fase 4) funcionam (base para Fase 14) | `fase-4-arvore-propriedades-tarefas.md` §4.4 | 4 | **Verificar com teste** |
| **G21** | Testes da Fase 12 marcados como `ignore: true` por depender de G1–G4 (ver Bloco K) | Coordenação Fase 12 | 12 | **Sweep: reabilitar todos** |

> **Legenda:**
> - **Fechar aqui** = desenvolver agora (P0).
> - **Verificar** = apenas testar o que já existe (ou deveria existir), sem desenvolvimento novo.
> - **Verificar entrega em 12.18** = a Fase 12 deve ter entregado; aqui confirmamos e, se faltou, corrigimos (mas é responsabilidade de 12.18).
> - **Ancorar em N** = registrar stub com referência explícita à fase N (que já deve ter uma tarefa anotada para completá-lo).
> - **Sweep** = varrer a lista de testes deferidos da Fase 12, remover `ignore: true` e verificar que passam com os gaps fechados.

---

## 4. Decisões de projeto

### 4.1 Fechar vs verificar vs ancorar

**Fechar nesta fase (P0):** gaps cuja fase dona **já passou** (2–11) e que
**não dependem** de APIs de fases 13+. É o caso de G1, G2, G3, G4.

**Verificar nesta fase:** gaps que devem ter sido entregues por uma fase já
concluída (Fase 12) ou por fases anteriores; a fase de gaps só confirma com
testes. É o caso de G5, G12, G13–G20, G21.

**Ancorar (sem desenvolvimento):** gaps cuja fase dona **ainda não começou** e
que dependem de APIs dessas fases. É o caso de G6–G11. A ancoragem significa:

1. Adicionar `// Ancorado: Fase N — <razão>` no ponto do stub.
2. Adicionar a entrada correspondente no `-tarefas.md` da fase N (se ainda não
   existir).
3. Incluir na **matriz de completude** (subfase G.4) com status `ancorado`.

### 4.2 Verificar com testes (não com leitura)

Cada `Verificar` no inventário produz **um teste novo** que falha se o gap
existir. Não basta ler o código — a garantia é o teste verde.

### 4.3 Gate de saída — `gate:phase-13`

O gate **bloqueia o início da Fase 13**, não a Fase 12. A Fase 12 corre até o
fim normalmente (ver §0).

**`deno task gate:phase-13`** — roda:

1. `deno task check:all`.
2. `deno task test:integration` — inclui os testes end-to-end com parser real.
3. `deno task test:invariants` — invariantes do scheduler sobre projetos gerados.
4. `deno task test:golden:scheduler` — compara `start`/`end`/`effort` contra
   `tj3` real; **falha se um golden divergir**.
5. `deno task check:stubs` — falha se `NotYetImplementedError` sem
   `// Ancorado: Fase N`.
6. `deno task gaps:audit` — falha se algum gap do inventário ainda estiver
   `pendente`.
7. `deno task test:deferred` — reabilita e roda todos os testes que a Fase 12
   marcou como `// Gate: fase-11-logical-gaps`.

**Gate parcial disponível já (durante a Fase 12):**

- `deno task check:stubs` — pode rodar a qualquer momento.
- `deno task gaps:audit` — pode rodar a qualquer momento.
- `deno task test:integration --filter "minimal"` — só o caso mínimo (falha
  hoje, sentinela do G1).

Só antes de **iniciar a Fase 13** é que `gate:phase-13` precisa ficar verde.

### 4.4 Política de stubs

Todo `NotYetImplementedError` deve, a partir desta fase:

```ts
// Ancorado: Fase 14 — isoncriticalpath depende de slack/float no scheduler.
// Coberto por: fase-14-relatorios-tarefas.md §14.25.
throw new NotYetImplementedError("Fase 14");
```

**Regra:** `check:stubs` falha se encontrar `NotYetImplementedError` sem esse
padrão. Isso impede que stubs "esquecidos" passem como "concluídos".

### 4.5 Invariantes como rede de proteção

Adicionar testes de invariante (fuzz/property) que qualquer cronograma válido
deve satisfazer:

- Toda task `scheduled` tem `start !== null && end !== null`.
- `start <= end` em todas as tasks.
- Toda milestone tem `start == end`.
- Toda dependência respeitada (`B.start >= A.end` se `B depends A`).
- Tasks dentro do range do projeto (ou `isRunAway === true`).

Esses testes **não substituem** os golden tests; são uma **rede de proteção**
que detecta regressões cedo.

### 4.6 Ferramenta de diagnóstico commitada

Criar `debug/schedule_probe.ts`: script que recebe um `.tjp`, roda
`parse → schedule`, e dumpar JSON com `MessageHandlerInstance.errors`,
`TaskScenario.start/end/doneEffort/isRunAway`, `ResourceScenario.effort/duties`
por task/recurso. Commitado, versionado, executável em CI.

**Motivação:** o §6.10 já usou "probe ao vivo" ad-hoc; torná-lo ferramenta
permanente acelera qualquer diagnóstico futuro (das fases 13+ também).

### 4.7 Relação com a Fase 12 (concluída antes desta fase)

A Fase 12 **corre até o fim antes desta fase começar** (decisão do autor,
2026-10-28). Isso implica:

- **12.0–12.17 prosseguem sem dependência de G1–G4.** São fundação
  (`RichTextElement`, `RichTextScanner`, `RichTextParser`, `RichTextIntermediate`,
  handlers) que não precisam do scheduler.
- **12.18 (integração com parser) entrega os 5 stubs de `to_rti` (G5).** A
  integração `RichTextFactory` ↔ `ProjectFileParser` **não** precisa do
  scheduler; portanto, 12.18 conclui mesmo com G1–G4 abertos.
- **12.19 (golden tests de RichText) é executada com ressalvas.** Casos que
  comparam apenas markup (o grosso) passam. Casos que comparam HTML final de
  relatórios gerados a partir de projetos agendados ficam **deferidos** com
  `ignore: true` + tag `// Gate: fase-11-logical-gaps`. Esses casos são
  **sweepados** no Bloco K desta fase.
- **12.20 (verificação final da Fase 12) é parcial.** O smoke test que passa por
  `Project.schedule()` fica deferido; os demais passam.
- **A Fase 12 é marcada como `✅ Concluída (com N testes deferidos para
  fase-11-logical-gaps)`** no `README.md` e `CURRENT.md`.
- **A Fase 13 não começa** enquanto `gate:phase-13` não estiver verde.

**Lista inicial de testes provavelmente deferidos** (a ser confirmada no Bloco
K ao final):

- `tests/golden/richtext_golden_test.ts` — casos que comparam HTML de reports
  gerados por projetos agendados.
- `tests/integration/smoke_after_phase_12_test.ts` — se chamar
  `Project.schedule()`.
- Quaisquer casos de 12.19/12.20 que dependam de `start`/`end` populados pelo
  scheduler.

### 4.8 G5 — reclassificado como "verificar entrega", não "ancorar"

G5 (`to_rti` × 5) **é entregue pela Fase 12** (subfase 12.18). Não é ancoragem
para outra fase. Nesta fase:

- **Verificar** que os 5 stubs foram substituídos por implementações reais.
- **Testar** que `RichTextAttribute.to_rti`, `ReferenceAttribute.to_rti`,
  `ResourceListAttribute.to_rti`, `Query.setQuery`/`to_rti` e
  `ProjectFileParser.newRichText` funcionam end-to-end.
- Se por algum motivo 12.18 não tiver entregue (imprevisto), a tarefa
  `11.G.F.4.1` abre uma exceção: implementar aqui com prioridade.

---

## 5. Subfases

**Bloco A — Infraestrutura de diagnóstico** (11.G.A.1–11.G.A.5)
**Bloco B — Fechar G1 (placement de datas)** (11.G.B.1–11.G.B.8)
**Bloco C — Fechar G2 e G3 (sentinela + golden)** (11.G.C.1–11.G.C.2)
**Bloco D — Fechar G4 (end-to-end com parser real)** (11.G.D.1–11.G.D.2)
**Bloco E — Auditoria por fase (4–10)** (11.G.E.1–11.G.E.5)
**Bloco F — Auditoria Fase 11 + verificação G5 (Fase 12)** (11.G.F.1–11.G.F.4)
**Bloco G — Matriz de completude e ancoragem** (11.G.G.1–11.G.G.4)
**Bloco H — Invariantes e fuzz** (11.G.H.1–11.G.H.3)
**Bloco I — Gate de saída + ADR 032** (11.G.I.1–11.G.I.2)
**Bloco K — Sweep dos testes deferidos pela Fase 12** (11.G.K.1–11.G.K.2)
**Bloco J — Verificação final** (11.G.J.1–11.G.J.6)

Detalhamento em `fase-11-logical-gaps-tarefas.md`.

---

## 6. Ordem de execução

```
11.G.A  Infraestrutura (probe, instrumentação, sentinela)
   ↓
11.G.B  Fechar G1 (placement)
   ↓
11.G.C  Fechar G2, G3 (sentinela + golden)
   ↓
11.G.D  Fechar G4 (end-to-end com parser)
   ↓
11.G.K  Sweep dos testes deferidos da Fase 12
   ↓
11.G.E  Auditoria 4–10 (verificações)
   ↓
11.G.F  Auditoria 11 + verificar G5 (Fase 12)
   ↓
11.G.G  Matriz de completude + ancoragem
   ↓
11.G.H  Invariantes e fuzz
   ↓
11.G.I  Gate de saída + ADR 032
   ↓
11.G.J  Verificação final
```

Cada subfase fecha com `deno task check:all` verde.

---

## 7. Critério de conclusão

```bash
deno task gate:phase-13
```

passa, e:

- [ ] Inventário (Seção 3) com **100%** das linhas em `fechado`, `verificado` ou
      `ancorado`.
- [ ] `Project.schedule()` funciona end-to-end em modelo mínimo (G1).
- [ ] `logical-scheduler-driven_test.ts` reapertado (G2).
- [ ] Golden tests do scheduler comparam `start`/`end`/`effort` e falham se
      divergem do `tj3` real (G3).
- [ ] Testes end-to-end com parser real (G4) — ≥ 10 casos cobrindo
      parser → schedule → report.
- [ ] `to_rti` × 5 da Fase 12 verificados funcionando (G5).
- [ ] **Testes deferidos da Fase 12 sweepados e reabilitados** (G21).
- [ ] ≥ 70 testes unitários novos.
- [ ] ≥ 30 golden tests regenerados.
- [ ] ≥ 15 testes de invariante novos.
- [ ] Nenhum `NotYetImplementedError` sem `// Ancorado: Fase N`.
- [ ] Matriz de completude por fase (2–12) com status verde/verificado/ancorado.
- [ ] ADR 032 (gate + política de stubs) registrado.
- [ ] `deno task check:all` verde.

---

## 8. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| G1 mais amplo do que o diagnosticado | Alto | Subfase A (probe) antes de B; localizar exato |
| Fechar G1 quebra outros testes | Alto | Sentinelas e invariantes detectam; rodar check:all após cada tarefa |
| Fase 12 marcou **muitos** testes como deferidos | Médio | Sweep do Bloco K prioriza; se > 20, avaliar se a Fase 12 precisa de revisão antes do gate |
| 12.18 não entregou G5 | Baixo | Tarefa 11.G.F.4.1 cobre como exceção |
| Ancorar gap que **não** é escopo de fase futura | Alto | Revisão manual antes de ancorar; cada `// Ancorado` exige tarefa na fase dona |
| Invariantes com falsos positivos | Médio | Fuzz restrito a projetos construídos para passar validações |
| `check:stubs` quebrar em stubs legítimos | Médio | Exceções explícitas no script (regex) |
| Gate muito rigoroso | Médio | Baseline inicial permissivo; endurecer gradualmente |
| Tempo subestimado | Alto | Foco em P0 primeiro (G1–G4); Bloco K pode virar follow-up se necessário |

---

## 9. Referências cruzadas

### Documentos internos

- `docs/syntaxmesh/fases/fase-11-logical-complemento.md` §6.10, §6.11 — origem
- `docs/syntaxmesh/fases/fase-7-scheduler-core-tarefas.md` — adendo "Gap remanescente"
- `docs/syntaxmesh/fases/fase-7-scheduler-core.md` — README da Fase 7
- `docs/syntaxmesh/fases/fase-9-tarefas.md` §9.10 — migração MockProject → Project
- `docs/syntaxmesh/fases/fase-10-complemento-tarefas.md` — Blocos C0–C4
- `docs/syntaxmesh/fases/fase-11-logica-queries-tarefas.md` — Fase 11
- `docs/syntaxmesh/fases/fase-12-richtext-tarefas.md` — Fase 12 (rodou antes)
- `docs/syntaxmesh/fases/README.md` — mapa das 21 fases
- `CURRENT.md` — estado atual

### Código

- `packages/core/src/model/project.ts` — `Project.schedule()`
- `packages/core/src/model/task-scenario.ts` — `schedule`/`bookResources`/`propagateDate`
- `packages/core/src/model/resource-scenario.ts` — `book`/`available`
- `packages/core/src/model/scenario-data.ts` — `error`/`warning`/`info`
- `packages/core/src/taskjuggler.ts` — `parse`/`parseContent`/`freeze`/`checkTimeSheet`
- `packages/core/src/query/query.ts`
- `packages/core/src/richtext/**` — entregue pela Fase 12
- `packages/core/tests/integration/logical-scheduler-driven_test.ts`
- `packages/core/tests/golden/project-schedule_golden_test.ts`
- `packages/core/tests/golden/richtext_golden_test.ts` — pode ter casos deferidos

### Fases futuras (âncoras)

- Fase 14 — `isoncriticalpath`/`freeze` (G6, G7)
- Fase 16 — `hasalert`/`LogicalFlag` Journal (G10)
- Fase 18 — `checkTimeSheet`/`istaskstatus` (G9)
- Fase 19 — `parse`/`parseContent` (G11)

---

## 10. Notas para a IA

1. **Ordem estrita:** A → B → C → D → K → E → F → G → H → I → J.
2. **P0 é G1.** Sem fechar G1, o resto é vaidade.
3. **Instrumentar antes de consertar.** Bloco A commitado antes do Bloco B.
4. **Não fechar gap de fase futura.** Se não é de 2–11 (ou entregável por 12),
   ancorar. Nunca implementar feature de 13+ aqui.
5. **Todo `NotYetImplementedError` precisa de `// Ancorado: Fase N — <razão>`
   e entrada na matriz.** Sem exceção.
6. **Todo golden test do scheduler compara `start`/`end`/`effort`.** Comparar
   apenas um deles é sinal de golden mal gerado.
7. **Todo teste de invariante é determinístico** — não usar `Math.random` sem
   seed.
8. **Sem `any`.** `unknown` + narrowing.
9. **Sem refatorações grandes** — corrigir o gap, não "melhorar de passagem".
10. **Sweep do Bloco K é obrigatório.** Nenhum teste deferido pode ficar com
    `ignore: true` ao final desta fase.
11. **Commit por subfase:** `test(quality): probe-scheduler`,
    `fix(core): schedule-placement`, `test(quality): golden-scheduler-start-end`,
    `test(quality): reenable-deferred-from-phase-12`, etc.
12. **Registrar ADR 032** (gate + política de stubs) antes de fechar o Bloco I.
13. **Atualizar `CURRENT.md`** ao final com "Gaps de 2–12 fechados; Fase 13
    liberada."

---

## 11. ADR 032 (referência rápida)

Criado na subfase 11.G.I.1. Conteúdo esperado:

- **Título:** Gate de saída para Fase 13 e política de stubs
- **Contexto:** descoberta de que fases "concluídas" podiam esconder gaps;
  necessidade de impedir regressões futuras; Fase 12 rodou antes do fechamento.
- **Decisão:**
  - `deno task gate:phase-13` composta dos 7 comandos (ver §4.3).
  - `check:stubs` exige `// Ancorado: Fase N` em todo `NotYetImplementedError`.
  - Testes deferidos da Fase 12 usam `// Gate: fase-11-logical-gaps` e são
    sweepados no Bloco K.
  - Matriz de completude (`completude-matrix.md`) versionada e atualizada por
    fase.
- **Alternativas:** confiar em revisão manual (frágil); gate apenas `check:all`
  (insuficiente).
- **Consequências:** mais rigoroso; uma fase "concluída" passa a significar
  "provada por testes".

---

**Fim do plano de fechamento de gaps.**