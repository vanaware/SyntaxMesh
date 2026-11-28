---
title: "SyntaxMesh VS Code Extension Manual"
icon: "terminal"
date: "2026-11-25"
author: "SyntaxMesh Team"
tags:
  - "vscode"
  - "extension"
  - "lsp"
  - "console"
  - "guide"
description: "Complete guide to the SyntaxMesh VS Code extension: installation, Project Explorer, every command, LSP features, Desktop pseudo-terminal, Web console, reports, sheets, settings, and troubleshooting."
location: "#/articles/vscode-extension-manual.md"
---

# SyntaxMesh VS Code Extension Manual

The SyntaxMesh extension brings TaskJuggler-compatible project tooling into
VS Code. It combines editor intelligence, a multi-project explorer, in-process
execution, report presentation, time/status-sheet applications, and an interactive
SyntaxMesh console.

This manual describes the behavior implemented by the extension. It covers both
the Desktop extension host and VS Code for the Web.

## Compatibility and installation

The manifest identifies publisher `vanaware`, extension `syntaxmesh-vscode`, display
name `SyntaxMesh`, version `0.0.2`, and VS Code engine `^1.90.0`. Desktop loads
`dist/extension.node.js`; Web loads `dist/extension.web.js`.

### Install a built VSIX

From the repository root:

```bash
deno task package:vsext
```

The package task builds the Desktop and Web bundles and creates a VSIX in the
extension package directory. Install it with the VS Code CLI:

```bash
code --install-extension ./packages/vsextension/syntaxmesh-vscode-0.0.2.vsix
```

You can also install it from the Extensions view:

1. Open **Extensions**.
2. Open the **Views and More Actions** menu.
3. Choose **Install from VSIX...**.
4. Select the generated `.vsix` file.

To build without packaging:

```bash
deno task build:vsext
```

This produces the extension and language-server bundles under
`packages/vsextension/dist/`.

The repository workflow builds a VSIX. Marketplace publication is separate and
is not implied by this manual.

---

## Activation and supported files

The extension activates when:

- A document with language ID `syntaxmesh` opens.
- The `syntaxmesh.projectTree` view opens.

The language is associated with:

| Extension | Role                                  |
| --------- | ------------------------------------- |
| `.smx`    | Native SyntaxMesh project master      |
| `.tjp`    | TaskJuggler-compatible project master |
| `.tji`    | Time/status-sheet input               |

A project master must end in `.smx` or `.tjp`. A `.tji` file receives language
support but cannot be selected as a project master.

The extension contributes:

- TextMate grammars for project and sheet files.
- Language configuration for comments, brackets, and related editor behavior.
- SyntaxMesh snippets.
- LSP diagnostics, hover, completion, navigation, symbols, and semantic tokens.
- The **Project Explorer** view.
- The commands documented in this manual.

No default keyboard shortcuts are contributed. Assign your own shortcuts through
VS Code's Keyboard Shortcuts editor if desired.

---

## Desktop and Web hosts

The same canonical commands run in both hosts, but console and persistence details
differ.

| Behavior                  | Desktop                                                  | Web                                                          |
| ------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| Language-server transport | Node IPC                                                 | Web Worker                                                   |
| Console                   | `SyntaxMesh Console` pseudo-terminal                     | `SyntaxMesh Console` output channel plus input prompts       |
| Project cache             | Persisted under extension storage as `daemon-cache.json` | In-memory for the current session                            |
| File writes               | Direct `workspace.fs` writes                             | Stub-first writes compatible with browser permission prompts |
| General shell             | Not available                                            | Not available                                                |

The pseudo-terminal is a SyntaxMesh command console, not an operating-system
shell. The Web host has no pseudo-terminal at all.

---

## User interface tour

### Activity bar and Project Explorer

Open the SyntaxMesh activity-bar container to display **Project Explorer**. Each
loaded project appears as a root with these categories:

- Tasks
- Resources
- Accounts
- Shifts
- Reports

Interactions:

- Click a project root to make it active.
- Click a report leaf to open its HTML representation.
- Use **Add Project** and **Refresh Project** in the view title menu.
- Right-click a project for **Remove Project** or **Compile Project**.
- Right-click a report for **Export Report**.

The command **SyntaxMesh: Show Project Tree** refreshes the view and focuses it.

