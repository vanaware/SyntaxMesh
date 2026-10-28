# Complemento Fase 11 — Funções, Atributos e Flags Lógicas

> **Arquivo:** `docs/syntaxmesh/fases/fase-11-logical-complemento.md`
> **Plano base:** `docs/syntaxmesh/fases/fase-11-logica-queries.md`
> **Tarefas:** `docs/syntaxmesh/fases/fase-11-logica-queries-tarefas.md` (11.0–11.14 concluídas)
> **Status:** 🟡 Em andamento — 1ª onda (LC-A/LC-B/LC-D + LF.1) e **2ª onda
> (§6: G1–G5) executadas em 2026-10-27**: `TaskScenario#getAllocatedTime`
> portado, 10 funções de datas/alocações/material implementadas, `flags` no
> parser de material habilitado. Restam apenas os bloqueios reais com âncora
> nas Fases 14/16/18/21 (G6/G7/G8). Review pós-onda (a)–(g) e fechamento do
> G1.4 (com âncora no gap de scheduler da Fase 7): §6.10.
> **Fonte Ruby:** `docs/taskjuggler/lib/taskjuggler/LogicalFunction.rb`, `LogicalOperation.rb`, `TjpSyntaxRules.rb`, `i18n/*`
> **ADRs:** 011 (port fiel), 023 (i18n de keywords), 024 (expressões sem precedência)

---

## 0. Escopo e conciliação com a fonte de verdade

Este complemento detalha três aspectos pedidos: **funções lógicas**, **atributos
lógicos** e **flags lógicas**. Antes de planejar, vale a conciliação com a
implementação atual, porque boa parte das funções listadas na documentação **não
existe no TaskJuggler 3.8.4** (a fonte de verdade do port, ADR 011).

**Estado atual (Fase 11 concluída):** `src/logic/logical-function.ts` implementa
as **14 funções** exatamente como o `@@functions` do `LogicalFunction.rb`:
`hasalert, isactive, ischildof, isdependencyof, isdutyof, isfeatureof, isleaf,
ismilestone, isongoing, isresource, isresponsibilityof, istask, isvalid,
treelevel`. O port está **fiel** — não há função do Ruby "faltando".

**As demais funções do pedido** (`isParentOf`, `startsAfter/Before`,
`endsAfter/Before`, `isAllocated(ToProject)`, `isOnCriticalPath`, `isTaskStatus`,
`isTaskOfProject`, `hasAssignment`, `isAnAccount`, `isAccount`, `isTask(ID)`,
`isResource(ID)`) e as **de material** aparecem na documentação online do TJ, mas
retornam **0 ocorrências** no `docs/taskjuggler` vendorizado. Elas são portanto
**extensões além do port fiel** (legítimas — o SyntaxMesh já estende o TJ com
material/picture/tempo, cfr. Fases 8.1 e Complemento 10).

**Consequência de arquitetura (decisão do usuário, 2026-10-27):**

1. **Registrar agora, avaliar depois.** Para funções que dependem de
   scheduling/financeiro (Fases 7/8, ainda incompletas — ver §4), adicionamos
   **nome + aridade + `to_s` + dispatch** com avaliação `NotYetImplementedError`
   (ou duck-typed `false` quando não há risco de falso-positivo). As expressões
   ficam **parseáveis e validáveis** já; a avaliação real é completada pela fase
   que construir o pré-requisito.
2. **Extensões de relatório** (`hidematerial`/`hidepicture`/`rollupmaterial` +
   confirmação de hide/rollup de task/resource/account) vão como **adendo na
   Fase 14** (padrão do Complemento 10), não neste arquivo.
3. **Implementar agora o que é viável sem scheduling**: `isParentOf`,
   `isAnAccount`/`isAccount`, `isAnMaterial`/`isMaterial`, `isTaskOfProject` e
   os registros-stub das bloqueadas.

### 0.1 Convenções deste complemento

- **Sem `any` em `src/`** — `unknown` + narrowing (como o resto da Fase 11).
- **Nomes canônicos em minúsculo** (`isparentof`, `isanaccount`) — iguais aos do
  Ruby; o lexer normaliza via `LanguageRegistry` (ADR 023).
- **Parser não muda:** `operand` aceita **qualquer** `$ID` + `argumentList` como
  `LogicalFunction` (a regra `functionPatterns` é só-documental). Registro =
  `FUNCTIONS` map + `eval` + i18n + teste.
- **i18n obrigatório:** cada nome novo entra em `canonical.ts` + `en` + `pt-BR`
  + `es` (ADR 023), senão quebra AST-equivalence multilíngue.
- **Funções 0-arg já existentes** (`istask`/`isresource`/`isleaf`/`treelevel`)
  **não** estão hoje em `canonical.ts` (só as de 1+ arg). Ver pendência D-3.

---

## 1. Funções lógicas

### 1.1 Tabela de conciliação

Legenda — **Fiel**: já portada (Ruby). **Alias**: mesma função com outro nome de
documentação. **Viável**: extensão nova, dá para fazer agora. **Bloqueada**:
extensão nova que exige o pré-requisito da Fase indicada.

