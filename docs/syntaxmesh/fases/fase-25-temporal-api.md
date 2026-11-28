# Phase 25 — Temporal API Migration

> **Status:** PLANNED\
> **Position:** `23 → 24 → 25 → 21 (wave 1) → 22 → 21 (wave 2) → 19 → 20 → 21 (wave 3)`\
> **Execution note (2026-11-28):** F21 waves 1–2 and F22 were delivered early. Phase 25 is the next pending phase; affected validation must be rerun after migration.\
> **Architecture decision:** ADR 043 to be created before implementation\
> **Input proposal:** `docs/syntaxmesh/12-migracao-temporal-api.md`

## 1. Context

The engine currently uses `TjTime` as an immutable epoch-second facade and still
uses JavaScript `Date` in timezone helpers, scoreboards, working hours,
accounting distribution, model adapters, reports, and runtime tooling.

`TjTime` represents an absolute instant; timezone behavior is applied by separate
helpers and module-level state. This makes the public contract harder to reason
about and leaves calendar arithmetic, DST handling, and duration conversion
spread across multiple implementations.

Deno 2.9.8 provides native Temporal. The published core and the multi-runtime CLI
also need a deterministic fallback for runtimes without Temporal.

The application has not had an official release. Public API breakage is
therefore accepted. No legacy public facade or public API migration guide is
required.

## 2. Objectives

1. Replace `Date` and `TjTime` in the core domain with Temporal types.
2. Make absolute time, calendar dates, wall-clock times, timezones, and durations
   explicit in public signatures.
3. Adopt corrected calendar and DST behavior as the only behavior for migrated
   temporal operations.
4. Keep `.tjp` syntax and the JSON `execute()` envelope stable at their string
   boundaries.
5. Support native Temporal plus a polyfill fallback across Deno, Node, Bun, and
   browser bundles.
6. Preserve deterministic scheduling, accounting, reporting, and golden-test
   validation throughout the migration.

## 3. Non-goals

- Implementing Phase 19 storage or Phase 20 PWA/UI work.
- Adding new `.tjp` date syntax.
- Exposing Temporal objects through JSON serialization.
- Maintaining `TjTime` as a deprecated public compatibility layer.
- Producing a public API migration guide for an unreleased application.
- Unrelated scheduler, finance, report, CLI, LSP, or extension refactoring.

## 4. Approved decisions

| Decision                           | Value                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| Phase placement                    | Dedicated Phase 25 after Phase 24 and before Phase 21 wave 1                         |
| Migration style                    | Strangler migration by vertical slices; public cutover at phase end                  |
| Default calendar behavior          | Corrected Temporal behavior only                                                     |
| Runtime strategy                   | Native Temporal when available, `@js-temporal/polyfill` fallback through one adapter |
| Absolute-time representation       | `Temporal.Instant`                                                                   |
| Zoned project/task values          | `Temporal.ZonedDateTime`                                                             |
| Calendar-day representation        | `Temporal.PlainDate`                                                                 |
| Working-time representation        | `Temporal.PlainTime`                                                                 |
| Effort and duration representation | `Temporal.Duration`                                                                  |
| Interval endpoints                 | `Temporal.Instant`, half-open intervals                                              |
| Legacy facade                      | Removed from public exports and internal consumers                                   |
| JSON boundary                      | ISO strings and existing numeric fields only                                         |
| Host timezone dependency           | Forbidden; project timezone is always explicit                                       |
| DST disambiguation                 | `disambiguation: "compatible"` and `offset: "prefer"`                                |

## 5. Target architecture

### 5.1 Temporal adapter

Create `packages/core/src/time/temporal.ts` as the only module that selects the
Temporal implementation.

The adapter must:

- expose the runtime namespace and public Temporal types used by the core;
- select native `globalThis.Temporal` when available;
- fall back to `@js-temporal/polyfill` without mutating `globalThis`;
- centralize parsing of TJP dates, date-times, fixed offsets, and durations;
- centralize conversion between `Instant`, `ZonedDateTime`, `PlainDate`, and
  `PlainTime`;
