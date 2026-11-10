/**
 * TjpSyntaxRules — block 4b: tracking (sub-phase 10.14.1/2/5).
 *
 * Port of the `timeSheet*` / `tsTask*` / `tsStatus*`, `statusSheet*`,
 * `navigator*`, `nodeId*` and `projectProperties*` / `propertiesFile` data
 * entry rules of `TjpSyntaxRules.rb`. The matching reports
 * (`statusSheetReport` / `timeSheetReport` / `ssStatus*`) already live in
 * block 3 (report.ts); only the progress capture blocks stay here.
 *
 * Port notes (phase 10):
 * - `TimeSheet` / `TimeSheetRecord` / `Navigator` are minimal structures; the
 *   conversion into bookings, the delta validation and the HTML generation
 *   arrive in phases 17/18. The parser only builds the structure.
 * - RichText attributes (details/summary) keep the raw String until phase 12.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb
 */
import { JournalEntry, } from "../../model/journal.ts";
import { Navigator, } from "../../reports/navigator.ts";
import { Task, } from "../../model/task.ts";
import type { Resource, } from "../../model/resource.ts";
import { TimeSheet, TimeSheetRecord, } from "../../timesheet/mod.ts";
import type { Percent, } from "../../time/percent.ts";
import type { TimeInterval, } from "../../time/time-interval.ts";
import type { PropertyTreeNode, } from "../../model/property-tree-node.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { rule, } from "./helpers.ts";

const asProp = (parser: ProjectFileParser,): NonNullable<
  ProjectFileParser["property"]
> => parser.property!;