| Função (pedido)      | Nome canônico | Args | Categoria        | Pré-requisito      |
|----------------------|---------------|------|------------------|--------------------|
| isChildOf(ID)        | ischildof     | 1    | Fiel             | —                  |
| isLeaf()             | isleaf        | 0    | Fiel             | —                  |
| isDependencyOf(…)    | isdependencyof| 3    | Fiel             | — (parcial, §4)    |
| isMilestone(…)       | ismilestone   | 1    | Fiel             | —                  |
| isDutyOf(…)          | isdutyof      | 2    | Fiel             | —                  |
| isResource()         | isresource    | 0    | Fiel             | —                  |
| isTask()             | istask        | 0    | Fiel             | —                  |
| treeLevel()          | treelevel     | 0    | Fiel             | —                  |
| isA*Task/Resource()  | istask/isresource | 0 | Alias          | — (D-1)            |
| isParentOf(ID)       | isparentof    | 1    | **Viável**       | `PropertyTreeNode.parent`/`isChildOf` |
| isAnAccount()        | isanaccount   | 0    | **Viável**       | classe `Account`   |
| isAccount(ID)        | isaccount     | 1    | **Viável**       | `Project.account(id)` |
| isTaskOfProject(ID)  | istaskofproject| 1   | **Viável**       | `property.project` |
| isUsedAt(Mat,Scn)    | isusedat      | 2    | **Viável (parc.)**| `MaterialScenario` (§4) |
| isAnMaterial()       | isanmaterial  | 0    | **Viável**       | classe `Material`  |
| isMaterial(ID)       | ismaterial    | 1    | **Viável**       | `Project.material(id)` |
| isTask(ID)           | istask?       | 1    | **Conflito (D-2)**| —                 |
| isResource(ID)       | isresource?   | 1    | **Conflito (D-2)**| —                 |
| hasAssignment(ID,D,D)| hasassignment | 3    | **Bloqueada**    | Fase 7 (alocações) |
| isAllocated(ID,D,D)  | isallocated   | 3    | **Bloqueada**    | Fase 7 (alocações) |
| isAllocatedToProject | isallocatedtoproject | 4 | **Bloqueada** | Fase 7          |
| isUsed(ID,D,D)       | isused        | 3    | **Bloqueada**    | Fase 7 (tempo)     |
| isUsedAtProject(…)   | isusedatproject| 4   | **Bloqueada**    | Fase 7             |
| startsAfter(ID,D)    | startsafter   | 2    | **Bloqueada**    | Fase 7 (start agend.) |
| startsBefore(ID,D)   | startsbefore  | 2    | **Bloqueada**    | Fase 7             |
| endsAfter(ID,D)      | endsafter     | 2    | **Bloqueada**    | Fase 7 (end agend.) |
| endsBefore(ID,D)     | endsbefore    | 2    | **Bloqueada**    | Fase 7             |
| isOnCriticalPath(ID) | isoncriticalpath | 1 | **Bloqueada**   | Fase 7 (caminho crítico) |
| isTaskStatus(ID,ST)  | istaskstatus  | 2    | **Bloqueada**    | Fase 7/14 (status) |

### 1.2 Decisões pendentes (devem ser resolvidas antes/durante a execução)

- **D-1 — Aliases `isATask`/`isAResource`:** o Ruby chama-as `istask`/`isresource`
  (0-arg). Manter nomes Ruby como canônicos (ADR 011); **não** duplicar. A
  documentação apenas usa prosa `isA…`. *(Recomendado: não criar alias.)*
- **D-2 — `isTask(ID)`/`isResource(ID)`:** colidem de aridade com `istask`/
  `isresource` (0-arg) — `FUNCTIONS` aceita uma aridade por nome. A semântica
  "é a tarefa com id X" já é coberta por `id = "X"` em expressão. *(Recomendado:
  NÃO adicionar; documentar a cobertura alternativa. Se o usuário insistir, criar
  nomes distintos — ex. `istaskid`/`isresourceid`.)*
- **D-3 — Funções 0-arg ausentes do i18n:** `isleaf`/`istask`/`isresource`/
  `treelevel` estão no `FUNCTIONS` mas **não** em `canonical.ts`. Verificar se o
  lexer as resolve por `$ID` (caso ok, apenas documentar) ou se precisam entrar no
  registry para tradução. Testar pt-BR/es.

### 1.3 Tarefas — Bloco LC-A: infra de registro (novo)

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| LC-A.1 | Separar `FUNCTIONS_RUBY` (14 fiéis) de `FUNCTIONS_EXT` (extensões) num único map de lookup, com comentário marcando cada função como fiel/extensão/bloqueada | `src/logic/logical-function.ts` | `deno check` |
| LC-A.2 | Helper `registerFunction(name, arity, kind)` para adicionar entradas; manter `setArgumentsAndCheck` funcionando p/ ambos os grupos | idem | 2 testes |
| LC-A.3 | Dispatch `eval` estendido: funções viáveis → método real; funções bloqueadas → `NotYetImplementedError(fase, name)`; registrar tabela nome→fase | idem | `deno check` |
| LC-A.4 | Adicionar todas as funções novas a `canonical.ts` | `src/i18n/canonical.ts` | `deno check` |
| LC-A.5 | Traduções `en`/`pt-BR`/`es` para cada nome novo (seguir padrão `eativo`/`emarco`) | `src/i18n/{en,pt-BR,es}.ts` | 1 teste i18n |
| LC-A.6 | Resolver D-3: garantir que nomes 0-arg sejam keywords OU documentar por que `$ID` basta | `src/i18n/*`, `parser/rules/logic.ts` | teste AST-equivalence |

### 1.4 Tarefas — Bloco LC-B: funções viáveis hoje (implementar + testar)

