# ADR 017 — Scoreboard encoding conventions

> **Status:** ✅ Concluído
> **Data:** 2026-10-04
> **Autores:** Qwen Code

## Resumo

Documenta as convenções de encoding de bits usadas pelo `Scoreboard` genérico em três contextos principais do TaskJuggler: `Project.initScoreboards`, `ResourceScenario.initScoreboard` e `ShiftAssignments`. O encoding é uma convenção, não uma classe, centralizada em `scoreboard-bits.ts`.

## Contexto

O `Scoreboard<T>` é uma estrutura genérica que armazena qualquer tipo `T` em slots de tempo. No TaskJuggler, ele é usado com **encoding de bits numérico** para economizar memória e representar múltiplos estados em um único inteiro.

O encoding aparece em três lugares:

1. **Project scoreboards globais** (`Project.initScoreboards`) — armazenam `nil | 2 | 4` para working time / off-duty / leave.
2. **ResourceScenario scoreboard** — codifica working time + leaves + shift assignments em bits 0–8.
3. **ShiftAssignments scoreboard** — mesmo encoding, com bit 8 para `replace`.

Como o encoding é uma convenção, não uma classe, precisamos documentá-lo em um único lugar para evitar divergências entre implementações.

## Problema

- O encoding está espalhado em comentários em `Project.rb`, `ResourceScenario.rb` e `ShiftAssignments.rb`.
- Não há documentação formal; mudanças podem quebrar a compatibilidade.
- Os helpers para leitura/escrita de bits estão dispersos.

## Solução

Centralizar as convenções em um único ADR e um módulo TypeScript (`scoreboard-bits.ts`) com constantes e funções puras.

## Decisão

- **Documentar o encoding completo** em um único ADR.
- **Centralizar as constantes** em `scoreboard-bits.ts`.
- **Fornecer funções de leitura/escrita de bits** (`isAssigned`, `isWorkingTime`, `isOnLeave`, etc.).
- **Não especializar** `Scoreboard` com `Int32Array` nesta fase; otimizações futuras podem adicionar um `Scoreboard<number>` especializado.

## Encoding completo (documentado)

| Valor | Significado |
|---|---|
| `nil` | Valor não determinado ainda. |
| `0` | Sem atribuição, sem tempo de trabalho, sem leave, sem override. |
| `1` | **Bit 0** (`BIT_ASSIGNED`): tem uma atribuição (shift). |
| `2` | **Bit 1** (`BIT_OFF_WORK`): tempo de trabalho **não** disponível (off-duty). |
| `4` | **Bits 2–5** (`LEAVE_SHIFT`): tipo de leave (1=holiday, 2=annual, 3=special, 4=sick, 5=unpaid, 6=blocked). |
| `8` | **Bit 8** (`BIT_OVERRIDE`): override global (substitui working hours). |

Combinações:

- `1` → atribuído, tempo de trabalho disponível.
- `2` → atribuído, sem tempo de trabalho (off-duty).
- `4` → atribuído, leave (holiday).
- `5` → atribuído, leave (annual).
- `9` → atribuído, leave (annual), override.
- `10` → atribuído, sem tempo de trabalho (off-duty), override.

## Decisão

### 4.1 Bit encoding: não é uma classe, é uma convenção

O `Scoreboard.rb` **não tem** método de encoding/decoding. O usuário (Project, ResourceScenario, ShiftAssignments) é quem interpreta os bits. Cada um tem sua própria convenção.

**Decisão:** centralizar as constantes e helpers em `packages/core/src/time/scoreboard-bits.ts`. Nenhuma classe nova. Apenas:

```ts
export const LEAVE_TYPE_PROJECT = 0;  // menor prioridade
export const LEAVE_TYPE_ANNUAL = 1;
export const LEAVE_TYPE_SPECIAL = 2;
export const LEAVE_TYPE_SICK = 3;
export const LEAVE_TYPE_UNPAID = 4;
export const LEAVE_TYPE_HOLIDAY = 5;
export const LEAVE_TYPE_UNEMPLOYED = 6;

export const BIT_ASSIGNED = 1 << 0;       // bit 0
export const BIT_OFF_WORK = 1 << 1;       // bit 1
export const LEAVE_SHIFT = 2;              // bits 2-5
export const LEAVE_MASK = 0x3C;            // 0b00111100
export const BIT_OVERRIDE = 1 << 8;        // bit 8

export function packLeaveType(type: number): number;
export function unpackLeaveType(val: number): number;
export function isWorkingTime(val: number | null): boolean;
export function isTimeOff(val: number | null): boolean;
export function isLeave(val: number | null): boolean;
export function isOnLeave(val: number | null): boolean;
export function hasOverride(val: number | null): boolean;
```

**Justificativa:** documenta as convenções em um único lugar; evita magic numbers espalhados.

### 4.2 Scoreboard numérico especializado?

Ruby usa `Array` genérico. TS poderia usar `Int32Array` para scoreboards numéricos. **Decisão:** **não** especializar nesta fase. `Scoreboard<number>` com `number[]` é suficiente. Otimização fica para depois se performance exigir.

### 4.3 `Limit` interno: `Scoreboard<number>`

