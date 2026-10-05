import { PropertySet, } from "../../src/model/property-set.ts";
import { type ProjectLike, } from "../../src/model/project-like.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { registerTaskAttributes, } from "../../src/model/attributes/task-attributes.ts";
import { registerResourceAttributes, } from "../../src/model/attributes/resource-attributes.ts";
import { registerAccountAttributes, } from "../../src/model/attributes/account-attributes.ts";
import { registerShiftAttributes, } from "../../src/model/attributes/shift-attributes.ts";
import { registerReportAttributes, } from "../../src/model/attributes/report-attributes.ts";
import { registerScenarioAttributes, } from "../../src/model/attributes/scenario-attributes.ts";

/**
 * Projeto mock para testes da Fase 5+.
 *
 * Implementa `ProjectLike` com 6 PropertySets e métodos de registro.
 */
export class MockProject implements ProjectLike {
  readonly scenarios: PropertySet;
  readonly shifts: PropertySet;
  readonly accounts: PropertySet;
  readonly resources: PropertySet;
  readonly tasks: PropertySet;
  readonly reports: PropertySet;

  readonly id = "mock";
  readonly name = "Mock Project";

  private readonly _scenarios: Array<{ id: string; fullId: string }>;
  private readonly store = new Map<string, unknown>();

  constructor(scenarioCount: number = 1, flatNamespace: boolean = false) {
    this._scenarios = [];
    for (let i = 0; i < scenarioCount; i++) {
      this._scenarios.push({
        id: i === 0 ? "plan" : `scenario${i}`,
        fullId: i === 0 ? "plan" : `scenario${i}`,
      });
    }

    this.scenarios = new PropertySet(this, true);
    this.shifts = new PropertySet(this, flatNamespace);
    this.accounts = new PropertySet(this, flatNamespace);
    this.resources = new PropertySet(this, flatNamespace);
    this.tasks = new PropertySet(this, flatNamespace);
    this.reports = new PropertySet(this, flatNamespace);

    registerTaskAttributes(this.tasks);
    registerResourceAttributes(this.resources);
    registerAccountAttributes(this.accounts);
    registerShiftAttributes(this.shifts);
    registerReportAttributes(this.reports);
    registerScenarioAttributes(this.scenarios);
  }

  get scenarioCount(): number {
    return this._scenarios.length;
  }

  scenario(idx: number): { id: string; fullId: string; all(): Array<{ id: string; fullId: string }> } | null {
    if (idx < 0 || idx >= this._scenarios.length) {
      return null;
    }
    const sc = this._scenarios[idx]!;
    return {
      id: sc.id,
      fullId: sc.fullId,
      all: () => [...this._scenarios],
    };
  }

  scenarioIdx(sc: string): number | undefined {
    for (let i = 0; i < this._scenarios.length; i++) {
      const scenario = this._scenarios[i];
      if (scenario && (scenario.id === sc || scenario.fullId === sc)) {
        return i;
      }
    }
    return undefined;
  }

  get(name: string): unknown {
    if (name === "now") return TjTime.fromString("2026-01-01");
    if (name === "start") return TjTime.fromString("2026-01-01");
    if (name === "end") return TjTime.fromString("2026-12-31");
    if (name === "scheduleGranularity") return 3600;
    return this.store.get(name);
  }

  set(name: string, value: unknown): void {
    this.store.set(name, value);
  }

  addScenario(scenario: { id: string; fullId: string }): void {
    this._scenarios.push(scenario);
  }

  addShift(_s: unknown): void {}
  addAccount(_a: unknown): void {}
  addTask(_t: unknown): void {}
  addResource(_r: unknown): void {}
  addReport(_r: unknown): void {}
  removeAccount(_a: unknown): void {}

  attributeDefinition(id: string): any {
    return this.scenarios.attributeDefinition(id);
  }

  getScenarioAttribute(scIdx: number, id: string): any {
    const property = this.scenarios.get("plan");
    if (property) {
      return property.getScenarioAttribute(scIdx, id);
    }
    return null;
  }
}