| # | Tarefa | Semântica | Verificação |
|---|--------|-----------|-------------|
| LC-B.1 | `isparentof(id)` — `[property].parent` casa com o nó `id` do mesmo propertySet (espelho de `ischildof`) | retorna bool | 3 testes |
| LC-B.2 | `isanaccount()` — `property instanceof Account` | 0-arg bool | 2 testes |
| LC-B.3 | `isaccount(id)` — `instanceof Account` e id/fullId casa via `project.account(id)` | 1-arg bool | 3 testes |
| LC-B.4 | `istaskofproject(id)` — `property.project` tem `projectId`/id igual | 1-arg bool | 2 testes |
| LC-B.5 | `isanmaterial()` — `property instanceof Material` | 0-arg bool | 2 testes |
| LC-B.6 | `ismaterial(id)` — `instanceof Material` + `project.material(id)` | 1-arg bool | 3 testes |
| LC-B.7 | Resolver D-2 e registrar decisão (nada/renomear) | doc/decisão | — |

### 1.5 Tarefas — Bloco LC-C: funções de material (extensão SyntaxMesh)

| # | Tarefa | Categoria | Verificação |
|---|--------|-----------|-------------|
| LC-C.1 | `isusedat(materialid, scenarioid)` — material alocado à tarefa no cenário (usa `MaterialScenario`/`MaterialAllocation` se existir; senão stub Fase 7/8.1) | Viável-parcial | 3 testes |
| LC-C.2 | `hasassignment(id,d,d)` — **estender** p/ material também (nome único, detecta tipo) | Bloqueada (Fase 7) | stub + 1 teste |
| LC-C.3 | `isused(id,d,d)` — material alocado no intervalo | Bloqueada (Fase 7) | stub + 1 teste |
| LC-C.4 | `isusedatproject(prj,scn,d,d)` — material alocado ao projeto no intervalo | Bloqueada (Fase 7) | stub + 1 teste |

### 1.6 Tarefas — Bloco LC-D: registrar bloqueadas (stub + pré-requisito)

| # | Tarefa | Fase | Verificação |
|---|--------|------|-------------|
| LC-D.1 | `isallocated(id,d,d)` stub → `NotYetImplementedError("7", …)` | Fase 7 | 1 teste (throws) |
| LC-D.2 | `isallocatedtoproject(prj,scn,d,d)` stub | Fase 7 | 1 teste |
| LC-D.3 | `startsafter/startsbefore(id,d)` stubs | Fase 7 | 2 testes |
| LC-D.4 | `endsafter/endsbefore(id,d)` stubs | Fase 7 | 2 testes |
| LC-D.5 | `isoncriticalpath(id)` stub | Fase 7 | 1 teste |
| LC-D.6 | `istaskstatus(id,status)` stub (+ validação do enum de status quando real) | Fase 7/14 | 1 teste |
| LC-D.7 | `hasassignment(id,d,d)` (task/resource) stub | Fase 7 | 1 teste |

### 1.7 Tarefas — Bloco LC-E: testes e golden

| # | Tarefa | Verificação |
|---|--------|-------------|
| LC-E.1 | Testes BDD de cada função viável (LC-B/LC-C) com `createTestProject` + entidades reais | `deno test` |
| LC-E.2 | Teste de parsing das funções novas em en/pt-BR/es (AST equivalente) | teste i18n |
| LC-E.3 | Extender `scripts/golden/logical-expressions.rb` **apenas** com casos de funções viáveis cujo resultado Ruby↔TS concorda | golden regenerado |
| LC-E.4 | Documentar no `scripts/golden/README.md` que funções bloqueadas não entram no golden | — |

---

## 2. Atributos lógicos (material, charge, cenário)

Objetivo: permitir que **atributos de material e de charge (valor)**, quando
alocados em cenário, sejam usados em expressões com `<cenário>.<atributo>` como
já se faz com tasks/resources. E decidir `isvalid()` para material.

### 2.1 Análise (a confirmar na execução)

- `LogicalAttribute.eval` já resolve **qualquer** `attributeId` via `Query.process`
  → `property.getForScenario(attr, scIdx)`. Logo, desde que material/charge tenham
  os atributos registrados como `isScenarioAttribute`, o acesso funciona sem mudar
  `logical-attribute.ts`.
- Material tem `effortdone`/`effortleft` (scenario-specific) — já acessível. Falta
  expor os demais campos de `MaterialScenario`/alocação como atributos consultáveis.
- Charge (valor) — verificar quais atributos existem e quais são de cenário
  (`Fase 8.1` — `charge`/`booking` estendidos). Pendente de auditoria de
  `attributes/`.
- `isvalid()` para material: a função atual é genérica (lê
  `attributeDefinition(attr)` + `getForScenario`). Como material é um
  `PropertyTreeNode` com `attributeDefinition`, **`isvalid()` já funciona** — só
  confirmar com teste. Se material não expõe `attributeDefinition`, adicionar
  verificação equivalente ao de datas de task.

### 2.2 Tarefas — Bloco LA

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| LA.1 | Auditar atributos de `Material`/`MaterialScenario` marcados `isScenarioAttribute`; listar os que faltam | `src/model/attributes/material-attributes.ts` | tabela no doc |
| LA.2 | Auditar atributos de `Charge`/`Booking` (valor) de cenário | `src/model/**/charge*`,`booking*` | tabela no doc |
| LA.3 | Garantir acesso `<scn>.<attr>` de material/charge em `Query.process` (sem mudar `logical-attribute.ts`) | `src/query/query.ts` | 2 testes |
| LA.4 | Confirmar/estender `isvalid()` para material (teste com `material.<attr>`) | `src/logic/logical-function.ts` | 3 testes |
| LA.5 | Se necessário, adicionar atributos de cenário faltantes de material/charge (pode escalar p/ Fase 3/5/8.1) | `attributes/*` | `deno check` |

> As opções de **relatório** `hidematerial`/`hidepicture`/`rollupmaterial` e a
> verificação de `hide`/`rollup` de task/resource/account estão no **adendo da
> Fase 14** (ver `fase-14-relatorios-tarefas.md`, "Adendo Fase 11 Complemento").

