/**
 * Shared e2e harness: CLI × real `tj3` over the full corpus (26.3/26.4,
 * F21 wave 1; extracted from the F24.7 `golden_cli_test.ts`).
 *
 * The oracle is `scripts/golden/cli-tj3.rb`: it runs the Ruby TaskJuggler
 * over every fixture of `tests/fixtures/corpus.json` and records, per
 * case, what is observable from the outside. The per-group suites
 * (`packages/cli/tests/e2e_<group>_test.ts`) run the **real CLI**
 * (subprocess, real argv and disk) over the same fixtures and compare:
 *
 * - **exit code** and **artifact inventory** (sorted relative paths);
 * - **stdout residue**: everything `tj3` prints that is not UI is a
 *   message; after filtering the project summary (24.4.5) stdout must be
 *   empty on both sides;
 * - **first message** of error fixtures, after path/numeric-noise
 *   normalization (24.7.8);
 * - **artifact content** on parity fixtures: CSV byte for byte (24.7.6)
 *   and HTML by canonical DOM (24.7.7).
 *
 * Triage (ADR 042): `known-divergences.json` drives the comparison —
 * `exclude`d cases are asserted against their registry anchor instead of
 * running, `compare-artifacts` entries downgrade the content comparison.
 * Nothing is ignored silently.
 *
 * Regenerate the golden: `deno task golden:generate:ruby`.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.3)
 * @see docs/syntaxmesh/decisoes/042-estrategia-validacao.md
 * @see scripts/golden/cli-tj3.rb
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { join, relative, } from "node:path";
import { canonicalDom, firstDifference, } from "./canonical-dom.ts";
import {
  type DivergenceRegistry,
  effectFor,
  matchesFixture,
  parseRegistry,
} from "./divergences.ts";

/** Repository root: golden paths are relative to it. */
const ROOT = new URL("../../../../", import.meta.url,).pathname;
/** The package's `src/cli.ts`. */
const CLI = new URL("../../src/cli.ts", import.meta.url,).pathname;

/** What a case requires beyond exit + inventory. */
export type CompareLevel = "artifacts" | "exact" | "dom";

/** One case of the golden (mirrors `scripts/golden/cli-tj3.rb`). */
export interface GoldenCase {
  /** Corpus id: `<group>/<stem>` (26.1). */
  id: string;
  /** Fixture path relative to the root. */
  path: string;
  /** Corpus group (26.1): one test file per group. */
  group: string;
  kind: "project" | "errors" | "parity";
  compare: CompareLevel;
  /** Registry id that excludes the case (no run; anchor asserted). */
  excluded?: string;
  exit?: number;
  /** Sorted relative paths of everything written. */
  artifacts?: string[];
  messages?: string[];
  firstMessage?: string | null;
  /** Stdout residue after banner/progress/summary filtering. */
  stdout?: string[];
  stderr?: string[];
  /** Artifact content by relative path (only on `exact`/`dom`). */
  outputs?: Record<string, string>;
}

/** The golden, loaded once per test file. */
const golden = JSON.parse(
  await Deno.readTextFile(new URL("./cli-tj3.golden.json", import.meta.url,),),
) as { cases: GoldenCase[] };

/** The triage registry, validated against the real corpus ids. */
const registry: DivergenceRegistry = await (async () => {
  const corpus = JSON.parse(
    await Deno.readTextFile(ROOT + "tests/fixtures/corpus.json",),
  ) as { groups: { fixtures: { id: string }[] }[] };
  const ids = new Set(
    corpus.groups.flatMap((g,) => g.fixtures.map((f,) => f.id)),
  );
  return parseRegistry(
    await Deno.readTextFile(
      new URL("./known-divergences.json", import.meta.url,),
    ),
    ids,
  );
})();

// --- selection (26.3/26.4) --------------------------------------------------

/** The cases of one corpus group, in golden order. */
export function casesForGroup(
  cases: readonly GoldenCase[],
  group: string,
): GoldenCase[] {
  return cases.filter((kase,) => kase.group === group);
}

/**
 * The compare level after the registry downgrade: a `compare-artifacts`
 * entry drops content comparison to exit + inventory. Never upgrades.
 */
export function effectiveCompare(
  kase: GoldenCase,
  reg: DivergenceRegistry,
): CompareLevel {
  return effectFor(reg, kase.id,) === "compare-artifacts"
    ? "artifacts"
    : kase.compare;
}

// --- normalization (mirror of `scripts/golden/cli-tj3.rb`) ------------------

