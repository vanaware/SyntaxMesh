/**
 * TjpSyntaxRules — material block (phase 10 complement C3.1).
 *
 * `Material` is a SyntaxMesh extension (no equivalent in TJ Ruby); the rule
 * shape mirrors `account.ts`/`shift.ts`. Accepts `unit`, `unitprice`,
 * `chargeset`, `flags`, `note` and `journalentry` in the body and registers
 * the entity in `project.materials`. Allocating material to a task
 * (`material <id> <quantity> <modifier?> <unitprice?>`, alias `use`) produces a
 * `MaterialAllocation` in the scenario attribute `materialallocations`;
 * `booking` (actual consumption) produces a `MaterialBooking` in the task's
 * `materialbookings` attribute.
 *
 * `totalquantity` was **removed** in 14C.11.9/14C.11.10: the quantity of a
 * material is derived from the allocations (Σ `MaterialAllocation.quantity`).
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (block C3.1)
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

/** Reads a scenario list (materialallocations etc.) with a `[]` fallback. */
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

/** Registers the material rule block. */
export function registerMaterialRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // material / header / body / attributes
  // ------------------------------------------------------------------
  // ------------------------------------------------------------------
  // `material` funnel rule (extra addendum §12.2, 14C.14.3).
  //
  // `material <id> "<name>" { ... }` declares a material (nested or not) and
  // `material <reference> <quantity>` declares a **composition component**
  // (computed unit price). Both forms share the `_material <id|name>` prefix
  // and differ only on the next token — `{`/`"<name>"` against a number.
  // Since the FSM allows a single transition per token in each state
  // (`state.ts:139-157`), both branches live inside this single rule:
  // `materialNameRef` consumes the identifier once and `materialStatementTail`
  // decides by the next token.
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

    // `!material` covers both the nested declaration and the composition: the
    // shared prefix is resolved inside the funnel rule (14C.14.3).
    p.pattern(["!material",],);
    p.pattern(["!materialScenarioAttributes",],);
    p.pattern(
      ["!scenarioIdCol", "!materialScenarioAttributes",],
      function (this: ProjectFileParser,): unknown {
        this.scenarioIdx = 0;
        return null;
      },
    );
    // Other attributes are added automatically.
  },);

  rule(p, "materialBody", () => {
    p.optionsRule("materialAttributes",);
  },);

  // Identifier right after `material`: an ID or a quoted name. Pushed to
  // `pendingMaterialRef` — it is the new ID in a declaration and the existing
  // reference in a composition. The FSM consumes a single token here and
  // branches further down.
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

  // Branching by the token after the identifier: number → composition;
  // name + body → declaration. `{` (body) never appears without a quoted name
  // in between, so the transitions (NUMBER/FLOAT vs STRING) do not collide.
  rule(p, "materialStatementTail", () => {
    // Composition: `material <reference> <quantity>`.
    p.pattern(["!number",], addMaterialComponent,);
    p.arg(0, "quantity", "Quantity of the component needed for one unit.",);
    p.doc(
      "material.component",
      "Declare a component of the composed material: the quantity of the " +
        "component needed for one unit of it. Composed materials calculate " +
        "their unit price and cannot declare `unitprice`.",
    );

    // Declaration: `material <id> "<name>" { ... }`. The material is created
    // in `materialDeclName` (before the body) and the accounting/validation
    // runs at the close.
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

  // Consumes the declaration `"<name>"` and creates the Material (equivalent
  // to the old `materialHeader`), so that the following body attaches to it.
  rule(p, "materialDeclName", () => {
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      createMaterial(this, this.pendingMaterialRef!, String(this.val[0],),);
      return null;
    },);
    p.arg(0, "name", "A name or short description of the material.",);
  },);

  // ------------------------------------------------------------------
  // material ID (reference in `supplement material` and allocations)
  // ------------------------------------------------------------------
  rule(p, "materialId", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      const id = String(this.val[0],);
      // Composition and allocations reference **global** materials by ID; the
      // nested sub-material declaration left the body (extra addendum §12.2,
      // 14C.14.3), so we no longer prefix the parent ID.
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
    // Quoted name (`material "Steel" 500`, addendum §10): resolved by ID and,
    // when absent, by the material name.
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
  // Material attributes (both non-scenario and scenario)
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
        // `unitprice` is forbidden in a composed material, whatever the order
        // (14C.14.5) — here we catch the `unitprice` **before** the components
        // case.
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

    // `totalquantity` was removed (14C.11.9): the quantity is derived from the
    // allocations. The token stays reserved in the grammar only to raise an
    // explicit error instead of `unexpctd_token`.
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

    // Actual consumption and stock movement from the material block, plus
    // `booking charge` (14C.15.7). They all share the `_booking` prefix — the
    // FSM allows a single transition per token in each state
    // (`state.ts:139-157`), so the forms branch inside the `materialBookingBody`
    // rule (pattern identical to task/resource).
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

    // LF.5a (phase 11 complement, 2nd wave §6.5): `flags` in material — before,
    // the parse produced `unexpctd_token` (proven by a live exercise). The
    // attribute was already declared in material-attributes (LF.1); only the
    // grammatical acceptance was missing, following resource.ts:219 /
    // account.ts:193.
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
    // Other attributes are added automatically.
  },);

  // ------------------------------------------------------------------
  // Material allocation to a task
  // (`material <id> <q> ([unitprice <p>] <modifier> | <modifier> [unitprice <p>])`)
  // Wave D4 (D-g): the `unitprice` may also come **before** the modifier.
  // The order lives in the `materialAllocationTail` sub-rule — two patterns in
  // the same rule with identical leading tokens violate the FSM (`Ambiguous
  // transition`); in the tail the entry tokens of both patterns are disjoint
  // (modifier literals vs `_unitprice`).
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

  // Allocation's own unit price (`unitprice <n>`, 14C.11.2).
  rule(p, "materialAllocationUnitPrice", () => {
    p.optional();
    p.pattern(["_unitprice", "!number",], function (
      this: ProjectFileParser,
    ): unknown {
      return Number(this.val[1],);
    },);
    p.arg(1, "price", "Price per unit for this allocation.",);
  },);

  // Booking's own unit price (`unitprice <n>`, 14C.11.3).
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
  // `booking` body in the material block (extra addendum §12.1/§12.3).
  // The FSM allows a single transition per token in each state, so the two
  // forms (`booking [quantity] ...` for consumption/stock and `booking charge ...`)
  // branch on the second token: `!materialBookingTaskRef` (optional, resolves
  // to `$ID`/`$STRING` or to the following literals) versus `_charge`.
  // ------------------------------------------------------------------
  rule(p, "materialBookingBody", () => {
    // Consumption by task (future reference → `pendingBookings`) or stock
    // movement (no reference), with a signed quantity (reversal).
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

    // 14C.15.7: `booking charge <task> [value] <amount> on <date>`.
    p.pattern(["!materialChargeBookingHeader",],);
    p.doc(
      "booking.charge.material",
      "Book a charge against the referenced task from the material block.",
    );
  },);

  /**
   * The `quantity` keyword becomes **optional** in material booking (extra
   * addendum §12.3, 14C.15.3): `booking material "Steel" 2100 on ...` is the
   * canonical short form. The literal does not collide with the `$ID`/`$STRING`
   * of the task reference because `State#transition` prefers the literal.
   */
  rule(p, "bookingQuantity", () => {
    p.optional();
    p.pattern(["_quantity",], () => "quantity",);
  },);

  // Task reference in the booking of the material body. Accepts ID or name; the
  // resolution may be future (the task may come after the material).
  // **Optional** (14C.13.4): when absent, the booking is a stock movement.
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

  /** Mandatory core of the modifier literals (wave D4, tail). */
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
   * Allocation tail, in both orders (wave D4, D-g): `<modifier> [unitprice]` or
   * `unitprice <p> [modifier]`. Returns `{ modifier, unitPrice }` (or null when
   * absent — the default `distributed` modifier stays with
   * `addMaterialAllocation`). The patterns have disjoint entry tokens so as not
   * to violate the FSM.
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
 * Action shared by the `material`/`use` forms: builds a `MaterialAllocation`
 * (with the allocation's optional `unitprice`) and appends it to the
 * `materialallocations` scenario list.
 *
 * Slot 3 is the `{ modifier, unitPrice }` object of `materialAllocationTail`
 * (wave D4, D-g — accepts both orders); when absent ⇒ modifier `distributed`
 * and the material price.
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
 * Creates a `MaterialBooking` and appends it to the owning task (when already
 * declared) or to the project pending queue (future reference, 14C.11.5). The
 * task is looked up by ID and then by name, like the other parser IDs.
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

/** Appends `booking` to the `materialbookings` scenario attribute of `task`. */
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
 * Stock booking (extra addendum §12.1, 14C.13.4): material movement without an
 * owning task — incoming (positive) or outgoing/reversal (negative). It goes to
 * the `stockbookings` scenario attribute of the material itself.
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
 * A stock booking only has an accounting effect when there is an account to
 * receive the value: the material `chargeset` (rule 2 of `resolveAccount`) or
 * the project default account for material (rule 4). Without either, the cost
 * would be lost — extra addendum §12.1 requires the chargeset, so this is an
 * **error** (14C.13.5). Runs at the end of the block because the `chargeset`
 * may come after the `booking`.
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
 * Creates the Material of a `material <id> "<name>" { ... }` declaration
 * (equivalent to the old `materialHeader`), with the outer block as parent. It
 * runs BEFORE the body so that the nested attributes attach to the freshly
 * created material. The identifier addresses the material (kept as `id`), and
 * the quoted `"<name>"` becomes the material's base `name` (readable label) —
 * closes pending item 14C.1.14.
 */
function createMaterial(
  parser: ProjectFileParser,
  id: string,
  name: string,
): void {
  const project = parser.project!;
  // Materials need an addressable ID (allocations reference them). The ID is the
  // identifier; the quoted `name` becomes the material `label`.
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
 * Appends the composition component (14C.14.3) to the `materialcomponents`
 * scenario attribute of the material owning the block, rejecting a cycle before
 * attaching (14C.14.6). The reference comes from `pendingMaterialRef` (ID or
 * name) and must point to an already declared material; the quantity is
 * `val[0]`.
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
 * `unitprice` and composition are mutually exclusive (extra addendum §12.2).
 * The `unitprice` **after** the components case is caught directly in the rule;
 * this pass catches the inverse (`unitprice` before the components), when
 * `cost` was already written but the block ended up having components
 * (14C.14.5).
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

/** Resolves a task ID or name (may fail: future reference). */
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

/** Resolves a material by ID and, failing that, by name. */
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
