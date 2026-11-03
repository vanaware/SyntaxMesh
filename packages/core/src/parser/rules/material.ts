/**
 * TjpSyntaxRules — bloco material (Fase 10 Complemento C3.1).
 *
 * `Material` é uma extensão SyntaxMesh (sem equivalente no TJ Ruby); a
 * forma das regras espelha `account.ts`/`shift.ts`. Aceita `unit`,
 * `unitprice`, `chargeset`, `flags`, `note`, `journalentry` no corpo e
 * registra a entidade em `project.materials`. A alocação de
 * material numa tarefa (`material <id> <quantidade> <modificador?>
 * <unitprice?>`, alias `use`) produz um `MaterialAllocation` no atributo de
 * cenário `materialallocations`; o `booking` (consumo realizado) produz um
 * `MaterialBooking` no atributo `materialbookings` da tarefa.
 *
 * `totalquantity` foi **removido** na 14C.11.9/14C.11.10: a quantidade de um
 * material é derivada das alocações (Σ `MaterialAllocation.quantity`).
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C3.1)
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §11.4
 */
import { Material, } from "../../model/material.ts";
import { MaterialComponent, } from "../../model/material-component.ts";
import {
  MaterialAllocation,
  type MaterialAllocationModifier,
} from "../../model/material-allocation.ts";
import { MaterialBooking, } from "../../model/material-booking.ts";
import type { BookingTail, } from "../../model/booking-period.ts";
import { Task, } from "../../model/task.ts";
import type { ChargeSet, } from "../../finance/charge-set.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { rule, } from "./helpers.ts";

const asProp = (parser: ProjectFileParser,): NonNullable<
  ProjectFileParser["property"]
> => parser.property!;

/** Lê uma lista de cenário (materialallocations etc.) com fallback []. */
function scList(parser: ProjectFileParser, attrId: string,): unknown[] {
  const prop = parser.property;
  if (!prop) return [];
  try {
    return (prop.getForScenario(attrId, parser.scenarioIdx,) as unknown[]) ??
      [];
  } catch (_e) {
    return [];
  }
}

