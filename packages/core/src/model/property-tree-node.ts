import { type PropertyLike, } from "./property-like.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { type AttributeContainer, } from "../attributes/attribute-container.ts";
import { AttributeDefinition, } from "../attributes/attribute-definition.ts";
import { AttributeType, } from "../attributes/attribute-type.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type MessageHandlerLike, } from "./message-handler-like.ts";
import { AttributeBase, } from "../attributes/attribute-base.ts";
import { AttributeOverwrite, TjArgumentError, } from "../attributes/errors.ts";
import { TjInternalError, } from "./errors.ts";
import { ScenarioData, } from "./scenario-data.ts";
import { Scenario, } from "./scenario.ts";
import { PropertySet, } from "./property-set.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import { RichText, } from "../richtext/rich-text.ts";
import { RTFHandlers, } from "../richtext/handlers/rtf-handlers.ts";
import type { Query, } from "../query/query.ts";
import type { JournalEntry, } from "./journal.ts";
export { PropertySet, };
export type { SourceFileInfo, };

export class PropertyTreeNode implements PropertyLike, AttributeContainer {
  readonly propertySet: PropertySet;
  readonly project: ProjectLike;
  readonly subId: string;
  readonly id: string;
  readonly name: string;
  readonly sequenceNo: number;
  readonly children: PropertyTreeNode[];
  readonly adoptees: PropertyTreeNode[];
  readonly stepParents: PropertyTreeNode[];
  sourceFileInfo: SourceFileInfo | null;
  data: ScenarioData[];
  private _level: number;

  attributes: Map<string, AttributeBase<unknown>>;
  scenarioAttributes: Array<Map<string, AttributeBase<unknown>>>;
  private _parent: PropertyTreeNode | null;
  private _idProvided: boolean;
  private _values: Map<string, unknown>;
  private _fullId: string | null;

  constructor(
    propertySet: PropertySet,
    id: string | null,
    name: string,
    parent: PropertyTreeNode | null,
  ) {
    this.propertySet = propertySet;
    this.project = propertySet.project;
    this.name = name;
    this.children = [];
    this.adoptees = [];
    this.stepParents = [];
    this.sourceFileInfo = null;
    this.data = Array.from(
      { length: this.project.scenarioCount, },
      (_, i,) => new ScenarioData(this, i, new Map(),),
    );
    this.attributes = new Map();
    this.scenarioAttributes = Array.from(
      { length: this.project.scenarioCount, },
      () => new Map(),
    );
    this._level = -1;
    this._parent = parent;
    this._idProvided = id !== null;
    this._values = new Map();
    this._fullId = null;

    let resolvedId: string;
    if (id === null) {
      if (parent) {
        resolvedId = parent.fullId + "." + name;
      } else {
        const tag = this.constructor.name.replace(/TaskJuggler::/, "",);
        resolvedId = "_" + tag + "_" + (propertySet.items + 1).toString();
      }
    } else {
      resolvedId = id;
    }

    if (id !== null) {
      // Handle hierarchical IDs like Ruby: split at last '.'
      if (!propertySet.flatNamespace && id.includes(".",)) {
        const lastDotIndex = id.lastIndexOf(".",);
        this.subId = id.substring(lastDotIndex + 1,);
        // Try to set parent from propertySet if parent is still null
        if (parent === null) {
          const parentId = id.substring(0, lastDotIndex,);
          const parentNode = propertySet.get(parentId,);
          if (parentNode) {
            this._parent = parentNode;
          } else {
            // Parent not found: store full id for fullId computation
            this._fullId = id;
          }
        }
      } else {
        this.subId = id;
      }
    } else if (!propertySet.flatNamespace && resolvedId.includes(".",)) {
      this.subId = resolvedId.substring(resolvedId.lastIndexOf(".",) + 1,);
    } else {
      this.subId = resolvedId;
    }

    this.id = this.fullId;
    // RUBY-COMPAT-FIX: `PropertyTreeNode.rb:111,115` gravam `id` (o fullId) e
    // `name` como ATRIBUTOS. Sem eles `sortTasks id.up`/`name.up` comparava
    // `null` com `null`, `sortInternal` devolvia 0 em todos os pares e a lista
    // ficava na ordem de definição — divergindo do tj3 (golden do
    // depArrows.tjp, cujas linhas do chart saíam fora da ordem alfabética).
    this.set("id", this.id,);
    this.set("name", name,);

    this.sequenceNo = this.propertySet.items + 1;
    // RUBY-COMPAT-FIX: `PropertyTreeNode.rb:121` grava o número de sequência no
    // atributo `seqno`. Sem isso o critério de ordenação padrão dos relatórios
    // (`sortTasks seqno.up`) compara `null` com `null` e a ordem passa a ser a
    // de inserção, divergindo do tj3 em qualquer desempate.
    this.set("seqno", this.sequenceNo,);

    if (parent) {
      parent.addChild(this,);
    }
    propertySet.addProperty(this,);
  }

