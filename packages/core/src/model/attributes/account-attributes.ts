import { PropertySet, } from "../property-set.ts";
import { AttributeDefinition, } from "../../attributes/attribute-definition.ts";
import { AttributeType, } from "../../attributes/attribute-type.ts";
import { StringAttribute, } from "../../attributes/scalar/string-attribute.ts";
import { SymbolAttribute, } from "../../attributes/scalar/symbol-attribute.ts";
import { IntegerAttribute, } from "../../attributes/scalar/integer-attribute.ts";
import { FlagListAttribute, } from "../../attributes/list/flag-list-attribute.ts";
import { AccountCreditListAttribute, } from "../../attributes/financial/account-credit-list-attribute.ts";

/**
 * Registra os atributos específicos de account (6 atributos).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Account.rb
 */
export function registerAccountAttributes(propertySet: PropertySet): void {
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
  // Re-registra para sobrescrever o default 0 da base PropertySet (Ruby @accounts tem index default -1)
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

  // id: ID (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
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
  ));

  // aggregate: Aggregate (SymbolAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=:tasks)
  propertySet.addAttributeType(new AttributeDefinition(
    "aggregate",
    "Aggregate",
    AttributeType.Symbol,
    "tasks", // Ruby uses :tasks symbol, using string equivalent
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // credits: Credits (AccountCreditListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "credits",
    "Credits",
    AttributeType.AccountCreditList,
    [], // Default empty array for AccountCreditListAttribute
    false, // userDefined
    false, // isList
    false, // isSingleton
    true, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // flags: Flags (FlagListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "flags",
    "Flags",
    AttributeType.FlagList,
    [], // Default empty array for FlagListAttribute
    false, // userDefined
    false, // isList
    false, // isSingleton
    true, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // name: Name (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
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
  ));

  // seqno: No (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
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
}