---

## 3. Flags lógicas

Objetivo: confirmar o conceito de flags e permitir flags em **tarefas, recursos,
custos (valores), materiais, accounts e journal entries**.

### 3.1 Análise

- `LogicalFlag.eval` já resolve por `query.property.getForScenario("flags", 0)` —
  ramo `Query` ok (ramo `Journal` é Fase 16).
- `flags` (`FlagListAttribute`) está definido em **task, resource, account,
  report** (todos `isScenarioAttribute=true`, default `[]`). **Faltam**: material,
  charge/booking (custos) e journalentry.
- Extender = **adicionar a definição de atributo** `flags` a essas entidades (Fase
  3/5 de atributos). O `LogicalFlag` **não** precisa mudar — passa a funcionar
  genericamente assim que o atributo existe.

### 3.2 Tarefas — Bloco LF

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| LF.1 | Adicionar `flags` (FlagListAttribute, scenario, default `[]`) a `Material` | `src/model/attributes/material-attributes.ts` | 2 testes |
| LF.2 | Adicionar `flags` a charge/booking (custos/valores) | attrs de accounting | 2 testes |
| LF.3 | Adicionar `flags` a `journalentry` (Fase 16 usa) | attrs de journal | `deno check` |
| LF.4 | Teste `LogicalFlag` genérico sobre task/resource/account/material (flag declarada no projeto + usada) | `tests/logic/` | 4 testes |
| LF.5 | Cobrir parsing/i18n de `flags` em material/journalentry | `parser/rules/*`, i18n | teste AST-equivalence |
| LF.6 | Verificar validação de flag não-declarada (`operand_unkn_flag`) vale p/ novos portadores | `parser/rules/logic.ts` | 1 teste |

---

## 4. Tabela consolidada de pré-requisitos (o que destrava cada grupo)

| Pré-requisito | Fase | Destrava |
|---------------|------|----------|
| Alocação + datas agendadas (`start`/`end`/`getAllocatedTime` em TaskScenario; `allocations`) | Fase 7 (scheduler, em andamento) | hasassignment, isallocated(ToProject), starts*/ends*, isused(At/AtProject), isactive-real |
| Caminho crítico | Fase 7 | isoncriticalpath |
| Status de tarefa (notstarted…finished) | Fase 7/14 | istaskstatus |
| Financeiro/charge/booking estendidos | Fase 8/8.1 | flags-custos, atributos de valor de cenário |
| Journal | Fase 16 | hasalert, LogicalFlag (Journal), flags-journalentry |
| RichText/RTI | Fase 12 | (assignList/relatórios, fora deste escopo) |

**Bloqueadas em Fase 11** (só registro/stub): §1.6 (LC-D) + LC-C.2/C.3/C.4.
**Viáveis em Fase 11**: §1.4 (LC-B), LC-C.1, todo §2 e §3 (dependem de auditoria
de atributos, que é local).

> **Atualização (2ª onda, 2026-10-27):** esta tabela refletia o estado antes
> das Fases 7/8/8.1/9. O estado real reavaliado e o plano de desenvolvimento
> restante estão na **§6** — a maioria das “bloqueadas” é hoje viável.
> LF.1 ficou pela metade: o atributo `flags` foi registrado em
> `material-attributes.ts`, mas o **parser** ainda não aceita a diretiva no
> bloco `material` (ver LF.5a).

---

## Progresso

**Status da sessão (2026-10-27)** — foco em planejamento + implementação do que
é viável hoje; o resto fica planejado e com pontos de ancoragem no código.

