/**
 * TjpSyntaxRules — regras comuns (subfase 10.11.1).
 *
 * Port do miolo alfabético de `TjpSyntaxRules.rb` que não pertence a um
 * bloco específico: datas, intervalos, números/durações, dias da semana,
 * horários, cenários, macros, supplement e utilitários de lista.
 *
 * As actions são funções não-arrow: `this` é o ProjectFileParser e os
 * valores dos tokens estão em `this.val` (equivalente ao @val do Ruby).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb
 */
import { TjTime, } from "../../time/tj-time.ts";
import { Project, } from "../../model/project.ts";
import { TimeInterval, } from "../../time/time-interval.ts";
import { Macro, } from "../../lexer/macro-table.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { rule, } from "./helpers.ts";

const asTime = (v: unknown,): TjTime => v as TjTime;
const asIv = (v: unknown,): TimeInterval => v as TimeInterval;

/** Fatores de conversão de calendário (segundos por unidade). */
const CONV_CAL = [60, 3600, 86400, 604800, 2629440.48, 31536000,];

/**
 * Fatores de conversão de trabalho (dias/semanas/etc. usam horas de
 * trabalho diárias do projeto). Índices 2+ dependem do projeto.
 */
function convWork(parser: ProjectFileParser,): number[] {
  const daily = (parser.project?.get("dailyworkinghours",) as number) ?? 8;
  const yearly = (parser.project?.get("yearlyworkingdays",) as number) ??
    260.714;
  const weekly = parser.project ? parser.project.weeklyWorkingDays() : 5;
  return [
    60,
    3600,
    3600 * daily,
    3600 * daily * weekly,
    3600 * daily * (yearly / 12),
    3600 * daily * yearly,
  ];
}

function granularity(parser: ProjectFileParser,): number {
  return (parser.project?.get("scheduleGranularity",) as number) ?? 3600;
}

