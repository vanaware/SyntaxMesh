/**
 * Fase 23 — 23.7.4/23.7.5/23.7.6: integração do elemento `template`.
 *
 * O `template` é pré-processamento (plano §7.2): o texto que ele produz entra
 * no stream do scanner como se tivesse sido digitado. A prova de que a extensão
 * não vaza semântica própria para o motor é **equivalência**: o projeto escrito
 * à mão e o projeto gerado por template têm de chegar ao mesmo modelo.
 *
 *   1. 23.7.4 — schedule idêntico (effort, duração, datas, deps, alocações).
 *   2. 23.7.5 — financeiro idêntico (`turnover`, charges, credits da conta).
 *   3. 23.7.6 — `TaskJuggler.generateReports` gera o relatório do fixture
 *      `reports.tjp` sem erro, com string HTML em memória (ADR 027).
 *
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md (23.7.4–23.7.6)
 */

import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { TaskJuggler, } from "../../src/taskjuggler.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { loadTemplateFixture, } from "../golden/template-expansion-snapshot.ts";
import { parseProject, } from "../parser/parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Task, } from "../../src/model/task.ts";
import type { TaskScenario, } from "../../src/model/task-scenario.ts";
import type { Account, } from "../../src/model/account.ts";
import type { Allocation, } from "../../src/scheduling/allocation.ts";
import type { Charge, } from "../../src/finance/charge.ts";
import type { AccountCredit, } from "../../src/finance/account-credit.ts";
import type { ChargeBooking, } from "../../src/model/charge-booking.ts";
import type { Report, } from "../../src/model/report.ts";

// Fuso fixo: as datas têm de ser comparáveis entre as duas variantes e com o
// resto da suíte (mesma convenção de `parser-scheduler_e2e_test.ts`).
TjTime.setTimeZone("UTC",);

/**
 * Cabeçalho comum das variantes de 23.7.4: o registro do template só existe na
 * variante gerada; o resto do texto é idêntico.
 *
 * O template entra **depois** do `}` (23.9): `template` segue a condição da
 * `macro` e não é aceito dentro do bloco `{ }` do cabeçalho.
 */
const HEADER = (template: string,): string =>
  `project tmplsched "Template Schedule" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
  now 2026-01-01
}
${template}
resource tux "Tux"

`;

/** Variante gerada por template: três fases encadeadas por `depends`. */
const TEMPLATED_SCHEDULE = HEADER(
  `template PHASE [ task {{ id }} "{{ nome }}" { effort {{ esforco }} allocate tux {{ dep }} } ] (id, nome, esforco, dep)
`,
) +
  `\${PHASE id="t1" nome="Design" esforco="5d" dep=""}
\${PHASE id="t2" nome="Build" esforco="10d" dep="depends !t1"}
\${PHASE id="t3" nome="Test" esforco="2d" dep="depends !t2"}
`;

/** Equivalente escrito à mão — mesmo modelo, zero `template`. */
const MANUAL_SCHEDULE = HEADER("",) +
  `task t1 "Design" {
  effort 5d
  allocate tux
}

task t2 "Build" {
  effort 10d
  allocate tux
  depends !t1
}

task t3 "Test" {
  effort 2d
  allocate tux
  depends !t2
}
`;

/** Parse + schedule; exige que o parse não tenha registrado erro. */
function parseAndSchedule(text: string,): Project {
  const out = parseProject(text,);
  assert(
    out.threw === null,
    `parse lançou: ${out.threw?.message} (${out.messageIds.join(",",)})`,
  );
  assert(
    out.result instanceof Object,
    `parse falhou: ${out.messageIds.join(",",)}`,
  );
  const project = out.result as Project;
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  assert(project.schedule(), "schedule() devolveu false",);
  assertEquals(
    MessageHandlerInstance.instance.errors,
    0,
    `erros de schedule: ${
      MessageHandlerInstance.instance.messages.map((m,) =>
        `${m.id}:${m.message}`
      )
        .join(" | ",)
    }`,
  );
  return project;
}

