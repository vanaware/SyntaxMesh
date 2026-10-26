/**
 * Cenário de Material (Fase 10 Complemento C1.2).
 *
 * Material é entidade nova (sem MaterialScenario no TJ Ruby); a forma
 * espelha `account-scenario.ts`, com pré-carregamento ADR 016 dos
 * atributos de cenário `effortdone`/`effortleft` usados pelo rollup dos
 * allocations de material (#2).
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C1)
 */
import { ScenarioData, } from "./scenario-data.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";

/** Atributos de cenário pré-carregados para Material (ADR 016). */
export const MATERIAL_SCENARIO_ATTRS: string[] = ["effortdone", "effortleft",];

export class MaterialScenario extends ScenarioData {
  constructor(
    material: PropertyLike,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(material, scIdx, attributes,);
    this.preloadAttributes(MATERIAL_SCENARIO_ATTRS,);
  }
}
