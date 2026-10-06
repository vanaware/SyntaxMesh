import { type ProjectLike, } from "../model/project-like.ts";
import { type Task, } from "../model/task.ts";

/**
 * Representa uma dependência entre tarefas.
 *
 * Uma `TaskDependency` armazena um `taskId` (string, resolvido tardiamente),
 * `onEnd` (se a dependência é relativa ao início ou fim da tarefa),
 * `gapDuration` (calendário, segundos), e `gapLength` (working time, slots).
 *
 * Fonte Ruby: `docs/taskjuggler/lib/taskjuggler/TaskDependency.rb`
 */
export class TaskDependency {
  readonly taskId: string;
  task: Task | null;
  onEnd: boolean;
  gapDuration: number;
  gapLength: number;

  constructor(taskId: string, onEnd: boolean) {
    this.taskId = taskId;
    this.task = null;
    this.onEnd = onEnd;
    this.gapDuration = 0;
    this.gapLength = 0;
  }

  /**
   * Verifica se esta dependência é igual a outra.
   *
   * Duas dependências são iguais se tiverem o mesmo `taskId`, `task`, `onEnd`,
   * `gapDuration` e `gapLength`.
   */
  equals(other: TaskDependency): boolean {
    return (
      this.taskId === other.taskId &&
      this.task === other.task &&
      this.onEnd === other.onEnd &&
      this.gapDuration === other.gapDuration &&
      this.gapLength === other.gapLength
    );
  }

  /**
   * Resolve o `taskId` para um objeto `Task` usando o projeto fornecido.
   *
   * @param project — objeto ProjectLike que deve implementar `task(id: string): Task | null`
   * @returns O objeto Task resolvido, ou null se não existir.
   */
  resolve(project: ProjectLike): Task | null {
    this.task = project.task(this.taskId);
    return this.task;
  }
}