/** Data (YYYY-MM-DD) do atributo, ou `<null>`. */
function iso(value: unknown,): string {
  return value instanceof TjTime ? value.toString().slice(0, 10,) : "<null>";
}

/** `fullId` das alocações, em ordem. */
function allocIds(task: Task,): string[] {
  const allocs = (task.getForScenario("allocate", 0,) ?? []) as Allocation[];
  return allocs.flatMap((a,) => a.candidates.map((r,) => r.fullId));
}

/** `taskId` das dependências, em ordem. */
function depIds(task: Task,): string[] {
  const deps = (task.getForScenario("depends", 0,) ?? []) as Array<{
    taskId: string;
  }>;
  return deps.map((d,) => d.taskId);
}

/** Assinatura do agendamento: tudo o que o motor decidiu, por task. */
function scheduleSignature(project: Project,): unknown[] {
  return (project.tasks.toArray() as Task[]).map((t,) => [
    t.id,
    t.name,
    t.getForScenario("effort", 0,) ?? null,
    t.getForScenario("duration", 0,) ?? null,
    iso(t.getForScenario("start", 0,),),
    iso(t.getForScenario("end", 0,),),
    depIds(t,),
    allocIds(t,),
  ]);
}

/** Cabeçalho comum das variantes de 23.7.5 — inclui uma conta com créditos. */
const FIN_HEADER = (template: string,): string =>
  `project tplfin "Template Finance" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
  now 2026-01-01
  currency "EUR"
}
${template}
account dev "Desenvolvimento" {
  credits 2026-01-05 "Aporte" 1000
}

resource tux "Tux"

`;

/** Variante gerada: `chargeset` + `charge` + `booking charge` vindos do corpo. */
const TEMPLATED_FINANCE = FIN_HEADER(
  `template COSTED [ task {{ id }} "{{ nome }}" { effort {{ esforco }} chargeset dev 100% charge {{ valor }} onstart booking charge {{ valor }} on {{ data }} allocate tux } ] (id, nome, esforco, valor, data)
`,
) +
  `\${COSTED id="t1" nome="Análise" esforco="5d" valor="480" data="2026-02-15"}
\${COSTED id="t2" nome="Build" esforco="10d" valor="960" data="2026-03-01"}
`;

/** Equivalente manual, mesma estrutura financeira. */
const MANUAL_FINANCE = FIN_HEADER("",) +
  `task t1 "Análise" {
  effort 5d
  chargeset dev 100%
  charge 480 onstart
  booking charge 480 on 2026-02-15
  allocate tux
}

task t2 "Build" {
  effort 10d
  chargeset dev 100%
  charge 960 onstart
  booking charge 960 on 2026-03-01
  allocate tux
}
`;

/** Soma do `turnover` de cada task folha para a conta `dev`. */
function turnoverOf(project: Project,): number {
  const account = project.account("dev",) as Account;
  const start = project.dateToIdx(project.get("start",) as TjTime,);
  const end = project.dateToIdx(project.get("end",) as TjTime,);
  let total = 0;
  for (const task of project.tasks.toArray() as Task[]) {
    total += (task.scenarioData(0,) as TaskScenario).turnover(
      start,
      end,
      account,
    );
  }
  return total;
}

/** Charges e credits comparáveis entre as duas variantes. */
function financeSignature(project: Project,) {
  const tasks = project.tasks.toArray() as Task[];
  const charges = tasks.flatMap((t,) =>
    ((t.getForScenario("charge", 0,) ?? []) as Charge[]).map((c,) => [
      t.id,
      c.amount,
      c.mode,
    ])
  );
  const bookkeeping = tasks.flatMap((t,) =>
    ((t.getForScenario("chargebookings", 0,) ?? []) as ChargeBooking[])
      .map((b,) => [t.id, b.amount, iso(b.date,),])
  );
  const credits = ((project.account("dev",) as Account).getForScenario(
    "credits",
    0,
  ) ?? []) as AccountCredit[];
  return {
    turnover: turnoverOf(project,),
    charges,
    bookkeeping,
    credits: credits.map((c,) => [iso(c.date,), c.description, c.amount,]),
  };
}