/** Registra o bloco de regras de material. */
export function registerMaterialRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // material / header / body / attributes
  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  // Regra funil `material` (Adendo Extra §12.2, 14C.14.3).
  //
  // `material <id> "<nome>" { ... }` declara um material (aninhado ou não) e
  // `material <referencia> <quantidade>` declara um **componente de composição**
  // (preço de unidade calculado). As duas formas partilham o prefixo `_material
  // <id|nome>` e só divergem no token seguinte — `{`/`"<nome>"` contra um número.
  // Como a FSM só admite uma transição por token em cada estado
  // (`state.ts:139-157`), as duas ramificações vivem dentro desta única regra:
  // `materialNameRef` consome o identificador uma vez e `materialStatementTail`
  // decide pelo token seguinte.
  // ------------------------------------------------------------------
  rule(p, "material", () => {
    p.pattern(["_material", "!materialNameRef", "!materialStatementTail",],);
    p.doc(
      "material",
      "Materials are physical inputs (steel, concrete, paint) consumed by " +
        "tasks, with a quantity, a unit price and a temporal distribution. " +
        "Inside a material block, `material <reference> <quantity>` declares " +
        "a composition component instead of a nested material.",
    );
  },);

  rule(p, "materialAttributes", () => {
    p.repeatable();
    p.optional();

    // `!material` cobre tanto a declaração aninhada quanto a composição: o
    // prefixo compartilhado é resolvido dentro da regra funil (14C.14.3).
    p.pattern(["!material",],);
    p.pattern(["!materialScenarioAttributes",],);
    p.pattern(
      ["!scenarioIdCol", "!materialScenarioAttributes",],
      function (this: ProjectFileParser,): unknown {
        this.scenarioIdx = 0;
        return null;
      },
    );
    // Outros atributos são adicionados automaticamente.
  },);

  rule(p, "materialBody", () => {
    p.optionsRule("materialAttributes",);
  },);

  // Identificador logo após `material`: ID ou nome citado. Empurrado para
  // `pendingMaterialRef` — é o novo ID na declaração, a referência existente na
  // composição. A FSM consome um único token aqui e ramifica adiante.
  rule(p, "materialNameRef", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      this.pendingMaterialRef = String(this.val[0],);
      return this.pendingMaterialRef;
    },);
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      this.pendingMaterialRef = String(this.val[0],);
      return this.pendingMaterialRef;
    },);
    p.arg(0, "material", "The ID or name of the material or component.",);
  },);

  // Ramificação pelo token seguinte ao identificador: número → composição;
  // nome + corpo → declaração. `{` (corpo) nunca aparece sem um nome entre
  // colchetes, então as transições (NUMBER/FLOAT vs STRING) não colidem.
  rule(p, "materialStatementTail", () => {
    // Composição: `material <referencia> <quantidade>`.
    p.pattern(["!number",], addMaterialComponent,);
    p.arg(0, "quantity", "Quantity of the component needed for one unit.",);
    p.doc(
      "material.component",
      "Declare a component of the composed material: the quantity of the " +
        "component needed for one unit of it. Composed materials calculate " +
        "their unit price and cannot declare `unitprice`.",
    );

    // Declaração: `material <id> "<nome>" { ... }`. O material é criado em
    // `materialDeclName` (antes do corpo) e a conta/validação roda no fecho.
    p.pattern(
      ["!materialDeclName", "!materialBody",],
      function (this: ProjectFileParser,): unknown {
        validateStockBookings(this,);
        validateUnitPriceDeclaration(this,);
        this.property = asProp(this,).parent;
        return null;
      },
    );
  },);

  // Consome o `"<nome>"` da declaração e cria o Material (equivalente ao antigo
  // `materialHeader`), para que o corpo seguinte se anexe a ele.
  rule(p, "materialDeclName", () => {
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      createMaterial(this, this.pendingMaterialRef!, String(this.val[0],),);
      return null;
    },);
    p.arg(0, "name", "A name or short description of the material.",);
  },);

  // ------------------------------------------------------------------
  // ID de material (referência em `supplement material` e alocações)
  // ------------------------------------------------------------------
  rule(p, "materialId", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      const id = String(this.val[0],);
      // Composição e alocações referenciam materiais **globais** por ID; a
      // declaração de sub-material aninhada saiu do corpo (Adendo Extra §12.2,
      // 14C.14.3), então não prefixamos mais o ID do pai.
      const material = this.project!.material(id,);
      if (!material) {
        this.error(
          "unknown_material",
          `Unknown material ${id}`,
          this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
        );
      }
      return material;
    },);
    // Nome citado (`material "Steel" 500`, adendo §10): resolve por ID e, se
    // não houver, pelo nome do material.
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      const ref = String(this.val[0],);
      const material = findMaterial(this, ref,);
      if (!material) {
        this.error(
          "unknown_material",
          `Unknown material ${ref}`,
          this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
        );
      }
      return material;
    },);
    p.arg(0, "material", "The ID of an already defined material.",);
  },);

  // ------------------------------------------------------------------
  // Atributos (não-cenário e de cenário) do material
  // ------------------------------------------------------------------
  rule(p, "materialScenarioAttributes", () => {
    p.pattern(
      ["_unit", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set("unit", String(this.val[1],),);
        return null;
      },
    );
    p.doc("unit", "The unit of measure for the material (e.g. 'kg').",);
    p.arg(1, "unit", "Unit of measure",);

    p.pattern(
      ["_unitprice", "!number",],
      function (this: ProjectFileParser,): unknown {
        // `unitprice` é proibido em material composto, qualquer que seja a
        // ordem (14C.14.5) — aqui pega o caso `unitprice` **antes** dos
        // componentes.
        const material = asProp(this,) as unknown as Material;
        if (scList(this, "materialcomponents",).length > 0) {
          this.error(
            "unitprice_with_components",
            "The unit price of a composed material is calculated from its " +
              "components; `unitprice` cannot be declared.",
            this.sourceFileInfo[0] ?? null,
            material,
          );
        }
        material.set("cost", Number(this.val[1],),);
        return null;
      },
    );
    p.doc("unitprice", "Price per unit of the material.",);
    p.arg(1, "price", "Price per unit.",);

    // `totalquantity` foi removido (14C.11.9): a quantidade é derivada das
    // alocações. O token continua reservado na gramática só para dar um erro
    // explícito em vez de `unexpctd_token`.
    p.pattern(
      ["_totalquantity", "!number",],
      function (this: ProjectFileParser,): unknown {
        this.error(
          "totalquantity_removed",
          "`totalquantity` was removed; allocate the quantity with " +
            "`material <id> <quantity>` inside the task instead.",
          this.sourceFileInfo[0] ?? null,
          this.property,
        );
        return null;
      },
    );
    p.doc(
      "totalquantity",
      "Removed: the material quantity is derived from its allocations.",
    );

    // Consumo realizado e movimento de estoque a partir do bloco do material,
    // além de `booking charge` (14C.15.7). Todos partilham o prefixo `_booking`
    // — a FSM só admite uma transição por token em cada estado
    // (`state.ts:139-157`), então as formas ramificam dentro da regra
    // `materialBookingBody` (padrão idêntico ao de task/resource).
    p.pattern(["_booking", "!materialBookingBody",],);
    p.doc(
      "booking.material",
      "Record the actual consumption of the material by a task on a date, " +
        "optionally overriding the unit price. Without a task the booking is " +
        "a stock movement: positive quantity adds to the stock, negative " +
        "quantity removes from it. The `charge` form books a real expense " +
        "against the referenced task.",
    );

    p.pattern(["!chargeset",],);

    // LF.5a (Complemento Fase 11, 2ª onda §6.5): `flags` em material — antes
    // o parse produzia `unexpctd_token` (provado por exercício ao vivo). O
    // atributo já estava declarado em material-attributes (LF.1); falta só o
    // aceite gramatical, no padrão de resource.ts:219 / account.ts:193.
    p.pattern(["!flags",],);
    p.doc("flags.material", "Flags assigned to the material.",);

    p.pattern(
      ["_note", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set(
          "note",
          this.newRichText(
            String(this.val[1],),
            this.sourceFileInfo[1] ?? null,
          ),
        );
        return null;
      },
    );
    p.doc("note.material", "Attach a note to the material.",);

    p.pattern(["!journalEntry",],);
    // Outros atributos são adicionados automaticamente.
  },);

  // ------------------------------------------------------------------
  // Alocação de material numa tarefa
  // (`material <id> <q> ([unitprice <p>] <modifier> | <modifier> [unitprice <p>])`)
  // Onda D4 (D-g): o `unitprice` também pode vir **antes** do modificador.
  // A ordem fica na sub-regra `materialAllocationTail` — dois padrões na
  // mesma regra com os mesmos tokens iniciais violam o FSM (`Ambiguous
  // transition`); na tail os tokens de entrada dos dois padrões são
  // disjuntos (literais do modifier vs `_unitprice`).
  // ------------------------------------------------------------------
  rule(p, "materialAllocation", () => {
    p.pattern(
      ["_material", "!materialId", "!number", "!materialAllocationTail",],
      addMaterialAllocation,
    );
    p.pattern(
      ["_use", "!materialId", "!number", "!materialAllocationTail",],
      addMaterialAllocation,
    );
    p.doc(
      "material.task",
      "Consume a quantity of a material in the task, distributed over the " +
        "task duration according to the timebasis. An optional `unitprice` " +
        "overrides the material price for this allocation only.",
    );
    p.arg(1, "material", "The ID of the material to consume.",);
    p.arg(2, "quantity", "The quantity of material to consume.",);
  },);

  // Preço unitário próprio da alocação (`unitprice <n>`, 14C.11.2).
  rule(p, "materialAllocationUnitPrice", () => {
    p.optional();
    p.pattern(["_unitprice", "!number",], function (
      this: ProjectFileParser,
    ): unknown {
      return Number(this.val[1],);
    },);
    p.arg(1, "price", "Price per unit for this allocation.",);
  },);

  // Preço unitário próprio do booking (`unitprice <n>`, 14C.11.3).
  rule(p, "materialBookingUnitPrice", () => {
    p.optional();
    p.pattern(["_unitprice", "!number",], function (
      this: ProjectFileParser,
    ): unknown {
      return Number(this.val[1],);
    },);
    p.arg(1, "price", "Price per unit for this booking.",);
  },);

  // ------------------------------------------------------------------
  // Booking de material (`booking material <id> [quantity] <q> ...`)
  // ------------------------------------------------------------------
  rule(p, "materialBooking", () => {
    p.pattern(
      [
        "!materialId",
        "!bookingQuantity",
        "!number",
        "!materialBookingUnitPrice",
        "!bookingPeriodTail",
      ],
      function (this: ProjectFileParser,): unknown {
        this.checkContainer("material",);
        const task = this.property as Task;
        addMaterialBooking(
          this,
          this.val[0] as Material,
          task.fullId,
          Number(this.val[2],),
          this.val[3] as number | null,
          this.val[4] as BookingTail | null,
        );
        return null;
      },
    );
    p.arg(0, "material", "The ID of the material consumed.",);
    p.arg(2, "quantity", "The quantity consumed.",);
    p.arg(4, "period", "`on <date>` or `<modifier> <interval>[, …]` (D3).",);
  },);

  // ------------------------------------------------------------------
  // Corpo do `booking` no bloco do material (Adendo Extra §12.1/§12.3).
  // A FSM só admite uma transição por token em cada estado, então as duas
  // formas (`booking [quantity] ...` de consumo/estoque e `booking charge ...`)
  // ramificam pelo segundo token: `!materialBookingTaskRef` (opcional, resolve
  // para `$ID`/`$STRING` ou para os literais seguintes) versus `_charge`.
  // ------------------------------------------------------------------
  rule(p, "materialBookingBody", () => {
    // Consumo por tarefa (referência futura → `pendingBookings`) ou movimento
    // de estoque (sem referência), com quantidade assinada (estorno).
    p.pattern(
      [
        "!materialBookingTaskRef",
        "!bookingQuantity",
        "!signedNumber",
        "!materialBookingUnitPrice",
        "!bookingPeriodTail",
      ],
      function (this: ProjectFileParser,): unknown {
        const material = asProp(this,) as unknown as Material;
        const taskRef = this.val[0] as string | null;
        const quantity = Number(this.val[2],);
        const unitPrice = this.val[3] as number | null;
        const tail = this.val[4] as BookingTail | null;
        if (taskRef === null) {
          addStockBooking(this, material, quantity, unitPrice, tail,);
        } else {
          addMaterialBooking(
            this,
            material,
            taskRef,
            quantity,
            unitPrice,
            tail,
          );
        }
        return null;
      },
    );
    p.arg(0, "task", "The task that consumed the material.",);
    p.arg(2, "quantity", "The quantity consumed or moved.",);
    p.arg(4, "period", "`on <date>` or `<modifier> <interval>[, …]` (D3).",);

    // 14C.15.7: `booking charge <tarefa> [value] <montante> on <data>`.
    p.pattern(["!materialChargeBookingHeader",],);
    p.doc(
      "booking.charge.material",
      "Book a charge against the referenced task from the material block.",
    );
  },);

  /**
   * A keyword `quantity` passa a ser **opcional** em booking de material
   * (Adendo Extra §12.3, 14C.15.3): `booking material "Aço" 2100 on ...` é
   * a forma curta canônica. O literal não colide com o `$ID`/`$STRING` da
   * referência de tarefa porque `State#transition` prefere o literal.
   */
  rule(p, "bookingQuantity", () => {
    p.optional();
    p.pattern(["_quantity",], () => "quantity",);
  },);

  // Referência de tarefa no booking do corpo do material. Aceita ID ou nome;
  // a resolução pode ser futura (a tarefa pode vir depois do material).
  // **Opcional** (14C.13.4): ausente, o booking é um movimento de estoque.
  rule(p, "materialBookingTaskRef", () => {
    p.optional();
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      return String(this.val[0],);
    },);
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      return String(this.val[0],);
    },);
    p.arg(0, "task", "The ID or name of a task.",);
  },);

  rule(p, "materialAllocationModifier", () => {
    p.optional();
    p.pattern(["!materialAllocationModifierKeyword",], function (
      this: ProjectFileParser,
    ): unknown {
      return this.val[0];
    },);
  },);

  /** Núcleo obrigatório dos literais de modifier (Onda D4, tail). */
  rule(p, "materialAllocationModifierKeyword", () => {
    p.pattern(["_onstart",], () => "onstart",);
    p.descr("Consume the whole quantity on starting the task.",);
    p.pattern(["_onend",], () => "onend",);
    p.descr("Consume the whole quantity on finishing the task.",);
    p.pattern(["_perhour",], () => "perhour",);
    p.descr("Consume the quantity for every working hour.",);
    p.pattern(["_perday",], () => "perday",);
    p.descr("Consume the quantity for every day the task lasts.",);
    p.pattern(["_perweek",], () => "perweek",);
    p.descr("Consume the quantity for every week the task lasts.",);
    p.pattern(["_permonth",], () => "permonth",);
    p.descr("Consume the quantity for every month the task lasts.",);
    p.pattern(["_distributed",], () => "distributed",);
    p.descr("Spread the quantity over the eligible days of the task.",);
  },);

  /**
   * Cauda da alocação, nas duas ordens (Onda D4, D-g): `<modifier>
   * [unitprice]` ou `unitprice <p> [modifier]`. Retorna
   * `{ modifier, unitPrice }` (ou null quando ausente — modifier default
   * `distributed` fica com `addMaterialAllocation`). Os padrões têm tokens
   * de entrada disjuntos para não violar o FSM.
   */
  rule(p, "materialAllocationTail", () => {
    p.optional();
    p.pattern(
      ["!materialAllocationModifierKeyword", "!materialAllocationUnitPrice",],
      function (this: ProjectFileParser,): unknown {
        return {
          modifier: this.val[0] as MaterialAllocationModifier,
          unitPrice: this.val[1] as number | null,
        };
      },
    );
    p.pattern(
      ["_unitprice", "!number", "!materialAllocationModifier",],
      function (this: ProjectFileParser,): unknown {
        return {
          modifier: this.val[2] as MaterialAllocationModifier | null,
          unitPrice: Number(this.val[1],),
        };
      },
    );
  },);
}

