import { TjArgumentError, TjTime, } from "../time/tj-time.ts";
import { Scoreboard, } from "../time/scoreboard.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { IntervalList, } from "../time/interval-list.ts";
import { ShiftScenario, } from "../model/shift-scenario.ts";
import { Resource, } from "../model/resource.ts";
import { ProjectLike, } from "../model/project-like.ts";
import { projectObjectId, } from "../utils/project-object-id.ts";
import {
  BIT_ASSIGNED,
  BIT_OFF_WORK,
  BIT_OVERRIDE,
  LEAVE_MASK,
  LEAVE_TYPES,
  packLeaveType,
} from "../time/scoreboard-bits.ts";

/**
 * Representa uma atribuição de shift a um intervalo de tempo.
 *
 * Cada `ShiftAssignment` associa um `ShiftScenario` a um `TimeInterval`.
 * O encoding de bits é calculado lazy via `ShiftAssignments.getSbSlot`.
 */
export class ShiftAssignment {
  readonly shiftScenario: ShiftScenario;
  readonly interval: TimeInterval;

  constructor(shiftScenario: ShiftScenario, interval: TimeInterval,) {
    this.shiftScenario = shiftScenario;
    this.interval = interval;
  }

  /**
   * Retorna uma chave hash determinística para esta atribuição.
   *
   * Usada para compartilhamento de scoreboards entre instâncias com conteúdo idêntico.
   */
  hashKey(): string {
    const projectId = projectObjectId(this.shiftScenario.project,);
    const start = this.interval.start.toSeconds();
    const end = this.interval.end.toSeconds();
    return `${projectId}|${this.shiftScenario.scenarioIndex}|${start}|${end}`;
  }

  /**
   * Retorna uma cópia profunda desta atribuição.
   */
  copy(): ShiftAssignment {
    return new ShiftAssignment(
      this.shiftScenario,
      new TimeInterval(this.interval,),
    );
  }

  /**
   * Verifica se este intervalo se sobrepõe ao intervalo dado.
   */
  overlaps(iv: TimeInterval,): boolean {
    return this.interval.overlaps(iv,);
  }

  /**
   * Verifica se a data está dentro do intervalo e o shift é de substituição.
   */
  replace(date: TjTime,): boolean {
    return this.assigned(date,) && this.shiftScenario.replace();
  }

  /**
   * Verifica se a data está dentro do intervalo de atribuição.
   */
  assigned(date: TjTime,): boolean {
    return date.greaterThanOrEqual(this.interval.start,) &&
      date.lessThan(this.interval.end,);
  }

  /**
   * Verifica se a data tem tempo de trabalho definido pelo shift.
   */
  onShift(date: TjTime,): boolean {
    return this.shiftScenario.onShift(date,);
  }

  /**
   * Verifica se a data tem leave definido pelo shift.
   */
  onLeave(date: TjTime,): boolean {
    return this.shiftScenario.onLeave(date,);
  }

  /**
   * Representação textual desta atribuição.
   */
  to_s(): string {
    return `<${this.shiftScenario.scenarioIndex}> ${this.interval.to_s()}`;
  }
}

/**
 * Gerencia atribuições de shifts a intervalos de tempo, com encoding de bits lazy.
 *
 * `ShiftAssignments` armazena as atribuições e calcula o encoding de bits
 * para cada slot de tempo sob demanda (lazy computation). Scoreboards são
 * compartilhados entre instâncias com o mesmo `hashKey` para economizar memória.
 */
export class ShiftAssignments {
  project: ProjectLike | null;
  readonly assignments: ShiftAssignment[];
  private scoreboard: Scoreboard<number | null> | null;
  private hashKeyCache: string | null;

  constructor(sa?: ShiftAssignments,) {
    if (sa) {
      this.assignments = sa.assignments.map((a,) => a.copy());
      this.project = sa.project;
      this.scoreboard = null;
      this.hashKeyCache = null;
      // Criar/compartilhar scoreboard
      this.newScoreboard();
    } else {
      this.assignments = [];
      this.project = null;
      this.scoreboard = null;
      this.hashKeyCache = null;
    }
  }