describe("23.7.4 — template vs manual: schedule idêntico", () => {
  it("effort, duração, datas, deps e alocações coincidem", () => {
    const templated = parseAndSchedule(TEMPLATED_SCHEDULE,);
    const manual = parseAndSchedule(MANUAL_SCHEDULE,);
    assertEquals(scheduleSignature(templated,), scheduleSignature(manual,),);
  });

  it("o encadeamento de deps produz o mesmo caminho crítico", () => {
    const templated = parseAndSchedule(TEMPLATED_SCHEDULE,);
    const manual = parseAndSchedule(MANUAL_SCHEDULE,);
    const chain = (p: Project,) =>
      (p.tasks.toArray() as Task[]).map((t,) => [
        t.id,
        depIds(t,),
        iso(t.getForScenario("start", 0,),),
        iso(t.getForScenario("end", 0,),),
      ]);
    assertEquals(chain(templated,), chain(manual,),);
    // Sanidade do fixture: t1 → t2 → t3 numa sequência sem sobreposição.
    const t1 = templated.task("t1",)!;
    const t3 = templated.task("t3",)!;
    assert(
      iso(t1.getForScenario("end", 0,),) <=
        iso(t3.getForScenario("start", 0,),),
      "t3 deveria começar depois do fim de t1",
    );
    assertEquals(depIds(templated.task("t2",)!,), ["t1",],);
  });
});

describe("23.7.5 — template vs manual: financeiro idêntico", () => {
  it("turnover, charges e credits da conta coincidem", () => {
    const templated = parseAndSchedule(TEMPLATED_FINANCE,);
    const manual = parseAndSchedule(MANUAL_FINANCE,);
    const tpl = financeSignature(templated,);
    const man = financeSignature(manual,);

    assertEquals(tpl, man,);
    // Sanidade: os dois caminhos financeiros do corpo entraram no modelo.
    assertEquals(tpl.charges, [
      ["t1", 480, "onStart",],
      ["t2", 960, "onStart",],
    ],);
    assertEquals(tpl.bookkeeping, [
      ["t1", 480, "2026-02-15",],
      ["t2", 960, "2026-03-01",],
    ],);
    assertEquals(tpl.turnover, 1440,);
    assertEquals(tpl.credits, [["2026-01-05", "Aporte", 1000,],],);
  });
});

describe("23.7.6 — template + TaskJuggler.generateReports", () => {
  it("gera o taskreport do fixture sem erro e com HTML em memória", () => {
    const out = parseProject(loadTemplateFixture("reports",),);
    assertEquals(
      out.messageIds,
      [],
      `msgs=${out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)}`,
    );
    const project = out.result as Project;
    assertEquals(
      (project.tasks.toArray() as Task[]).map((t,) => t.id),
      ["alpha", "beta",],
    );

    const tj = new TaskJuggler();
    tj.project = project;
    assert(tj.schedule(), "tj.schedule() devolveu false",);

    assertEquals(tj.errors, 0,);
    assertEquals(tj.generateReports(), true,);

    const report = project.report("tr",) as Report;
    assert(report, "relatório `tr` ausente",);
    const output = report.output;
    // ADR 027: browser — o resultado é SEMPRE string em memória.
    assertEquals(typeof output, "string",);
    assert((output as string).includes("<table",), "saída sem tabela",);
    assert((output as string).includes("Alfa",), "saída sem a task `alpha`",);
    assert((output as string).includes("Beta",), "saída sem a task `beta`",);
    assertEquals(project.reportContexts.length, 0,);
  });
});
