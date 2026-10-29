# Gate de saída para Fase 13 e política de stubs

## Contexto

As Fases 2–11 do SyntaxMesh foram individualmente marcadas como **concluídas**
em seus `CURRENT.md` e `-tarefas.md` respectivos. A auditoria final da 2ª
onda do Complemento Fase 11 (§6.10, §6.11) e o adendo de
`fase-7-scheduler-core-tarefas.md` revelaram entretanto que:

- `Project.schedule()` **não colocava datas nem bookings** em modelos mínimos
  apesar de 215 itens da Fase 7 estarem marcados como concluídos — os golden
  tests comparavam apenas esforço acumulado, não `start`/`end`.
- O teste-sentinela `logical-scheduler-driven_test.ts` foi **relaxado** durante
  a Fase 11 (§6.11), enfraquecendo a rede de proteção.
- Não havia **nenhum teste end-to-end** que exercitasse `parse → schedule`
  sobre os MWEs da Fase 10.
- 12+ `NotYetImplementedError` permaneciam em `packages/core/src/` sem
  referência à fase dona — alguns legítimos (Fases 12+), outros ocultavam
  gaps reais.

Descobriu-se também que uma fase marcada como "concluída" podia esconder gaps
funcionalmente críticos. Era preciso um mecanismo **mecânico** (não apenas
revisão manual) para impedir que a Fase 13 começasse sobre fundações
inconsistentes.

## Decisão

Introduzir um gate de saída composto (`deno task gate:phase-13`) e uma
política de stubs obrigatória, ambas **validadas por scripts commitados**
rodando em CI.

### 1. Gate `gate:phase-13` (composto)

Roda na ordem:

1. `deno task check:all` — `deno check` (--members) dos pacotes + scripts.
2. `deno task fmt:check` — formatação canônica Deno.
3. `deno task test` — suíte completa `packages/core/tests/`.
4. `deno task test:integration` — suíte `packages/core/tests/integration/`, incluindo o e2e parser→schedule dos 9 MWEs.
5. `deno task test:invariants` — 7 invariantes do scheduler sobre modelo rico (scheduled→start/end != null, start<=end, milestone start==end, dependência respeitada, task no range do projeto ou isRunAway, doneEffort<=effort).
6. `deno task test:fuzz` — 20 projetos determinísticos (Mulberry32, seed=42) validando todos os invariantes.
7. `deno task test:golden:scheduler` — placeholder até a Fase 21; na prática delega ao e2e `parser-scheduler_e2e_test.ts` que contém 8 datas hard-coded iguais às do `tj3` real no mwe004 (milestones + containers + financeiros).
8. `deno task check:stubs` — exige `// Ancorado: Fase N — <razão>` nas 3 linhas anteriores a todo `throw new NotYetImplementedError(...)` em `packages/core/src/`.
9. `deno task gaps:audit` — consome `docs/syntaxmesh/fases/completude-matrix.md` e falha se alguma linha do inventário G1–G21 está `pendente`.
10. `deno task test:deferred` — falha se sobrou algum teste com a tag `// Gate: fase-11-logical-gaps` em `packages/core/tests/` (prova que o sweep do Bloco K está completo).

`deno task lint` não faz parte do gate porque os fixtures JS vendorizados em `packages/core/tests/golden/` (herdados do TaskJuggler upstream) violam regras `recommended` e ainda não foram alvo de um filtro de `lint.exclude` dedicado — decisão adiada para a Fase 21.

Existe também `gate:phase-13:partial` = `check:stubs` + `gaps:audit` +
`test:deferred`, para uso durante a Fase 12 antes do gate completo.

### 2. Política de stubs

Todo `throw new NotYetImplementedError(...)` em `packages/core/src/`
**deve** ser precedido (em até 3 linhas) por um comentário no padrão:

```
// Ancorado: Fase <N> — <razão>
```