/** Numbers with 6+ decimal places are floating point noise. */
const FLOAT_NOISE = /-?\d+\.\d{6,}/g;
/** Source paths cited in messages (`docs/…`, `packages/…`). */
const REPO_PATH = /(?:docs|packages)\/[\w./-]+/g;
/** `file:line: Type: text` or `Type: text`. */
const MESSAGE_LINE = /^(?:.*?:\d+: )?(?:Fatal|Error|Warning|Info|Debug): /;
/** Project summary lines the CLI prints and `tj3` does not (24.4.5). */
const CLI_NOISE = [
  /^Project .* v.*$/,
  /^ {2}(?:timezone|period|tasks|cost): /,
  // Report-generation progress meter (`Report <name> …`), mirrored in TJ_NOISE.
  /^Report /,
];

// --- date / float canonicalization (messages only, F21 26.5) ----------------
//
// The port and `tj3` render the same instant differently: `tj3` uses the
// TjTime long form (`2007-04-25-11:00-+0000`), the port sometimes a plain ISO
// date or a JS `Date.toString()` ctime. All three are canonicalized to UTC
// `YYYY-MM-DDTHH:MMZ` so the comparison checks the instant, not the rendering.
// Applied to messages only — artifact content keeps its own comparison.

/** TjTime long form: `YYYY-MM-DD-HH:MM-±HHMM`. */
const DATE_LONG = /\d{4}-\d{2}-\d{2}-\d{2}:\d{2}-[+-]\d{4}/g;
/** JS `Date.toString()` ctime: `Wed Apr 25 2007 08:00:00 GMT-0300 (…)`. */
const DATE_CTIME =
  /[A-Z][a-z]{2} [A-Z][a-z]{2} \d{1,2} \d{4} \d{2}:\d{2}:\d{2} GMT[+-]\d{4}(?: \([^)]*\))?/g;
/** Plain ISO date not already part of a long form or canonical stamp. */
const DATE_PLAIN = /\d{4}-\d{2}-\d{2}(?![-T\d])/g;
/** Integral floats (`1.0`, `9.00`) collapse to the integer (`1`, `9`). */
const FLOAT_INTEGRAL = /(\d+)\.0+(?![\d.])/g;
/**
 * Leading source location (`<PATH>:12: `). `tj3` omits it on runtime
 * (time-sheet/scheduler) errors while the port attaches the task's line; the
 * location is representation, not behavior, so it is stripped symmetrically
 * (F21 26.5). Applied after path normalization, messages only.
 */
const MESSAGE_LOCATION = /^<PATH>:\d+: /;

