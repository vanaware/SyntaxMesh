/**
 * 2ª onda do Complemento Fase 11 (§6.1–§6.5 do plano).
 *
 * Cobre as funções que passaram de stub `NotYetImplementedError` para
 * implementação real depois da conclusão das Fases 7/8.1:
 *  - G1.2 parsing/validação de argumentos-data (`TjTime` ou string).
 *  - G1.3 `isactive` no caminho tipado (`TaskScenario#getAllocatedTime`).
 *  - G2  `startsafter/startsbefore/endsafter/endsbefore`, `isallocated(ToProject)`.
 *  - G3  `hasassignment`, `isusedat`, `isused`, `isusedatproject` (material).
 *  - G5  `flags` no bloco `material` do parser (LF.5a) + `undecl_flag` (LF.6).
 *  - G3.5 smoke end-to-end dirigido pelo parser.
 *  - Review pós-onda (a)–(g): limiar de alocação, agenda parcial, id
 *    inválido estrito, clamp de datas fora do plano, regressões dateArg/
 *    `unit` quoted. Ver §6.9 do plano.
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { parseProject, PROJECT_HEADER, } from "../parser/parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Account, } from "../../src/model/account.ts";
import { Material, } from "../../src/model/material.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { CostEvent, } from "../../src/accounting/cost-event.ts";
import type { AttributionRule, } from "../../src/model/cost-event.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import type { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";
import { LogicalFunction, } from "../../src/logic/logical-function.ts";
import { LogicalAttribute, } from "../../src/logic/logical-attribute.ts";
import { LogicalFlag, } from "../../src/logic/logical-flag.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { Query, } from "../../src/query/query.ts";

/** Avalia uma função contra um `Query` com `property` (e índices) dados. */
function evalFn(
  fn: LogicalFunction,
  project: Project,
  property: PropertyTreeNode | null,
  extra: { startIdx?: number; endIdx?: number } = {},
): unknown {
  const expr = new LogicalExpression(new LogicalOperation(fn,),);
  expr.query = new Query({ project, property, ...extra, },);
  return fn.eval(expr,);
}

const D = (s: string,): TjTime => TjTime.fromString(s,);

