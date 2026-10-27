/**
 * Registro das regras de sintaxe TJP (port de TjpSyntaxRules.rb).
 *
 * O Ruby usa um mixin com ~300 métodos `rule_*`; aqui cada bloco de regras
 * é um módulo com função de registro (subfases 10.11–10.14). A ordem de
 * registro não importa — o FSM é compilado por `updateParserTables()`.
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
import { registerShiftRules, } from "./shift.ts";
import { registerScenarioRules, } from "./scenario.ts";
import { registerReportRules, } from "./report.ts";
import { registerTrackingRules, } from "./tracking.ts";
import { registerLogicRules, } from "./logic.ts";

/**
 * Registra todas as regras TJP no parser e recompila o FSM.
 * Chamado pelo construtor do ProjectFileParser via initRules().
 */
export function registerTjpRules(parser: ProjectFileParser,): void {
  registerCommonRules(parser,);
  registerProjectRules(parser,);
  registerTaskRules(parser,);
  registerJournalRules(parser,);
  registerResourceRules(parser,);
  registerAccountRules(parser,);
  registerMaterialRules(parser,);
  registerShiftRules(parser,);
  registerScenarioRules(parser,);
  registerReportRules(parser,);
  registerTrackingRules(parser,);
  registerLogicRules(parser,);
  // Durante as subfases 10.11–10.14 blocos ainda vazios deixam referências
  // pendentes; o sweep cobre o intervalo até o fecho. No estado final a
  // lista retorna vazia.
  ensurePlaceholders(parser,);
}