### Status bar

The SyntaxMesh status-bar item summarizes cached projects and opens the console
when clicked. Its text has this general form:

```text
SyntaxMesh: busy|idle|ok|error · locale · N projects · M reports · E errors · intent
```

The report count is shown when aggregate status is `ok`. The final intent is the
active project's most recent operation, such as `inventory`, `compile`, or
`schedule`.

### Output channels

The extension uses separate channels so different workflows do not overwrite one
another:

| Channel                | Used by                              |
| ---------------------- | ------------------------------------ |
| `SyntaxMesh Console`   | Web console input/output             |
| `SyntaxMesh Sheets`    | Sheet stdout and structured messages |
| `SyntaxMesh Help`      | CLI-compatible help text             |
| `SyntaxMesh Manual`    | Text/SMX manual output               |
| Language-client output | LSP transport tracing when enabled   |

---

## Workspace Trust and project resolution

File-reading, project-mutation, execution, report-export, sheet, and write commands
are Workspace Trust-gated. If a command reports that the workspace is not trusted,
use **File > Manage Workspace Trust** or the corresponding command in the Command
Palette, then retry.

When a command does not receive an explicit project, the extension resolves one in
this order:

1. The explicitly active project in the extension registry.
2. The active editor's project master.
3. The only loaded project, if exactly one exists.

If multiple projects are loaded and none can be selected unambiguously, the
command fails instead of guessing. Use **Set Active Project** or pass an explicit
project URI.

An explicit project argument must identify a `.smx` or `.tjp` master. Invalid
explicit references do not silently fall back to another project.

---

## Quick start

1. Open a `.smx` or `.tjp` master in VS Code.
2. Run **SyntaxMesh: Add Project** from the Command Palette.
3. Open **Project Explorer** and confirm that the project appears.
4. Run **SyntaxMesh: Check Syntax**.
5. Run **SyntaxMesh: Schedule Only** to validate scheduling without rendering
   reports.
6. Use **SyntaxMesh: Open Report** to preview a report, or **SyntaxMesh: Run CLI
   Command** through the console to produce files.
7. After editing the master or an included file, run **SyntaxMesh: Refresh
   Project** before using cached semantic commands.

A console equivalent is:

```text
project add "file:///home/me/project/master.smx"
project set-active "file:///home/me/project/master.smx"
check-syntax
schedule-only
compile
report list
report open
```

Omitting the project uses the resolution rules above. `report open` prompts for a
report when no report ID is supplied.

---

## Project Explorer and project cache

The project daemon reads the master and its include closure. For every file in the
closure, an open unsaved editor buffer takes precedence over disk content.

The daemon does **not** watch `onDidChange` or `onDidSave`. Editor LSP diagnostics
update while you type, but the project cache used by execution commands changes
only through explicit operations:

- **Add Project** loads a master.
- **Refresh Project** re-reads the master and its include closure.
- **Remove Project** removes it from the extension cache only; it does not delete
  files.
- **Run CLI Command** refreshes an already cached project for a normal project run,
  or adds it if absent.

On Desktop, the cached project list and active selection are restored on
activation. Cached content can still be stale, so refresh after external edits.
On Web, the cache is session-local.

Project status icons indicate loading, error, or successful loading. Add, refresh,
remove, active-selection changes, and executions refresh the explorer.

---

## Execution workflow

### Semantic execution commands

| Command                   | What it does                                         | Output behavior                                       |
| ------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| `syntaxmesh.checkSyntax`  | Parses without scheduling                            | Diagnostics only                                      |
| `syntaxmesh.scheduleOnly` | Parses and schedules without report rendering        | Diagnostics and cached execution state                |
| `syntaxmesh.compile`      | Parses, schedules, and renders report data in memory | Does not open or write report files                   |
| `syntaxmesh.freeze`       | Executes freeze and writes header/bookings artifacts | Writes two confirmed files beside the master          |
| `syntaxmesh.run`          | Runs the shared CLI-compatible request pipeline      | Dispatches requested files and captures stdout/stderr |

`compile` is not a file-producing command. Its `outputDir` option is execution
metadata; it does not dispatch reports. Use one of these when output is required:

- `syntaxmesh.run`
- `syntaxmesh.report.open`
- `syntaxmesh.report.export`

### Execution diagnostics

