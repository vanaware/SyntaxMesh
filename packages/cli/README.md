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

| Flag                       | Meaning                                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--check-syntax`           | Parse only; prints `Syntax check passed.` and exits before scheduling                                                                                                                                 |
| `--list-reports <regex>`   | Lists the matching reports (`<name> (<type>)`) and exits                                                                                                                                              |
| `--reports <regex>`        | Generates only the reports whose **id** matches (`report1`, `report2`… when the file declares no id)                                                                                                  |
| `--no-reports`             | Schedules without generating or printing anything                                                                                                                                                     |
| `--force-reports`          | Generates reports even when the scheduler reported errors (exit code still reflects the errors)                                                                                                       |
| `-f`                       | `tj3` short form of `--force-reports`; inside a sheet app it means `--force`                                                                                                                          |
| `--output-dir <dir>`       | Directory for written reports (default: current directory)                                                                                                                                            |
| `--freeze`                 | Writes the frozen project (`<master>-header.tji` + `<master>-bookings.tji`) next to the master                                                                                                        |
| `--freezedate <date>`      | Cut-off date for the bookings exported by `--freeze` (default: `now`)                                                                                                                                 |
| `--freeze-by-task`         | Groups the frozen bookings by task instead of by resource (`--freezebytask` also accepted)                                                                                                            |
| `--check-time-sheet <f>`   | Validates a time sheet against the project and exits (one sheet per run)                                                                                                                              |
| `--check-status-sheet <f>` | Validates a status sheet against the project and exits (one sheet per run)                                                                                                                            |
| `--config <file>`          | `tj3` YAML config: applied to the sheet apps (`appOptions.config`) and, for the plain CLI, to the `MessageHandlerInstance` sinks through the shared `RuntimeConfig` seam (`_global` / `_global._log`) |
| `--silent`                 | Hides `info`/`debug` messages (warnings, errors and the counters line stay)                                                                                                                           |
| `--no-color`               | Disables ANSI colors (also automatic when stdout is not a TTY)                                                                                                                                        |
| `--version`                | Prints `SyntaxMesh <version>` and exits before reading any file                                                                                                                                       |
| `--help`                   | Prints the help text                                                                                                                                                                                  |

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

Relative images cited by a written `html`/`markdown` report (`<img src>`,
`<object data type="image/…">`, `![alt](path)`) are copied to the same relative
path beside the report, so the reference keeps working without being rewritten.
The source is the process working directory; external URLs (`http(s)://`,
`//`, `data:`), absolute paths and paths with a `..` segment are left alone.

## Freeze

`--freeze` writes the frozen project next to the master file, as `tj3` does:

```
<master>-header.tji     now <--freezedate>-00:00-+0000
<master>-bookings.tji   supplement resource|task … { booking … }
```

The project needs a `trackingscenario`; without one the command fails with
`no_tracking_scen`. The three freeze flags are order independent and
`--freezedate` alone does **not** turn the freeze on. Both artefacts are always
written, truncating whatever a previous freeze left behind — an empty
`<master>-bookings.tji` means “no bookings up to the cut-off”. After writing,
the normal pipeline continues — combine with `--no-reports` to stop right there.

## Time and status sheet apps

`tj3` ships one binary per sheet app; here they are subcommands:

| Command      | Purpose                                                    |
| ------------ | ---------------------------------------------------------- |
| `ts send`    | Writes the time sheet templates and one email per resource |
| `ts receive` | Reads a submission (`--from <file\|->`) and records it     |
| `ts summary` | Sends (and prints) the submission summary                  |
| `ss send`    | Writes the status sheet templates and the reminder emails  |
| `ss receive` | Reads a status sheet submission (`--from <file\|->`)       |

There is no SMTP and no hidden transport: each message is printed and also
written to `outbox/001-<recipient>.eml` (full RFC 822), and every file the app
created is written under the working directory. Flags mirror the Ruby apps:
`-e/--enddate`, `-r/--resource`, `-f`/`--force`, `--hideresource`, `-i/--interval`,
`--sheet`, `--digest`, `--dryrun` and `-d/--directory` (the root for the files
the command reads and writes). `-t/--to` of `ts summary` fills both the sheet and
the digest recipient lists, exactly as `Tj3TsSummary.rb` does; use `--sheet` or
`--digest` to target only one. `--config <file>` supplies the `tj3` YAML these
apps expect (`senderEmail`, `smtpServer`, …); nothing is sent over the network.

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
- `--config` is applied to the sheet apps (`ts`/`ss`) through the parsed
  `appOptions.config` and to the plain CLI via the shared `RuntimeConfig`
  seam (`_global` / `_global._log` configure `MessageHandlerInstance`:
  `outputLevel`, `logLevel`, `logFile`, `abortOnWarning`, `hideScenario`).
  Any other section in the YAML is preserved in `request.configContent` for
  future consumers.
- `man` is still missing: it needs the documentation core shipped by phase 22.
  The envelope section and its printing are already in place, so the command
  will only have to fill it.
- Bun is not exercised in CI here (the runtime is not installed); the bundle is
  the same ESM file Node runs.

## Development

```
deno task check      # type check src/ + tests/ + scripts/
deno task test       # unit + subprocess integration tests
deno task tests      # check + test
deno task build      # dist/syntaxmesh (Deno) + dist/cli.js (Node/Bun)
```