  get parent(): PropertyTreeNode | null {
    return this._parent;
  }

  get level(): number {
    if (this._level === -1) {
      let lvl = 0;
      let current: PropertyTreeNode | null = this._parent;
      while (current) {
        lvl++;
        current = current._parent;
      }
      this._level = lvl;
    }
    return this._level;
  }

  get fullId(): string {
    if (this.propertySet.flatNamespace) {
      return this.subId;
    }
    // If parent not found, return stored fullId
    if (this._fullId !== null) {
      return this._fullId;
    }
    let result = this.subId;
    let current: PropertyTreeNode | null = this._parent;
    while (current) {
      result = current.subId + "." + result;
      current = current._parent;
    }
    return result;
  }

  // Debug method
  _debugFullId(): string {
    return `subId=${this.subId}, _parent=${
      this._parent?.id ?? "null"
    }, _idProvided=${this._idProvided}`;
  }

  logicalId(): string {
    return this.fullId;
  }

  root(): PropertyTreeNode {
    const parent = this.parents()[0];
    if (parent) {
      return parent.root();
    }
    return this;
  }

  ancestors(includeStepParents: boolean = false,): PropertyTreeNode[] {
    const nodes: PropertyTreeNode[] = [];
    if (includeStepParents) {
      this.parents().forEach((parent,) => {
        nodes.push(parent,);
        nodes.push(...parent.ancestors(true,),);
      },);
    } else {
      const parent = this.parents()[0];
      if (parent) {
        nodes.push(parent,);
        nodes.push(...parent.ancestors(false,),);
      }
    }
    return nodes;
  }

  isChildOf(ancestor: PropertyTreeNode,): boolean {
    const parent = this.parents()[0];
    if (parent === ancestor) {
      return true;
    }
    if (parent) {
      return parent.isChildOf(ancestor,);
    }
    return false;
  }

  leaf(): boolean {
    return this.children.length === 0 && this.adoptees.length === 0;
  }

  container(): boolean {
    return this.children.length > 0 || this.adoptees.length > 0;
  }

  kids(): PropertyTreeNode[] {
    return [...this.children, ...this.adoptees,];
  }

  parents(): PropertyTreeNode[] {
    const result: PropertyTreeNode[] = [];
    if (this._parent) {
      result.push(this._parent,);
    }
    result.push(...this.stepParents,);
    return result;
  }

  all(): PropertyTreeNode[] {
    const result: PropertyTreeNode[] = [this,];
    this.kids().forEach((child,) => {
      result.push(...child.all(),);
    },);
    return result;
  }

  /**
   * Returns the PropertyTreeNode itself (unwraps PTNProxy if present).
   *
   * @see docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb:ptn
   */
  ptn(): PropertyTreeNode {
    return this;
  }

  allLeaves(withoutSelf: boolean = false,): PropertyTreeNode[] {
    const result: PropertyTreeNode[] = [];
    if (this.leaf()) {
      if (!withoutSelf) {
        result.push(this,);
      }
    } else {
      this.kids().forEach((child,) => {
        result.push(...child.allLeaves(),);
      },);
    }
    return result;
  }

  getBSIndicies(): number[] {
    const indices: number[] = [];
    const collect = (node: PropertyTreeNode | null,): void => {
      if (!node) return;
      const parent = node._parent as PropertyTreeNode | null;
      if (parent) {
        indices.unshift(parent.levelSeqNo(node,),);
      } else {
        indices.unshift(this.propertySet.levelSeqNo(node,),);
      }
      collect(parent,);
    };
    collect(this,);
    return indices;
  }

