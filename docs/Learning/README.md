# TaskJuggler Learning & Experiments

[](https://creativecommons.org/licenses/by-sa/4.0/)

This repository documents my journey learning **TaskJuggler (v3.8.4)** on Windows. It contains incremental Minimal Working Examples (MWEs), installation notes, and a detailed log of lessons learned (specifically regarding syntax changes from older versions). It is intended as a reference for setting up project management as code.

## 1\. Installation Guide (Windows)

This project uses the Ruby gem version of TaskJuggler.

### Prerequisites

  * **Ruby:** Installed via Winget.
  * **TaskJuggler Gem:** Installed via RubyGems.

### Installation Steps

Run the following commands in your Command Prompt (`cmd`) or PowerShell:

```powershell
# 1. Install Ruby with DevKit (Version 3.4+)
winget install --id RubyInstallerTeam.RubyWithDevKit.3.4

# 2. Update your current shell environment (or restart terminal)
refreshenv

# 3. Install the TaskJuggler gem
gem install taskjuggler
```

### Verification

Verify the installation by checking the version:

```cmd
tj3 --version
```

*Expected output: `TaskJuggler v3.8.4` (or newer)*

-----

## 2\. Repository Structure

The repository is organized into incremental learning steps.

```text
.
├── mwe001/              # The "Hello World"
│   ├── tutorial.tjp     # Basic project with 3 dependent tasks
│   └── Plan.html        # Generated Gantt chart
│
├── mwe002/              # Regression Test (Issue #300)
│   ├── tutorial.tjp     # Reproduction code for Ruby 3.4.0 crash
│   └── tasks.html       # Confirmation of fix in v3.8.4
│
├── mwe003/              # Hierarchy & WBS
│   ├── tutorial.tjp     # Nested tasks, relative dependencies (!), milestones
│   └── WBS.html         # Hierarchical report
│
├── mwe004/              # Financials & Resources
│   ├── tutorial.tjp     # Accounts, Rates, Revenue, P&L
│   ├── PnL.html         # Profit and Loss Statement
│   └── Resources.html   # Resource cost breakdown
│
├── mwe005/              # Scheduling & Availability
│   ├── tutorial.tjp     # Shifts, Global Vacation, Task Priorities
│   ├── Schedule.html    # Calendar view of tasks
│   └── ResourceSchedule.html # View of part-time vs full-time loads
│
├── mwe006/              # Project Tracking (Plan vs Actual)
│   ├── tutorial.tjp     # Bookings, Completion, Status Reporting
│   └── StatusReport.html # Progress report showing % complete and effort left
│
├── mwe007/              # Data Export
│   ├── tutorial.tjp     # Exporting data to other formats
│   ├── ExportCSV.csv    # Comma-Separated Values for Excel
│   └── ExportCalendar.ics # iCalendar file for Outlook/Google
│
├── mwe008/              # Scenarios (Baseline vs Actual)
│   ├── tutorial.tjp     # Defining hierarchical scenarios
│   ├── PlanView.html    # View of the baseline
│   ├── DelayedView.html # View of the delayed scenario
│   └── Comparison.html  # Gantt chart visually comparing both
│
├── mwe009/              # Macros (Templates)
│   ├── tutorial.tjp     # Defining reusable code blocks with arguments
│   └── MacroResult.html # Resulting project generated from templates
│
└── README.md            # This documentation
```

-----

## 3\. Minimal Working Examples (MWEs)

### MWE 001: The Basics

**Focus:** Basic syntax, simple dependencies, and HTML generation.

  * **Key Concepts:** `project`, `resource`, `task`, `depends`, `taskreport`.

### MWE 002: Regression Testing

**Focus:** Verifying stability on Ruby 3.4.

  * **Context:** Confirmed that the `chart` column and `weekly` calendar view no longer cause fatal crashes in TaskJuggler v3.8.4.

### MWE 003: Hierarchy (WBS)

**Focus:** Organizing large projects.

  * **Key Concepts:**
      * **Nested Tasks:** Grouping tasks into phases.
      * **Milestones:** Zero-duration markers (`milestone`).
      * **Relative Dependencies:** Using `depends !task` to refer to sibling tasks without knowing the absolute path.

### MWE 004: Cost & Revenue

**Focus:** Accounting and Resource Rates.

  * **Key Concepts:**
      * **Accounts:** Creating buckets for `cost` and `revenue`.
      * **Charges:** Assigning labor costs via `chargeset` and fixed payments via `charge`.
      * **Balance:** Calculating profit in reports.

### MWE 005: Scheduling & Availability

**Focus:** Controlling *time*.

  * **Key Concepts:**
      * **`vacation`:** Global holidays (e.g., Labor Day).
      * **`workinghours`:** Defining specific working schedules (e.g., Part-Time).
      * **`priority`:** Resolving resource conflicts (Higher priority tasks get resources first).

### MWE 006: Project Tracking

**Focus:** Monitoring progress ("Plan vs. Actual").

  * **Key Concepts:**
      * **`now`:** Setting the current date for status calculation.
      * **`complete`:** Manually setting percentage done (Simple method).
      * **`booking`:** Recording exact hours worked by a resource (Timesheet method).
      * **`supplement`:** Adding data (like bookings) to an existing resource later in the file.
      * **Tracking Columns:** `effortdone`, `effortleft`, `complete`, `status`.

### MWE 007: Data Export

**Focus:** Interoperability with other tools.

  * **Key Concepts:**
      * **`formats csv`:** Generating raw data for spreadsheets.
      * **`icalreport`:** Creating `.ics` calendar files.

### MWE 008: Scenarios

**Focus:** Baselines and "What-if" analysis.

  * **Key Concepts:**
      * **`scenario`:** Defining distinct project versions.
      * **Scenario Hierarchy:** There can be only **one** top-level scenario. All others (like 'delayed', 'testing') must be nested inside the main one.
      * **Prefixes:** Using `scenario_id:attribute` (e.g., `delayed:effort 8d`) to vary data per scenario.
      * **`scenarios` (in Report):** Listing multiple scenarios to visualize slippage (Top bar vs. Bottom bar).

### MWE 009: Macros

**Focus:** Automation and Templates.

  * **Key Concepts:**
      * **`macro`:** Defining a reusable block of code.
      * **`[...]`:** Macros use square brackets to define the body.
      * **Arguments:** Using `${1}`, `${2}` inside a macro to create dynamic templates.
      * **Macro Limitations:** You cannot append properties (like `depends`) to a task generated by a macro *after* sub-tasks have been defined inside that macro. You must pass dependencies as arguments *into* the macro.

-----

## 4\. Lessons Learned (Troubleshooting Log)

This section documents errors encountered due to outdated documentation (TaskJuggler 2.x) and the correct TaskJuggler 3.x solutions.

### 🛑 Error: "The keyword 'account' is no longer supported"

  * **Context:** Inside a `task` definition.
  * **Fix:** Replace `account <id>` with **`chargeset <id>`**.
  * **Why:** In TJ3, `chargeset` is used to map calculated labor costs (effort \* rate) to an account.

### 🛑 Error: "Unexpected token 'rev' found" (Charge syntax)

  * **Context:** Defining a fixed payment, e.g., `charge 5000.0 rev`.
  * **Fix:** The account is not specified in the charge line. It is inferred from the task's `chargeset`. Also, timing is required.
      * **Old (TJ2):** `endcredit 5000.0` or `charge 5000.0 rev`
      * **New (TJ3):**
        ```taskjuggler
        chargeset rev          # 1. Define the bucket
        charge 5000.0 onend    # 2. Define amount and timing
        ```

### 🛑 Error: "Unexpected token 'total' found" (Report Columns)

  * **Context:** In `accountreport`, defining `columns name, total`.
  * **Fix:** The `total` column keyword is removed. Use `monthly`, `weekly`, or `yearly`.

### 🛑 Warning: "Report has no 'balance' defined"

  * **Context:** A `resourcereport` asking for `cost` or `revenue` columns but showing empty zeros.
  * **Fix:** You must explicitly tell the report which accounts to calculate.
  * **Solution:** Add `balance cost rev` (or whatever your root accounts are named) inside the report definition.

### 🛑 Error: "Unexpected token 'vacation' found"

  * **Context:** Defining `vacation` inside the `project { ... }` block.
  * **Fix:** Move `vacation` **outside** the project block (Global Scope).

### 🛑 Warning: "The keyword 'shift' has been deprecated"

  * **Context:** Using `shift id { ... }` and assigning it to resources.
  * **Fix:** Define `workinghours` directly inside the `resource` block.

### 🛑 Error: "Unexpected token [Date] found. Expecting :ID" (Booking syntax)

  * **Context:** Using `booking` inside a resource supplement.
  * **Fix:** Swap the order of arguments.
      * **Old (TJ2):** `booking <start> <end> <task>`
      * **New (TJ3):** `booking <task> <start> - <end>` (Note the hyphen\!)

### 🛑 Error: "Unexpected token 'columns' found"

  * **Context:** Nesting `columns` inside the `chart` column definition.
  * **Fix:** Flatten the column list. All columns must be listed at the top level of the `columns` attribute in the report.

### 🛑 Error: "Unexpected token 'mspxml' found"

  * **Context:** Trying `formats mspxml` for MS Project export.
  * **Fix:** This format is not supported in the standard gem distribution. Use `csv` for data export instead.

### 🛑 Error: "Unknown scenario: [name]"

  * **Context:** Defining multiple top-level scenarios (e.g., `scenario plan`, `scenario delayed`).
  * **Fix:** TaskJuggler allows only **one** top-level scenario. Define your baseline as the top-level scenario and nest all alternative scenarios inside it.
  * **Note:** `plan` is a reserved name. Use `baseline` or another name for your root scenario.

### 🛑 Error: "Unexpected token '{' found" (Modifying tasks)

  * **Context:** Trying to modify a task by re-stating `task id { ... }`.
  * **Fix:** Once a task is defined, you cannot use the `task` keyword again for it. Use **`supplement task id { ... }`** at the global scope instead.

### 🛑 Error: "The attribute depends may not be used ... after sub properties"

  * **Context:** Adding a dependency to a task *after* sub-tasks were defined (common when using macros).
  * **Fix:** Pass the dependency string into the macro as an argument so it is placed *before* the sub-tasks are created.

### 🛑 Error: "User defined attributes IDs must start with a capital letter"

**Context:** Trying to define a custom attribute to track budget:

```taskjuggler
extend task {
  reference effort_budget "Budget" # Error
}
```

**Solution:** TaskJuggler enforces **Capitalized** IDs for user-defined attributes.

```taskjuggler
extend task {
  reference Effort_budget "Budget" # Correct
}
```

### 🛑 Error: "Unexpected token '20' found. Expecting :STRING"

**Context:** Trying to assign a value to a `reference` attribute: `Effort_budget 20h`.
**Solution:** The `reference` type expects an ID of another object (like a resource or task). To store arbitrary strings (like "20h" or "€500"), change the type to `text` and ensure the value is in quotes.

```taskjuggler
extend task {
  text Effort_budget "Budget" # Use 'text' for strings
}
task example {
  Effort_budget "20h"         # Must be quoted
}
```

### 🛑 Error: "Unexpected token 'purposes' found"

**Context:** Using the `purposes` keyword inside a task definition (found in some older documentation or examples).

```taskjuggler
task t1 "Setup" {
  purposes "admin" # Error
}
```

**Solution:** This keyword is not valid in TaskJuggler v3.8. Remove it. If you need to tag tasks, use `flags` instead.

### 🛑 Error: "Unexpected token 'columns' found" (inside `export`)

**Context:** Trying to generate a CSV with specific columns using the `export` block:

```taskjuggler
export "MyData" {
  formats csv
  columns name, effort # Error! 'export' does not support 'columns'
}
```

**Solution:** The `export` block is designed for full structural dumps (e.g., to MS Project XML or TJP files) and does not allow column customization. To generate a **Custom CSV**, you must use `taskreport` with the `csv` format.

```taskjuggler
taskreport "MyData" {
  formats csv
  columns name, effort # Works perfectly here
}
```

-----

## 5\. Key Syntax Reference

Updated cheat sheet for TaskJuggler 3.8.x.

| Keyword        | Context     | Usage                                                       |
| :------------- | :---------- | :---------------------------------------------------------- |
| `project`      | Global      | `project id "Name" "Ver" Start - End { ... }`               |
| `resource`     | Global      | `resource id "Name" { rate 400.0 }`                         |
| `account`      | Global      | `account id "Name" { ... }`                                 |
| `task`         | Global/Task | `task id "Name" { ... }`                                    |
| `depends`      | Task        | `depends !sibling_id` or `depends !!cousin_id`              |
| `chargeset`    | Task        | `chargeset account_id` (Where costs/revenue go)             |
| `charge`       | Task        | `charge 500.0 onend` (Fixed cost/revenue)                   |
| `priority`     | Task        | `priority 1000` (Higher wins conflicts)                     |
| `vacation`     | Global      | `vacation "Name" YYYY-MM-DD`                                |
| `workinghours` | Global/Res  | `workinghours mon - fri 9:00 - 17:00`                       |
| `balance`      | Report      | `balance cost_acc rev_acc` (Required for financial columns) |
| `booking`      | Resource    | `booking task_id YYYY-MM-DD-HH:MM - YYYY-MM-DD-HH:MM`       |
| `complete`     | Task        | `complete 100` (Simple progress tracking)                   |
| `journalentry` | Task        | `journalentry YYYY-MM-DD "Note"`                            |
| `icalreport`   | Global      | `icalreport "Name" { ... }`                                 |
| `scenario`     | Global      | `scenario id "Name" { ... }`                                |
| `scenarios`    | Report      | `scenarios baseline, delayed` (Selects scenarios to view)   |
| `macro`        | Global      | `macro id [ ... ]`                                          |
| `supplement`   | Global      | `supplement task id { ... }` (Modify existing object)       |

-----

## 6\. How to Run

1.  Navigate to the specific MWE folder.
2.  Run the compiler:
    ```cmd
    tj3 tutorial.tjp
    ```
3.  Open the generated `.html` files in your browser.
4.  To create a PDF, use the browser's **Print \> Save as PDF** feature.

-----

## 7\. License

This documentation and the accompanying examples are licensed under the **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.

You are free to:

  * **Share** — copy and redistribute the material in any medium or format.
  * **Adapt** — remix, transform, and build upon the material for any purpose, even commercially.

Under the following terms:

  * **Attribution** — You must give appropriate credit.
  * **ShareAlike** — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.
