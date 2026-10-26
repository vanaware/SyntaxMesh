/**
 * TjpSyntaxRules — bloco 3: reports (subfase 10.13).
 *
 * Port do bloco `report*` / `*Report*` / `column*` / `export` / `iCal` /
 * `niku` / `tagfile` / `statusSheet` / `timeSheet` de `TjpSyntaxRules.rb`.
 *
 * Notas de port (Fase 10):
 * - As defaults de cabeçalho de relatório usam `newReport(..., defaultAttrs)`;
 *   `this.property` já aponta para o novo Report dentro do callback.
 * - Os atributos de RichText (caption/header/footer/...) guardam a String
 *   bruta: `newRichText` lança `NotYetImplementedError` até a Fase 12.
 * - `!logicalExpression`, `!flagLogicalExpression` e `!nodeIdList` são regras
 *   do bloco 4 (10.14); aqui ficam como placeholders resolvidos por
 *   `ensurePlaceholders`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb
 */
import { Report, } from "../../model/report.ts";
import { TjTime, } from "../../time/tj-time.ts";
import { RealFormat, } from "../../format/real-format.ts";
import { JournalEntry, } from "../../model/journal.ts";
import {
  LogicalExpression,
  LogicalOperation,
} from "../../logical/logical-expression.ts";
import {
  CellSettingPattern,
  TableColumnDefinition,
} from "../../reports/table-column-definition.ts";
import {
  tableColumnCalculated,
  tableColumnScenarioSpecific,
} from "../../reports/table-report-attributes.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { rule, } from "./helpers.ts";

const asProp = (parser: ProjectFileParser,): NonNullable<
  ProjectFileParser["property"]
> => parser.property!;

/** Atributos de RichText: guarda a String bruta (RichText chega na Fase 12). */
const richText = (parser: ProjectFileParser, idx: number,): string =>
  String(parser.val[idx],);

/** `LogicalExpression.new(LogicalOperation.new(op))` — default de hide/rollup. */
const logicOp = (op: number,): LogicalExpression =>
  new LogicalExpression(new LogicalOperation(op,),);

/** Lista de critérios de ordenação padrão (Ruby `[ [ 'x', bool, n ] ]`). */
type SortCriterion = [string, boolean, number,];

const JOURNAL_SORT_ATTRS = ["alert", "date", "seqno",];

