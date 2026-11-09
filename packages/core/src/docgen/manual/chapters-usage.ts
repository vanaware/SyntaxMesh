/**
 * `chapters-usage.ts` — capítulos de uso: tutorial, relatórios e rotina
 * (22.1b.5).
 *
 * Mesmo contrato de {@link ./chapters-basics.ts}: texto-fonte RichText em
 * inglês, sem E/S, apenas a extensão `.smx`.
 *
 * @see ./chapters.ts
 */

import type { ManualChapter, } from "./chapters-basics.ts";

/** Tutorial, relatórios e o uso no dia a dia. */
export const USAGE_CHAPTERS: readonly ManualChapter[] = [
  {
    name: "Tutorial",
    text: `== The Tutorial: Your first Project ==

This chapter builds a small project from scratch, one property at a time.
The project is an accounting software package with a design phase, an
implementation phase and two people working on it. Every listing is complete:
you can paste them, in order, into a single ''''.smx'''' file.

=== Starting the project ===

A project file always starts with the project header: an id, a name and the
interval the scheduler may use.

  project acso "Accounting Software" 2026-01-05 - 2026-06-30

The interval must be large enough to hold every task, but not much larger:
the scheduler walks it slot by slot, so an oversized interval costs time
without changing the result.

=== Global attributes ===

The header may carry attributes that apply to the whole project. The usual
ones set the time zone, the currency and the date format used in reports.

  project acso "Accounting Software" 2026-01-05 - 2026-06-30 {
    timezone "Europe/Berlin"
    currency "EUR"
    timeformat "%Y-%m-%d"
  }

[[timezone]] only affects how dates are interpreted and displayed; it does not
move the project interval. [[currency]] is the unit of every monetary value.
[[timeformat]] is a report setting and does not change how dates are written
in the file.

=== Accounts ===

Accounts form a tree. Every cost and every revenue is charged to one leaf of
that tree, which is what makes the financial reports possible.

  account dev "Development" {
    account backend "Backend"
    account frontend "Frontend"
  }

  account sales "Sales"

=== Resources ===

A resource is somebody or something that performs work. Resources have a
working calendar and may be grouped.

  resource team "Team" {
    resource alice "Alice"
    resource bob "Bob"
  }

The working calendar comes from the project calendar unless a [[shift]]
overrides it. [[efficiency]] scales the effective working time; a resource at
50 percent needs twice the calendar time for the same effort.

=== Tasks ===

Tasks form a tree as well. A container task derives its dates from its
children; a leaf task needs either an explicit interval or an effort.

  task acso "Accounting Software" {
    task design "Design" {
      effort 10d
      allocate alice
    }
    task implementation "Implementation" {
      effort 30d
      allocate alice, bob
    }
  }

[[allocate]] assigns resources. When several resources share a task, the
effort is distributed over them according to their availability.

=== Dependencies ===

Dependencies are declared with [[depends]]. The value is a list of task ids;
a leading exclamation mark means that the dependency is a ''start-to-start''
link instead of the default ''finish-to-start''.

  task acso "Accounting Software" {
    task design "Design" {
      effort 10d
      allocate alice
    }
    task implementation "Implementation" {
      effort 30d
      depends !design
      allocate alice, bob
    }
  }

The project is now schedulable. Running the tool freezes the dates and
reports any inconsistency, such as a task that does not fit in the project
interval.

=== Adding a report ===

A report declaration is a property too. It names the report, the format and
the columns:

  taskreport "Plan" {
    formats html
    columns id, name, start, end, effort
    headline "Accounting Software - plan"
  }

Reports are rendered after scheduling, so they always show frozen data.

=== A complete project ===

The listing below is a complete, schedulable project that combines everything
above. Save it as ''''acso.smx'''' and run ''''syntaxmesh acso.smx''''.

<[example file="HtmlTaskReport"]>

=== Where to go next ===

[[Reports]] explains the report vocabulary, including filters, sorting and the
material columns. [[Day_To_Day|Day to Day]] describes the routine of updating a running
project with bookings and sheets.
`,
  },
  {
    name: "Reports",
    text: `== Reports ==

A report is a projection of the scheduled project into a table. Reports are
declared in the project file, rendered after scheduling, and written next to
the project file unless ''''--output-dir'''' says otherwise.

=== Report properties ===

Four report properties exist; each one understands a different column
vocabulary:

* ''''taskreport'''' - tasks as rows, with dates, effort, cost and status.
* ''''resourcereport'''' - resources as rows, with load, availability and cost.
* ''''accountreport'''' - accounts as rows, with direct, total and balance
  values.
* ''''textreport'''' - free text with embedded queries.
* ''''export'''' - the project itself, in a form that can be read back.
* ''''tracereport'''', ''''nikureport'''', ''''timesheetreport'''' and
  ''''statussheetreport'''' - specialized reports for tracing, forecasting and
  sheets.

  taskreport "Plan" {
    formats html
    columns id, name, start, end, effort
  }

=== Formats ===

[[formats]] accepts a list, so one declaration can produce several files. The
extension of the output file is derived from the format.

  taskreport "Plan" {
    formats html, markdown
    columns id, name, start, end
  }

Generic report formats are ''''html'''', ''''markdown'''', ''''csv'''',
''''json'''', ''''iCal'''', ''''ctags'''', ''''mspxml'''' and ''''niku''''. An
''''export'''' report instead names a project output format, and defaults to the
project source format when [[formats]] is omitted.

=== Columns ===

''''columns'''' is a list of column ids. Each column id has a title and an
alignment; ''''column'''' overrides those and adds sort order and width.

  taskreport "Plan" {
    formats html
    columns id, name, start, end, cost
    column id "Task" width 200
    column cost "Cost" sort 1
  }

Columns that are not valid for the report type are reported as errors when the
report is rendered.

=== Filtering and sorting ===

Rows are filtered with a logical expression and ordered by ''''sortTasks'''',
''''sortResources'''' or the sort order of the columns.

  taskreport "Critical path" {
    formats html
    columns id, name, start, end
    hidetask ~isleaf()
  }

[[hidetask]], ''''hideresource'''', ''''hideaccount'''' and ''''rollupresource'''' control
which rows appear. A hidden container rolls up its children into the parent
line unless it is declared as a roll-up of its own.

=== Headers, footers and breaks ===

Reports are documents, so they support text around the table:

* ''''headline'''' and ''''caption'''' - titles above the table.
* ''''header'''' and ''''footer'''' - repeating text at the top and the bottom.
* ''''center'''' - a centered line.
* ''''left'''' and ''''right'''' - aligned text blocks.

  taskreport "Plan" {
    formats html
    headline "Plan"
    caption "Generated with SyntaxMesh"
    columns id, name, start, end
  }

=== Calendars and scaling ===

''''calendar'''' adds week or month rows to the report, and ''''scenarios'''' picks the
scenario whose data is shown. Without ''''scenarios'''' the report shows the
default scenario.

  taskreport "Plan" {
    formats html
    columns id, name, start, end
    calendar 2026-01-01 - 2026-06-30
    scenarios optimistic
  }

=== Writing files ===

The output file name comes from the report id: ''''Plan.html'''',
''''Plan.md'''' and so on. [[outputdir]] moves a single report to a
subdirectory of the output directory, which is convenient for grouping a
large report set.

=== Export ===

''''export'''' writes the project back as project source. This is the way to take
a snapshot of a frozen schedule, or to hand a project to another tool:

  export "Snapshot" {
    hideresource 0
  }

The exported file is a valid project file: it can be parsed again without any
loss of the frozen dates and bookings.
`,
  },
  {
    name: "Day_To_Day",
    text: `== Day to Day Juggling ==

A plan is only useful while it matches reality. This chapter describes the
routine of keeping a project up to date once work has started.

=== Booking work ===

Work that actually happened is recorded with ''''booking''''. A booking names a
task, a resource and an interval, and optionally the effort that was spent.

  task implementation "Implementation" {
    effort 30d
    allocate alice
    booking alice 2026-02-02 - 2026-02-13
  }

Bookings are facts: the scheduler does not move them. If a booking overlaps a
period in which the resource is not available, that is reported instead of
being silently corrected.

=== Recording costs and revenue ===

Costs are attached to tasks with [[chargeset]]; revenue with [[credits]] on
the account side. Both accept an amount per period and a scaling factor.

  task implementation "Implementation" {
    effort 30d
    chargeset dev.backend 480
    credits sales 1200
  }

[[chargeset]] is a list attribute, so a parent may declare it once and let the
children inherit it. [[Reports]] explains how the values appear in an
''''accountreport''''.

=== Changing the plan ===

When the plan changes, edit the property and run the tool again. Because the
input is the single source of truth, the new schedule is always derived from
the current file - there is no hidden state to migrate.

To keep a snapshot of the previous schedule, run ''''export'''' before editing, or
ask the tool to freeze the current bookings into a separate file:

  syntaxmesh --freeze plan.smx

The freeze writes a header file and a booking file that can be included from
the main file; that is how a baseline is preserved without copying the whole
project.

=== Scenarios ===

A scenario is a named alternative of the same project. Use it to compare an
optimistic estimate with the committed plan. Scenarios live inside the
project block:

  project plan "Plan" 2026-01-05 - 2026-06-30 {
    scenario optimistic "Optimistic"
    scenario committed "Committed"
  }

Reports pick a scenario with ''''scenarios''''; the scheduler always works in one
scenario at a time.

=== Sheets ===

Time and status sheets collect data from the people doing the work. A sheet is
generated as an ''''.smx'''' file, sent out, filled in and sent back; the
receiver folds the values into the project as bookings.

The command line exposes the sheet workflow as subcommands:

  syntaxmesh ts send plan.smx
  syntaxmesh ts receive --from sheet.smx plan.smx
  syntaxmesh ts summary plan.smx

The same subcommands exist for status sheets as ''''ss send'''' and
''''ss receive''''.

=== Checking and continuous integration ===

Before committing, run the project with ''''--check-syntax'''' to make sure it
still parses and schedules. The exit code is the only thing a build job needs
to look at:

  syntaxmesh --check-syntax plan.smx

=== Closing a project ===

When the project is done, run it one last time, keep the generated reports and
the exported snapshot, and archive the source files with them. The source plus
the snapshot is a complete record of the project: the schedule can be
reproduced at any time, on any machine, with no other input.
`,
  },
];