/**
 * Action compartilhada pelas formas `material`/`use`: constrói um
 * `MaterialAllocation` (com o `unitprice` opcional da alocação) e anexa-o à
 * lista de cenário `materialallocations`.
 *
 * O slot 3 é o objeto `{ modifier, unitPrice }` de
 * `materialAllocationTail` (Onda D4, D-g — aceita as duas ordens); ausente
 * ⇒ modifier `distributed` e preço do material.
 */
function addMaterialAllocation(
  this: ProjectFileParser,
): unknown {
  this.checkContainer("material",);
  const material = this.val[1] as Material;
  const quantity = Number(this.val[2],);
  const tail = this.val[3] as {
    modifier: MaterialAllocationModifier | null;
    unitPrice: number | null;
  } | null;
  const allocation = new MaterialAllocation(
    material,
    quantity,
    tail?.modifier ?? "distributed",
    undefined,
    tail?.unitPrice ?? undefined,
  );
  asProp(this,).setForScenario(
    "materialallocations",
    scList(this, "materialallocations",).concat([allocation,],),
    this.scenarioIdx,
  );
  return null;
}

/**
 * Cria um `MaterialBooking` e o anexa à tarefa dona (quando já declarada) ou
 * à fila de pendências do projeto (referência futura, 14C.11.5). A tarefa é
 * procurada por ID e depois por nome, como nos demais IDs do parser.
 */
