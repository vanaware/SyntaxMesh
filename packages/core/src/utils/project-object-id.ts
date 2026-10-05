/**
 * Gera IDs sequenciais estáveis para objetos, similar ao `object_id` do Ruby.
 *
 * Usa um `WeakMap` para permitir GC dos objetos quando não referenciados mais.
 * Cada objeto recebe um ID único e estável durante a vida da aplicação.
 */

const projectIds = new WeakMap<object, number>();
let nextProjectId = 1;

/**
 * Retorna um ID sequencial único e estável para o objeto dado.
 *
 * @param project — objeto para o qual gerar/retornar o ID.
 * @returns ID sequencial (começando em 1).
 */
export function projectObjectId(project: object): number {
  let id = projectIds.get(project);
  if (id === undefined) {
    id = nextProjectId++;
    projectIds.set(project, id);
  }
  return id;
}