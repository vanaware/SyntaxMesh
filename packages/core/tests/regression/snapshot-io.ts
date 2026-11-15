/**
 * Snapshot I/O for the regression suites (26.9, F21 wave 1).
 *
 * Snapshots pin the port's CURRENT behavior (regression detection), unlike
 * the e2e golden which compares against tj3 (conformance). Files live in
 * `__snapshots__/` next to the suites; regenerate with
 * `UPDATE_SNAPSHOTS=1 deno test --no-check -A packages/core/tests/regression/`.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.9)
 */
import { assertEquals, } from "@std/assert";

const DIR = new URL("./__snapshots__/", import.meta.url,);

/**
 * Compares `actual` against the stored snapshot `name`. With
 * `UPDATE_SNAPSHOTS=1` the snapshot is (re)written instead — the only
 * sanctioned way to change a baseline.
 */
export function assertSnapshot(name: string, actual: string,): void {
  const url = new URL(name, DIR,);
  if (Deno.env.get("UPDATE_SNAPSHOTS",) === "1") {
    Deno.mkdirSync(DIR, { recursive: true, },);
    Deno.writeTextFileSync(url, actual,);
    return;
  }
  let expected: string;
  try {
    expected = Deno.readTextFileSync(url,);
  } catch {
    throw new Error(
      `snapshot ${name} ausente — rode com UPDATE_SNAPSHOTS=1 para gerar`,
    );
  }
  assertEquals(
    actual,
    expected,
    `snapshot ${name} divergiu — se a mudança é intencional, regenere com UPDATE_SNAPSHOTS=1`,
  );
}
