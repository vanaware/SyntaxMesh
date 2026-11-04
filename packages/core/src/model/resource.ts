import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { ResourceScenario, } from "./resource-scenario.ts";
import { ChargeSetCollection, } from "../finance/charge-set-collection.ts";
import { type Task, } from "./task.ts";
import { type Booking, } from "../scheduling/booking.ts";
import { type TimeInterval, } from "../time/time-interval.ts";
import type { Query, } from "../query/query.ts";
import { RichText, } from "../richtext/rich-text.ts";
import { RTFHandlers, } from "../richtext/handlers/rtf-handlers.ts";

export class Resource extends PropertyTreeNode {
  private chargeset_: ChargeSetCollection;

  constructor(
    project: ProjectLike,
    id: string | null,
    name: string,
    parent: Resource | null,
  ) {
    super(project.resources, id, name, parent,);
    project.addResource(this,);
    this.chargeset_ = new ChargeSetCollection();
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new ResourceScenario(
        this,
        i,
        this.getScenarioAttributes(i,),
      );
    }
  }

  override scenarioData(scIdx: number,): ResourceScenario {
    return this.data[scIdx]! as ResourceScenario;
  }

  /**
   * Retorna o charge set do recurso.
   */
  get chargeset(): ChargeSetCollection {
    return this.chargeset_;
  }

  /**
   * Define o charge set do recurso.
   */
  set chargeset(value: ChargeSetCollection,) {
    this.chargeset_ = value;
  }

  /**
   * Retorna o esforço já alocado (booked effort) para o cenário dado.
   *
   * Corresponde a `ResourceScenario#bookedEffort` do Ruby.
   */
  bookedEffort(scIdx: number,): number {
    return this.scenarioData(scIdx,).bookedEffort();
  }

  /**
   * Retorna os bookings do recurso no cenário `scIdx`, opcionalmente limitados
   * ao intervalo `iv`. Hash por tarefa quando `hashByTask`, senão array plano.
   *
   * Envolve `ResourceScenario#getBookings` (Ruby delega via method_missing).
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:getBookings
   */
  getBookings(
    scIdx: number,
    iv: TimeInterval | null = null,
    hashByTask = true,
  ): Map<Task, Booking> | Booking[] {
    return this.scenarioData(scIdx,).getBookings(iv, hashByTask,);
  }

  /**
   * O recurso (ou um dos seus filhos) está alocado a `task` no intervalo `iv`?
   * Delega ao cenário, como o `method_missing` do Ruby.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:allocated?
   */
  allocated(
    scIdx: number,
    iv: TimeInterval,
    task: Task | null = null,
  ): boolean {
    return this.scenarioData(scIdx,).allocated(iv, task,);
  }

  /**
   * Painel de status das tarefas sob responsabilidade deste recurso (Ruby
   * `Resource#query_dashboard` → `dashboard`, l.45-99).
   *
   * RUBY-COMPAT-FIX (Category A — 16.17): o Ruby grava
   * `"No 'trackingscenario' defined."` quando `trackingScenarioIdx` é nulo,
   * mas logo depois o ramo `taskList.empty?` **sobrescreve** a mensagem, então
   * o texto nunca aparecia. Aqui a mensagem é devolvida de fato (a lista vazia
   * é consequência de não haver cenário de tracking).
   */
  query_dashboard(query: Query,): void {
    const project = query.project;
    if (!project) return;

    const scenarioIdx = project.get("trackingScenarioIdx",) as
      | number
      | null
      | undefined;
    let rText: string;

    if (scenarioIdx === null || scenarioIdx === undefined) {
      rText = "No 'trackingscenario' defined.";
    } else {
      const taskList: PropertyTreeNode[] = [];
      for (const node of project.tasks.toArray()) {
        const task = node as PropertyTreeNode;
        const responsible = task.getForScenario("responsible", scenarioIdx,) as
          | Resource[]
          | null;
        if (!responsible?.includes(this,)) continue;
        const entries = project.journal.currentEntries(
          query.end,
          task,
          0,
          query.start,
          query.hideJournalEntry,
        );
        if (entries.length === 0) continue;
        taskList.push(task,);
      }

      if (taskList.length === 0) {
        rText = "We have no current status for any task that " + this.name +
          " is responsible for.";
      } else {
        rText = "";
        for (const task of taskList) {
          task.query_alert(query,);
          const alertMarkup = inputTextOf(query.rti,);
          rText += "=== <nowiki>[</nowiki>" + alertMarkup +
            `<nowiki>] Task: ${task.name}</nowiki> (${task.fullId}) ===\n\n`;
          task.query_journalmessages(query,);
          rText += inputTextOf(query.rti,) + "\n\n";
        }
      }
    }

    const rti = new RichText(
      rText,
      RTFHandlers.create(project,),
    ).generateIntermediateFormat();
    if (!rti) return;
    // Sem numeração de seção e com a classe CSS do journal (Ruby l.94-98).
    rti.sectionNumbers = false;
    rti.cssClass = "tj_journal";
    query.rti = rti;
  }
}

/**
 * Markup original de um RTI (`rti.richText.inputText` no Ruby).
 *
 * `RichTextIntermediate.richText` é `unknown` no port; devolvemos string vazia
 * quando a forma não é a esperada (só acontece com RTI de outra origem).
 */
function inputTextOf(rti: unknown,): string {
  const source = (rti as { richText?: { inputText?: unknown } } | null)
    ?.richText;
  return typeof source?.inputText === "string" ? source.inputText : "";
}