  /**
   * Atributos `index` deste nó e de todos os seus ancestrais, da raiz para o
   * nó (Ruby `getIndicies`). É a base do atributo `tree`, usado pela ordenação
   * em modo árvore (`PropertyList#indexTree`).
   *
   * Diferente de `getBSIndicies` (posição estrutural, sempre definida), aqui
   * entra o valor do atributo `index`, recalculado pela última ordenação — e
   * `null` quando o nó ainda não tem o atributo.
   */
  getIndicies(): Array<number | null> {
    const indices: Array<number | null> = [];
    // Sobe até a raiz inserindo `index` na frente: a ordem final é raiz → nó.
    const collect = (node: PropertyTreeNode,): void => {
      // Ruby: `p.get('index')`, que é nil quando o nó não tem o atributo.
      const index = node.attributeDefinition("index",)
        ? node.get("index",)
        : null;
      indices.unshift(typeof index === "number" ? index : null,);
      const parent = node.parents()[0] as PropertyTreeNode | undefined;
      if (parent) collect(parent,);
    };
    collect(this,);
    return indices;
  }

  levelSeqNo(node: PropertyTreeNode,): number {
    return this.children.indexOf(node,) + 1;
  }

  addChild(child: PropertyTreeNode,): void {
    this.children.push(child,);
  }

  removeReferences(property: PropertyTreeNode,): void {
    const index = this.children.indexOf(property,);
    if (index !== -1) {
      this.children.splice(index, 1,);
    }
    const adopteeIndex = this.adoptees.indexOf(property,);
    if (adopteeIndex !== -1) {
      this.adoptees.splice(adopteeIndex, 1,);
    }
    const stepParentIndex = this.stepParents.indexOf(property,);
    if (stepParentIndex !== -1) {
      this.stepParents.splice(stepParentIndex, 1,);
    }
  }

  getStoredValue(attributeId: string,): unknown {
    return this._values.get(attributeId,) ?? null;
  }

  setStoredValue(attributeId: string, value: unknown,): void {
    this._values.set(attributeId, value,);
  }

  attribute(id: string,): AttributeBase<unknown> {
    let attr = this.attributes.get(id,);
    if (attr === undefined) {
      const aDef = this.attributeDefinition(id,);
      if (!aDef) {
        throw new TjArgumentError(`Unknown attribute '${id}'`,);
      }
      if (aDef.isScenarioAttribute) {
        throw new TjArgumentError(`Attribute '${id}' é específico de cenário`,);
      }
      attr = new aDef.objClass(this, aDef, this,);
      this.attributes.set(id, attr,);
    }
    return attr!;
  }

  private scenarioAttribute(
    scIdx: number,
    id: string,
  ): AttributeBase<unknown> {
    let attr = this.scenarioAttributes[scIdx]?.get(id,);
    if (attr === undefined) {
      const aDef = this.attributeDefinition(id,);
      if (!aDef) {
        throw new TjArgumentError(`Unknown attribute '${id}'`,);
      }
      if (!aDef.isScenarioAttribute) {
        throw new TjArgumentError(
          `Attribute '${id}' não é específico de cenário`,
        );
      }
      if (!this.data[scIdx]) {
        throw new TjInternalError(
          "ScenarioData must be initialized before scenario-specific attributes",
        );
      }
      attr = new aDef.objClass(this, aDef, this.data[scIdx],);
      if (!this.scenarioAttributes[scIdx]) {
        this.scenarioAttributes[scIdx] = new Map();
      }
      this.scenarioAttributes[scIdx].set(id, attr,);
    }
    return attr!;
  }

  get(id: string,): unknown {
    return this.attribute(id,).get();
  }

  getAttribute(id: string, scIdx?: number,): AttributeBase<unknown> {
    if (scIdx !== undefined) {
      return this.scenarioAttribute(scIdx, id,);
    }
    return this.attribute(id,);
  }

  /**
   * Acesso público ao atributo de cenário (para uso interno do ScenarioData).
   * Cria o AttributeBase se ainda não existir.
   */
  getScenarioAttribute(scIdx: number, id: string,): AttributeBase<unknown> {
    return this.scenarioAttribute(scIdx, id,);
  }

  /**
   * Retorna o Map de atributos de cenário para um scIdx (uso interno).
   */
  protected getScenarioAttributes(
    scIdx: number,
  ): Map<string, AttributeBase<unknown>> {
    if (!this.scenarioAttributes[scIdx]) {
      this.scenarioAttributes[scIdx] = new Map();
    }
    return this.scenarioAttributes[scIdx];
  }

