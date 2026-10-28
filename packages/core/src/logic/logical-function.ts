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
 * Complemento Fase 11 (`fase-11-logical-complemento.md`): além das 14 funções
 * fiéis ao Ruby 3.8.4 (`FUNCTIONS_RUBY`), registramos **extensões SyntaxMesh**
 * (`FUNCTIONS_EXT`) pedidas na documentação. As viáveis hoje (checagens de tipo
 * e de árvore, sem scheduling) são implementadas; as que dependem de
 * scheduling/financeiro (Fases 7/8) ficam **registradas** (nome + aridade +
 * `to_s`) e **lançam `NotYetImplementedError`** ao avaliar — a avaliação real
 * pertence à fase que construir o pré-requisito. Não há mudança no parser: ele
 * aceita qualquer `$ID` + `argumentList` como função.
 *
 * Onde o modelo portado ainda não expõe um método (ex.: `isDependencyOf`/
 * `isFeatureOf` com a assinatura Ruby), o dispatch é feito por duck-typing e
 * retorna `false` na ausência — mantendo o port fiel sem quebrar a
 * compilação. `TaskScenario#getAllocatedTime` foi portado na 2ª onda do
 * Complemento (§6.1) e `isactive` usa agora o caminho tipado.
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
 * Funções fiéis ao TaskJuggler 3.8.4 (`LogicalFunction.rb::@@functions`).
 * Nome → número de argumentos obrigatórios.
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

/** Categoria de uma extensão: implementável hoje ou bloqueada por fase. */
type ExtKind = "feasible" | "blocked";

/**
 * Extensões SyntaxMesh além do port fiel (Complemento Fase 11). Cada entrada:
 * `nome → [aridade, fase_pré_requisito, kind]`. `blocked` lança
 * `NotYetImplementedError(fase)` ao avaliar; `feasible` tem método próprio.
 * Nomes sem tradução 0-arg seguem o padrão de `istask`/`isresource` (o parser
 * os resolve por `$ID`, sem keyword i18n obrigatório).
 */
export const FUNCTIONS_EXT: Map<string, [number, string, ExtKind,]> = new Map(
  [
    // Viáveis hoje: checagens de tipo e de árvore.
    ["isparentof", [1, "", "feasible",],],
    ["isanaccount", [0, "", "feasible",],],
    ["isaccount", [1, "", "feasible",],],
    ["isanmaterial", [0, "", "feasible",],],
    ["ismaterial", [1, "", "feasible",],],
    ["istaskofproject", [1, "", "feasible",],],
    // Bloqueadas na 1ª onda; implementadas na 2ª onda (§6.1–§6.3) porque as
    // Fases 7/8.1 foram concluídas: `TaskScenario#getAllocatedTime` portado,
    // datas `start`/`end` são atributos de cenário, `materialallocations` e
    // `CostEvent` "material_usage" existem. Fase de origem preservada no tag.
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
    // Permanentemente bloqueadas (G6 §6.6): o pré-requisito não existe no modelo.
    // `isoncriticalpath` exige slack/float (inexistente até no Ruby 3.8.4
    // vendorizado) → Fase 14/15; `istaskstatus` exige enum de status derivado
    // de tracking → Fase 18.
    ["isoncriticalpath", [1, "14", "blocked",],],
    ["istaskstatus", [2, "18", "blocked",],],
  ],
);

