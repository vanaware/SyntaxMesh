/**
 * LogicalFunction — leaf operand that is a function call (phase 11.3).
 *
 * Port of `LogicalFunction.rb`. Models `name(args...)` inside a
 * `LogicalExpression`. Conventions:
 *  - A trailing `_` inverts `property`/`scopeProperty` (11.3.1.4).
 *  - `&`/`|` and the coercions are handled by `LogicalOperation`.
 *  - `hasalert` uses `Journal.currentEntries` (16.18 — phase 16).
 *
 * Phase 11 complement (`fase-11-logical-complemento.md`): besides the 14
 * functions faithful to Ruby 3.8.4 (`FUNCTIONS_RUBY`), **SyntaxMesh
 * extensions** requested by the documentation are registered (`FUNCTIONS_EXT`).
 * The ones feasible today (type and tree checks, no scheduling) are
 * implemented; the ones that depend on scheduling/finance (phases 7/8) stay
 * **registered** (name + arity + `to_s`) and **throw `NotYetImplementedError`**
 * when evaluated — the real evaluation belongs to the phase that builds the
 * prerequisite. The parser needs no change: it accepts any `$ID` plus an
 * `argumentList` as a function.
 *
 * Where the ported model does not expose a method yet (e.g. `isDependencyOf`/
 * `isFeatureOf` with the Ruby signature), dispatch goes through duck typing and
 * returns `false` when it is missing — keeping the port faithful without
 * breaking the build. `TaskScenario#getAllocatedTime` was ported in the 2nd wave
 * of the complement (§6.1) and `isactive` now uses the typed path.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalFunction.rb
 */
