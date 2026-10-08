import { PropertySet, } from "../property-set.ts";
import { AttributeDefinition, } from "../../attributes/attribute-definition.ts";
import { AttributeType, } from "../../attributes/attribute-type.ts";
import { FloatAttribute, } from "../../attributes/scalar/float-attribute.ts";
import { StringAttribute, } from "../../attributes/scalar/string-attribute.ts";
import { IntegerAttribute, } from "../../attributes/scalar/integer-attribute.ts";
import { ChargeSetListAttribute, } from "../../attributes/financial/charge-set-list-attribute.ts";
import { TaskListAttribute, } from "../../attributes/list/task-list-attribute.ts";
import { ResourceListAttribute, } from "../../attributes/list/resource-list-attribute.ts";
import { LogicalExpressionListAttribute, } from "../../attributes/logical/logical-expression-list-attribute.ts";
import { LeaveAllowanceListAttribute, } from "../../attributes/time-interval/leave-allowance-list-attribute.ts";
import { LeaveListAttribute, } from "../../attributes/time-interval/leave-list-attribute.ts";
import { LimitsAttribute, } from "../../attributes/time-interval/limits-attribute.ts";
import { ShiftAssignmentsAttribute, } from "../../attributes/time-interval/shift-assignments-attribute.ts";
import { WorkingHoursAttribute, } from "../../attributes/time-interval/working-hours-attribute.ts";

/**
 * Registra os atributos específicos de resource (14 atributos).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Resource.rb
 */
export function registerResourceAttributes(propertySet: PropertySet,): void {
  // bsi: BSI (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(
    new AttributeDefinition(
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
    ),
  );

  // id: ID (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(
    new AttributeDefinition(
      "id",
      "ID",
      AttributeType.String,
      "",
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // name: Name (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(
    new AttributeDefinition(
      "name",
      "Name",
      AttributeType.String,
      "",
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // index: Index (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=-1)
  // Re-registra para sobrescrever o default 0 da base PropertySet (Ruby @resources tem index default -1)
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

  // alloctdeffort: Alloctd. Effort (FloatAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=0.0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "alloctdeffort",
      "Alloctd. Effort",
      AttributeType.Float,
      0.0,
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
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
      [], // Default empty array for ChargeSetListAttribute
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      true, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // criticalness: Criticalness (FloatAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=0.0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "criticalness",
      "Criticalness",
      AttributeType.Float,
      0.0,
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // duties: Duties (TaskListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "duties",
      "Duties",
      AttributeType.TaskList,
      [], // Default empty array for TaskListAttribute
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // directreports: Direct Reports (ResourceListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "directreports",
      "Direct Reports",
      AttributeType.ResourceList,
      [], // Default empty array for ResourceListAttribute
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // efficiency: Efficiency (FloatAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=1.0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "efficiency",
      "Efficiency",
      AttributeType.Float,
      1.0,
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      true, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // effort: Total Effort (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "effort",
      "Total Effort",
      AttributeType.Integer,
      0,
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // email: Email (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "email",
      "Email",
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

  // fail: Failure Conditions (LogicalExpressionListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "fail",
      "Failure Conditions",
      AttributeType.LogicalExpressionList,
      [], // Default empty array for LogicalExpressionListAttribute
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // flags: Flags (FlagListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
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
    ),
  );

  // leaveallowances: Leave Allowances (LeaveAllowanceListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=LeaveAllowanceList.new)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "leaveallowances",
      "Leave Allowances",
      AttributeType.LeaveAllowanceList,
      [], // Default empty array for LeaveAllowanceListAttribute
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      true, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // leaves: Leaves (LeaveListAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=true, default=LeaveList.new)
  propertySet.addAttributeType(
    new AttributeDefinition(
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
    ),
  );

  // limits: Limits (LimitsAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "limits",
      "Limits",
      AttributeType.Limits,
      null, // Default null for LimitsAttribute
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      true, // inheritedFromParent
      true, // inheritedFromProject
    ),
  );

  // managers: Managers (ResourceListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "managers",
      "Managers",
      AttributeType.ResourceList,
      [], // Default empty array for ResourceListAttribute
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      true, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // rate: Rate (FloatAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=true, default=0.0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "rate",
      "Rate",
      AttributeType.Float,
      0.0,
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      true, // inheritedFromParent
      true, // inheritedFromProject
    ),
  );

  // reports: Reports (ResourceListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "reports",
      "Reports",
      AttributeType.ResourceList,
      [], // Default empty array for ResourceListAttribute
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
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

  // shifts: Shifts (ShiftAssignmentsAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "shifts",
      "Shifts",
      AttributeType.ShiftAssignments,
      null, // Default null for ShiftAssignmentsAttribute
      false, // userDefined
      false, // isList
      false, // isSingleton
      true, // isScenarioAttribute
      true, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );

  // workinghours: Working Hours (WorkingHoursAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
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
    ),
  );

  // tree: Tree Index (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(
    new AttributeDefinition(
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
    ),
  );

  // warn: Warning Condition (LogicalExpressionListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "warn",
      "Warning Condition",
      AttributeType.LogicalExpressionList,
      [], // Default empty array for LogicalExpressionListAttribute
      false, // userDefined
      false, // isList
      false, // isSingleton
      false, // isScenarioAttribute
      false, // inheritedFromParent
      false, // inheritedFromProject
    ),
  );
}