  getForScenario(id: string, scIdx: number,): unknown {
    return this.scenarioAttribute(scIdx, id,).get();
  }

  set(id: string, value: unknown,): void {
    const attr = this.attribute(id,);
    const overwrite = attr.provided && !attr.isList();
    attr.set(value as never,);
    if (overwrite) {
      throw new AttributeOverwrite(id,);
    }
  }

  force(id: string, value: unknown,): void {
    const attr = this.attribute(id,);
    attr.set(value as never,);
  }

  /**
   * Grava um valor de runtime (scheduler) no atributo de cenário sem a
   * guarda de sobrescrita de `setForScenario`. Equivalente ao
   * `instance_variable_set` que o Ruby usa para runtime attributes em
   * `TaskScenario#propagateDate` (TaskScenario.rb:1012) — o guard
   * `provided` existe para inputs do parser, não para o motor.
   */
  forceForScenario(id: string, value: unknown, scIdx: number,): void {
    const attr = this.scenarioAttribute(scIdx, id,);
    attr.set(value as never,);
  }

  setForScenario(id: string, value: unknown, scIdx: number,): void {
    if (scIdx === undefined) {
      this.set(id, value,);
      return;
    }
    let overwrite = false;
    if (AttributeBase.mode === 0) {
      // RUBY-COMPAT-FIX: o Ruby percorre `@project.scenario(scIdx).all`
      // (PropertyTreeNode.rb#[]=), isto é, o cenário alvo **e seus
      // descendentes** — não todos os cenários do projeto. Percorrer o projeto
      // inteiro fazia o override de um subcenário (`delayed:effort 8d`) ser
      // herdado pelo cenário pai (`baseline`), e o relatório do pai saía com
      // as datas do filho (golden de Gantt do mwe008).
      const target = this.project.scenario(scIdx,) as unknown as
        | Scenario
        | null;
      const affected: Scenario[] = target ? target.all() : [];
      for (const sc of affected) {
        const scenarioIdx = this.project.scenarioIdx(sc.fullId,);
        if (scenarioIdx === undefined) continue;
        const scenarioAttr = this.scenarioAttribute(scenarioIdx, id,);
        // Atribuições a atributos de lista sempre acumulam; não é overwrite.
        if (scenarioAttr.provided && !scenarioAttr.isList()) overwrite = true;
        if (scenarioIdx === scIdx) {
          scenarioAttr.set(value as never,);
        } else {
          scenarioAttr.inherit(value as never,);
        }
      }
    } else {
      const attr = this.scenarioAttribute(scIdx, id,);
      overwrite = attr.provided && !attr.isList();
      attr.set(value as never,);
    }
    if (overwrite) {
      throw new AttributeOverwrite(id,);
    }
  }

  provided(id: string, scIdx?: number,): boolean {
    if (scIdx !== undefined) {
      const attr = this.scenarioAttributes[scIdx]?.get(id,);
      return attr ? attr.provided : false;
    }
    const attr = this.attributes.get(id,);
    return attr ? attr.provided : false;
  }

  inherited(id: string, scIdx?: number,): boolean {
    if (scIdx !== undefined) {
      const attr = this.scenarioAttributes[scIdx]?.get(id,);
      return attr ? attr.inherited : false;
    }
    const attr = this.attributes.get(id,);
    return attr ? attr.inherited : false;
  }

  modified(id: string, scIdx?: number,): boolean {
    if (scIdx !== undefined) {
      const attr = this.scenarioAttributes[scIdx]?.get(id,);
      return attr ? (attr.provided || attr.inherited) : false;
    }
    const attr = this.attributes.get(id,);
    return attr ? (attr.provided || attr.inherited) : false;
  }

  attributeDefinition(id: string,): AttributeDefinition<unknown> | undefined {
    return this.propertySet.attributeDefinition(id,);
  }

  scenarioData(scIdx: number,): ScenarioData {
    return this.data[scIdx]!;
  }

