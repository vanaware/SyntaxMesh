import { ScenarioData, } from "./scenario-data.ts";
import { type PropertyLike, } from "./property-like.ts";

/**
 * Lista exata de atributos pré-carregados pelo AccountScenario do Ruby
 * (AccountScenario.rb, linhas 17–20).
 */
export const ACCOUNT_SCENARIO_ATTRS: string[] = ["credits",];

export class AccountScenario extends ScenarioData {
  constructor(
    account: unknown,
    scIdx: number,
    attributes: Map<string, unknown>,
  ) {
    super(
      account as PropertyLike,
      scIdx,
      attributes as Map<string, unknown>,
    );
    this.preloadAttributes(ACCOUNT_SCENARIO_ATTRS,);
  }
}
