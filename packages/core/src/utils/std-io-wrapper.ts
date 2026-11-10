/**
 * `stdIoWrapper` — captures what the block writes to stdout/stderr.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/StdIoWrapper.rb`. In Ruby the
 * wrapper swaps `$stdout`/`$stderr` for `StringIO` and returns
 * `Results(returnValue, stdOut, stdErr)`; any error inside the block counts as
 * `returnValue = 1` (the `tj3*` app convention).
 *
 * In the browser (Category B — see `cheat-sheet-ruby-ts.md` §12):
 * • `console.log`/`console.error` are shared globals — the swap applies to the
 *   whole process, not per thread (there are no threads);
 * • `stdIn` does not exist in `console`, so it is accepted and ignored;
 * • captured errors are **any** `Error`, not only `RuntimeError`.
 *
 * Planned consumers: phase 18 (`TimeSheetSummary.getResourceJournal`) and
 * phase 24 (sheet apps).
 *
 * @see docs/taskjuggler/lib/taskjuggler/StdIoWrapper.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.11)
 */

/** Execution result (Ruby `StdIoWrapper::Results`). */
export interface Results<T,> {
  /** Value returned by `fn` (or `1` when `fn` threw). */
  returnValue: T | 1;
  /** Everything written to `console.log`. */
  stdOut: string;
  /** Everything written to `console.error`. */
  stdErr: string;
}

/** Converts a `console.*` argument to text (like Ruby's `puts`). */
function toText(value: unknown,): string {
  if (typeof value === "string") return value;
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return value.name || "<function>";
  try {
    const json = JSON.stringify(value,);
    return json === undefined ? String(value,) : json;
  } catch {
    return String(value,);
  }
}

/** Joins the arguments of a `console` call into one line. */
function formatArgs(args: unknown[],): string {
  return args.map(toText,).join(" ",) + "\n";
}

/**
 * Runs `fn` capturing `console.log`/`console.error`.
 *
 * `stdIn` is accepted for compatibility with the Ruby signature and ignored
 * (the browser has no stdin). The captured output is **not** echoed to the real
 * console, as in Ruby (the `StringIO` swallows the output).
 */
export function stdIoWrapper<T,>(
  stdIn: string | null,
  fn: () => T,
): Results<T> {
  void stdIn;
  const originalLog = console.log;
  const originalError = console.error;
  const stdout: string[] = [];
  const stderr: string[] = [];

  console.log = (...args: unknown[]) => {
    stdout.push(formatArgs(args,),);
  };
  console.error = (...args: unknown[]) => {
    stderr.push(formatArgs(args,),);
  };

  let returnValue: T | 1;
  try {
    returnValue = fn();
  } catch {
    // Ruby: `rescue RuntimeError` → 1 ("blocks return 0 on success, 1 on errors").
    returnValue = 1;
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return {
    returnValue,
    stdOut: stdout.join("",),
    stdErr: stderr.join("",),
  };
}