function addMaterialBooking(
  parser: ProjectFileParser,
  material: Material,
  taskRef: string,
  quantity: number,
  unitPrice: number | null,
  tail: BookingTail | null,
): void {
  if (!tail) return;
  const project = parser.project!;
  const task = findTask(parser, taskRef,);
  const booking = new MaterialBooking(
    material,
    task ? task.fullId : taskRef,
    quantity,
    tail.intervals[0]!.start,
    unitPrice ?? undefined,
    task,
    tail,
  );
  if (task) {
    appendBooking(parser, task, booking,);
  } else {
    project.pendingBookings.push({
      booking,
      scenarioIdx: parser.scenarioIdx,
    },);
  }
}

/** Anexa `booking` ao atributo de cenário `materialbookings` de `task`. */
export function appendBooking(
  parser: ProjectFileParser,
  task: Task,
  booking: MaterialBooking,
): void {
  const current = (task.getForScenario(
    "materialbookings",
    parser.scenarioIdx,
  ) ?? []) as MaterialBooking[];
  task.setForScenario(
    "materialbookings",
    current.concat([booking,],),
    parser.scenarioIdx,
  );
}

/**
 * Booking de estoque (Adendo Extra §12.1, 14C.13.4): movimento de material
 * sem tarefa dona — entrada (positiva) ou saída/estorno (negativa). Vai para
 * o atributo de cenário `stockbookings` do próprio material.
 */