  adopt(property: PropertyTreeNode,): void {
    // Ruby PropertyTreeNode#adopt (l.154-172): usa o MessageHandler global;
    // sob `trapSetup` o primeiro erro aborta o parse (TjRuntimeError).
    if (property === this) {
      MessageHandlerInstance.instance.error(
        "adopt_self",
        "A property cannot adopt itself",
        null,
        null,
        null,
        null,
      );
    }
    const allOfRoot = this.root().all();
    for (const leaf of property.allLeaves()) {
      if (allOfRoot.includes(leaf,)) {
        MessageHandlerInstance.instance.error(
          "adopt_duplicate_child",
          `The task '${leaf.fullId}' has already been adopted by property ` +
            `'${this.root().fullId}' or any of its sub-properties.`,
          null,
          null,
          null,
          null,
        );
      }
    }
    this.adoptees.push(property,);
    property.getAdopted(this,);
  }

  getAdopted(property: PropertyTreeNode,): void {
    if (this.stepParents.includes(property,)) {
      return;
    }
    this.stepParents.push(property,);
  }

  inheritAttributes(): void {
    this.propertySet.eachAttributeDefinition((attrDef,) => {
      if (attrDef.isScenarioAttribute || !attrDef.inheritedFromParent) {
        return;
      }
      const aId = attrDef.id;
      const parent = this.parents()[0];
      if (parent) {
        if (parent.provided(aId,) || parent.inherited(aId,)) {
          this.attribute(aId,).inherit(parent.get(aId,) as never,);
        }
      } else if (attrDef.inheritedFromProject) {
        const projectVal = this.project.get(aId,);
        if (projectVal !== undefined) {
          this.attribute(aId,).inherit(projectVal as never,);
        }
      }
    },);

    this.propertySet.eachAttributeDefinition((attrDef,) => {
      if (!attrDef.isScenarioAttribute || !attrDef.inheritedFromParent) {
        return;
      }
      const aId = attrDef.id;
      for (let scIdx = 0; scIdx < this.project.scenarioCount; scIdx++) {
        const parent = this.parents()[0];
        if (parent) {
          if (parent.provided(aId, scIdx,) || parent.inherited(aId, scIdx,)) {
            this.scenarioAttribute(scIdx, aId,).inherit(
              parent.getForScenario(aId, scIdx,) as never,
            );
          }
        } else if (attrDef.inheritedFromProject) {
          const projectVal = this.project.get(aId,);
          if (
            projectVal !== undefined &&
            this.scenarioAttributes[scIdx]?.has(aId,)
          ) {
            this.scenarioAttribute(scIdx, aId,).inherit(projectVal as never,);
          }
        }
      }
    },);
  }

  /**
   * deep_clone é usado apenas para atributos, nunca para propriedades.
   * Como os atributos podem referenciar propriedades, essas referências
   * devem permanecer referências (Ruby: PropertyTreeNode#deep_clone).
   *
   * @see docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb#deep_clone
   */
  deepClone(): this {
    return this;
  }

  backupAttributes(): [
    Map<string, AttributeBase<unknown>>,
    Array<Map<string, AttributeBase<unknown>>>,
  ] {
    return [
      new Map(this.attributes,),
      this.scenarioAttributes.map((m,) => new Map(m,)),
    ];
  }

  restoreAttributes(
    backup: [
      Map<string, AttributeBase<unknown>>,
      Array<Map<string, AttributeBase<unknown>>>,
    ],
  ): void {
    this.attributes.clear();
    this.scenarioAttributes.forEach((m,) => m.clear());
    backup[0].forEach((value, key,) => {
      this.attributes.set(key, value,);
    },);
    backup[1].forEach((map, scIdx,) => {
      map.forEach((value, key,) => {
        if (!this.scenarioAttributes[scIdx]) {
          this.scenarioAttributes[scIdx] = new Map();
        }
        this.scenarioAttributes[scIdx].set(key, value,);
      },);
    },);
  }

  // ------------------------------------------------------------------
  // query_* compartilhados (Onda B1 — porta PropertyTreeNode.rb:594-673).
  //
  // O dispatch de `Query.process` resolve `query_<atributo>` primeiro na
  // propriedade (etapa h) e depois no ScenarioData (etapa i). Estes métodos
  // são a etapa h: valem para qualquer propriedade (task/resource/account/...
  //). Delegam ao `Journal` já portado (currentEntriesR/alertLevel/
  // alertEntries/to_rti/messagesRti).
  // ------------------------------------------------------------------

