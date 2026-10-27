/**
 * TjpSyntaxRules — bloco task (subfase 10.11).
 *
 * Port das regras `task*`, `allocate*`/`allocation*`, `booking*`
 * (task-side), `journalEntry*`, `shiftAssignment*` e apoios de
 * `TjpSyntaxRules.rb`.
 *
 * Referências a regras de outros blocos (`resourceId`, `accountId`,
 * `chargeset`, `flags`, `limits`, `fail`, `warn`, `purge`,
 * `logicalExpression`, ...) são resolvidas por `ensurePlaceholders()`
 * até as subfases 10.12–10.14.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb
 */
import { TjTime, } from "../../time/tj-time.ts";
import { TimeInterval, } from "../../time/time-interval.ts";
import { Task, } from "../../model/task.ts";
import { Resource, } from "../../model/resource.ts";
import { JournalEntry, } from "../../model/journal.ts";
import { TaskDependency, } from "../../scheduling/task-dependency.ts";
import { Booking, } from "../../scheduling/booking.ts";
import { Allocation, } from "../../scheduling/allocation.ts";
import {
  ShiftAssignment,
  ShiftAssignments,
} from "../../scheduling/shift-assignments.ts";
import { Charge, } from "../../finance/charge.ts";
import { AttributeOverwrite, } from "../../model/errors.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { rule, } from "./helpers.ts";

const asTask = (v: unknown,): Task => v as Task;
const asProp = (parser: ProjectFileParser,): Task => parser.property as Task;

/** `@property['forward', @scenarioIdx] = value` tolerante a overwrite. */
function setForward(parser: ProjectFileParser, value: boolean,): void {
  try {
    asProp(parser,).setForScenario("forward", value, parser.scenarioIdx,);
  } catch (e) {
    if (!(e instanceof AttributeOverwrite)) throw e;
  }
}

/** Lê uma lista de cenário (charge/responsible etc.) com fallback []. */
function scList(parser: ProjectFileParser, attrId: string,): unknown[] {
  const prop = parser.property;
  if (!prop) return [];
  try {
    return (prop.getForScenario(attrId, parser.scenarioIdx,) as unknown[]) ??
      [];
  } catch (_e) {
    return [];
  }
}

/** Cria um Charge no critério de cenário corrente. */
function makeCharge(
  parser: ProjectFileParser,
  amount: number,
  mode: "onStart" | "onEnd" | "perDiem",
): Charge {
  return new Charge(amount, mode, asProp(parser,), parser.scenarioIdx,);
}

