import { type ProjectLike, } from "../model/project-like.ts";
import { type Task, } from "../model/task.ts";

/**
 * Dependency between two tasks.
 *
 * A `TaskDependency` stores a `taskId` (a string, resolved lazily), `onEnd`
 * (whether the dependency refers to the start or the end of the task),
 * `gapDuration` (calendar time, in seconds) and `gapLength` (working time, in
 * slots).
 *
 * Ruby source: `docs/taskjuggler/lib/taskjuggler/TaskDependency.rb`
 */
export class TaskDependency {
  /** Identifier of the predecessor task, resolved on `resolve()`. */
  readonly taskId: string;
  /** Resolved predecessor task, or `null` until `resolve()` runs. */
  task: Task | null;
  /** `true` when the dependency hangs off the end of the predecessor. */
  onEnd: boolean;
  /** Gap before the successor, measured in calendar seconds. */
  gapDuration: number;
  /** Gap before the successor, measured in working-time slots. */
  gapLength: number;

  /**
   * Creates an unresolved dependency.
   *
   * @param taskId Identifier of the predecessor task.
   * @param onEnd `true` when the dependency refers to the end of the task.
   */
  constructor(taskId: string, onEnd: boolean,) {
    this.taskId = taskId;
    this.task = null;
    this.onEnd = onEnd;
    this.gapDuration = 0;
    this.gapLength = 0;
  }

  /**
   * Compares this dependency with another one.
   *
   * Two dependencies are equal when `taskId`, `task`, `onEnd`, `gapDuration`
   * and `gapLength` all match.
   *
   * @param other Dependency to compare against.
   * @returns `true` when every field is identical.
   */
  equals(other: TaskDependency,): boolean {
    return (
      this.taskId === other.taskId &&
      this.task === other.task &&
      this.onEnd === other.onEnd &&
      this.gapDuration === other.gapDuration &&
      this.gapLength === other.gapLength
    );
  }

  /**
   * Resolves `taskId` into a `Task` using the supplied project.
   *
   * @param project Object that implements `task(id: string): Task | null`.
   * @returns The resolved task, or `null` when it does not exist.
   */
  resolve(project: ProjectLike,): Task | null {
    this.task = project.task(this.taskId,);
    return this.task;
  }
}