```
[x] LC-A  Infra de registro + i18n (funções novas)        — 6/6
        • FUNCTIONS_RUBY (14 fiéis) + FUNCTIONS_EXT (18) + FUNCTIONS unificado
        • Parser genérico ($ID + argumentList) — nenhuma mudança necessária
        • i18n keywords: isaccount/ismaterial/isparentof/istaskofproject
          (canonical + pt-BR + es). 0-arg isan* seguem istask/isresource
          (não são keywords).

[x] LC-B  Funções viáveis hoje                            — 6/6
        • isparentof (busca recursiva na subárvore — short id funciona)
        • isanaccount / isaccount(id) via instanceof Account + project.account(id)
        • isanmaterial / ismaterial(id) via instanceof Material + project.material(id)
        • istaskofproject(id) compara com project.id

[~] LC-C  Funções de material (isUsedAt / isUsed / isUsedAtProject / hasAssignment-material)
        — 0/4 implementadas; 4/4 registradas como bloqueadas em LC-D.
        Pré-requisitos: Fase 8.1 (tracking de material) + Fase 7 (alocações).

[x] LC-D  Registro-stub das bloqueadas                    — 12/12
        • hasassignment, isallocated, isallocatedtoproject, startsafter, startsbefore,
          endsafter, endsbefore, isoncriticalpath, istaskstatus, isusedat,
          isused, isusedatproject
        • Todas lançam NotYetImplementedError(fase, nome) ao avaliar — sem
          falso-positivo silencioso.

[~] LC-E  Testes + golden                                 — 2/4
        ✓ Testes BDD das viáveis + stubs + aridade
          (tests/logic/logical-function-complemento_test.ts, 21 steps)
        ✓ logical-function_test.ts atualizado: FUNCTIONS_RUBY=14 e FUNCTIONS
          é superconjunto com isparentof(1)
        [ ] Golden para extensões: adiado (D-3 — Ruby não tem ground truth
            para as extensões; apenas casos em que Ruby↔TS concordam entram
            no golden atual). Reavaliar na Fase 21.
        [ ] Teste round-trip i18n das novas keywords (parser test): adiado.

[ ] LA    Atributos lógicos (material/charge/valid)       — 0/5
        Mantido como planejamento. Depende de Fase 3 (atributos) e Fase 5
        (entidades) para expandir; Fase 8.1 para charge.

[~] LF    Flags (material/custos/journal + teste)         — 1/6
        ✓ LF.1: flags adicionado a material-attributes.ts
          (FlagList, isScenarioAttribute=true, inheritedFromParent=true)
        [ ] LF.2 flag em charge (Fase 8.1)
        [ ] LF.3 flag em journalentry/custo (Fase 8/16)
        [ ] LF.4 teste end-to-end do LogicalFlag sobre material via Query
        [ ] LF.5/LF.6 cobertura i18n da palavra-chave flag se necessário

[x] F14   Adendo relatórios (hide/rollup/picture)         — planejamento entregue
        §14.26 criado em fase-14-relatorios-tarefas.md com:
        • 14.26.1 verificação de hidetask/hideresource/hideaccount + rollup*
        • 14.26.2 novas opções: hidematerial/rollupmaterial/hidepicture
          (parser + i18n + ReportContext/Query + aplicação em RDO/breakdown)
        Implementação fica na Fase 14 (não neste complemento).
──────────────────────────────────────────────────────────
Implementado nesta sessão: LC-A + LC-B + LC-D + LF.1 + 2/4 LC-E + F14 planejamento.
Adiado com justificativa explícita: LC-C (dep. 8.1), LA (dep. 3/5),
LF.2–LF.6 (dep. 8/16), LC-E golden para extensões (D-3), F14 código (Fase 14).

Verificação desta sessão:
  deno check packages/core/mod.ts                    → OK
  deno lint (logic + i18n + material-attrs + tests)  → OK
  deno fmt (7 arquivos tocados)                      → OK
  deno test -A --no-check packages/core/tests        → 296 passed / 3185 steps / 0 failed
  deno task check:all                                → OK (24 erros pré-existentes
    em tests/accounting/extended-charge-timebasis_test.ts e
    tests/golden/timebasis-parity_golden_test.ts corrigidos nesta mesma data:
    writes inexistentes em TaskScenario removidos — as charges leem apenas
    os atributos de cenário start/end — e construtores alinhados à API real).
```

---

## 5. Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| Adicionar keywords sem tradução → AST-equivalence quebra | Alto | LC-A.5 + teste LC-E.2 |
| `isTask(ID)`/`isResource(ID)` colidem de aridade (D-2) | Médio | decisão explícita antes de codar |
| Stub de função bloqueada vira falso-positivo silencioso | Alto | usar `NotYetImplementedError` (throws), não `false`, exceto quando o Ruby já retorna `false` por tipo |
| Extender atributos de material/charge extrapola Fase 11 | Médio | LA/LF podem escalar p/ Fase 3/5/8.1; sinalizar |

---

## 6. Segunda onda de desenvolvimento (plano de 2026-10-27)

O que ficou para trás (LC-C, LA, LF.2–LF.6, LC-E, F14.26) foi reavaliado
**contra o estado real do modelo** — as Fases 7, 8, 8.1, 8.2 e 9 estão
concluídas, o que destrava a maior parte. Verificações feitas nesta
análise (grep/probe no código vivo):

| Verificado | Resultado |
|---|---|
| `ResourceScenario.getAllocatedTime` | **existe** (resource-scenario.ts:592) |
| `TaskScenario.getAllocatedTime` | **falta** — Ruby tem (TaskScenario.rb:1562); portável hoje |
| `TaskScenario.getEffectiveWork` | já existe (porta o padrão de cache/recursão) |
| `DataCache` | singleton disponível (`DataCache.instance`) |
| Datas `start`/`end` | atributos de cenário reais, populados pelo scheduler (Fase 7) |
| `CostEvent` | tipo `"material_usage"` + `project.costEvents` (Fase 8.1) — base p/ `isused*` |
| `Journal.entriesFor(property)` | existe — base p/ `isusedat` |
| `JournalEntry.flags` | já é `string[]` no modelo (journal.ts:28) |
| Parser: `flags` em task/resource/account | aceito (baseline ok) |
| Parser: `flags` em **material** | **`unexpctd_token`** — falta habilitar `p.pattern(["!flags",],)` em material.ts (provado por exercício ao vivo) |
| Caminho crítico (slack/float) | **não existe no Ruby vendorizado nem no SM** — permanece bloqueado |
| `query_*` além de balance/turnover | não existem — dependem de reports/sheets (Fases 14/18) |

### 6.1 G1 — Fundação (destrava G2/G3; pré-requisito das Fases 7/8 já concluído)

| # | Tarefa | Arquivos | Verificação |
|---|--------|----------|-------------|
| G1.1 | Portar `TaskScenario.getAllocatedTime(startIdx, endIdx, resource?)` fiel do Ruby (TaskScenario.rb:1562–1588): guards de milestone, `assignedresources`, recursão em container, cache via `DataCache.instance` (padrão de `resource-scenario.ts`) | `src/model/task-scenario.ts` | 4 testes unitários |
| G1.2 | Parsing/validação de **argumentos-data** (`"YYYY-MM-DD"` → `TjTime`) para as funções `startsafter/startsbefore/endsafter/endsbefore/isallocated/isused/hasassignment`; semântica de comparação documentada = **inclusive** (mesma divergência conhecida de `perday` em `known-divergences.json`) | `src/logic/logical-function.ts` | 3 testes |
| G1.3 | `isactive`-real: hoje usa duck-typing `method(scData, "getAllocatedTime")`; passar ao caminho tipado G1.1 (remove o `return false` silencioso p/ tasks) | `src/logic/logical-function.ts` | 2 testes + smoke |
| G1.4 | Testes de integração G1 rodam o scheduler (padrão dos testes de turnover) para popular `start`/`end` + bookings reais | `tests/logic/`, `tests/integration/` — |

