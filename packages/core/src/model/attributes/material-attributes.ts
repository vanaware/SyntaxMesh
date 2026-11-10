import { PropertySet, } from "../property-set.ts";
import { AttributeDefinition, } from "../../attributes/attribute-definition.ts";
import { AttributeType, } from "../../attributes/attribute-type.ts";

/**
 * Registers the material-specific attributes (phase 10 Complemento C1).
 *
 * `Material` is a new entity (no counterpart in TJ Ruby); the shape mirrors
 * `resource-attributes.ts`/`account-attributes.ts`. `note` covers the static
 * note (#1) and the `effortdone`/`effortleft` pair supports the temporal
 * rollup of the material allocations (#2).
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C1)
 */
export function registerMaterialAttributes(propertySet: PropertySet,): void {
  // index: Index (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=-1)
  // Re-registra para sobrescrever o default 0 da base PropertySet.
  propertySet.addAttributeType(
    new AttributeDefinition(
      "index",
      "Index",
      AttributeType.Integer,
      -1,
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // unit: Unit (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="{}")
  propertySet.addAttributeType(
    new AttributeDefinition(
      "unit",
      "Unit",
      AttributeType.String,
      "{}",
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // cost: Cost Per Unit (FloatAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=0.0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "cost",
      "Cost Per Unit",
      AttributeType.Float,
      0.0,
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      true, // inheritedFromParent
      true, // inheritedFromProject
    ),
  );

  // note: Note (RichTextAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  // Mirrors task-attributes.ts — static note, not scenario, not inherited.
  propertySet.addAttributeType(
    new AttributeDefinition(
      "note",
      "Note",
      AttributeType.RichText,
      null,
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // chargeset: Charge Sets (ChargeSetListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "chargeset",
      "Charge Sets",
      AttributeType.ChargeSetList,
      [],
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      true, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // effortdone: Effort Done (FloatAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=0.0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "effortdone",
      "Effort Done",
      AttributeType.Float,
      0.0,
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      true, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // effortleft: Effort Left (FloatAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=0.0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "effortleft",
      "Effort Left",
      AttributeType.Float,
      0.0,
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      true, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // `totalquantity` was removed in 14C.11.10: the quantity of a material is
  // derived from the task allocations (`Material#allocatedQuantity`), not
  // declared in the definition block.

  // stockbookings: Stock Bookings (NodeListAttribute,
  // inheritedFromParent=false, inheritedFromProject=false,
  // isScenarioAttribute=true, default=[]).
  // Extra Addendum §12.1 (14C.13.2) — stock movements declared in the
  // material block itself: `booking [quantity] <n> [unitprice <p>] on <date>`
  // **without** a task reference. Positive quantity = inbound, negative =
  // outbound/reversal. They live on the material because there is no owning
  // task.
  propertySet.addAttributeType(
    new AttributeDefinition(
      "stockbookings",
      "Stock Bookings",
      AttributeType.NodeList,
      [],
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // materialcomponents: Material Components (NodeListAttribute,
  // inheritedFromParent=false, inheritedFromProject=false,
  // isScenarioAttribute=true, default=[]).
  // Extra Addendum §12.2 (14C.14.2) — composition of a material: `material <id>
  // <quantity>` inside the block declares how much of each component goes into
  // **one** unit of the composite material. With components the `unitprice` is
  // no longer declared and becomes computed (Σ component × its price).
  propertySet.addAttributeType(
    new AttributeDefinition(
      "materialcomponents",
      "Material Components",
      AttributeType.NodeList,
      [],
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // flags: Flags (FlagListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  // Phase 11 complement (LF.1) — allows testing material flags in logical
  // expressions (`LogicalFlag`), analogous to task/resource/account.
  propertySet.addAttributeType(
    new AttributeDefinition(
      "flags",
      "Flags",
      AttributeType.FlagList,
      [],
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      true, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );
}
