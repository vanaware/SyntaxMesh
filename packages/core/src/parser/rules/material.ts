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
import {
  MaterialAllocation,
  type MaterialAllocationModifier,
} from "../../model/material-allocation.ts";
import { MaterialBooking, } from "../../model/material-booking.ts";
import { Task, } from "../../model/task.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import type { TjTime, } from "../../time/tj-time.ts";
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
  rule(p, "material", () => {
    p.pattern(
      ["!materialHeader", "!materialBody",],
      function (this: ProjectFileParser,): unknown {
        this.property = asProp(this,).parent;
        return null;
      },
    );
    p.doc(
      "material",
      "Materials are physical inputs (steel, concrete, paint) consumed by " +
        "tasks, with a quantity, a unit price and a temporal distribution.",
    );
  },);

  rule(p, "materialAttributes", () => {
    p.repeatable();
    p.optional();

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

  rule(p, "materialHeader", () => {
    p.pattern(
      ["_material", "!optionalID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        const project = this.project!;
        const rawId = this.val[1] as string | null;
        const name = String(this.val[2],);
        // Materiais precisam de ID endereçável (alocações os referenciam);
        // sem ID explícito usamos o nome como identificador.
        const id = rawId ?? name;
        if (project.material(id,)) {
          this.error(
            "material_exists",
            `Material ${id} has already been defined.`,
            this.sourceFileInfo[1] ?? this.getSourceFileInfo()!,
            this.property,
          );
        }
        this.property = new Material(
          project,
          id,
          "{}",
          0,
          undefined,
          this.property as Material | null,
        );
        this.property.sourceFileInfo = this.sourceFileInfo[0] ?? null;
        this.property.inheritAttributes();
        this.scenarioIdx = 0;
        return null;
      },
    );
    p.arg(2, "name", "A name or short description of the material.",);
  },);

  // ------------------------------------------------------------------
  // ID de material (referência em `supplement material` e alocações)
  // ------------------------------------------------------------------
  rule(p, "materialId", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      let id = String(this.val[0],);
      // Supplement aninhado: precisa prefixar o ID do pai.
      const prop = this.property;
      if (prop && prop instanceof Material) {
        id = prop.fullId + "." + id;
      }
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
        asProp(this,).set("cost", Number(this.val[1],),);
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

    // booking <task> quantity <q> [unitprice <p>] on <date>
    //
    // Consumo realizado declarado a partir do bloco do material. A tarefa pode
    // ser declarada depois (referência futura): o booking fica em
    // `Project.pendingBookings` e é ligado à tarefa no flush (14C.11.5).
    p.pattern(
      [
        "_booking",
        "!materialBookingTaskRef",
        "_quantity",
        "!number",
        "!materialBookingUnitPrice",
        "_on",
        "!date",
      ],
      function (this: ProjectFileParser,): unknown {
        const material = asProp(this,) as unknown as Material;
        addMaterialBooking(
          this,
          material,
          String(this.val[1],),
          Number(this.val[3],),
          this.val[4] as number | null,
          this.val[6] as TjTime,
        );
        return null;
      },
    );
    p.doc(
      "booking.material",
      "Record the actual consumption of the material by a task on a date, " +
        "optionally overriding the unit price.",
    );
    p.arg(1, "task", "The task that consumed the material.",);
    p.arg(3, "quantity", "The quantity consumed.",);
    p.arg(6, "date", "The date of the consumption.",);

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
  // (`material <id> <q> [modificador] [unitprice <p>]`)
  // ------------------------------------------------------------------
  rule(p, "materialAllocation", () => {
    p.pattern(
      [
        "_material",
        "!materialId",
        "!number",
        "!materialAllocationModifier",
        "!materialAllocationUnitPrice",
      ],
      addMaterialAllocation,
    );
    p.pattern(
      [
        "_use",
        "!materialId",
        "!number",
        "!materialAllocationModifier",
        "!materialAllocationUnitPrice",
      ],
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
  // Booking de material (`booking material <id> quantity <q> ...`)
  // ------------------------------------------------------------------
  rule(p, "materialBooking", () => {
    p.pattern(
      [
        "!materialId",
        "_quantity",
        "!number",
        "!materialBookingUnitPrice",
        "_on",
        "!date",
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
          this.val[5] as TjTime,
        );
        return null;
      },
    );
    p.arg(0, "material", "The ID of the material consumed.",);
    p.arg(2, "quantity", "The quantity consumed.",);
    p.arg(5, "date", "The date of the consumption.",);
  },);

  // Referência de tarefa no booking do corpo do material. Aceita ID ou nome;
  // a resolução pode ser futura (a tarefa pode vir depois do material).
  rule(p, "materialBookingTaskRef", () => {
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
}

/**
 * Action compartilhada pelas formas `material`/`use`: constrói um
 * `MaterialAllocation` (com o `unitprice` opcional da alocação) e anexa-o à
 * lista de cenário `materialallocations`.
 */
function addMaterialAllocation(
  this: ProjectFileParser,
): unknown {
  this.checkContainer("material",);
  const material = this.val[1] as Material;
  const quantity = Number(this.val[2],);
  const modifier = (this.val[3] as MaterialAllocationModifier | null) ??
    "distributed";
  const unitPrice = (this.val[4] as number | null) ?? undefined;
  const allocation = new MaterialAllocation(
    material,
    quantity,
    modifier,
    undefined,
    unitPrice,
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
  date: TjTime,
): void {
  const project = parser.project!;
  const task = findTask(parser, taskRef,);
  const booking = new MaterialBooking(
    material,
    task ? task.fullId : taskRef,
    quantity,
    date,
    unitPrice ?? undefined,
    task,
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
