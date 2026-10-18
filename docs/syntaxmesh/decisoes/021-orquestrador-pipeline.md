# Decisão: Orquestrador e pipeline de scheduling

## Contexto

O `Project.schedule()` tem um detalhe sutil: **alterna o modo global** de `AttributeBase` entre `prepareScenario` (mode 1 = inherited) e `scheduleScenario` (mode 2 = computed). Isso afeta **todos** os atributos globalmente.

Precisamos registrar:
1. A decisão de manter esse padrão (herdado do ADR 013).
2. O pipeline exato do `Project.schedule()`.
3. A ausência de `BatchProcessor` (browser-only).

## Decisão

Manter `mode` global (reforça ADR 013). `Project.schedule()` segue ordem exata do Ruby:

```
initScoreboards()
↓
para cada PropertySet: index()
↓
para cada cenário ativo:
  AttributeBase.setMode(1)
  prepareScenario(scIdx)
  AttributeBase.setMode(2)
  scheduleScenario(scIdx)
  finishScenario(scIdx)
↓
resources.checkFailsAndWarnings()
tasks.checkFailsAndWarnings()
timeSheets.warnOnDelta()
```

Sem `BatchProcessor`; reports sequenciais. `AppConfig.dataDirs` retorna `[]` no browser.

## Consequências

### Positivas
- Fidelidade ao Ruby: pipeline exato preserva comportamento.
- Simplicidade: sem paralelismo complexo, mais fácil de depurar.
- Segurança: modo global garante consistência de atributos.

### Negativas / Riscos
- Sem paralelismo de reports: pode ser mais lento para muitos relatórios.
- Modo global: requer cuidado para evitar vazamento de estado entre cenários.

### Neutras / Observações
- Web Workers para paralelismo de reports em fase futura.
- `AsyncLocalStorage` para modo global em vez de estático (futuro).

## Referências

- `docs/tj3-engine/02-bluprint-engine1.md` — §2.5.
- `docs/tj3-engine/03-bluprint-engine2.md` — §2.
- ADR 013, ADR 017.

## Fora de escopo

- Implementação.

## Critério de aceite

- ADR 021 criado.
- Tabela em `README.md` atualizada.

**Status:** Aceito
**Data:** 2026-10-18
**Autor:** Qwen Code