Execution results publish to a diagnostic collection named
`syntaxmesh.execution`, separate from live LSP diagnostics whose source is
`syntaxmesh`.

Execution diagnostics include errors, warnings, information, and hints. Add,
refresh, and remove operations clear only the affected project's execution
diagnostics.

### Freeze

The freeze command accepts an optional date and grouping mode. It requires the
core to return exactly two artifacts, validates their names as safe basenames,
and writes them beside the project master through one confirmed output batch.

The command is not a rollback transaction: overwrite confirmation covers the
batch, but a later I/O failure is reported as a failure rather than automatically
restoring earlier writes.

---

## Reports

### List

`SyntaxMesh: List Reports` reads the cached report inventory. An optional pattern
is a JavaScript regular expression matched against the report ID or display name.

### Render

`SyntaxMesh: Render Reports` renders report data without opening a Webview or
writing files. With no selection it renders all reports. Selection can be exact
or regex-based.

### Open

`SyntaxMesh: Open Report` renders one exact report and opens its HTML
representation in a Webview beside the editor. If no report ID is supplied, the
extension shows a report picker.

The Webview uses a Content Security Policy nonce and local resource roots. Its
**Save** action writes the HTML beside the master after the normal overwrite
check.

### Export

`SyntaxMesh: Export Report` renders one exact report and exports one available
format. Unless supplied programmatically, the command prompts for:

1. The report.
2. The format, when not already known.
3. The destination file.

The default destination is beside the master. Export writes only the selected
format. Available formats come from the rendered report; they are not a fixed
extension-wide list.

Canonical report IDs are used for selection even when the UI displays a different
report name.

---

## Time and status sheets

The extension exposes five project-backed sheet applications:

| Command                           | CLI-compatible app |
| --------------------------------- | ------------------ |
| `syntaxmesh.sheet.time.send`      | `ts send`          |
| `syntaxmesh.sheet.time.receive`   | `ts receive`       |
| `syntaxmesh.sheet.time.summary`   | `ts summary`       |
| `syntaxmesh.sheet.status.send`    | `ss send`          |
| `syntaxmesh.sheet.status.receive` | `ss receive`       |

These applications do not use SMTP. They generate sheets and outbox `.eml`
artifacts. Printable previews and structured messages appear in
`SyntaxMesh Sheets`.

### Sheet checks

- **Check Time Sheet** validates a `.tji` time sheet.
- **Check Status Sheet** validates a status sheet.
- If no sheet URI is supplied, the command opens a file dialog.

In the console, use `check-ts` and `check-ss` with a sheet URI.

### Sheet application options

The typed command API accepts these options:

| Option             | Meaning                                                    |
| ------------------ | ---------------------------------------------------------- |
| `directoryUri`     | Read/write root; defaults to the master's parent directory |
| `endDate`          | Upper bound of the processed period                        |
| `resources`        | Selected resource IDs                                      |
| `force`            | Re-send an existing template                               |
| `hideResource`     | Resource expression hidden by the status-sheet sender      |
| `intervalDuration` | Status-sheet period interval                               |
| `to`               | Recipients appended to both sheet and digest lists         |
| `sheetRecipients`  | Individual-sheet recipients                                |
| `digestRecipients` | Consolidated-digest recipients                             |
| `dryRun`           | Preview without writing sheet or email artifacts           |
| `configUri`        | YAML configuration file                                    |
| `fromUri`          | Receiver message file, or `-` for injected stdin           |

Receiver applications require an email message file or injected stdin.
`fromUri: "-"` is valid only when stdin is supplied.

`dryRun: true` suppresses file and email artifacts while preserving printable
preview output.

---

## Language server

The extension attaches only to documents whose language ID is `syntaxmesh`. It is
scheme-agnostic and watches `**/*.{smx,tjp,tji}` for client synchronization.

### Advertised capabilities

| Feature                          | User-facing behavior                                   |
| -------------------------------- | ------------------------------------------------------ |
| Incremental text synchronization | Re-analysis after document changes                     |
| Diagnostics                      | Errors and warnings while editing                      |
| Hover                            | Information for supported syntax and declarations      |
| Completion                       | Context-aware completion items                         |
| Definition                       | Jump to supported declarations across open documents   |
| References                       | Find supported references across open documents        |
| Document symbols                 | Outline and navigation within one document             |
| Workspace symbols                | Search symbols from all open SyntaxMesh documents      |
| Semantic tokens                  | Additional syntax coloring for supported token classes |