/** Registers the tracking rule block (timesheet/statussheet/navigator). */
export function registerTrackingRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // projectProperties / projectPropertiesBody / propertiesFile (doc-only)
  // ------------------------------------------------------------------
  rule(p, "projectProperties", () => {
    p.pattern(["!projectPropertiesBody",],);
  },);

  rule(p, "projectPropertiesBody", () => {
    p.optionsRule("properties",);
  },);

  rule(p, "propertiesFile", () => {
    p.pattern(["!propertiesBody", ".",],);
  },);

  // ------------------------------------------------------------------
  // navigator (10.14.5.4)
  // ------------------------------------------------------------------
  rule(p, "navigator", () => {
    p.pattern(["!navigatorHeader", "!navigatorBody",], function (
      this: ProjectFileParser,
    ): unknown {
      const nav = this.navigator as Navigator;
      this.navigators.set(nav.id, nav,);
      // Ruby: `@project['navigators']`. Mirrored into the Project so that
      // `RTFNavigator` (phase 14.21) can locate the bar by id.
      if (this.project) this.project.navigators.set(nav.id, nav,);
      return null;
    },);
  },);

  rule(p, "navigatorHeader", () => {
    p.pattern(
      ["_navigator", "$ID",],
      function (this: ProjectFileParser,): unknown {
        const id = String(this.val[1],);
        if (this.navigators.has(id,)) {
          this.error(
            "navigator_exists",
            `The navigator ${id} has already been defined.`,
            this.sourceFileInfo[0] ?? null,
          );
        }
        this.navigator = new Navigator(id, this.project!,);
        return null;
      },
    );
  },);

  rule(p, "navigatorBody", () => {
    p.optional();
    p.pattern(["_{", "!navigatorAttributes", "_}",],);
  },);

  rule(p, "navigatorAttributes", () => {
    p.optional();
    p.repeatable();
    p.pattern(["_hidereport", "!logicalExpression",], function (
      this: ProjectFileParser,
    ): unknown {
      (this.navigator as Navigator).hideReport = this.val[1] as never;
      return null;
    },);
  },);

  // ------------------------------------------------------------------
  // nodeId / nodeIdList / moreNodeIdList / subNodeId (10.14.5.5)
  // ------------------------------------------------------------------
  rule(p, "nodeId", () => {
    p.pattern(["!idOrAbsoluteId", "!subNodeId",], function (
      this: ProjectFileParser,
    ): unknown {
      const project = this.project!;
      const type = (asProp(this,) as { typeSpec?: string | null }).typeSpec;
      if (type === "taskreport" || type === "resourcereport") {
        const p1 = project.task(String(this.val[0],),);
        if (!p1) {
          this.error(
            "unknown_main_node",
            `Unknown task ID ${String(this.val[0],)}`,
            this.sourceFileInfo[0] ?? null,
          );
        }
        if (this.val[1]) {
          const p2 = project.resource(String(this.val[1],),);
          if (!p2) {
            this.error(
              "unknown_sub_node",
              `Unknown resource ID ${String(this.val[1],)}`,
              this.sourceFileInfo[0] ?? null,
            );
          }
          return [p2, p1,];
        }
        return [p1, null,];
      }
      return [this.val[0], this.val[1],];
    },);
  },);

  rule(p, "nodeIdList", () => {
    p.listRule("moreNodeIdList", "!nodeId",);
    p.pattern(["_-",], function (): unknown {
      return [];
    },);
  },);

  rule(p, "subNodeId", () => {
    p.optional();
    p.pattern(
      ["_:", "!idOrAbsoluteId",],
      function (this: ProjectFileParser,): unknown {
        return this.val[1];
      },
    );
  },);

  // ------------------------------------------------------------------
  // statusSheet (data entry — 10.14.2)
  // ------------------------------------------------------------------
  rule(p, "statusSheet", () => {
    p.pattern(["!statusSheetHeader", "!statusSheetBody",], function (
      this: ProjectFileParser,
    ): unknown {
      return [this.sheetAuthor, this.sheetStart, this.sheetEnd,];
    },);
  },);

  rule(p, "statusSheetHeader", () => {
    p.pattern(
      ["_statussheet", "!resourceId", "!valIntervalOrDate",],
      function (this: ProjectFileParser,): unknown {
        // Ruby `unless @project['trackingScenarioIdx']`: idx 0 is truthy —
        // only `nil`/false counts as absent.
        if (this.project!.get("trackingScenarioIdx",) == null) {
          this.error(
            "ss_no_tracking_scenario",
            "No trackingscenario defined.",
          );
        }
        const iv = this.val[2] as TimeInterval;
        this.sheetAuthor = this.val[1];
        this.sheetModerator = this.val[1];
        this.sheetStart = iv.start;
        this.sheetEnd = iv.end;
        // Re-submission of the same sheet: drop the old entries of the same
        // author for the same period (Ruby l.5706-5710).
        const moderator = this.sheetModerator;
        const end = this.sheetEnd;
        this.project!.journal.deleteIf((e,) =>
          e.moderators.includes(moderator,) && e.date === end
        );
        return null;
      },
    );
  },);

  rule(p, "statusSheetBody", () => {
    p.optionsRule("statusSheetAttributes",);
  },);

  rule(p, "statusSheetAttributes", () => {
    p.optional();
    p.repeatable();
    p.pattern(["!statusSheetTask",],);
  },);

  rule(p, "statusSheetFile", () => {
    p.pattern(
      ["!statusSheet", ".",],
      function (this: ProjectFileParser,): unknown {
        return this.val[0];
      },
    );
  },);

  rule(p, "statusSheetTask", () => {
    p.pattern(["!statusSheetTaskHeader", "!statusSheetTaskBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = (this.propertyStack.pop() as PropertyTreeNode) ?? null;
      return null;
    },);
  },);

  rule(p, "statusSheetTaskHeader", () => {
    p.pattern(
      ["_task", "!taskId",],
      function (this: ProjectFileParser,): unknown {
        this.propertyStack.push(this.property,);
        this.property = this.val[1] as PropertyTreeNode;
        return null;
      },
    );
  },);

  rule(p, "statusSheetTaskBody", () => {
    p.optionsRule("statusSheetTaskAttributes",);
  },);

  rule(p, "statusSheetTaskAttributes", () => {
    p.optional();
    p.repeatable();
    p.pattern(["!ssStatus",],);
    p.pattern(["!statusSheetTask",],);
    p.pattern(["!tsMaterial",],);
  },);

  // ------------------------------------------------------------------
  // timeSheet (data entry — 10.14.1)
  // ------------------------------------------------------------------
  rule(p, "timeSheet", () => {
    p.pattern(["!timeSheetHeader", "!timeSheetBody",], function (
      this: ProjectFileParser,
    ): unknown {
      return this.timeSheet;
    },);
  },);

  rule(p, "timeSheetHeader", () => {
    p.pattern(
      ["_timesheet", "!resourceId", "!valIntervalOrDate",],
      function (this: ProjectFileParser,): unknown {
        const author = this.val[1] as Resource;
        this.sheetAuthor = author;
        this.property = null;
        if (!author.leaf()) {
          this.error(
            "ts_group_author",
            "A resource group cannot file a time sheet",
            this.sourceFileInfo[1] ?? null,
          );
        }
        // Ruby `unless (scenarioIdx = @project['trackingScenarioIdx'])`: 0 is
        // truthy in Ruby; in JS it must be compared with null/undefined.
        const scenarioIdx = this.project!.get("trackingScenarioIdx",) as number;
        if (scenarioIdx == null) {
          this.error(
            "ts_no_tracking_scenario",
            "No trackingscenario defined.",
          );
        }
        const ts = new TimeSheet(
          author,
          this.val[2] as TimeInterval,
          scenarioIdx ?? 0,
        );
        ts.sourceFileInfo = this.sourceFileInfo[0] ?? null;
        this.timeSheet = ts;
        this.project!.timeSheets.push(ts,);
        return null;
      },
    );
  },);

  rule(p, "timeSheetBody", () => {
    p.pattern(["_{", "!timeSheetAttributes", "_}",],);
  },);

  rule(p, "timeSheetAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(["!tsNewTaskHeader", "!tsTaskBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = null;
      this.timeSheetRecord = null;
      return null;
    },);

    p.pattern(["_shift", "!shiftId",], function (): unknown {
      return null;
    },);

    p.pattern(["!tsStatus",],);

    p.pattern(["!tsMaterial",],);

    p.pattern(["!tsTaskHeader", "!tsTaskBody",], function (
      this: ProjectFileParser,
    ): unknown {
      this.property = null;
      this.timeSheetRecord = null;
      return null;
    },);
  },);

  rule(p, "timeSheetFile", () => {
    p.pattern(
      ["!timeSheet", ".",],
      function (this: ProjectFileParser,): unknown {
        return this.val[0];
      },
    );
  },);

  rule(p, "tsTaskHeader", () => {
    p.pattern(
      ["_task", "!taskId",],
      function (this: ProjectFileParser,): unknown {
        this.property = this.val[1] as PropertyTreeNode;
        if (!this.property.leaf()) {
          this.error(
            "ts_task_not_leaf",
            "You cannot specify a task that has sub tasks here.",
            this.sourceFileInfo[1] ?? null,
            this.property,
          );
        }
        const record = new TimeSheetRecord(
          this.timeSheet as TimeSheet,
          this.property as Task | null,
        );
        record.sourceFileInfo = this.sourceFileInfo[0] ?? null;
        this.timeSheetRecord = record;
        return null;
      },
    );
  },);

  rule(p, "tsTaskBody", () => {
    p.pattern(["_{", "!tsTaskAttributes", "_}",],);
  },);

  rule(p, "tsTaskAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(
      ["_end", "!valDate",],
      function (this: ProjectFileParser,): unknown {
        const record = this.timeSheetRecord as TimeSheetRecord;
        const iv = (this.timeSheet as TimeSheet).interval;
        if (
          (this.val[1] as { compareTo(o: unknown,): number }).compareTo(
            iv.start,
          ) < 0
        ) {
          this.error(
            "ts_end_too_early",
            "The expected task end date must be after the start date of " +
              "this time sheet report.",
            this.sourceFileInfo[1] ?? null,
          );
        }
        record.expectedEnd = this.val[1] as never;
        return null;
      },
    );

    p.pattern(
      ["_priority", "$INTEGER",],
      function (this: ProjectFileParser,): unknown {
        const priority = Number(this.val[1],);
        if (priority < 1 || priority > 1000) {
          this.error(
            "ts_bad_priority",
            `Priority value ${priority} must be between 1 and 1000.`,
            this.sourceFileInfo[1] ?? null,
          );
        }
        (this.timeSheetRecord as TimeSheetRecord).priority = priority;
        return null;
      },
    );

    p.pattern(["_remaining", "!workingDuration",], function (
      this: ProjectFileParser,
    ): unknown {
      (this.timeSheetRecord as TimeSheetRecord).remaining = this
        .val[1] as number;
      return null;
    },);

    p.pattern(["!tsStatus",],);

    // Extension 18.17.10: `material <id> { … }` inside the task block.
    p.pattern(["!tsMaterial",],);

    p.pattern(["_work", "!workingDurationPercent",], function (
      this: ProjectFileParser,
    ): unknown {
      (this.timeSheetRecord as TimeSheetRecord).work = this.val[1] as
        | number
        | Percent;
      return null;
    },);
  },);

  rule(p, "tsNewTaskHeader", () => {
    p.pattern(
      ["_newtask", "!taskIdUnverifd", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        const record = new TimeSheetRecord(
          this.timeSheet as TimeSheet,
          this.val[1] as string,
        );
        record.name = String(this.val[2],);
        record.sourceFileInfo = this.sourceFileInfo[0] ?? null;
        this.timeSheetRecord = record;
        return null;
      },
    );
  },);

  rule(p, "tsStatus", () => {
    p.pattern(["!tsStatusHeader", "!tsStatusBody",],);
  },);

  rule(p, "tsStatusHeader", () => {
    p.pattern(
      ["_status", "!alertLevel", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        const headline = String(this.val[2],);
        if (headline.length > 120) {
          this.error(
            "ts_headline_too_long",
            "The headline must be 120 or less characters long. This one " +
              `has ${headline.length} characters.`,
            this.sourceFileInfo[2] ?? null,
          );
        }
        if (headline === "Your headline here!") {
          this.error(
            "ts_no_headline",
            "'Your headline here!' is not a valid headline",
            this.sourceFileInfo[2] ?? null,
          );
        }
        const ts = this.timeSheet as TimeSheet;
        const entry = new JournalEntry(
          this.project!.journal,
          ts.interval.end,
          headline,
          (this.property ?? ts.resource) as PropertyTreeNode,
          this.sourceFileInfo[0] ?? null,
        );
        entry.alertLevel = this.val[1] as number;
        entry.timeSheetRecord = this.timeSheetRecord;
        entry.author = this.sheetAuthor;
        if (this.timeSheetRecord) {
          (this.timeSheetRecord as TimeSheetRecord).status = entry;
        }
        this.journalEntry = entry;
        return null;
      },
    );
  },);

  rule(p, "tsStatusBody", () => {
    p.optional();
    p.pattern(["_{", "!tsStatusAttributes", "_}",],);
  },);

  rule(p, "tsStatusAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(["!details",],);

    p.pattern(
      ["_flags", "!flagList",],
      function (this: ProjectFileParser,): unknown {
        const entry = this.journalEntry as JournalEntry;
        for (const flag of this.val[1] as string[]) {
          if (!entry.flags.includes(flag,)) entry.flags.push(flag,);
        }
        return null;
      },
    );

    p.pattern(["!summary",],);

    // Phase 10 Complemento C3.3.4 — `picture`/`format` in status (structure).
    p.pattern(["!picture",],);
    p.pattern(["!format",],);
  },);

  // ------------------------------------------------------------------
  // material inside a sheet (extension 18.17.10)
  //
  // Ruby has no `material` in a sheet: the extension allows reporting the
  // quantity consumed per task. The block lives **inside** `task` and the
  // quantity comes in units (not in duration/percent like the task `work`),
  // so the attributes use the raw `!number`.
  // ------------------------------------------------------------------
  rule(p, "tsMaterial", () => {
    p.pattern(["!tsMaterialHeader", "!tsMaterialBody",], function (
      this: ProjectFileParser,
    ): unknown {
      // Pops back the task context that wrapped the material.
      this.property = (this.propertyStack.pop() as PropertyTreeNode) ?? null;
      this.timeSheetRecord = this.sheetRecordStack.pop() ?? null;
      return null;
    },);
  },);

  rule(p, "tsMaterialHeader", () => {
    p.pattern(
      ["_material", "!materialNameRef",],
      function (this: ProjectFileParser,): unknown {
        const id = String(this.val[1] ?? "",);
        const material = this.project!.material(id,);
        if (!material) {
          this.error(
            "ts_unknown_material",
            `Unknown material ${id}`,
            this.sourceFileInfo[1] ?? null,
          );
        }
        // The owning task is the current `property` (the block is inside task).
        const owner = this.property instanceof Task ? this.property : null;
        this.propertyStack.push(this.property,);
        this.sheetRecordStack.push(this.timeSheetRecord,);
        this.property = material ?? null;

        const record = new TimeSheetRecord(
          this.timeSheet as TimeSheet,
          material ?? null,
        );
        record.ownerTask = owner;
        record.sourceFileInfo = this.sourceFileInfo[0] ?? null;
        this.timeSheetRecord = record;
        return null;
      },
    );
  },);

  rule(p, "tsMaterialBody", () => {
    p.optional();
    p.pattern(["_{", "!tsMaterialAttributes", "_}",],);
  },);

  rule(p, "tsMaterialAttributes", () => {
    p.optional();
    p.repeatable();

    // Material `remaining`/`work` are **quantities**, not slots.
    p.pattern(
      ["_remaining", "!number",],
      function (this: ProjectFileParser,): unknown {
        (this.timeSheetRecord as TimeSheetRecord).remaining = Number(
          this.val[1],
        );
        return null;
      },
    );

    p.pattern(["!tsStatus",],);

    p.pattern(
      ["_unitprice", "!number",],
      function (this: ProjectFileParser,): unknown {
        (this.timeSheetRecord as TimeSheetRecord).unitPrice = Number(
          this.val[1],
        );
        return null;
      },
    );

    p.pattern(
      ["_work", "!number",],
      function (this: ProjectFileParser,): unknown {
        (this.timeSheetRecord as TimeSheetRecord).work = Number(this.val[1],);
        return null;
      },
    );
  },);
}
