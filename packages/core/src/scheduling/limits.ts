import { TjArgumentError, } from "../attributes/errors.ts";
import { ScoreboardInterval, } from "../time/scoreboard-interval.ts";
import { Scoreboard, } from "../time/scoreboard.ts";
import { TjTime, } from "../time/tj-time.ts";
import { ProjectLike, } from "../model/project-like.ts";
import { Resource, } from "../model/resource.ts";

/**
 * Um único limite (daily, weekly, monthly, etc.) com um `Scoreboard<number>` de contadores.
 *
 * O `Limit` é usado por `TaskScenario` e `ResourceScenario` para verificar e
 * alocar tempo antes de book. Ele armazena contadores por período (daily, weekly, monthly).
 */
export class Limit {
  readonly name: string;
  readonly interval: ScoreboardInterval;
  readonly period: number;
  readonly value: number;
  readonly upper: boolean;
  resource: Resource | null;
  private scoreboard: Scoreboard<number>;
  private dirty: boolean;

  constructor(
    name: string,
    interval: ScoreboardInterval,
    period: number,
    value: number,
    upper: boolean,
    resource: Resource | null = null,
  ) {
    this.name = name;
    this.interval = interval;
    this.period = period;
    this.value = value;
    this.upper = upper;
    this.resource = resource;
    this.scoreboard = new Scoreboard<number>(interval.startDate().toDate(), interval.endDate().toDate(), period, 0,);
    this.dirty = false;
  }

  /** Retorna o scoreboard interno (para testes). */
  getScoreboard(): Scoreboard<number> {
    return this.scoreboard;
  }

  /** Retorna se o limite está sujo (para testes). */
  getDirty(): boolean {
    return this.dirty;
  }

  /**
   * Retorna uma cópia profunda deste limite.
   */
  copy(): Limit {
    // Criar um novo ScoreboardInterval com os mesmos valores
    const newInterval = new ScoreboardInterval(
      this.interval.sbStart,
      this.interval.slotDuration,
      this.interval.start,
      this.interval.end,
    );
    const newLimit = new Limit(
      this.name,
      newInterval,
      this.period,
      this.value,
      this.upper,
      this.resource,
    );
    // Copiar o scoreboard
    newLimit.scoreboard = new Scoreboard<number>(
      this.scoreboard.startDate,
      this.scoreboard.endDate,
      this.scoreboard.resolution,
      undefined,
    );
    for (let i = 0; i < this.scoreboard.size; i++) {
      newLimit.scoreboard.set(i, this.scoreboard.get(i),);
    }
    newLimit.dirty = this.dirty;
    return newLimit;
  }

  /**
   * Reseta o limite para o valor inicial (0).
   *
   * @param index — se fornecido, reseta apenas o slot para este índice (convertido de TjTime).
   */
  reset(index?: number | TjTime): void {
    if (index !== undefined) {
      const idx = typeof index === "number" ? index : this.interval.dateToIndex(index,);
      if (this.interval.contains(idx,)) {
        this.scoreboard.set(idx, 0,);
      }
    } else {
      this.scoreboard.clear(0,);
    }
    this.dirty = false;
  }

  /**
   * Incrementa o contador para o índice/tempo dado, se permitido.
   *
   * @param index — índice dentro do intervalo do limite (convertido de TjTime).
   * @param resource — recurso que está alocando (para filtrar).
   */
  inc(index: number | TjTime, resource: Resource | null): void {
    const idx = typeof index === "number" ? index : this.interval.dateToIndex(index,);
    if (!this.interval.contains(idx,)) {
      return;
    }
    if (this.resource !== null && this.resource !== resource) {
      return;
    }
    const current = this.scoreboard.get(idx,);
    this.scoreboard.set(idx, current + 1,);
    this.dirty = true;
  }

