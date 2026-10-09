import { ScenarioData, } from "./scenario-data.ts";

/**
 * Lista exata de atributos pré-carregados pelo AccountScenario do Ruby
 * (AccountScenario.rb, linhas 17–20).
 */
export const ACCOUNT_SCENARIO_ATTRS: string[] = ["credits",];

export class AccountScenario extends ScenarioData {
  constructor(account: unknown, scIdx: number, attributes: Map<string, unknown>,) {
    super(account as any, scIdx, attributes as any,);
    this.preloadAttributes(ACCOUNT_SCENARIO_ATTRS,);
  }
}