/** Registra o bloco de regras de relatórios. */
export function registerReportRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // 10.13.1 — reports (agregador) + headers de tabela
  // ------------------------------------------------------------------
  rule(p, "reports", () => {
    p.pattern(["!accountReport",],);
    p.pattern(["!export",],);
    p.pattern(["!resourceReport",],);
    p.pattern(["!taskReport",],);
    p.pattern(["!textReport",],);
    p.pattern(["!traceReport",],);
  },);

  rule(p, "taskReport", () => {
    p.pattern(["!taskReportHeader", "!reportBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = asProp(this,).parent;
      return null;
    },);
    p.example("HtmlTaskReport",);
  },);

  rule(p, "taskReportHeader", () => {
    p.pattern(
      ["_taskreport", "!optionalID", "!reportName",],
      function (this: ProjectFileParser,): unknown {
        this.newReport(
          this.val[1] as string | null,
          String(this.val[2],),
          "taskreport",
          this.sourceFileInfo[0] ?? null,
          function (this: ProjectFileParser,): void {
            const rep = asProp(this,);
            if (!rep.modified("columns",)) {
              const cols =
                (rep.get("columns",) as TableColumnDefinition[] | null) ?? [];
              for (
                const col of ["bsi", "name", "start", "end", "effort", "chart",]
              ) {
                cols.push(
                  new TableColumnDefinition(col, this.columnTitle(col,),),
                );
              }
              rep.set("columns", cols,);
            }
            if (!rep.modified("hideTask",)) {
              rep.set("hideTask", logicOp(0,),);
            }
            if (!rep.modified("sortTasks",)) {
              rep.set("sortTasks", [
                ["tree", true, -1,],
                ["start", true, 0,],
                ["seqno", true, -1,],
              ] as SortCriterion[],);
            }
            if (!rep.modified("hideResource",)) {
              rep.set("hideResource", logicOp(1,),);
            }
            if (!rep.modified("sortResources",)) {
              rep.set(
                "sortResources",
                [["id", true, -1,],] as SortCriterion[],
              );
            }
          },
        );
        return null;
      },
    );
  },);

  rule(p, "resourceReport", () => {
    p.pattern(["!resourceReportHeader", "!reportBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = asProp(this,).parent;
      return null;
    },);
  },);

  rule(p, "resourceReportHeader", () => {
    p.pattern(
      ["_resourcereport", "!optionalID", "!reportName",],
      function (this: ProjectFileParser,): unknown {
        this.newReport(
          this.val[1] as string | null,
          String(this.val[2],),
          "resourcereport",
          this.sourceFileInfo[0] ?? null,
          function (this: ProjectFileParser,): void {
            const rep = asProp(this,);
            if (!rep.modified("columns",)) {
              const cols =
                (rep.get("columns",) as TableColumnDefinition[] | null) ?? [];
              for (const col of ["no", "name",]) {
                cols.push(
                  new TableColumnDefinition(col, this.columnTitle(col,),),
                );
              }
              rep.set("columns", cols,);
            }
            if (!rep.modified("hideResource",)) {
              rep.set("hideResource", logicOp(0,),);
            }
            if (!rep.modified("sortResources",)) {
              rep.set("sortResources", [
                ["tree", true, -1,],
                ["id", true, -1,],
              ] as SortCriterion[],);
            }
            if (!rep.modified("hideTask",)) {
              rep.set("hideTask", logicOp(1,),);
            }
            if (!rep.modified("sortTasks",)) {
              rep.set("sortTasks", [
                ["tree", true, -1,],
                ["start", true, 0,],
                ["seqno", true, -1,],
              ] as SortCriterion[],);
            }
          },
        );
        return null;
      },
    );
  },);

  rule(p, "accountReport", () => {
    p.pattern(["!accountReportHeader", "!reportBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = asProp(this,).parent;
      return null;
    },);
    p.level("beta",);
    p.example("AccountReport",);
  },);

  rule(p, "accountReportHeader", () => {
    p.pattern(
      ["_accountreport", "!optionalID", "!reportName",],
      function (this: ProjectFileParser,): unknown {
        this.newReport(
          this.val[1] as string | null,
          String(this.val[2],),
          "accountreport",
          this.sourceFileInfo[0] ?? null,
          function (this: ProjectFileParser,): void {
            const rep = asProp(this,);
            if (!rep.modified("columns",)) {
              const cols =
                (rep.get("columns",) as TableColumnDefinition[] | null) ?? [];
              for (const col of ["bsi", "name", "monthly",]) {
                cols.push(
                  new TableColumnDefinition(col, this.columnTitle(col,),),
                );
              }
              rep.set("columns", cols,);
            }
            if (!rep.modified("hideAccount",)) {
              rep.set("hideAccount", logicOp(0,),);
            }
            if (!rep.modified("sortAccounts",)) {
              rep.set("sortAccounts", [
                ["tree", true, -1,],
                ["seqno", true, -1,],
              ] as SortCriterion[],);
            }
          },
        );
        return null;
      },
    );
  },);

  rule(p, "textReport", () => {
    p.pattern(["!textReportHeader", "!reportBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = asProp(this,).parent;
      return null;
    },);
    p.example("textreport",);
  },);

  rule(p, "textReportHeader", () => {
    p.pattern(
      ["_textreport", "!optionalID", "!reportName",],
      function (this: ProjectFileParser,): unknown {
        this.newReport(
          this.val[1] as string | null,
          String(this.val[2],),
          "textreport",
          this.sourceFileInfo[0] ?? null,
        );
        return null;
      },
    );
  },);

  rule(p, "traceReport", () => {
    p.pattern(["!traceReportHeader", "!reportBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = asProp(this,).parent;
      return null;
    },);
    p.example("TraceReport",);
  },);

  rule(p, "traceReportHeader", () => {
    p.pattern(
      ["_tracereport", "!optionalID", "!reportName",],
      function (this: ProjectFileParser,): unknown {
        this.newReport(
          this.val[1] as string | null,
          String(this.val[2],),
          "tracereport",
          this.sourceFileInfo[0] ?? null,
          function (this: ProjectFileParser,): void {
            const rep = asProp(this,);
            if (
              (rep.level === 0 && !rep.provided("timeFormat",)) ||
              (rep.level > 0 && !rep.modified("timeFormat",))
            ) {
              rep.set("timeFormat", "%Y-%m-%d-%H:%M",);
            }
            if (!rep.modified("columns",)) {
              const cols =
                (rep.get("columns",) as TableColumnDefinition[] | null) ?? [];
              cols.push(
                new TableColumnDefinition("end", this.columnTitle("end",),),
              );
              rep.set("columns", cols,);
            }
            if (!rep.modified("hideAccount",)) {
              rep.set("hideAccount", logicOp(1,),);
            }
            if (!rep.modified("sortAccounts",)) {
              rep.set("sortAccounts", [
                ["tree", true, -1,],
                ["seqno", true, -1,],
              ] as SortCriterion[],);
            }
            if (!rep.modified("hideTask",)) {
              rep.set("hideTask", logicOp(0,),);
            }
            if (!rep.modified("sortTasks",)) {
              rep.set("sortTasks", [
                ["tree", true, -1,],
                ["start", true, 0,],
                ["seqno", true, -1,],
              ] as SortCriterion[],);
            }
            if (!rep.modified("hideResource",)) {
              rep.set("hideResource", logicOp(1,),);
            }
            if (!rep.modified("sortResources",)) {
              rep.set(
                "sortResources",
                [["id", true, -1,],] as SortCriterion[],
              );
            }
          },
        );
        return null;
      },
    );
  },);

  // ------------------------------------------------------------------
  // 10.13.2 — body + atributos comuns
  // ------------------------------------------------------------------
  rule(p, "reportBody", () => {
    p.optionsRule("reportAttributes",);
  },);

  rule(p, "reportId", () => {
    p.pattern(["!reportIdUnverifd",], function (
      this: ProjectFileParser,
    ): unknown {
      let id = String(this.val[0],);
      const prop = this.property;
      if (prop && prop instanceof Report) {
        id = prop.fullId + "." + id;
      } else if (this.reportprefix !== "") {
        id = this.reportprefix + "." + id;
      }
      const report = this.project!.report(id,);
      if (!report) {
        this.error(
          "report_id_expected",
          `${id} is not a defined report.`,
          this.sourceFileInfo[0] ?? null,
        );
      }
      return report;
    },);
    p.arg(0, "report", "The ID of a defined report",);
  },);

  rule(p, "reportIdUnverifd", () => {
    p.singlePattern("$ABSOLUTE_ID",);
    p.singlePattern("$ID",);
  },);

  rule(p, "reportName", () => {
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      return this.val[0];
    },);
  },);

  rule(p, "reportEnd", () => {
    p.pattern(["_end", "!date",], function (this: ProjectFileParser,): unknown {
      const prop = asProp(this,);
      const end = this.val[1] as TjTime;
      if (end.compareTo(prop.get("start",) as TjTime,) < 0) {
        this.error(
          "report_end",
          `End date must be before start date ${String(prop.get("start",),)}`,
          this.sourceFileInfo[1] ?? null,
        );
      }
      prop.set("end", end,);
      return null;
    },);
    p.example("Export", "2",);
  },);

  rule(p, "reportStart", () => {
    p.pattern(["_start", "!date",], function (
      this: ProjectFileParser,
    ): unknown {
      const prop = asProp(this,);
      const start = this.val[1] as TjTime;
      if (start.compareTo(prop.get("end",) as TjTime,) > 0) {
        this.error(
          "report_start",
          `Start date must be before end date ${String(prop.get("end",),)}`,
          this.sourceFileInfo[1] ?? null,
        );
      }
      prop.set("start", start,);
      return null;
    },);
  },);

  rule(p, "reportPeriod", () => {
    p.pattern(["_period", "!interval",], function (
      this: ProjectFileParser,
    ): unknown {
      const interval = this.val[1] as { start: TjTime; end: TjTime } | null;
      if (!interval) return null;
      asProp(this,).set("start", interval.start,);
      asProp(this,).set("end", interval.end,);
      return null;
    },);
  },);

  rule(p, "reportTitle", () => {
    p.pattern(["_title", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("title", this.val[1],);
      return null;
    },);
  },);

  rule(p, "headline", () => {
    p.pattern(["_headline", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("headline", richText(this, 1,),);
      return null;
    },);
  },);

  rule(p, "reportAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(
      ["_accountroot", "!accountId",],
      function (this: ProjectFileParser,): unknown {
        const account = this.val[1] as { leaf(): boolean; fullId: string };
        if (account.leaf()) {
          this.error(
            "accountroot_leaf",
            `${account.fullId} is not a container account`,
            this.sourceFileInfo[1] ?? null,
          );
        }
        asProp(this,).set("accountroot", this.val[1],);
        return null;
      },
    );
    p.example("AccountReport",);

    p.pattern(["_auxdir", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      let auxdir = String(this.val[1],);
      if (!auxdir.endsWith("/",)) auxdir += "/";
      asProp(this,).set("auxdir", auxdir,);
      return null;
    },);
    p.level("beta",);

    p.pattern(["!balance",], function (this: ProjectFileParser,): unknown {
      const pair = this.val[0] as [unknown, unknown,];
      asProp(this,).set("costaccount", pair[0],);
      asProp(this,).set("revenueaccount", pair[1],);
      return null;
    },);

    p.pattern(["_caption", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("caption", richText(this, 1,),);
      return null;
    },);
    p.arg(1, "text", "The caption text.",);
    p.example("Caption", "1",);

    p.pattern(["_center", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("center", richText(this, 1,),);
      return null;
    },);
    p.arg(1, "text", "The text",);
    p.example("textreport",);

    p.pattern(
      ["_columns", "!columnDef", "!moreColumnDef",],
      function (this: ProjectFileParser,): unknown {
        const columns = [this.val[1],];
        if (this.val[2]) columns.push(...(this.val[2] as unknown[]),);
        asProp(this,).set("columns", columns,);
        return null;
      },
    );

    p.pattern(["!currencyFormat",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("currencyFormat", this.val[0],);
      return null;
    },);

    p.pattern(["!reportEnd",],);

    p.pattern(["_epilog", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("epilog", richText(this, 1,),);
      return null;
    },);
    p.also(["footer", "header", "prolog",],);

    p.pattern(["!flags",],);

    p.pattern(["_footer", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("footer", richText(this, 1,),);
      return null;
    },);
    p.example("textreport",);
    p.also(["epilog", "header", "prolog",],);

    p.pattern(["!formats",],);

    p.pattern(["_header", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("header", richText(this, 1,),);
      return null;
    },);
    p.example("textreport",);
    p.also(["epilog", "footer", "prolog",],);

    p.pattern(["!headline",],);
    p.pattern(["!hidejournalentry",],);
    p.pattern(["!hideaccount",],);
    p.pattern(["!hideresource",],);
    p.pattern(["!hidetask",],);

    p.pattern(["_height", "$INTEGER",], function (
      this: ProjectFileParser,
    ): unknown {
      const h = Number(this.val[1],);
      if (h < 200) {
        this.error(
          "min_report_height",
          "The report must have a minimum height of 200 pixels.",
        );
      }
      asProp(this,).set("height", h,);
      return null;
    },);
    p.also("width",);

    p.pattern(["!journalReportAttributes",],);
    p.pattern(["_journalmode", "!journalReportMode",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("journalMode", this.val[1],);
      return null;
    },);

    p.pattern(["_left", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("left", richText(this, 1,),);
      return null;
    },);
    p.example("textreport",);

    p.pattern(["!loadunit",],);

    p.pattern(["!numberFormat",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("numberFormat", this.val[0],);
      return null;
    },);

    p.pattern(["_opennodes", "!nodeIdList",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("openNodes", this.val[1],);
      return null;
    },);
    p.doc("opennodes", "For internal use only!",);

    p.pattern(["!reportPeriod",],);

    p.pattern(["_prolog", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("prolog", richText(this, 1,),);
      return null;
    },);
    p.also(["epilog", "footer", "header",],);

    p.pattern(["!purge",],);

    p.pattern(["_rawhtmlhead", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("rawHtmlHead", this.val[1],);
      return null;
    },);

    p.pattern(["!reports",],);

    p.pattern(["_right", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("right", richText(this, 1,),);
      return null;
    },);
    p.example("textreport",);

    p.pattern(["!rollupaccount",],);
    p.pattern(["!rollupresource",],);
    p.pattern(["!rolluptask",],);

    p.pattern(["_scenarios", "!scenarioIdList",], function (
      this: ProjectFileParser,
    ): unknown {
      const list = this.val[1] as number[];
      const project = this.project!;
      const filtered = list.filter((sc,) =>
        Boolean(project.scenario(sc,)?.get("active",),)
      );
      asProp(this,).set("scenarios", filtered,);
      return null;
    },);

    p.pattern(["_selfcontained", "!yesNo",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("selfcontained", this.val[1],);
      return null;
    },);

    p.pattern(["!sortAccounts",],);
    p.pattern(["!sortJournalEntries",],);
    p.pattern(["!sortResources",],);
    p.pattern(["!sortTasks",],);

    p.pattern(["!reportStart",],);

    p.pattern(["_resourceroot", "!resourceId",], function (
      this: ProjectFileParser,
    ): unknown {
      const resource = this.val[1] as { leaf(): boolean; fullId: string };
      if (resource.leaf()) {
        this.error(
          "resourceroot_leaf",
          `${resource.fullId} is not a group resource`,
          this.sourceFileInfo[1] ?? null,
        );
      }
      asProp(this,).set("resourceroot", this.val[1],);
      return null;
    },);
    p.example("ResourceRoot",);

    p.pattern(["_taskroot", "!taskId",], function (
      this: ProjectFileParser,
    ): unknown {
      const task = this.val[1] as { leaf(): boolean; fullId: string };
      if (task.leaf()) {
        this.error(
          "taskroot_leaf",
          `${task.fullId} is not a container task`,
          this.sourceFileInfo[1] ?? null,
        );
      }
      asProp(this,).set("taskroot", this.val[1],);
      return null;
    },);
    p.example("TaskRoot",);

    p.pattern(["!timeformat",], function (this: ProjectFileParser,): unknown {
      asProp(this,).set("timeFormat", this.val[0],);
      return null;
    },);

    p.pattern(["_timezone", "!validTimeZone",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("timezone", this.val[1],);
      return null;
    },);

    p.pattern(["!reportTitle",],);

    p.pattern(["_width", "$INTEGER",], function (
      this: ProjectFileParser,
    ): unknown {
      const w = Number(this.val[1],);
      if (w < 400) {
        this.error(
          "min_report_width",
          "The report must have a minimum width of 400 pixels.",
        );
      }
      asProp(this,).set("width", w,);
      return null;
    },);
    p.also("height",);
  },);

  // ------------------------------------------------------------------
  // 10.13.2.2/3 — hide / rollup (task já vive em task.ts)
  // ------------------------------------------------------------------
  rule(p, "hideresource", () => {
    p.pattern(["_hideresource", "!logicalExpression",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("hideResource", this.val[1],);
      return null;
    },);
    p.also(["sortresources",],);
  },);

  rule(p, "hideaccount", () => {
    p.pattern(["_hideaccount", "!logicalExpression",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("hideAccount", this.val[1],);
      return null;
    },);
    p.also(["sortaccounts",],);
  },);

  rule(p, "rollupresource", () => {
    p.pattern(["_rollupresource", "!logicalExpression",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("rollupResource", this.val[1],);
      return null;
    },);
    p.example("RollupResource",);
  },);

  rule(p, "rollupaccount", () => {
    p.pattern(["_rollupaccount", "!logicalExpression",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("rollupAccount", this.val[1],);
      return null;
    },);
  },);

  // ------------------------------------------------------------------
  // 10.13.2.4 — ordenação
  // ------------------------------------------------------------------
  rule(p, "sortResources", () => {
    p.pattern(["!sortResourcesKeyword", "!sortCriteria",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("sortResources", this.val[1],);
      return null;
    },);
  },);

  rule(p, "sortAccounts", () => {
    p.pattern(["!sortAccountsKeyword", "!sortCriteria",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("sortAccounts", this.val[1],);
      return null;
    },);
  },);

  rule(p, "sortResourcesKeyword", () => {
    p.pattern(["_sortresources",], function (
      this: ProjectFileParser,
    ): unknown {
      this.sortProperty = ["resource",];
      return null;
    },);
  },);

  rule(p, "sortAccountsKeyword", () => {
    p.pattern(["_sortaccounts",], function (
      this: ProjectFileParser,
    ): unknown {
      this.sortProperty = ["account",];
      return null;
    },);
  },);

  rule(p, "sortCriteria", () => {
    p.pattern(["!sortCriterium", "!moreSortCriteria",], function (
      this: ProjectFileParser,
    ): unknown {
      const rest = this.val[1] as SortCriterion[] | null;
      return [this.val[0] as SortCriterion,].concat(rest ?? [],);
    },);
  },);

  rule(p, "moreSortCriteria", () => {
    p.commaListRule("!sortNonTree",);
  },);

  rule(p, "sortCriterium", () => {
    p.pattern(["!sortTree",], function (this: ProjectFileParser,): unknown {
      return this.val[0];
    },);
    p.pattern(["!sortNonTree",], function (this: ProjectFileParser,): unknown {
      return this.val[0];
    },);
  },);

  rule(p, "sortTree", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      if (String(this.val[0],) !== "tree") {
        this.error(
          "sorting_crit_exptd2",
          "Sorting criterium expected (e.g. tree, start.up or " +
            "plan.end.down).",
          this.sourceFileInfo[0] ?? null,
        );
      }
      return ["tree", true, -1,] as SortCriterion;
    },);
    p.arg(
      0,
      "tree",
      "Use 'tree' as first criteria to keep the breakdown structure.",
    );
  },);

  rule(p, "sortNonTree", () => {
    p.pattern(["$ABSOLUTE_ID",], function (
      this: ProjectFileParser,
    ): unknown {
      const args = String(this.val[0],).split(".",);
      let scenario = -1;
      let direction = false;
      let attribute = "";
      if (args.length === 2) {
        if (args[1] !== "up" && args[1] !== "down") {
          this.error(
            "sort_direction",
            "Sorting direction must be 'up' or 'down'",
            this.sourceFileInfo[0] ?? null,
          );
        }
        scenario = -1;
        direction = args[1] === "up";
        attribute = args[0]!;
      } else if (args.length === 3) {
        const idx = this.project!.scenarioIdx(args[0]!,);
        if (idx === undefined) {
          this.error(
            "sort_unknown_scen",
            `Unknown scenario ${args[0]} in sorting criterium`,
            this.sourceFileInfo[0] ?? null,
          );
        }
        scenario = idx ?? -1;
        attribute = args[1]!;
        if (args[2] !== "up" && args[2] !== "down") {
          this.error(
            "sort_direction",
            "Sorting direction must be 'up' or 'down'",
            this.sourceFileInfo[0] ?? null,
          );
        }
        direction = args[2] === "up";
      } else {
        this.error(
          "sorting_crit_exptd1",
          "Sorting criterium expected (e.g. tree, start.up or " +
            "plan.end.down).",
          this.sourceFileInfo[0] ?? null,
        );
      }
      if (attribute === "bsi") {
        this.error(
          "sorting_bsi",
          "Sorting by bsi is not supported. Please use 'tree' " +
            "(without appended .up or .down) instead.",
          this.sourceFileInfo[0] ?? null,
        );
      }
      const kind = this.sortProperty?.[0];
      const project = this.project!;
      const ps = kind === "account" ?
        project.accounts
        : kind === "resource" ?
        project.resources
        : project.tasks;
      if (
        !ps.knownAttribute(attribute,) && !tableColumnCalculated(attribute,)
      ) {
        this.error(
          "sorting_unknown_attr",
          `Sorting criterium '${attribute} is not a known attribute.`,
        );
      }
      const scenSpecific = ps.scenarioSpecific?.(attribute,) ||
        tableColumnScenarioSpecific(attribute,);
      if (scenario > 0 && !scenSpecific) {
        this.error(
          "sorting_attr_scen_spec",
          `Sorting criterium '${attribute}' is not scenario specific but ` +
            "a scenario has been specified.",
        );
      } else if (scenario === -1 && scenSpecific) {
        scenario = 0;
      }
      return [attribute, direction, scenario,] as SortCriterion;
    },);
  },);

  // ------------------------------------------------------------------
  // 10.13.2.5 — ordenação de journal entries
  // ------------------------------------------------------------------
  rule(p, "sortJournalEntries", () => {
    p.pattern(["_sortjournalentries", "!journalSortCriteria",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("sortJournalEntries", this.val[1],);
      return null;
    },);
  },);

  rule(p, "journalSortCriteria", () => {
    p.pattern(
      ["!journalSortCriterium", "!moreJournalSortCriteria",],
      function (this: ProjectFileParser,): unknown {
        const rest = this.val[1] as unknown[] | null;
        return [this.val[0],].concat(rest ?? [],);
      },
    );
  },);

  rule(p, "moreJournalSortCriteria", () => {
    p.commaListRule("!journalSortCriterium",);
  },);

  rule(p, "journalSortCriterium", () => {
    p.pattern(["$ABSOLUTE_ID",], function (
      this: ProjectFileParser,
    ): unknown {
      const supported: string[] = [];
      for (const attr of JOURNAL_SORT_ATTRS) {
        supported.push(attr + ".up",);
        supported.push(attr + ".down",);
      }
      const value = String(this.val[0],);
      if (!supported.includes(value,)) {
        this.error(
          "bad_journal_sort_criterium",
          `Unsupported sorting criterium ${value}. Must be one of ` +
            supported.join(", ",),
        );
      }
      const [attr, direction,] = value.split(".",);
      return [attr, direction === "up" ? 1 : -1,];
    },);
  },);

  // ------------------------------------------------------------------
  // 10.13.2.10 — journal report attributes / mode
  // ------------------------------------------------------------------
  rule(p, "journalReportAttributes", () => {
    p.pattern(
      ["_journalattributes", "!journalReportAttributesList",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set("journalAttributes", this.val[1],);
        return null;
      },
    );
    p.allOrNothingListRule("journalReportAttributesList", {
      alert: "Include the alert status",
      author: "Include the author if known",
      date: "Include the date",
      details: "Include the details",
      flags: "Include the flags",
      headline: "Include the headline",
      property: "Include the task or resource name",
      propertyid: "Include the property ID. Requires 'property'.",
      summary: "Include the summary",
      timesheet: "Include the timesheet information. Requires 'property'.",
    },);
  },);

  rule(p, "journalReportMode", () => {
    p.pattern(["_journal",], () => "journal",);
    p.pattern(["_journal_sub",], () => "journal_sub",);
    p.pattern(["_status_dep",], () => "status_dep",);
    p.pattern(["_status_down",], () => "status_down",);
    p.pattern(["_status_up",], () => "status_up",);
    p.pattern(["_alerts_dep",], () => "alerts_dep",);
    p.pattern(["_alerts_down",], () => "alerts_down",);
  },);

  // ------------------------------------------------------------------
  // Suporte: formats / outputFormats / loadunit / balance
  // ------------------------------------------------------------------
  rule(p, "formats", () => {
    p.pattern(["_formats", "!outputFormats",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("formats", this.val[1],);
      return null;
    },);
    p.doc(
      "formats",
      "This attribute defines for which output formats the report should be " +
        "generated.",
    );
  },);

  rule(p, "outputFormats", () => {
    p.pattern(["!outputFormat", "!moreOutputFormats",], function (
      this: ProjectFileParser,
    ): unknown {
      const rest = this.val[1] as unknown[] | null;
      return [this.val[0],].concat(rest ?? [],);
    },);
  },);

  rule(p, "moreOutputFormats", () => {
    p.commaListRule("!outputFormat",);
  },);

  rule(p, "outputFormat", () => {
    p.pattern(["_csv",], () => "csv",);
    p.pattern(["_html",], () => "html",);
    p.descr("Generate a web page (HTML file)",);
    p.pattern(["_niku",], () => "niku",);
    p.descr("Generate an XOG XML file to be used with Clarity.",);
  },);

  rule(p, "loadunit", () => {
    p.pattern(["_loadunit", "!loadunitName",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("loadUnit", this.val[1],);
      return null;
    },);
  },);

  rule(p, "loadunitName", () => {
    p.pattern(["_days",], () => "days",);
    p.descr("Display all load and duration values as days.",);
    p.pattern(["_hours",], () => "hours",);
    p.descr("Display all load and duration values as hours.",);
    p.pattern(["_longauto",], () => "longauto",);
    p.pattern(["_minutes",], () => "minutes",);
    p.descr("Display all load and duration values as minutes.",);
    p.pattern(["_months",], () => "months",);
    p.descr("Display all load and duration values as months.",);
    p.pattern(["_quarters",], () => "quarters",);
    p.descr("Display all load and duration values as quarters.",);
    p.pattern(["_shortauto",], () => "shortauto",);
    p.pattern(["_weeks",], () => "weeks",);
    p.descr("Display all load and duration values as weeks.",);
    p.pattern(["_years",], () => "years",);
    p.descr("Display all load and duration values as years.",);
  },);

  rule(p, "balance", () => {
    p.pattern(["_balance", "!balanceAccounts",], function (
      this: ProjectFileParser,
    ): unknown {
      return this.val[1];
    },);
    p.doc(
      "balance",
      "Designates two top-level accounts for a profit-loss analysis.",
    );
    p.example("AccountReport",);
  },);

  rule(p, "balanceAccounts", () => {
    p.pattern(
      ["!accountId", "!accountId",],
      function (this: ProjectFileParser,): unknown {
        const cost = this.val[0] as { parent: unknown; fullId: string };
        const rev = this.val[1] as { parent: unknown; fullId: string };
        if (cost.parent) {
          this.error(
            "cost_acct_no_top",
            `The cost account ${cost.fullId} is not a top-level account.`,
            this.sourceFileInfo[0] ?? null,
          );
        }
        if (rev.parent) {
          this.error(
            "rev_acct_no_top",
            `The revenue account ${rev.fullId} is not a top-level account.`,
            this.sourceFileInfo[1] ?? null,
          );
        }
        if (cost === rev) {
          this.error(
            "cost_rev_same",
            "The cost and revenue accounts may not be the same.",
            this.sourceFileInfo[0] ?? null,
          );
        }
        return [cost, rev,];
      },
    );
    // Uma '-' limpa um balance previamente definido.
    p.pattern(["_-",], () => [null, null,],);
  },);

  // ------------------------------------------------------------------
  // 10.13.1.6 — export
  // ------------------------------------------------------------------
  rule(p, "export", () => {
    p.pattern(["!exportHeader", "!exportBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = asProp(this,).parent;
      return null;
    },);
    p.example("Export",);
  },);

  rule(p, "exportHeader", () => {
    p.pattern(
      ["_export", "!optionalID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        this.newReport(
          this.val[1] as string | null,
          String(this.val[2],),
          "export",
          this.sourceFileInfo[0] ?? null,
          function (this: ProjectFileParser,): void {
            const rep = asProp(this,);
            const project = this.project!;
            if (!rep.modified("formats",)) {
              rep.set("formats", ["tjp",],);
            }
            if (!rep.modified("scenarios",)) {
              const all: number[] = [];
              for (let i = 0; i < project.scenarioCount; i++) {
                if (project.scenario(i,)?.get("active",)) all.push(i,);
              }
              rep.set("scenarios", all,);
            }
            if (!rep.modified("hideTask",)) {
              rep.set("hideTask", logicOp(0,),);
            }
            if (!rep.modified("sortTasks",)) {
              rep.set("sortTasks", [["seqno", true, -1,],] as SortCriterion[],);
            }
            if (!rep.modified("hideResource",)) {
              rep.set("hideResource", logicOp(0,),);
            }
            if (!rep.modified("sortResources",)) {
              rep.set(
                "sortResources",
                [["seqno", true, -1,],] as SortCriterion[],
              );
            }
          },
        );
        return null;
      },
    );
  },);

  rule(p, "exportBody", () => {
    p.optionsRule("exportAttributes",);
  },);

  rule(p, "exportAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(["_definitions", "!exportDefinitions",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("definitions", this.val[1],);
      return null;
    },);
    p.allOrNothingListRule("exportDefinitions", {
      flags: "Include flag definitions",
      project: "Include project header",
      projecids: "Include project IDs",
      tasks: "Include task definitions",
      resources: "Include resource definitions",
    },);

    p.pattern(["_formats", "!exportFormats",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("formats", this.val[1],);
      return null;
    },);
    p.level("beta",);

    p.pattern(["!hideresource",],);
    p.pattern(["!hidetask",],);
    p.pattern(["!loadunit",],);
    p.pattern(["!purge",],);
    p.pattern(["!reportEnd",],);
    p.pattern(["!reportPeriod",],);
    p.pattern(["!reports",],);
    p.pattern(["!reportStart",],);

    p.pattern(
      ["_resourceattributes", "!exportableResourceAttributes",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set("resourceAttributes", this.val[1],);
        return null;
      },
    );
    p.allOrNothingListRule("exportableResourceAttributes", {
      booking: "Include bookings",
      leaves: "Include leaves",
      workinghours: "Include working hours",
    },);

    p.pattern(["!rollupresource",],);
    p.pattern(["!rolluptask",],);

    p.pattern(["_scenarios", "!scenarioIdList",], function (
      this: ProjectFileParser,
    ): unknown {
      const list = this.val[1] as number[];
      const project = this.project!;
      asProp(this,).set(
        "scenarios",
        list.filter((sc,) => Boolean(project.scenario(sc,)?.get("active",),)),
      );
      return null;
    },);

    p.pattern(["_taskattributes", "!exportableTaskAttributes",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("taskAttributes", this.val[1],);
      return null;
    },);
    p.allOrNothingListRule("exportableTaskAttributes", {
      booking: "Include bookings",
      complete: "Include completion values",
      depends: "Include dependencies",
      flags: "Include flags",
      maxend: "Include maximum end dates",
      maxstart: "Include maximum start dates",
      minend: "Include minimum end dates",
      minstart: "Include minimum start dates",
      note: "Include notes",
      priority: "Include priorities",
      responsible: "Include responsible resource",
    },);

    p.pattern(["_taskroot", "!taskId",], function (
      this: ProjectFileParser,
    ): unknown {
      const task = this.val[1] as { leaf(): boolean; fullId: string };
      if (task.leaf()) {
        this.error(
          "taskroot_leaf",
          `${task.fullId} is not a container task`,
          this.sourceFileInfo[1] ?? null,
        );
      }
      asProp(this,).set("taskroot", this.val[1],);
      return null;
    },);
    p.level("experimental",);
    p.example("TaskRoot",);

    p.pattern(["_timezone", "!validTimeZone",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("timezone", this.val[1],);
      return null;
    },);
    p.doc(
      "timezone.export",
      "Set the time zone to be used for all dates in the report.",
    );
  },);

  rule(p, "exportFormats", () => {
    p.pattern(["!exportFormat", "!moreExportFormats",], function (
      this: ProjectFileParser,
    ): unknown {
      const rest = this.val[1] as unknown[] | null;
      return [this.val[0],].concat(rest ?? [],);
    },);
  },);

  rule(p, "moreExportFormats", () => {
    p.commaListRule("!exportFormat",);
  },);

  rule(p, "exportFormat", () => {
    p.pattern(["_tjp",], () => "tjp",);
    p.descr("Export of the scheduled project in TJP syntax.",);
    p.pattern(["_mspxml",], () => "mspxml",);
  },);

  // ------------------------------------------------------------------
  // 10.13.1.7 — iCal report
  // ------------------------------------------------------------------
  rule(p, "iCalReport", () => {
    p.pattern(["!iCalReportHeader", "!iCalReportBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = null;
      return null;
    },);
  },);

  rule(p, "iCalReportHeader", () => {
    p.pattern(
      ["_icalreport", "!optionalID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        this.newReport(
          this.val[1] as string | null,
          String(this.val[2],),
          "iCal",
          this.sourceFileInfo[0] ?? null,
          function (this: ProjectFileParser,): void {
            const rep = asProp(this,);
            const project = this.project!;
            rep.set("formats", ["iCal",],);
            if (!project.scenario(0,)?.get("active",)) {
              rep.set("scenarios", [0,],);
            }
            rep.set("hideTask", logicOp(0,),);
            rep.set("sortTasks", [["seqno", true, -1,],] as SortCriterion[],);
            rep.set("hideResource", logicOp(0,),);
            rep.set(
              "sortResources",
              [["seqno", true, -1,],] as SortCriterion[],
            );
            rep.set("hideJournalEntry", logicOp(0,),);
            rep.set("novevents", [false,],);
          },
        );
        return null;
      },
    );
  },);

  rule(p, "iCalReportBody", () => {
    p.optionsRule("iCalReportAttributes",);
  },);

  rule(p, "iCalReportAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(["!hideresource",],);
    p.pattern(["!hidejournalentry",],);
    p.pattern(["!hidetask",],);
    p.pattern(["!reportEnd",],);
    p.pattern(["!reportPeriod",],);
    p.pattern(["!reportStart",],);
    p.pattern(["!rollupresource",],);
    p.pattern(["!rolluptask",],);

    p.pattern(["_novevents",], function (this: ProjectFileParser,): unknown {
      asProp(this,).set("novevents", [true,],);
      return null;
    },);

    p.pattern(["_scenario", "!scenarioId",], function (
      this: ProjectFileParser,
    ): unknown {
      const sc = this.val[1] as number;
      if (!this.project!.scenario(sc,)?.get("active",)) {
        this.warning(
          "ical_sc_disabled",
          `Scenario ${sc} has been disabled`,
        );
      } else {
        asProp(this,).set("scenarios", [sc,],);
      }
      return null;
    },);
  },);

  // ------------------------------------------------------------------
  // 10.13.1.8 — Niku report
  // ------------------------------------------------------------------
  rule(p, "nikuReport", () => {
    p.pattern(["!nikuReportHeader", "!nikuReportBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = null;
      return null;
    },);
    p.example("Niku",);
  },);

  rule(p, "nikuReportHeader", () => {
    p.pattern(
      ["_nikureport", "!optionalID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        this.newReport(
          this.val[1] as string | null,
          String(this.val[2],),
          "niku",
          this.sourceFileInfo[0] ?? null,
          function (this: ProjectFileParser,): void {
            asProp(this,).set(
              "numberFormat",
              new RealFormat(["-", "", "", ".", 2,],),
            );
          },
        );
        return null;
      },
    );
  },);

  rule(p, "nikuReportBody", () => {
    p.pattern(["_{", "!nikuReportAttributes", "_}",], function (): unknown {
      return null;
    },);
  },);

  rule(p, "nikuReportAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(["!formats",],);
    p.pattern(["!headline",],);
    p.pattern(["!hideresource",],);
    p.pattern(["!hidetask",],);

    p.pattern(["!numberFormat",], function (this: ProjectFileParser,): unknown {
      asProp(this,).set("numberFormat", this.val[0],);
      return null;
    },);

    p.pattern(["!reportEnd",],);
    p.pattern(["!reportPeriod",],);
    p.pattern(["!reportStart",],);
    p.pattern(["!reportTitle",],);

    p.pattern(["_timeoff", "$STRING", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      asProp(this,).set("timeOffId", this.val[1],);
      asProp(this,).set("timeOffName", this.val[2],);
      return null;
    },);
    p.doc(
      "timeoff.nikureport",
      "Set the Clarity project ID and name that the vacation time will be " +
        "reported to.",
    );
    p.arg(1, "ID", "The Clarity project ID",);
    p.arg(2, "Name", "The Clarity project name",);
  },);

  // ------------------------------------------------------------------
  // 10.13.1.9 — TagFile report
  // ------------------------------------------------------------------
  rule(p, "tagfile", () => {
    p.pattern(["!tagfileHeader", "!tagfileBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = null;
      return null;
    },);
  },);

  rule(p, "tagfileHeader", () => {
    p.pattern(
      ["_tagfile", "!optionalID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        this.newReport(
          this.val[1] as string | null,
          String(this.val[2],),
          "tagfile",
          this.sourceFileInfo[0] ?? null,
          function (this: ProjectFileParser,): void {
            const rep = asProp(this,);
            rep.set("formats", ["ctags",],);
            rep.set("hideTask", logicOp(0,),);
            rep.set("sortTasks", [["seqno", true, -1,],] as SortCriterion[],);
            rep.set("hideResource", logicOp(0,),);
            rep.set(
              "sortResources",
              [["seqno", true, -1,],] as SortCriterion[],
            );
          },
        );
        return null;
      },
    );
  },);

  rule(p, "tagfileBody", () => {
    p.optionsRule("tagfileAttributes",);
  },);

  rule(p, "tagfileAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(["!hideresource",],);
    p.pattern(["!hidetask",],);
    p.pattern(["!rollupresource",],);
    p.pattern(["!rolluptask",],);
  },);

  // ------------------------------------------------------------------
  // Compartilhados: author / details / summary (journal + sheets)
  // ------------------------------------------------------------------
  rule(p, "author", () => {
    p.pattern(["_author", "!resourceId",], function (
      this: ProjectFileParser,
    ): unknown {
      (this.journalEntry as JournalEntry).author = this.val[1];
      return null;
    },);
    p.doc(
      "author",
      "This attribute can be used to capture the authorship or source of " +
        "the information.",
    );
  },);

  rule(p, "details", () => {
    p.pattern(["_details", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      const text = String(this.val[1],);
      if (text === "") return null;
      if (text === "Some more details\n") {
        this.error(
          "ts_default_details",
          "'Some more details' is not a valid value",
          this.sourceFileInfo[1] ?? null,
        );
      }
      (this.journalEntry as JournalEntry).details = text;
      return null;
    },);
  },);

  rule(p, "summary", () => {
    p.pattern(["_summary", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      const text = String(this.val[1],);
      if (text === "") return null;
      if (text.length > 480) {
        this.error(
          "ts_summary_too_long",
          "The summary text must be 480 characters long or shorter. This " +
            `text has ${text.length} characters.`,
          this.sourceFileInfo[1] ?? null,
        );
      }
      if (text === "A summary text\n") {
        this.error(
          "ts_default_summary",
          "'A summary text' is not a valid summary",
          this.sourceFileInfo[1] ?? null,
        );
      }
      (this.journalEntry as JournalEntry).summary = text;
      return null;
    },);
  },);

  // ------------------------------------------------------------------
  // 10.13.1.10 — statusSheet report
  // ------------------------------------------------------------------
  rule(p, "statusSheetReport", () => {
    p.pattern(["!ssReportHeader", "!ssReportBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = null;
      return null;
    },);
  },);

  rule(p, "ssReportHeader", () => {
    p.pattern(
      ["_statussheetreport", "!optionalID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        this.newReport(
          this.val[1] as string | null,
          String(this.val[2],),
          "statusSheet",
          this.sourceFileInfo[0] ?? null,
          function (this: ProjectFileParser,): void {
            const rep = asProp(this,);
            rep.set("formats", ["tjp",],);
            // Ruby `unless @project['trackingScenarioIdx']` — idx 0 é truthy.
            if (this.project!.get("trackingScenarioIdx",) == null) {
              this.error(
                "ss_no_tracking_scenario",
                "You must have a tracking scenario defined to use status " +
                  "sheets.",
              );
            }
            rep.set("hideTask", logicOp(0,),);
            rep.set("sortTasks", [["id", true, -1,],] as SortCriterion[],);
            rep.set("hideResource", logicOp(0,),);
            rep.set(
              "sortResources",
              [["seqno", true, -1,],] as SortCriterion[],
            );
            rep.set("loadUnit", "hours",);
            rep.set("definitions", [],);
          },
        );
        return null;
      },
    );
  },);

  rule(p, "ssReportBody", () => {
    p.optionsRule("ssReportAttributes",);
  },);

  rule(p, "ssReportAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(["!hideresource",],);
    p.pattern(["!hidetask",],);
    p.pattern(["!reportEnd",],);
    p.pattern(["!reportPeriod",],);
    p.pattern(["!reportStart",],);
    p.pattern(["!sortResources",],);
    p.pattern(["!sortTasks",],);
  },);

  rule(p, "ssStatus", () => {
    p.pattern(["!ssStatusHeader", "!ssStatusBody",],);
  },);

  rule(p, "ssStatusHeader", () => {
    p.pattern(["_status", "!alertLevel", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      this.journalEntry = new JournalEntry(
        this.project!.journal,
        this.sheetEnd as TjTime,
        String(this.val[2],),
        this.property,
        this.sourceFileInfo[0] ?? null,
      );
      const entry = this.journalEntry as JournalEntry;
      entry.alertLevel = this.val[1] as number;
      entry.author = this.sheetAuthor;
      entry.moderators.push(this.sheetModerator,);
      return null;
    },);
  },);

  rule(p, "ssStatusBody", () => {
    p.optional();
    p.pattern(["_{", "!ssStatusAttributes", "_}",],);
  },);

  rule(p, "ssStatusAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(["!author",],);
    p.pattern(["!details",],);

    p.pattern(["_flags", "!flagList",], function (
      this: ProjectFileParser,
    ): unknown {
      const entry = this.journalEntry as JournalEntry;
      for (const flag of this.val[1] as string[]) {
        if (!entry.flags.includes(flag,)) entry.flags.push(flag,);
      }
      return null;
    },);

    p.pattern(["!summary",],);
  },);

  // ------------------------------------------------------------------
  // 10.13.1.11 — timeSheet report
  // ------------------------------------------------------------------
  rule(p, "tsReportHeader", () => {
    p.pattern(
      ["_timesheetreport", "!optionalID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        this.newReport(
          this.val[1] as string | null,
          String(this.val[2],),
          "timeSheet",
          this.sourceFileInfo[0] ?? null,
          function (this: ProjectFileParser,): void {
            const rep = asProp(this,);
            rep.set("formats", ["tjp",],);
            const scenarioIdx = this.project!.get("trackingScenarioIdx",);
            // Ruby `unless (scenarioIdx = ...)` — idx 0 é truthy em Ruby.
            if (scenarioIdx == null) {
              this.error(
                "ts_no_tracking_scenario",
                "You must have a tracking scenario defined to use time " +
                  "sheets.",
              );
            }
            rep.set("scenarios", [scenarioIdx,],);
            rep.set("hideTask", logicOp(0,),);
            rep.set("sortTasks", [["seqno", true, -1,],] as SortCriterion[],);
            rep.set("hideResource", logicOp(0,),);
            rep.set(
              "sortResources",
              [["seqno", true, -1,],] as SortCriterion[],
            );
            rep.set("loadUnit", "hours",);
            rep.set("definitions", [],);
          },
        );
        return null;
      },
    );
  },);

  rule(p, "tsReportBody", () => {
    p.optionsRule("tsReportAttributes",);
  },);

  rule(p, "timeSheetReport", () => {
    p.pattern(["!tsReportHeader", "!tsReportBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = null;
      return null;
    },);
  },);

  rule(p, "tsReportAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(["!hideresource",],);
    p.pattern(["!hidetask",],);
    p.pattern(["!reportEnd",],);
    p.pattern(["!reportPeriod",],);
    p.pattern(["!reportStart",],);
    p.pattern(["!sortResources",],);
    p.pattern(["!sortTasks",],);
  },);

  // ------------------------------------------------------------------
  // 10.13.3 — colunas
  // ------------------------------------------------------------------
  rule(p, "columnDef", () => {
    p.pattern(["!columnId", "!columnBody",], function (
      this: ProjectFileParser,
    ): unknown {
      return this.val[0];
    },);
  },);

  rule(p, "columnId", () => {
    p.pattern(["!reportableAttributes",], function (
      this: ProjectFileParser,
    ): unknown {
      const id = String(this.val[0],);
      const col = new TableColumnDefinition(id, this.columnTitle(id,),);
      this.column = col;
      return col;
    },);
  },);

  rule(p, "moreColumnDef", () => {
    p.commaListRule("!columnDef",);
  },);

  rule(p, "columnBody", () => {
    p.optionsRule("columnOptions",);
  },);

  rule(p, "columnOptions", () => {
    p.optional();
    p.repeatable();

    const col = (parser: ProjectFileParser,): TableColumnDefinition =>
      parser.column as TableColumnDefinition;

    p.pattern(
      ["_celltext", "!logicalExpression", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        col(this,).cellText.addPattern(
          new CellSettingPattern(
            String(this.val[2],),
            this.val[1] as LogicalExpression,
          ),
        );
        return null;
      },
    );
    p.arg(
      2,
      "text",
      "Alternative cell text specified as [[Rich_Text_Attributes|Rich Text]]",
    );

    p.pattern(
      ["_cellcolor", "!logicalExpression", "!color",],
      function (this: ProjectFileParser,): unknown {
        col(this,).cellColor.addPattern(
          new CellSettingPattern(
            this.val[2],
            this.val[1] as LogicalExpression,
          ),
        );
        return null;
      },
    );

    p.pattern(["_end", "!date",], function (this: ProjectFileParser,): unknown {
      col(this,).end = this.val[1] as TjTime;
      return null;
    },);

    p.pattern(
      ["_fontcolor", "!logicalExpression", "!color",],
      function (this: ProjectFileParser,): unknown {
        col(this,).fontColor.addPattern(
          new CellSettingPattern(
            this.val[2],
            this.val[1] as LogicalExpression,
          ),
        );
        return null;
      },
    );

    p.pattern(
      ["_halign", "!logicalExpression", "!hAlignment",],
      function (this: ProjectFileParser,): unknown {
        col(this,).hAlign.addPattern(
          new CellSettingPattern(
            this.val[2],
            this.val[1] as LogicalExpression,
          ),
        );
        return null;
      },
    );

    p.pattern(["_listitem", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      col(this,).listItem = richText(this, 1,);
      return null;
    },);

    p.pattern(["_listtype", "!listType",], function (
      this: ProjectFileParser,
    ): unknown {
      col(this,).listType = this.val[1] as string;
      return null;
    },);
    p.also(["listitem.column",],);

    p.pattern(["_period", "!interval",], function (
      this: ProjectFileParser,
    ): unknown {
      const interval = this.val[1] as { start: TjTime; end: TjTime } | null;
      if (!interval) return null;
      col(this,).start = interval.start;
      col(this,).end = interval.end;
      return null;
    },);

    p.pattern(["_scale", "!chartScale",], function (
      this: ProjectFileParser,
    ): unknown {
      col(this,).scale = String(this.val[1],);
      return null;
    },);

    p.pattern(["_start", "!date",], function (
      this: ProjectFileParser,
    ): unknown {
      col(this,).start = this.val[1] as TjTime;
      return null;
    },);

    p.pattern(["_timeformat1", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      col(this,).timeformat1 = String(this.val[1],);
      return null;
    },);
    p.arg(1, "format", "See [[timeformat]] for details.",);

    p.pattern(["_timeformat2", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      col(this,).timeformat2 = String(this.val[1],);
      return null;
    },);
    p.arg(1, "format", "See [[timeformat]] for details.",);

    p.pattern(["_title", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      col(this,).title = String(this.val[1],);
      return null;
    },);
    p.arg(1, "text", "The new column title.",);

    p.pattern(
      ["_tooltip", "!logicalExpression", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        col(this,).tooltip.addPattern(
          new CellSettingPattern(
            String(this.val[2],),
            this.val[1] as LogicalExpression,
          ),
        );
        return null;
      },
    );

    p.pattern(["_width", "!number",], function (
      this: ProjectFileParser,
    ): unknown {
      col(this,).width = this.val[1] as number;
      return null;
    },);
  },);

  rule(p, "hAlignment", () => {
    p.pattern(["_center",], () => "center",);
    p.doc("halign.center", "Center the cell content",);
    p.pattern(["_left",], () => "left",);
    p.doc("halign.left", "Left align the cell content",);
    p.pattern(["_right",], () => "right",);
    p.doc("halign.right", "Right align the cell content",);
  },);

  rule(p, "listType", () => {
    p.pattern(["_bullets",], () => "bullets",);
    p.descr("List items as bullet list",);
    p.pattern(["_comma",], () => "comma",);
    p.descr("List items as comma separated list",);
    p.pattern(["_numbered",], () => "numbered",);
    p.descr("List items as numbered list",);
  },);

  rule(p, "chartScale", () => {
    p.singlePattern("_hour",);
    p.descr("Set chart resolution to 1 hour.",);
    p.singlePattern("_day",);
    p.descr("Set chart resolution to 1 day.",);
    p.singlePattern("_week",);
    p.descr("Set chart resolution to 1 week.",);
    p.singlePattern("_month",);
    p.descr("Set chart resolution to 1 month.",);
    p.singlePattern("_quarter",);
    p.descr("Set chart resolution to 1 quarter.",);
    p.singlePattern("_year",);
    p.descr("Set chart resolution to 1 year.",);
  },);

  // ------------------------------------------------------------------
  // 10.13.2.9 — reportProperties (ponte para o bloco de propriedades)
  // ------------------------------------------------------------------
  rule(p, "reportProperties", () => {
    p.pattern(["!iCalReport",],);
    p.pattern(["!nikuReport",],);
    p.pattern(["!reports",],);
    p.pattern(["!tagfile",],);
    p.pattern(["!statusSheetReport",],);
    p.pattern(["!timeSheetReport",],);
  },);

  rule(p, "reportPropertiesBody", () => {
    p.optional();
    p.repeatable();

    p.pattern(["!macro",],);
    p.pattern(["!reportProperties",],);
  },);

  rule(p, "reportPropertiesFile", () => {
    p.pattern(["!reportPropertiesBody", ".",],);
  },);

  // ------------------------------------------------------------------
  // 10.13.3.2 — reportableAttributes (grande enum de colunas)
  // ------------------------------------------------------------------
  rule(p, "reportableAttributes", () => {
    p.singlePattern("_activetasks",);
    p.singlePattern("_annualleave",);
    p.singlePattern("_annualleavebalance",);
    p.singlePattern("_annualleavelist",);
    p.singlePattern("_alert",);
    p.singlePattern("_alertmessages",);
    p.level("deprecated",);
    p.also("journal",);
    p.descr("Deprecated. Please use 'journal' instead",);
    p.singlePattern("_alertsummaries",);
    p.level("deprecated",);
    p.also("journal",);
    p.descr("Deprecated. Please use 'journal' instead",);
    p.singlePattern("_alerttrend",);
    p.singlePattern("_balance",);
    p.singlePattern("_bsi",);
    p.descr(
      "The hierarchical or work breakdown structure index (i. e. 1.2.3)",
    );
    p.singlePattern("_chart",);
    p.singlePattern("_children",);
    p.singlePattern("_closedtasks",);
    p.singlePattern("_competitorcount",);
    p.singlePattern("_competitors",);
    p.singlePattern("_complete",);
    p.pattern(["_completed",], () => "complete",);
    p.level("deprecated",);
    p.also("complete",);
    p.descr("Deprecated alias for complete",);
    p.singlePattern("_criticalness",);
    p.descr(
      "A measure for how much effort the resource is allocated for, or " +
        "how strained the allocated resources of a task are.",
    );
    p.singlePattern("_cost",);
    p.singlePattern("_daily",);
    p.descr("A group of columns with one column for each day",);
    p.singlePattern("_directreports",);
    p.singlePattern("_duration",);
    p.descr("The duration of a task",);
    p.singlePattern("_duties",);
    p.singlePattern("_efficiency",);
    p.descr("Measure for how efficient a resource can perform tasks",);
    p.singlePattern("_effort",);
    p.descr("The allocated effort during the reporting period",);
    p.singlePattern("_effortdone",);
    p.descr("The already completed effort as of now",);
    p.singlePattern("_effortleft",);
    p.descr("The remaining allocated effort as of now",);
    p.singlePattern("_email",);
    p.descr("The email address of a resource",);
    p.singlePattern("_end",);
    p.descr("The end date of a task",);
    p.singlePattern("_flags",);
    p.descr("List of attached flags",);
    p.singlePattern("_followers",);
    p.singlePattern("_freetime",);
    p.singlePattern("_freework",);
    p.singlePattern("_fte",);
    p.singlePattern("_gauge",);
    p.singlePattern("_headcount",);
    p.pattern(["_hierarchindex",], () => "bsi",);
    p.level("deprecated",);
    p.also("bsi",);
    p.descr("Deprecated alias for bsi",);
    p.singlePattern("_hourly",);
    p.descr("A group of columns with one column for each hour",);
    p.singlePattern("_id",);
    p.descr("The id of the item",);
    p.singlePattern("_index",);
    p.descr("The index of the item based on the nesting hierarchy",);
    p.singlePattern("_inputs",);
    p.singlePattern("_journal",);
    p.singlePattern("_journal_sub",);
    p.level("deprecated",);
    p.also("journal",);
    p.descr("Deprecated. Please use 'journal' instead",);
    p.singlePattern("_journalmessages",);
    p.level("deprecated",);
    p.also("journal",);
    p.descr("Deprecated. Please use 'journal' instead",);
    p.singlePattern("_journalsummaries",);
    p.level("deprecated",);
    p.also("journal",);
    p.descr("Deprecated. Please use 'journal' instead",);
    p.singlePattern("_line",);
    p.descr("The line number in the report",);
    p.singlePattern("_managers",);
    p.singlePattern("_maxend",);
    p.descr("The latest allowed end of a task",);
    p.singlePattern("_maxstart",);
    p.descr("The lastest allowed start of a task",);
    p.singlePattern("_minend",);
    p.descr("The earliest allowed end of a task",);
    p.singlePattern("_minstart",);
    p.descr("The earliest allowed start of a task",);
    p.singlePattern("_monthly",);
    p.descr("A group of columns with one column for each month",);
    p.singlePattern("_no",);
    p.descr(
      "The object line number in the report (Cannot be used for sorting!)",
    );
    p.singlePattern("_name",);
    p.descr("The name or description of the item",);
    p.singlePattern("_note",);
    p.descr("The note attached to a task",);
    p.singlePattern("_opentasks",);
    p.singlePattern("_pathcriticalness",);
    p.descr(
      "The criticalness of the task with respect to all the paths that " +
        "it is a part of.",
    );
    p.singlePattern("_precursors",);
    p.singlePattern("_priority",);
    p.descr("The priority of a task",);
    p.singlePattern("_quarterly",);
    p.descr("A group of columns with one column for each quarter",);
    p.singlePattern("_rate",);
    p.descr("The daily cost of a resource.",);
    p.singlePattern("_reports",);
    p.singlePattern("_resources",);
    p.singlePattern("_responsible",);
    p.singlePattern("_revenue",);
    p.singlePattern("_scenario",);
    p.descr("The name of the scenario",);
    p.singlePattern("_scheduling",);
    p.singlePattern("_seqno",);
    p.descr("The index of the item based on the declaration order",);
    p.singlePattern("_sickleave",);
    p.singlePattern("_specialleave",);
    p.singlePattern("_start",);
    p.descr("The start date of the task",);
    p.singlePattern("_status",);
    p.singlePattern("_targets",);
    p.singlePattern("_turnover",);
    p.pattern(["_wbs",], () => "bsi",);
    p.level("deprecated",);
    p.also("bsi",);
    p.descr("Deprecated alias for bsi.",);
    p.singlePattern("_unpaidleave",);
    p.singlePattern("_weekly",);
    p.descr("A group of columns with one column for each week",);
    p.singlePattern("_yearly",);
    p.descr("A group of columns with one column for each year",);
  },);
}
