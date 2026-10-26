/**
 * Metadados de colunas calculadas de TableReport (Fase 10).
 *
 * Extraído do mapa `@@propertiesById` de `reports/TableReport.rb`. Para o
 * parser só interessam duas consultas usadas pela validação de critérios de
 * ordenação (`sortNonTree`): a coluna é calculada? e é específica de
 * cenário? A construção real das colunas é da Fase 14.
 *
 * @see docs/taskjuggler/lib/taskjuggler/reports/TableReport.rb
 */

/** colId => [ header, indent, align, scenarioSpecific ] */
const PROPERTIES_BY_ID: Record<string, [string, boolean, string, boolean,]> = {
  activetasks: ["Active Tasks", true, "right", true,],
  annualleave: ["Annual Leave", true, "right", true,],
  annualleavebalance: ["Annual Leave Balance", false, "right", true,],
  annualleavelist: ["Annual Leave List", false, "left", true,],
  alert: ["Alert", true, "left", false,],
  alertmessages: ["Alert Messages", false, "left", false,],
  alertsummaries: ["Alert Summaries", false, "left", false,],
  alerttrend: ["Alert Trend", false, "left", false,],
  balance: ["Balance", true, "right", true,],
  bsi: ["BSI", false, "left", false,],
  children: ["Children", false, "left", false,],
  closedtasks: ["Closed Tasks", true, "right", true,],
  competitorcount: ["Competitor count", true, "right", true,],
  competitors: ["Competitors", true, "left", true,],
  complete: ["Completion", false, "right", true,],
  cost: ["Cost", true, "right", true,],
  duration: ["Duration", true, "right", true,],
  effort: ["Effort", true, "right", true,],
  effortdone: ["Effort Done", true, "right", true,],
  effortleft: ["Effort Left", true, "right", true,],
  freetime: ["Free Time", true, "right", true,],
  freework: ["Free Work", true, "right", true,],
  followers: ["Followers", false, "left", true,],
  fte: ["FTE", true, "right", true,],
  headcount: ["Headcount", true, "right", true,],
  id: ["Id", false, "left", false,],
  inputs: ["Inputs", false, "left", true,],
  journal: ["Journal", false, "left", false,],
  journal_sub: ["Journal", false, "left", false,],
  journalmessages: ["Journal Messages", false, "left", false,],
  journalsummaries: ["Journal Summaries", false, "left", false,],
  line: ["Line No.", false, "right", false,],
  name: ["Name", true, "left", false,],
  no: ["No.", false, "right", false,],
  opentasks: ["Open Tasks", true, "right", true,],
  precursors: ["Precursors", false, "left", true,],
  rate: ["Rate", true, "right", true,],
  resources: ["Resources", false, "left", true,],
  responsible: ["Responsible", false, "left", true,],
  revenue: ["Revenue", true, "right", true,],
  scenario: ["Scenario", false, "left", true,],
  scheduling: ["Scheduling Mode", true, "left", true,],
  sickleave: ["Sick Leave", true, "right", true,],
  specialleave: ["Special Leave", true, "right", true,],
  status: ["Status", false, "left", true,],
  targets: ["Targets", false, "left", true,],
  unpaidleave: ["Unpaid Leave", true, "right", true,],
};

/** Port de `TableReport::calculated?(colId)`. */
export function tableColumnCalculated(colId: string,): boolean {
  return Object.hasOwn(PROPERTIES_BY_ID, colId,);
}

/** Port de `TableReport::scenarioSpecific?(colId)`. */
export function tableColumnScenarioSpecific(colId: string,): boolean {
  return PROPERTIES_BY_ID[colId]?.[3] ?? false;
}