### 6.2 G2 — Datas agendadas (LC-C: 8 das 12 functions “bloqueadas” tornam-se viáveis hoje)

| # | Tarefa | Semântica | Verificação |
|---|--------|-----------|-------------|
| G2.1 | `startsafter(id, d)` — `a("start") > d` | Task/Resource/Material/Account | 2 testes |
| G2.2 | `startsbefore(id, d)` — `a("start") < d` | idem | 2 testes |
| G2.3 | `endsafter(id, d)` — `a("end") > d` | idem | 2 testes |
| G2.4 | `endsbefore(id, d)` — `a("end") < d` | idem | 2 testes |
| G2.5 | `isallocated(id, d1, d2)` — `getAllocatedTime` (G1.1) > 0 no intervalo das datas | task/recursos | 3 testes |
| G2.6 | `isallocatedtoproject(prj, scn, d1, d2)` — idem agregado por projeto | — | 2 testes |
| G2.7 | Reclassificar cada função implementada de `FUNCTIONS_EXT` blocked → feasible (manter entrada com fase vazia até a 3ª onda?) — **decisão**: remover o entry `blocked` e mover a aridade para uma nova tabela `FUNCTIONS_FEASIBLE_EXT` ou mover para `FUNCTIONS_RUBY`-like própria; manter o unificado `FUNCTIONS` | `src/logic/logical-function.ts` | ajuste dos testes de stub |

### 6.3 G3 — Material (usa `CostEvent`/Journal/allocation lists — Fases 8.1/9 prontas)

| # | Tarefa | Base | Verificação |
|---|--------|------|-------------|
| G3.1 | `hasassignment(id, d1, d2)` — recurso **ou material** alocado à tarefa no intervalo (lista `assignedresources` + `materialallocations`; detecção de tipo pelo id) | Fase 5/7 | 3 testes |
| G3.2 | `isusedat(id, scn)` — material aparece em `CostEvent` `type="material_usage"` do journal da propriedade (task/resource) | `Journal.entriesFor` + `project.costEvents` | 3 testes |
| G3.3 | `isused(id, d1, d2)` — booking/usage do material com data em `[d1,d2]` | `CostEvent` (mode planned/actual) | 3 testes |
| G3.4 | `isusedatproject(prj, scn, d1, d2)` — agregação multi-projeto | quando houver multi-project | 1 teste (stub p/ projeto único) |
| G3.5 | Testes end-to-end: `.tjp` com `material ac { ... } task t { material ac 10 perday }` + scheduler → `isusedat`/`isused` verdadeiros | integration | smoke novo |

### 6.4 G4 — Atributos lógicos (LA) — viável hoje, sem scheduling

| # | Tarefa | Verificação |
|---|--------|-------------|
| LA.1 | Auditar atributos de `MaterialScenario` (`effortdone`/`effortleft` + o que faltar); tabela no doc | tabela |
| LA.2 | Auditar `ExtendedCharge`/`Booking` (valores de cenário); tabela no doc | tabela |
| LA.3 | Teste integração `LogicalAttribute` sobre material (`<scn>.<attr>` via `Query.process`) — **não muda** `logical-attribute.ts` | 2 testes |
| LA.4 | `isvalid()` sobre material: 3 testes (com/sem cenário, inválido) | testes |
| LA.5 | Registrar atributos de cenário faltantes descobertos em LA.1/LA.2 (se extrapolar Fase 11, abrir tarefa na fase dona) | `deno check` |

### 6.5 G5 — Flags (LF.2–LF.6) — **LF.5 já diagnosticado**

| # | Tarefa | Verificação |
|---|--------|-------------|
| LF.5a | **Habilitar `flags` no bloco `material` do parser**: adicionar `p.pattern(["!flags",],)` à lista de `materialAttributes` em `src/parser/rules/material.ts` (padrão idêntico a resource.ts:219/account.ts:193). Hoje o parse de `flags` em material produz `unexpctd_token` (provado nesta sessão) | teste parser + AST-equivalence pt-BR/es |
| LF.4 | Teste `LogicalFlag` genérico sobre task/resource/account/material via `Query` | 4 testes |
| LF.6 | Validar `undecl_flag` (flag não declarada) nos novos portadores (material) | 1 teste |
| LF.2 | **Redefinido**: “flags em custos” = flags em entidades PTN que portam charges (`task`/`resource`/`material`/`account` — já têm). O objeto `ExtendedCharge`/`CostEvent` **não é** `PropertyTreeNode` (sem atributos) — não há onde registrar `flags` sem redesenhar accounting. Escalar p/ Fase 8.x **somente se** o modelo de charge migrar para PTN | decisão + doc |
| LF.3 | Flags em `journalentry`: o **modelo já tem** `flags: string[]` (journal.ts:28) e o parser já aceita `flags` em journalentry (task.ts:801–811). Falta o **ramo Journal do `LogicalFlag.eval`** → planejar na Fase 16 (âncora em `fase-16-apoio-tarefas.md`) | Fase 16 |
| LF.5b | i18n da diretiva `flags` no contexto material/journalentry (checar en/pt-BR/es) | AST-equivalence |

### 6.6 G6 — Permanecem bloqueadas (com pré-requisito real, âncoras criadas)

