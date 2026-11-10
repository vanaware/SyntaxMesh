/**
 * Roles a tracking scenario can play — they define which scenario represents the
 * official reality of the project.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 */
export type TrackingScenarioRole = "plan" | "real" | "optimistic";

/**
 * A tracking scenario — a designated role marking which scenario represents the
 * official reality of the project for reporting purposes.
 *
 * Unlike original TaskJuggler, where the tracking scenario was a technical
 * requirement for projection, in SyntaxMesh it is merely a designated role.
 */
export class TrackingScenario {
  /** Role played by the referenced scenario. */
  readonly role: TrackingScenarioRole;
  /** Id of the scenario this role points at. */
  readonly scenarioId: string;

  /**
   * Creates a tracking scenario assignment.
   *
   * @param role Role played by the scenario.
   * @param scenarioId Id of the scenario the role refers to.
   */
  constructor(role: TrackingScenarioRole, scenarioId: string,) {
    this.role = role;
    this.scenarioId = scenarioId;
  }

  /**
   * Immutable deep copy.
   *
   * Returns `this` (immutable) for compatibility with `deepClone`.
   */
  deepClone(): this {
    return this;
  }
}
