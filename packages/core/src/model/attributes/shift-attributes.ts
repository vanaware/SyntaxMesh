import { PropertySet, } from "../property-set.ts";
import { AttributeDefinition, } from "../../attributes/attribute-definition.ts";
import { AttributeType, } from "../../attributes/attribute-type.ts";
import { StringAttribute, } from "../../attributes/scalar/string-attribute.ts";
import { LeaveListAttribute, } from "../../attributes/time-interval/leave-list-attribute.ts";
import { BooleanAttribute, } from "../../attributes/scalar/boolean-attribute.ts";
import { WorkingHoursAttribute, } from "../../attributes/time-interval/working-hours-attribute.ts";
import { currentTimeZone, } from "../../time/timezone.ts";

/**
 * Registra os atributos específicos de shift (8 atributos).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Shift.rb
 */
export function registerShiftAttributes(propertySet: PropertySet): void {
  // bsi: BSI (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "bsi",
    "BSI",
    AttributeType.String,
    "",
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // index: Index (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=-1)
  // Re-registra para sobrescrever o default 0 da base PropertySet (Ruby @shifts tem index default -1)
  propertySet.addAttributeType(new AttributeDefinition(
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
  ));

  // leaves: Leaves (LeaveListAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=true, default=LeaveList.new)
  propertySet.addAttributeType(new AttributeDefinition(
    "leaves",
    "Leaves",
    AttributeType.LeaveList,
    [], // Default empty array for LeaveListAttribute
    false, // userDefined
    false, // isList
    false, // isSingleton
    true, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // replace: Replace (BooleanAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "replace",
    "Replace",
    AttributeType.Boolean,
    false,
    false, // userDefined
    false, // isList
    false, // isSingleton
    true, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // timezone: Time Zone (StringAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=true, default=currentTimeZone)
  propertySet.addAttributeType(new AttributeDefinition(
    "timezone",
    "Time Zone",
    AttributeType.String,
    currentTimeZone,
    false, // userDefined
    false, // isList
    false, // isSingleton
    true, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // tree: Tree Index (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "tree",
    "Tree Index",
    AttributeType.String,
    "",
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // workinghours: Working Hours (WorkingHoursAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "workinghours",
    "Working Hours",
    AttributeType.WorkingHours,
    null, // Default null for WorkingHoursAttribute
    false, // userDefined
    false, // isList
    false, // isSingleton
    true, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));
}