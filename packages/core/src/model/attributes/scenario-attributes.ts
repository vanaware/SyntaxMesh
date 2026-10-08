import { PropertySet, } from "../property-set.ts";
import { AttributeDefinition, } from "../../attributes/attribute-definition.ts";
import { AttributeType, } from "../../attributes/attribute-type.ts";
import { BooleanAttribute, } from "../../attributes/scalar/boolean-attribute.ts";

/**
 * Registra os atributos específicos de cenário (6 atributos).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Scenario.rb
 */
export function registerScenarioAttributes(propertySet: PropertySet,): void {
  // active: Enabled (BooleanAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=true)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "active",
      "Enabled",
      AttributeType.Boolean,
      true,
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      true, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // ownbookings: Own Bookings (BooleanAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=true)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "ownbookings",
      "Own Bookings",
      AttributeType.Boolean,
      true,
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // id: ID (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "id",
      "ID",
      AttributeType.String,
      null,
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // name: Name (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "name",
      "Name",
      AttributeType.String,
      null,
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // seqno: No (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "seqno",
      "No",
      AttributeType.Integer,
      null,
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // projection: Projection Mode (BooleanAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "projection",
      "Projection Mode",
      AttributeType.Boolean,
      false,
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      true, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );
}
