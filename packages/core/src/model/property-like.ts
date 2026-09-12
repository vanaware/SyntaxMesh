/**
 * Interface mínima para o que `AttributeBase` precisa saber sobre
 * a propriedade que o contém.
 *
 * Na Fase 3, só temos `id` e `name`. A Fase 4 (PropertyTreeNode)
 * expande esta interface (adiciona `project`, `children`, `parent`, etc.).
 *
 * Esta interface evita que a Fase 3 importe `PropertyTreeNode` (que só
 * existe na Fase 4). Quando a Fase 4 chegar, `PropertyTreeNode implements
 * PropertyLike` sem quebrar nada.
 */
export interface PropertyLike {
  /** ID completo da propriedade (ex: "proj.task1.subtask2"). */
  readonly id: string;

  /** Nome amigável da propriedade. */
  readonly name: string;
}