import { Task, } from "../model/task.ts";
import { Resource, } from "../model/resource.ts";
import { Account, } from "../model/account.ts";
import { Material, } from "../model/material.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { TjTime, } from "../time/tj-time.ts";
import type { MaterialAllocation, } from "../model/material-allocation.ts";
import { NotYetImplementedError, } from "../model/errors.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { Project, } from "../model/project.ts";
import type { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "./logical-expression.ts";
import { LogicalOperation, } from "./logical-operation.ts";

/**
 * Functions faithful to TaskJuggler 3.8.4 (`LogicalFunction.rb::@@functions`).
 * Name mapped to the number of required arguments.
 */
export const FUNCTIONS_RUBY: Map<string, number> = new Map([
  ["hasalert", 1,],
  ["isactive", 1,],
  ["ischildof", 1,],
  ["isdependencyof", 3,],
  ["isdutyof", 2,],
  ["isfeatureof", 2,],
  ["isleaf", 0,],
  ["ismilestone", 1,],
  ["isongoing", 1,],
  ["isresource", 0,],
  ["isresponsibilityof", 2,],
  ["istask", 0,],
  ["isvalid", 1,],
  ["treelevel", 0,],
],);

/** Category of an extension: implementable today or blocked by a phase. */
export type ExtKind = "feasible" | "blocked";

/**
 * SyntaxMesh extensions beyond the faithful port (phase 11 complement). Each
 * entry is `name -> [arity, prerequisite_phase, kind]`. `blocked` throws
 * `NotYetImplementedError(phase)` when evaluated; `feasible` has its own
 * method. Names without a 0-arg translation follow the `istask`/`isresource`
 * pattern (the parser resolves them as `$ID`, so no i18n keyword is required).
 */
export const FUNCTIONS_EXT: Map<string, [number, string, ExtKind,]> = new Map(
  [
    // Feasible today: type and tree checks.
    ["isparentof", [1, "", "feasible",],],
    ["isanaccount", [0, "", "feasible",],],
    ["isaccount", [1, "", "feasible",],],
    ["isanmaterial", [0, "", "feasible",],],
    ["ismaterial", [1, "", "feasible",],],
    ["istaskofproject", [1, "", "feasible",],],
    // Blocked in the 1st wave; implemented in the 2nd wave (§6.1–§6.3) because
    // phases 7/8.1 were completed: `TaskScenario#getAllocatedTime` is ported,
    // the `start`/`end` dates are scenario attributes, and `materialallocations`
    // plus the `CostEvent` "material_usage" exist. The origin phase is kept in
    // the tag.
    ["hasassignment", [3, "7", "feasible",],],
    ["isallocated", [3, "7", "feasible",],],
    ["isallocatedtoproject", [4, "7", "feasible",],],
    ["startsafter", [2, "7", "feasible",],],
    ["startsbefore", [2, "7", "feasible",],],
    ["endsafter", [2, "7", "feasible",],],
    ["endsbefore", [2, "7", "feasible",],],
    ["isusedat", [2, "8.1", "feasible",],],
    ["isused", [3, "8.1", "feasible",],],
    ["isusedatproject", [4, "8.1", "feasible",],],
    // Permanently blocked (G6 §6.6): the prerequisite does not exist in the
    // model. `isoncriticalpath` needs slack/float (missing even in the vendored
    // Ruby 3.8.4) — no consumer in the port today, so it stays `blocked` with
    // its origin-phase tag; revisit only if a future slack/float pass lands.
    //
    // `istaskstatus` was released from `blocked` in the F21 1ª onda (2026-11-10):
    // `TaskScenario#calcStatus` (port of `TaskScenario.rb:2477-2496`) already
    // populates the Ruby-derived status vocabulary (`not started` / `not
    // reached` / `in progress` / `done` / `unknown`) and `TaskScenario#status()`
    // exposes it. The comparison here normalizes the `$ID` argument
    // (e.g. `not_started`, `notstarted`, `Not Started`) so users can write the
    // label closest to their source. The gauge vocabulary (on schedule / behind
    // schedule / ahead of schedule) still lives in `calcGauge()`, which the
    // port keeps simplified; that comparison is a future extension.
    ["isoncriticalpath", [1, "14", "blocked",],],
    ["istaskstatus", [2, "18", "feasible",],],
  ],
);

/**
 * Name mapped to arity, unifying the faithful functions and the extensions
 * (used for argument validation).
 */
export const FUNCTIONS: Map<string, number> = new Map([
  ...FUNCTIONS_RUBY,
  ...[...FUNCTIONS_EXT,].map(
    ([name, [arity,],],) => [name, arity,] as [string, number,],
  ),
],);

/**
 * Reads a member of an object as a function (equivalent to `respond_to?`).
 *
 * @param obj Object to inspect.
 * @param key Name of the member.
 * @returns The member as a function, or `undefined`.
 */
function method(
  obj: unknown,
  key: string,
): ((...args: unknown[]) => unknown) | undefined {
  const m = (obj as Record<string, unknown> | null | undefined)?.[key];
  return typeof m === "function"
    ? (m as (...args: unknown[]) => unknown)
    : undefined;
}

/** Function call inside a logical expression. */
export class LogicalFunction {
  /** Name of the function (without the inverting `_` suffix). */
  readonly name: string;
  /** Whether the `_` suffix inverts `property` and `scopeProperty`. */
  readonly invertProperties: boolean;
  /** Arguments of the call, in source order. */
  arguments: unknown[] = [];

  /**
   * Creates the call node.
   *
   * @param opnd Name of the function, with a trailing `_` when the properties
   *   must be inverted.
   */
  constructor(opnd: string,) {
    if (opnd.endsWith("_",)) {
      this.name = opnd.slice(0, -1,);
      this.invertProperties = true;
    } else {
      this.name = opnd;
      this.invertProperties = false;
    }
  }

  /**
   * Stores the arguments without validation (used by the parser).
   *
   * @param args Arguments of the call.
   */
  setArguments(args: unknown[],): void {
    this.arguments = args;
  }

  /**
   * Stores the arguments after validating the name and the arity (11.3.1.5).
   *
   * @param args Arguments of the call.
   * @returns `[id, message]` on error, or `null` when the call is valid.
   */
  setArgumentsAndCheck(args: unknown[],): [string, string,] | null {
    if (!FUNCTIONS.has(this.name,)) {
      return [
        "unknown_function",
        `Unknown function ${this.name} used in logical expression.`,
      ];
    }
    if (FUNCTIONS.get(this.name,) !== args.length) {
      return [
        "wrong_no_func_arguments",
        `Wrong number of arguments for function ${this.name}. Got ` +
        `${args.length} instead of ${FUNCTIONS.get(this.name,)}.`,
      ];
    }
    this.arguments = args;
    return null;
  }

  /**
   * Evaluates the function call.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns The result of the function.
   * @throws NotYetImplementedError When the function is an anchored extension
   *   whose prerequisite phase is still missing.
   */
  eval(expr: LogicalExpression,): unknown {
    // Blocked extensions: registered (name/arity/to_s) but only evaluated by
    // the phase that builds the prerequisite (phases 7/8/8.1). `ext` is
    // [arity, phase, kind].
    const ext = FUNCTIONS_EXT.get(this.name,);
    if (ext && ext[2] === "blocked") {
      // Ancorado: Fase dinâmica — `ext[1]` carries the phase of the blocked
      // function (see the FUNCTIONS_EXT table); each extension is released by
      // its anchor phase.
      throw new NotYetImplementedError(ext[1], this.name,);
    }
    switch (this.name) {
      case "hasalert":
        return this.hasalert(expr,);
      case "isactive":
        return this.isactive(expr,);
      case "ischildof":
        return this.ischildof(expr,);
      case "isdependencyof":
        return this.isdependencyof(expr,);
      case "isdutyof":
        return this.isdutyof(expr,);
      case "isfeatureof":
        return this.isfeatureof(expr,);
      case "isleaf":
        return this.isleaf(expr,);
      case "ismilestone":
        return this.ismilestone(expr,);
      case "isongoing":
        return this.isongoing(expr,);
      case "isresource":
        return this.isresource(expr,);
      case "isresponsibilityof":
        return this.isresponsibilityof(expr,);
      case "istask":
        return this.istask(expr,);
      case "isvalid":
        return this.isvalid(expr,);
      case "treelevel":
        return this.treelevel(expr,);
      // Extensions feasible today (phase 11 complement).
      case "isparentof":
        return this.isparentof(expr,);
      case "isanaccount":
        return this.isanaccount(expr,);
      case "isaccount":
        return this.isaccount(expr,);
      case "isanmaterial":
        return this.isanmaterial(expr,);
      case "ismaterial":
        return this.ismaterial(expr,);
      case "istaskofproject":
        return this.istaskofproject(expr,);
      // 2nd wave (§6.1–§6.3): scheduled dates + allocations + material.
      case "startsafter":
        return this.dateBound(expr, "start", "gt",);
      case "startsbefore":
        return this.dateBound(expr, "start", "lt",);
      case "endsafter":
        return this.dateBound(expr, "end", "gt",);
      case "endsbefore":
        return this.dateBound(expr, "end", "lt",);
      case "isallocated":
        return this.isallocated(expr,);
      case "isallocatedtoproject":
        return this.isallocatedtoproject(expr,);
      case "hasassignment":
        return this.hasassignment(expr,);
      case "isusedat":
        return this.isusedat(expr,);
      case "isused":
        return this.isused(expr,);
      case "isusedatproject":
        return this.isusedatproject(expr,);
      // F21 1ª onda (2026-11-10): released from `blocked` once `TaskScenario#
      // calcStatus` became faithful to Ruby. SyntaxMesh extension — the raw
      // string label is compared against the task's derived status.
      case "istaskstatus":
        return this.istaskstatus(expr,);
      default:
        return expr.error(`Unknown function ${this.name}`,);
    }
  }

  /**
   * Renders the call as text.
   *
   * @returns The `name(arg, ...)` form.
   */
  to_s(): string {
    return `${this.name}(${this.arguments.join(", ",)})`;
  }

  /**
   * Default string conversion required by the JS runtime.
   *
   * @returns The `name(arg, ...)` form.
   */
  toString(): string {
    return this.to_s();
  }

  // --------------------------------------------------
  // Context helpers
  // --------------------------------------------------

  /**
   * Returns the evaluation context, requiring a `Query`.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns The `Query` of the context.
   */
  private query(expr: LogicalExpression,): Query {
    if (!expr.query) {
      expr.error(`Function ${this.name}() requires a Query context`,);
    }
    return expr.query as Query;
  }

  /**
   * `[property, scopeProperty]` following `invertProperties` (11.3.2.2).
   *
   * @param expr Expression that owns the evaluation context.
   * @returns The property and the scope property used by the call.
   */
  private properties(
    expr: LogicalExpression,
  ): [PropertyTreeNode | null, PropertyTreeNode | null,] {
    const q = this.query(expr,);
    if (this.invertProperties) {
      return [q.scopeProperty, null,];
    }
    return [q.property, q.scopeProperty,];
  }

  /**
   * Index of the scenario named by argument _id_, or an error.
   *
   * @param expr Expression that owns the evaluation context.
   * @param project Project that owns the scenario.
   * @param id Scenario identifier given as an argument.
   * @returns The index of the scenario.
   */
  private scenarioIdxOrError(
    expr: LogicalExpression,
    project: Project,
    id: unknown,
  ): number {
    const idx = project.scenarioIdx(String(id,),);
    if (idx === undefined) {
      expr.error(
        `Unknown scenario '${String(id,)}' used for function ` +
          `${this.name}()`,
      );
    }
    return idx as number;
  }

  // --------------------------------------------------
  // The 14 faithful functions
  // --------------------------------------------------

  /**
   * `hasalert(level)` — whether the journal holds entries at or above the
   * given alert level for the property, inside the query interval.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when at least one matching journal entry exists.
   */
  private hasalert(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    const query = this.query(expr,);
    const project = property.project as Project;
    // Ruby: `currentEntries(query.end, property, args[0], query.start,
    // query.hideJournalEntry)` — `args[0]` is the minimum alert level.
    const minLevel = Number(this.arguments[0] ?? 0,);
    const entries = project.journal.currentEntries(
      query.end,
      property,
      minLevel,
      query.start,
      query.hideJournalEntry,
    );
    return entries.length > 0;
  }

  /**
   * `isactive(scenario)` — whether the task or resource has allocated time in
   * the scenario, inside the query interval.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the allocated time is non-zero.
   */
  private isactive(expr: LogicalExpression,): boolean {
    const [property, scopeProperty,] = this.properties(expr,);
    if (!(property instanceof Task || property instanceof Resource)) {
      return false;
    }
    const project = property.project as Project;
    const scenarioIdx = this.scenarioIdxOrError(
      expr,
      project,
      this.arguments[0],
    );
    const q = this.query(expr,);
    // Typed path (G1.3, 2nd wave §6.1): `TaskScenario#getAllocatedTime` was
    // ported from Ruby — the silent `return false` for missing duck typing is
    // gone.
    const startIdx = q.startIdx ?? 0;
    const endIdx = q.endIdx ?? 0;
    if (property instanceof Task) {
      const scope = scopeProperty instanceof Resource ? scopeProperty : null;
      return property.scenarioData(scenarioIdx,).getAllocatedTime(
        startIdx,
        endIdx,
        scope,
      ) > 0.0;
    }
    const scope = scopeProperty instanceof Task ? scopeProperty : null;
    return property.scenarioData(scenarioIdx,).getAllocatedTime(
      startIdx,
      endIdx,
      scope,
    ) > 0.0;
  }

  /**
   * `ischildof(id)` — whether the property is a descendant of `id`.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the property is a child of the resolved parent.
   */
  private ischildof(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    const propertySet = property.propertySet as unknown as Record<
      string,
      unknown
    >;
    const getter = method(propertySet, "get",);
    const parent = getter
      ? getter.call(propertySet, String(this.arguments[0],),) as
        | PropertyTreeNode
        | null
      : null;
    if (!parent) return false;
    return property.isChildOf(parent,);
  }

  /**
   * `isdependencyof(id, scenario, resolved)` — whether the task depends on the
   * task `id` in the given scenario.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the dependency exists.
   */
  private isdependencyof(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task)) return false;
    const project = property.project as Project;
    const task = project.task(String(this.arguments[0],),);
    if (!task) return false;
    const scenarioIdx = project.scenarioIdx(String(this.arguments[1],),);
    if (scenarioIdx === undefined) return false;
    if (typeof this.arguments[2] !== "number") return false;
    const fn = method(property, "isDependencyOf",) ??
      method(property.data[scenarioIdx], "isDependencyOf",);
    if (!fn) return false;
    return fn.call(property, task,) as boolean;
  }

  /**
   * `isdutyof(resource, scenario)` — whether the task lists the resource in
   * `assignedresources` for the scenario.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the resource is assigned to the task.
   */
  private isdutyof(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task)) return false;
    const task = property;
    const project = task.project as Project;
    const resource = project.resource(String(this.arguments[0],),);
    if (!resource) return false;
    const scenarioIdx = project.scenarioIdx(String(this.arguments[1],),);
    if (scenarioIdx === undefined) return false;
    const assigned = (task.getForScenario(
      "assignedresources",
      scenarioIdx,
    ) as PropertyTreeNode[] | undefined) ?? [];
    return assigned.includes(resource,);
  }

  /**
   * `isfeatureof(task, scenario)` — whether the task is a feature of the task
   * `id` in the given scenario.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the feature relation holds.
   */
  private isfeatureof(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task)) return false;
    const project = property.project as Project;
    const task = project.task(String(this.arguments[0],),);
    if (!task) return false;
    const scenarioIdx = project.scenarioIdx(String(this.arguments[1],),);
    if (scenarioIdx === undefined) return false;
    const fn = method(property, "isFeatureOf",);
    if (!fn) return false;
    return fn.call(property, scenarioIdx, task,) as boolean;
  }

  /**
   * `isleaf()` — whether the property has no children.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the property is a leaf.
   */
  private isleaf(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    return property.leaf();
  }

  /**
   * `ismilestone(scenario)` — whether the task is a milestone in the scenario.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the `milestone` attribute is set.
   */
  private ismilestone(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    const project = property.project as Project;
    const scenarioIdx = project.scenarioIdx(String(this.arguments[0],),);
    if (scenarioIdx === undefined) return false;
    return property instanceof Task &&
      Boolean(property.getForScenario("milestone", scenarioIdx,),);
  }

  /**
   * `isongoing(scenario)` — whether the task interval overlaps the query
   * interval.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the intervals overlap (a task without scheduled dates
   *   counts as ongoing, which surfaces scheduling errors).
   */
  private isongoing(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task)) return false;
    const task = property;
    const project = task.project as Project;
    const scenarioIdx = this.scenarioIdxOrError(
      expr,
      project,
      this.arguments[0],
    );
    const q = this.query(expr,);
    const iv1 = new TimeInterval(q.start, q.end,);
    const tStart = task.getForScenario("start", scenarioIdx,) as TjTime | null;
    const tEnd = task.getForScenario("end", scenarioIdx,) as TjTime | null;
    // Helps to surface tasks whose scheduling failed.
    if (!tStart || !tEnd) return true;
    const iv2 = new TimeInterval(tStart, tEnd,);
    return iv1.overlaps(iv2,);
  }

  /**
   * `isresource()` — whether the property is a resource.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the property is a `Resource`.
   */
  private isresource(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    return property instanceof Resource;
  }

  /**
   * `isresponsibilityof(resource, scenario)` — whether the task lists the
   * resource in `responsible` for the scenario.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the resource is responsible for the task.
   */
  private isresponsibilityof(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task)) return false;
    const task = property;
    const project = task.project as Project;
    const resource = project.resource(String(this.arguments[0],),);
    if (!resource) return false;
    const scenarioIdx = project.scenarioIdx(String(this.arguments[1],),);
    if (scenarioIdx === undefined) return false;
    const responsible = (task.getForScenario(
      "responsible",
      scenarioIdx,
    ) as PropertyTreeNode[] | undefined) ?? [];
    return responsible.includes(resource,);
  }

  /**
   * `istask()` — whether the property is a task.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the property is a `Task`.
   */
  private istask(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    return property instanceof Task;
  }

  /**
   * `isvalid([scenario.]attribute)` — whether the property defines the given
   * attribute (in the given scenario, when the attribute is scenario
   * specific).
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the attribute holds a value.
   */
  private isvalid(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    const project = property.project as Project;
    let [scenario, attr,] = String(this.arguments[0],).split(".",);
    if (attr === undefined || attr === "") {
      attr = scenario;
      scenario = "";
    }
    if (!attr) expr.error("Argument must not be empty",);
    let scenarioIdx: number | undefined;
    if (scenario) {
      scenarioIdx = project.scenarioIdx(scenario,);
      if (scenarioIdx === undefined) {
        expr.error(
          `Unknown scenario '${scenario}' used for function isvalid()`,
        );
      }
    }
    const aDef = property.attributeDefinition(attr,);
    if (!aDef) {
      expr.error(`Unknown attribute '${attr}' used for function isvalid()`,);
    }
    if (scenario) {
      if (!aDef!.isScenarioAttribute) {
        expr.error(
          `Attribute '${attr}' of property '${property.fullId}' is not ` +
            "scenario specific. Don't provide a scenario ID!",
        );
      }
      return property.getForScenario(attr, scenarioIdx as number,) !== null;
    }
    if (aDef!.isScenarioAttribute) {
      expr.error(
        `Attribute '${attr}' of property '${property.fullId}' is scenario ` +
          "specific. Please provide a scenario ID!",
      );
    }
    return property.get(attr,) !== null;
  }

  /**
   * `treelevel()` — one-based depth of the property in the tree.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns The depth of the property, or `0` when it cannot be resolved.
   */
  private treelevel(expr: LogicalExpression,): number {
    const [property,] = this.properties(expr,);
    if (!property) return 0;
    return property.level + 1;
  }

  // --------------------------------------------------
  // Extensions feasible today (phase 11 complement)
  // --------------------------------------------------

  /** `isparentof(id)` — inverse of `ischildof`: `property` is an ancestor of `id`. */
  private isparentof(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    const targetId = String(this.arguments[0],);
    // Recursive search in the subtree of `property`, by sub-id or full id.
    // SyntaxMesh extension (absent from Ruby): `propertySet.get(arg)` only
    // resolves full ids, so a short id such as "c1" needs a local scan.
    const find = (node: PropertyTreeNode,): PropertyTreeNode | null => {
      for (const child of node.children) {
        if (child.subId === targetId || child.id === targetId) return child;
        const deep = find(child,);
        if (deep) return deep;
      }
      return null;
    };
    const child = find(property,);
    if (!child) return false;
    return child.isChildOf(property,);
  }

  /**
   * `isanaccount()` — whether the property is an account.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the property is an `Account`.
   */
  private isanaccount(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    return property instanceof Account;
  }

  /** `isaccount(id)` — is an `Account` and matches the account of `id`. */
  private isaccount(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!(property instanceof Account)) return false;
    const project = property.project as Project;
    return project.account(String(this.arguments[0],),) === property;
  }

  /**
   * `isanmaterial()` — whether the property is a material.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the property is a `Material`.
   */
  private isanmaterial(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    return property instanceof Material;
  }

  /** `ismaterial(id)` — is a `Material` and matches the material of `id`. */
  private ismaterial(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!(property instanceof Material)) return false;
    const project = property.project as Project;
    return project.material(String(this.arguments[0],),) === property;
  }

  /** `istaskofproject(id)` — the task belongs to the project with that id. */
  private istaskofproject(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task)) return false;
    const project = property.project as Project;
    return project.id === String(this.arguments[0],);
  }

  // --------------------------------------------------
  // 2nd wave — phase 11 complement §6.1–§6.3 (dates/allocations/material)
  //
  // Documented semantics (SyntaxMesh extensions, absent from Ruby):
  //  - Intervals `[d1, d2]` are compared INCLUSIVE (the same known divergence
  //    as `perday` in known-divergences.json).
  //  - Functions without a scenario argument use the scenario of the Query
  //    (`q.scenarioIdx ?? 0`); with a `scn` argument it is validated by name.
  //  - Without scheduled dates (`start`/`end` missing) the allocation itself
  //    counts as presence in the interval — this avoids false negatives before
  //    scheduling (G1.4 populates the dates in the integration tests).
  // --------------------------------------------------

  /**
   * Defensive arity check: the parser calls `setArguments` without validating
   * (10.14).
   *
   * @param n Expected number of arguments.
   * @param expr Expression used to report the error.
   */
  private arityCheck(n: number, expr: LogicalExpression,): void {
    if (this.arguments.length !== n) {
      expr.error(
        `Wrong number of arguments for function ${this.name}. Got ` +
          `${this.arguments.length} instead of ${n}.`,
      );
    }
  }

  /**
   * G1.2: date argument. The parser (`!date` in logic.ts:145) already delivers
   * a `TjTime` aligned to the granularity; `"YYYY-MM-DD"` strings are accepted
   * for convenience of programmatically built expressions.
   *
   * @param expr Expression used to report the error.
   * @param raw Raw argument value.
   * @returns The argument as a `TjTime`.
   */
  private dateArg(expr: LogicalExpression, raw: unknown,): TjTime {
    if (raw instanceof TjTime) return raw;
    let t: TjTime | null = null;
    try {
      t = TjTime.fromString(String(raw,),);
    } catch {
      t = null;
    }
    // `fromString` does not throw for arbitrary words (e.g. "not-a-date"): it
    // yields a TjTime with NaN seconds, so the result is validated explicitly.
    // (2026-13-99 throws inside fromParts → caught above.)
    if (t === null || !Number.isFinite(t.toSeconds(),)) {
      return expr.error(
        `Invalid date '${String(raw,)}' used for function ${this.name}()`,
      );
    }
    return t;
  }

  /**
   * Slot index of a date. `Project#dateToIdx` clamps to the plan bounds
   * (faithful to Ruby — `forceIntoProject = true`): a date before `start` →
   * slot 0; after `end` → the last slot. Never throws.
   *
   * @param expr Expression used to report errors.
   * @param project Project that owns the schedule.
   * @param raw Date argument.
   * @returns The slot index of the date.
   */
  private slotIdxFor(
    expr: LogicalExpression,
    project: Project,
    raw: unknown,
  ): number {
    return project.dateToIdx(this.dateArg(expr, raw,),);
  }

  /**
   * Scenario of the Query (`?? 0`) for functions that take no `scn` argument.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns The scenario index of the query, defaulting to 0.
   */
  private scenarioFromQuery(expr: LogicalExpression,): number {
    const q = this.query(expr,);
    return q.scenarioIdx === undefined ? 0 : q.scenarioIdx;
  }

  /**
   * Review (a): `getAllocatedTime` is `granularity * slots / (dwh * 3600)`
   * with an integer `slots`, so zero is **exact** by construction — no
   * floating-point noise is possible. The half-slot threshold guards against
   * future fractional slots and makes the intent readable.
   *
   * @param project Project that owns the working-hours configuration.
   * @param seconds Allocated time, in seconds.
   * @returns `true` when more than half a slot is allocated.
   */
  private hasAllocatedTime(
    project: Project,
    seconds: number,
  ): boolean {
    const granularity = project.get("scheduleGranularity",) as number;
    const dwh = (project.get("dailyWorkingHours",) as number) ?? 8;
    const halfSlotDays = (granularity / (dwh * 3600)) / 2;
    return seconds > halfSlotDays;
  }

  /**
   * Review (c): target of the functions that take an id. Extension without a
   * Ruby equivalent — `LogicalFunction.rb` is strict there: an id that does not
   * resolve in any PropertySet is a user error (typos must not silently fall
   * back to the current property).
   *
   * @param expr Expression used to report the error.
   * @param project Project searched for the id.
   * @returns The entity with that id.
   */
  private targetForId(
    expr: LogicalExpression,
    project: Project,
  ): PropertyTreeNode {
    const id = String(this.arguments[0],);
    const target = this.resolveById(project, id,);
    if (!target) {
      return expr.error(
        `Unknown id '${id}' used for function ${this.name}()`,
      );
    }
    return target;
  }

  /**
   * Resolves an entity by id in any PropertySet of the project.
   *
   * @param project Project searched for the id.
   * @param id Identifier to resolve.
   * @returns The entity, or `null` when the id is unknown.
   */
  private resolveById(
    project: Project,
    id: string,
  ): PropertyTreeNode | null {
    return project.task(id,) ?? project.resource(id,) ??
      project.account(id,) ?? project.material(id,) ?? null;
  }

  /**
   * `startsafter/startsbefore/endsafter/endsbefore(id, d)` — the `start`/`end`
   * dates (scenario attributes populated by the scheduler, phase 7) of the
   * entity `id` (or of the current property when the id does not resolve)
   * against `d`. Strict comparison: `>` for *after, `<` for *before.
   *
   * @param expr Expression that owns the evaluation context.
   * @param attr Scenario attribute to read.
   * @param cmp Direction of the strict comparison.
   * @returns The result of the comparison.
   */
  private dateBound(
    expr: LogicalExpression,
    attr: "start" | "end",
    cmp: "gt" | "lt",
  ): boolean {
    this.arityCheck(2, expr,);
    const [property,] = this.properties(expr,);
    if (!property) return false;
    const project = property.project as Project;
    const target = this.targetForId(expr, project,);
    const scIdx = this.scenarioFromQuery(expr,);
    // The date is validated BEFORE the early return: an invalid argument is a
    // user error, not a silent `false` (G1.2).
    const d = this.dateArg(expr, this.arguments[1],);
    const t = target.getForScenario(attr, scIdx,) as TjTime | null;
    if (!t) return false;
    const c = t.compareTo(d,);
    return cmp === "gt" ? c > 0 : c < 0;
  }

  /**
   * `MaterialAllocation` list of the task for the given material and scenario.
   *
   * @param task Task whose allocations are read.
   * @param material Material to filter by.
   * @param scIdx Scenario index.
   * @returns The allocations of that material, possibly empty.
   */
  private materialAllocations(
    task: Task,
    material: Material,
    scIdx: number,
  ): MaterialAllocation[] {
    const allocs = (task.getForScenario(
      "materialallocations",
      scIdx,
    ) as MaterialAllocation[] | undefined) ?? [];
    return allocs.filter((a,) => a.material === material);
  }

  /**
   * Material usage inside the interval: attached distribution > 0, or the
   * task dates overlap it.
   *
   * @param task Task that owns the allocations.
   * @param mine Allocations of the material in the task.
   * @param scIdx Scenario index.
   * @param iv Interval being tested.
   * @returns `true` when the material is used inside `iv`.
   */
  private materialUsedIn(
    task: Task,
    mine: MaterialAllocation[],
    scIdx: number,
    iv: TimeInterval,
  ): boolean {
    if (mine.some((a,) => a.quantityIn(iv,) > 0)) return true;
    const tStart = task.getForScenario("start", scIdx,) as TjTime | null;
    const tEnd = task.getForScenario("end", scIdx,) as TjTime | null;
    // Review (b): only the **complete** absence of a schedule lets the
    // allocation count by itself; a partial schedule must not overestimate
    // usage in any interval.
    if (!tStart && !tEnd) return true;
    return iv.overlaps(this.taskInterval(tStart, tEnd,),);
  }

  /**
   * Interval of the scenario dates of a task with a partial schedule: when one
   * of the two is missing it becomes a point on the known bound (degenerate
   * interval).
   *
   * @param tStart Scheduled start, when known.
   * @param tEnd Scheduled end, when known.
   * @returns The interval spanning the known dates.
   */
  private taskInterval(
    tStart: TjTime | null,
    tEnd: TjTime | null,
  ): TimeInterval {
    return new TimeInterval(tStart ?? tEnd!, tEnd ?? tStart!,);
  }

  /**
   * `isallocated(id, d1, d2)` — the task (property) has time allocated from the
   * resource `id` in the date interval, via `TaskScenario#getAllocatedTime`
   * (port G1.1) converted by `Project#dateToIdx`.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the resource has allocated time on the task.
   */
  private isallocated(expr: LogicalExpression,): boolean {
    this.arityCheck(3, expr,);
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task)) return false;
    const project = property.project as Project;
    const resource = project.resource(String(this.arguments[0],),);
    if (!resource) return false;
    const scIdx = this.scenarioFromQuery(expr,);
    const i1 = this.slotIdxFor(expr, project, this.arguments[1],);
    const i2 = this.slotIdxFor(expr, project, this.arguments[2],);
    return this.hasAllocatedTime(
      project,
      property.scenarioData(scIdx,).getAllocatedTime(i1, i2, resource,),
    );
  }

  /**
   * `isallocatedtoproject(prj, scn, d1, d2)` — the property (task or resource)
   * has aggregate allocation > 0 in the project `prj` and scenario `scn`.
   * SyntaxMesh is single-project: `prj` must match `project.id`.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the property has allocated time in the interval.
   */
  private isallocatedtoproject(expr: LogicalExpression,): boolean {
    this.arityCheck(4, expr,);
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task || property instanceof Resource)) {
      return false;
    }
    const project = property.project as Project;
    if (project.id !== String(this.arguments[0],)) return false;
    const scIdx = this.scenarioIdxOrError(
      expr,
      project,
      this.arguments[1],
    );
    const i1 = this.slotIdxFor(expr, project, this.arguments[2],);
    const i2 = this.slotIdxFor(expr, project, this.arguments[3],);
    if (property instanceof Task) {
      return this.hasAllocatedTime(
        project,
        property.scenarioData(scIdx,).getAllocatedTime(i1, i2,),
      );
    }
    return this.hasAllocatedTime(
      project,
      property.scenarioData(scIdx,).getAllocatedTime(i1, i2,),
    );
  }

  /**
   * `hasassignment(id, d1, d2)` — the resource **or material** `id` is
   * assigned/allocated to the task (property) and there is a booking/usage
   * inside the interval (or the task dates cross it; without a schedule the
   * assignment alone is enough). The type is detected from the id:
   * `project.resource` first, then `project.material`.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the entity is assigned and used in the interval.
   */
  private hasassignment(expr: LogicalExpression,): boolean {
    this.arityCheck(3, expr,);
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task)) return false;
    const project = property.project as Project;
    const id = String(this.arguments[0],);
    const scIdx = this.scenarioFromQuery(expr,);
    // Review (d): the dates are converted only once — the TimeInterval and the
    // slot indices share the same conversion (G1.2/f).
    const d1 = this.dateArg(expr, this.arguments[1],);
    const d2 = this.dateArg(expr, this.arguments[2],);
    const iv = new TimeInterval(d1, d2,);
    const i1 = this.slotIdxFor(expr, project, d1,);
    const i2 = this.slotIdxFor(expr, project, d2,);
    const resource = project.resource(id,);
    if (resource) {
      const assigned = (property.getForScenario(
        "assignedresources",
        scIdx,
      ) as Resource[] | undefined) ?? [];
      if (!assigned.includes(resource,)) return false;
      if (
        this.hasAllocatedTime(
          project,
          resource.scenarioData(scIdx,).getAllocatedTime(i1, i2, property,),
        )
      ) {
        return true;
      }
      return this.usedNoAgenda(property, scIdx, iv,);
    }
    const material = project.material(id,);
    if (material) {
      const mine = this.materialAllocations(property, material, scIdx,);
      if (mine.length === 0) return false;
      return this.materialUsedIn(property, mine, scIdx, iv,);
    }
    return false; // the id is neither a resource nor a material
  }

  /**
   * Overlap between the scheduled dates of the task and `iv`. Review (b): only
   * the **complete** absence of a schedule (neither `start` nor `end`) lets the
   * assignment count by itself — a partial schedule must not overestimate
   * presence.
   *
   * @param task Task whose dates are compared.
   * @param scIdx Scenario index.
   * @param iv Interval being tested.
   * @returns `true` when the task overlaps `iv`, or has no dates at all.
   */
  private usedNoAgenda(
    task: Task,
    scIdx: number,
    iv: TimeInterval,
  ): boolean {
    const tStart = task.getForScenario("start", scIdx,) as TjTime | null;
    const tEnd = task.getForScenario("end", scIdx,) as TjTime | null;
    if (!tStart && !tEnd) return true;
    return iv.overlaps(this.taskInterval(tStart, tEnd,),);
  }

  /**
   * `isusedat(id, scn)` — the material `id` is used by the current property
   * (task or resource) in the scenario `scn`: the `materialallocations` list of
   * the task (parser, phase 8.1) or a scheduled `CostEvent` of type
   * `"material_usage"`.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the material is used by the property.
   */
  private isusedat(expr: LogicalExpression,): boolean {
    this.arityCheck(2, expr,);
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task || property instanceof Resource)) {
      return false;
    }
    const project = property.project as Project;
    const material = project.material(String(this.arguments[0],),);
    if (!material) return false;
    const scIdx = this.scenarioIdxOrError(
      expr,
      project,
      this.arguments[1],
    );
    if (property instanceof Task) {
      if (this.materialAllocations(property, material, scIdx,).length > 0) {
        return true;
      }
    }
    return project.costEvents.some((ce,) =>
      ce.type === "material_usage" && ce.material === material &&
      ce.scenarioIdx === scIdx &&
      (ce.task === property || ce.resource === property)
    );
  }

  /**
   * `isused(id, d1, d2)` — the material `id` is consumed by the current
   * property (a task) or — when the property is the material itself — by any
   * task of the project, with usage inside `[d1, d2]`.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the material is used inside the interval.
   */
  private isused(expr: LogicalExpression,): boolean {
    this.arityCheck(3, expr,);
    const [property,] = this.properties(expr,);
    if (!property) return false;
    const project = property.project as Project;
    const material = project.material(String(this.arguments[0],),);
    if (!material) return false;
    const scIdx = this.scenarioFromQuery(expr,);
    const iv = new TimeInterval(
      this.dateArg(expr, this.arguments[1],),
      this.dateArg(expr, this.arguments[2],),
    );
    if (property instanceof Task) {
      const mine = this.materialAllocations(property, material, scIdx,);
      return mine.length > 0 &&
        this.materialUsedIn(property, mine, scIdx, iv,);
    }
    if (!(property instanceof Material) || property !== material) {
      return false;
    }
    let used = false;
    project.tasks.each((t,) => {
      if (used) return;
      if (!(t instanceof Task)) return;
      const mine = this.materialAllocations(t, material, scIdx,);
      if (mine.length > 0 && this.materialUsedIn(t, mine, scIdx, iv,)) {
        used = true;
      }
    },);
    return used;
  }

  /**
   * `isusedatproject(prj, scn, d1, d2)` — the material is used by any task of
   * the project `prj` in the scenario `scn` inside `[d1, d2]`. Single-project
   * today: `prj` must match `project.id` (multi-project lands in phase 21).
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the material is used inside the interval.
   */
  private isusedatproject(expr: LogicalExpression,): boolean {
    this.arityCheck(4, expr,);
    const [property,] = this.properties(expr,);
    if (!(property instanceof Material)) return false;
    const project = property.project as Project;
    if (project.id !== String(this.arguments[0],)) return false;
    const scIdx = this.scenarioIdxOrError(
      expr,
      project,
      this.arguments[1],
    );
    const iv = new TimeInterval(
      this.dateArg(expr, this.arguments[2],),
      this.dateArg(expr, this.arguments[3],),
    );
    let used = false;
    project.tasks.each((t,) => {
      if (used || !(t instanceof Task)) return;
      const mine = this.materialAllocations(t, property, scIdx,);
      if (mine.length > 0 && this.materialUsedIn(t, mine, scIdx, iv,)) {
        used = true;
      }
    },);
    return used;
  }

  /**
   * `istaskstatus(id, status)` — the derived status of task `id` (scenario of
   * the Query) equals the supplied label. Faithful to Ruby's status
   * vocabulary (`TaskScenario.rb:2477-2496`): `not started`, `not reached`
   * (milestone with `complete == 0`), `in progress`, `done`, `unknown`.
   *
   * The `$ID` argument is compared after stripping non-alphanumerics and
   * lowercasing, so `not_started`, `notstarted`, `Not Started` and
   * `Not-Started` all match `"not started"` on the target. When the task has
   * not been scheduled yet, we call `calcStatus()` first so `_status` reflects
   * the current derived state (Ruby's `finishScheduling` does the same).
   *
   * SyntaxMesh extension — no Ruby equivalent. Gauge comparison
   * (`on schedule`, `behind schedule`, `ahead of schedule`) is intentionally
   * **not** handled here: `calcGauge()` is still a simplified port; extending
   * this function after the gauge port lands is the natural follow-up.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the task exists and its normalized status matches
   *   the normalized argument.
   */
  private istaskstatus(expr: LogicalExpression,): boolean {
    this.arityCheck(2, expr,);
    const [property,] = this.properties(expr,);
    if (!property) return false;
    const project = property.project as Project;
    const target = this.resolveById(project, String(this.arguments[0],),);
    if (!(target instanceof Task)) return false;
    const scIdx = this.scenarioFromQuery(expr,);
    const scenario = target.scenarioData(scIdx,);
    // Ensures `_status` reflects the latest `complete` even if the caller
    // evaluates before `markAsScheduled` runs.
    scenario.calcStatus();
    const rawStatus = scenario.status() || "unknown";
    return normalizeStatus(rawStatus,) ===
      normalizeStatus(String(this.arguments[1],),);
  }
}

/**
 * Normalizes a status label: lowercase and drop non-alphanumerics so
 * `not_started`, `Not Started`, `notstarted` and `NOT-STARTED` all collapse to
 * `notstarted`. Used exclusively by `istaskstatus`.
 *
 * @param value Raw label (target status or user-supplied argument).
 * @returns The canonical form used for comparison.
 */
function normalizeStatus(value: string,): string {
  return value.toLowerCase().replace(/[^a-z0-9]/gu, "",);
}
