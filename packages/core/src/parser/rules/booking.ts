/**
 * TjpSyntaxRules — `booking charge` (Adendo Extra §12.3, 14C.15.4–15.7).
 *
 * Formas aceitas, nas três origens (tarefa, recurso e material). A
 * `<descrição>` é um texto livre opcional e `value` é opcional (C15):
 *
 * ```tjp
 * task t "T" { booking charge ["<descrição>"] [value] <montante> on <data> }
 * resource r "R" { booking charge <tarefa> ["<descrição>"] [value] <montante> on <data> }
 * material m "M" { booking charge <tarefa> ["<descrição>"] [value] <montante> on <data> }
 * ```
 *
 * No corpo da tarefa **não** há referência de recurso (revisão 2026-11-02): o
 * booking de charge não consome esforço — a outra ponta da relação é a própria
 * tarefa dona do bloco. Recurso só é referência obrigatória no booking de
 * effort (`booking <recurso> <intervalo>`, TjpSyntaxRules.rb:6001).
 *
 * O montante entra no atributo de cenário `chargebookings` da **tarefa** dona
 * do gasto — quem declara é apenas a outra ponta da relação. A referência de
 * tarefa pode ser futura (a tarefa vem depois do bloco): vai para a fila
 * `Project.pendingBookings`, a mesma dos bookings de material (14C.11.5).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §13.3
 */
import type { Project, } from "../../model/project.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { ChargeBooking, } from "../../model/charge-booking.ts";
import { legacyTail, } from "../../model/booking-period.ts";
import type {
  BookingModifier,
  BookingTail,
} from "../../model/booking-period.ts";
import type { Material, } from "../../model/material.ts";
import { Resource, } from "../../model/resource.ts";
import { Task, } from "../../model/task.ts";
import type { TjTime, } from "../../time/tj-time.ts";
import type { TimeInterval, } from "../../time/time-interval.ts";
import { rule, } from "./helpers.ts";

const asProp = (parser: ProjectFileParser,): NonNullable<
  ProjectFileParser["property"]
> => parser.property!;

/** Anexa o booking ao atributo de cenário `chargebookings` da tarefa. */
export function appendChargeBooking(
  parser: ProjectFileParser,
  task: Task,
  booking: ChargeBooking,
): void {
  const current = (task.getForScenario(
    "chargebookings",
    parser.scenarioIdx,
  ) ?? []) as ChargeBooking[];
  task.setForScenario(
    "chargebookings",
    current.concat([booking,],),
    parser.scenarioIdx,
  );
}

/** Resolve uma referência de tarefa por ID e depois pelo nome. */
export function resolveTaskRef(
  project: Project,
  ref: string,
): Task | null {
  const byId = project.task(ref,);
  if (byId) return byId;
  let found: Task | null = null;
  project.tasks.each((node,) => {
    if (!(node instanceof Task)) return;
    if (node.name === ref) found = node;
  },);
  return found;
}

/**
 * Registra as regras de `booking charge`: referência de tarefa (ID ou nome,
 * com referência futura), descrição opcional ($STRING) e os três cabeçalhos,
 * um por origem. O `value` é opcional (Adendo Extra §12.3) e o montante aceita
 * sinal (estorno), como o booking de estoque de material.
 *
 * Onda D3: a ponta temporal é a regra compartilhada `bookingPeriodTail` —
 * `on <data>` (legado, ponto único) ou `<modifier> <intervalos>` / `<intervalos>`
 * (distribuição calendar-based). Usada também pelos bookings de material/estoque.
 */
