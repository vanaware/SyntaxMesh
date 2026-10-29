/**
 * TjpSyntaxRules — bloco project (subfase 10.11).
 *
 * Port das regras `project*`, `include*` e apoios (`color`,
 * `alertLevel*`, `currencyFormat`, `numberFormat`, `timezone`,
 * `timeformat`, `extend*`, `workinghours*`, `properties*`) de
 * `TjpSyntaxRules.rb`.
 *
 * Regras de outros blocos (account, resource, shift, report, scenario,
 * journalentry, balance, leaves, limits, navigator, statusSheet,
 * timeSheet, vacationName, projectIDs, declareFlagList, ...) são
 * referenciadas por nome e resolvidas por `ensurePlaceholders()` até
 * serem portadas nas subfases 10.12–10.14.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb
 */
import { TjTime, } from "../../time/tj-time.ts";
import { RealFormat, } from "../../format/real-format.ts";
import { Project, } from "../../model/project.ts";
import { Journal, } from "../../model/journal.ts";
import { Leave, } from "../../model/leave.ts";
import { ScoreboardInterval, } from "../../time/scoreboard-interval.ts";
import { WorkingHours, } from "../../calendar/working-hours.ts";
import { Macro, } from "../../lexer/macro-table.ts";
import { AttributeOverwrite, } from "../../model/errors.ts";
import type { PropertyTreeNode, } from "../../model/property-tree-node.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { rule, } from "./helpers.ts";

/** Nível de alerta: [id, nome, cor] (AlertLevelDefinition simplificado). */
type AlertLevelTuple = [string, string, string,];

/** Lê `project['alertLevels']` como lista de tuplas (fallback []). */
function alertLevels(parser: ProjectFileParser,): AlertLevelTuple[] {
  let levels = parser.project?.get("alertLevels",) as
    | AlertLevelTuple[]
    | undefined;
  if (!levels) {
    levels = [];
    parser.project?.set("alertLevels", levels,);
  }
  return levels;
}

/** Lista defensiva para atributos do Project sem default no TS. */
function listAttr(parser: ProjectFileParser, name: string,): unknown[] {
  let list = parser.project?.get(name,) as unknown[] | undefined;
  if (!list) {
    list = [];
    parser.project?.set(name, list,);
  }
  return list;
}