describe("LogicalFunction — 2ª onda (Complemento Fase 11 §6)", () => {
  let project: Project;
  let task: Task;
  let resource: Resource;

  beforeEach(() => {
    project = createTestProject();
    task = new Task(project, "t1", "T1", null,);
    resource = new Resource(project, "r1", "R1", null,);
    task.setForScenario("assignedresources", [resource,], 0,);
  },);

  // --------------------------------------------------
  // G1.2 — argumentos-data
  // --------------------------------------------------
  describe("G1.2 argumentos-data", () => {
    it("aceita TjTime direto (caminho do parser `!date`)", () => {
      task.setForScenario("start", D("2026-03-01",), 0,);
      const fn = new LogicalFunction("startsafter",);
      fn.setArguments(["t1", D("2026-01-15",),],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("aceita string YYYY-MM-DD", () => {
      task.setForScenario("start", D("2026-03-01",), 0,);
      const fn = new LogicalFunction("startsbefore",);
      fn.setArguments(["t1", "2026-04-01",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("data inválida lança erro (não silencia para false)", () => {
      const fn = new LogicalFunction("startsafter",);
      fn.setArguments(["t1", "nao-eh-data",],);
      assertThrows(
        () => evalFn(fn, project, task,),
        Error,
        "Invalid date",
      );
    });

    it("aridade errada lança erro (defesa: parser não valida)", () => {
      const fn = new LogicalFunction("startsafter",);
      fn.setArguments(["t1",],);
      assertThrows(
        () => evalFn(fn, project, task,),
        Error,
        "Wrong number of arguments",
      );
    });
  });

  // --------------------------------------------------
  // G1.3 — isactive no caminho tipado
  // --------------------------------------------------
  describe("G1.3 isactive tipado", () => {
    it("verdadeiro quando o recurso tem bookings no intervalo", () => {
      const rs = resource.scenarioData(0,);
      for (let i = 0; i < 8; i++) rs.book(i, task,);
      const fn = new LogicalFunction("isactive",);
      fn.setArguments(["plan",],);
      assertEquals(
        evalFn(fn, project, task, { startIdx: 0, endIdx: 8, },),
        true,
      );
    });

    it("falso para Account (não é Task/Resource) e sem bookings", () => {
      const account = new Account(project, "ac", "Ac", null,);
      const fn = new LogicalFunction("isactive",);
      fn.setArguments(["plan",],);
      assertEquals(evalFn(fn, project, account,), false,);
      const fn2 = new LogicalFunction("isactive",);
      fn2.setArguments(["plan",],);
      assertEquals(
        evalFn(fn2, project, task, { startIdx: 0, endIdx: 8, },),
        false,
      );
    });
  });

  // --------------------------------------------------
  // G2 — datas agendadas
  // --------------------------------------------------
  describe("G2 starts*/ends*", () => {
    beforeEach(() => {
      task.setForScenario("start", D("2026-03-01",), 0,);
      task.setForScenario("end", D("2026-03-10",), 0,);
    },);

    it("startsafter: verdadeiro quando start > d", () => {
      const fn = new LogicalFunction("startsafter",);
      fn.setArguments(["t1", "2026-01-15",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("startsafter: falso quando start <= d", () => {
      const fn = new LogicalFunction("startsafter",);
      fn.setArguments(["t1", "2026-06-01",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });

    it("startsbefore: verdadeiro quando start < d", () => {
      const fn = new LogicalFunction("startsbefore",);
      fn.setArguments(["t1", "2026-04-01",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("endsafter: verdadeiro quando end > d", () => {
      const fn = new LogicalFunction("endsafter",);
      fn.setArguments(["t1", "2026-02-01",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("endsbefore: verdadeiro quando end < d", () => {
      const fn = new LogicalFunction("endsbefore",);
      fn.setArguments(["t1", "2026-04-01",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("sem datas agendadas → falso (não inventa)", () => {
      const other = new Task(project, "t9", "T9", null,);
      const fn = new LogicalFunction("startsafter",);
      fn.setArguments(["t9", "2026-01-15",],);
      assertEquals(evalFn(fn, project, other,), false,);
    });

    it("id inválido → lança erro (review (c): typo não silencia)", () => {
      const fn = new LogicalFunction("startsafter",);
      fn.setArguments(["nao-existe", "2026-01-15",],);
      assertThrows(
        () => evalFn(fn, project, task,),
        Error,
        "Unknown id",
      );
    });
  });

  describe("G2 isallocated / isallocatedtoproject", () => {
    beforeEach(() => {
      const rs = resource.scenarioData(0,);
      // Slots 0..7 (1 hora cada) a partir do início do projeto 2026-01-01.
      for (let i = 0; i < 8; i++) rs.book(i, task,);
    },);

    it("isallocated: verdadeiro no intervalo que cobre os bookings", () => {
      const fn = new LogicalFunction("isallocated",);
      fn.setArguments(["r1", "2026-01-01", "2026-01-02",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("isallocated: falso fora do intervalo agendado", () => {
      const fn = new LogicalFunction("isallocated",);
      fn.setArguments(["r1", "2026-06-01", "2026-06-30",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });

    it("isallocated: recurso desconhecido → falso", () => {
      const fn = new LogicalFunction("isallocated",);
      fn.setArguments(["nope", "2026-01-01", "2026-01-02",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });

    it("isallocatedtoproject: projeto+cenário corretos → verdadeiro", () => {
      const fn = new LogicalFunction("isallocatedtoproject",);
      fn.setArguments([project.id, "plan", "2026-01-01", "2026-01-02",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("isallocatedtoproject: id de projeto errado → falso", () => {
      const fn = new LogicalFunction("isallocatedtoproject",);
      fn.setArguments(["outro", "plan", "2026-01-01", "2026-01-02",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });
  });

  // --------------------------------------------------
  // G3 — material
  // --------------------------------------------------
  describe("G3 hasassignment", () => {
    it("recurso designado com booking no intervalo → verdadeiro", () => {
      const rs = resource.scenarioData(0,);
      for (let i = 0; i < 8; i++) rs.book(i, task,);
      const fn = new LogicalFunction("hasassignment",);
      fn.setArguments(["r1", "2026-01-01", "2026-01-02",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("recurso designado sem agenda alguma → existência basta", () => {
      const fn = new LogicalFunction("hasassignment",);
      fn.setArguments(["r1", "2026-01-01", "2026-01-02",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("recurso NÃO designado → falso", () => {
      const other = new Resource(project, "r2", "R2", null,);
      void other;
      const fn = new LogicalFunction("hasassignment",);
      fn.setArguments(["r2", "2026-01-01", "2026-01-02",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });

    it("material alocado com datas da tarefa cruzando o intervalo", () => {
      const mat = new Material(project, "ac", "ton", 50,);
      task.setForScenario("start", D("2026-02-01",), 0,);
      task.setForScenario("end", D("2026-02-10",), 0,);
      task.setForScenario(
        "materialallocations",
        [new MaterialAllocation(mat, 10, "perday",),],
        0,
      );
      const fn = new LogicalFunction("hasassignment",);
      fn.setArguments(["ac", "2026-02-05", "2026-03-01",],);
      assertEquals(evalFn(fn, project, task,), true,);
      const fn2 = new LogicalFunction("hasassignment",);
      fn2.setArguments(["ac", "2026-05-01", "2026-06-01",],);
      assertEquals(evalFn(fn2, project, task,), false,);
    });

    it("id que não é recurso nem material → falso", () => {
      const fn = new LogicalFunction("hasassignment",);
      fn.setArguments(["fantasma", "2026-01-01", "2026-01-02",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });

    it("recurso designado com agenda parcial fora do intervalo → falso", () => {
      // review (b): só a ausência **completa** de agenda faz a designação
      // contar por si; `start` definido sem overlap não superavalia.
      task.setForScenario("start", D("2026-06-01",), 0,);
      const fn = new LogicalFunction("hasassignment",);
      fn.setArguments(["r1", "2026-01-01", "2026-01-02",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });

    it("recurso designado com agenda parcial dentro do intervalo → verdadeiro", () => {
      // Distinguendo vs. o caso `hasassignment` puro: aqui há booking real
      // no intervalo, então o overlap das datas parciais é o caminho testado.
      const rs = resource.scenarioData(0,);
      for (let i = 0; i < 8; i++) rs.book(i, task,);
      task.setForScenario("start", D("2026-01-01",), 0,);
      const fn = new LogicalFunction("hasassignment",);
      fn.setArguments(["r1", "2026-01-01", "2026-01-02",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });
  });

  describe("G3 isusedat / isused / isusedatproject", () => {
    let mat: Material;

    beforeEach(() => {
      mat = new Material(project, "ac", "ton", 50,);
      task.setForScenario("start", D("2026-02-01",), 0,);
      task.setForScenario("end", D("2026-02-10",), 0,);
      task.setForScenario(
        "materialallocations",
        [new MaterialAllocation(mat, 10, "perday",),],
        0,
      );
    },);

    it("isusedat: material alocado no cenário plan → verdadeiro", () => {
      const fn = new LogicalFunction("isusedat",);
      fn.setArguments(["ac", "plan",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("isusedat: material sem alocação → falso", () => {
      const other = new Material(project, "zz", "ton", 1,);
      void other;
      const fn = new LogicalFunction("isusedat",);
      fn.setArguments(["zz", "plan",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });

    it("isusedat: via CostEvent material_usage (Fase 8.1)", () => {
      const other = new Task(project, "t2", "T2", null,);
      const rule = { type: "explicit_account", } as unknown as AttributionRule;
      project.costEvents.push(
        new CostEvent(
          "material_usage",
          500,
          null,
          rule,
          0,
          "planned",
          other,
          undefined,
          mat,
        ),
      );
      const fn = new LogicalFunction("isusedat",);
      fn.setArguments(["ac", "plan",],);
      assertEquals(evalFn(fn, project, other,), true,);
    });

    it("isused: tarefa + material no intervalo das datas → verdadeiro", () => {
      const fn = new LogicalFunction("isused",);
      fn.setArguments(["ac", "2026-02-05", "2026-03-01",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });

    it("isused: fora do intervalo das datas → falso", () => {
      const fn = new LogicalFunction("isused",);
      fn.setArguments(["ac", "2026-05-01", "2026-06-01",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });

    it("isused: propriedade é o próprio material → varre tarefas", () => {
      const fn = new LogicalFunction("isused",);
      fn.setArguments(["ac", "2026-02-05", "2026-02-20",],);
      assertEquals(evalFn(fn, project, mat,), true,);
    });

    it("isusedatproject: projeto+cenário corretos → verdadeiro", () => {
      const fn = new LogicalFunction("isusedatproject",);
      fn.setArguments([project.id, "plan", "2026-02-05", "2026-03-01",],);
      assertEquals(evalFn(fn, project, mat,), true,);
    });

    it("isusedatproject: projeto errado → falso", () => {
      const fn = new LogicalFunction("isusedatproject",);
      fn.setArguments(["outro", "plan", "2026-02-05", "2026-03-01",],);
      assertEquals(evalFn(fn, project, mat,), false,);
    });
  });
});

// --------------------------------------------------
// Review pós-onda (a)–(g) — mudanças pedidas no review da própria 2ª onda
// --------------------------------------------------
describe("LogicalFunction — review (a)–(g)", () => {
  let project: Project;
  let task: Task;
  let resource: Resource;

  beforeEach(() => {
    project = createTestProject();
    task = new Task(project, "t1", "T1", null,);
    resource = new Resource(project, "r1", "R1", null,);
    task.setForScenario("assignedresources", [resource,], 0,);
  },);

  it("(a) sem bookings: getAllocatedTime é exatamente 0 (zero é exato)", () => {
    const t = task.scenarioData(0,).getAllocatedTime(0, 8, resource,);
    assertEquals(t, 0,);
  });

  it("(a) 1 slot reservado: alocação > 0 mesmo com dwh não múltiplo", () => {
    project.set("dailyWorkingHours", 7,);
    resource.scenarioData(0,).book(3, task,);
    const t = task.scenarioData(0,).getAllocatedTime(0, 8, resource,);
    assert(t > 0, `esperado > 0, obtido ${t}`,);
    const fn = new LogicalFunction("isallocated",);
    fn.setArguments(["r1", "2026-01-01", "2026-01-02",],);
    assertEquals(evalFn(fn, project, task,), true,);
  });

  it("(f) datas fora do plano clampam — isallocated não lança", () => {
    // TjTime suporta 1970–2035; 1999/2030 ficam fora do plano 2026.
    const fn = new LogicalFunction("isallocated",);
    fn.setArguments(["r1", "1999-01-01", "1999-02-01",],);
    assertEquals(evalFn(fn, project, task,), false,);
    const fn2 = new LogicalFunction("isallocated",);
    fn2.setArguments(["r1", "2030-01-01", "2030-02-01",],);
    assertEquals(evalFn(fn2, project, task,), false,);
  });

  it("(f) dateToIdx fiel: antes → 0, depois → último slot, fora sem clamp → erro", () => {
    assertEquals(project.dateToIdx(D("1999-01-01",),), 0,);
    // Último slot = ceil((end - start) / granularity): plano 2026 → 8736.
    const start = (project.get("start",) as TjTime).toSeconds();
    const end = (project.get("end",) as TjTime).toSeconds();
    const size = project.scoreboard?.size ??
      Math.ceil((end - start) / 3600,) + 1;
    assertEquals(project.dateToIdx(D("2030-01-01",),), size - 1,);
    assertThrows(
      () => project.dateToIdx(D("1999-01-01",), false,),
      Error,
      "out of project time range",
    );
  });

  it("(g) regressão: data inválida lança MESMO sem datas de cenário (ordem)", () => {
    // O bug original: `dateBound` early-returnava false quando a entidade
    // não tinha `start`, sem nunca validar o argumento — a hoisting do
    // `dateArg` acima do early-return está travada aqui.
    const semDatas = new Task(project, "t9", "T9", null,);
    const fn = new LogicalFunction("endsbefore",);
    fn.setArguments(["t9", "lixo",],);
    assertThrows(
      () => evalFn(fn, project, semDatas,),
      Error,
      "Invalid date",
    );
  });
});

// --------------------------------------------------
// G5/LF.5a + LF.6 + G3.5 — parser
// --------------------------------------------------
describe("Complemento Fase 11 — 2ª onda via parser", () => {
  it("LF.5a: flags aceito no bloco material (sem unexpctd_token)", () => {
    const out = parseProject(
      PROJECT_HEADER + 'flags hot\nmaterial steel "Steel" {\nunit "kg"\n' +
        "flags hot\n}\n",
    );
    assert(
      !out.messageIds.includes("unexpctd_token",),
      "unexpctd_token: " + JSON.stringify(out.messageIds,),
    );
    assert(!out.messageIds.includes("undecl_flag",),);
    const project = out.result as Project;
    const flags = project.material("steel",)!.getForScenario(
      "flags",
      0,
    ) as string[];
    assert(flags.includes("hot",), "flags: " + JSON.stringify(flags,),);
  });

  it("LF.6: flag não declarado no material registra undecl_flag", () => {
    const out = parseProject(
      PROJECT_HEADER + 'material steel "Steel" {\nflags zzz\n}\n',
    );
    assert(out.messageIds.includes("undecl_flag",),);
  });

  it("(g) regressão parser: unit exige string quoted (kg solto é erro)", () => {
    // O teste LF.5a já cobre o caminho feliz com `unit "kg"`; aqui fixa o
    // pitfall descoberto na sessão: `unit kg` (sem aspas) NÃO é $STRING.
    const ruim = parseProject(
      PROJECT_HEADER + 'material steel "Steel" {\nunit kg\n}\n',
    );
    assert(
      ruim.messageIds.includes("unexpctd_token",),
      JSON.stringify(ruim.messageIds,),
    );
    const bom = parseProject(
      PROJECT_HEADER + 'material steel "Steel" {\nunit "kg"\n}\n',
    );
    assert(
      !bom.messageIds.includes("unexpctd_token",),
      JSON.stringify(bom.messageIds,),
    );
  });

  it("G3.5 smoke: material alocado via .tjp → isusedat/isused reais", () => {
    const out = parseProject(
      PROJECT_HEADER + 'material ac "AC" { unit "ton" }\n' +
        'task t1 "T1" {\nstart 2026-02-01\nend 2026-02-10\n' +
        "material ac 10 perday\n}\n",
    );
    const project = out.result as Project;
    const t = project.task("t1",)!;
    const fn = new LogicalFunction("isusedat",);
    fn.setArguments(["ac", "plan",],);
    assertEquals(evalFn(fn, project, t,), true,);
    const fn2 = new LogicalFunction("isused",);
    fn2.setArguments(["ac", D("2026-02-05",), D("2026-03-01",),],);
    assertEquals(evalFn(fn2, project, t,), true,);
    const fn3 = new LogicalFunction("isused",);
    fn3.setArguments(["ac", D("2026-05-01",), D("2026-06-01",),],);
    assertEquals(evalFn(fn3, project, t,), false,);
  });
});

// --------------------------------------------------
// G4 — atributos lógicos sobre material (LA.3/LA.4) + LF.4
// --------------------------------------------------
describe("Complemento Fase 11 — 2ª onda G4/LA", () => {
  let project: Project;
  let mat: Material;

  beforeEach(() => {
    project = createTestProject();
    mat = new Material(project, "ac", "ton", 50,);
    mat.setForScenario("effortdone", 12.5, 0,);
    mat.setForScenario("flags", ["hot",], 0,);
  },);

  it(
    "LA.3: LogicalAttribute lê atributo de cenário do material via Query",
    () => {
      const scenario = project.scenario(0,)!;
      const attr = new LogicalAttribute("effortdone", scenario,);
      const expr = new LogicalExpression(attr,);
      expr.query = new Query({ project, property: mat, },);
      assertEquals(attr.eval(expr,), 12.5,);
    },
  );

  it(
    "LA.3: esforço restante pré-carregado (default 0.0) também resolve",
    () => {
      const scenario = project.scenario(0,)!;
      const attr = new LogicalAttribute("effortleft", scenario,);
      const expr = new LogicalExpression(attr,);
      expr.query = new Query({ project, property: mat, },);
      assertEquals(attr.eval(expr,), 0,);
    },
  );

  it("LA.4: isvalid(plan.effortdone) sobre material → verdadeiro", () => {
    const fn = new LogicalFunction("isvalid",);
    fn.setArguments(["plan.effortdone",],);
    assertEquals(evalFn(fn, project, mat,), true,);
  });

  it("LA.4: isvalid(unit) sem cenário sobre material → verdadeiro", () => {
    const fn = new LogicalFunction("isvalid",);
    fn.setArguments(["unit",],);
    assertEquals(evalFn(fn, project, mat,), true,);
  });

  it("LA.4: isvalid(atributo inexistente) lança erro", () => {
    const fn = new LogicalFunction("isvalid",);
    fn.setArguments(["bogus_attr",],);
    assertThrows(() => evalFn(fn, project, mat,), Error, "Unknown attribute",);
  });

  it("LF.4: LogicalFlag genérico avalia nos 4 portadores", () => {
    const carriers: PropertyTreeNode[] = [
      new Task(project, "lt", "LT", null,),
      new Resource(project, "lr", "LR", null,),
      new Account(project, "la", "LA", null,),
      mat,
    ];
    for (const c of carriers) {
      c.setForScenario("flags", ["hot", "other",], 0,);
      const hit = new LogicalFlag("hot",);
      const exprHit = new LogicalExpression(hit,);
      exprHit.query = new Query({ project, property: c, },);
      assertEquals(hit.eval(exprHit,), true, `${c.id}: hot`,);
      const miss = new LogicalFlag("absent",);
      const exprMiss = new LogicalExpression(miss,);
      exprMiss.query = new Query({ project, property: c, },);
      assertEquals(miss.eval(exprMiss,), false, `${c.id}: absent`,);
    }
  });
});
