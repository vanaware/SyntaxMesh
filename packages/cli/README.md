# SyntaxMesh CLI

`tj3`-compatible command line for SyntaxMesh project files. Runs on **Deno**,
**Node** and **Bun** from the same source: everything the process touches
(argv, filesystem, terminal, exit code) goes through [`src/io.ts`](src/io.ts),
and the whole run is a **single** `core.execute(request)` call that returns a
JSON envelope.

```
syntaxmesh <file.smx> [options]
```

`file.smx` is the SyntaxMesh extension; `.tjp` is accepted for TaskJuggler
compatibility. `include "…"` directives may reference `.tji` or `.smx` and are
resolved by the CLI before the core runs (the core never reads the disk).

## Install & run

| Runtime       | Command                                                                   |
| ------------- | ------------------------------------------------------------------------- |
| Deno (source) | `deno task cli <file.smx>` (root) or `deno task run <file.smx>` (package) |
| Deno (binary) | `deno task compile` → `dist/syntaxmesh <file.smx>`                        |
| Node (bundle) | `deno task build:node` → `node dist/cli.js <file.smx>`                    |
| Bun (bundle)  | same bundle: `bun dist/cli.js <file.smx>`                                 |

Build both distribution artifacts with `deno task build`.

### Permissions

| Runtime           | Needs                                             |
| ----------------- | ------------------------------------------------- |
| Deno / `deno run` | `--allow-read --allow-write --allow-env`          |
| `dist/syntaxmesh` | embedded by `deno compile` (no flags at run time) |
| Node / Bun        | none beyond the filesystem access of any process  |

`--allow-env` is granted but **not read** today: every input comes from argv
and from the project file, so a future `tj3`-style environment override will
not need a permission change. A directory that is not writable fails at the
first report that has to be written, with a clear message on `stderr`.
No `--allow-sys` is required: the CLI avoids `fs.access()` (in Deno's
`node:fs` shim it resolves the process uid) and uses `stat` instead.

## Flags

| Flag                     | Meaning                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `--check-syntax`         | Parse only; prints `Syntax check passed.` and exits before scheduling                                |
| `--list-reports <regex>` | Lists the matching reports (`<name> (<type>)`) and exits                                             |
| `--reports <regex>`      | Generates only the reports whose **id** matches (`report1`, `report2`… when the file declares no id) |
| `--no-reports`           | Schedules without generating or printing anything                                                    |
| `--force-reports`        | Generates reports even when the scheduler reported errors (exit code still reflects the errors)      |
| `--output-dir <dir>`     | Directory for written reports (default: current directory)                                           |
| `--config <file>`        | Legacy `tj3` YAML config (parsed; application is still a stub)                                       |
| `--silent`               | Hides `info`/`debug` messages (warnings, errors and the counters line stay)                          |
| `--no-color`             | Disables ANSI colors (also automatic when stdout is not a TTY)                                       |
| `--version`              | Prints `SyntaxMesh <version>`                                                                        |
| `--help`                 | Prints the help text                                                                                 |

Exit codes: `0` success, `1` any error (parse, schedule, report). The code is
always taken from the envelope — the CLI never invents success.

## Report destinations

A report with the `stdout` modifier is printed; every other report is written
to `--output-dir` (or the current directory) as `{name}.{extension}`.

```tjp
taskreport "Tarefas" { formats csv }          # -> Tarefas.csv
taskreport "Console" stdout { formats csv }   # -> terminal
```

Printed output is delimited so several reports can share one stream:

```
--- Console [csv] ---
id;name;start;end
...
```

| Format           | Extension     |
| ---------------- | ------------- |
| `csv`            | `.csv`        |
| `html`           | `.html`       |
| `json`           | `.json`       |
| `markdown`       | `.md`         |
| `iCal`           | `.ics`        |
| `mspxml`, `niku` | `.xml`        |
| `tjp`            | `.tjp`        |
| `ctags`          | _(no suffix)_ |

File names are sanitised: only the last path segment survives, and
the characters `\ ? % * : | " < >` become `_`. An empty result becomes
`report`. Existing files are overwritten.

When an `html` report is written, the auxiliary assets (`css/`, `icons/` and
`scripts/wz_tooltip.js`) are copied next to it unless the report is
`selfcontained`. They are read from the repository root relative to the running
module, so a binary or bundle that is moved away from the source tree keeps
generating the HTML but without the assets next to it.

## Failure policy

There is no partial output. If the envelope reports `ok: false` or any
`reports[].errors`, **nothing** is printed and **nothing** is written: the
messages go to `stderr` and the exit code is `1`. Rerunning after fixing the
project is always safe, and a failed run never leaves half a set of reports
behind.

Messages follow `tj3`'s `Message#to_s` layout — `file:line: Type: text` — and
go to `stderr`, keeping `stdout` for report content. A final `N errors, M
warnings` line is printed when there is at least one of either.

## Known limitations

- **Deno Deploy** (and any runtime without a filesystem) is out of scope: the
  CLI reads project files and writes reports, so it needs a real disk.
- The compiled binary is large because `deno compile` embeds the workspace npm
  layout: 605 MB by default in this repository, 349 MB with
  `--node-modules-dir=none`, and 114 MB when compiled from an isolated tree
  (the CLI's own graph has only six npm packages). Shrinking it is a packaging
  task, not a runtime one.
- `--config` parses the file but the YAML is not applied yet (`Tj3Config` is a
  stub); a `not applied yet` warning is emitted.
- `sheet`, `man` and `--freeze*` are still stubs of later sub-phases (24.9 /
  24.10).
- Bun is not exercised in CI here (the runtime is not installed); the bundle is
  the same ESM file Node runs.

## Development

```
deno task check      # type check src/ + tests/ + scripts/
deno task test       # unit + subprocess integration tests
deno task tests      # check + test
deno task build      # dist/syntaxmesh (Deno) + dist/cli.js (Node/Bun)
```
