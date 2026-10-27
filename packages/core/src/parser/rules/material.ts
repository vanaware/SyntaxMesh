/**
 * TjpSyntaxRules — bloco material (Fase 10 Complemento C3.1).
 *
 * `Material` é uma extensão SyntaxMesh (sem equivalente no TJ Ruby); a
 * forma das regras espelha `account.ts`/`shift.ts`. Aceita `unit`,
 * `unitprice`, `chargeset`, `totalquantity`, `note`, `journalentry` no corpo
 * e registra a entidade em `project.materials`. A alocação de material numa
 * tarefa (`material <id> <quantidade> <modificador?>`, alias `use`) produz um
 * `MaterialAllocation` no atributo de cenário `materialallocations`.
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C3.1)
 */
import { Material, } from "../../model/material.ts";
import {
  MaterialAllocation,
  type MaterialAllocationModifier,
} from "../../model/material-allocation.ts";
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

    p.pattern(
      ["_totalquantity", "!number",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set("totalquantity", Number(this.val[1],),);
        return null;
      },
    );
    p.doc("totalquantity", "Total planned quantity of the material.",);
    p.arg(1, "quantity", "Total quantity.",);

    p.pattern(["!chargeset",],);

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
  // Alocação de material numa tarefa (`material <id> <q> [modificador]`)
  // ------------------------------------------------------------------
  rule(p, "materialAllocation", () => {
    p.pattern(
      ["_material", "!materialId", "!number", "!materialAllocationModifier",],
      addMaterialAllocation,
    );
    p.pattern(
      ["_use", "!materialId", "!number", "!materialAllocationModifier",],
      addMaterialAllocation,
    );
    p.doc(
      "material.task",
      "Consume a quantity of a material in the task, distributed over the " +
        "task duration according to the timebasis.",
    );
    p.arg(1, "material", "The ID of the material to consume.",);
    p.arg(2, "quantity", "The quantity of material to consume.",);
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
 * `MaterialAllocation` e anexa-o à lista de cenário `materialallocations`.
 */
function addMaterialAllocation(
  this: ProjectFileParser,
): unknown {
  this.checkContainer("material",);
  const material = this.val[1] as Material;
  const quantity = Number(this.val[2],);
  const modifier = (this.val[3] as MaterialAllocationModifier | null) ??
    "distributed";
  const allocation = new MaterialAllocation(material, quantity, modifier,);
  asProp(this,).setForScenario(
    "materialallocations",
    scList(this, "materialallocations",).concat([allocation,],),
    this.scenarioIdx,
  );
  return null;
}
