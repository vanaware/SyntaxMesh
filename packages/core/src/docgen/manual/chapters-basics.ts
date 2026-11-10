/**
 * `chapters-basics.ts` — introductory manual chapters (22.1b.5).
 *
 * Source text in RichText markup (the same dialect of the historic `.tm`
 * files), in English and restricted to the SyntaxMesh universe: only the `.smx`
 * extension is mentioned. Ruby reads these chapters from
 * `lib/taskjuggler/manual/*`; here they are **constants** — `doc-core` performs
 * no I/O.
 *
 * Dialect rules used: `== Title ==`, `=== Subtitle ===`, code lines indented by
 * one space (become `<pre>`), lists with `* ` and `# `, internal references
 * with `[[keyword]]` and block functions `<[example …]>`.
 *
 * @see ./chapters.ts
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco F
 */

/** One manual chapter: file name (without extension) + text. */
export interface ManualChapter {
  /** Name of the generated file (`<name>.html`) and table-of-contents anchor. */
  readonly name: string;
  /** Text in RichText markup. */
  readonly text: string;
}

/** Introduction, installation and first steps. */
export const BASIC_CHAPTERS: readonly ManualChapter[] = [
  {
    name: "Intro",
    text: `== Introduction ==

SyntaxMesh is a project management tool for people who like to keep their
plans in plain text. You describe the project - tasks, resources, costs,
dependencies, reports - in one or more text files, and SyntaxMesh turns that
description into a schedule and into reports. There is no database and no
binary project format: the input '''is''' the project, and it is readable,
diffable and versionable with the tools you already use.

=== What SyntaxMesh does ===

SyntaxMesh reads a project description, places every task on a time line
according to its dependencies, its effort and the availability of the
resources that work on it, and then freezes the result. Once the project is
scheduled, SyntaxMesh can answer questions about it:

* When does each task start and end? Which tasks are late?
* Who works on what, and when is a person overloaded?
* How much does a task cost, and how much has been booked so far?
* Which revenue has been recognized, and what is the balance?

The answers are written as reports - HTML, Markdown, plain text, project
snapshots or iCalendar feeds - and as sheets that can be sent to the people
working on the project.

=== The moving parts ===

A SyntaxMesh run has three parts:

# You write the project in a file with the ''''.smx'''' extension.
# The scheduler computes all dates, loads and costs.
# The reports you declared are rendered into files.

The command line tool does all three in one go:

  syntaxmesh plan.smx

The same engine is available as a library and through other front ends, so
the command line is a convenience, not a requirement.

=== The vocabulary ===

A short glossary makes the rest of this manual easier to read.

* '''Project''' - the top-level container: name, interval, currency,
  scenario and the default format of reports.
* '''Property''' - any named element of the project: a task, a resource, an
  account, a report. Properties have an optional id, a name and a block of
  attributes.
* '''Attribute''' - a keyword inside the braces of a property, like
  [[effort]] or [[depends]].
* '''Scenario''' - a variant of the project, used to plan an optimistic and a
  pessimistic case side by side.
* '''Slot''' - the smallest time unit of the scheduler (15 minutes). All
  dates are aligned to it.

=== Conventions in this manual ===

Code that you can type is shown in a fixed-width block:

  project example "Sample" 2026-01-05 - 2026-03-31

Text that names a keyword links to its reference page, as in [[task]] or
[[resource]]. Chapter [[The_Syntax|The Syntax]] explains the grammar itself;
[[Getting_Started|Getting Started]] shows the shortest path to a first report. The last
chapter, Appendix A, is generated from the grammar and documents every
keyword SyntaxMesh accepts.
`,
  },
  {
    name: "Installation",
    text: `== Installation ==

SyntaxMesh runs on Deno. Install Deno first, then run SyntaxMesh from the
project directory; nothing else is required.

=== Requirements ===

* Deno 2 or newer.
* A text editor. Any editor works - the project is plain text.
* No database, no server, no network access.

=== Running the command line tool ===

The command line interface ships in the workspace as the ''''syntaxmesh''''
executable. Run it with the project file as the only positional argument:

  syntaxmesh plan.smx

Reports and other artefacts are written below the current directory, or
below ''''--output-dir'''' when the flag is given:

  syntaxmesh plan.smx --output-dir out

=== Files and extensions ===

SyntaxMesh uses the ''''.smx'''' extension for project files. Included files
also use ''''.smx''''; an include is resolved relative to the file that
declares it. Use the forward slash as directory separator inside include
paths so that a project stays portable between operating systems.

=== Getting help ===

The command line answers three kinds of questions about itself:

* ''''syntaxmesh --help'''' lists all options.
* ''''syntaxmesh --version'''' prints the version of the tool.
* ''''syntaxmesh man <keyword>'''' prints the documentation of a keyword,
  and ''''syntaxmesh man --format html'''' writes the complete manual as
  HTML.

A keyword lookup accepts a prefix, so ''''syntaxmesh man rep'''' suggests
every keyword that starts with ''''rep''''.

=== Checking a project ===

Parsing and scheduling can be stopped before any report is written:

  syntaxmesh --check-syntax plan.smx

The exit code is 0 when the project is valid, 1 when an error was reported.
This is the cheapest way to test an edit, and the recommended command for a
pre-commit hook.
`,
  },
  {
    name: "Getting_Started",
    text: `== Getting Started ==

=== Basics ===

A project is one or more text files with the ''''.smx'''' extension. The file
you pass to the tool is the ''master file''; it may include other files with
the ''''include'''' keyword. Everything SyntaxMesh knows comes from those files.

Work happens in a shell and in an editor, because the tool behaves like a
compiler: you give it source, it computes the schedule and writes the
artefacts. Nothing is stored in a hidden database, so re-running the tool on
an unchanged project produces identical output.

=== Structure of an SMX File ===

Every master file starts with exactly one [[project]] header. The header
gives the project an id, a name and a time interval that must be large enough
to contain every task. All other elements may be placed in include files.

After the header come project properties:

* [[macro]] definitions and [[flags]],
* [[account]] definitions,
* [[shift]] definitions and [[leaves]],
* [[resource]] definitions,
* [[task]] definitions,
* ''''accountreport'''', ''''resourcereport'''', ''''taskreport'''', ''''textreport'''' and
  ''''export'''' declarations.

The order is free in principle, but properties that are referenced must be
declared first: a resource must exist before a task can allocate it, and an
account must exist before a task can charge it. The list above is a safe
order.

A project must contain at least one task. Report declarations are optional;
without them SyntaxMesh schedules the project and checks it, but writes no
report.

=== The smallest useful project ===

This project has one task, one resource and one report:

  project hello "Hello world" 2026-01-05 - 2026-03-31

  resource dev "Developer"

  task design "Design the product" {
    effort 5d
    allocate dev
  }

  taskreport "Plan" {
    formats html
    columns id, name, start, end, effort
  }

Running ''''syntaxmesh hello.smx'''' parses the file, schedules the 5 days of
work, writes ''''Plan.html'''' and exits with code 0.

=== Anatomy of a property ===

Every property follows the same shape: keyword, optional id, mandatory name,
optional attribute block.

  task design "Design the product" {
    effort 5d
  }

* '''Keyword''' - [[task]] here. It selects the grammar of the property.
* '''Id''' - ''''design''''. Ids are used by other properties to refer to
  this one.
  The id may be omitted when nothing refers to the property.
* '''Name''' - the quoted string. It is mandatory and appears in reports.
* '''Attributes''' - the block in curly braces. When a property has no
  attributes the braces may be omitted.

=== Dates and durations ===

Dates are written as year-month-day, optionally followed by a start time and
a time zone:

  2026-01-05
  2026-01-05-13:00
  2026-01-05-13:00-+0100

Durations use the suffixes ''''min'''', ''''h'''', ''''d'''', ''''w'''',
''''m'''' and ''''y'''':

  effort 5d
  effort 90min
  effort 2w

Intervals are written as two dates separated by a dash. Whether the end date
is inclusive depends on the property; ''''interval'''' documents the rule.

=== Reports ===

A report declaration names the report, its format and its content. The
columns attribute is a comma-separated list of column ids:

  taskreport "Plan" {
    formats html
    columns id, name, start, end, effort
  }

The [[formats]] attribute may list several formats at once; each format
produces its own file. See [[Reports]] for the report types, the column
vocabulary and the output naming rules.

=== Where to go next ===

Follow [[Tutorial]] for a small project built step by step, or read
[[The_Syntax|The Syntax]] to learn the grammar in one pass. Appendix A contains the
reference page of every keyword, including all attributes with their
contexts and inheritance rules.
`,
  },
];
