/**
 * `client/debounce.ts` — pure debouncer (22.4.3).
 *
 * Coalesces rapid calls (e.g. keystroke-driven reanalysis) into a single
 * trailing invocation after `delayMs` of quiet, cancelling the previous pending
 * request. Uses only the global `setTimeout`/`clearTimeout`, so it is pure and
 * host-agnostic (Deno, Node, browser) and testable with fake timers.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.4.3
 */

/** A debounced function with cancellation, flush and pending inspection. */
export type Debounced<A extends unknown[],> =
  & ((...args: A) => void)
  & {
    /** Cancels the pending invocation (if any), discarding its arguments. */
    cancel(): void;
    /** Fires the pending invocation immediately (if any). */
    flush(): void;
    /** Whether an invocation is currently scheduled. */
    pending(): boolean;
  };

/**
 * Creates a trailing-edge debouncer around `fn`. Each call reschedules the
 * timer with the latest arguments; only the last call within a quiet window
 * fires. `cancel` drops the pending call, `flush` fires it now.
 *
 * @param delayMs quiet window in milliseconds before `fn` fires.
 * @param fn the function to debounce (receives the latest call arguments).
 * @returns the debounced wrapper with `cancel`/`flush`/`pending`.
 */
export function createDebouncer<A extends unknown[],>(
  delayMs: number,
  fn: (...args: A) => void,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;

  /** Fires the pending call with its stored arguments and clears the timer. */
  const fire = (): void => {
    if (timer !== null) {
      clearTimeout(timer,);
      timer = null;
    }
    const args = lastArgs;
    lastArgs = null;
    if (args !== null) fn(...args,);
  };

  const debounced = (...args: A): void => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer,);
    timer = setTimeout(fire, delayMs,);
  };

  return Object.assign(debounced, {
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer,);
        timer = null;
      }
      lastArgs = null;
    },
    flush: fire,
    pending(): boolean {
      return timer !== null;
    },
  },);
}