/** Registra o bloco de regras do projeto. */
export function registerProjectRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // project / prolog / declaration / header / body
  // ------------------------------------------------------------------
  rule(p, "project", () => {
    p.pattern(
      ["!projectProlog", "!projectDeclaration", "!properties", ".",],
      function (this: ProjectFileParser,): unknown {
        return this.val[1];
      },
    );
  },);

  rule(p, "projectProlog", () => {
    p.optional();
    p.repeatable();
    p.pattern(["!language",],);
    p.pattern(["!prologInclude",],);
    p.pattern(["!macro",],);
  },);

  // Diretiva `language "xx"` — extensão SyntaxMesh (não existe no TJ).
  // O idioma é ativado pelo pré-scan em open() (10.17.3–5); a regra aqui
  // apenas consome a diretiva no prolog do arquivo-mestre.
  rule(p, "language", () => {
    p.pattern(["_language", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      return null;
    },);
    p.doc(
      "language",
      'Sets the keyword language of the master file (e.g. "pt-BR", "es"). ' +
        "Must appear before the project declaration.",
    );
    p.arg(1, "language", "Language code known by the LanguageRegistry",);
  },);

  rule(p, "projectDeclaration", () => {
    p.pattern(
      ["!projectHeader", "!projectBody",],
      function (this: ProjectFileParser,): unknown {
        // Cenários-folha derivados do tracking scenario não podem ter
        // bookings próprios (herdam do tracking scenario).
        const idx = this.project?.get("trackingScenarioIdx",) as
          | number
          | undefined;
        if (idx !== undefined) {
          const scenario = this.project?.scenario(idx,);
          scenario?.allLeaves(true,).forEach((leaf,) => {
            leaf.set("ownbookings", false,);
          },);
        }
        return this.val[0];
      },
    );
    p.doc(
      "project",
      "The project property is mandatory and should be the first property " +
        "in a project file. It is used to capture basic attributes such as " +
        "the project id, name and the expected time frame.",
    );
  },);

  rule(p, "projectHeader", () => {
    p.pattern(
      ["_project", "!optionalID", "$STRING", "!optionalVersion", "!interval",],
      function (this: ProjectFileParser,): unknown {
        const id = (this.val[1] as string | null) ??
          String(this.val[2],).toLowerCase().replace(/[^a-z0-9]+/g, "_",);
        // Ruby: optionalVersion ausente passa nil; a doc de optionalVersion
        // diz que o default é "1.0".
        const version = this.val[3] == null ? "1.0" : String(this.val[3],);
        this.project = new Project(
          id,
          String(this.val[2],),
          version,
        );
        this.project.set("start", (this.val[4] as { start: TjTime }).start,);
        this.project.set("end", (this.val[4] as { end: TjTime }).end,);
        this.projectId = id;
        this.setGlobalMacros();
        this.property = null;
        this.reportCounter = 0;
        return this.project;
      },
    );
    p.arg(2, "name", "The name of the project",);
  },);

  rule(p, "projectBody", () => {
    p.optionsRule("projectBodyAttributes",);
  },);

  rule(p, "projectBodyAttributes", () => {
    p.repeatable();
    p.optional();

    p.pattern(
      ["_alertlevels", "!alertLevelDefinitions",],
      function (this: ProjectFileParser,): unknown {
        const defs = this.val[1] as AlertLevelTuple[];
        if (defs.length < 2) {
          this.error(
            "too_few_alert_levels",
            "You must specify at least 2 different alert levels.",
            this.sourceFileInfo[1] ?? null,
          );
        }
        const levels = alertLevels(this,);
        levels.length = 0;
        for (const level of defs) {
          if (levels.some((l,) => l[0] === level[0])) {
            this.error(
              "alert_level_redef",
              `Alert level '${level[0]}' has been defined multiple times.`,
              this.sourceFileInfo[1] ?? null,
            );
          }
          if (levels.some((l,) => l[1] === level[1])) {
            this.error(
              "alert_name_redef",
              `Alert level name '${level[1]}' has been defined multiple ` +
                "times.",
              this.sourceFileInfo[1] ?? null,
            );
          }
          levels.push(level,);
        }
        return null;
      },
    );
    p.doc(
      "alertlevels",
      "By default TaskJuggler supports the pre-defined alert levels: green, " +
        "yellow and red. This attribute can be used to replace them with " +
        "your own set of alert levels (minimum 2, ascending severity).",
    );

    p.pattern(
      ["!currencyFormat",],
      function (this: ProjectFileParser,): unknown {
        this.project?.set("currencyFormat", this.val[0],);
        return null;
      },
    );

    p.pattern(
      ["_currency", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        this.project?.set("currency", this.val[1],);
        return null;
      },
    );
    p.doc("currency", "The default currency unit.",);
    p.arg(1, "symbol", "Currency symbol",);

    p.pattern(
      ["_dailyworkinghours", "!number",],
      function (this: ProjectFileParser,): unknown {
        this.project?.set("dailyworkinghours", Number(this.val[1],),);
        return null;
      },
    );
    p.doc(
      "dailyworkinghours",
      "Set the average number of working hours per day. This is used as " +
        "the base to convert working hours into working days. The default " +
        "value is 8 hours.",
    );
    p.arg(
      1,
      "hours",
      "Average number of working hours per working day",
    );

    p.pattern(
      ["_extend", "!extendProperty", "!extendBody",],
      function (this: ProjectFileParser,): unknown {
        this.updateParserTables();
        return null;
      },
    );
    p.doc(
      "extend",
      "User-defined attributes for tasks, resources or accounts. The new " +
        "attributes can be of various types such as text, date or " +
        "reference to capture various types of data.",
    );

    p.pattern(["!projectBodyInclude",],);

    p.pattern(["!journalEntry",],);

    p.pattern(
      ["_now", "!date",],
      function (this: ProjectFileParser,): unknown {
        const t = this.val[1] as TjTime;
        this.project?.set("now", t,);
        const sfi = this.sourceFileInfo[0] ?? this.getSourceFileInfo()!;
        this.addScannerMacro(new Macro("now", t.to_s(), sfi,),);
        this.addScannerMacro(
          new Macro(
            "today",
            t.to_s(this.project?.get("timeFormat",) as string | undefined,),
            sfi,
          ),
        );
        return null;
      },
    );
    p.doc(
      "now",
      "Specify the date that TaskJuggler uses for calculation as current " +
        "date. If no value is specified, the system clock is used.",
    );
    p.arg(
      1,
      "date",
      "Alternative date to be used as current date for all computations",
    );

    p.pattern(
      ["_markdate", "!date",],
      function (this: ProjectFileParser,): unknown {
        const t = this.val[1] as TjTime;
        this.project?.set("markdate", t,);
        const sfi = this.sourceFileInfo[0] ?? this.getSourceFileInfo()!;
        this.addScannerMacro(new Macro("markdate", t.to_s(), sfi,),);
        this.addScannerMacro(
          new Macro(
            "today",
            t.to_s(this.project?.get("timeFormat",) as string | undefined,),
            sfi,
          ),
        );
        return null;
      },
    );
    p.doc(
      "markdate",
      "Specify the reference date that TaskJuggler uses as user-defined " +
        "date to help with tracking tasks.",
    );
    p.arg(
      1,
      "date",
      "Alternative date to be used as custom date specified by the user",
    );

    p.pattern(
      ["!numberFormat",],
      function (this: ProjectFileParser,): unknown {
        this.project?.set("numberFormat", this.val[0],);
        return null;
      },
    );

    p.pattern(
      ["_outputdir", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        const dir = String(this.val[1],);
        if (dir === "") {
          this.error("outdir_empty", "Output directory may not be empty.",);
        }
        // CCB: a validação de existência (outdir_missing) depende do
        // filesystem e é feita em tempo de geração de relatórios.
        this.project?.set(
          "outputDir",
          dir.endsWith("/",) ? dir : dir + "/",
        );
        return null;
      },
    );
    p.doc(
      "outputdir",
      "Specifies the directory into which the reports should be generated.",
    );
    p.arg(1, "directory", "Path to an existing directory",);

    p.pattern(["!scenario",],);
    p.pattern(["_shorttimeformat", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      this.project?.set("shortTimeFormat", this.val[1],);
      return null;
    },);
    p.doc(
      "shorttimeformat",
      "Specifies time format for short time specifications.",
    );
    p.arg(1, "format", "strftime like format string",);

    p.pattern(
      ["!timeformat",],
      function (this: ProjectFileParser,): unknown {
        this.project?.set("timeFormat", this.val[0],);
        return null;
      },
    );

    p.pattern(["!timezone",],);

    p.pattern(
      ["_timingresolution", "$INTEGER", "_min",],
      function (this: ProjectFileParser,): unknown {
        const goodValues = [5, 10, 15, 20, 30, 60,];
        const minutes = Number(this.val[1],);
        if (!goodValues.includes(minutes,)) {
          this.error(
            "bad_timing_res",
            `Timing resolution must be one of ${goodValues.join(", ",)} min.`,
            this.sourceFileInfo[1] ?? null,
          );
        }
        if (minutes > Project.maxScheduleGranularity() / 60) {
          this.error(
            "too_large_timing_res",
            "The maximum allowed timing resolution for the timezone is " +
              `${Project.maxScheduleGranularity() / 60} minutes.`,
            this.sourceFileInfo[1] ?? null,
          );
        }
        this.project?.set("scheduleGranularity", minutes * 60,);
        return null;
      },
    );
    p.doc(
      "timingresolution",
      "Sets the minimum timing resolution. The default and maximum value " +
        "is 1 hour. The smallest value is 5 min.",
    );

    p.pattern(
      ["_trackingscenario", "!scenarioId",],
      function (this: ProjectFileParser,): unknown {
        const idx = Number(this.val[1],);
        this.project?.set("trackingScenarioIdx", idx,);
        // O tracking scenario e os cenários derivados são sempre
        // agendados em modo projection.
        this.project?.scenario(idx,)?.all().forEach((scenario,) => {
          scenario.set("projection", true,);
        },);
        return null;
      },
    );
    p.doc(
      "trackingscenario",
      "Specifies which scenario is used to capture what actually has " +
        "happened with the project. Must be defined after all scenarios.",
    );

    p.pattern(
      ["_weekstartsmonday",],
      function (this: ProjectFileParser,): unknown {
        this.project?.set("weekStartsMonday", true,);
        return null;
      },
    );
    p.doc(
      "weekstartsmonday",
      "Base all week calculation on weeks starting on Monday.",
    );

    p.pattern(
      ["_weekstartssunday",],
      function (this: ProjectFileParser,): unknown {
        this.project?.set("weekStartsMonday", false,);
        return null;
      },
    );
    p.doc(
      "weekstartssunday",
      "Base all week calculation on weeks starting on Sunday.",
    );

    p.pattern(["!workinghoursProject",],);

    p.pattern(
      ["_yearlyworkingdays", "!number",],
      function (this: ProjectFileParser,): unknown {
        this.project?.set("yearlyworkingdays", Number(this.val[1],),);
        return null;
      },
    );
    p.doc(
      "yearlyworkingdays",
      "Specifies the number of average working days per year. It affects " +
        "the conversion of working time units into each other.",
    );
    p.arg(1, "days", "Number of average working days for a year",);
  },);

  // `include` dentro do cabeçalho do projeto: `_include <arquivo> <attrs> .`
  rule(p, "projectBodyInclude", () => {
    p.pattern(
      ["_include", "!includeFile", "!projectBodyAttributes", ".",],
      function (this: ProjectFileParser,): unknown {
        return this.val[1];
      },
    );
    p.lastSyntaxToken(1,);
    p.doc(
      "include.project",
      "Includes the specified file as if its contents were written instead " +
        "of the include attribute. May only be used inside the project " +
        "header section.",
    );
  },);

  // ------------------------------------------------------------------
  // include
  // ------------------------------------------------------------------
  rule(p, "includeFile", () => {
    p.pattern(
      ["!includeFileName",],
      function (this: ProjectFileParser,): unknown {
        // Ruby rule_includeFile (TjpSyntaxRules.rb l.1940-1946): o erro é
        // reportado sem sfi explícito → linha do último token (a STRING).
        if (!this.project) {
          this.error(
            "include_before_project",
            "You must declare the project header before you include other " +
              "files.",
          );
        }
        return this.val[0];
      },
    );
  },);

  rule(p, "includeFileName", () => {
    p.pattern(
      ["$STRING",],
      function (this: ProjectFileParser,): unknown {
        const fileName = String(this.val[0],);
        if (fileName.slice(-4,) !== ".tji") {
          this.error(
            "bad_include_suffix",
            `Included files must have a '.tji' extension: '${fileName}'`,
            this.sourceFileInfo[0] ?? null,
          );
        }
        this.pushFileStack();
        return fileName;
      },
    );
    p.arg(
      0,
      "filename",
      "Name of the file to include. Must have a '.tji' extension.",
    );
  },);

  rule(p, "prologInclude", () => {
    p.pattern(
      ["_include", "!includeFile", "!projectProlog", ".",],
      function (this: ProjectFileParser,): unknown {
        return this.val[1];
      },
    );
    p.lastSyntaxToken(1,);
    p.doc(
      "include.macro",
      "Includes a file that may only contain macro definitions. Can only " +
        "be used before the project header.",
    );
  },);

  // ------------------------------------------------------------------
  // properties
  // ------------------------------------------------------------------
  rule(p, "properties", () => {
    p.singlePattern("!propertiesBody",);
  },);

  rule(p, "propertiesBody", () => {
    p.repeatable();
    p.optional();

    p.pattern(["!account",],);

    p.pattern(
      ["_auxdir", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        let auxdir = String(this.val[1],);
        if (!auxdir.endsWith("/",)) auxdir += "/";
        this.project?.set("auxdir", auxdir,);
        return null;
      },
    );
    p.doc(
      "auxdir",
      "Specifies an alternative directory for the auxiliary report files " +
        "such as CSS, JavaScript and icon files.",
    );

    p.pattern(
      ["_copyright", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        this.project?.set("copyright", this.val[1],);
        return null;
      },
    );
    p.doc(
      "copyright",
      "Set a copyright notice for the project file and its content.",
    );

    p.pattern(["!balance",],);

    p.pattern(
      ["_flags", "!declareFlagList",],
      function (this: ProjectFileParser,): unknown {
        const flags = listAttr(this, "flags",) as string[];
        const added = this.val[1] as string[];
        for (const flag of added) {
          if (!flags.includes(flag,)) flags.push(flag,);
        }
        return null;
      },
    );
    p.doc(
      "flags",
      "Declare one or more flags for later use. Flags can be used to mark " +
        "tasks, resources or other properties to filter them in reports.",
    );

    p.pattern(["!propertiesInclude",],);

    p.pattern(["!leaves",],);

    p.pattern(["!limits",],);

    p.pattern(["!macro",],);

    p.pattern(["!material",],);

    p.pattern(["!navigator",],);

    p.pattern(
      ["_projectid", "$ID",],
      function (this: ProjectFileParser,): unknown {
        const ids = listAttr(this, "projectids",) as string[];
        const id = String(this.val[1],);
        if (!ids.includes(id,)) ids.push(id,);
        this.project?.set("projectid", id,);
        this.projectId = id;
        return null;
      },
    );
    p.doc(
      "projectid",
      "Declares a new project id and activates it. All subsequent task " +
        "definitions will inherit this ID.",
    );

    p.pattern(
      ["_projectids", "!projectIDs",],
      function (this: ProjectFileParser,): unknown {
        const ids = listAttr(this, "projectids",) as string[];
        for (const id of this.val[1] as string[]) {
          if (!ids.includes(id,)) ids.push(id,);
        }
        return null;
      },
    );
    p.doc(
      "projectids",
      "Declares a list of project IDs for include files generated from " +
        "other projects.",
    );

    p.pattern(
      ["_rate", "!number",],
      function (this: ProjectFileParser,): unknown {
        this.project?.set("rate", Number(this.val[1],),);
        return null;
      },
    );
    p.doc(
      "rate",
      "Set the default rate for all subsequently defined resources.",
    );

    p.pattern(["!reportProperties",],);
    p.pattern(["!resource",],);
    p.pattern(["!shift",],);
    p.pattern(["!statusSheet",],);

    p.pattern(["_supplement", "!supplement",],);
    p.doc(
      "supplement",
      "Add more attributes to already defined accounts, tasks or resources.",
    );

    p.pattern(["!task",],);
    p.pattern(["!timeSheet",],);

    p.pattern(
      ["_vacation", "!vacationName", "!intervals",],
      function (this: ProjectFileParser,): unknown {
        // Fiel a resource.ts/shift.ts: as férias globais viram `Leave` com
        // `interval`. O `Project#initScoreboards` espera `.interval.start/end`.
        const leaves = (this.val[2] as ScoreboardInterval[]).map(
          (iv,) => new Leave("holiday", iv,),
        );
        this.appendScListAttribute("leaves", leaves,);
        return null;
      },
    );
    p.doc(
      "vacation",
      "Specify a global vacation period for all subsequently defined " +
        "resources.",
    );
    p.arg(1, "name", "Name or purpose of the vacation",);
  },);

  rule(p, "propertiesInclude", () => {
    p.pattern(["_include", "!includeProperties", "!properties", ".",],);
    p.lastSyntaxToken(1,);
    p.doc(
      "include.properties",
      "Includes the specified file name as if its contents would be written " +
        "instead of the include property. The only exception is the include " +
        "statement itself. When the included files contains other include " +
        "statements or report definitions, the filenames are relative to the " +
        "file where they are defined in. include commands can be used in the " +
        "project header, at global scope or between property declarations " +
        "of tasks, resources, and accounts.",
    );
  },);

  rule(p, "includeProperties", () => {
    p.pattern(
      ["!includeFileName", "!includeAttributes",],
      function (this: ProjectFileParser,): unknown {
        this.project?.inputFiles.push(
          this.scannerRef!.include(
            String(this.val[0],),
            this.sourceFileInfo[0] ?? null,
            () => this.popFileStack(),
          ),
        );
        return null;
      },
    );
  },);

  rule(p, "includeAttributes", () => {
    p.optionsRule("includeAttributesBody",);
  },);

  rule(p, "includeAttributesBody", () => {
    p.optional();
    p.repeatable();

    const prefixSetter = (variable: string,): () => void =>
      function (this: ProjectFileParser,): void {
        // `!accountId` et al. casam com PropertyTreeNode do bloco
        // correspondente; usamos o getter TS `fullId`.
        (this as unknown as Record<string, string>)[variable] =
          (this.val[1] as PropertyTreeNode).fullId;
      };

    p.pattern(
      ["_accountprefix", "!accountId",],
      prefixSetter("accountprefix",),
    );
    p.doc(
      "accountprefix",
      "Insert the accounts of the included file as sub-accounts of the " +
        "account specified by ID.",
    );
    p.arg(1, "account ID", "The absolute ID of an already defined account",);

    p.pattern(["_reportprefix", "!reportId",], prefixSetter("reportprefix",),);
    p.doc(
      "reportprefix",
      "Insert the reports of the included file as sub-reports of the " +
        "report specified by ID.",
    );
    p.arg(1, "report ID", "The absolute ID of an already defined report.",);

    p.pattern(
      ["_resourceprefix", "!resourceId",],
      prefixSetter("resourceprefix",),
    );
    p.doc(
      "resourceprefix",
      "Insert the resources of the included file as sub-resources of the " +
        "resource specified by ID.",
    );
    p.arg(1, "resource ID", "The ID of an already defined resource",);

    p.pattern(["_taskprefix", "!taskId",], prefixSetter("taskprefix",),);
    p.doc(
      "taskprefix",
      "Insert the tasks of the included file as sub-tasks of the task " +
        "specified by ID.",
    );
    p.arg(1, "task ID", "The absolute ID of an already defined task.",);
  },);

  // ------------------------------------------------------------------
  // Apoios usados pelo bloco project
  // ------------------------------------------------------------------
  rule(p, "color", () => {
    p.pattern(
      ["$STRING",],
      function (this: ProjectFileParser,): unknown {
        const col = String(this.val[0],);
        if (
          !/^#[0-9A-Fa-f]{3}$/.test(col,) && !/^#[0-9A-Fa-f]{6}$/.test(col,)
        ) {
          this.error(
            "bad_color",
            "Color values must be specified as '#RGB' or '#RRGGBB' values",
            this.sourceFileInfo[0] ?? null,
          );
        }
        return col;
      },
    );
    p.arg(0, "color", "RGB color value: #RGB or #RRGGBB",);
  },);

  rule(p, "alertLevel", () => {
    p.pattern(
      ["$ID",],
      function (this: ProjectFileParser,): unknown {
        const levels = alertLevels(this,);
        const level = levels.find((l,) => l[0] === this.val[0]) ?? null;
        if (!level) {
          this.error(
            "bad_alert",
            `Unknown alert level ${String(this.val[0],)}. Must be one of ` +
              levels.map((l,) => l[0]).join(", ",),
            this.sourceFileInfo[0] ?? null,
          );
        }
        return level;
      },
    );
    p.arg(
      0,
      "alert level",
      "By default supported values are 'green', 'yellow' and 'red'.",
    );
  },);

  rule(p, "alertLevelDefinition", () => {
    p.pattern(
      ["$ID", "$STRING", "!color",],
      function (this: ProjectFileParser,): unknown {
        return [this.val[0], this.val[1], this.val[2],];
      },
    );
    p.arg(0, "ID", "A unique ID for the alert level",);
    p.arg(1, "color name", "A unique name of the alert level color",);
  },);

  rule(p, "alertLevelDefinitions", () => {
    p.listRule("moreAlertLevelDefinitions", "!alertLevelDefinition",);
  },);

  rule(p, "currencyFormat", () => {
    p.pattern(
      [
        "_currencyformat",
        "$STRING",
        "$STRING",
        "$STRING",
        "$STRING",
        "$INTEGER",
      ],
      function (this: ProjectFileParser,): unknown {
        return new RealFormat([
          String(this.val[1],),
          String(this.val[2],),
          String(this.val[3],),
          String(this.val[4],),
          Number(this.val[5],),
        ],);
      },
    );
    p.doc(
      "currencyformat",
      "These values specify the default format used for all currency values.",
    );
  },);

  rule(p, "numberFormat", () => {
    p.pattern(
      [
        "_numberformat",
        "$STRING",
        "$STRING",
        "$STRING",
        "$STRING",
        "$INTEGER",
      ],
      function (this: ProjectFileParser,): unknown {
        return new RealFormat([
          String(this.val[1],),
          String(this.val[2],),
          String(this.val[3],),
          String(this.val[4],),
          Number(this.val[5],),
        ],);
      },
    );
    p.doc(
      "numberformat",
      "These values specify the default format used for all numerical " +
        "real values.",
    );
  },);

  rule(p, "timeformat", () => {
    p.pattern(["_timeformat", "$STRING",], function (
      this: ProjectFileParser,
    ): unknown {
      return this.val[1];
    },);
    p.doc(
      "timeformat",
      "Determines how time specifications in reports look like.",
    );
    p.arg(1, "format", "strftime like format string",);
  },);

  rule(p, "timezone", () => {
    p.pattern(
      ["_timezone", "!validTimeZone",],
      function (this: ProjectFileParser,): unknown {
        TjTime.setTimeZone(String(this.val[1],),);
        this.project?.set("timezone", this.val[1],);
        return null;
      },
    );
    p.doc(
      "timezone",
      "Sets the default time zone of the project. All dates and times " +
        "that have no time zones specified will be assumed to be in this " +
        "time zone. If no time zone is specified, UTC is assumed.",
    );
    p.arg(1, "zone", "Time zone to use. E. g. 'Europe/Berlin'",);
  },);

  rule(p, "validTimeZone", () => {
    p.pattern(
      ["$STRING",],
      function (this: ProjectFileParser,): unknown {
        if (!TjTime.checkTimeZone(String(this.val[0],),)) {
          this.error(
            "bad_time_zone",
            `${String(this.val[0],)} is not a known time zone`,
            this.sourceFileInfo[0] ?? null,
          );
        }
        return this.val[0];
      },
    );
  },);

  rule(p, "extendProperty", () => {
    p.pattern(
      ["!extendPropertyId",],
      function (this: ProjectFileParser,): unknown {
        switch (String(this.val[0],)) {
          case "task":
            this.ruleToExtend = this.rules.get("taskAttributes",) ?? null;
            this.ruleToExtendWithScenario = this.rules.get(
              "taskScenarioAttributes",
            ) ?? null;
            this.propertySet = this.project?.tasks ?? null;
            break;
          case "resource":
            this.ruleToExtend = this.rules.get("resourceAttributes",) ?? null;
            this.ruleToExtendWithScenario = this.rules.get(
              "resourceScenarioAttributes",
            ) ?? null;
            this.propertySet = this.project?.resources ?? null;
            break;
        }
        return null;
      },
    );
  },);

  rule(p, "extendBody", () => {
    p.optionsRule("extendAttributes",);
  },);

  // workinghours ----------------------------------------------------
  const applyWorkinghours = function (this: ProjectFileParser,): unknown {
    const days = this.val[1] as boolean[];
    const times = this.val[2] as Array<[number, number,]>;
    let wh: WorkingHours | null = null;
    if (!this.property) {
      // Estamos alterando as working hours globais do projeto.
      wh = (this.project?.get("workinghours",) as WorkingHours) ?? null;
    } else {
      try {
        wh = this.property.getForScenario(
          "workinghours",
          this.scenarioIdx,
        ) as WorkingHours;
      } catch (_e) {
        wh = null;
      }
      if (!wh) {
        // A propriedade ainda não tem WorkingHours própria.
        const base = this.project?.get("workinghours",) as WorkingHours;
        wh = new WorkingHours(base,);
      }
    }
    if (!wh) return null;
    wh.timezone = (this.project?.get("timezone",) as string) ?? "UTC";
    try {
      for (let i = 0; i < 7; i++) {
        if (days[i]) wh.setWorkingHours(i, times,);
      }
    } catch (e) {
      this.error(
        "bad_workinghours",
        e instanceof Error ? e.message : String(e,),
      );
      return null;
    }
    if (this.property) {
      try {
        this.property.setForScenario("workinghours", wh, this.scenarioIdx,);
      } catch (e) {
        // Working hours podem ser redefinidas múltiplas vezes.
        if (!(e instanceof AttributeOverwrite)) throw e;
      }
    }
    return null;
  };

  rule(p, "workinghours", () => {
    p.pattern(
      ["_workinghours", "!listOfDays", "!listOfTimes",],
      applyWorkinghours,
    );
  },);

  rule(p, "workinghoursProject", () => {
    p.singlePattern("!workinghours",);
  },);
}