function addStockBooking(
  parser: ProjectFileParser,
  material: Material,
  quantity: number,
  unitPrice: number | null,
  tail: BookingTail | null,
): void {
  if (!tail) return;
  const booking = new MaterialBooking(
    material,
    null,
    quantity,
    tail.intervals[0]!.start,
    unitPrice ?? undefined,
    null,
    tail,
  );
  material.setForScenario(
    "stockbookings",
    scList(parser, "stockbookings",).concat([booking,],),
    parser.scenarioIdx,
  );
}

/**
 * O booking de estoque só tem efeito contábil se houver conta para receber o
 * valor: o `chargeset` do material (regra 2 de `resolveAccount`) ou a conta
 * default do projeto para material (regra 4). Sem nenhum dos dois, o custo se
 * perderia — o Adendo Extra §12.1 exige o chargeset, então isso é **erro**
 * (14C.13.5). Roda no fim do bloco porque o `chargeset` pode vir depois do
 * `booking`.
 */
function validateStockBookings(parser: ProjectFileParser,): void {
  const material = parser.property;
  if (!(material instanceof Material)) return;
  const hasStockBookings = scList(parser, "stockbookings",).length > 0;
  if (!hasStockBookings) return;

  const sets = (material.getForScenario("chargeset", parser.scenarioIdx,) ??
    []) as ChargeSet[];
  if (sets.some((set,) => set.master !== null)) return;

  const defaultAccount = parser.project?.defaultAccountFor?.("material",);
  if (defaultAccount) return;

  parser.error(
    "stock_booking_without_chargeset",
    "A stock booking (booking without a task) needs an account to book " +
      "the cost against: declare a `chargeset` in the material block or a " +
      "`defaultaccount material` in the project.",
    parser.sourceFileInfo[0] ?? null,
    material,
  );
}