Semantic token types are:

- `keyword`
- `identifier`
- `string`
- `number`
- `date`
- `comment`

No semantic-token modifiers are advertised.

### Diagnostic mapping

- `fatal` and `error` become Error diagnostics.
- `warning` becomes Warning.
- `info` and `debug` are not published as LSP diagnostics.
- Engine locations are converted from 1-based to LSP's 0-based positions.
- Messages without source locations appear at the start of the document.
- Closing a document clears its LSP diagnostics and removes its cached analysis.

### Scope and limitations

Navigation and workspace symbols aggregate the latest analyses of **open**
documents. This is not a persistent whole-workspace index. Open related master,
include, and sheet files when you need cross-file navigation or symbols.

The current server does not advertise rename, formatting, code actions, or a
persistent workspace-wide index.

### LSP tracing

Set `syntaxmesh.trace.server` to `messages` or `verbose` to inspect communication
between VS Code and the language server. Return it to `off` when finished.

Desktop tracing uses the Node client and IPC transport. Web tracing uses the
browser client and Worker transport.

---

## Desktop pseudo-terminal

Open the console with **SyntaxMesh: Open Console**, the status-bar item, or the
terminal named `SyntaxMesh Console`.

The prompt is:

```text
syntaxmesh>
```

Desktop behavior:

- Enter submits one command.
- Backspace edits the current line.
- Commands execute sequentially, even if input is entered while one is running.
- `clear` clears the terminal and restores the prompt.
- `exit` closes the terminal.
- Reopening the console reuses the existing terminal unless it was closed.
- Quotes group arguments; no shell expansion occurs.

### Stdin in the Desktop console

A receiver command such as:

```text
ts receive "file:///home/me/project/master.smx" --from -
```

starts stdin collection. The terminal prints:

```text
Stdin: finish with Ctrl+D.
```

Type or paste the message, then press **Ctrl+D**. The collected text is passed to
the receiver without starting another process.

The console cannot run arbitrary programs. Pipes, redirection, environment
variable expansion, and general shell syntax are not supported.

---

## Web input console

VS Code for the Web uses an `OutputChannel` named `SyntaxMesh Console` and a
sequential input box with this prompt:

```text
SyntaxMesh>
```

Behavior:

- Output appears in the channel.
- Each submitted command finishes before the next input prompt appears.
- Cancelling the input prompt ends the current console session.
- `clear` clears the output channel.
- `exit` ends the prompt loop.
- Repeated open requests share the active prompt loop instead of creating
  competing input prompts.

### Stdin in the Web console

When a run request uses `--from -`, the extension:

1. Opens an untitled document with language `syntaxmesh`.
2. Shows it beside the editor.
3. Asks you to enter the message and choose **Use Stdin** or **Cancel**.

The untitled document's full text becomes stdin. Choosing **Cancel** abandons the
request.

---

## Console command grammar

The console has two command families.

### Semantic commands

These map directly to canonical extension commands:

```text
project <add|remove|list|set-active|refresh> [project]
report <list|render|open|export> [project] [selection]
check-ts [project] <sheet>
check-ss [project] <sheet>
compile [project] [options]
check-syntax [project] [options]
schedule-only [project] [options]
freeze [project] [options]
help
version
clear
exit
```

`check-ts` and `check-ss` also accept `--sheet`, `--project`, and `--config`.

Semantic project, sheet, configuration, and export-target arguments are passed
through to command APIs. Use absolute URI values such as
`file:///home/me/project/master.smx` to avoid host-dependent path resolution.
CLI-compatible `run` commands are the better choice for ordinary relative paths.

### CLI-compatible commands

```text
run <argv>
smx <argv>
tj3 <argv>
man [keywords] [--format text|html|smx]
ts <send|receive|summary> [project] [options]
ss <send|receive> [project] [options]
```

`run`, `smx`, and `tj3` are equivalent prefixes. They all call
`syntaxmesh.run` in process.

Bare `ts` and `ss` commands may omit the project and use the active project.
Prefixed forms such as `run ts summary` still require a positional project.

Raw extension command IDs are rejected as console input. For example, do not type
`syntaxmesh.compile`; type `compile`.

