import { PropertySet, } from "../property-set.ts";
import { AttributeDefinition, } from "../../attributes/attribute-definition.ts";
import { AttributeType, } from "../../attributes/attribute-type.ts";

/**
 * Registra os atributos específicos de report (35 atributos).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Report.rb
 */
export function registerReportAttributes(propertySet: PropertySet): void {
  // accountroot: Account Root (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "accountroot",
    "Account Root",
    AttributeType.String,
    "",
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // auxdir: Aux. Dir. (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "auxdir",
    "Aux. Dir.",
    AttributeType.String,
    "",
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

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

  // caption: Caption (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "caption",
    "Caption",
    AttributeType.String,
    "",
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // center: Center (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=0)
  propertySet.addAttributeType(new AttributeDefinition(
    "center",
    "Center",
    AttributeType.Integer,
    0,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // columns: Columns (ColumnListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "columns",
    "Columns",
    AttributeType.ColumnList,
    [], // Default empty array for ColumnListAttribute
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // costaccount: Cost Account (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "costaccount",
    "Cost Account",
    AttributeType.String,
    "",
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // currencyFormat: Currency Format (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "currencyFormat",
    "Currency Format",
    AttributeType.String,
    "",
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // definitions: Definitions (DefinitionListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "definitions",
    "Definitions",
    AttributeType.DefinitionList,
    [], // Default empty array for DefinitionListAttribute
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // end: End (DateAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "end",
    "End",
    AttributeType.Date,
    null, // Default null for DateAttribute
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // markdate: Mark Date (DateAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "markdate",
    "Mark Date",
    AttributeType.Date,
    null, // Default null for DateAttribute
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // epilog: Epilog (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "epilog",
    "Epilog",
    AttributeType.String,
    "",
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // flags: Flags (FlagListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "flags",
    "Flags",
    AttributeType.FlagList,
    [],
    false, false, false, false,
    false, false,
  ));

  // footer: Footer (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "footer",
    "Footer",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // formats: Formats (FormatListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "formats",
    "Formats",
    AttributeType.FormatList,
    [],
    false, false, false, false,
    false, false,
  ));

  // ganttBars: Gantt Bars (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "ganttBars",
    "Gantt Bars",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // header: Header (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "header",
    "Header",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // headline: Headline (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "headline",
    "Headline",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // hideAccount: Hide Account (BooleanAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "hideAccount",
    "Hide Account",
    AttributeType.Boolean,
    false,
    false, false, false, false,
    false, false,
  ));

  // hideJournalEntry: Hide Journal Entry (BooleanAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "hideJournalEntry",
    "Hide Journal Entry",
    AttributeType.Boolean,
    false,
    false, false, false, false,
    false, false,
  ));

  // hideResource: Hide Resource (BooleanAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "hideResource",
    "Hide Resource",
    AttributeType.Boolean,
    false,
    false, false, false, false,
    false, false,
  ));

  // hideTask: Hide Task (BooleanAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "hideTask",
    "Hide Task",
    AttributeType.Boolean,
    false,
    false, false, false, false,
    false, false,
  ));

  // height: Height (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=0)
  propertySet.addAttributeType(new AttributeDefinition(
    "height",
    "Height",
    AttributeType.Integer,
    0,
    false, false, false, false,
    false, false,
  ));

  // id: ID (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "id",
    "ID",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // index: Index (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=-1)
  propertySet.addAttributeType(new AttributeDefinition(
    "index",
    "Index",
    AttributeType.Integer,
    -1,
    false, false, false, false,
    false, false,
  ));

  // interactive: Interactive (BooleanAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "interactive",
    "Interactive",
    AttributeType.Boolean,
    false,
    false, false, false, false,
    false, false,
  ));

  // journalAttributes: Journal Attributes (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "journalAttributes",
    "Journal Attributes",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // journalMode: Journal Mode (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "journalMode",
    "Journal Mode",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // left: Left (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=0)
  propertySet.addAttributeType(new AttributeDefinition(
    "left",
    "Left",
    AttributeType.Integer,
    0,
    false, false, false, false,
    false, false,
  ));

  // loadUnit: Load Unit (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "loadUnit",
    "Load Unit",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // name: Name (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "name",
    "Name",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // now: Now (DateAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "now",
    "Now",
    AttributeType.Date,
    null,
    false, false, false, false,
    false, false,
  ));

  // numberFormat: Number Format (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "numberFormat",
    "Number Format",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // openNodes: Open Nodes (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "openNodes",
    "Open Nodes",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // prolog: Prolog (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "prolog",
    "Prolog",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // rawHtmlHead: Raw HTML Head (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "rawHtmlHead",
    "Raw HTML Head",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // resourceAttributes: Resource Attributes (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "resourceAttributes",
    "Resource Attributes",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // resourceroot: Resource Root (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "resourceroot",
    "Resource Root",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // revenueaccount: Revenue Account (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "revenueaccount",
    "Revenue Account",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // right: Right (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=0)
  propertySet.addAttributeType(new AttributeDefinition(
    "right",
    "Right",
    AttributeType.Integer,
    0,
    false, false, false, false,
    false, false,
  ));

  // rollupAccount: Rollup Account (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "rollupAccount",
    "Rollup Account",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // rollupResource: Rollup Resource (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "rollupResource",
    "Rollup Resource",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // rollupTask: Rollup Task (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "rollupTask",
    "Rollup Task",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // scenarios: Scenarios (ScenarioListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "scenarios",
    "Scenarios",
    AttributeType.ScenarioList,
    [],
    false, false, false, false,
    false, false,
  ));

  // selfcontained: Self Contained (BooleanAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "selfcontained",
    "Self Contained",
    AttributeType.Boolean,
    false,
    false, false, false, false,
    false, false,
  ));

  // seqno: Seqno (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=0)
  propertySet.addAttributeType(new AttributeDefinition(
    "seqno",
    "Seqno",
    AttributeType.Integer,
    0,
    false, false, false, false,
    false, false,
  ));

  // shortTimeFormat: Short Time Format (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "shortTimeFormat",
    "Short Time Format",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // sortAccounts: Sort Accounts (SortListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "sortAccounts",
    "Sort Accounts",
    AttributeType.SortList,
    [],
    false, false, false, false,
    false, false,
  ));

  // sortJournalEntries: Sort Journal Entries (SortListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "sortJournalEntries",
    "Sort Journal Entries",
    AttributeType.SortList,
    [],
    false, false, false, false,
    false, false,
  ));

  // sortResources: Sort Resources (SortListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "sortResources",
    "Sort Resources",
    AttributeType.SortList,
    [],
    false, false, false, false,
    false, false,
  ));

  // sortTasks: Sort Tasks (SortListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "sortTasks",
    "Sort Tasks",
    AttributeType.SortList,
    [],
    false, false, false, false,
    false, false,
  ));

  // start: Start (DateAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "start",
    "Start",
    AttributeType.Date,
    null,
    false, false, false, false,
    false, false,
  ));

  // taskAttributes: Task Attributes (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "taskAttributes",
    "Task Attributes",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // taskroot: Task Root (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "taskroot",
    "Task Root",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // timeFormat: Time Format (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "timeFormat",
    "Time Format",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // timeOffId: Time Off ID (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "timeOffId",
    "Time Off ID",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // timeOffName: Time Off Name (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "timeOffName",
    "Time Off Name",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // timezone: Time Zone (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "timezone",
    "Time Zone",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // title: Title (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "title",
    "Title",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // tree: Tree Index (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "tree",
    "Tree Index",
    AttributeType.String,
    "",
    false, false, false, false,
    false, false,
  ));

  // weekStartsMonday: Week Starts Monday (BooleanAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "weekStartsMonday",
    "Week Starts Monday",
    AttributeType.Boolean,
    false,
    false, false, false, false,
    false, false,
  ));

  // width: Width (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=0)
  propertySet.addAttributeType(new AttributeDefinition(
    "width",
    "Width",
    AttributeType.Integer,
    0,
    false, false, false, false,
    false, false,
  ));

  // novevents: No Events (BooleanAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "novevents",
    "No Events",
    AttributeType.Boolean,
    false,
    false, false, false, false,
    false, false,
  ));
}
