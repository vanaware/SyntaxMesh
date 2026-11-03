import { PropertyTreeNode, } from "./property-tree-node.ts";
import { type ProjectLike, } from "./project-like.ts";
import { MaterialScenario, } from "./material-scenario.ts";
import type { MaterialAllocation, } from "./material-allocation.ts";
import type { MaterialBooking, } from "./material-booking.ts";
import type { Task, } from "./task.ts";
import type { TjTime, } from "../time/tj-time.ts";
import { ChargeSetCollection, } from "../finance/charge-set-collection.ts";
import type { ChargeSet, } from "../finance/charge-set.ts";
import type { Account, } from "./account.ts";
import { MaterialComponent, } from "./material-component.ts";

/**
 * Entidade de primeira classe representando um insumo físico do projeto
 * (aço, concreto, tinta etc.), com quantidade, preço unitário e
 * distribuição temporal.
 *
 * Desde a Fase 10 Complemento (C1), `Material` é uma entidade de árvore
 * registrada em `project.materials` — indexável por ID e navegável na
 * árvore do projeto, com suporte a `note`/`journalentry`/rollup de
 * allocations. Os campos `unit`/`unitPrice`/`chargeset` são mantidos como
 * campos de compatibilidade (C1.4); o parser (C3) é a fonte canônica dos
 * atributos.
 *
 * A quantidade de um material **não** é declarada: é derivada das alocações
 * das tarefas (Σ `MaterialAllocation.quantity`), conforme a 14C.11.10.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C1)
 */
export class Material extends PropertyTreeNode {
  readonly unit: string;
  readonly unitPrice: number;
  readonly chargeset: ChargeSetCollection;
  /**
   * Bookings de estoque que já geraram `CostEvent` (14C.13.7). A comparação é
   * por **identidade** — os bookings são imutáveis, então um Set basta e o
   * turnover, que pode rodar muitas vezes no mesmo parse, não duplica o
   * evento.
   */
  private readonly emittedStockBookings = new Set<MaterialBooking>();
  /**
   * Pilha de visitação da composição (14C.14.4): impede que um ciclo entre
   * materiais provoque recursão infinita em `unitPriceValue()`.
   */
  private pricingStack: Set<string> | null = null;