- validate IANA timezones and wrap Temporal range errors as `TjArgumentError` at
  public boundaries;
- keep `TjArgumentError` ownership in a stable module outside `tj-time.ts` so the
  legacy facade can be deleted without moving the canonical error class;
- avoid DOM, Node, Deno filesystem, and other runtime-specific APIs.

No domain module may import the polyfill directly.

### 5.2 Type ownership

| Concept                       | Canonical type      | Notes                                                               |
| ----------------------------- | ------------------- | ------------------------------------------------------------------- |
| Current time                  | `Instant`           | Created through an injectable clock where tests require determinism |
| Scoreboard slot boundaries    | `Instant`           | Epoch nanoseconds internally; seconds at TJP/report boundaries      |
| Interval start/end            | `Instant`           | Half-open `[start, end)` semantics remain unchanged                 |
| Task/project date-time values | `ZonedDateTime`     | Zone comes from the project, never the host                         |
| Date-only values              | `PlainDate`         | Converted to zoned midnight at scheduling boundaries                |
| Working-hour ranges           | `PlainTime`         | Combined with `PlainDate` and project zone when materialized        |
| Holidays and calendar leaves  | `PlainDate`         | No hidden UTC conversion                                            |
| Effort, duration, length      | `Duration`          | Months/years require `relativeTo` for totals                        |
| Fixed-offset input            | Parsed to `Instant` | Accepted only at input boundaries                                   |

`TjTime.fromDate`, `TjTime.toDate`, epoch-millisecond arithmetic, and direct
`Date` getters/setters must disappear from the core domain.

### 5.3 Timezone policy

- `Project.timezone` remains an IANA identifier and is required for local date
  parsing. When omitted, the deterministic default is `UTC`; the host timezone is
  never consulted.
- Missing timezone information uses the project timezone.
- Date-only input becomes midnight in the project timezone.
- Fixed offsets such as `-0300` are parsed into an absolute instant.
- Ambiguous local times use the earlier offset; nonexistent local times are
  shifted forward by Temporal's `compatible` disambiguation.
- Timezone abbreviations and localized report text remain formatting concerns.
- Module-level timezone swapping is removed. Functions receive timezone context
  explicitly or through an immutable project/context object.

### 5.4 Duration policy

- Parser units are normalized before creating `Duration`.
- Days, hours, minutes, and seconds remain exact duration units.
- Months and years are calendar units and cannot be converted to fixed
  milliseconds.
- Any `.total()` involving months or years supplies `relativeTo`.
- Scheduler and report totals use the task start as `relativeTo`, falling back to
  the project start. If neither exists, the conversion raises `TjArgumentError`.
- Working-time totals continue to use calendars and working hours; Temporal
  duration arithmetic does not replace scheduling policy.

### 5.5 Public surface

Public domain signatures move to Temporal types, including:

- `Scoreboard`, `TimeInterval`, `WorkingHours`, calendar and scheduling APIs;
- project/task/scenario temporal attributes;
- accounting distribution and booking-period APIs;
- report and sheet interfaces that currently accept or return `Date`/`TjTime`;
- `TaskJuggler` timezone pinning, freeze cutoff, and status-sheet query windows;
- iCalendar internals as well as `ICalReport`;
- parser-produced model values;
- standalone LSP, doc-core, service-worker, CLI, extension, and debug consumers
  that compile against core public types;
- exported types from `packages/core/src/mod.ts`.

The `execute()` request/response contract remains JSON. Temporal values are
serialized to stable ISO strings at that boundary and parsed back through the
adapter.

The following boundary contracts are normative:

| Contract                                            | Temporal shape                                                                                              |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Project.start`, `Project.end`, task/scenario dates | `ZonedDateTime` in the project timezone                                                                     |
| `Project.now` and runtime timestamps                | `Instant`                                                                                                   |
| `Project.dateToIdx()` input                         | `Instant \| ZonedDateTime \| PlainDate`                                                                     |
| `Project.idxToDate()` output                        | `ZonedDateTime`                                                                                             |
| Query windows and logical date operands             | `ZonedDateTime`                                                                                             |
| `TimeInterval.duration()`                           | `Duration`; numeric seconds/hours are produced only at explicit scheduling, debugging, or report boundaries |
| Generic interval values                             | Slot indices (`number`) or absolute bounds (`Instant`)                                                      |
| Booking intervals                                   | `Instant` endpoints plus an explicit IANA `timeZone` for calendar-day accounting                            |
| Date attributes                                     | Temporal values only; formatting never accepts raw `Date` or ISO strings as stored domain values            |
| Duration attributes                                 | `Duration`; numeric hours/seconds exist only at explicit scheduling or report boundaries                    |

## 6. Migration slices

Each slice is independently testable and must finish its local verification
before the next slice starts.

### 25.0 — Baseline and runtime proof

- Freeze current golden, snapshot, benchmark, and bundle results.
- Add a runtime spike covering native Temporal and the polyfill in Deno, Node,
  Bun, and the web bundle.
- Measure adapter allocation cost, timezone decomposition cost, and bundle-size
  impact.
- Create ADR 043 with the runtime, type, DST, compatibility, and cutover
  decisions.
- Record the baseline in the Phase 25 tasks document.

Exit criterion: the runtime strategy is proven and no unexplained baseline
failure remains. Deno, Node, Bun, and browser results are required; a missing Bun
runtime blocks 25.0.3 and cannot be recorded as a pass.

### 25.1 — Temporal adapter and primitives

- Implement `time/temporal.ts`.
- Add BDD tests for parsing, validation, conversion, offsets, DST, leap years,
  month ends, and duration totals.
- Add native/polyfill parity tests.
- Export only the intended adapter API from `time/mod.ts`.

Exit criterion: primitives are deterministic across supported runtimes.

### 25.2 — Replace `TjTime` and timezone internals

- Move parsing and local-part extraction to Temporal.
- Remove module-level timezone mutation from temporal operations.
- Introduce explicit timezone context where project/report code currently swaps
  global state.
- Migrate formatting while preserving supported TJP/report formats.
- Keep temporary internal conversion helpers only until dependent slices move.

Exit criterion: migrated core domain code no longer depends on `TjTime`; its
tests and golden cases are ported to Temporal with corrected expectations. The
temporary `TjTime` adapter and unmigrated consumers may remain only until their
assigned slices move, and all production `TjArgumentError` imports use a stable
owner.

### 25.3 — Calendar, intervals, and scoreboard

- Convert `TimeInterval` to `Instant` endpoints.
- Convert generic `Interval` and `IntervalList` to homogeneous `number` or
  `Instant` bounds with adapter-backed comparison, equality, and intersection.
- Convert `Scoreboard` slot/date APIs to Temporal.
- Convert `WorkingHours` ranges to `PlainTime` and date context to `PlainDate` or
  `ZonedDateTime`.
- Remove `Date` from shift assignments and calendar materialization.
- Revalidate half-open interval and end-exclusive booking behavior.

Exit criterion: scheduler-facing temporal primitives contain no `Date` or
`TjTime`.

### 25.4 — Scheduler and domain model

- Migrate project, task, scenario, resource, shift, allocation, leave, and
  scheduler temporal attributes.
- Migrate date, duration, working-hour, interval-list, and shift attributes so
  stored domain values are Temporal rather than strings, numbers, or `Date`.
- Migrate Query windows, RichText query dates, and logical date operands to the
  normative `ZonedDateTime` and `Instant` contracts.
- Migrate utility clocks and deep cloning so runtime timestamps are injectable
  `Instant` values and immutable Temporal objects are preserved safely.
- Replace epoch-second arithmetic with `Instant`/`Duration` operations.
- Inject fixed clocks and timezones in scheduler tests.
- Validate placements, limits, scoreboards, bookings, and scenario data against
  corrected Temporal expectations.

Exit criterion: scheduling and model tests pass without legacy adapters.

### 25.5 — Accounting and finance

- Migrate `accounting/distribution.ts` and material allocation day math.
- Migrate account credits, balances, charges, charge bookings, material bookings,
  extended charges, and financial scenario period filters to explicit Temporal
  contracts.
- Use `PlainDate` for inclusive calendar-day counting and period grouping.
- Preserve working-day, leave, per-hour, per-day, per-week, and per-month rules.
- Revalidate booking-period exclusive-end behavior and charge/material
  distribution.

Exit criterion: finance golden and integration tests pass with reviewed
Temporal diffs.

### 25.6 — Reports, sheets, and formatting

- Migrate report/sheet temporal inputs and outputs.
- Migrate timesheet source contracts and sheet runtime clocks to the same
  `Project`, `ZonedDateTime`, and `Instant` boundaries.
- Keep localized formatting at report boundaries.
- Serialize dates through explicit ISO/report formatters.
- Update HTML, XML, MSPDI, Markdown, ChartPlotter, time-sheet, and status-sheet
  consumers that still pass `Date` or `TjTime`.
- Migrate `packages/core/src/ical/*` together with `ICalReport`, including
  creation/modification timestamps and event/todo/journal date-time values.

Exit criterion: report and sheet snapshots are regenerated only for reviewed
Temporal changes.

### 25.7 — Parser, execution envelope, and integrations

- Make the parser create Temporal model values directly, retaining raw date tokens
  until the active project timezone is available.
- Migrate task, shift, report, scenario, account, booking, and tracking parser
  rules to the new model contracts.
- Keep `execute()` JSON fields stable with ISO date strings.
- Migrate CLI golden harnesses, CLI summary formatting, runtime configuration date
  boundaries, and runtime clocks.
- Migrate `TaskJuggler` constructor timezone pinning, `freeze()` cutoff/parsing,
  and status-sheet query windows without module-level timezone mutation.
- Migrate log and user-manual clocks to injectable or explicit Temporal values.
- Update LSP, doc-core, VS Code extension, service-worker, and browser-bundle
  consumers; standalone LSP and `debug/schedule_probe.ts` require explicit checks.
- Use `performance.now()` for monotonic test deadlines and preserve epoch-ms only
  at daemon boundaries that require it.
- Verify native/fallback behavior in each shipped runtime.

Exit criterion: CLI, LSP, extension, and web-bundle gates pass without `Date`
leaking through public domain signatures.

### 25.8 — Public cutover and phase closure

- Delete `TjTime` and remaining legacy temporal adapters.
- Remove executable `Date` usage from core source except isolated runtime
  measurement tools, if explicitly justified; audit patterns rather than bare
  `Date` tokens so comments and enum names are not false positives.
- Cut over shared test fixtures and helpers to explicit project timezones and
  deterministic clocks, including regression, invariant, fuzz, smoke, timebasis,
  runtime-config, CLI, and extension harnesses.
- Remove corrected-method `keepRubyBugs` branches; non-temporal compatibility
  behavior remains governed by ADR 013.
- Regenerate and review all affected goldens and snapshots.
- Update phase navigation, canonical order, ADR index, and current status.
- Add the Phase 25 smoke test.
- Run the full quality gate and benchmark comparison.

Exit criterion: all Phase 25 acceptance checks pass and no legacy temporal type
remains in the core domain.

## 7. Compatibility and divergence policy

- Corrected Temporal behavior is the only supported behavior for migrated
  methods.
- ADR 043 supersedes the temporal representation decisions in ADR 012 and the
  temporal branch policy in ADR 013. Non-temporal Ruby compatibility behavior
  remains governed by ADR 013.
- Existing goldens are retained as an audit baseline before regeneration.
- Ruby `tj3` output remains the legacy baseline and must not be used to generate
  corrected temporal expectations. Corrected temporal fixtures contain explicit
  reviewed cases; unaffected fixtures continue to use the existing generators.
- Every changed golden must be classified as an expected Temporal correction or
  an unintended regression.
- Expected divergences are recorded in
  `packages/core/tests/golden/known-divergences.json` and
  `packages/cli/tests/golden/known-divergences.json` with input, old output, new
  output, and rationale.
- No blanket snapshot regeneration is allowed without diff review.
- Existing non-temporal Ruby compatibility behavior is unchanged.

## 8. Testing strategy

All new tests use `@std/testing/bdd` and `@std/assert`.

Required coverage:

- invalid dates, times, offsets, durations, and timezones;
- DST gaps/folds and project timezones across hemispheres;
- leap years and month/quarter/year boundaries;
- `Duration.total({ relativeTo })`;
- `Instant`/`ZonedDateTime` round trips;
- half-open intervals, generic interval lists, and end-exclusive bookings;
- scoreboard slot boundaries and working-hour materialization;
- date/duration attributes, Query windows, RichText query dates, and logical date operations;
- timezone-cache behavior and deterministic project timezone context;
- `TaskJuggler` construction, freeze cutoff, and status-sheet query windows;
- iCalendar creation/modification timestamps and component date-time values;
- deterministic scheduler integration and shared fixture/helper cutover;
- accounting day counts and period distribution;
- report/sheet serialization;
- JSON `execute()` round trips;
- native/polyfill parity;
- CLI, standalone/core LSP, extension, service-worker, debug, and browser-bundle smoke paths.

Per-task verification must use the narrowest relevant test command first. Phase
closure requires:

```text
deno task tests
deno task bench:compare
deno task check:web-bundle
```

The tasks document must record evidence for every atomic task.

## 9. Risks and mitigations

| Risk                                                    | Mitigation                                                                                                                     |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Polyfill changes performance or bundle size             | Runtime spike, dedicated benchmarks, bundle budget, native fast path                                                           |
| Calendar corrections change many goldens                | Freeze baseline, migrate by slice, review every diff                                                                           |
| Public Temporal types spread into JSON APIs             | Keep serialization at explicit adapter boundaries                                                                              |
| Timezone context is lost during refactoring             | Pass project/context explicitly; forbid host timezone access                                                                   |
| Variable month/year durations are treated as fixed time | Require `relativeTo` and dedicated tests                                                                                       |
| DST behavior differs by runtime                         | Native/polyfill parity matrix and deterministic DST fixtures                                                                   |
| Hidden `Date` usage remains in reports/tools            | Repository audits per slice and final zero-use gate for executable patterns; comments and enum names are classified separately |
| Large cross-package breakage                            | Vertical slices with local gates before public cutover                                                                         |

## 10. Definition of done

- ADR 043 is accepted.
- The Temporal adapter is the only runtime/polyfill selection point.
- `TjArgumentError` ownership is independent of `tj-time.ts`.
- Public core domain signatures use Temporal types.
- `TjTime` is removed from exports, source, consumers, fixtures, and obsolete
  comments.
- Core scheduling, calendar, accounting, reports, iCalendar internals, sheets,
  attributes, queries, and logic contain no executable legacy temporal patterns.
- `TaskJuggler`, CLI, standalone/core LSP, doc-core, extension, service-worker,
  and debug consumers pass their targeted checks.
- Shared fixtures and helpers use explicit project timezones and deterministic
  clocks rather than host-local `Date` construction or global timezone mutation.
- `execute()` remains JSON with stable ISO strings.
- Corrected DST/calendar behavior is covered by tests and recorded divergences.
- Affected goldens and snapshots are regenerated and reviewed.
- Native/fallback parity is proven across supported runtimes and the web bundle.
- `deno task tests`, `deno task bench:compare`, and
  `deno task check:web-bundle` pass.
- Phase 25 smoke and closure evidence are registered in the tasks document.
