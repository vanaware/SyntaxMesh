import { ScenarioData, } from "./scenario-data.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";

/**
 * Lista exata de atributos pré-carregados pelo AccountScenario do Ruby
 * (AccountScenario.rb, linhas 17–20).
 */
export const ACCOUNT_SCENARIO_ATTRS: string[] = ["credits",];

export class AccountScenario extends ScenarioData {
  constructor(
    account: unknown,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(
      account as PropertyLike,
      scIdx,
      attributes,
    );
    this.preloadAttributes(ACCOUNT_SCENARIO_ATTRS,);
  }
}
