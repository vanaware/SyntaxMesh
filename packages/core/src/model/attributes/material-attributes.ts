import { PropertySet, } from "../property-set.ts";
import { AttributeDefinition, } from "../../attributes/attribute-definition.ts";
import { AttributeType, } from "../../attributes/attribute-type.ts";

/**
 * Registra os atributos específicos de material (Fase 10 Complemento C1).
 *
 * `Material` é uma entidade nova (sem equivalente no TJ Ruby); a forma
 * espelha `resource-attributes.ts`/`account-attributes.ts`. `note` cobre a
 * nota estática (#1) e o par `effortdone`/`effortleft` dá suporte ao
 * rollup temporal dos allocations de material (#2).
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
  // Espelha task-attributes.ts — nota estática, não cenário, não herda.
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
}
