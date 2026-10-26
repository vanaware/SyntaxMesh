import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { ResourceScenario, } from "./resource-scenario.ts";
import { ChargeSetCollection, } from "../finance/charge-set-collection.ts";

export class Resource extends PropertyTreeNode {
  private chargeset_: ChargeSetCollection;

  constructor(
    project: ProjectLike,
    id: string | null,
    name: string,
    parent: Resource | null,
  ) {
    super(project.resources, id, name, parent,);
    project.addResource(this,);
    this.chargeset_ = new ChargeSetCollection();
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new ResourceScenario(
        this,
        i,
        this.getScenarioAttributes(i,),
      );
    }
  }

  override scenarioData(scIdx: number,): ResourceScenario {
    return this.data[scIdx]! as ResourceScenario;
  }

  /**
   * Retorna o charge set do recurso.
   */
  get chargeset(): ChargeSetCollection {
    return this.chargeset_;
  }

  /**
   * Define o charge set do recurso.
   */
  set chargeset(value: ChargeSetCollection,) {
    this.chargeset_ = value;
  }

  /**
   * Retorna o esforço já alocado (booked effort) para o cenário dado.
   *
   * Corresponde a `ResourceScenario#bookedEffort` do Ruby.
   */
  bookedEffort(scIdx: number,): number {
    return this.scenarioData(scIdx,).bookedEffort();
  }
}