  /**
   * Retorna uma cópia profunda desta instância.
   *
   * As atribuições são copiadas via `ShiftAssignment.copy()`.
   * O scoreboard é reinicializado como null (computação lazy) para evitar
   * efeitos colaterais durante a clonagem.
   *
   * @see deepClone
   */
  deepClone(): ShiftAssignments {
    const clone = new ShiftAssignments();
    for (const a of this.assignments) {
      clone.assignments.push(a.copy(),);
    }
    clone.project = this.project;
    clone.scoreboard = null;
    clone.hashKeyCache = null;
    return clone;
  }

  /**
   * Adiciona uma atribuição se não houver sobreposição.
   *
   * @returns true se adicionada com sucesso, false se houver sobreposição.
   */
  addAssignment(sa: ShiftAssignment,): boolean {
    if (this.overlaps(sa.interval,)) {
      return false;
    }
    this.assignments.push(sa,);
    this.scoreboard = this.newScoreboard();
    return true;
  }

  /**
   * Verifica se algum intervalo se sobrepõe ao intervalo dado.
   */
  overlaps(iv: TimeInterval,): boolean {
    for (const sa of this.assignments) {
      if (sa.overlaps(iv,)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Retorna o slot do scoreboard para o índice dado, computando lazy se necessário.
   *
   * O encoding de bits é:
   * - Bit 0 (BIT_ASSIGNED): se alguma atribuição cobre este índice.
   * - Bit 1 (BIT_OFF_WORK): se nenhuma atribuição tem tempo de trabalho.
   * - Bits 2–5 (LEAVE_MASK): tipo de leave (holiday, annual, etc.).
   * - Bit 8 (BIT_OVERRIDE): se alguma atribuição é de substituição.
   */
  getSbSlot(idx: number,): number {
    if (!this.scoreboard) {
      this.scoreboard = this.newScoreboard();
    }

    const cached = this.scoreboard.get(idx,);
    if (cached !== null) {
      return cached;
    }

    // Converter idx para TjTime (conforme Ruby: getSbSlot usa a data do slot).
    const date = TjTime.fromDate(this.scoreboard.idxToDate(idx,),);

    // Computar encoding lazy
    let val = 0;
    let hasAssignment = false;

    for (const sa of this.assignments) {
      if (!sa.assigned(date,)) {
        continue;
      }
      hasAssignment = true;
      val |= BIT_ASSIGNED;

      if (!sa.onShift(date,)) {
        val |= BIT_OFF_WORK;
      }

      if (sa.onLeave(date,)) {
        val |= packLeaveType(LEAVE_TYPES.holiday,);
      }

      if (sa.replace(date,)) {
        val |= BIT_OVERRIDE;
      }
    }

    if (!hasAssignment) {
      val = 0;
    }

    this.scoreboard.set(idx, val,);
    return val;
  }

  /**
   * Verifica se há atribuição no índice dado.
   */
  assigned(idx: number,): boolean {
    return (this.getSbSlot(idx,) & BIT_ASSIGNED) !== 0;
  }

  /**
   * Verifica se há tempo de trabalho disponível no índice dado.
   */
  onShift(idx: number,): boolean {
    return (this.getSbSlot(idx,) & BIT_OFF_WORK) === 0;
  }

  /**
   * Verifica se há tempo de trabalho **não** disponível no índice dado.
   */
  timeOff(idx: number,): boolean {
    return (this.getSbSlot(idx,) & BIT_OFF_WORK) !== 0;
  }

  /**
   * Verifica se há leave no índice dado.
   */
  onLeave(idx: number,): boolean {
    return (this.getSbSlot(idx,) & LEAVE_MASK) !== 0;
  }

  /**
   * Coleta intervalos de tempo fora (off-duty) com duração mínima.
   */
  collectTimeOffIntervals(
    iv: TimeInterval,
    minDuration: number,
  ): IntervalList<TimeInterval> {
    if (!this.scoreboard) {
      this.scoreboard = this.newScoreboard();
    }
    return this.scoreboard.collectIntervals(
      iv,
      minDuration,
      (v,) => (v! & BIT_OFF_WORK) !== 0,
    );
  }

  /**
   * Retorna uma chave hash determinística para todas as atribuições.
   *
   * As atribuições são ordenadas por `interval.start` antes de gerar o hash.
   */
  hashKey(): string {
    if (this.hashKeyCache) {
      return this.hashKeyCache;
    }

    // Ordenar assignments por interval.start (in-place, como Ruby)
    this.assignments.sort((a, b,) =>
      a.interval.start.toSeconds() - b.interval.start.toSeconds()
    );

    const parts = this.assignments.map((a,) => a.hashKey());
    this.hashKeyCache = parts.join("||",);
    return this.hashKeyCache;
  }

  /**
   * Representação textual para depuração.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ShiftAssignments.rb:to_s
   */
  to_s(): string {
    if (this.assignments.length === 0) {
      return "";
    }
    const parts = this.assignments.map((a,) => a.to_s());
    return "shifts " + parts.join(", ",);
  }

  /**
   * Cria ou retorna um scoreboard compartilhado para este hashKey.
   *
   * Se o hashKey já existe no cache estático, adiciona o objectId ao Set
   * e retorna o scoreboard compartilhado. Senão, cria um novo scoreboard
   * com initVal null (lazy computation) e registra no cache.
   */
  newScoreboard(): Scoreboard<number | null> {
    const key = this.hashKey();
    const objId = projectObjectId(this.project ?? {},);

    const record = ShiftAssignments.scoreboards.get(key,);
    if (record) {
      record[0].add(objId,);
      return record[1];
    }

    if (!this.project) {
      throw new TjArgumentError("Project must be set to create scoreboard",);
    }

    const startRaw = this.project.get("start",);
    const endRaw = this.project.get("end",);
    const granularity = this.project.get("scheduleGranularity",) as number;

    const start = startRaw instanceof TjTime
      ? new Date(startRaw.toSeconds() * 1000,)
      : startRaw as Date;
    const end = endRaw instanceof TjTime
      ? new Date(endRaw.toSeconds() * 1000,)
      : endRaw as Date;

    if (!start || !end || !granularity) {
      throw new TjArgumentError(
        "Project missing required attributes for scoreboard",
      );
    }

    const sb = new Scoreboard<number | null>(start, end, granularity, null,);
    const ids = new Set<number>();
    ids.add(objId,);
    ShiftAssignments.scoreboards.set(key, [ids, sb,],);

    // Registrar FinalizationRegistry para limpar quando a instância for GC'ed
    ShiftAssignments.finalizer.register(this, { key, objId, },);

    return sb;
  }

  /**
   * Limpa o cache estático de scoreboards (usado em testes).
   */
  static sbClear(): void {
    ShiftAssignments.scoreboards.clear();
  }

  /**
   * Remove uma referência de objectId do cache estático.
   * Se o Set ficar vazio, deleta a entrada do Map.
   */
  static deleteScoreboard(objId: number,): void {
    for (const [key, [ids, sb,],] of ShiftAssignments.scoreboards) {
      ids.delete(objId,);
      if (ids.size === 0) {
        ShiftAssignments.scoreboards.delete(key,);
      }
    }
  }

  /** Cache estático de scoreboards compartilhados (hashKey → [Set<objectId>, Scoreboard]). */
  static scoreboards: Map<string, [Set<number>, Scoreboard<number | null>,]> =
    new Map();

  /** FinalizationRegistry para limpar cache quando instâncias são GC'ed. */
  static finalizer = new FinalizationRegistry<{ key: string; objId: number }>(
    (heldValue,) => {
      ShiftAssignments.deleteScoreboard(heldValue.objId,);
    },
  );
}