### Semantic execution options

`compile`, `check-syntax`, `schedule-only`, and `freeze` accept:

| Option                                     | Meaning                                |
| ------------------------------------------ | -------------------------------------- |
| `--project <uri>`                          | Explicit project                       |
| `--config <uri>`                           | YAML configuration                     |
| `--output-dir <uri>`, `-o <uri>`           | Execution output-directory metadata    |
| `--report <id>`                            | Exact report selection                 |
| `--reports <regex>`                        | Regex report selection                 |
| `-A <text>`, `--dynamic-attributes <text>` | Dynamic report attributes              |
| `--force-reports`, `-f`                    | Render reports despite pipeline errors |
| `--abort-on-warnings`                      | Treat warnings as errors               |
| `--warn-ts-deltas`                         | Report time-sheet deltas               |
| `--add-trace`                              | Enable trace reports                   |
| `--check-syntax`                           | Select syntax-only behavior            |
| `--no-reports`                             | Select schedule-only behavior          |
| `--freeze`                                 | Select freeze behavior                 |
| `--freeze-by-task`, `--freezebytask`       | Group freeze output by task            |
| `--freezedate <date>`                      | Freeze date                            |

Syntax-only, schedule-only, and freeze modes conflict with one another.

### Semantic report options

`report` commands accept:

| Option                                                                           | Meaning                    |
| -------------------------------------------------------------------------------- | -------------------------- |
| `--project <uri>`                                                                | Explicit project           |
| `--pattern <regex>`, `--list-reports <regex>`                                    | List filter                |
| `--report <id>`                                                                  | Exact selection            |
| `--reports <regex>`                                                              | Regex selection for render |
| `-A <text>`, `--dynamic-attributes <text>`                                       | Dynamic report attributes  |
| `--format <format>`                                                              | Export format              |
| `--target <directory-uri>`, `--output-dir <directory-uri>`, `-o <directory-uri>` | Export root                |

Examples:

```text
report list
report list --pattern "cost|task"
report render --report overview
report render --reports "cost|task"
report open
report export --report overview --format csv --target file:///home/me/reports
```

---

## CLI-compatible run reference

The extension reuses the shared CLI parser. It does not spawn `tj3`, `smx`, a
shell, or another external process.

### General forms

```text
run [options] <project.smx|project.tjp>
smx [options] <project.smx|project.tjp>
tj3 [options] <project.smx|project.tjp>
run --help
run --version
run man [keywords] [--format text|html|smx] [-o <directory-uri>]
```

### General options