export function registerBookingRules(p: ProjectFileParser,): void {
  // Modificadores de distribuição do booking: mesmos literais da alocação de
  // material (`materialAllocationModifierKeyword`), vocabulário único (Onda D).
  rule(p, "bookingModifierKeyword", () => {
    p.pattern(["_onstart",], () => "onstart",);
    p.descr("Book the whole amount on the first day of the interval.",);
    p.pattern(["_onend",], () => "onend",);
    p.descr("Book the whole amount on the last day of the interval.",);
    p.pattern(["_perhour",], () => "perhour",);
    p.descr("Book the amount for every hour of the interval.",);
    p.pattern(["_perday",], () => "perday",);
    p.descr("Book the amount for every day of the interval.",);
    p.pattern(["_perweek",], () => "perweek",);
    p.descr("Book the amount for every week of the interval.",);
    p.pattern(["_permonth",], () => "permonth",);
    p.descr("Book the amount for every month of the interval.",);
    p.pattern(["_distributed",], () => "distributed",);
    p.descr("Spread the amount over the days of the interval.",);
    p.arg(0, "modifier", "How the amount is distributed over the intervals.",);
  },);

  /**
   * Cauda temporal de um booking (Onda D3). Três formas, com tokens iniciais
   * disjointos (exigência da FSM):
   *
   * - `on <data>` — legado: tail degenerado de um dia (`onstart`),
   *   `isTemporal() === false`, consumidores mantêm o caminho antigo.
   * - `<modifier> <intervalos>` — distribuição explícita.
   * - `<intervalos>` — sem modifier: `distributed` (default da alocação).
   */
  rule(p, "bookingPeriodTail", () => {
    p.pattern(["_on", "!date",], function (this: ProjectFileParser,): unknown {
      return legacyTail(this.val[1] as TjTime,);
    },);
    p.pattern(
      ["!bookingModifierKeyword", "!valIntervals",],
      function (this: ProjectFileParser,): unknown {
        const intervals = (this.val[1] ?? []) as TimeInterval[];
        if (intervals.length === 0) return null;
        return {
          modifier: this.val[0] as BookingModifier,
          intervals,
        } satisfies BookingTail;
      },
    );
    p.pattern(["!valIntervals",], function (this: ProjectFileParser,): unknown {
      const intervals = (this.val[0] ?? []) as TimeInterval[];
      if (intervals.length === 0) return null;
      return {
        modifier: "distributed" as BookingModifier,
        intervals,
      } satisfies BookingTail;
    },);
    p.arg(0, "period", "`on <date>` or `<modifier> <interval>[, …]`.",);
  },);

  rule(p, "chargeBookingTaskRef", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      return String(this.val[0],);
    },);
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      return String(this.val[0],);
    },);
    p.arg(0, "task", "The ID or name of a task.",);
  },);

  /**
   * Descrição opcional do gasto (`$STRING`). No corpo da tarefa é o único
   * argumento textual; nas origens recurso/material vem **depois** da
   * referência de tarefa (Adendo Extra §12.3, revisão 2026-11-02).
   */
  rule(p, "chargeBookingDescription", () => {
    p.optional();
    p.pattern(["$STRING",], function (this: ProjectFileParser,): unknown {
      return String(this.val[0],);
    },);
  },);

  // `booking charge ["<descrição>"] [value] <montante> <cauda-temporal>` — corpo
  // da tarefa: sem referência de recurso (o dono do gasto é a própria tarefa).
  rule(p, "taskChargeBookingHeader", () => {
    p.pattern(
      [
        "_charge",
        "!chargeBookingDescription",
        "!bookingValueKeyword",
        "!signedNumber",
        "!bookingPeriodTail",
      ],
      function (this: ProjectFileParser,): unknown {
        addChargeBooking(
          this,
          null,
          asProp(this,) as unknown as Task,
          null,
          Number(this.val[3],),
          this.val[4] as BookingTail | null,
          this.val[1] as string | null,
        );
        return null;
      },
    );
    p.doc(
      "booking.charge",
      "Book a real expense (or, with a negative amount, a reversal) against " +
        "the task. The description and the `value` keyword are optional. The " +
        "period is `on <date>` or `<modifier> <interval>[, …]` (Onda D3).",
    );
    p.arg(1, "description", "Free-text label for the charge.",);
    p.arg(3, "value", "The amount booked (negative reverses).",);
    p.arg(4, "period", "When the charge falls (point or distributed).",);
  },);

  // `booking charge <tarefa> ["<descrição>"] [value] <montante> <cauda>` —
  // corpo do recurso.
  rule(p, "resourceChargeBookingHeader", () => {
    p.pattern(
      [
        "_charge",
        "!chargeBookingTaskRef",
        "!chargeBookingDescription",
        "!bookingValueKeyword",
        "!signedNumber",
        "!bookingPeriodTail",
      ],
      chargeBookingFromOrigin,
    );
    p.arg(1, "task", "The ID or name of the task carrying the charge.",);
    p.arg(2, "description", "Free-text label for the charge.",);
  },);

  // Idem no corpo do material (14C.15.7).
  rule(p, "materialChargeBookingHeader", () => {
    p.pattern(
      [
        "_charge",
        "!chargeBookingTaskRef",
        "!chargeBookingDescription",
        "!bookingValueKeyword",
        "!signedNumber",
        "!bookingPeriodTail",
      ],
      chargeBookingFromOrigin,
    );
    p.arg(1, "task", "The ID or name of the task carrying the charge.",);
    p.arg(2, "description", "Free-text label for the charge.",);
  },);
}

/**
 * Ação compartilhada pelos cabeçalhos de `booking charge` declarados por um
 * recurso ou um material: a referência é a **tarefa** e pode ser futura
 * (fila de pendências do projeto, 14C.15.7); o dono do bloco é o `owner`. A
 * descrição (índice 2) é opcional; a cauda temporal é o índice 5 (Onda D3).
 */
function chargeBookingFromOrigin(this: ProjectFileParser,): unknown {
  const owner = asProp(this,) as unknown as Resource | Material;
  const ref = String(this.val[1],);
  const task = resolveTaskRef(this.project!, ref,);
  if (!task) {
    this.error(
      "unknown_task",
      `Unknown task ${ref}`,
      this.sourceFileInfo[0] ?? null,
    );
  }
  addChargeBooking(
    this,
    owner,
    task,
    task ? null : ref,
    Number(this.val[4],),
    this.val[5] as BookingTail | null,
    this.val[2] as string | null,
  );
  return null;
}

/**
 * Cria o `ChargeBooking` e o anexa à tarefa dona (quando já declarada) ou à
 * fila de referências futuras do projeto (14C.15.7). `taskRef` é o ID/nome
 * quando a referência ainda não resolveu; `task` quando já resolveu. A
 * `tail` (Onda D3) é o período com modifier; sem tail o construtor degenera
 * o ponto legado a partir do início do primeiro intervalo.
 */
export function addChargeBooking(
  parser: ProjectFileParser,
  owner: Resource | Material | null,
  task: Task | null,
  taskRef: string | null,
  amount: number,
  tail: BookingTail | null,
  description: string | null = null,
): void {
  if (!tail) return;
  const date = tail.intervals[0]!.start;
  const booking = new ChargeBooking(
    owner,
    task ? task.fullId : taskRef,
    amount,
    date,
    task,
    description,
    tail,
  );
  if (task) {
    appendChargeBooking(parser, task, booking,);
    return;
  }
  parser.project!.pendingBookings.push({
    booking,
    scenarioIdx: parser.scenarioIdx,
    attrId: "chargebookings",
  },);
}