  /**
   * Filhos da propriedade como lista (Ruby `query_children`, l.594-610).
   * Com `query.listItem`, cada item é renderizado como RichText com a query
   * reencaminhada para o filho; senão usa `"nome (fullId)"`.
   */
  query_children(query: Query,): void {
    const list: string[] = [];
    for (const property of this.kids()) {
      if (query.listItem) {
        const rti = new RichText(
          query.listItem,
          RTFHandlers.create(query.project ?? null,),
        ).generateIntermediateFormat();
        if (!rti) continue;
        const q = query.dup();
        q.property = property;
        rti.setQuery(q,);
        list.push(`<nowiki>${rti.to_s()}</nowiki>`,);
      } else {
        list.push(`<nowiki>${property.name} (${property.fullId})</nowiki>`,);
      }
    }
    query.assignList(list,);
  }

  /** Journal completo da propriedade (Ruby `query_journal`, l.612-614). */
  query_journal(query: Query,): void {
    query.project?.journal.to_rti(query,);
  }

  /**
   * Nível de alerta efetivo em `query.end` (Ruby `query_alert`, l.616-631):
   * numérico/ordenável = nível; texto/RTI = nome colorido do nível.
   */
  query_alert(query: Query,): void {
    const journal = query.project?.journal;
    if (!journal) return;
    const alert = journal.alertLevel(query.end, this, query,);
    query.sortable = query.numerical = alert;
    const levels = query.project?.get("alertLevels",) as
      | Array<{ id: string; name: string; color: string }>
      | undefined;
    const alertLevel = levels?.[alert];
    if (!alertLevel) return;
    query.string = alertLevel.name;
    const rText = `<fcol:${alertLevel.color}><nowiki>${alertLevel.name}` +
      "</nowiki></fcol>";
    const rti = new RichText(
      rText,
      RTFHandlers.create(query.project ?? null,),
    ).generateIntermediateFormat();
    if (!rti) return;
    rti.blockMode = false;
    query.rti = rti;
  }

  /** Mensagens de alerta (Ruby `query_alertmessages`, l.633-637). */
  query_alertmessages(query: Query,): void {
    this.journalMessages(
      query.project!.journal.alertEntries(
        query.end,
        this,
        1,
        query.start,
        query,
      ),
      query,
      true,
    );
  }

  /** Resumos de alerta (Ruby `query_alertsummaries`, l.639-643). */
  query_alertsummaries(query: Query,): void {
    this.journalMessages(
      query.project!.journal.alertEntries(
        query.end,
        this,
        1,
        query.start,
        query,
      ),
      query,
      false,
    );
  }

  /** Mensagens de journal (Ruby `query_journalmessages`, l.645-650). */
  query_journalmessages(query: Query,): void {
    this.journalMessages(
      query.project!.journal.currentEntries(
        query.end,
        this,
        0,
        query.start,
        query.hideJournalEntry,
      ),
      query,
      true,
    );
  }

  /** Resumos de journal (Ruby `query_journalsummaries`, l.652-657). */
  query_journalsummaries(query: Query,): void {
    this.journalMessages(
      query.project!.journal.currentEntries(
        query.end,
        this,
        0,
        query.start,
        query.hideJournalEntry,
      ),
      query,
      false,
    );
  }

  /**
   * Tendência do nível de alerta entre `query.start` e `query.end` (Ruby
   * `query_alerttrend`, l.659-673): Up (0) / Flat (1) / Down (2). Portável
   * porque `alertLevel` usa `currentEntriesR` já implementado.
   */
  query_alerttrend(query: Query,): void {
    const journal = query.project?.journal;
    if (!journal) return;
    const startAlert = journal.alertLevel(query.start, this, query,);
    const endAlert = journal.alertLevel(query.end, this, query,);
    if (startAlert < endAlert) {
      query.sortable = 0;
      query.string = "Up";
    } else if (startAlert > endAlert) {
      query.sortable = 2;
      query.string = "Down";
    } else {
      query.sortable = 1;
      query.string = "Flat";
    }
  }

  /**
   * Compõe o RTI blog-style das entradas (Ruby `journalMessages`, l.719-753),
   * delegando o markup a {@link Journal.messagesRti}.
   */
  private journalMessages(
    entries: JournalEntry[],
    query: Query,
    longVersion: boolean,
  ): void {
    const rti = query.project!.journal.messagesRti(
      entries,
      query,
      longVersion,
    );
    if (!rti) return;
    query.rti = rti;
  }
}
