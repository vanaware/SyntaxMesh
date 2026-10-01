import { type ProjectLike, } from "../../src/model/project-like.ts";

/**
 * Projeto mock para testes da Fase 4.
 *
 * Implementa `ProjectLike` com um conjunto mínimo de funcionalidades.
 */
export class MockProject implements ProjectLike {
  private readonly scenarios: Array<{ id: string; fullId: string }>;
  private readonly store = new Map<string, unknown>();

  constructor(scenarioCount: number = 1) {
    this.scenarios = [];
    for (let i = 0; i < scenarioCount; i++) {
      this.scenarios.push({
        id: i === 0 ? "plan" : `scenario${i}`, 
        fullId: i === 0 ? "plan" : `scenario${i}`,
      });
    }
  }

  get scenarioCount(): number {
    return this.scenarios.length;
  }

  scenario(idx: number): { id: string; fullId: string; all(): Array<{ id: string; fullId: string }> } | null {
    if (idx < 0 || idx >= this.scenarios.length) {
      return null;
    }
    const sc = this.scenarios[idx]!;
    return {
      id: sc.id,
      fullId: sc.fullId,
      all: () => {
        return this.scenarios.map(s => ({ id: s.id, fullId: s.fullId }));
      },
    };
  }

  scenarioIdx(sc: string): number | undefined {
    for (let i = 0; i < this.scenarios.length; i++) {
      const scenario = this.scenarios[i];
      if (scenario && (scenario.id === sc || scenario.fullId === sc)) {
        return i;
      }
    }
    return undefined;
  }

  get(name: string): unknown {
    return this.store.get(name);
  }

  set(name: string, value: unknown): void {
    this.store.set(name, value);
  }

  addScenario(scenario: { id: string; fullId: string }): void {
    this.scenarios.push(scenario);
  }
}