import { PropertySet, } from "../property-set.ts";
import { AttributeDefinition, } from "../../attributes/attribute-definition.ts";
import { AttributeType, } from "../../attributes/attribute-type.ts";

/**
 * Registra os atributos específicos de task (28 atributos).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Task.rb
 */
export function registerTaskAttributes(propertySet: PropertySet,): void {
  // allocate: Allocations (AllocationAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "allocate",
      "Allocations",
      AttributeType.Allocation,
      [],
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // assignedresources: Assigned Resources (ResourceListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "assignedresources",
      "Assigned Resources",
      AttributeType.ResourceList,
      [],
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // booking: Bookings (BookingListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "booking",
      "Bookings",
      AttributeType.BookingList,
      [],
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // charge: Charges (ChargeListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "charge",
      "Charges",
      AttributeType.ChargeList,
      [],
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // chargeset: Charge Sets (ChargeSetListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "chargeset",
      "Charge Sets",
      AttributeType.ChargeSetList,
      [],
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // complete: Completion (FloatAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "complete",
      "Completion",
      AttributeType.Float,
      null,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // competitors: Competitors (TaskListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "competitors",
      "Competitors",
      AttributeType.TaskList,
      [],
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // criticalness: Criticalness (FloatAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=0.0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "criticalness",
      "Criticalness",
      AttributeType.Float,
      0.0,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // depends: Preceding tasks (DependencyListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "depends",
      "Preceding tasks",
      AttributeType.DependencyList,
      [],
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // duration: Duration (DurationAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "duration",
      "Duration",
      AttributeType.Duration,
      0,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // effort: Effort (DurationAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "effort",
      "Effort",
      AttributeType.Duration,
      0,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // effortdone: Completed Effort (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "effortdone",
      "Completed Effort",
      AttributeType.Integer,
      null,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // effortleft: Remaining Effort (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "effortleft",
      "Remaining Effort",
      AttributeType.Integer,
      null,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // end: End (DateAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "end",
      "End",
      AttributeType.Date,
      null,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // endpreds: End Preds. (TaskDepListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "endpreds",
      "End Preds.",
      AttributeType.TaskDepList,
      [],
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // endsuccs: End Succs. (TaskDepListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "endsuccs",
      "End Succs.",
      AttributeType.TaskDepList,
      [],
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // fail: Failure Conditions (LogicalExpressionListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "fail",
      "Failure Conditions",
      AttributeType.LogicalExpressionList,
      [],
      false,
      false,
      false,
      false,
      false,
      false,
    ),
  );

  // flags: Flags (FlagListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "flags",
      "Flags",
      AttributeType.FlagList,
      [],
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // forward: Scheduling (BooleanAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=true)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "forward",
      "Scheduling",
      AttributeType.Boolean,
      true,
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // gauge: Schedule gauge (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "gauge",
      "Schedule gauge",
      AttributeType.String,
      null,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // bsi: BSI (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(
    new AttributeDefinition(
      "bsi",
      "BSI",
      AttributeType.String,
      "",
      false,
      false,
      false,
      false,
      false,
      false,
    ),
  );

  // id: ID (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "id",
      "ID",
      AttributeType.String,
      null,
      false,
      false,
      false,
      false,
      false,
      false,
    ),
  );

  // index: Index (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=-1)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "index",
      "Index",
      AttributeType.Integer,
      -1,
      false,
      false,
      false,
      false,
      false,
      false,
    ),
  );

  // name: Name (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "name",
      "Name",
      AttributeType.String,
      null,
      false,
      false,
      false,
      false,
      false,
      false,
    ),
  );

  // seqno: No (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "seqno",
      "No",
      AttributeType.Integer,
      null,
      false,
      false,
      false,
      false,
      false,
      false,
    ),
  );

  // length: Length (DurationAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "length",
      "Length",
      AttributeType.Duration,
      0,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // limits: Limits (LimitsAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "limits",
      "Limits",
      AttributeType.Limits,
      null,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // maxend: Max. End (DateAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "maxend",
      "Max. End",
      AttributeType.Date,
      null,
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // maxstart: Max. Start (DateAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "maxstart",
      "Max. Start",
      AttributeType.Date,
      null,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // milestone: Milestone (BooleanAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=false)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "milestone",
      "Milestone",
      AttributeType.Boolean,
      false,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // minend: Min. End (DateAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "minend",
      "Min. End",
      AttributeType.Date,
      null,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // minstart: Min. Start (DateAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "minstart",
      "Min. Start",
      AttributeType.Date,
      null,
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // note: Note (RichTextAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "note",
      "Note",
      AttributeType.RichText,
      null,
      false,
      false,
      false,
      false,
      false,
      false,
    ),
  );

  // pathcriticalness: Path Criticalness (FloatAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=0.0)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "pathcriticalness",
      "Path Criticalness",
      AttributeType.Float,
      0.0,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // precedes: Following tasks (DependencyListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "precedes",
      "Following tasks",
      AttributeType.DependencyList,
      [],
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // priority: Priority (IntegerAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=true, default=500)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "priority",
      "Priority",
      AttributeType.Integer,
      500,
      false,
      false,
      false,
      true,
      true,
      true,
    ),
  );

  // projectid: Project ID (SymbolAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "projectid",
      "Project ID",
      AttributeType.Symbol,
      null,
      false,
      false,
      false,
      true,
      true,
      true,
    ),
  );

  // responsible: Responsible (ResourceListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "responsible",
      "Responsible",
      AttributeType.ResourceList,
      [],
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // scheduled: Scheduled (BooleanAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=false)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "scheduled",
      "Scheduled",
      AttributeType.Boolean,
      false,
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // projectionmode: Projection Mode (BooleanAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=false)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "projectionmode",
      "Projection Mode",
      AttributeType.Boolean,
      false,
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // shifts: Shifts (ShiftAssignmentsAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "shifts",
      "Shifts",
      AttributeType.ShiftAssignments,
      null,
      false,
      false,
      false,
      true,
      true,
      false,
    ),
  );

  // start: Start (DateAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=nil)
  propertySet.addAttributeType(
    new AttributeDefinition(
      "start",
      "Start",
      AttributeType.Date,
      null,
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // startpreds: Start Preds. (TaskDepListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "startpreds",
      "Start Preds.",
      AttributeType.TaskDepList,
      [],
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // startsuccs: Start Succs. (TaskDepListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "startsuccs",
      "Start Succs.",
      AttributeType.TaskDepList,
      [],
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // status: Task Status (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=true, default="")
  propertySet.addAttributeType(
    new AttributeDefinition(
      "status",
      "Task Status",
      AttributeType.String,
      "",
      false,
      false,
      false,
      true,
      false,
      false,
    ),
  );

  // tree: Tree Index (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(
    new AttributeDefinition(
      "tree",
      "Tree Index",
      AttributeType.String,
      "",
      false,
      false,
      false,
      false,
      false,
      false,
    ),
  );

  // warn: Warning Condition (LogicalExpressionListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(
    new AttributeDefinition(
      "warn",
      "Warning Condition",
      AttributeType.LogicalExpressionList,
      [],
      false,
      false,
      false,
      false,
      false,
      false,
    ),
  );
}
