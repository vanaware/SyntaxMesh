/**
 * LogicalFunction — folha de operando que é uma chamada de função
 * (Fase 11.3).
 *
 * Port de `LogicalFunction.rb`. Modela `nome(args...)` dentro de uma
 * `LogicalExpression`. Convenções:
 *  - Sufixo `_` inverte `property`/`scopeProperty` (11.3.1.4).
 *  - `&`/`|` e coerções são tratadas pelo `LogicalOperation`.
 *  - `hasalert` é stub (Fase 16).
 *
 * Onde o modelo portado ainda não expõe um método (ex.: `getAllocatedTime` em
 * Task, `isDependencyOf`/`isFeatureOf` com a assinatura Ruby), o dispatch é
 * feito por duck-typing e retorna `false` na ausência — mantendo o port fiel
 * sem quebrar a compilação. Tais caminhos são completados pelas fases de
 * scheduling/financeiro correspondentes.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalFunction.rb
 */
import { Task, } from "../model/task.ts";
import { Resource, } from "../model/resource.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import type { TjTime, } from "../time/tj-time.ts";
import { NotYetImplementedError, } from "../model/errors.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { Project, } from "../model/project.ts";
import type { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "./logical-expression.ts";
import { LogicalOperation, } from "./logical-operation.ts";

/** Nome da função → número de argumentos obrigatórios. */
export const FUNCTIONS: Map<string, number> = new Map([
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

/** Membro de objeto como função (respond_to? equivalente). */
function method(
  obj: unknown,
  key: string,
): ((...args: unknown[]) => unknown) | undefined {
  const m = (obj as Record<string, unknown> | null | undefined)?.[key];
  return typeof m === "function"
    ? (m as (...args: unknown[]) => unknown)
    : undefined;
}

/** Chamada de função dentro de uma expressão lógica. */
export class LogicalFunction {
  readonly name: string;
  readonly invertProperties: boolean;
  arguments: unknown[] = [];

  constructor(opnd: string,) {
    if (opnd.endsWith("_",)) {
      this.name = opnd.slice(0, -1,);
      this.invertProperties = true;
    } else {
      this.name = opnd;
      this.invertProperties = false;
    }
  }

  /** Registra argumentos sem validação (usado pelo parser). */
  setArguments(args: unknown[],): void {
    this.arguments = args;
  }

  /**
   * Registra argumentos validando nome e aridade (11.3.1.5).
   * Retorna `[id, mensagem]` em erro; `null` quando ok.
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

  eval(expr: LogicalExpression,): unknown {
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
      default:
        return expr.error(`Unknown function ${this.name}`,);
    }
  }

  to_s(): string {
    return `${this.name}(${this.arguments.join(", ",)})`;
  }

  toString(): string {
    return this.to_s();
  }

  // --------------------------------------------------
  // Helpers de contexto
  // --------------------------------------------------

  private query(expr: LogicalExpression,): Query {
    if (!expr.query) {
      expr.error(`Function ${this.name}() requires a Query context`,);
    }
    return expr.query as Query;
  }

  /** [property, scopeProperty] conforme `invertProperties` (11.3.2.2). */
  private properties(
    expr: LogicalExpression,
  ): [PropertyTreeNode | null, PropertyTreeNode | null,] {
    const q = this.query(expr,);
    if (this.invertProperties) {
      return [q.scopeProperty, null,];
    }
    return [q.property, q.scopeProperty,];
  }

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
  // As 14 funções
  // --------------------------------------------------

  private hasalert(_expr: LogicalExpression,): boolean {
    // TODO Fase 16: hasalert real (Journal.currentEntries).
    throw new NotYetImplementedError("16", "hasalert",);
  }

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
    const scData = property.data[scenarioIdx];
    const fn = method(scData, "getAllocatedTime",);
    if (!fn) return false;
    return (
      fn.call(
        scData,
        q.startIdx,
        q.endIdx,
        scopeProperty,
      ) as number
    ) > 0.0;
  }

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

  private isleaf(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    return property.leaf();
  }

  private ismilestone(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    const project = property.project as Project;
    const scenarioIdx = project.scenarioIdx(String(this.arguments[0],),);
    if (scenarioIdx === undefined) return false;
    return property instanceof Task &&
      Boolean(property.getForScenario("milestone", scenarioIdx,),);
  }

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
    // Ajuda a mostrar tarefas com erro de scheduling.
    if (!tStart || !tEnd) return true;
    const iv2 = new TimeInterval(tStart, tEnd,);
    return iv1.overlaps(iv2,);
  }

  private isresource(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    return property instanceof Resource;
  }

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

  private istask(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    return property instanceof Task;
  }

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

  private treelevel(expr: LogicalExpression,): number {
    const [property,] = this.properties(expr,);
    if (!property) return 0;
    return property.level + 1;
  }
}
