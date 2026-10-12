/**
 * Papéis do tracking scenario — define qual cenário representa a realidade oficial.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 */
export type TrackingScenarioRole = "plan" | "real" | "optimistic";

/**
 * Representa o tracking scenario — um papel designado que marca qual cenário
 * representa a realidade oficial do projeto para relatórios.
 *
 * Diferente do TaskJuggler original, onde o tracking scenario era um requisito
 * técnico para projeção, no SyntaxMesh ele é apenas um papel designado.
 */
export class TrackingScenario {
  readonly role: TrackingScenarioRole;
  readonly scenarioId: string;

  constructor(role: TrackingScenarioRole, scenarioId: string) {
    this.role = role;
    this.scenarioId = scenarioId;
  }

  /**
   * Cópia profunda imutável.
   * Retorna this (imutável) para compatibilidade com deepClone.
   */
  deepClone(): this {
    return this;
  }
}