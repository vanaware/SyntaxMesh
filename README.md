# SyntaxMesh

**Offline project planning with a descriptive language.**

SyntaxMesh is an independent implementation of the TaskJuggler planning model: a scheduling
engine that reads plain-text project files (`.tjp`), resolves dependencies, allocates resources,
computes dates and costs, and generates reports — HTML tables, Gantt charts, CSV/JSON, MSPDI,
iCalendar and more. The engine is written in TypeScript, developed and run on Deno, and needs
no application server.

> **Status of work:** the real scope, progress and execution order live in
> [`docs/syntaxmesh/fases/plano.md`](docs/syntaxmesh/fases/plano.md) (canonical 21-phase plan +
> complementary phases 22–24) and in [`CURRENT.md`](CURRENT.md). Architectural decisions are in
> [`docs/syntaxmesh/decisoes/`](docs/syntaxmesh/decisoes/README.md) (ADRs). This README is a
> general overview and defers to those files in case of conflict. The original
> Portuguese base-specification is preserved in [`docs/syntaxmesh/01-visao.md`](docs/syntaxmesh/01-visao.md).

Everything described below is already implemented and covered by the engine's test suite
(phases 1–18 of the plan are complete). Each capability has a short syntax example — all of
them are real, parseable TaskJuggler/SyntaxMesh code.

---

## Projects, tasks and milestones

A project file opens with a header (ID, name, version and timeframe) and a tree of tasks.
Tasks carry effort or an explicit duration, and can be pinned with dates or marked as
zero-duration milestones. The scheduler turns all of this into a concrete timeline.

```tjp
project office "Office Building" "1.0" 2025-01-06 - 2025-06-30 {
  timezone "UTC"
  timeformat "%Y-%m-%d"
  now 2025-02-01
}

task build "Construction" {
  task foundation "Foundation" { effort 10d }
  task structure  "Structure"  { effort 20d }
  task handover   "Handover" {
    milestone                     # zero-duration checkpoint
    start 2025-06-15
  }
}
```

## Task dependencies

Tasks link with `depends` (successor) and `precedes` (predecessor). References use scope
prefixes (`!task` within the parent, `!!container.task` from a wider scope), accept several
at once, and support a working-time gap (`gaplength`) or calendar-time gap (`gapduration`) —
the basis of finish-to-start, start-to-start and other dependency types.

```tjp
task finishing "Finishing" {
  task wiring "Electrical" { effort 5d }
  task plumbing "Plumbing" { effort 4d }
  task plaster "Plastering" {
    effort 6d
    depends !wiring, !plumbing          # both must finish first
  }
  task paint "Painting" {
    effort 3d
    depends !plaster { gapduration 2d } # starts 2 days after plastering
  }
}
```

## Resources, calendars and availability

Resources form a tree (groups and people) with hourly/period rates that are inherited down
the tree. Working weeks, holidays and per-resource leaves constrain when work can actually
happen, so the schedule respects real availability.

```tjp
leaves holiday "New Year" 2025-01-01

resource crew "Crew" {
  rate 40.0
  resource alice "Alice" {
    rate 55.0
    leaves annual 2025-07-01 - 2025-07-10   # Alice is away
  }
  resource bob "Bob" { }
}

task shell "Erect shell" {
  effort 8d
  allocate alice, bob        # both work on it, splitting the effort
  responsible alice          # accountable, without consuming effort
}
```

## Materials

Materials have a unit, a unit price and an account that aggregates their cost. A task
consumes stock by referencing the material and a quantity. Stock movements (± ) are booked
directly against the inventory.

```tjp
account matcost "Materials" { aggregate materials }

material steel "Steel" {
  unit "kg"
  unitprice 2.5
  chargeset matcost 100%
}

task slab "Foundation slab" {
  effort 3d
  material steel 500        # consumes 500 kg of steel
}
```

## Composite materials

