/**
 * TjpSyntaxRules — bloco shift (subfase 10.12).
 *
 * Port das regras `shift*` e do apoio `validTimeZone` de
 * `TjpSyntaxRules.rb`. `workinghoursShift` reusa `workinghours` (project.ts).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb
 */
import { Shift, } from "../../model/shift.ts";
import { Leave, } from "../../model/leave.ts";
import { TjTime, } from "../../time/tj-time.ts";
import { ScoreboardInterval, } from "../../time/scoreboard-interval.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { rule, } from "./helpers.ts";

const asProp = (parser: ProjectFileParser,): NonNullable<
  ProjectFileParser["property"]
> => parser.property!;

/** Registra o bloco de regras de turnos. */
export function registerShiftRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // shift / header / body / attributes
  // ------------------------------------------------------------------
  rule(p, "shift", () => {
    p.pattern(
      ["!shiftHeader", "!shiftBody",],
      function (this: ProjectFileParser,): unknown {
        this.property = asProp(this,).parent;
        return null;
      },
    );
    p.doc(
      "shift",
      "Shifts define the working hours of resources.",
    );
    p.also("shifts.task shifts.resource",);
  },);

  rule(p, "shiftAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(["!shift",],);
    p.pattern(["!shiftScenarioAttributes",],);
    p.pattern(
      ["!scenarioIdCol", "!shiftScenarioAttributes",],
      function (this: ProjectFileParser,): unknown {
        this.scenarioIdx = 0;
        return null;
      },
    );
  },);

  rule(p, "shiftBody", () => {
    p.optionsRule("shiftAttributes",);
  },);

  rule(p, "shiftHeader", () => {
    p.pattern(
      ["_shift", "!optionalID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        const project = this.project!;
        const id = this.val[1] as string | null;
        if (id && project.shift(id,)) {
          this.error(
            "shift_exists",
            `Shift ${id} has already been defined.`,
            this.sourceFileInfo[1] ?? this.getSourceFileInfo()!,
          );
        }
        this.property = new Shift(
          project,
          id,
          String(this.val[2],),
          this.property as Shift | null,
        );
        this.property.sourceFileInfo = this.sourceFileInfo[0] ?? null;
        this.property.inheritAttributes();
        this.scenarioIdx = 0;
        return null;
      },
    );
    p.arg(2, "name", "The name of the shift.",);
  },);

  rule(p, "shiftId", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      const shift = this.project!.shift(String(this.val[0],),);
      if (!shift) {
        this.error(
          "shift_id_expected",
          `${String(this.val[0],)} is not a defined shift.`,
          this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
        );
      }
      return shift;
    },);
    p.arg(0, "shift", "The ID of a defined shift",);
  },);

  // ------------------------------------------------------------------
  // Atributos de cenário do shift
  // ------------------------------------------------------------------
  rule(p, "shiftScenarioAttributes", () => {
    p.pattern(
      ["!leaves",],
      function (this: ProjectFileParser,): unknown {
        this.appendScListAttribute("leaves", this.val[0] as Leave[],);
        return null;
      },
    );

    p.pattern(
      ["_replace",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario("replace", true, this.scenarioIdx,);
        return null;
      },
    );
    p.doc(
      "replace",
      "In replace mode the leave definitions of the shift replace all " +
        "the leave definitions of the resource for the given period.",
    );

    p.pattern(
      ["_timezone", "!validTimeZone",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario(
          "timezone",
          this.val[1],
          this.scenarioIdx,
        );
        return null;
      },
    );
    p.doc(
      "timezone.shift",
      "Sets the time zone of the shift. The working hours of the shift " +
        "are assumed to be within the specified time zone.",
    );
    p.arg(1, "zone", "Time zone to use. E. g. 'Europe/Berlin'.",);

    p.pattern(
      ["_vacation", "!vacationName", "!intervalsOptional",],
      function (this: ProjectFileParser,): unknown {
        // O atributo antigo 'vacation' mapeia para feriados públicos.
        const leaves = ((this.val[2] as ScoreboardInterval[] | null) ?? [])
          .map((iv,) => new Leave("holiday", iv,));
        this.appendScListAttribute("leaves", leaves,);
        return null;
      },
    );
    p.doc("vacation.shift", "Specify a vacation period for this shift.",);

    p.pattern(["!workinghoursShift",],);
  },);

  rule(p, "workinghoursShift", () => {
    p.singlePattern("!workinghours",);
    p.doc(
      "workinghours.shift",
      "The working hours of the shift.",
    );
    p.also("workinghours.project workinghours.resource",);
  },);

  // ------------------------------------------------------------------
  // Apoio: fuso horário válido (usado por shift e tracking).
  // ------------------------------------------------------------------
  rule(p, "validTimeZone", () => {
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      const zone = String(this.val[0],);
      if (!TjTime.checkTimeZone(zone,)) {
        this.error(
          "bad_time_zone",
          `${zone} is not a known time zone`,
          this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
        );
      }
      return zone;
    },);
  },);
}