/** Nome → aridade, unificando fiéis + extensões (validação de argumentos). */
export const FUNCTIONS: Map<string, number> = new Map([
  ...FUNCTIONS_RUBY,
  ...[...FUNCTIONS_EXT,].map(
    ([name, [arity,],],) => [name, arity,] as [string, number,],
  ),
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
    // Extensões bloqueadas: registradas (nome/aridade/to_s) mas avaliadas só
    // pela fase que construir o pré-requisito (Fases 7/8/8.1). `ext` é
    // [aridade, fase, kind].
    const ext = FUNCTIONS_EXT.get(this.name,);
    if (ext && ext[2] === "blocked") {
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
      // Extensões viáveis hoje (Complemento Fase 11).
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
      // 2ª onda (§6.1–§6.3): datas agendadas + alocações + material.
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
    // TODO(@djones) Fase 16: hasalert real (Journal.currentEntries).
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
    // Caminho tipado (G1.3, 2ª onda §6.1): `TaskScenario#getAllocatedTime`
    // foi portado do Ruby — não há mais `return false` silencioso por
    // duck-typing ausente.
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

  // --------------------------------------------------
  // Extensões viáveis hoje (Complemento Fase 11)
  // --------------------------------------------------

  /** `isparentof(id)` — inverso de `ischildof`: `property` é ancestral de `id`. */
  private isparentof(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!property) return false;
    const targetId = String(this.arguments[0],);
    // Busca recursiva na subárvore de `property` por subId ou id completo.
    // Extensão SyntaxMesh (não existe no Ruby): o `propertySet.get(arg)` só
    // resolve por fullId, então um short id como "c1" exige varredura local.
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

  private isanaccount(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    return property instanceof Account;
  }

  /** `isaccount(id)` — é uma `Account` e casa com a conta de `id`. */
  private isaccount(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!(property instanceof Account)) return false;
    const project = property.project as Project;
    return project.account(String(this.arguments[0],),) === property;
  }

  private isanmaterial(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    return property instanceof Material;
  }

  /** `ismaterial(id)` — é um `Material` e casa com o material de `id`. */
  private ismaterial(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!(property instanceof Material)) return false;
    const project = property.project as Project;
    return project.material(String(this.arguments[0],),) === property;
  }

  /** `istaskofproject(id)` — a tarefa pertence ao projeto com esse id. */
  private istaskofproject(expr: LogicalExpression,): boolean {
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task)) return false;
    const project = property.project as Project;
    return project.id === String(this.arguments[0],);
  }

  // --------------------------------------------------
  // 2ª onda — Complemento Fase 11 §6.1–§6.3 (datas/alocações/material)
  //
  // Semânticas documentadas (extensões SyntaxMesh, não existem no Ruby):
  //  - Intervalos `[d1, d2]` são comparados INCLUSIVE (mesma divergência
  //    conhecida de `perday` em known-divergences.json).
  //  - Funções sem argumento de cenário usam o cenário da Query
  //    (`q.scenarioIdx ?? 0`); com argumento `scn`, valida por nome.
  //  - Sem datas agendadas (`start`/`end` ausentes): a alocação em si conta
  //    como presença no intervalo — evita falsos negativos antes do
  //    agendamento (G1.4 popula as datas nos testes de integração).
  // --------------------------------------------------

  /** Aridade defensiva: o parser chama `setArguments` sem validar (10.14). */
  private arityCheck(n: number, expr: LogicalExpression,): void {
    if (this.arguments.length !== n) {
      expr.error(
        `Wrong number of arguments for function ${this.name}. Got ` +
          `${this.arguments.length} instead of ${n}.`,
      );
    }
  }

  /**
   * G1.2: argumento-data. O parser (`!date` em logic.ts:145) já entrega
   * `TjTime` alinhado à granularidade; strings `"YYYY-MM-DD"` são aceitas
   * por conveniência de expressões construídas programaticamente.
   */
  private dateArg(expr: LogicalExpression, raw: unknown,): TjTime {
    if (raw instanceof TjTime) return raw;
    let t: TjTime | null = null;
    try {
      t = TjTime.fromString(String(raw,),);
    } catch {
      t = null;
    }
    // `fromString` não lança para palavras qualquer (ex.: "nao-eh-data"):
    // produz TjTime com segundos NaN. Validamos explicitamente. (2026-13-99
    // lança dentro de fromParts → pego pelo catch acima.)
    if (t === null || !Number.isFinite(t.toSeconds(),)) {
      return expr.error(
        `Invalid date '${String(raw,)}' used for function ${this.name}()`,
      );
    }
    return t;
  }

  /**
   * Índice de slot para uma data. `Project#dateToIdx` clampa aos limites do
   * plano (fiel ao Ruby — `forceIntoProject = true`): data anterior a
   * `start` → slot 0; posterior a `end` → último slot. Nunca lança.
   */
  private slotIdxFor(
    expr: LogicalExpression,
    project: Project,
    raw: unknown,
  ): number {
    return project.dateToIdx(this.dateArg(expr, raw,),);
  }

  /** Cenário da Query (`?? 0`) para funções que não recebem `scn`. */
  private scenarioFromQuery(expr: LogicalExpression,): number {
    const q = this.query(expr,);
    return q.scenarioIdx === undefined ? 0 : q.scenarioIdx;
  }

  /**
   * Review (a): `getAllocatedTime` é `granularity * slots / (dwh * 3600)` com
   * `slots` inteiro, então zero é **exato** por construção — sem ruído de
   * ponto flutuante possível no estado atual. O limiar de meio slot protege
   * contra mudanças futuras (frações de slot) e torna a intenção legível.
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
   * Review (c): alvo das funções por id. Extensão sem equivalente Ruby, onde
   * `LogicalFunction.rb` é estrito: id que não resolve em nenhuma PropertySet
   * é erro do usuário (typos não podem silenciar para a propriedade atual).
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

  /** Resolve entidade por id em qualquer PropertySet do projeto. */
  private resolveById(
    project: Project,
    id: string,
  ): PropertyTreeNode | null {
    return project.task(id,) ?? project.resource(id,) ??
      project.account(id,) ?? project.material(id,) ?? null;
  }

  /**
   * `startsafter/startsbefore/endsafter/endsbefore(id, d)` — datas `start`/
   * `end` (atributos de cenário populados pelo scheduler, Fase 7) da
   * entidade `id` (ou da propriedade atual se o id não resolver) versus `d`.
   * Comparação estrita: `>` para *after, `<` para *before.
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
    // Valida a data ANTES do early-return: argumento inválido é erro do
    // usuário, não `false` silencioso (G1.2).
    const d = this.dateArg(expr, this.arguments[1],);
    const t = target.getForScenario(attr, scIdx,) as TjTime | null;
    if (!t) return false;
    const c = t.compareTo(d,);
    return cmp === "gt" ? c > 0 : c < 0;
  }

  /** Tarefa tem `material` alocado no cenário (lista MaterialAllocation). */
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

  /** Uso de material no intervalo: distribuição anexada > 0 ou datas overlap. */
  private materialUsedIn(
    task: Task,
    mine: MaterialAllocation[],
    scIdx: number,
    iv: TimeInterval,
  ): boolean {
    if (mine.some((a,) => a.quantityIn(iv,) > 0)) return true;
    const tStart = task.getForScenario("start", scIdx,) as TjTime | null;
    const tEnd = task.getForScenario("end", scIdx,) as TjTime | null;
    // Review (b): só a ausência **completa** de agenda faz a alocação contar
    // por si; agenda parcial não pode superavaliar uso em qualquer intervalo.
    if (!tStart && !tEnd) return true;
    return iv.overlaps(this.taskInterval(tStart, tEnd,),);
  }

  /**
   * Intervalo das datas de cenário de uma tarefa com agenda parcial: uma
   * das duas ausentes vira ponto no limite conhecido (degenerate interval).
   */
  private taskInterval(
    tStart: TjTime | null,
    tEnd: TjTime | null,
  ): TimeInterval {
    return new TimeInterval(tStart ?? tEnd!, tEnd ?? tStart!,);
  }

  /**
   * `isallocated(id, d1, d2)` — a tarefa (propriedade) tem tempo alocado do
   * recurso `id` no intervalo de datas, via `TaskScenario#getAllocatedTime`
   * (port G1.1) convertido por `Project#dateToIdx`.
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
   * `isallocatedtoproject(prj, scn, d1, d2)` — a propriedade (tarefa ou
   * recurso) tem alocação agregada > 0 no projeto `prj` e cenário `scn`.
   * SyntaxMesh é single-project: `prj` precisa casar `project.id`.
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
   * `hasassignment(id, d1, d2)` — recurso **ou material** `id` está
   * designado/alocado à tarefa (propriedade) e há booking/uso no intervalo
   * (ou datas da tarefa o cruzam; sem agenda, a designação basta).
   * Detecção de tipo pelo id: `project.resource` → `project.material`.
   */
  private hasassignment(expr: LogicalExpression,): boolean {
    this.arityCheck(3, expr,);
    const [property,] = this.properties(expr,);
    if (!(property instanceof Task)) return false;
    const project = property.project as Project;
    const id = String(this.arguments[0],);
    const scIdx = this.scenarioFromQuery(expr,);
    // Review (d): datas convertidas uma única vez — o TimeInterval e os
    // índices de slot compartilham a mesma conversão (G1.2/f).
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
    return false; // id não é recurso nem material
  }

  /**
   * Overlap das datas agendadas da tarefa com `iv`. Review (b): apenas a
   * ausência **completa** de agenda (nem `start` nem `end`) faz a designação
   * contar por si — agenda parcial não superavalia presença.
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
   * `isusedat(id, scn)` — material `id` é usado na propriedade atual
   * (tarefa ou recurso) no cenário `scn`: lista `materialallocations` da
   * tarefa (parser, Fase 8.1) ou `CostEvent` `"material_usage"` agendado.
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
   * `isused(id, d1, d2)` — material `id` é consumido pela propriedade atual
   * (tarefa) ou — quando a propriedade é o próprio material — por qualquer
   * tarefa do projeto, com uso dentro de `[d1, d2]`.
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
   * `isusedatproject(prj, scn, d1, d2)` — material usado em qualquer tarefa
   * do projeto `prj` no cenário `scn` dentro de `[d1, d2]`. Single-project
   * hoje: `prj` precisa casar `project.id` (multi-projeto é Fase 21).
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
}