A material can be defined as a recipe of other materials. Its unit price is then _computed_
from the components (component × quantity, recursively), so you price an assembly from its
parts instead of hard-coding a number. A composed material must not declare its own
`unitprice`.

```tjp
material cement "Cement" { unit "kg"  unitprice 0.2 }
material gravel "Gravel" { unit "kg"  unitprice 0.1 }

material concrete "Ready-mix Concrete" {
  unit "m^3"
  material cement 350       # 350 kg of cement per m^3
  material gravel 1800      # per-m^3 price = 350×0.2 + 1800×0.1
}
```

## Accounts, costs and revenues

The accounting model mirrors a chart of accounts: cost and revenue accounts form a tree,
`balance` defines how they roll up, and tasks `charge` amounts to a `chargeset` — either a
flat value (at start/end) or a rate distributed over time. This gives cost, revenue, profit
and cash-flow at any point of the plan.

```tjp
project house "House Build" "1.0" 2025-03-01 - 2025-09-30 {
  currency "USD"
}

account cost "Project Cost" {
  account labor "Labor"
}
account rev "Payments"
balance cost rev

task dig "Excavation" {
  effort 4d
  chargeset labor 100%              # 100% of cost to the Labor account
  charge 170 perday                 # running cost spread over the task duration
}

task deposit "Client deposit" {
  milestone
  chargeset rev
  charge 21000.0 onstart        # revenue recognized at the milestone
}
```

## Reports and Gantt charts

Reports are declared in the same file and rendered as self-contained output. Columns cover
everything the engine computes (dates, effort, cost, custom attributes, …), the `chart`
column emits an HTML/CSS **Gantt** with dependency arrows and milestones, and the same model
exports to CSV, JSON, Markdown, **MSPDI XML** (MS Project), **iCalendar** and TJP round-trip.

```tjp
taskreport "Plan" {
  formats html
  headline "Schedule and Gantt"
  columns bsi { title 'WBS' }, name, start, end, effort, cost, chart
}

accountreport "Financials" {
  formats csv
  columns name, cost, revenue, balance
}
```

## Tracking progress: schedule and cost

Set `now` to the reporting date and record what actually happened — `complete` percentages,
`booking`s of real work, and `journalentry` notes. The engine replans around the actuals and
exposes the delta (done/left effort, status, cost variance) so you track slippage and budget
against the plan.

```tjp
project track "Rollout" "1.0" 2025-10-01 - 2025-10-31 {
  now 2025-10-15
}

resource dev "Developer" { rate 400.0 }

task impl "Implementation" {
  effort 10d
  allocate dev
  complete 40                                  # 40% done as of `now`
  journalentry 2025-10-10 "Started implementation phase"
}

taskreport "Status" {
  formats html
  columns name, start, end, effort, effortdone, effortleft, complete, status, chart
}
```

## Scenarios and what-if

Define scenarios (optionally nested) and override any attribute per scenario — effort, dates,
costs, custom fields — without duplicating the plan. Reports can show one scenario or line up
several side by side to compare a baseline against optimistic/pessimistic outcomes.

```tjp
project risky "Plan vs. Reality" "1.0" 2025-12-01 - 2025-12-31 {
  scenario baseline "Original Plan" {
    scenario delayed "Pessimistic" {
    }
  }
}

task design "Design" {
  effort 5d
  delayed:effort 8d              # only the `delayed` scenario is slower
}

taskreport "Comparison" {
  formats html
  headline "Baseline vs. Pessimistic"
  scenarios baseline, delayed
  columns name, start, end, effort, chart
}
```

## Multilingual syntax

Files can be written in **English, Portuguese (pt-BR) or Spanish** — different words, same
semantics. The parser normalizes every keyword to one canonical representation, so equivalent
files produce identical plans. More languages can be added without touching the engine.

```tjp
language "pt-BR"

projeto obra "Minha Obra" "1.0" 2025-01-06 - 2025-06-30

tarefa fundacao "Fundação" {
  esforço 10d
}
tarefa estrutura "Estrutura" {
  depende !fundacao
  esforço 15d
}
```

