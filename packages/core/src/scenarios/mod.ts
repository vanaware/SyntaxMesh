/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Scenarios — Gestão de cenários comparativos
// ============================================================================

/**
 * Tipo de cenário
 */
export type ScenarioType = 'base' | 'optimistic' | 'pessimistic';

/**
 * Definição de um cenário
 */
export interface Scenario {
  id: string;
  name: string;
  type: ScenarioType;
  description?: string;
  multipliers: Record<string, number>; // multiplicadores por campo
  createdAt: Date;
}

/**
 * Compara dois cenários e destaca diferenças
 */
export function compareScenarios(
  base: Scenario,
  alternate: Scenario,
): ComparisonResult {
  const changes: ComparisonChange[] = [];

  for (const key of Object.keys(base.multipliers,)) {
    const baseValue = base.multipliers[key];
    const alternateValue = alternate.multipliers[key];
    if (
      baseValue !== undefined && alternateValue !== undefined &&
      baseValue !== alternateValue
    ) {
      changes.push({
        field: key,
        baseValue,
        alternateValue,
        difference: alternateValue - baseValue,
      },);
    }
  }

  return { base, alternate, changes, };
}

/**
 * Resultado da comparação entre cenários
 */
export interface ComparisonResult {
  base: Scenario;
  alternate: Scenario;
  changes: ComparisonChange[];
}

export interface ComparisonChange {
  field: string;
  baseValue: number;
  alternateValue: number;
  difference: number;
}
