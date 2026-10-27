/**
 * TjpSyntaxRules — bloco resource (subfase 10.12).
 *
 * Port das regras `resource*`, `booking` (resource-side), `leave*`,
 * `workinghoursResource` e apoios (`leafResourceId`, `undefResourceId`) de
 * `TjpSyntaxRules.rb`. As regras `workinghours*` de tempo e `bookingBody`
 * vivem em project.ts/task.ts; `taskId`, `valIntervals` etc. em common.ts.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb
 */
import { Task, } from "../../model/task.ts";
import { Resource, } from "../../model/resource.ts";
import { Leave, LeaveAllowance, LeaveList, } from "../../model/leave.ts";
import { Booking, } from "../../scheduling/booking.ts";
import { ScoreboardInterval, } from "../../time/scoreboard-interval.ts";
import { AttributeOverwrite, } from "../../model/errors.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { rule, } from "./helpers.ts";

const asProp = (parser: ProjectFileParser,): NonNullable<
  ProjectFileParser["property"]
> => parser.property!;

/** Registra o bloco de regras de recursos. */
export function registerResourceRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // resource / header / body / attributes
  // ------------------------------------------------------------------
  rule(p, "resource", () => {
    p.pattern(
      ["!resourceHeader", "!resourceBody",],
      function (this: ProjectFileParser,): unknown {
        this.property = asProp(this,).parent;
        return null;
      },
    );
    p.doc(
      "resource",
      "Tasks that have an effort specification need to have at least one " +
        "resource assigned to do the work. Use this property to define " +
        "resources or groups of resources. Resources have a global name " +
        "space. All IDs must be unique within the resources of the " +
        "project.",
    );
  },);

  rule(p, "resourceAttributes", () => {
    p.repeatable();
    p.optional();

    p.pattern(
      ["_email", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set("email", this.val[1],);
        return null;
      },
    );
    p.doc("email", "The email address of the resource.",);

    // Fase 10 Complemento C3.2.1 — `note` em recurso (porta de rule_taskNote).
    p.pattern(
      ["_note", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set(
          "note",
          this.newRichText(
            String(this.val[1],),
            this.sourceFileInfo[1] ?? null,
          ),
        );
        return null;
      },
    );
    p.doc("note.resource", "Attach a note to the resource.",);

    p.pattern(["!journalEntry",],);
    p.pattern(["!purge",],);
    p.pattern(["!resource",],);
    p.pattern(["!resourceScenarioAttributes",],);
    p.pattern(
      ["!scenarioIdCol", "!resourceScenarioAttributes",],
      function (this: ProjectFileParser,): unknown {
        this.scenarioIdx = 0;
        return null;
      },
    );

    p.pattern(
      ["_supplement", "!resourceId", "!resourceBody",],
      function (this: ProjectFileParser,): unknown {
        this.property = this.idStack.pop() ?? null;
        return null;
      },
    );
    p.doc(
      "supplement.resource",
      "The supplement keyword provides a mechanism to add more attributes " +
        "to already defined resources.",
    );
    p.example("Supplement", "resource",);

    // Outros atributos são adicionados automaticamente (dynamicAttributes).
  },);

  rule(p, "resourceBody", () => {
    p.optionsRule("resourceAttributes",);
  },);

  rule(p, "resourceHeader", () => {
    p.pattern(
      ["_resource", "!optionalID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        const project = this.project!;
        if (!this.property && this.resourceprefix !== "") {
          this.property = (project.resource(this.resourceprefix,)) ??
            this.property;
        }
        const id = this.val[1] as string | null;
        if (id && project.resource(id,)) {
          this.error(
            "resource_exists",
            `Resource ${id} has already been defined.`,
            this.sourceFileInfo[1] ?? this.getSourceFileInfo()!,
            this.property,
          );
        }
        this.property = new Resource(
          project,
          id,
          String(this.val[2],),
          this.property as Resource | null,
        );
        this.property.sourceFileInfo = this.sourceFileInfo[0] ?? null;
        this.property.inheritAttributes();
        this.scenarioIdx = 0;
        return null;
      },
    );
    p.arg(2, "name", "The name of the resource.",);
  },);

  // ------------------------------------------------------------------
  // IDs de recurso
  // ------------------------------------------------------------------
  rule(p, "resourceId", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      const id = (this.resourceprefix === "" ? "" : this.resourceprefix + ".") +
        String(this.val[0],);
      const resource = this.project!.resource(id,);
      if (!resource) {
        this.error(
          "resource_id_expected",
          `${id} is not a defined resource.`,
          this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
        );
      }
      return resource;
    },);
    p.arg(0, "resource", "The ID of a defined resource.",);
  },);

  rule(p, "leafResourceId", () => {
    p.pattern(
      ["!resourceId",],
      function (this: ProjectFileParser,): unknown {
        const resource = this.val[0] as Resource;
        if (resource && !resource.leaf()) {
          this.error(
            "leaf_resource_id_expected",
            `${resource.fullId} is not a leaf resource.`,
            this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
          );
        }
        return resource;
      },
    );
    p.arg(0, "resource", "The ID of a leaf resource.",);
  },);

  rule(p, "undefResourceId", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      return (this.resourceprefix === "" ? "" : this.resourceprefix + ".") +
        String(this.val[0],);
    },);
    p.arg(0, "resource", "The ID of a defined resource.",);
  },);

  rule(p, "resourceLeafList", () => {
    p.listRule("moreResourceLeafList", "!leafResourceId",);
  },);

  rule(p, "resourceList", () => {
    p.listRule("moreResources", "!undefResourceId",);
  },);

  // ------------------------------------------------------------------
  // Atributos de cenário do recurso
  // ------------------------------------------------------------------
  rule(p, "resourceScenarioAttributes", () => {
    p.pattern(["!chargeset",],);

    p.pattern(
      ["_efficiency", "!number",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario(
          "efficiency",
          this.val[1],
          this.scenarioIdx,
        );
        return null;
      },
    );
    p.doc(
      "efficiency",
      "The efficiency factor of the resource, as percentage.",
    );
    p.example("Efficiency",);

    p.pattern(["!flags",],);
    p.doc("flags.resource", "Flags assigned to the resource.",);

    p.pattern(["_booking", "!resourceBooking",],);
    p.also("scheduling booking.task",);
    p.doc(
      "booking.resource",
      "Report actually completed work for the resource.",
    );
    p.example("Booking",);

    p.pattern(["!fail",],);

    p.pattern(["!leaveAllowances",],);

    p.pattern(
      ["!leaves",],
      function (this: ProjectFileParser,): unknown {
        this.appendScListAttribute(
          "leaves",
          this.val[0] as Leave[],
        );
        return null;
      },
    );

    p.pattern(
      ["!limits",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario(
          "limits",
          this.val[0],
          this.scenarioIdx,
        );
        return null;
      },
    );
    p.doc("limits", "Limits the working hours of the resource.",);
    p.example("Limits-1", "6",);

    p.pattern(
      ["_managers", "!resourceList",],
      function (this: ProjectFileParser,): unknown {
        this.appendScListAttribute("managers", this.val[1] as string[],);
        return null;
      },
    );
    p.doc(
      "managers",
      "The resources that are responsible for this resource.",
    );
    p.also("statussheet",);
    p.example("Manager",);

    p.pattern(
      ["_rate", "!number",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario("rate", this.val[1], this.scenarioIdx,);
        return null;
      },
    );
    p.doc("rate", "The base pay rate of the resource.",);

    const applyShiftAssignments = function (
      this: ProjectFileParser,
    ): unknown {
      this.checkContainer("shifts",);
      try {
        // Re-seta o mesmo valor para marcar o atributo como 'provided'.
        asProp(this,).setForScenario(
          "shifts",
          this.shiftAssignments,
          this.scenarioIdx,
        );
      } catch (e) {
        // Múltiplas atribuições de shift são idiomáticas: não avisa.
        if (!(e instanceof AttributeOverwrite)) throw e;
      }
      this.shiftAssignments = null;
      return null;
    };

    p.pattern(
      ["!resourceShiftAssignments", "!shiftAssignments",],
      applyShiftAssignments,
    );
    p.level("deprecated",);
    p.also("shifts.resource",);
    p.doc(
      "shift.resource",
      "Deprecated. Use 'shifts { ... }' instead.",
    );

    p.pattern(
      ["!resourceShiftsAssignments", "!shiftAssignments",],
      applyShiftAssignments,
    );
    p.doc(
      "shifts.resource",
      "Assigns shifts to the resource, optionally with a period.",
    );

    p.pattern(
      ["_vacation", "!vacationName", "!intervals",],
      function (this: ProjectFileParser,): unknown {
        // O atributo antigo 'vacation' mapeia para feriados públicos.
        const leaves = (this.val[2] as ScoreboardInterval[]).map(
          (iv,) => new Leave("holiday", iv,),
        );
        this.appendScListAttribute("leaves", leaves,);
        return null;
      },
    );
    p.doc("vacation.resource", "Vacation period of the resource.",);

    p.pattern(["!warn",],);

    p.pattern(["!workinghoursResource",],);
    // Outros atributos são adicionados automaticamente.
  },);

  rule(p, "workinghoursResource", () => {
    p.singlePattern("!workinghours",);
    p.doc(
      "workinghours.resource",
      "The default working hours of the resource.",
    );
    p.also("workinghours.project workinghours.shift",);
  },);

  rule(p, "resourceShiftAssignments", () => {
    p.pattern(["_shift",], function (this: ProjectFileParser,): unknown {
      this.shiftAssignments = asProp(this,).getForScenario(
        "shifts",
        this.scenarioIdx,
      );
      return null;
    },);
  },);

  rule(p, "resourceShiftsAssignments", () => {
    p.pattern(["_shifts",], function (this: ProjectFileParser,): unknown {
      this.shiftAssignments = asProp(this,).getForScenario(
        "shifts",
        this.scenarioIdx,
      );
      return null;
    },);
  },);

  // ------------------------------------------------------------------
  // Booking (resource-side)
  // ------------------------------------------------------------------
  rule(p, "resourceBooking", () => {
    p.pattern(
      ["!resourceBookingHeader", "!bookingBody",],
      function (this: ProjectFileParser,): unknown {
        const scenario = this.project!.scenario(this.scenarioIdx,);
        if (!scenario?.get("ownbookings",)) {
          this.error(
            "no_own_resource_booking",
            `The scenario ${scenario?.fullId} inherits its bookings from ` +
              "the tracking scenario. You cannot specify additional " +
              "bookings for it.",
          );
        }
        const booking = this.val[0] as Booking;
        booking.task.addBooking(this.scenarioIdx, booking,);
        return null;
      },
    );
  },);

  rule(p, "resourceBookingHeader", () => {
    p.pattern(
      ["!taskId", "!valIntervals",],
      function (this: ProjectFileParser,): unknown {
        const task = this.val[0] as Task;
        const resource = asProp(this,) as unknown as Resource;
        this.checkBooking(task, resource,);
        const booking = new Booking(
          resource,
          task,
          (this.val[1] as unknown[]) as never,
        );
        booking.sourceFileInfo = this.sourceFileInfo[0] ?? null;
        this.booking = booking;
        return booking;
      },
    );
    p.arg(0, "id", "Absolute ID of a defined task",);
  },);

  // ------------------------------------------------------------------
  // Leaves / licenças
  // ------------------------------------------------------------------
  rule(p, "leaves", () => {
    p.pattern(
      ["_leaves", "!leaveList",],
      function (this: ProjectFileParser,): unknown {
        return LeaveList.from(this.val[1] as Leave[],);
      },
    );
    p.doc(
      "leaves",
      "Time periods where the resource is not available.",
    );
    p.example("Leave",);
  },);

  rule(p, "leaveList", () => {
    p.listRule("moreLeaveList", "!leave",);
  },);

  rule(p, "leave", () => {
    p.pattern(
      ["!leaveType", "!vacationName", "!intervalOrDate",],
      function (this: ProjectFileParser,): unknown {
        return new Leave(
          String(this.val[0],),
          this.val[2] as never,
          this.val[1] as string | null,
        );
      },
    );
  },);

  rule(p, "leaveName", () => {
    p.optional();
    p.pattern(
      ["$STRING",],
      function (this: ProjectFileParser,): unknown {
        return this.val[0];
      },
    );
    p.arg(0, "name", "An optional name or reason for the leave",);
  },);

  rule(p, "leaveType", () => {
    p.singlePattern("_project",);
    p.descr("Assignment to another project (lowest priority)",);

    p.singlePattern("_annual",);
    p.descr("Personal leave based on annual allowance",);

    p.singlePattern("_special",);
    p.descr("Personal leave based on a special occasion",);

    p.singlePattern("_sick",);
    p.descr("Sick leave",);

    p.singlePattern("_unpaid",);
    p.descr("Unpaid leave",);

    p.singlePattern("_holiday",);
    p.descr("Public or bank holiday",);

    p.singlePattern("_unemployed",);
    p.descr("Not employeed (highest priority)",);
  },);

  rule(p, "leaveAllowance", () => {
    p.pattern(
      ["_annual", "!valDate", "!optionalMinus", "!nonZeroWorkingDuration",],
      function (this: ProjectFileParser,): unknown {
        return new LeaveAllowance(
          "annual",
          this.val[1] as never,
          (this.val[2] ? -1 : 1) * (this.val[3] as number),
        );
      },
    );
  },);

  rule(p, "leaveAllowanceList", () => {
    p.listRule("moreLeaveAllowanceList", "!leaveAllowance",);
  },);

  rule(p, "leaveAllowances", () => {
    p.pattern(
      ["_leaveallowances", "!leaveAllowanceList",],
      function (this: ProjectFileParser,): unknown {
        this.appendScListAttribute(
          "leaveallowances",
          this.val[1] as unknown[],
        );
        return null;
      },
    );
    p.doc(
      "leaveallowances",
      "Annual leave allowances for personal leave.",
    );
    p.level("beta",);
    p.example("Leave",);
  },);
}
