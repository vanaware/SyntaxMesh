import { TjTime, } from "../time/tj-time.ts";
import { TimeInterval, } from "../time/time-interval.ts";

/**
 * Tipos de extended booking — o que o booking registra efetivamente.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 */
export type ExtendedBookingType = "effort" | "charge" | "material";

/**
 * Representa um booking estendido que registra o que efetivamente aconteceu
 * (esforço, charge ou material) em um cenário específico.
 *
 * Semelhante a um booking original, mas com suporte para charge e material
 * além de effort.
 */
export class ExtendedBooking {
  readonly type: ExtendedBookingType;
  readonly value: number;
  readonly date: TjTime;
  readonly interval?: TimeInterval;
  readonly scenarioIdx?: number;

  constructor(
    type: ExtendedBookingType,
    value: number,
    date: TjTime,
    interval?: TimeInterval,
    scenarioIdx?: number,
  ) {
    this.type = type;
    this.value = value;
    this.date = date;
    this.interval = interval;
    this.scenarioIdx = scenarioIdx;

    // Validação
    // Permitir valores negativos para charge (custo monetário), mas não para effort/material
    if (type === "charge" && value < 0) {
      // charge pode ser negativo (custo)
    } else if (type !== "charge" && value < 0) {
      throw new Error(
        `Extended booking ${type} value cannot be negative: ${value}`,
      );
    }

    if (type === "effort" && interval && interval.duration() < 0) {
      throw new Error(
        "Extended booking effort interval cannot have negative duration",
      );
    }
  }

  /**
   * Cópia profunda imutável.
   * Retorna this (imutável) para compatibilidade com deepClone.
   */
  deepClone(): this {
    return this;
  }
}