/**
 * Cria o Material de uma declaração `material <id> "<nome>" { ... }` (equivalente
 * ao antigo `materialHeader`), com o bloco externo como pai. Roda ANTES do corpo
 * para que os atributos aninhados se anexem ao material recém-criado. O
 * identificador endereço o material (fica como `id`), e o `"<nome>"` citado passa
 * a ser o `name` base do material (rótulo legível) — fecha a pendência 14C.1.14.
 */
function createMaterial(
  parser: ProjectFileParser,
  id: string,
  name: string,
): void {
  const project = parser.project!;
  // Materiais precisam de ID endereçável (alocações os referenciam). O ID é o
  // identificador; o `name` citado vira o rótulo (`label`) do material.
  if (project.material(id,)) {
    parser.error(
      "material_exists",
      `Material ${id} has already been defined.`,
      parser.sourceFileInfo[1] ?? parser.getSourceFileInfo()!,
      parser.property,
    );
  }
  parser.property = new Material(
    project,
    id,
    "{}",
    0,
    undefined,
    parser.property as Material | null,
    name,
  );
  parser.property.sourceFileInfo = parser.sourceFileInfo[0] ?? null;
  parser.property.inheritAttributes();
  parser.scenarioIdx = 0;
}

/**
 * Anexa o componente de composição (14C.14.3) ao atributo de cenário
 * `materialcomponents` do material dono do bloco, rejeitando ciclo antes de
 * anexar (14C.14.6). A referência vem de `pendingMaterialRef` (ID ou nome) e
 * precisa apontar para um material já declarado; a quantidade é `val[0]`.
 */