/** Registra o bloco de regras comuns. */
export function registerCommonRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // Números e durações
  // ------------------------------------------------------------------
  rule(p, "number", () => {
    p.singlePattern("$INTEGER",);
    p.singlePattern("$FLOAT",);
  },);

  rule(p, "durationUnit", () => {
    p.pattern(["_min",], function (this: ProjectFileParser,): unknown {
      return 0;
    },);
    p.descr("minutes",);
    p.pattern(["_h",], () => 1,);
    p.descr("hours",);
    p.pattern(["_d",], () => 2,);
    p.descr("days",);
    p.pattern(["_w",], () => 3,);
    p.descr("weeks",);
    p.pattern(["_m",], () => 4,);
    p.descr("months",);
    p.pattern(["_y",], () => 5,);
    p.descr("years",);
  },);

  rule(p, "durationUnitOrPercent", () => {
    p.pattern(["_%",], () => -1,);
    p.descr("percentage of reported period",);
    p.pattern(["_min",], () => 0,);
    p.descr("minutes",);
    p.pattern(["_h",], () => 1,);
    p.descr("hours",);
    p.pattern(["_d",], () => 2,);
    p.descr("days",);
  },);

  rule(p, "workingDuration", () => {
    p.pattern(
      ["!number", "!durationUnit",],
      function (this: ProjectFileParser,): unknown {
        const factors = convWork(this,);
        // The result will always be in number of time slots.
        return Math.round(
          (Number(this.val[0],) * factors[Number(this.val[1],)]!) /
            granularity(this,),
        );
      },
    );
    p.arg(0, "value", "A floating point or integer number",);
  },);

  rule(p, "nonZeroWorkingDuration", () => {
    p.pattern(
      ["!workingDuration",],
      function (this: ProjectFileParser,): unknown {
        const slots = Number(this.val[0],);
        if (slots <= 0) {
          this.error(
            "working_duration_too_small",
            "Duration values must be at least " +
              `${
                granularity(this,) / 60
              } minutes (your timingresolution) long.`,
          );
        }
        return slots;
      },
    );
  },);

  rule(p, "workingDurationPercent", () => {
    p.pattern(
      ["!number", "!durationUnitOrPercent",],
      function (this: ProjectFileParser,): unknown {
        const unit = Number(this.val[1],);
        if (unit >= 0) {
          // Absolute value in minutes, hours or days.
          const factors = convWork(this,);
          return Math.round(
            (Number(this.val[0],) * factors[unit]!) / granularity(this,),
          );
        }
        // Percentage values are always returned as float in [0.0, 1.0].
        if (Number(this.val[0],) < 0 || Number(this.val[0],) > 100) {
          this.error(
            "illegal_percentage",
            "Percentage values must be between 0 and 100%.",
            this.sourceFileInfo[1] ?? null,
          );
        }
        return Number(this.val[0],) / 100;
      },
    );
    p.arg(0, "value", "A floating point or integer number",);
  },);

  rule(p, "calendarDuration", () => {
    p.pattern(
      ["!number", "!durationUnit",],
      function (this: ProjectFileParser,): unknown {
        return Math.trunc(
          Number(this.val[0],) * CONV_CAL[Number(this.val[1],)]! /
            granularity(this,),
        );
      },
    );
    p.arg(0, "value", "A floating point or integer number",);
  },);

  rule(p, "intervalDuration", () => {
    p.pattern(
      ["!number", "!durationUnit",],
      function (this: ProjectFileParser,): unknown {
        const num = Number(this.val[0],);
        const unitIdx = Number(this.val[1],);
        if (num === 0) {
          this.error(
            "zero_duration",
            "The interval duration may not be 0.",
            this.sourceFileInfo[1] ?? null,
          );
        }
        let duration = Math.trunc(num * CONV_CAL[unitIdx]!,);
        const resolution = this.project ? granularity(this,) : 3600;
        if (unitIdx === 4) {
          // Months: align the duration with the timing resolution.
          duration = Math.trunc(duration / resolution,) * resolution;
        }
        if (duration % resolution !== 0) {
          this.error(
            "iv_duration_not_aligned",
            "The interval duration must be a multiple of the specified " +
              `timing resolution (${resolution / 60} min) of the project.`,
          );
        }
        return duration;
      },
    );
    p.arg(
      0,
      "duration",
      "The duration of the interval. May not be 0 and must be a multiple " +
        "of [[timingresolution]].",
    );
  },);

  // ------------------------------------------------------------------
  // Datas
  // ------------------------------------------------------------------
  rule(p, "date", () => {
    p.pattern(
      ["!dateCalcedOrNot",],
      function (this: ProjectFileParser,): unknown {
        const t = asTime(this.val[0],);
        // Ruby: `@project.nil? ? Project.maxScheduleGranularity :
        // @project['scheduleGranularity']`.
        const resolution = this.project
          ? granularity(this,)
          : Project.maxScheduleGranularity();
        if (t.toSeconds() % resolution !== 0) {
          this.error(
            "misaligned_date",
            "The date must be aligned to the timing resolution (" +
              `${resolution / 60} min) of the project.`,
            this.sourceFileInfo[0] ?? null,
          );
        }
        return t;
      },
    );
    p.doc(
      "date",
      "A DATE is a date and time specification similar to ISO 8601: " +
        "YYYY-MM-DD[-hh:mm[:ss]][-TIMEZONE]. Dates must be aligned with the " +
        "[[timingresolution]]. Simple date calculations are supported: " +
        "%{2009-11-01 + 8m}.",
    );
  },);

  rule(p, "dateCalcedOrNot", () => {
    p.singlePattern("$DATE",);
    p.pattern(
      ["_%", "_{", "$DATE", "!plusOrMinus", "!intervalDuration", "_}",],
      function (this: ProjectFileParser,): unknown {
        const base = asTime(this.val[2],);
        const seconds = Number(this.val[4],);
        return this.val[3] === "+"
          ? base.addSeconds(seconds,)
          : base.addSeconds(-seconds,);
      },
    );
  },);

  rule(p, "valDate", () => {
    p.pattern(
      ["!date",],
      function (this: ProjectFileParser,): unknown {
        const t = asTime(this.val[0],);
        const start = this.project?.get("start",) as TjTime | undefined;
        const end = this.project?.get("end",) as TjTime | undefined;
        if (
          start && end &&
          (t.toSeconds() < start.toSeconds() ||
            t.toSeconds() > end.toSeconds())
        ) {
          this.error(
            "date_in_range",
            `Date ${t.to_s()} must be within the project time frame ` +
              `${start.to_s()} - ${end.to_s()}`,
            this.sourceFileInfo[0] ?? null,
          );
        }
        return t;
      },
    );
  },);

  // ------------------------------------------------------------------
  // Intervalos
  // ------------------------------------------------------------------
  rule(p, "intervalEnd", () => {
    p.pattern(
      ["_-", "!date",],
      function (this: ProjectFileParser,): unknown {
        return [0, this.val[1],];
      },
    );
    p.pattern(
      ["_+", "!intervalDuration",],
      function (this: ProjectFileParser,): unknown {
        return [1, this.val[1],];
      },
    );
  },);

  rule(p, "intervalOptionalEnd", () => {
    p.optional();
    p.pattern(
      ["_-", "!date",],
      function (this: ProjectFileParser,): unknown {
        return [0, this.val[1],];
      },
    );
    p.pattern(
      ["_+", "!intervalDuration",],
      function (this: ProjectFileParser,): unknown {
        return [1, this.val[1],];
      },
    );
  },);

  const makeInterval = (parser: ProjectFileParser,): TimeInterval | null => {
    const start = asTime(parser.val[0],);
    const endSpec = parser.val[1] as [number, unknown,] | null | undefined;
    if (endSpec) {
      const [mode, spec,] = endSpec;
      if (mode === 0) {
        const end = asTime(spec,);
        if (start.toSeconds() >= end.toSeconds()) {
          parser.error(
            "start_before_end",
            `The end date (${end.to_s()}) must be after the start date ` +
              `(${start.to_s()}).`,
            parser.sourceFileInfo[0] ?? null,
          );
        }
        return new TimeInterval(start, end,);
      }
      return new TimeInterval(
        start,
        start.addSeconds(Number(spec,),),
      );
    }
    return new TimeInterval(start, start.sameTimeNextDay(),);
  };

  rule(p, "interval", () => {
    p.pattern(
      ["!date", "!intervalEnd",],
      function (this: ProjectFileParser,): unknown {
        return makeInterval(this,);
      },
    );
    p.doc(
      "interval2",
      "A date interval is either 'start - end' (both DATEs) or " +
        "'start + duration'. See [[timingresolution]].",
    );
  },);

  rule(p, "intervalOrDate", () => {
    p.pattern(
      ["!date", "!intervalOptionalEnd",],
      function (this: ProjectFileParser,): unknown {
        return makeInterval(this,);
      },
    );
    p.doc(
      "interval3",
      "Three forms: 'start - end', bare start (24h assumed) or " +
        "'start + duration'.",
    );
  },);

  rule(p, "valInterval", () => {
    p.pattern(
      ["!date", "!intervalEnd",],
      function (this: ProjectFileParser,): unknown {
        const iv = makeInterval(this,);
        if (iv) this.checkInterval(iv,);
        return iv;
      },
    );
  },);

  rule(p, "valIntervalOrDate", () => {
    p.pattern(
      ["!date", "!intervalOptionalEnd",],
      function (this: ProjectFileParser,): unknown {
        const iv = makeInterval(this,);
        if (iv) this.checkInterval(iv,);
        return iv;
      },
    );
  },);

  rule(p, "intervals", () => {
    p.listRule("moreIntervals", "!intervalOrDate",);
  },);

  rule(p, "valIntervals", () => {
    p.listRule("moreValIntervals", "!valIntervalOrDate",);
  },);

  rule(p, "intervalOptional", () => {
    p.optional();
    p.singlePattern("!interval",);
  },);

  rule(p, "intervalsOptional", () => {
    p.optional();
    p.singlePattern("!intervals",);
  },);

  // ------------------------------------------------------------------
  // IDs e dias/horas
  // ------------------------------------------------------------------
  rule(p, "idOrAbsoluteId", () => {
    p.singlePattern("$ID",);
    p.singlePattern("$ABSOLUTE_ID",);
  },);

  rule(p, "moreBangs", () => {
    p.optional();
    p.repeatable();
    p.singlePattern("_!",);
  },);

  rule(p, "relativeId", () => {
    p.pattern(
      ["_!", "!moreBangs", "!idOrAbsoluteId",],
      function (this: ProjectFileParser,): unknown {
        let str = "!";
        const bangs = this.val[1] as string[] | null;
        if (bangs) {
          for (const _bang of bangs) str += "!";
        }
        return str + String(this.val[2],);
      },
    );
  },);

  rule(p, "weekday", () => {
    const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat",];
    days.forEach((day, idx,) => {
      p.pattern([`_${day}`,], () => idx,);
    },);
  },);

  rule(p, "weekDayIntervalEnd", () => {
    p.optional();
    p.pattern(
      ["_-", "!weekday",],
      function (this: ProjectFileParser,): unknown {
        return this.val[1];
      },
    );
    p.arg(
      1,
      "end weekday",
      "Weekday (sun - sat). It is included in the interval.",
    );
  },);

  rule(p, "weekDayInterval", () => {
    p.pattern(
      ["!weekday", "!weekDayIntervalEnd",],
      function (this: ProjectFileParser,): unknown {
        const weekDays: boolean[] = [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
        ];
        const first = Number(this.val[0],);
        const last = this.val[1] === undefined || this.val[1] === null
          ? null
          : Number(this.val[1],);
        if (last === null) {
          weekDays[first] = true;
        } else {
          let d = first;
          for (;;) {
            weekDays[d] = true;
            if (d === last) break;
            d = (d + 1) % 7;
          }
        }
        return weekDays;
      },
    );
    p.arg(0, "weekday", "Weekday (sun - sat)",);
  },);

  rule(p, "moreListOfDays", () => {
    p.commaListRule("!weekDayInterval",);
  },);

  rule(p, "listOfDays", () => {
    p.pattern(
      ["!weekDayInterval", "!moreListOfDays",],
      function (this: ProjectFileParser,): unknown {
        const weekDays: boolean[] = [
          false,
          false,
          false,
          false,
          false,
          false,
          false,
        ];
        const lists = ([this.val[0],] as unknown[]).concat(
          (this.val[1] as unknown[] | null) ?? [],
        );
        for (const rawList of lists) {
          const dayList = rawList as boolean[];
          for (let i = 0; i < 7; i++) {
            if (dayList[i]) weekDays[i] = true;
          }
        }
        return weekDays;
      },
    );
  },);

  rule(p, "timeInterval", () => {
    p.pattern(
      ["$TIME", "_-", "$TIME",],
      function (this: ProjectFileParser,): unknown {
        if (Number(this.val[0],) >= Number(this.val[2],)) {
          this.error(
            "time_interval",
            "End time of interval must be larger than start time",
            this.sourceFileInfo[0] ?? null,
          );
        }
        return [this.val[0], this.val[2],];
      },
    );
  },);

  rule(p, "moreTimeIntervals", () => {
    p.commaListRule("!timeInterval",);
  },);

  rule(p, "listOfTimes", () => {
    p.pattern(["_off",], () => [],);
    p.pattern(
      ["!timeInterval", "!moreTimeIntervals",],
      function (this: ProjectFileParser,): unknown {
        return [this.val[0],].concat(
          (this.val[1] as unknown[] | null) ?? [],
        );
      },
    );
  },);

  // ------------------------------------------------------------------
  // Cenários
  // ------------------------------------------------------------------
  const scenarioIdxOf = (
    parser: ProjectFileParser,
    id: unknown,
    errId: string,
  ): number | undefined => {
    const idx = parser.project?.scenarioIdx(String(id,),);
    if (idx === undefined) {
      parser.error(
        errId,
        `Unknown scenario: ${String(id,)}`,
        parser.sourceFileInfo[0] ?? null,
      );
    }
    parser.scenarioIdx = idx ?? 0;
    return idx;
  };

  rule(p, "scenarioId", () => {
    p.pattern(
      ["$ID",],
      function (this: ProjectFileParser,): unknown {
        return scenarioIdxOf(this, this.val[0], "unknown_scenario_id",);
      },
    );
    p.arg(0, "scenario", "ID of a defined scenario",);
  },);

  rule(p, "scenarioIdx", () => {
    p.pattern(
      ["$ID",],
      function (this: ProjectFileParser,): unknown {
        return scenarioIdxOf(this, this.val[0], "unknown_scenario_idx",);
      },
    );
  },);

  rule(p, "scenarioIdCol", () => {
    p.pattern(
      ["$ID_WITH_COLON",],
      function (this: ProjectFileParser,): unknown {
        return scenarioIdxOf(this, this.val[0], "unknown_scenario_id",);
      },
    );
  },);

  rule(p, "optionalScenarioIdCol", () => {
    p.optional();
    p.pattern(
      ["$ID_WITH_COLON",],
      function (this: ProjectFileParser,): unknown {
        return scenarioIdxOf(this, this.val[0], "unknown_scenario_id",);
      },
    );
  },);

  rule(p, "scenarioIdList", () => {
    p.listRule("moreScnarioIdList", "!scenarioIdx",);
  },);

  // ------------------------------------------------------------------
  // Tokens simples
  // ------------------------------------------------------------------
  rule(p, "yesNo", () => {
    p.pattern(["_yes",], () => true,);
    p.pattern(["_no",], () => false,);
  },);

  rule(p, "allOrNone", () => {
    p.pattern(["_all",], () => 1,);
    p.pattern(["_none",], () => 0,);
  },);

  rule(p, "plusOrMinus", () => {
    p.singlePattern("_+",);
    p.singlePattern("_-",);
  },);

  rule(p, "optionalMinus", () => {
    p.optional();
    p.pattern(["_-",], () => true,);
  },);

  rule(p, "optionalPercent", () => {
    p.optional();
    p.pattern(
      ["!number", "_%",],
      function (this: ProjectFileParser,): unknown {
        return Number(this.val[0],) / 100;
      },
    );
  },);

  rule(p, "optionalID", () => {
    p.optional();
    p.pattern(
      ["$ID",],
      function (this: ProjectFileParser,): unknown {
        return this.val[0];
      },
    );
    p.arg(
      0,
      "id",
      "An optional ID. If you ever want to reference this property, you " +
        "must specify your own unique ID. If no ID is specified, one will " +
        "be automatically generated.",
    );
  },);

  rule(p, "optionalVersion", () => {
    p.optional();
    p.pattern(
      ["$STRING",],
      function (this: ProjectFileParser,): unknown {
        return this.val[0];
      },
    );
    p.arg(
      0,
      "version",
      'An optional version ID. If not specified, it defaults to "1.0".',
    );
  },);

  // ------------------------------------------------------------------
  // Macros e supplement
  // ------------------------------------------------------------------
  rule(p, "macro", () => {
    p.pattern(
      ["_macro", "$ID", "$MACRO",],
      function (this: ProjectFileParser,): unknown {
        const name = String(this.val[1],);
        if (this.scannerHasMacro(name,)) {
          this.warning("marco_redefinition", `Redefining macro ${name}`,);
        }
        this.addScannerMacro(
          new Macro(
            name,
            String(this.val[2],),
            this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
          ),
        );
        return null;
      },
    );
    p.doc(
      "macro",
      "Defines a text fragment inserted via ${ID}. Body in square " +
        "brackets: macro FOO [ This ${1} text ]. Arguments must be " +
        "double-quoted. ${?foo} expands to nothing if foo is undefined.",
    );
    p.example("Macro-1",);
  },);

  const suppSet = function (this: ProjectFileParser,): unknown {
    this.idStack.push(this.property,);
    this.property = this.val[1] as ProjectFileParser["property"];
    return null;
  };

  rule(p, "supplementTask", () => {
    p.pattern(["_task", "!taskId",], suppSet,);
    p.arg(1, "task ID", "The absolute ID of an already defined task.",);
  },);

  rule(p, "supplementResource", () => {
    p.pattern(["_resource", "!resourceId",], suppSet,);
    p.arg(1, "resource ID", "The ID of an already defined resource.",);
  },);

  rule(p, "supplementAccount", () => {
    p.pattern(["_account", "!accountId",], suppSet,);
    p.arg(1, "account ID", "The ID of an already defined account.",);
  },);

  rule(p, "supplementMaterial", () => {
    p.pattern(["_material", "!materialId",], suppSet,);
    p.arg(1, "material ID", "The ID of an already defined material.",);
  },);

  rule(p, "supplementReport", () => {
    p.pattern(["_report", "!reportId",], suppSet,);
    p.arg(1, "report ID", "The absolute ID of an already defined report.",);
  },);

  rule(p, "supplement", () => {
    const pop = function (this: ProjectFileParser,): unknown {
      this.property = this.idStack.pop() ?? null;
      return null;
    };
    p.pattern(["!supplementAccount", "!accountBody",], pop,);
    p.pattern(["!supplementMaterial", "!materialBody",], pop,);
    p.pattern(["!supplementReport", "!reportBody",], pop,);
    p.pattern(["!supplementResource", "!resourceBody",], pop,);
    p.pattern(["!supplementTask", "!taskBody",], pop,);
  },);

  // ------------------------------------------------------------------
  // Atributos dinâmicos de relatórios (usado por parseReportAttributes)
  // ------------------------------------------------------------------
  rule(p, "dynamicAttributes", () => {
    p.pattern(["!reportAttributes", ".",], null,);
  },);
}
