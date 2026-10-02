import { PropertySet, } from "../property-set.ts";
import { AttributeDefinition, } from "../../attributes/attribute-definition.ts";
import { AttributeType, } from "../../attributes/attribute-type.ts";

/**
 * Registra os atributos específicos de report (63 atributos).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Report.rb
 */
export function registerReportAttributes(propertySet: PropertySet): void {
  // accountroot: Account Root (PropertyAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "accountroot",
    "Account Root",
    AttributeType.Property,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // auxdir: Aux. Dir. (StringAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default="")
  propertySet.addAttributeType(new AttributeDefinition(
    "auxdir",
    "Aux. Dir.",
    AttributeType.String,
    "",
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
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

  // caption: Caption (RichTextAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "caption",
    "Caption",
    AttributeType.RichText,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // center: Center (RichTextAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "center",
    "Center",
    AttributeType.RichText,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // columns: Columns (ColumnListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "columns",
    "Columns",
    AttributeType.ColumnList,
    [],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // costaccount: Cost Account (AccountAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "costaccount",
    "Cost Account",
    AttributeType.Account,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // currencyFormat: Currency Format (RealFormatAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "currencyFormat",
    "Currency Format",
    AttributeType.RealFormat,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // definitions: Definitions (DefinitionListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=['*'])
  propertySet.addAttributeType(new AttributeDefinition(
    "definitions",
    "Definitions",
    AttributeType.DefinitionList,
    ['*'],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // end: End (DateAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "end",
    "End",
    AttributeType.Date,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // markdate: Mark Date (DateAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "markdate",
    "Mark Date",
    AttributeType.Date,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // epilog: Epilog (RichTextAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "epilog",
    "Epilog",
    AttributeType.RichText,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // flags: Flags (FlagListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "flags",
    "Flags",
    AttributeType.FlagList,
    [],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // footer: Footer (RichTextAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "footer",
    "Footer",
    AttributeType.RichText,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // formats: Formats (FormatListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=[])
  propertySet.addAttributeType(new AttributeDefinition(
    "formats",
    "Formats",
    AttributeType.FormatList,
    [],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // ganttBars: Gantt Bars (BooleanAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=true)
  propertySet.addAttributeType(new AttributeDefinition(
    "ganttBars",
    "Gantt Bars",
    AttributeType.Boolean,
    true,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // header: Header (RichTextAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "header",
    "Header",
    AttributeType.RichText,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // headline: Headline (RichTextAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "headline",
    "Headline",
    AttributeType.RichText,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // hideAccount: Hide Account (LogicalExpressionAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "hideAccount",
    "Hide Account",
    AttributeType.LogicalExpression,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // hideJournalEntry: Hide Journal Entry (LogicalExpressionAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "hideJournalEntry",
    "Hide Journal Entry",
    AttributeType.LogicalExpression,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // hideResource: Hide Resource (LogicalExpressionAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "hideResource",
    "Hide Resource",
    AttributeType.LogicalExpression,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // hideTask: Hide Task (LogicalExpressionAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "hideTask",
    "Hide Task",
    AttributeType.LogicalExpression,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // height: Height (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=480)
  propertySet.addAttributeType(new AttributeDefinition(
    "height",
    "Height",
    AttributeType.Integer,
    480,
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

  // index: Index (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=-1)
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

  // interactive: Interactive (BooleanAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "interactive",
    "Interactive",
    AttributeType.Boolean,
    false,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // journalAttributes: Journal Attributes (SymbolListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=['*'])
  propertySet.addAttributeType(new AttributeDefinition(
    "journalAttributes",
    "Journal Attributes",
    AttributeType.SymbolList,
    ['*'],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // journalMode: Journal Mode (SymbolAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=:journal)
  propertySet.addAttributeType(new AttributeDefinition(
    "journalMode",
    "Journal Mode",
    AttributeType.Symbol,
    "journal",
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // left: Left (RichTextAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "left",
    "Left",
    AttributeType.RichText,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // loadUnit: Load Unit (StringAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "loadUnit",
    "Load Unit",
    AttributeType.String,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
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

  // now: Now (DateAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "now",
    "Now",
    AttributeType.Date,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // numberFormat: Number Format (RealFormatAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "numberFormat",
    "Number Format",
    AttributeType.RealFormat,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // openNodes: Open Nodes (NodeListAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "openNodes",
    "Open Nodes",
    AttributeType.NodeList,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // prolog: Prolog (RichTextAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "prolog",
    "Prolog",
    AttributeType.RichText,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // rawHtmlHead: Raw HTML Head (StringAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "rawHtmlHead",
    "Raw HTML Head",
    AttributeType.String,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // resourceAttributes: Resource Attributes (FormatListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=['*'])
  propertySet.addAttributeType(new AttributeDefinition(
    "resourceAttributes",
    "Resource Attributes",
    AttributeType.FormatList,
    ['*'],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // resourceroot: Resource Root (PropertyAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "resourceroot",
    "Resource Root",
    AttributeType.Property,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // revenueaccount: Revenue Account (AccountAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "revenueaccount",
    "Revenue Account",
    AttributeType.Account,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // right: Right (RichTextAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "right",
    "Right",
    AttributeType.RichText,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // rollupAccount: Rollup Account (LogicalExpressionAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "rollupAccount",
    "Rollup Account",
    AttributeType.LogicalExpression,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // rollupResource: Rollup Resource (LogicalExpressionAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "rollupResource",
    "Rollup Resource",
    AttributeType.LogicalExpression,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // rollupTask: Rollup Task (LogicalExpressionAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "rollupTask",
    "Rollup Task",
    AttributeType.LogicalExpression,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // scenarios: Scenarios (ScenarioListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=[0])
  propertySet.addAttributeType(new AttributeDefinition(
    "scenarios",
    "Scenarios",
    AttributeType.ScenarioList,
    [0],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // selfcontained: Self Contained (BooleanAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "selfcontained",
    "Self Contained",
    AttributeType.Boolean,
    false,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // seqno: Seqno (IntegerAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "seqno",
    "Seqno",
    AttributeType.Integer,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // shortTimeFormat: Short Time Format (StringAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "shortTimeFormat",
    "Short Time Format",
    AttributeType.String,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // sortAccounts: Sort Accounts (SortListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=[['seqno', true, -1]])
  propertySet.addAttributeType(new AttributeDefinition(
    "sortAccounts",
    "Sort Accounts",
    AttributeType.SortList,
    [['seqno', true, -1]],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // sortJournalEntries: Sort Journal Entries (JournalSortListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=[['alert', 1], ['date', 1], ['seqno', 1]])
  propertySet.addAttributeType(new AttributeDefinition(
    "sortJournalEntries",
    "Sort Journal Entries",
    AttributeType.JournalSortList,
    [['alert', 1], ['date', 1], ['seqno', 1]],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // sortResources: Sort Resources (SortListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=[['seqno', true, -1]])
  propertySet.addAttributeType(new AttributeDefinition(
    "sortResources",
    "Sort Resources",
    AttributeType.SortList,
    [['seqno', true, -1]],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // sortTasks: Sort Tasks (SortListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=[['seqno', true, -1]])
  propertySet.addAttributeType(new AttributeDefinition(
    "sortTasks",
    "Sort Tasks",
    AttributeType.SortList,
    [['seqno', true, -1]],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // start: Start (DateAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "start",
    "Start",
    AttributeType.Date,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // taskAttributes: Task Attributes (FormatListAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=['*'])
  propertySet.addAttributeType(new AttributeDefinition(
    "taskAttributes",
    "Task Attributes",
    AttributeType.FormatList,
    ['*'],
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // taskroot: Task Root (PropertyAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "taskroot",
    "Task Root",
    AttributeType.Property,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // timeFormat: Time Format (StringAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "timeFormat",
    "Time Format",
    AttributeType.String,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // timeOffId: Time Off ID (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "timeOffId",
    "Time Off ID",
    AttributeType.String,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // timeOffName: Time Off Name (StringAttribute, inheritedFromParent=false, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "timeOffName",
    "Time Off Name",
    AttributeType.String,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    false, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // timezone: Time Zone (StringAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=TjTime.getTimeZone())
  propertySet.addAttributeType(new AttributeDefinition(
    "timezone",
    "Time Zone",
    AttributeType.String,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // title: Title (StringAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=nil)
  propertySet.addAttributeType(new AttributeDefinition(
    "title",
    "Title",
    AttributeType.String,
    null,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
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

  // weekStartsMonday: Week Starts Monday (BooleanAttribute, inheritedFromParent=true, inheritedFromProject=true, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "weekStartsMonday",
    "Week Starts Monday",
    AttributeType.Boolean,
    false,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    true, // inheritedFromProject
  ));

  // width: Width (IntegerAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=640)
  propertySet.addAttributeType(new AttributeDefinition(
    "width",
    "Width",
    AttributeType.Integer,
    640,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));

  // novevents: No Events (BooleanAttribute, inheritedFromParent=true, inheritedFromProject=false, isScenarioAttribute=false, default=false)
  propertySet.addAttributeType(new AttributeDefinition(
    "novevents",
    "No Events",
    AttributeType.Boolean,
    false,
    false, // userDefined
    false, // isList
    false, // isSingleton
    false, // isScenarioAttribute
    true, // inheritedFromParent
    false, // inheritedFromProject
  ));
}