function addMaterialComponent(this: ProjectFileParser,): unknown {
  this.checkContainer("material",);
  const material = asProp(this,) as unknown as Material;
  const ref = this.pendingMaterialRef;
  const component = ref === null ? null : findMaterial(this, ref,);
  if (!component) {
    this.error(
      "unknown_material",
      `Unknown material ${ref}`,
      this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
    );
    return null;
  }
  const quantity = Number(this.val[0],);
  if (
    component.fullId === material.fullId ||
    component.composes(material.fullId, this.scenarioIdx,)
  ) {
    this.error(
      "material_composition_cycle",
      `Material ${component.fullId} cannot be a component of ` +
        `${material.fullId}: the composition would be circular.`,
      this.sourceFileInfo[0] ?? null,
      material,
    );
    return null;
  }
  material.setForScenario(
    "materialcomponents",
    scList(this, "materialcomponents",).concat([
      new MaterialComponent(component, quantity,),
    ],),
    this.scenarioIdx,
  );
  return null;
}

/**
 * `unitprice` e composição são mutuamente exclusivos (Adendo Extra §12.2).
 * O caso `unitprice` **depois** dos componentes é pego direto na regra;
 * este passe pega o inverso (`unitprice` antes dos componentes), quando o
 * `cost` já foi gravado mas o bloco acabou tendo componentes (14C.14.5).
 */
function validateUnitPriceDeclaration(parser: ProjectFileParser,): void {
  const material = parser.property;
  if (!(material instanceof Material)) return;
  if (!material.hasComponents(parser.scenarioIdx,)) return;
  if (!material.getAttribute("cost",).provided) return;
  parser.error(
    "unitprice_with_components",
    "The unit price of a composed material is calculated from its " +
      "components; `unitprice` cannot be declared.",
    parser.sourceFileInfo[0] ?? null,
    material,
  );
}

/** Resolve um ID ou nome de tarefa (pode falhar: referência futura). */
function findTask(parser: ProjectFileParser, ref: string,): Task | null {
  const project = parser.project!;
  const byId = project.task(ref,);
  if (byId) return byId;
  let found: Task | null = null;
  project.tasks.each((node,) => {
    if (!(node instanceof Task)) return;
    if (node.name === ref) found = node;
  },);
  return found;
}

/** Resolve um material por ID e, na falta dele, pelo nome. */
function findMaterial(
  parser: ProjectFileParser,
  ref: string,
): Material | null {
  const project = parser.project!;
  const byId = project.material(ref,);
  if (byId) return byId;
  let found: Material | null = null;
  project.materials.each((node,) => {
    if (!(node instanceof Material)) return;
    if (node.name === ref) found = node;
  },);
  return found;
}