| Função | Pré-requisito ausente | Fase dona |
|---|---|---|
| `isoncriticalpath(id)` | slack/float **não existe nem no Ruby 3.8.4 vendorizado** — extensão pura; precisa de cálculo de float no scheduler + expor p/ queries | Fase 14/15 (relatórios/Gantt) |
| `istaskstatus(id, status)` | enum de status derivado de tracking (notstarted/inprogress/finished…) | Fase 18 (status sheets) |
| `hasalert` (já stub) | alertas no Journal | Fase 16 |
| `LogicalFlag` ramo Journal | idem | Fase 16 |

### 6.7 G7 — LC-E adiada (âncora Fase 21)

| # | Tarefa | Quando |
|---|--------|--------|
| LC-E.3 | Golden Ruby↔TS: estender `scripts/golden/logical-expressions.rb` **só** com casos em que Ruby e TS concordam — agora possível p/ `isactive`/`isallocated` (pós-G1) e regressão do scheduler | Fase 21 |
| LC-E.2 | Round-trip i18n das keywords novas (en/pt-BR/es) em AST-equivalence | Fase 21 |
| LC-E.4 | Registrar em `scripts/golden/README.md` a política de não-golden p/ extensões sem Ruby | pode ser feito já |

### 6.8 G8 — Âncoras em outros planos (fora do código desta fase)

| Item | Onde ancorar | O quê |
|---|---|---|
| F14 §14.26 | `fase-14-relatorios-tarefas.md` (adendo já criado) + linha no plano canônico ao iniciar Fase 14 | hidematerial/rollupmaterial/hidepicture + verificação hide/rollup |
| LF.3 / ramo Journal | `fase-16-apoio-tarefas.md` | flags em journalentry + LogicalFlag-Journal + hasalert |
| G6 status | `fase-18-*.md` | istaskstatus sobre status sheets |
| G7 | `fase-21-*.md` | golden extensões + round-trip i18n |

**Ordem de execução proposta**: G1 → G2 → G3 → G4 → G5(LF.5a/LF.4/LF.6) → âncoras G8.
Grupos G1–G3 formam um incremento natural (fundação → datas → material); G4/G5
são independentes e podem intercalar. Cada grupo termina com
`deno task check:all` + `deno task test` verdes.

### 6.9 Execução da 2ª onda (2026-10-27) — resultado real

| Grupo | Status | O que entrou |
|---|---|---|
| G1.1 | ✅ | `TaskScenario.getAllocatedTime(startIdx, endIdx, resource?)` portado fiel de TaskScenario.rb:1562–1588 (guards de milestone/assignedresources, recursão em container). Cache `@dCache` omitido em linha com `ResourceScenario.getAllocatedTime` (flush do DataCache ainda é stub, `project.ts:508`) — divergência documentada no JSDoc. 4 testes em `tests/model/task-scenario-allocated-time_test.ts` usando `ResourceScenario#book` (primitivo do scheduler) em vez do scheduler completo (fechamento real de G1.4 com o scheduler: ver §6.10). |
| G1.2 | ✅ | `dateArg()`/`slotIdxFor()` em `logical-function.ts`: parser já entrega `TjTime` via `!date` (logic.ts:145); strings `YYYY-MM-DD` aceitas; **descoberta**: `TjTime.fromString("nao-eh-data")` NÃO lança (produz segundos NaN) → validação explícita `Number.isFinite(toSeconds())`. `arityCheck()` defensivo na avaliação (parser usa `setArguments` sem validar). |
| G1.3 | ✅ | `isactive` passou do duck-typing (`method(scData, "getAllocatedTime")` + `return false` silencioso) para o caminho tipado Task/Resource com `q.startIdx ?? 0`. |
| G2 | ✅ | `startsafter/startsbefore/endsafter/endsbefore` (via `dateBound()`, datas = atributos de cenário `start`/`end`, comparação estrita, cenário `q.scenarioIdx ?? 0`), `isallocated(id,d1,d2)` e `isallocatedtoproject(prj,scn,d1,d2)` via `getAllocatedTime` + `Project#dateToIdx`. FUNCTIONS_EXT: 10 entries `blocked → feasible` (fase de origem mantida como tag); `isoncriticalpath` rebloqueado para Fase 14 e `istaskstatus` para Fase 18 (G6). |
| G3 | ✅ | `hasassignment(id,d1,d2)` (recurso **ou** material, detecção pelo id), `isusedat(id,scn)`, `isused(id,d1,d2)` (propriedade Task **ou** o próprio Material varrendo o projeto), `isusedatproject(prj,scn,d1,d2)`. Fontes: `materialallocations` (parser/Fase 8.1) + `MaterialAllocation#quantityIn` quando anexado + `CostEvent "material_usage"` + overlap das datas de cenário. Sem agenda: a existência da alocação conta (regra documentada no cabeçalho da seção). Smoke `.tjp` end-to-end no arquivo de testes. |
| G4 | ✅ | Auditoria LA.1/LA.2 (tabelas abaixo) + testes LA.3/LA.4 (LogicalAttribute e `isvalid` sobre material). `logical-attribute.ts` **não mudou**, conforme plano. |
| G5 | ✅ | **LF.5a**: `p.pattern(["!flags",],)` + `p.doc("flags.material")` em `materialScenarioAttributes` (`src/parser/rules/material.ts`) — parse de `flags` em material, antes `unexpctd_token`, agora limpo (teste dedicado; nota: `unit` exige string citada `unit "kg"` — sintaxe já coberta por `rules_material_test.ts`). LF.4 genérico nos 4 portadores ✅. LF.6 `undecl_flag` no material ✅. **LF.2 confirmado como redefinido**: flags vivem nas entidades PTN portadoras de charges; `ExtendedCharge`/`CostEvent` não são PTN (sem onde registrar sem redesenhar accounting — escalar só na Fase 8.x se o modelo migrar). LF.3/LF.5b permanecem ancorados (Fase 16 / round-trip i18n na 21; keyword `flags` é idêntico em en/pt-BR/es — `i18n/*.ts:66` —, então o caso material usa a mesma palavra). |

