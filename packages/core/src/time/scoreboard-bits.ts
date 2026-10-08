/**
 * Bit encoding para scoreboards numéricos no TaskJuggler.
 *
 * Este módulo centraliza as convenções de encoding de bits usadas por:
 * - Project.initScoreboards
 * - ResourceScenario.initScoreboard
 * - ShiftAssignments
 *
 * O encoding é uma convenção, não uma classe. Scoreboard<T> é genérico;
 * o encoding é aplicado apenas a scoreboards numéricos (number | null).
 */

/**
 * Tipos de leave — mapeados para bits 2–5 (LEAVE_SHIFT a LEAVE_SHIFT+3).
 * Ordem: project (0) é menor prioridade; holiday (5) é mais comum.
 */
export const LEAVE_TYPES = {
  project: 0, // 0b00 << LEAVE_SHIFT = 0
  annual: 1, // 0b01 << LEAVE_SHIFT = 4
  special: 2, // 0b10 << LEAVE_SHIFT = 8
  sick: 3, // 0b11 << LEAVE_SHIFT = 12
  unpaid: 4, // 0b100 << LEAVE_SHIFT = 16
  holiday: 5, // 0b101 << LEAVE_SHIFT = 20
  unemployed: 6, // 0b110 << LEAVE_SHIFT = 24
} as const;

/**
 * Máscara para bits de leave (bits 2–5).
 * 0b00111100 = 0x3C.
 */
export const LEAVE_MASK = 0x3C; // bits 2-5

/**
 * Deslocamento para bits de leave (bits 2–5).
 * Leave types ocupam bits 2, 3, 4, 5.
 */
export const LEAVE_SHIFT = 2;

/**
 * Bit 0: atribuído (tem um shift atribuído).
 */
export const BIT_ASSIGNED = 1 << 0; // 0b0001 = 1

/**
 * Bit 1: sem tempo de trabalho (off-duty).
 * Se bit 1 = 0 → tempo de trabalho disponível (working hours).
 * Se bit 1 = 1 → sem tempo de trabalho (off-duty).
 */
export const BIT_OFF_WORK = 1 << 1; // 0b0010 = 2

/**
 * Bit 8: override global (substitui working hours).
 */
export const BIT_OVERRIDE = 1 << 8; // 0b100000000 = 256

/**
 * Retorna o valor de leave codificado para um tipo.
 *
 * @param type — um dos valores de LEAVE_TYPES.
 * @returns valor shiftado para bits 2–5.
 */
export function packLeaveType(type: number,): number {
  return type << LEAVE_SHIFT;
}

/**
 * Retorna o tipo de leave a partir de um valor codificado.
 *
 * @param val — valor numérico do scoreboard (bits 2–5 contêm o tipo).
 * @returns tipo de leave (0–6) ou 0 se val for null/undefined.
 */
export function unpackLeaveType(val: number | null | undefined,): number {
  if (val == null) return 0;
  return (val & LEAVE_MASK) >>> LEAVE_SHIFT;
}

/**
 * Verifica se o valor indica que há uma atribuição (bit 0 set).
 */
export function isAssigned(val: number | null | undefined,): boolean {
  if (val == null) return false;
  return (val & BIT_ASSIGNED) !== 0;
}

/**
 * Verifica se o valor indica tempo de trabalho disponível (bit 1 não set).
 * Sem bit 1 = tempo de trabalho disponível (working hours).
 */
export function isWorkingTime(val: number | null | undefined,): boolean {
  if (val == null) return false;
  return (val & BIT_OFF_WORK) === 0;
}

/**
 * Verifica se o valor indica tempo de trabalho **não** disponível (bit 1 set).
 * Com bit 1 = tempo de trabalho não disponível (off-duty).
 */
export function isTimeOff(val: number | null | undefined,): boolean {
  if (val == null) return false;
  return (val & BIT_OFF_WORK) !== 0;
}

/**
 * Verifica se o valor indica algum leave (bits 2–5 não zero).
 */
export function isLeave(val: number | null | undefined,): boolean {
  if (val == null) return false;
  return (val & LEAVE_MASK) !== 0;
}

/**
 * Verifica se o valor indica leave de um tipo específico.
 *
 * @param val — valor do scoreboard.
 * @param type — um dos valores de LEAVE_TYPES.
 * @returns true se bits 2–5 correspondem ao tipo.
 */
export function isLeaveType(
  val: number | null | undefined,
  type: number,
): boolean {
  if (val == null) return false;
  return unpackLeaveType(val,) === type;
}

/**
 * Verifica se o valor indica override global (bit 8 set).
 */
export function hasOverride(val: number | null | undefined,): boolean {
  if (val == null) return false;
  return (val & BIT_OVERRIDE) !== 0;
}

/**
 * Monta um valor de scoreboard completo a partir de componentes.
 *
 * @param isWorking — true se tempo de trabalho disponível (bit 1 = 0).
 * @param leaveType — opcional, um dos valores de LEAVE_TYPES.
 * @param hasOverride — true se override global (bit 8 = 1).
 * @returns valor inteiro com bits definidos conforme os parâmetros.
 */
export function packWorkTime(
  isWorking: boolean,
  leaveType?: number,
  hasOverride?: boolean,
): number {
  let val = 0;

  // Bit 0: atribuído (assumimos que sempre há atribuição para este helper)
  val |= BIT_ASSIGNED;

  // Bit 1: off-work se não isWorking
  if (!isWorking) {
    val |= BIT_OFF_WORK;
  }

  // Bits 2–5: leave type
  if (leaveType != null) {
    val |= packLeaveType(leaveType,);
  }

  // Bit 8: override
  if (hasOverride) {
    val |= BIT_OVERRIDE;
  }

  return val;
}
