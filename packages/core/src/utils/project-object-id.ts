/**
 * Generates stable sequential IDs for objects, similar to Ruby's `object_id`.
 *
 * Uses a `WeakMap` so objects can be garbage-collected once no longer
 * referenced. Each object receives a unique, stable ID for the lifetime of the
 * application.
 */

const projectIds = new WeakMap<object, number>();
let nextProjectId = 1;

/**
 * Returns a unique, stable sequential ID for the given object.
 *
 * @param project — object for which to generate/return the ID.
 * @returns Sequential ID (starting at 1).
 */
export function projectObjectId(project: object,): number {
  let id = projectIds.get(project,);
  if (id === undefined) {
    id = nextProjectId++;
    projectIds.set(project, id,);
  }
  return id;
}