## Extensible language

`extend` adds your own typed attributes (`text`, `number`, `date`, `reference`, `richtext`,
`markdown`) to any object, with `inherit` and `scenariospecific` options — then set them like
built-in ones and surface them as report columns.

```tjp
project ext "Site Inspection" "1.0" 2025-05-01 - 2025-05-31 {
  extend task {
    text Inspector "Inspector"
    number Score "Score"
  }
}

task audit "Audit" {
  effort 2d
  Inspector "A. Rivera"
  Score 8.5
}
```

---

## Delivery roadmap

The engine is the product; the interfaces ship in three waves:

1. **Command-line interface** _(next — phase 24)_
   A `tj3`-equivalent multi-runtime CLI (Deno / Bun / Node) that processes `.tjp` files,
   runs the scheduler and writes reports to disk. It will also be the harness for the
   compatibility test wave against real TaskJuggler.

2. **VS Code extension** _(phase 22)_
   Language support for `.tjp`: syntax highlighting, grammar, keyword documentation and an
   LSP server built on the same canonical engine.

3. **Offline web app (PWA)** _(phases 19–20, last)_
   Browser edition with local storage (IndexedDB + OPFS), service worker, and a
   Preact + Signals + BeerCSS UI — installable, fully offline, static hosting only.

The canonical execution order is
`16 → 17 → 18 → 23 → 24 → 21 (wave 1) → 22 → 21 (wave 2) → 19 → 20 → 21 (wave 3)`.
Phases 1–18 (the entire engine) are complete; the remaining phases package it into the
deliverables above, starting with templates (23) and the CLI (24). See
[`CURRENT.md`](CURRENT.md) for live status.

---

## Technology

- **Deno only** — no Node.js, no npm/yarn/pnpm, no `node_modules`. Dependencies are managed
  in `deno.jsonc` via `npm:`/`jsr:` specifiers.
- **TypeScript** in strict mode for the engine (`packages/core`), runtime-agnostic: the core
  never touches DOM, Preact, IndexedDB or the UI.
- **Preact + Signals + BeerCSS** for the (future) web UI; Material Symbols for icons.
- **TaskJuggler as reference, not as a dependency**: the Ruby sources under
  `docs/taskjuggler/lib/taskjuggler/` are the behavioral ground truth for ports, and the real
  `tj3` binary plus golden snapshots validate schedules, reports and the Gantt chart.
- Tests use `@std/testing/bdd` + `@std/assert`.

## Development

Requirements: [Deno](https://deno.com) 2.x and (optionally) TaskJuggler (`tj3` + Ruby) to
regenerate golden tests.

```bash
deno task test        # unit + integration tests
deno task tests       # full quality gate: type check, lint, fmt, doc lint, tests
deno task check:all   # type check per package
deno task lint        # linter
deno task fmt         # formatter
deno task dev         # dev server on port 3000 (early PWA shell)
```

Every feature ships TDD-first, one atomic task at a time, with golden tests against the real
`tj3` — see [`docs/syntaxmesh/09-regras-para-ia.md`](docs/syntaxmesh/09-regras-para-ia.md)
for the working rules.

## Documentation map

| Where                                                              | What                                      |
| ------------------------------------------------------------------ | ----------------------------------------- |
| [`CURRENT.md`](CURRENT.md)                                         | Current status and next step (start here) |
| [`docs/syntaxmesh/fases/plano.md`](docs/syntaxmesh/fases/plano.md) | Canonical 21+3 phase plan                 |
| [`docs/syntaxmesh/decisoes/`](docs/syntaxmesh/decisoes/README.md)  | Architecture decision records             |
| [`docs/syntaxmesh/01-visao.md`](docs/syntaxmesh/01-visao.md)       | Original base specification (pt-BR)       |
| [`docs/Learning/`](docs/Learning/README.md)                        | Worked examples mwe001–mwe009             |

## License

GPL-2.0-only — see [LICENSE](LICENSE).
