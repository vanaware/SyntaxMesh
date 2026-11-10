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

/**
 * A resource — a person, team or machine that can be allocated to tasks.
 *
 * Resources form a hierarchy of their own; containers aggregate the bookings of
 * their children. Availability, rates and bookings live in the per-scenario
 * {@link ResourceScenario} objects, so a resource may look different in each
 * scenario.
 */
export class Resource extends PropertyTreeNode {
  private chargeset_: ChargeSetCollection;

  /**
   * Creates a resource and registers it in the project.
   *
   * Every scenario gets its own `ResourceScenario`.
   *
   * @param project Project that owns the resource.
   * @param id Explicit id, or `null` to derive one from the parent path.
   * @param name Human-readable name.
   * @param parent Parent resource, or `null` at the root of the hierarchy.
   */
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

  /**
   * Typed access to the scenario data of this resource.
   *
   * @param scIdx Scenario index.
   * @returns The `ResourceScenario` of that scenario.
   */
  override scenarioData(scIdx: number,): ResourceScenario {
    return this.data[scIdx]! as ResourceScenario;
  }

  /**
   * Charge sets attached to the resource.
   */
  get chargeset(): ChargeSetCollection {
    return this.chargeset_;
  }

  /**
   * Replaces the charge sets attached to the resource.
   *
   * @param value New charge set collection.
   */
  set chargeset(value: ChargeSetCollection,) {
    this.chargeset_ = value;
  }

  /**
   * Effort already booked for the given scenario.
   *
   * Corresponds to Ruby's `ResourceScenario#bookedEffort`.
   *
   * @param scIdx Scenario index.
   */
  bookedEffort(scIdx: number,): number {
    return this.scenarioData(scIdx,).bookedEffort();
  }

  /**
   * Bookings of the resource in scenario `scIdx`, optionally restricted to
   * `iv`.
   *
   * Returns a map keyed by task when `hashByTask`, otherwise a flat array.
   * Wraps `ResourceScenario#getBookings` (Ruby delegates through
   * `method_missing`).
   *
   * @param scIdx Scenario index.
   * @param iv Interval to restrict the result to, or `null` for all bookings.
   * @param hashByTask When `true`, group the bookings by task.
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
   * Whether the resource (or one of its children) is allocated to `task` over
   * `iv`. Delegates to the scenario, like Ruby's `method_missing`.
   *
   * @param scIdx Scenario index.
   * @param iv Interval to test.
   * @param task Task to test, or `null` for any task.
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
   * Status dashboard of the tasks this resource is responsible for (Ruby
   * `Resource#query_dashboard` → `dashboard`, l.45-99).
   *
   * RUBY-COMPAT-FIX (category A — 16.17): Ruby sets
   * `"No 'trackingscenario' defined."` when `trackingScenarioIdx` is null, but
   * the following `taskList.empty?` branch **overwrites** that message, so the
   * text never showed up. Here the message is actually returned (an empty list
   * is the consequence of there being no tracking scenario).
   *
   * @param query Query whose `rti` receives the rendered dashboard.
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
    // Without section numbering and using the journal CSS class (Ruby l.94-98).
    rti.sectionNumbers = false;
    rti.cssClass = "tj_journal";
    query.rti = rti;
  }
}

/**
 * Original markup of an RTI (`rti.richText.inputText` in Ruby).
 *
 * `RichTextIntermediate.richText` is `unknown` in the port, so an empty string
 * is returned when the shape is not the expected one (only happens with an RTI
 * produced elsewhere).
 *
 * @param rti Rendered rich-text intermediate to read the markup from.
 */
function inputTextOf(rti: unknown,): string {
  const source = (rti as { richText?: { inputText?: unknown } } | null)
    ?.richText;
  return typeof source?.inputText === "string" ? source.inputText : "";
}