/** Registra o bloco de regras de tarefas. */
export function registerTaskRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // task / header / body
  // ------------------------------------------------------------------
  rule(p, "task", () => {
    p.pattern(
      ["!taskHeader", "!taskBody",],
      function (this: ProjectFileParser,): unknown {
        this.property = asProp(this,).parent;
        return null;
      },
    );
    p.doc(
      "task",
      "Tasks are the central elements of a project plan. Depending on the " +
        "attributes of that task, a task can be a container task, a " +
        "milestone or a regular leaf task.",
    );
  },);

  rule(p, "taskHeader", () => {
    p.pattern(
      ["_task", "!optionalID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        if (!this.property && this.taskprefix !== "") {
          this.property = this.project?.task(this.taskprefix,) ?? null;
        }
        const id = this.val[1] as string | null;
        if (id) {
          const fullId = (this.property ? asProp(this,).fullId + "." : "") + id;
          if (this.project?.task(fullId,)) {
            this.error(
              "task_exists",
              `Task ${fullId} has already been defined.`,
              this.sourceFileInfo[0] ?? null,
            );
          }
        }
        const task = new Task(
          this.project!,
          id,
          String(this.val[2],),
          this.property as Task | null,
        );
        task.setForScenario("projectid", this.projectId, 0,);
        task.sourceFileInfo = this.sourceFileInfo[0] ?? null;
        task.inheritAttributes();
        this.property = task;
        this.scenarioIdx = 0;
        return null;
      },
    );
    p.arg(2, "name", "The name of the task",);
  },);

  rule(p, "taskBody", () => {
    p.optionsRule("taskAttributes",);
  },);

  rule(p, "taskAttributes", () => {
    p.repeatable();
    p.optional();

    p.pattern(
      ["_adopt", "!taskList",],
      function (this: ProjectFileParser,): unknown {
        for (const task of this.val[1] as Task[]) {
          asProp(this,).adopt(task,);
        }
        return null;
      },
    );
    p.doc(
      "adopt.task",
      "Add a previously defined task and its sub-tasks to this task.",
    );

    p.pattern(["!journalEntry",],);

    // Fase 10 Complemento C3.1.2 — alocação de material na tarefa.
    p.pattern(["!materialAllocation",],);

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
    p.doc("note.task", "Attach a note to the task.",);

    p.pattern(["!purge",],);

    p.pattern(
      ["_supplement", "!supplementTask", "!taskBody",],
      function (this: ProjectFileParser,): unknown {
        this.property = this.idStack.pop() ?? null;
        return null;
      },
    );
    p.doc(
      "supplement.task",
      "Add more attributes to already defined tasks.",
    );

    p.pattern(["!task",],);
    p.pattern(["!taskScenarioAttributes",],);
    p.pattern(
      ["!scenarioIdCol", "!taskScenarioAttributes",],
      function (this: ProjectFileParser,): unknown {
        this.scenarioIdx = 0;
        return null;
      },
    );
    // Outros atributos serão adicionados automaticamente
    // (extendProperty — 10.12).
  },);

  // ------------------------------------------------------------------
  // IDs de tarefa
  // ------------------------------------------------------------------
  rule(p, "taskIdUnverifd", () => {
    p.singlePattern("$ABSOLUTE_ID",);
    p.singlePattern("$ID",);
  },);

  rule(p, "taskId", () => {
    p.pattern(
      ["!taskIdUnverifd",],
      function (this: ProjectFileParser,): unknown {
        let id = String(this.val[0],);
        const prop = this.property;
        if (prop && prop instanceof Task) {
          // Supplement aninhado: prependar o ID do pai.
          id = prop.fullId + "." + id;
        } else if (this.taskprefix !== "") {
          id = this.taskprefix + "." + id;
        }
        const task = this.project?.task(id,);
        if (!task) {
          this.error(
            "unknown_task",
            `Unknown task ${id}`,
            this.sourceFileInfo[0] ?? null,
          );
        }
        return task ?? null;
      },
    );
  },);

  rule(p, "absoluteTaskId", () => {
    p.pattern(
      ["!taskIdUnverifd",],
      function (this: ProjectFileParser,): unknown {
        const id = (this.taskprefix === "" ? "" : this.taskprefix + ".") +
          String(this.val[0],);
        const task = this.project?.task(id,);
        if (!task) {
          this.error(
            "unknown_abs_task",
            `Unknown task ${id}`,
            this.sourceFileInfo[0] ?? null,
          );
        }
        return task ?? null;
      },
    );
  },);

  rule(p, "taskList", () => {
    p.listRule("moreTasks", "!absoluteTaskId",);
  },);

  // ------------------------------------------------------------------
  // Dependências
  // ------------------------------------------------------------------
  rule(p, "taskDepId", () => {
    p.singlePattern("$ABSOLUTE_ID",);
    p.arg(
      0,
      "ABSOLUTE ID",
      "A reference using the full qualified ID of a task, e. g. " +
        "'proj.plan.doc'.",
    );
    p.singlePattern("$ID",);
    p.arg(0, "ID", "Just the ID of the task without any parent IDs.",);
    p.pattern(
      ["!relativeId",],
      function (this: ProjectFileParser,): unknown {
        let task: (typeof this.property) | null = this.property;
        let id = String(this.val[0],);
        while (task && id[0] === "!") {
          id = id.slice(1, id.length,);
          task = task.parent;
        }
        if (id[0] === "!") {
          this.error(
            "too_many_bangs",
            "Too many '!' for relative task in this context.",
            this.sourceFileInfo[0] ?? null,
            this.property ?? undefined,
          );
        }
        return task ? task.fullId + "." + id : id;
      },
    );
    p.arg(
      0,
      "RELATIVE ID",
      "A relative task ID starts with one or more exclamation marks.",
    );
  },);

  rule(p, "taskDep", () => {
    p.pattern(
      ["!taskDepHeader", "!taskDepBody",],
      function (this: ProjectFileParser,): unknown {
        return this.val[0];
      },
    );
  },);

  rule(p, "taskDepHeader", () => {
    p.pattern(
      ["!taskDepId",],
      function (this: ProjectFileParser,): unknown {
        this.taskDependency = new TaskDependency(String(this.val[0],), true,);
        return this.taskDependency;
      },
    );
  },);

  rule(p, "taskDepBody", () => {
    p.optionsRule("taskDepAttributes",);
  },);

  rule(p, "taskDepAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(
      ["_gapduration", "!intervalDuration",],
      function (this: ProjectFileParser,): unknown {
        (this.taskDependency as TaskDependency).gapDuration = Number(
          this.val[1],
        );
        return null;
      },
    );
    p.doc(
      "gapduration",
      "Minimum required gap between the predecessor and this task. Calendar " +
        "time, not working time.",
    );

    p.pattern(
      ["_gaplength", "!nonZeroWorkingDuration",],
      function (this: ProjectFileParser,): unknown {
        (this.taskDependency as TaskDependency).gapLength = Number(
          this.val[1],
        );
        return null;
      },
    );
    p.doc(
      "gaplength",
      "Minimum required gap between the predecessor and this task. Working " +
        "time, not calendar time.",
    );

    p.pattern(
      ["_onend",],
      function (this: ProjectFileParser,): unknown {
        (this.taskDependency as TaskDependency).onEnd = true;
        return null;
      },
    );
    p.doc("onend", "The target of the dependency is the end of the task.",);

    p.pattern(
      ["_onstart",],
      function (this: ProjectFileParser,): unknown {
        (this.taskDependency as TaskDependency).onEnd = false;
        return null;
      },
    );
    p.doc("onstart", "The target of the dependency is the start of the task.",);
  },);

  rule(p, "taskDepList", () => {
    p.pattern(
      ["!taskDep", "!moreDepTasks",],
      function (this: ProjectFileParser,): unknown {
        return [this.val[0],].concat(
          (this.val[1] as unknown[] | null) ?? [],
        );
      },
    );
  },);

  rule(p, "moreDepTasks", () => {
    p.commaListRule("!taskDep",);
  },);

  rule(p, "taskPred", () => {
    p.pattern(
      ["!taskPredHeader", "!taskDepBody",],
      function (this: ProjectFileParser,): unknown {
        return this.val[0];
      },
    );
  },);

  rule(p, "taskPredHeader", () => {
    p.pattern(
      ["!taskDepId",],
      function (this: ProjectFileParser,): unknown {
        this.taskDependency = new TaskDependency(String(this.val[0],), false,);
        return this.taskDependency;
      },
    );
  },);

  rule(p, "taskPredList", () => {
    p.pattern(
      ["!taskPred", "!morePredTasks",],
      function (this: ProjectFileParser,): unknown {
        return [this.val[0],].concat(
          (this.val[1] as unknown[] | null) ?? [],
        );
      },
    );
  },);

  rule(p, "morePredTasks", () => {
    p.commaListRule("!taskPred",);
  },);

  // ------------------------------------------------------------------
  // Allocate / allocations
  // ------------------------------------------------------------------
  rule(p, "allocate", () => {
    p.pattern(
      ["_allocate", "!allocations",],
      function (this: ProjectFileParser,): unknown {
        this.checkContainer("allocate",);
        this.appendScListAttribute("allocate", this.val[1] as unknown[],);
        return null;
      },
    );
    p.doc(
      "allocate",
      "Specify which resources should be allocated to the task.",
    );
  },);

  rule(p, "allocations", () => {
    p.listRule("moreAllocations", "!allocation",);
  },);

  rule(p, "allocation", () => {
    p.pattern(
      ["!allocationHeader", "!allocationBody",],
      function (this: ProjectFileParser,): unknown {
        return this.val[0];
      },
    );
  },);

  rule(p, "allocationHeader", () => {
    p.pattern(
      ["!resourceId",],
      function (this: ProjectFileParser,): unknown {
        this.allocate = new Allocation([this.val[0] as Resource,],);
        return this.allocate;
      },
    );
  },);

  rule(p, "allocationBody", () => {
    p.optionsRule("allocationAttributes",);
  },);

  rule(p, "allocationAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(
      ["_alternative", "!resourceId", "!moreAlternatives",],
      function (this: ProjectFileParser,): unknown {
        const allocate = this.allocate as Allocation | null;
        if (!allocate) return null;
        const candidates = [this.val[1],].concat(
          (this.val[2] as unknown[] | null) ?? [],
        );
        for (const candidate of candidates) {
          allocate.addCandidate(candidate as Resource,);
        }
        return null;
      },
    );
    p.doc(
      "alternative",
      "Specify alternative resources for the allocation.",
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
    p.doc("limits.allocate", "Removed. Use limits in the allocation instead.",);

    p.pattern(
      ["_select", "!allocationSelectionMode",],
      function (this: ProjectFileParser,): unknown {
        (this.allocate as Allocation).setSelectionMode(String(this.val[1],),);
        return null;
      },
    );
    p.doc(
      "select",
      "Controls which resource is picked from an allocation and its " +
        "alternatives.",
    );

    p.pattern(
      ["_persistent",],
      function (this: ProjectFileParser,): unknown {
        (this.allocate as Allocation).persistent = true;
        return null;
      },
    );
    p.doc(
      "persistent",
      "Once a resource is picked from the list of alternatives, it is used " +
        "for the whole task.",
    );

    p.pattern(
      ["_mandatory",],
      function (this: ProjectFileParser,): unknown {
        (this.allocate as Allocation).mandatory = true;
        return null;
      },
    );
    p.doc(
      "mandatory",
      "Makes a resource allocation mandatory for the time slot.",
    );

    p.pattern(
      ["!allocateShiftAssignments", "!shiftAssignment",],
      setAllocateShifts,
    );
    p.doc(
      "shift.allocate",
      "Limits the allocations of resources during the specified interval " +
        "to the specified shift.",
    );

    p.pattern(
      ["!allocateShiftsAssignments", "!shiftAssignments",],
      setAllocateShifts,
    );
    p.doc(
      "shifts.allocate",
      "Limits the allocations of resources during the specified interval " +
        "to the specified shifts.",
    );
  },);

  rule(p, "allocationSelectionMode", () => {
    p.singlePattern("_maxloaded",);
    p.descr("Pick the available resource that has been used the most so far.",);
    p.singlePattern("_minloaded",);
    p.descr(
      "Pick the available resource that has been used the least so far.",
    );
    p.singlePattern("_minallocated",);
    p.descr(
      "Pick the resource with the smallest allocation factor (default).",
    );
    p.singlePattern("_order",);
    p.descr("Pick the first available resource from the list.",);
    p.singlePattern("_random",);
    p.descr("Pick a random resource from the list.",);
  },);

  rule(p, "moreAlternatives", () => {
    p.commaListRule("!resourceId",);
  },);

  rule(p, "allocateShiftAssignments", () => {
    p.pattern(["_shift",], function (this: ProjectFileParser,): unknown {
      this.shiftAssignments = (this.allocate as Allocation).shifts;
      return null;
    },);
  },);

  rule(p, "allocateShiftsAssignments", () => {
    p.pattern(["_shifts",], function (this: ProjectFileParser,): unknown {
      this.shiftAssignments = (this.allocate as Allocation).shifts;
      return null;
    },);
  },);

  // ------------------------------------------------------------------
  // Shift assignments (task / allocate)
  // ------------------------------------------------------------------
  rule(p, "shiftAssignment", () => {
    p.pattern(
      ["!shiftId", "!intervalOptional",],
      function (this: ProjectFileParser,): unknown {
        // Garante um ShiftAssignments para a propriedade em questão.
        if (!this.shiftAssignments) {
          const sas = new ShiftAssignments();
          sas.project = this.project!;
          this.shiftAssignments = sas;
        }
        const sas = this.shiftAssignments as ShiftAssignments;
        const interval = (this.val[1] as TimeInterval | null) ??
          new TimeInterval(
            this.project!.get("start",) as TjTime,
            this.project!.get("end",) as TjTime,
          );
        const shift = this.val[0] as { scenario: (i: number,) => unknown };
        if (
          !sas.addAssignment(
            new ShiftAssignment(
              shift.scenario(this.scenarioIdx,) as never,
              interval,
            ),
          )
        ) {
          this.error(
            "shift_assignment_overlap",
            "Shifts may not overlap each other.",
            this.sourceFileInfo[0] ?? null,
            this.property ?? undefined,
          );
        }
        return sas.assignments[sas.assignments.length - 1] ?? null;
      },
    );
  },);

  rule(p, "shiftAssignments", () => {
    p.listRule("moreShiftAssignments", "!shiftAssignment",);
  },);

  rule(p, "moreShiftAssignments", () => {
    p.commaListRule("!shiftAssignment",);
  },);

  rule(p, "taskShiftAssignments", () => {
    p.pattern(["_shift",], function (this: ProjectFileParser,): unknown {
      this.shiftAssignments = asProp(this,).getForScenario(
        "shifts",
        this.scenarioIdx,
      );
      return null;
    },);
  },);

  rule(p, "taskShiftsAssignments", () => {
    p.pattern(["_shifts",], function (this: ProjectFileParser,): unknown {
      this.shiftAssignments = asProp(this,).getForScenario(
        "shifts",
        this.scenarioIdx,
      );
      return null;
    },);
  },);

  // ------------------------------------------------------------------
  // Bookings (task-side)
  // ------------------------------------------------------------------
  rule(p, "taskBooking", () => {
    p.pattern(
      ["!taskBookingHeader", "!bookingBody",],
      function (this: ProjectFileParser,): unknown {
        const scenario = this.project!.scenario(this.scenarioIdx,);
        if (!scenario?.get("ownbookings",)) {
          this.error(
            "no_own_task_booking",
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

  rule(p, "taskBookingHeader", () => {
    p.pattern(
      ["!resourceId", "!valIntervals",],
      function (this: ProjectFileParser,): unknown {
        this.checkBooking(asProp(this,) as Task, this.val[0] as Resource,);
        const booking = new Booking(
          this.val[0] as Resource,
          asProp(this,) as Task,
          (this.val[1] as unknown[]) as never,
        );
        booking.sourceFileInfo = this.sourceFileInfo[0] ?? null;
        this.booking = booking;
        return booking;
      },
    );
  },);

  rule(p, "bookingBody", () => {
    p.optionsRule("bookingAttributes",);
  },);

  rule(p, "bookingAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(
      ["_overtime", "$INTEGER",],
      function (this: ProjectFileParser,): unknown {
        const v = Number(this.val[1],);
        if (v < 0 || v > 2) {
          this.error(
            "overtime_range",
            `Overtime value ${v} out of range (0 - 2).`,
            this.sourceFileInfo[1] ?? null,
            this.property ?? undefined,
          );
        }
        (this.booking as Booking).overtime = v;
        return null;
      },
    );
    p.doc(
      "overtime.booking",
      "Enables bookings during off-hours and leaves.",
    );

    p.pattern(
      ["_sloppy", "$INTEGER",],
      function (this: ProjectFileParser,): unknown {
        const v = Number(this.val[1],);
        if (v < 0 || v > 2) {
          this.error(
            "sloppy_range",
            `Sloppyness value ${v} out of range (0 - 2).`,
            this.sourceFileInfo[1] ?? null,
            this.property ?? undefined,
          );
        }
        (this.booking as Booking).sloppy = v;
        return null;
      },
    );
    p.doc(
      "sloppy.booking",
      "Controls how strictly booking intervals are checked for conflicts.",
    );
  },);

  // ------------------------------------------------------------------
  // Journal
  // ------------------------------------------------------------------
  rule(p, "journalEntry", () => {
    p.pattern(
      ["!journalEntryHeader", "!journalEntryBody",],
      function (this: ProjectFileParser,): unknown {
        return this.val[0];
      },
    );
    p.doc(
      "journalentry",
      "Adds an entry to the journal of the project — events, decisions or " +
        "news recorded at a particular moment of the project.",
    );
  },);

  rule(p, "journalEntryHeader", () => {
    p.pattern(
      ["_journalentry", "!valDate", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        this.journalEntry = new JournalEntry(
          this.project!.journal,
          this.val[1] as TjTime,
          String(this.val[2],),
          this.property,
          this.sourceFileInfo[0] ?? null,
        );
        return this.journalEntry;
      },
    );
    p.arg(2, "headline", "The headline of the journal entry.",);
  },);

  rule(p, "journalEntryBody", () => {
    p.optionsRule("journalEntryAttributes",);
  },);

  rule(p, "journalEntryAttributes", () => {
    p.optional();
    p.repeatable();

    p.pattern(
      ["_alert", "!alertLevel",],
      function (this: ProjectFileParser,): unknown {
        (this.journalEntry as JournalEntry).alertLevel = this.val[1] === null
          ? 0
          : 0;
        return null;
      },
    );
    p.doc("alert", "Specify the alert level for this entry.",);

    p.pattern(["!author",],);

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
    p.doc(
      "flags.journalentry",
      "Journal entries can have flags attached to them.",
    );

    p.pattern(["!summary",],);
    p.pattern(["!details",],);

    // Fase 10 Complemento C3.3.3 — `picture` e `format` na journalentry.
    p.pattern(["!picture",],);
    p.pattern(["!format",],);
  },);

  // ------------------------------------------------------------------
  // Atributos de cenário da tarefa
  // ------------------------------------------------------------------
  rule(p, "taskScenarioAttributes", () => {
    p.pattern(["_account", "$ID",], null,);
    p.doc("account.task", "",);

    p.pattern(["!allocate",],);

    p.pattern(["_booking", "!taskBooking",],);
    p.doc(
      "booking.task",
      "Report actually completed work for the task.",
    );

    p.pattern(
      ["_charge", "!number", "!chargeMode",],
      function (this: ProjectFileParser,): unknown {
        this.checkContainer("charge",);
        if (scList(this, "chargeset",).length === 0) {
          this.error(
            "task_without_chargeset",
            "The task does not have a chargeset defined.",
            this.sourceFileInfo[0] ?? null,
            this.property ?? undefined,
          );
        }
        const amount = Number(this.val[1],);
        const mode = String(this.val[2],);
        let charge: Charge;
        if (mode === "onstart") {
          charge = makeCharge(this, amount, "onStart",);
        } else if (mode === "onend") {
          charge = makeCharge(this, amount, "onEnd",);
        } else if (mode === "perhour") {
          charge = makeCharge(this, amount * 24, "perDiem",);
        } else if (mode === "perday") {
          charge = makeCharge(this, amount, "perDiem",);
        } else {
          charge = makeCharge(this, amount / 7, "perDiem",);
        }
        asProp(this,).setForScenario(
          "charge",
          scList(this, "charge",).concat([charge,],),
          this.scenarioIdx,
        );
        return null;
      },
    );
    p.doc(
      "charge",
      "Specify a one-time or per-period charge to a certain account.",
    );
    p.arg(1, "amount", "The amount to charge",);

    p.pattern(["!chargeset",],);

    p.pattern(
      ["_complete", "!number",],
      function (this: ProjectFileParser,): unknown {
        const v = Number(this.val[1],);
        if (v < 0 || v > 100) {
          this.error(
            "task_complete",
            "Complete value must be between 0 and 100",
            this.sourceFileInfo[1] ?? null,
            this.property ?? undefined,
          );
        }
        asProp(this,).setForScenario("complete", v, this.scenarioIdx,);
        return null;
      },
    );
    p.doc(
      "complete",
      "Percentage of the task already completed (documentation only).",
    );
    p.arg(1, "percent", "The percent value (0 - 100).",);

    p.pattern(
      ["_depends", "!taskDepList",],
      function (this: ProjectFileParser,): unknown {
        this.checkContainer("depends",);
        this.appendScListAttribute("depends", this.val[1] as unknown[],);
        setForward(this, true,);
        return null;
      },
    );
    p.doc(
      "depends",
      "The task cannot start before the specified tasks have been finished.",
    );

    p.pattern(
      ["_duration", "!calendarDuration",],
      function (this: ProjectFileParser,): unknown {
        this.setDurationAttribute("duration", this.val[1],);
        return null;
      },
    );
    p.doc(
      "duration",
      "Calendar time the task should last. 7d means one week.",
    );

    // Fase 10 Complemento C3.4.1/C3.4.2 — `timebasis` como atributo de
    // cenário. Normaliza aliases (`calendar` → `duration`, `working` →
    // `length`) e registra `task_overspecified` quando a tarefa já tem
    // `duration`/`length` explícito (§2.6).
    p.pattern(
      ["_timebasis", "!timebasisMode",],
      function (this: ProjectFileParser,): unknown {
        const raw = String(this.val[1],);
        const canonical = raw === "calendar"
          ? "duration"
          : raw === "working"
          ? "length"
          : raw;
        const prop = asProp(this,);
        // §2.6 task_overspecified: timebasis + explicit length/duration.
        const d = prop.getForScenario("duration", this.scenarioIdx,);
        const l = prop.getForScenario("length", this.scenarioIdx,);
        if (
          d != null && (d as number) > 0 ||
          l != null && (l as number) > 0
        ) {
          this.error(
            "task_overspecified",
            `Task '${prop.id}' cannot combine explicit 'duration'/'length' with 'timebasis ${raw}'.`,
            this.sourceFileInfo[0] ?? null,
            prop,
          );
          return null;
        }
        // §2.6 timebasis_not_supported: milestone não aceita timebasis.
        if (prop.getForScenario("milestone", this.scenarioIdx,) === true) {
          this.error(
            "timebasis_not_supported",
            `Milestone task '${prop.id}' cannot have 'timebasis'.`,
            this.sourceFileInfo[0] ?? null,
            prop,
          );
          return null;
        }
        if (canonical !== "duration" && canonical !== "length") {
          this.error(
            "illegal_timebasis",
            `Illegal timebasis value '${raw}'. Expected: duration|calendar|length|working.`,
            this.sourceFileInfo[1] ?? null,
            prop,
          );
          return null;
        }
        prop.setForScenario("timebasis", canonical, this.scenarioIdx,);
        return null;
      },
    );
    p.doc(
      "timebasis",
      "Basis used by the engine to distribute temporal charges: 'duration' (calendar days) or 'length' (working days).",
    );

    p.pattern(
      ["_effort", "!workingDuration",],
      function (this: ProjectFileParser,): unknown {
        const v = Number(this.val[1],);
        if (v <= 0) {
          this.error(
            "effort_zero",
            "Effort value must at least as large as the timing resolution " +
              `(${
                this.project!.get("scheduleGranularity",) as number / 60
              }min).`,
            this.sourceFileInfo[1] ?? null,
            this.property ?? undefined,
          );
        }
        this.setDurationAttribute("effort", v,);
        return null;
      },
    );
    p.doc(
      "effort",
      "Effort needed to complete the task, in working time of resources.",
    );

    p.pattern(
      ["_effortdone", "!workingDuration",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario(
          "effortdone",
          Number(this.val[1],),
          this.scenarioIdx,
        );
        return null;
      },
    );
    p.doc("effortdone", "Effort of the task already completed.",);

    p.pattern(
      ["_effortleft", "!workingDuration",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario(
          "effortleft",
          Number(this.val[1],),
          this.scenarioIdx,
        );
        return null;
      },
    );
    p.doc("effortleft", "Effort of the task still not completed.",);

    p.pattern(
      ["_end", "!valDate",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario("end", this.val[1], this.scenarioIdx,);
        setForward(this, false,);
        return null;
      },
    );
    p.doc(
      "end",
      "Guideline to the scheduler for when the task should end (ALAP).",
    );

    p.pattern(
      ["_endcredit", "!number",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario(
          "charge",
          scList(this, "charge",).concat([
            makeCharge(this, Number(this.val[1],), "onEnd",),
          ],),
          this.scenarioIdx,
        );
        return null;
      },
    );
    p.doc("endcredit", "Deprecated. Use charge instead.",);

    p.pattern(["!flags",],);
    p.pattern(["!fail",],);

    p.pattern(
      ["_length", "!nonZeroWorkingDuration",],
      function (this: ProjectFileParser,): unknown {
        this.setDurationAttribute("length", this.val[1],);
        return null;
      },
    );
    p.doc(
      "length",
      "Duration of the task as working time, not calendar time.",
    );

    p.pattern(
      ["!limits",],
      function (this: ProjectFileParser,): unknown {
        this.checkContainer("limits",);
        asProp(this,).setForScenario("limits", this.val[0], this.scenarioIdx,);
        return null;
      },
    );
    p.doc("limits.task", "Per-interval allocation limits for the task.",);

    p.pattern(
      ["_maxend", "!valDate",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario("maxend", this.val[1], this.scenarioIdx,);
        return null;
      },
    );
    p.doc("maxend", "Maximum wanted end time of the task.",);

    p.pattern(
      ["_maxstart", "!valDate",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario(
          "maxstart",
          this.val[1],
          this.scenarioIdx,
        );
        return null;
      },
    );
    p.doc("maxstart", "Maximum wanted start time of the task.",);

    p.pattern(
      ["_milestone",],
      function (this: ProjectFileParser,): unknown {
        this.setDurationAttribute("milestone",);
        return null;
      },
    );
    p.doc("milestone", "Turns the task into a zero-duration task.",);

    p.pattern(
      ["_minend", "!valDate",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario("minend", this.val[1], this.scenarioIdx,);
        return null;
      },
    );
    p.doc("minend", "Minimum wanted end time of the task.",);

    p.pattern(
      ["_minstart", "!valDate",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario(
          "minstart",
          this.val[1],
          this.scenarioIdx,
        );
        return null;
      },
    );
    p.doc("minstart", "Minimum wanted start time of the task.",);

    p.pattern(
      ["_precedes", "!taskPredList",],
      function (this: ProjectFileParser,): unknown {
        this.checkContainer("precedes",);
        this.appendScListAttribute("precedes", this.val[1] as unknown[],);
        setForward(this, false,);
        return null;
      },
    );
    p.doc(
      "precedes",
      "The specified tasks cannot start before this task has been finished.",
    );

    p.pattern(
      ["_priority", "$INTEGER",],
      function (this: ProjectFileParser,): unknown {
        const v = Number(this.val[1],);
        if (v < 0 || v > 1000) {
          this.error(
            "task_priority",
            "Priority must have a value between 0 and 1000",
            this.sourceFileInfo[1] ?? null,
            this.property ?? undefined,
          );
        }
        asProp(this,).setForScenario("priority", v, this.scenarioIdx,);
        return null;
      },
    );
    p.doc(
      "priority",
      "Priority of the task (default 500). Higher priority tasks are more " +
        "likely to get requested resources.",
    );
    p.arg(1, "value", "Priority value (1 - 1000)",);

    p.pattern(
      ["_projectid", "$ID",],
      function (this: ProjectFileParser,): unknown {
        const ids = (this.project?.get("projectids",) as string[]) ?? [];
        if (!ids.includes(String(this.val[1],),)) {
          this.error(
            "unknown_projectid",
            `Unknown project ID ${String(this.val[1],)}`,
            this.sourceFileInfo[1] ?? null,
          );
        }
        try {
          asProp(this,).setForScenario(
            "projectid",
            this.val[1],
            this.scenarioIdx,
          );
        } catch (e) {
          // Sempre sobrescreve o ID implicitamente fornecido.
          if (!(e instanceof AttributeOverwrite)) throw e;
        }
        return null;
      },
    );
    p.doc(
      "projectid.task",
      "Assigns a new project ID to this task and all subsequently defined " +
        "sub tasks.",
    );

    p.pattern(
      ["_responsible", "!resourceList",],
      function (this: ProjectFileParser,): unknown {
        this.appendScListAttribute("responsible", this.val[1] as unknown[],);
        const list = scList(this, "responsible",) as unknown[];
        const unique: unknown[] = [];
        for (const r of list) {
          if (!unique.includes(r,)) unique.push(r,);
        }
        if (unique.length !== list.length) {
          asProp(this,).setForScenario(
            "responsible",
            unique,
            this.scenarioIdx,
          );
        }
        return null;
      },
    );
    p.doc(
      "responsible",
      "Resource(s) responsible for this task (documentation only).",
    );

    p.pattern(
      ["_scheduled",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario("scheduled", true, this.scenarioIdx,);
        return null;
      },
    );
    p.doc(
      "scheduled",
      "The task can be ignored for scheduling in the scenario.",
    );

    p.pattern(
      ["_scheduling", "!schedulingDirection",],
      function (this: ProjectFileParser,): unknown {
        if (this.val[1] === "alap") setForward(this, false,);
        else if (this.val[1] === "asap") setForward(this, true,);
        return null;
      },
    );
    p.doc(
      "scheduling",
      "Scheduling policy of the task: ASAP or ALAP.",
    );

    p.pattern(
      ["_schedulingmode", "!schedulingMode",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario(
          "projectionmode",
          this.val[1] === "projection",
          this.scenarioIdx,
        );
        return null;
      },
    );
    p.doc(
      "schedulingmode",
      "Planning mode allocates resources around the current date; " +
        "projection mode only after it.",
    );

    p.pattern(
      ["!taskShiftAssignments", "!shiftAssignments",],
      setTaskShifts("shift",),
    );
    p.doc("shift.task", "Deprecated. Use shifts (task) instead.",);

    p.pattern(
      ["!taskShiftsAssignments", "!shiftAssignments",],
      setTaskShifts("shifts",),
    );
    p.doc(
      "shifts.task",
      "Limits the working time for this task during the specified interval " +
        "to the working hours of the given shift.",
    );

    p.pattern(
      ["_start", "!valDate",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario("start", this.val[1], this.scenarioIdx,);
        setForward(this, true,);
        return null;
      },
    );
    p.doc(
      "start",
      "Guideline to the scheduler for when the task should start (ASAP).",
    );

    p.pattern(
      ["_startcredit", "!number",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).setForScenario(
          "charge",
          scList(this, "charge",).concat([
            makeCharge(this, Number(this.val[1],), "onStart",),
          ],),
          this.scenarioIdx,
        );
        return null;
      },
    );
    p.doc("startcredit", "Deprecated. Use charge instead.",);

    p.pattern(["!taskPeriod",],);
    p.pattern(["!warn",],);
    // Outros atributos serão adicionados automaticamente (10.12).
  },);

  rule(p, "taskPeriod", () => {
    p.pattern(
      ["_period", "!valInterval",],
      function (this: ProjectFileParser,): unknown {
        const iv = this.val[1] as TimeInterval;
        asProp(this,).setForScenario(
          "start",
          iv.start,
          this.scenarioIdx,
        );
        asProp(this,).setForScenario("end", iv.end, this.scenarioIdx,);
        return null;
      },
    );
    p.doc(
      "period.task",
      "Shortcut for setting start and end at the same time without " +
        "changing the scheduling direction.",
    );
  },);

  // ------------------------------------------------------------------
  // Apoios do bloco task
  // ------------------------------------------------------------------
  rule(p, "chargeMode", () => {
    p.singlePattern("_onstart",);
    p.descr("Charge the amount on starting the task.",);
    p.singlePattern("_onend",);
    p.descr("Charge the amount on finishing the task.",);
    p.singlePattern("_perhour",);
    p.descr("Charge the amount for every hour the task lasts.",);
    p.singlePattern("_perday",);
    p.descr("Charge the amount for every day the task lasts.",);
    p.singlePattern("_perweek",);
    p.descr("Charge the amount for every week the task lasts.",);
  },);

  // Fase 10 Complemento C3.4.1 — palavras aceitas por `timebasis`.
  rule(p, "timebasisMode", () => {
    p.pattern(["_duration",], () => "duration",);
    p.descr("Distribute across calendar days (tj3-compatible default).",);
    p.pattern(["_calendar",], () => "calendar",);
    p.descr("Alias of 'duration'.",);
    p.pattern(["_length",], () => "length",);
    p.descr("Distribute across working days (excluding shift leaves).",);
    p.pattern(["_working",], () => "working",);
    p.descr("Alias of 'length'.",);
  },);

  rule(p, "schedulingDirection", () => {
    p.singlePattern("_alap",);
    p.singlePattern("_asap",);
  },);

  rule(p, "schedulingMode", () => {
    p.singlePattern("_planning",);
    p.singlePattern("_projection",);
  },);

  rule(p, "aggregate", () => {
    p.pattern(["_resources",], () => "resources",);
    p.descr("Aggregate resources",);
    p.pattern(["_tasks",], () => "tasks",);
    p.descr("Aggregate tasks",);
    p.pattern(["_materials",], () => "materials",);
    p.descr("Aggregate materials",);
  },);

  rule(p, "vacationName", () => {
    p.optional();
    p.singlePattern("$STRING",);
    p.arg(0, "name", "An optional name or reason for the leave",);
  },);

  rule(p, "hidejournalentry", () => {
    p.pattern(
      ["_hidejournalentry", "!flagLogicalExpression",],
      function (this: ProjectFileParser,): unknown {
        this.property?.set("hideJournalEntry", this.val[1],);
        return null;
      },
    );
    p.doc(
      "hidejournalentry",
      "Do not include journal entries matching the logical expression.",
    );
  },);

  rule(p, "hidetask", () => {
    p.pattern(
      ["_hidetask", "!logicalExpression",],
      function (this: ProjectFileParser,): unknown {
        this.property?.set("hideTask", this.val[1],);
        return null;
      },
    );
    p.doc(
      "hidetask",
      "Do not include tasks that match the specified logical expression.",
    );
  },);

  rule(p, "rolluptask", () => {
    p.pattern(
      ["_rolluptask", "!logicalExpression",],
      function (this: ProjectFileParser,): unknown {
        this.property?.set("rollupTask", this.val[1],);
        return null;
      },
    );
    p.doc(
      "rolluptask",
      "Do not show sub-tasks of tasks that match the logical expression.",
    );
  },);

  rule(p, "sortTasksKeyword", () => {
    p.pattern(["_sorttasks",], function (this: ProjectFileParser,): unknown {
      this.sortProperty = ["task",];
      return null;
    },);
  },);

  rule(p, "sortTasks", () => {
    p.pattern(
      ["!sortTasksKeyword", "!sortCriteria",],
      function (this: ProjectFileParser,): unknown {
        this.property?.set("sortTasks", this.val[1],);
        return null;
      },
    );
    p.doc(
      "sorttasks",
      "Determines how tasks are sorted in the report.",
    );
  },);

  rule(p, "purge", () => {
    p.pattern(
      ["_purge", "!optionalScenarioIdCol", "$ID",],
      function (this: ProjectFileParser,): unknown {
        const attrId = String(this.val[2],);
        const prop = this.property;
        if (!prop) return null;
        const attrDef = prop.attributeDefinition(attrId,);
        if (!attrDef) {
          this.error(
            "purge_unknown_id",
            `${attrId} is not a known attribute for this property`,
            this.sourceFileInfo[2] ?? null,
          );
          return null;
        }
        if (attrDef.isScenarioAttribute) {
          if (!this.val[1]) this.scenarioIdx = 0;
          prop.getAttribute(attrId, this.scenarioIdx,).reset();
        } else {
          if (this.val[1]) {
            this.error(
              "purge_non_sc_spec_attr",
              "Scenario specified for a non-scenario specific attribute",
            );
          }
          prop.getAttribute(attrId,).reset();
        }
        return null;
      },
    );
    p.doc(
      "purge",
      "Resets an inherited or global attribute to its default value before " +
        "subsequent definitions in this property.",
    );
  },);
}

/** Action comum de `!allocateShiftAssignments !shiftAssignment`. */
const setAllocateShifts = function (this: ProjectFileParser,): unknown {
  try {
    (this.allocate as Allocation).shifts = this
      .shiftAssignments as ShiftAssignments;
  } catch (e) {
    // Múltiplas atribuições de shift são um idioma comum.
    if (!(e instanceof AttributeOverwrite)) throw e;
  }
  this.shiftAssignments = null;
  return null;
};

/** Action de `shifts.task` / `shift.task`. */
function setTaskShifts(keyword: string,): () => unknown {
  return function (this: ProjectFileParser,): unknown {
    this.checkContainer(keyword,);
    try {
      // Redefinir o mesmo valor marca o atributo como 'provided'.
      asProp(this,).setForScenario(
        "shifts",
        this.shiftAssignments,
        this.scenarioIdx,
      );
    } catch (e) {
      if (!(e instanceof AttributeOverwrite)) throw e;
    }
    this.shiftAssignments = null;
    return null;
  };
}