| Option                                     | Meaning                                                        |
| ------------------------------------------ | -------------------------------------------------------------- |
| `-h`, `--help`                             | Show CLI-compatible help                                       |
| `-V`, `--version`                          | Show version information                                       |
| `--config <file>`                          | Load YAML configuration                                        |
| `--abort-on-warnings`                      | Treat warnings as errors                                       |
| `--check-syntax`                           | Parse without scheduling                                       |
| `--list-reports <pattern>`                 | Select/list reports by pattern                                 |
| `--no-reports`                             | Schedule without rendering reports                             |
| `--report <id>`                            | Exact report selection                                         |
| `--reports <regex>`                        | Regex report selection                                         |
| `-A <text>`, `--dynamic-attributes <text>` | Dynamic report attributes                                      |
| `-o <dir>`, `--output-dir <dir>`           | Output directory                                               |
| `-f`, `--force-reports`                    | Render reports despite errors; in sheet apps, `-f` means force |
| `--warn-ts-deltas`                         | Report time-sheet deltas                                       |
| `--add-trace`                              | Enable trace reports                                           |
| `--freeze`                                 | Enable freeze output                                           |
| `--freeze-by-task`, `--freezebytask`       | Group freeze output by task                                    |
| `--freezedate <date>`                      | Configure the freeze date                                      |
| `--check-time-sheet <file>`                | Check a time sheet                                             |
| `--check-status-sheet <file>`              | Check a status sheet                                           |
| `--silent`                                 | Suppress info/progress renderer output                         |
| `--no-color`                               | Disable ANSI color                                             |
| `--format <text                            | html                                                           |

`--debug`, `--debuglevel`, and `--debugmodules` are recognized as deferred and
fail explicitly as unavailable.

For CLI freeze, `--freeze` enables the operation; `--freezedate` and grouping
flags configure it.

### Sheet subcommands and options

```text
ts send [project] [options]
ts receive [project] [options]
ts summary [project] [options]
ss send [project] [options]
ss receive [project] [options]
```

Sheet options:

| Option                                   | Meaning                                 |
| ---------------------------------------- | --------------------------------------- |
| `-d <dir>`, `--directory <dir>`          | Sheet read/write root                   |
| `-e <date>`, `--enddate <date>`          | Period end date                         |
| `-r <id>`, `--resource <id>`             | Resource selection; repeatable          |
| `--hideresource <expr>`                  | Hidden status-sheet resource expression |
| `-i <duration>`, `--interval <duration>` | Status-sheet interval                   |
| `-t <address>`, `--to <address>`         | Add to both sheet and digest recipients |
| `--sheet <address>`                      | Individual-sheet recipient              |
| `--digest <address>`                     | Digest recipient                        |
| `--from <file                            | ->`                                     |
| `--force`                                | Re-send an existing template            |
| `--dryrun`, `--dry-run`                  | Preview without file/email artifacts    |

Examples:

```text
run "file:///home/me/project/master.smx" --check-syntax
run "file:///home/me/project/master.smx" --no-reports
run "file:///home/me/project/master.smx" -o "file:///home/me/project/reports"
run "file:///home/me/project/master.smx" --freeze --freezedate 2026-11-01 --freeze-by-task
run "file:///home/me/project/master.smx" --check-time-sheet "file:///home/me/project/TimeSheets/dev.tji"
ts summary --dry-run
run ts summary "file:///home/me/project/master.smx" --dry-run
run ts receive "file:///home/me/project/master.smx" --from "file:///home/me/project/message.eml"
```

### Path resolution

Use absolute URIs when a path is ambiguous. For CLI-compatible runs:

- The project positional path resolves against the host working directory.
- Configuration, output, sheet, and receiver paths tied to a master resolve
  against the master directory unless an explicit run context supplies another
  working directory.
- Output destinations still pass through the extension's safe output policy.

---

## Help, manuals, language, and export

### Show Help

`SyntaxMesh: Show Help` writes CLI-compatible help to `SyntaxMesh Help`, including
the `run`, `smx`, and `tj3` aliases and the current option table.

### Show Version

`SyntaxMesh: Show Version` displays the name and version returned by the core
metadata request in an information message.

### Open Manual

`SyntaxMesh: Open Manual` displays a picker of manual pages and opens the selected
page in a script-free Webview with a strict Content Security Policy.

### Open Manual Command

`SyntaxMesh: Open Manual Command` generates manual content. Supported formats are:

| Format | Behavior                                                             |
| ------ | -------------------------------------------------------------------- |
| `text` | Text in `SyntaxMesh Manual`, unless a file target is supplied        |
| `smx`  | SMX content in `SyntaxMesh Manual`, unless a file target is supplied |
| `html` | Complete manual files written under a selected directory             |

The bare console command `man` uses the CLI-compatible run path. It is distinct
from `syntaxmesh.openManual`, which browses individual manual pages.

### Export .tjp

`SyntaxMesh: Export .tjp` uses the active master, loads it if necessary, and shows
a save dialog for `.tjp` or `.smx`.

Despite the command name, it does not convert formats or flatten includes. It
writes the cached master content to the selected file.

### Switch Language

`SyntaxMesh: Switch Language` offers `en`, `pt-BR`, and `es`, then rewrites or
inserts the active document's `language` directive. It does not translate the
document.

---

## Settings

Configure settings under **Settings > Extensions > SyntaxMesh**, or use
`settings.json`:

```json
{
  "syntaxmesh.trace.server": "off",
  "syntaxmesh.maxNumberOfProblems": 100,
  "syntaxmesh.locale": "auto",
  "syntaxmesh.report.defaultFormat": "html"
}
```

| Setting                           | Default | Values                       | Behavior                                                                                      |
| --------------------------------- | ------- | ---------------------------- | --------------------------------------------------------------------------------------------- |
| `syntaxmesh.trace.server`         | `off`   | `off`, `messages`, `verbose` | Language-client/server tracing                                                                |
| `syntaxmesh.maxNumberOfProblems`  | `100`   | Integer `1`–`1000`           | Client clamps and forwards the requested diagnostic cap                                       |
| `syntaxmesh.locale`               | `auto`  | `auto`, `en`, `pt-BR`, `es`  | Default input language when no file directive is present; the file directive takes precedence |
| `syntaxmesh.report.defaultFormat` | `html`  | Non-empty format ID          | Used by the legacy Generate Report alias                                                      |

Current implementation notes:

- The client forwards `maxNumberOfProblems` during initialization, but the current
  core initialization handler does not consume it as a hard server-side cap. Do
  not rely on it as a guaranteed diagnostic limit yet.
- For deterministic input language, place a `language` directive in the project
  file or use **Switch Language**. `auto` leaves language choice to the file and
  detection logic.
- `report.defaultFormat` affects only the legacy
  `syntaxmesh.generateReport` alias. With `html`, that alias opens a report;
  otherwise it routes to report export with the configured format.

---

## Complete command reference

All 29 public commands are registered exactly once and appear under the
**SyntaxMesh** category in the Command Palette.

In the signatures below, `project` means a project-master URI, `options` means
`ExecutionCommandOptions`, and optional arguments may be omitted by UI callers.

### Project commands

| Command                        | Signature    | Purpose                                                     |
| ------------------------------ | ------------ | ----------------------------------------------------------- |
| `syntaxmesh.project.add`       | `(project?)` | Load the explicit or active master                          |
| `syntaxmesh.project.remove`    | `(project?)` | Remove a cached project; prompt if omitted                  |
| `syntaxmesh.project.list`      | `()`         | Show loaded projects in a quick pick                        |
| `syntaxmesh.project.setActive` | `(project?)` | Select the explicit, active-editor, only, or picked project |
| `syntaxmesh.project.refresh`   | `(project?)` | Re-read the explicit or active master and includes          |

### Execution and console commands

| Command                       | Signature                                    | Purpose                                           |
| ----------------------------- | -------------------------------------------- | ------------------------------------------------- |
| `syntaxmesh.compile`          | `(project?, options?)`                       | Parse, schedule, and render report data in memory |
| `syntaxmesh.checkSyntax`      | `(project?, options?)`                       | Parse only                                        |
| `syntaxmesh.scheduleOnly`     | `(project?, options?)`                       | Schedule without report rendering                 |
| `syntaxmesh.freeze`           | `(project?, freezeDate?, byTask?, options?)` | Freeze and write two artifacts beside the master  |
| `syntaxmesh.checkTimeSheet`   | `(project?, sheet?, options?)`               | Check one time sheet; prompt if omitted           |
| `syntaxmesh.checkStatusSheet` | `(project?, sheet?, options?)`               | Check one status sheet; prompt if omitted         |
| `syntaxmesh.run`              | `(argv?, context?)`                          | Execute CLI-compatible argv in process            |
| `syntaxmesh.console.open`     | `()`                                         | Open the Desktop or Web console                   |

### Sheet commands

| Command                           | Signature                      | Purpose                                    |
| --------------------------------- | ------------------------------ | ------------------------------------------ |
| `syntaxmesh.sheet.time.send`      | `(project?, options?, stdin?)` | Generate time-sheet and outbox artifacts   |
| `syntaxmesh.sheet.time.receive`   | `(project?, options?, stdin?)` | Receive a time-sheet message               |
| `syntaxmesh.sheet.time.summary`   | `(project?, options?, stdin?)` | Summarize time sheets                      |
| `syntaxmesh.sheet.status.send`    | `(project?, options?, stdin?)` | Generate status-sheet and outbox artifacts |
| `syntaxmesh.sheet.status.receive` | `(project?, options?, stdin?)` | Receive a status-sheet message             |

### Report commands

| Command                    | Signature                                                                       | Purpose                                  |
| -------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| `syntaxmesh.report.list`   | `(project?, pattern?)`                                                          | List cached reports, optionally by regex |
| `syntaxmesh.report.render` | `(project?, report?, reportsIsRegex?, dynamicAttributes?)`                      | Render data without opening or writing   |
| `syntaxmesh.report.open`   | `(project?, reportId?, dynamicAttributes?)`                                     | Render one exact report and open HTML    |
| `syntaxmesh.report.export` | `(project?, reportId?, format?, dynamicAttributes?, targetRootUri?, fileName?)` | Render and write one selected format     |

### Miscellaneous commands

| Command                      | Signature                                  | Purpose                                                 |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| `syntaxmesh.help`            | `()`                                       | Write CLI-compatible help                               |
| `syntaxmesh.version`         | `()`                                       | Show core version information                           |
| `syntaxmesh.man`             | `(format?, keywords?, targetUri?, color?)` | Generate text, SMX, or HTML manual content              |
| `syntaxmesh.exportTjp`       | `()`                                       | Save cached master content as `.tjp` or `.smx`          |
| `syntaxmesh.switchLanguage`  | `()`                                       | Rewrite/insert the active document's language directive |
| `syntaxmesh.showProjectTree` | `()`                                       | Refresh and focus Project Explorer                      |
| `syntaxmesh.openManual`      | `()`                                       | Browse manual pages in a Webview                        |

---

## Legacy and runtime-only commands

These compatibility IDs are registered at runtime but are not part of the 29
public manifest commands:

| Runtime command             | Forwards to                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `syntaxmesh.addProject`     | `syntaxmesh.project.add`                                                              |
| `syntaxmesh.reloadProject`  | `syntaxmesh.project.refresh`                                                          |
| `syntaxmesh.removeProject`  | `syntaxmesh.project.remove`                                                           |
| `syntaxmesh.listProjects`   | `syntaxmesh.project.list`                                                             |
| `syntaxmesh.generateReport` | `syntaxmesh.report.open`, or `syntaxmesh.report.export` for a non-HTML default format |
| `syntaxmesh.console.clear`  | Clears the active console adapter; runtime-only                                       |

Use the canonical IDs for new integrations.

---

## Output and overwrite behavior

The extension uses a shared confirmed output host for reports, freeze files,
manual files, sheets, and CLI-compatible runs.

Before the first real write, it:

1. Executes a side-effect-free preview.
2. Resolves and validates destinations.
3. Rejects unsafe absolute, traversal, encoded traversal, backslash, and NUL paths
   where relative paths are required.
4. Deduplicates existing destinations.
5. Requests one overwrite decision for the batch.

Choosing **Cancel** produces:

```text
SyntaxMesh: output cancelled; no files were written.
```

Artifacts are classified as reports, freeze files, manuals, sheets, email,
assets, or images. Successful runs return the real artifact destinations and
captured stdout/stderr.

On Web, writes use a stub-first strategy: an empty file is created during the
user permission window and then filled with real content. This can satisfy
browser write-permission rules without pretending the Web host has Node file
APIs.

---

## Troubleshooting

### The extension does not activate

- Open a `.smx`, `.tjp`, or `.tji` file.
- Confirm the editor language mode is **SyntaxMesh**.
- Open the SyntaxMesh **Project Explorer** view.
- Reload the VS Code window after installing a new VSIX.

### Project Explorer shows stale content

Run **Refresh Project**. The daemon has no save/change watcher. LSP diagnostics
can be current while the execution cache is stale.

### The command reports multiple loaded projects

Use **Set Active Project**, supply an explicit project URI, or remove unused
projects from the cache. The extension does not guess when multiple projects are
loaded.

### A report has no requested export format

The format must be present in that report's rendered format list. Omit the
format to see the available choices.

### The console rejects a command

- Use `compile`, not `syntaxmesh.compile`.
- Use `set-active`, not `setActive`.
- Use `check-ts` or `check-ss` for sheet checks.
- Use `ts` or `ss` for sheet applications.
- Close quotes and avoid pipes, redirection, and environment expansion.

### The Web console appears unresponsive

The Web console has one sequential input loop. Complete or cancel the current
input prompt, or submit `exit`. Opening the console again reuses the same active
loop rather than creating a second prompt.

### Navigation cannot find a symbol in another file

Open the related SyntaxMesh documents. Cross-file definition, references, and
workspace symbols use open-document analyses, not a persistent whole-workspace
index.

### Output was not written

- Check whether overwrite confirmation was cancelled.
- Verify that the destination is under an approved root.
- On Web, complete the browser/editor write-permission prompt.
- Use an absolute URI for semantic console destinations.

### Sheets were generated but no email was sent

This is expected. The extension does not use SMTP. It creates sheet and outbox
`.eml` artifacts for an external mail workflow.
