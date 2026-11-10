/**
 * Registration of the TJP syntax rules (port of TjpSyntaxRules.rb).
 *
 * Ruby uses a mixin with ~300 `rule_*` methods; here each rules block is a
 * module with a registration function (sub-phases 10.11–10.14). Registration
 * order does not matter — the FSM is compiled by `updateParserTables()`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb
 */
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { ensurePlaceholders, } from "./helpers.ts";
import { registerCommonRules, } from "./common.ts";
import { registerProjectRules, } from "./project.ts";
import { registerTaskRules, } from "./task.ts";
import { registerJournalRules, } from "./journal.ts";
import { registerResourceRules, } from "./resource.ts";
import { registerAccountRules, } from "./account.ts";
import { registerMaterialRules, } from "./material.ts";
import { registerBookingRules, } from "./booking.ts";
import { registerShiftRules, } from "./shift.ts";
import { registerScenarioRules, } from "./scenario.ts";
import { registerReportRules, } from "./report.ts";
import { registerTrackingRules, } from "./tracking.ts";
import { registerLogicRules, } from "./logic.ts";

/**
 * Registers all TJP rules in the parser and recompiles the FSM.
 * Called by the ProjectFileParser constructor via initRules().
 */
export function registerTjpRules(parser: ProjectFileParser,): void {
  registerCommonRules(parser,);
  registerProjectRules(parser,);
  registerTaskRules(parser,);
  registerJournalRules(parser,);
  registerResourceRules(parser,);
  registerAccountRules(parser,);
  registerMaterialRules(parser,);
  registerBookingRules(parser,);
  registerShiftRules(parser,);
  registerScenarioRules(parser,);
  registerReportRules(parser,);
  registerTrackingRules(parser,);
  registerLogicRules(parser,);
  // During sub-phases 10.11–10.14 still-empty blocks leave dangling
  // references; the sweep covers the interval up to closure. In the final
  // state the list comes back empty.
  ensurePlaceholders(parser,);
}