  /**
   * Decrementa o contador para o índice/tempo dado, se permitido.
   */
  dec(index: number | TjTime, resource: Resource | null): void {
    const idx = typeof index === "number" ? index : this.interval.dateToIndex(index,);
    if (!this.interval.contains(idx,)) {
      return;
    }
    if (this.resource !== null && this.resource !== resource) {
      return;
    }
    const current = this.scoreboard.get(idx,);
    this.scoreboard.set(idx, current - 1,);
    this.dirty = true;
  }

  /**
   * Verifica se o limite é satisfatório para o índice/tempo dado.
   *
   * @param index — índice dentro do intervalo do limite (convertido de TjTime). Se null, verifica todos os slots.
   * @param upper — se deve verificar o limite superior (max) ou inferior (min).
   * @param resource — recurso que está verificando (para filtrar).
   * @returns true se o limite for satisfatório.
   */
  ok(index: number | TjTime | null, upper: boolean, resource: Resource | null): boolean {
    // Se upper !== this.upper ou resource filtrado, sempre retorna true
    if (upper !== this.upper || (this.resource !== null && this.resource !== resource)) {
      return true;
    }

    if (index === null) {
      // Verificar todos os slots
      for (let i = 0; i < this.scoreboard.size; i++) {
        const value = this.scoreboard.get(i,);
        if (this.upper) {
          if (value >= this.value) {
            return false;
          }
        } else {
          if (value < this.value) {
            return false;
          }
        }
      }
      return true;
    }

    const targetIdx = typeof index === "number" ? index : this.interval.dateToIndex(index,);
    if (!this.interval.contains(targetIdx,)) {
      return true;
    }

    const sbIdx = this.idxToSbIdx(targetIdx);
    const value = this.scoreboard.get(sbIdx,);

    if (this.upper) {
      // Limite superior: valor deve ser < this.value
      return value < this.value;
    } else {
      // Limite inferior: valor deve ser >= this.value
      return value >= this.value;
    }
  }

  /**
   * Converte um índice do projeto para um índice do scoreboard do limite.
   */
  private idxToSbIdx(index: number): number {
    return Math.trunc(
      (index - this.interval.start) * this.interval.slotDuration / this.period,
    );
  }
}

/**
 * Coleção de limites (`Limit[]`) associada a um projeto.
 *
 * `Limits` é usado por `TaskScenario` e `ResourceScenario` para gerenciar
 * múltiplos limites (dailymax, weeklymax, monthlymax, etc.).
 */
export class Limits {
  readonly limits: Limit[];
  private project: ProjectLike | null;

  constructor(limits?: Limit[] | Limits) {
    if (limits instanceof Limits) {
      // Cópia profunda
      this.limits = limits.limits.map((limit) => limit.copy(),);
      this.project = limits.project;
    } else if (Array.isArray(limits,)) {
      this.limits = limits.map((limit) => limit.copy(),);
      this.project = null;
    } else {
      this.limits = [];
      this.project = null;
    }
  }

  /** Retorna o projeto associado (para testes). */
  getProject(): ProjectLike | null {
    return this.project;
  }

  /**
   * Associa este `Limits` a um projeto.
   *
   * @throws TjArgumentError se `limits` não estiver vazio.
   */
  setProject(project: ProjectLike): void {
    if (this.limits.length > 0) {
      throw new TjArgumentError("Cannot set project on Limits that already has limits",);
    }
    this.project = project;
  }

  /**
   * Reseta todos os limites para o valor inicial (0).
   */
  reset(): void {
    for (const limit of this.limits) {
      limit.reset();
    }
  }

