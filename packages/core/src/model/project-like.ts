export interface ProjectLike {
  readonly scenarioCount: number;
  scenario(idx: number): { id: string; fullId: string } | null;
  scenarioIdx(sc: string): number | undefined;
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  addScenario(scenario: { id: string; fullId: string }): void;
}