**LA.1 — atributos de `MaterialScenario`/material** (`src/model/attributes/material-attributes.ts`):

| Atributo | Cenário? | Notas |
|---|---|---|
| `effortdone`, `effortleft` | ✅ | pré-carregados (`MATERIAL_SCENARIO_ATTRS`, ADR 016), default 0.0 |
| `chargeset`, `flags` | ✅ | registrados e lidos via `getForScenario`; **não** pré-carregados — leitura lazy funciona (`a()` retorna default do definition); sem tarefa nova (LA.5: nada faltando) |
| `unit`, `cost`, `note`, `totalquantity`, `index` | ❌ | globais da entidade |

**LA.2 — `ExtendedCharge`/`Booking`**: ambos leem datas como **atributos de
 cenário** (`start`/`end` via `scenario.a`/`getForScenario`) — nenhum campo
 interno ilegal; nada a registrar. (Consistente com a correção dos 24 erros
 de type-check feita nesta sessão.)

**Verificação (2026-10-27)**: `deno task check:all` exit 0 · `deno task test`
**300 passed / 3231 steps / 0 failed** (era 296/3185) · `deno lint` limpo nos
16 arquivos tocados (117 warnings restantes são baseline pré-existente em
outras áreas de `packages/core`) · `deno fmt --check` limpo nos 358 arquivos.
Arquivos tocados: `src/model/task-scenario.ts`, `src/logic/logical-function.ts`,
`src/parser/rules/material.ts`, `tests/model/task-scenario-allocated-time_test.ts`
(novo), `tests/logic/logical-function-second-wave_test.ts` (novo),
`tests/logic/logical-function-complemento_test.ts` (stubs reduzidos a
isoncriticalpath/istaskstatus).

### 6.10 G1.4 + review pós-onda (a)–(g) — executado 2026-10-27

**G1.4 (integração com o scheduler)** — probe ao vivo mostrou que o gap é
**mais amplo** que o registrado no smoke da Fase 10: `Project.schedule()`
sobre um modelo **construído à mão** (effort em segundos + `allocate` +
`start`) também **não conclui tarefas** — `end` permanece `null`, zero slots
reservados, e `ScenarioData#error` é stub de `console.log`
(`scenario-data.ts:96`), então nem passa pelo MessageHandler. É o núcleo da
**Fase 7**, não destravável pela Fase 11. Fechamento honesto:
`tests/integration/logical-scheduler-driven_test.ts` — metade 1 **ativa**
(regression do estado atual: roda sem lançar, não coloca agenda; falha de
propósito quando a Fase 7 evoluir) + metade 2 **comentada** (o que G1.4 exige
pós-Fase-7; descomentar lá). Nota: `it({ skip })` do `@std/testing/bdd` não
propagou a opção no std 1.0.20 — o caso pendente ficou em bloco comentado.

**Review (a)–(g) aplicado com testes** (todos em
tests/logic/logical-function-second-wave_test.ts, describe
`review (a)–(g)` + casos novos nos describes existentes):

| Item | Mudança | Teste |
|---|---|---|
| (a) | `hasAllocatedTime()` com limiar de meio slot nas comparações de alocação (`isallocated`, `isallocatedtoproject`, `hasassignment`); JSDoc registra que zero é exato por construção (`slots` inteiros) | 2: zero exato sem bookings; 1 slot com `dwh=7` ainda conta |
| (b) | `usedNoAgenda`/`materialUsedIn`: ausência **completa** de agenda (`!start && !end`) passa a ser a condição do fallback; agenda parcial usa `taskInterval()` (degenerate interval) em vez de contar sempre | 2: parcial fora do intervalo → false; parcial com booking dentro → true |
| (c) | `targetForId()`: id-string que não resolve em task/resource/account/material agora **lança** (`Unknown id`) em `dateBound` — typos não silenciam mais para a propriedade atual (teste antigo de fallback reescrito) | 1 (substitui o de fallback) |
| (d) | `hasassignment`: `dateArg`/`slotIdxFor` calculados **uma vez** e compartilhados por `TimeInterval` e índices | cobertura dos casos existentes |
| (e) | `TaskScenario.getAllocatedTime`: recursão de container filtra `kid instanceof Task` (import de `Task` passou a value-import; ciclo já existia via `task.ts:3`) | regressão via testes de container |
| (f) | **`Project#dateToIdx` corrigido fiel ao Ruby (Project.rb:961)** — `forceIntoProject` era ignorado: antes→0, depois→último slot, `false`+fora→`TjError`. Beneficia todo o scheduler/queries, não só as funções novas; JSDoc de `slotIdxFor` documenta o clamp | 2: clamp sem lançar; `size-1` correto; throw sem clamp |
| (g) | Regressões travadas: data inválida lança **mesmo sem datas de cenário** (ordem do `dateArg` vs. early-return) e parser aceita só `unit "kg"` quoted (`unit kg` → `unexpctd_token`) | 2 |

**Verificação (pós-review)**: `deno task check:all` exit 0 · `deno task test`
**302 passed / 3242 steps / 0 failed / 0 ignored** (era 300/3231) · lint limpo
nos 5 arquivos tocados · `deno fmt --check` limpo (359 arquivos).

---

**Fim do complemento Fase 11 (funções/atributos/flags lógicas).**