O script `scripts/check-stubs.ts` é a verificação mecânica. Um stub
não-ancorado quebra `check:stubs` e, por consequência, `gate:phase-13`.

Para extensões de fase dinâmica (ex.: `logical-function.ts` dispatchando
`ext[1]` da tabela `FUNCTIONS_EXT`), o `<N>` pode ser literal não-numérico
("dinâmica"), desde que a âncora aponte para a tabela que registra a fase
real de cada função.

### 3. Matriz de completude versionada

`docs/syntaxmesh/fases/completude-matrix.md` é a **fonte viva** do status
dos 21 gaps. Cada linha é validada por `scripts/gaps/audit.ts`, que exige
um dos prefixos canônicos: `fechado`, `verificado`, `ancorado`,
`sweep concluído`.

### 4. Sweep de testes deferidos da Fase 12

A Fase 12 roda **antes** desta fase de gaps (decisão do autor em 2026-10-28,
ver §0 de `fase-11-logical-gaps.md`). Durante a Fase 12, casos que dependiam
de `Project.schedule()` funcional foram marcados `ignore: true` com a tag
`// Gate: fase-11-logical-gaps`. O Bloco K varre a lista, remove os `ignore`
e o `scripts/gaps/deferred.ts` prova em CI que nenhum ficou para trás.

## Alternativas consideradas

1. **Revisão manual no fim de cada fase.** Frágil: foi exatamente assim que
   G1 passou batido por meses sob 215 tarefas "concluídas".
2. **Gate só `check:all`.** Insuficiente: os testes existentes não cobriam
   placement real (G3), nem e2e parser→schedule (G4), nem stubs órfãos.
3. **Permitir stubs não-ancorados com exceção listada.** Criaria uma
   "lista de esquecidos" que cresce organicamente; o padrão atual força a
   decisão (ancorar na fase dona ou implementar).

## Consequências

### Positivas

- "Concluído" passa a significar **"provado por testes"**, não "task list
  marcada".
- Detecta regressões de placement no mesmo commit em que são introduzidas.
- A matriz de completude é autoexplicativa para qualquer fase futura (13+).
- `check:stubs` impede que um `throw NotYetImplementedError` entre sem que
  alguém tenha pensado na fase dona.
- O `debug/schedule_probe.ts` fica como ferramenta permanente de diagnóstico.

### Negativas / Riscos

- Gate rigoroso pode atrasar features novas se um golden divergir.
  Mitigação: baseline inicial permissivo (apenas `gate:phase-13:partial`
  durante a Fase 12); endurecimento gradual ao fechar cada bloco.
- `check:stubs` pode quebrar em stubs legítimos ainda não âncorados.
  Mitigação: política explícita de ancoragem no mesmo commit que introduz o
  stub.
- invariantes com falsos positivos em fuzz. Mitigação: PRNG determinística
  (Mulberry32), seed fixa (42), projetos gerados respeitam validações de
  `readyForScheduling`.

### Neutras / Observações

- Esta decisão não reabre nenhuma fase anterior; ela **prova** o que as
  fases entregaram e **ancora** formalmente o que ficou pendente.
- Os bugs G1 (placement + markAsMilestone + chargeset + project vacation)
  foram encontrados e corrigidos no escopo desta fase; os fixes estão em
  commits dedicados sob `fix(core): schedule-placement-*`.
- Referências: `docs/syntaxmesh/fases/fase-11-logical-gaps.md`,
  `docs/syntaxmesh/fases/fase-11-logical-gaps-tarefas.md`,
  `docs/syntaxmesh/fases/completude-matrix.md`, `scripts/check-stubs.ts`,
  `scripts/gaps/audit.ts`, `scripts/gaps/deferred.ts`,
  `debug/schedule_probe.ts`.

---

**Status:** Aceito
**Data:** 2026-10-28
**Autor(es):** Equipe SyntaxMesh (Fase 11-Gaps)
