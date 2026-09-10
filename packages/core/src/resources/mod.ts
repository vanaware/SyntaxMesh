/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Resources — Gerenciamento de recursos
// ============================================================================

/**
 * Um recurso pode ser pessoa, equipamento ou material
 */
export type ResourceCategory = 'person' | 'equipment' | 'material';

/**
 * Tipo básico de recurso
 */
export interface Resource {
  id: string;
  name: string;
  category: ResourceCategory;
  available: boolean;
  costPerHour?: number;
  capacity?: number; // 0 a 100 (% disponibilidade)
}

/**
 * Alocação de recurso a uma tarefa
 */
export interface Assignment {
  taskId: string;
  resourceId: string;
  units: number; // porcentagem de alocação (0 a 100)
  start?: Date;
  end?: Date;
}

/**
 * Cria um novo recurso
 */
export function createResource(
  name: string,
  category: ResourceCategory,
  options?: Partial<Resource>,
): Resource {
  return {
    id: crypto.randomUUID(),
    name,
    category,
    available: true,
    costPerHour: options?.costPerHour,
    capacity: options?.capacity ?? 100,
  };
}