/** Formats an instant as UTC `YYYY-MM-DDTHH:MMZ`. */
function canonicalInstant(ms: number,): string {
  const d = new Date(ms,);
  const p = (n: number,) => String(n,).padStart(2, "0",);
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1,)}-${
    p(d.getUTCDate(),)
  }T${p(d.getUTCHours(),)}:${p(d.getUTCMinutes(),)}Z`;
}

/** Canonicalizes every date rendering to a UTC instant (see note above). */
export function canonicalizeDates(text: string,): string {
  let out = text.replaceAll(DATE_LONG, (m,) => {
    const iso = `${m.slice(0, 10,)}T${m.slice(11, 16,)}:00${m.slice(17, 20,)}:${
      m.slice(20,)
    }`;
    const ms = Date.parse(iso,);
    return Number.isNaN(ms,) ? m : canonicalInstant(ms,);
  },);
  out = out.replaceAll(DATE_CTIME, (m,) => {
    const ms = Date.parse(m.replace(/ \([^)]*\)$/, "",),);
    return Number.isNaN(ms,) ? m : canonicalInstant(ms,);
  },);
  out = out.replaceAll(DATE_PLAIN, (m,) => `${m}T00:00Z`,);
  return out;
}

/** Normalizes paths, numeric noise, dates, integral floats and location. */
export function normalizeMessage(text: string,): string {
  const base = text.replaceAll(REPO_PATH, "<PATH>",).replaceAll(
    FLOAT_NOISE,
    "<NUM>",
  );
  return canonicalizeDates(base,).replaceAll(FLOAT_INTEGRAL, "$1",).replace(
    MESSAGE_LOCATION,
    "",
  );
}

/** Stdout lines that are not UI (should be empty). */
function residue(stdout: string,): string[] {
  return stdout.split("\n",).map((line,) => line.replaceAll("\r", "",))
    .filter((line,) => line.trim() !== "")
    .filter((line,) => !CLI_NOISE.some((noise,) => noise.test(line,)))
    .map((line,) => line.trimEnd());
}

/** First `MessageHandler` message line on stderr. */
function firstMessageLine(stderr: string,): string | null {
  for (const line of stderr.split("\n",)) {
    if (MESSAGE_LINE.test(line,)) return line.trimEnd();
  }
  return null;
}

// --- execution --------------------------------------------------------------

/** Wall clock limit per CLI run: a hang must fail, not stall the gate. */
const CASE_TIMEOUT_MS = 60_000;

/** Result of one real CLI run. */
interface CliRun {
  code: number;
  out: string;
  err: string;
  /** The (temporary) output directory of the run. */
  dir: string;
}

/**
 * Runs the CLI over the fixture with `--output-dir` in a temporary.
 *
 * `cwd` is the repository root: golden paths are relative to it and it
 * is the same `chdir` the Ruby oracle uses, so messages cite the fixture
 * the same way.
 */
async function runCli(kase: GoldenCase,): Promise<CliRun> {
  const dir = await Deno.makeTempDir({
    prefix: `e2e-${kase.id.replaceAll("/", "-",)}-`,
  },);
  const child = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      "--allow-env",
      CLI,
      kase.path,
      "--output-dir",
      dir,
    ],
    cwd: ROOT,
    stdout: "piped",
    stderr: "piped",
  },).spawn();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL",);
  }, CASE_TIMEOUT_MS,);
  try {
    const output = await child.output();
    if (timedOut) {
      throw new Error(`CLI timed out after ${CASE_TIMEOUT_MS}ms: ${kase.id}`,);
    }
    const decoder = new TextDecoder();
    return {
      code: output.code,
      out: decoder.decode(output.stdout,),
      err: decoder.decode(output.stderr,),
      dir,
    };
  } finally {
    clearTimeout(timer,);
  }
}

/** Sorted relative paths of everything written under `dir`. */
function inventory(dir: string,): string[] {
  const found: string[] = [];
  const walk = (current: string,): void => {
    for (const entry of Deno.readDirSync(current,)) {
      const full = join(current, entry.name,);
      if (entry.isDirectory) walk(full,);
      else if (entry.isFile) found.push(relative(dir, full,),);
    }
  };
  walk(dir,);
  return found.sort();
}

// --- comparison -------------------------------------------------------------

/** Runs the CLI and asserts the full observable surface of one case. */
async function assertCase(kase: GoldenCase,): Promise<void> {
  const run = await runCli(kase,);
  try {
    const detail = run.out + run.err;
    assertEquals(run.code, kase.exit, `exit: ${detail}`,);
    assertEquals(
      inventory(run.dir,),
      kase.artifacts,
      `artifacts: ${detail}`,
    );
    // Residue: any line that is neither UI nor a message.
    assertEquals(residue(run.out,), kase.stdout, "stdout residue",);

    // 24.7.8 — first message location on error fixtures.
    if (kase.kind === "errors") {
      const first = firstMessageLine(run.err,);
      assertEquals(
        first === null ? null : normalizeMessage(first,),
        kase.firstMessage,
        `first message: ${detail}`,
      );
    }

    const compare = effectiveCompare(kase, registry,);

    // 24.7.6 — CSV byte for byte.
    if (compare === "exact") {
      for (const [name, expected,] of Object.entries(kase.outputs ?? {},)) {
        assertEquals(
          Deno.readTextFileSync(join(run.dir, name,),),
          expected,
          `${name} byte for byte`,
        );
      }
    }

    // 24.7.7 — HTML by canonical DOM.
    if (compare === "dom") {
      for (const [name, expected,] of Object.entries(kase.outputs ?? {},)) {
        assertEquals(
          firstDifference(
            canonicalDom(expected,),
            canonicalDom(Deno.readTextFileSync(join(run.dir, name,),),),
          ),
          "identical",
          `${name} by canonical DOM`,
        );
      }
    }
  } finally {
    Deno.removeSync(run.dir, { recursive: true, },);
  }
}

/** Asserts an excluded case against its registry entry (never silent). */
function assertExcluded(kase: GoldenCase,): void {
  const entry = registry.divergences.find((d,) => d.id === kase.excluded);
  assert(entry !== undefined, `registry has no entry ${kase.excluded}`,);
  assert(
    matchesFixture(entry.fixture, kase.id,),
    `fixture ${entry.fixture} does not match ${kase.id}`,
  );
  assertEquals(entry.effect, "exclude",);
  const file = entry.anchor.split("#",)[0]!;
  assert(Deno.statSync(ROOT + file,).isFile, `anchor missing: ${file}`,);
}

/**
 * Registers the e2e suite of one corpus group. Each of the ten
 * `e2e_<group>_test.ts` files calls this once; Deno runs the files in
 * parallel, so the full corpus scales without a custom runner.
 */
export function registerGroup(group: string,): void {
  const cases = casesForGroup(golden.cases, group,);
  describe(`e2e CLI × tj3 — ${group} (26.3/26.5)`, () => {
    for (const kase of cases) {
      if (kase.excluded !== undefined) {
        it(`${kase.id}: excluded by ${kase.excluded} (registry anchor)`, () => {
          assertExcluded(kase,);
        });
        continue;
      }
      it(`${kase.id} (${kase.kind}): exit, artifacts, stdout`, async () => {
        await assertCase(kase,);
      });
    }
  });
}