O `Limit.rb` cria `Scoreboard.new(interval.startDate, interval.endDate, period, 0)` — um scoreboard com **períodos maiores** que o projeto (1 dia, 1 semana, 1 mês). O `idxToSbIdx` converte índices do projeto para índices do scoreboard do limite.

Replicamos fielmente, usando `Scoreboard<number>` da Fase 2.

### 4.4 `Limits` é uma coleção; sem herança

Em Ruby, `Limits` não herda de nada. Ele contém `@limits: Limit[]`. Replicamos.

### 4.5 `ShiftAssignments` — sem `Monitor`

Ruby: `class ShiftAssignments < Monitor` (thread safety). JS é single-threaded no worker; sem lock necessário. **Decisão:** remover `Monitor`. Documentar.

### 4.6 `ShiftAssignments.@@scoreboards` — cache estático

Ruby compartilha scoreboards entre `ShiftAssignments` com **o mesmo conteúdo**. Implementação:

- `@@scoreboards: Map<string, [Set<number>, Scoreboard<number>]>` (hashKey → record).
- `newScoreboard()`: se hashKey existe, adiciona `objectId` ao Set e retorna scoreboard compartilhado.
- `define_finalizer` → **`FinalizationRegistry`** em TS para limpar quando a instância for GC'ed.

**Problema:** `FinalizationRegistry` em Deno é suportado mas comportamento não-determinístico. Aceito — o cache cresce, mas em testes é limpo manualmente (`ShiftAssignments.sbClear()`).

### 4.7 `hashKey` — strings determinísticas

Ruby: `hashKey` = `"#{project.object_id}|#{assignment1.hashKey}||#{assignment2.hashKey}||..."`.

Em TS: substituir `object_id` por ID sequencial via `WeakMap<Project, number>`:

```ts
const projectIds = new WeakMap<object, number>();
let nextProjectId = 1;

export function projectObjectId(project: object): number {
  let id = projectIds.get(project);
  if (id === undefined) {
    id = nextProjectId++;
    projectIds.set(project, id);
  }
  return id;
}
```

Análogo ao Ruby; WeakMap permite GC.

### 4.8 Ordenação de `assignments` em `hashKey`

Ruby:
```ruby
@assignments.sort! { |a, b| a.interval.start <=> b.interval.start }
```
Ordena **in-place** as assignments por `interval.start` antes de gerar hashKey. Replicar.

### 4.9 `ShiftAssignment.hashKey`

```ruby
def hashKey
  "#{@shiftScenario.object_id}|#{@interval.start}|#{@interval.end}"
end
```

Replicar com `projectObjectId`. Como `ShiftScenario` é única por `Shift`, precisamos de objectId para `ShiftScenario` também.

### 4.10 `ShiftScenario` — consolidar

A Fase 5 deixou o esqueleto. Aqui implementamos os 3 métodos:
- `onShift?(date: TjTime): boolean`
- `replace?(): boolean`
- `onLeave?(date: TjTime): boolean`

E o `onShift?` do `ResourceScenario` e `TaskScenario` delegam para `ShiftAssignments` (que usa `ShiftScenario`).

### 4.11 Integração de `ResourceScenario.onShift?`

A Fase 5 deixou `ResourceScenario` como esqueleto. Aqui adicionamos **apenas** `onShift?(sbIdx)` (usado por `ShiftAssignments.getSbSlot`). O resto (`initScoreboard`, `book`, etc.) fica para a Fase 7.

### 4.12 Erros

Reutilizamos `TjError`, `TjArgumentError` (Fase 3). Adicionamos `TjInternalError` se necessário (Fase 4 já tem).

## Consequências

- **Legibilidade:** um único ponto de verdade para o encoding.
- **Manutenção:** mudanças no encoding requerem apenas uma atualização.
- **Testes:** golden tests contra Ruby garantem compatibilidade.

## Referências

- `docs/taskjuggler/lib/taskjuggler/ShiftAssignments.rb` — comentários do encoding.
- `docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb` — `initScoreboard`.
- `docs/tj3-engine/05-blueprint-engine4.md` — §4.3.

## Fora de escopo

- Implementação — subfases 10.1+.

## Critério de aceite

- ADR 017 criado com encoding completo.
- Tabela em `docs/syntaxmesh/decisoes/README.md` atualizada.

---

## Tabela de decisões

| Decisão | Justificativa |
|---|---|
| Centralizar encoding em `scoreboard-bits.ts` | Evita magic numbers, um único ponto de verdade |
| Não especializar `Scoreboard` com `Int32Array` | Otimização futura; suficiente por enquanto |
| Remover `Monitor` de `ShiftAssignments` | JS é single-threaded; sem necessidade de locks |
| Usar `FinalizationRegistry` para limpeza de cache | Análogo ao `define_finalizer` do Ruby; comportamento não-determinístico aceito |
| `projectObjectId` via `WeakMap` | Análogo ao `object_id` do Ruby; permite GC |
| `ShiftScenario` consolidado com 3 métodos | Implementa o que o Ruby já tem |
| `ResourceScenario.onShift?` adicionada apenas | O resto de `ResourceScenario` é Fase 7 |

---

## Histórico

- **2026-10-04:** criado como parte da Fase 6.