  constructor(
    project: ProjectLike,
    id: string,
    unit: string,
    unitPrice: number,
    chargeset?: ChargeSetCollection,
    parent: Material | null = null,
    label?: string,
  ) {
    // Registra no PropertySet hierárquico do projeto (C1.1). O `name` base passa
    // a ser o rótulo do cabeçalho (`material <id> "<rótulo>"`), caindo no id
    // quando não declarado (compatível com `material steel` sem aspas) — fecha a
    // pendência 14C.1.14.
    super(project.materials, id, label ?? id, parent,);
    this.unit = unit;
    this.unitPrice = unitPrice;
    this.chargeset = chargeset ?? new ChargeSetCollection();
    // Atributos base espelhados em `AttributeBase` para que consultas Query
    // (`<-name->`/`<-id->`, 14C.1.14) devolvam o rótulo (name) e o identificador
    // (id) do material: o PTN guarda esses dois valores em campos, não no
    // atributo.
    this.set("name", label ?? id,);
    this.set("id", id,);
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new MaterialScenario(
        this,
        i,
        this.getScenarioAttributes(i,),
      );
    }
  }

  override scenarioData(scIdx: number,): MaterialScenario {
    return this.data[scIdx]! as MaterialScenario;
  }

  /**
   * Alocações deste material nas tarefas do projeto no cenário `scIdx`
   * (14C.11.10). Percorre `project.tasks`, então reflete sempre o estado
   * atual do modelo — inclusive depois de um parse com referência futura.
   */
  allocations(scIdx: number,): MaterialAllocation[] {
    const out: MaterialAllocation[] = [];
    for (const node of this.project.tasks.toArray()) {
      const list = (node.getForScenario("materialallocations", scIdx,) ??
        []) as MaterialAllocation[];
      for (const allocation of list) {
        if (allocation.material === this) out.push(allocation,);
      }
    }
    return out;
  }

  /**
   * Quantidade total derivada: Σ `MaterialAllocation.quantity` no cenário.
   * Substitui o antigo `totalquantity` do bloco de material (14C.11.10).
   */
  allocatedQuantity(scIdx: number,): number {
    return this.allocations(scIdx,).reduce((sum, a,) => sum + a.quantity, 0,);
  }

  /**
   * Custo derivado das alocações: Σ quantidade × preço unitário efetivo da
   * alocação (alocação → material, 14C.11.6). O custo realizado (bookings)
   * é somado pelos relatórios.
   */
  allocatedCost(scIdx: number,): number {
    return this.allocations(scIdx,).reduce(
      (sum, a,) => sum + a.quantity * a.unitPriceFor(this,),
      0,
    );
  }

  /**
   * Preço unitário efetivo do material, na precedência do Adendo Extra §12.2
   * (confirmada em §12.4):
   *
   * 1. `cost` explícito (`unitprice` no bloco ou gravado por código);
   * 2. **calculado** pela composição — Σ `quantidade × preço do componente`,
   *    recursivamente (um componente pode ser composto);
   * 3. campo do construtor (default para materiais criados por código).
   *
   * Ciclo de composição (impossível via parser — 14C.14.6) devolve 0 em vez de
   * estourar a pilha.
   */
  unitPriceValue(): number {
    const declared = this.providedNumber("cost",);
    if (declared !== null) return declared;
    const components = this.components(0,);
    if (components.length > 0) {
      const stack = this.pricingStack ?? new Set<string>();
      const ownsStack = this.pricingStack === null;
      if (stack.has(this.fullId,)) {
        // Ciclo: devolve 0 (o parser já sinalizou o problema).
        return 0;
      }
      stack.add(this.fullId,);
      this.pricingStack = stack;
      let total = 0;
      for (const component of components) {
        total += component.quantity * component.material.unitPriceValue();
      }
      stack.delete(this.fullId,);
      if (ownsStack) this.pricingStack = null;
      return total;
    }
    return this.unitPrice;
  }

  // ------------------------------------------------------------------
  // Composição (Adendo Extra §12.2 — 14C.14)
  // ------------------------------------------------------------------

  /** Componentes declarados no bloco do material (por unidade do composto). */
  components(scIdx: number,): MaterialComponent[] {
    return (this.getForScenario("materialcomponents", scIdx,) ??
      []) as MaterialComponent[];
  }

  /** O material é composto (preço calculado, não declarado)? */
  hasComponents(scIdx: number,): boolean {
    return this.components(scIdx,).length > 0;
  }

  /**
   * percorre o alcance de composição a partir deste material procurando
   * `target` — usado pelo parser para rejeitar ciclos antes de anexar o
   * componente (14C.14.6).
   */
  composes(target: string, scIdx: number,): boolean {
    for (const component of this.components(scIdx,)) {
      if (component.material.fullId === target) return true;
      if (component.material.composes(target, scIdx,)) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------
  // Booking de estoque (Adendo Extra §12.1 — 14C.13.6)
  // ------------------------------------------------------------------

  /**
   * Movimentos de estoque declarados no próprio bloco de material (sem
   * tarefa): positiva = entrada, negativa = saída/estorno.
   */
  stockBookings(scIdx: number,): MaterialBooking[] {
    return (this.getForScenario("stockbookings", scIdx,) ??
      []) as MaterialBooking[];
  }

  /** Quantidade em estoque: Σ dos bookings de movimento no cenário. */
  stockQuantity(scIdx: number,): number {
    return this.stockBookings(scIdx,).reduce(
      (sum, b,) => sum + b.quantity,
      0,
    );
  }

  /**
   * Valor monetário dos movimentos de estoque no cenário (o estorno entra
   * com sinal negativo). Não confundi-lo com `allocatedCost`: aqui é o que
   * entrou/saiu do estoque, não o que as tarefas consumiram.
   */
  stockCost(scIdx: number,): number {
    return this.stockBookings(scIdx,).reduce((sum, b,) => sum + b.cost(), 0,);
  }

  /**
   * Conta que recebe os movimentos de estoque: o chargeset do material no
   * cenário (regra 2 de `resolveAccount`) senão a conta default do projeto
   * para material (regra 4). `null` quando não há conta — o parser rejeita
   * booking de estoque nessa situação (14C.13.5).
   */
  stockAccount(scIdx: number,): Account | null {
    const sets = (this.getForScenario("chargeset", scIdx,) ??
      []) as ChargeSet[];
    for (const set of sets) {
      if (set.master) return set.master;
    }
    return this.project.defaultAccountFor?.("material",) ?? null;
  }

  /**
   * Marca/consulta o booking de estoque como tendo gerado seu `CostEvent`
   * (emissão idempotente do turnover, 14C.13.7).
   */
  stockBookingEmitted(booking: MaterialBooking,): boolean {
    return this.emittedStockBookings.has(booking,);
  }

  /** Registra `booking` como emitido. */
  markStockBookingEmitted(booking: MaterialBooking,): void {
    this.emittedStockBookings.add(booking,);
  }

  /**
   * Unidade efetiva: o atributo `unit` quando preenchido (o default canônico
   * `"{}"` significa “não informado”), senão o campo do construtor.
   */
  unitValue(): string {
    const unit = this.get("unit",);
    if (typeof unit === "string" && unit !== "" && unit !== "{}") return unit;
    return this.unit;
  }

  /**
   * Valor numérico do atributo se ele foi explicitamente fornecido (parser,
   * `set`), senão `null` — deixa os campos do construtor valerem como default.
   */
  private providedNumber(id: string,): number | null {
    const attr = this.getAttribute(id,);
    const value = attr.get();
    return attr.provided && typeof value === "number" ? value : null;
  }

  // ==================================================================
  // Cálculos derivados por período (Onda C — fonte única de verdade).
  //
  // Compartilhados entre as colunas calculadas do materialreport
  // (`TableReport.genMaterialCell`) e os `query_*` de `MaterialScenario`, para
  // que `query_X` devolva exatamente o valor da célula correspondente
  // (paridade query ⇄ coluna). O recorte é o período fechado `[start, end]`;
  // `start`/`end` nulos significam “sem recorte”. Quando há `CostEvent`
  // `material_usage`, o custo vem dos eventos **sem** recorte de período — a
  // mesma convenção histórica do relatório (14C.11.7 / C18).
  // ==================================================================

  /** Alocações deste material com a tarefa dona (14C.11.10). */
  private allocationsWithTask(
    scIdx: number,
  ): Array<{ task: Task; quantity: number; allocation: MaterialAllocation }> {
    const out: Array<
      { task: Task; quantity: number; allocation: MaterialAllocation }
    > = [];
    for (const node of this.project.tasks.toArray()) {
      const list = (node.getForScenario("materialallocations", scIdx,) ??
        []) as MaterialAllocation[];
      for (const allocation of list) {
        if (allocation.material === this) {
          out.push({
            task: node as Task,
            quantity: allocation.quantity,
            allocation,
          },);
        }
      }
    }
    return out;
  }

  /** Bookings (consumo realizado) deste material com a tarefa dona. */
  private bookingsWithTask(
    scIdx: number,
  ): Array<{ task: Task; booking: MaterialBooking }> {
    const out: Array<{ task: Task; booking: MaterialBooking }> = [];
    for (const node of this.project.tasks.toArray()) {
      const list = (node.getForScenario("materialbookings", scIdx,) ??
        []) as MaterialBooking[];
      for (const booking of list) {
        if (booking.material === this) {
          out.push({ task: node as Task, booking, },);
        }
      }
    }
    return out;
  }

  /** A tarefa dona cruza o período `[start, end]`? Sem agenda, sempre sim. */
  private static crossesPeriod(
    task: Task,
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): boolean {
    if (!start || !end) return true;
    const s = task.getForScenario("start", scIdx,) as TjTime | null;
    const e = task.getForScenario("end", scIdx,) as TjTime | null;
    if (!s || !e) return true;
    return !(e.compareTo(start,) < 0 || s.compareTo(end,) > 0);
  }

  /** Custo efetivo de um booking (precedência booking → alocação → material). */
  private bookingEffectiveCost(
    booking: MaterialBooking,
    scIdx: number,
  ): number {
    const task = booking.task;
    const allocation = task
      ? this.allocationsWithTask(scIdx,)
        .find((a,) => a.task === task)?.allocation ?? null
      : null;
    return booking.cost(allocation,);
  }

  /** Há `CostEvent` `material_usage` deste material no cenário? */
  private hasCostEvents(scIdx: number,): boolean {
    return this.project.costEvents.some((ce,) =>
      ce.type === "material_usage" && ce.material === this &&
      ce.scenarioIdx === scIdx
    );
  }

  /** Soma dos `CostEvent` `material_usage`; `mode` null = planejado + real. */
  private costEventsSum(
    scIdx: number,
    mode: "planned" | "actual" | null,
  ): number {
    let sum = 0;
    for (const ce of this.project.costEvents) {
      if (
        ce.type !== "material_usage" || ce.material !== this ||
        ce.scenarioIdx !== scIdx
      ) continue;
      if (mode === null || ce.mode === mode) sum += ce.amount;
    }
    return sum;
  }

  /** Custo das alocações no período (com preço efetivo da alocação). */
  private allocationCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number | null {
    const allocs = this.allocationsWithTask(scIdx,);
    if (allocs.length === 0) return null;
    let sum = 0;
    for (const { task, allocation, } of allocs) {
      if (!Material.crossesPeriod(task, scIdx, start, end,)) continue;
      sum += allocation.quantity * allocation.unitPriceFor(this,);
    }
    return sum;
  }

  /** Custo dos bookings no período (com preço efetivo do booking). */
  private bookingCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number | null {
    const bookings = this.bookingsWithTask(scIdx,);
    if (bookings.length === 0) return null;
    let sum = 0;
    for (const { task, booking, } of bookings) {
      if (!Material.crossesPeriod(task, scIdx, start, end,)) continue;
      // Onda D3: booking temporal só conta a parte do período; legado usa
      // o caminho antigo inteiro (gate por tarefa, valor cheio).
      if (booking.isTemporal()) {
        if (!booking.overlapsPeriod(start, end,)) continue;
        const allocation = this.allocationsWithTask(scIdx,)
          .find((a,) => a.task === task)?.allocation ?? null;
        sum += booking.costInPeriod(start, end, allocation,);
        continue;
      }
      sum += this.bookingEffectiveCost(booking, scIdx,);
    }
    return sum;
  }

  /** `totalquantity`: Σ quantidades alocadas no período. */
  allocatedQuantityInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    let sum = 0;
    for (const { task, quantity, } of this.allocationsWithTask(scIdx,)) {
      if (!Material.crossesPeriod(task, scIdx, start, end,)) continue;
      sum += quantity;
    }
    return sum;
  }

  /** Quantidade consumida (Σ bookings com tarefa no período). */
  consumedQuantityInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    let sum = 0;
    for (const { task, booking, } of this.bookingsWithTask(scIdx,)) {
      if (!Material.crossesPeriod(task, scIdx, start, end,)) continue;
      // Onda D3: temporal ⇒ parte do período (com gate de sobreposição).
      if (booking.isTemporal()) {
        if (!booking.overlapsPeriod(start, end,)) continue;
        sum += booking.quantityInPeriod(start, end,);
        continue;
      }
      sum += booking.quantity;
    }
    return sum;
  }

  /** `scheduledcost`: planejado (`CostEvent` > alocações no período). */
  scheduledCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    if (this.hasCostEvents(scIdx,)) {
      return this.costEventsSum(scIdx, "planned",);
    }
    return this.allocationCostInPeriod(scIdx, start, end,) ?? 0;
  }

  /** `actualcost`: realizado (`CostEvent` > bookings no período). */
  actualCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    if (this.hasCostEvents(scIdx,)) return this.costEventsSum(scIdx, "actual",);
    return this.bookingCostInPeriod(scIdx, start, end,) ?? 0;
  }

  /** `totalcost`: planejado + realizado (`CostEvent` > alocações + bookings). */
  totalCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    if (this.hasCostEvents(scIdx,)) return this.costEventsSum(scIdx, null,);
    return (this.allocationCostInPeriod(scIdx, start, end,) ?? 0) +
      (this.bookingCostInPeriod(scIdx, start, end,) ?? 0);
  }

  /** Bookings de estoque (movimentos **sem** tarefa) no período fechado. */
  private stockBookingsInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): MaterialBooking[] {
    return this.stockBookings(scIdx,).filter((booking,) => {
      if (!booking.isInventory()) return false;
      if (!start || !end) return true;
      // Onda D3: temporal ⇒ qualquer intervalo cruzando o período; legado
      // ⇒ comparação pontual antiga, intacta.
      if (booking.isTemporal()) {
        return booking.overlapsPeriod(start, end,);
      }
      return booking.date.compareTo(start,) >= 0 &&
        booking.date.compareTo(end,) <= 0;
    },);
  }

  /** `stockquantity`: Σ algébrico das quantidades de estoque no período. */
  stockQuantityInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    let sum = 0;
    for (const booking of this.stockBookingsInPeriod(scIdx, start, end,)) {
      sum += booking.isTemporal()
        ? booking.quantityInPeriod(start, end,)
        : booking.quantity;
    }
    return sum;
  }

  /** `stockcost`: Σ algébrico dos valores de estoque no período. */
  stockCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    let sum = 0;
    for (const booking of this.stockBookingsInPeriod(scIdx, start, end,)) {
      sum += booking.isTemporal()
        ? booking.costInPeriod(start, end,)
        : booking.cost();
    }
    return sum;
  }

  /**
   * Cópia profunda imutável.
   * Retorna this (imutável) para compatibilidade com deepClone.
   */
  override deepClone(): this {
    return this;
  }
}