  /**
   * Adiciona ou substitui um limite.
   *
   * @param name — um dos tipos de limite (`dailymax`, `weeklymax`, `monthlymax`, `maximum`, `minimum`).
   * @param value — valor do limite (em segundos para max/min, em segundos para daily/weekly/monthly).
   * @param interval — opcional, `ScoreboardInterval` customizado. Se não fornecido, criado a partir do projeto.
   * @param resource — opcional, recurso que este limite se aplica (para limites por recurso).
   */
  setLimit(name: string, value: number, interval?: ScoreboardInterval, resource?: Resource): void {
    // Determinar tipo de limite e período
    let period: number;
    let upper: boolean;

    switch (name) {
      case "dailymax":
      case "dailymin":
        period = 86400; // 1 dia em segundos
        upper = name === "dailymax";
        break;
      case "weeklymax":
      case "weeklymin":
        period = 604800; // 1 semana em segundos
        upper = name === "weeklymax";
        break;
      case "monthlymax":
      case "monthlymin":
        period = 2592000; // ~30 dias em segundos
        upper = name === "monthlymax";
        break;
      case "maximum":
        period = interval ? interval.duration() : 0;
        upper = true;
        break;
      case "minimum":
        period = interval ? interval.duration() : 0;
        upper = false;
        break;
      default:
        throw new TjArgumentError(`Unknown limit name: ${name}`,);
    }

    // Se interval não fornecido, criar a partir do projeto
    if (!interval && this.project) {
      const startDate = this.project.get("start");
      const endDate = this.project.get("end");
      const scheduleGranularity = this.project.get("scheduleGranularity") as number;

      if (!startDate || !endDate || !scheduleGranularity) {
        throw new TjArgumentError("Project missing required attributes for limit interval",);
      }

      // startDate e endDate já são TjTime (do MockProject)
      const startTime = startDate as TjTime;
      const endTime = endDate as TjTime;

      // Criar intervalo com o range completo do projeto
      const endIdx = Math.trunc(endTime.diff(startTime) / scheduleGranularity);
      interval = new ScoreboardInterval(startTime, scheduleGranularity, 0, endIdx);

      // Alinhar início/fim conforme o tipo de limite (conforme Ruby Limits.rb)
      interval.start = interval.startDate().midnight();
      interval.end = interval.endDate().midnight();

      if (name.startsWith("weekly")) {
        const weekStartsMonday = this.project.get("weekStartsMonday") as boolean;
        interval.start = interval.startDate().beginOfWeek(weekStartsMonday);
        interval.end = interval.endDate().beginOfWeek(weekStartsMonday);
      } else if (name.startsWith("monthly")) {
        interval.start = interval.startDate().beginOfMonth();
        interval.end = interval.endDate().beginOfMonth();
      }
    }

    if (!interval) {
      throw new TjArgumentError(`Interval must be provided or project must be set for limit: ${name}`,);
    }

    // Remover limite existente com mesmo nome, startDate, endDate e resource
    const startDate = interval.startDate(),
      endDate = interval.endDate();
    this.limits.splice(
      this.limits.findIndex(
        (limit) =>
          limit.name === name &&
          limit.interval.startDate().toSeconds() === startDate.toSeconds() &&
          limit.interval.endDate().toSeconds() === endDate.toSeconds() &&
          limit.resource === resource,
      ),
      1,
    );

    // Criar novo limite
    const limit = new Limit(name, interval, period, value, upper, resource,);
    this.limits.push(limit,);
  }

  /**
   * Incrementa o contador para o índice/tempo dado em todos os limites.
   */
  inc(index: number | TjTime, resource?: Resource): void {
    const r = resource ?? null;
    for (const limit of this.limits) {
      limit.inc(index, r,);
    }
  }

  /**
   * Decrementa o contador para o índice/tempo dado em todos os limites.
   */
  dec(index: number | TjTime, resource?: Resource): void {
    const r = resource ?? null;
    for (const limit of this.limits) {
      limit.dec(index, r,);
    }
  }

  /**
   * Verifica se todos os limites são satisfatórios para o índice/tempo dado.
   */
  ok(index: number | TjTime | null, upper?: boolean, resource?: Resource): boolean {
    const r = resource ?? null;
    for (const limit of this.limits) {
      if (!limit.ok(index, upper ?? true, r,)) {
        return false;
      }
    }
    return true;
  }
}