> **INSTRUÇÃO PARA A IA:** 
> O texto abaixo contém um snapshot de arquivos de projetos do taskjuggler, para treinamento.
> O projeto é o **SyntaxMesh ** estruturado em blocos. 
> Cada arquivo começa com um título indicando seu caminho relativo exato (ex: `## Arquivo: src/main.ts`).
> Sempre que sugerir alterações, indique claramente qual arquivo deve ser modificado com base nesses caminhos e forneça o novo código completo do arquivo.

---

# Contexto Exportado do Projeto SyntaxMesh - Modo: LEARNING

Gerado automaticamente em: 9/10/2026, 6:35:10 PM

---

## Arquivo: `docs/Learning/README.md`

````md
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

````

---

## Arquivo: `docs/Learning/mwe001/tutorial.tjp`

```tjp
/* 1. Project Header: ID, Name, Version, and Timeframe */
project prj "My First Project" "1.0" 2024-06-01 - 2024-06-30 {
  timeformat "%Y-%m-%d"
  now 2024-06-01
}

/* 2. Resources: Who is doing the work? */
resource dev "Foad"

/* 3. Tasks: What needs to be done? */
task main "Main Project" {
  
  task t1 "Design Phase" {
    effort 2d       # Takes 2 days of work
    allocate dev    # Assigned to Foad
  }

  task t2 "Implementation" {
    effort 3d
    allocate dev
    depends !t1     # Cannot start until t1 is finished
  }

  task t3 "Testing" {
    effort 1d
    allocate dev
    depends !t2     # Cannot start until t2 is finished
  }
}

/* 4. Reports: Define what you want to see */
taskreport "Plan" {
  formats html
  headline "My Project Gantt Chart"
  
  # The 'chart' column generates the visual Gantt bars
  columns bsi { title 'WBS' }, name, start, end, chart
}
```

---

## Arquivo: `docs/Learning/mwe002/tutorial.tjp`

```tjp
project migration "Project" "1.0" 2024-07-15 - 2024-08-15 {
  now 2024-07-15
  timeformat "%Y-%m-%d"
  numberformat "-" "" "." "," 2
  workinghours mon - fri 8:00 - 12:00, 13:00 - 17:00
}

# Resource with detailed configuration
resource dev "Developer"

# Task hierarchy with dependencies
task project_root "Project Root" {
  task phase1 "Phase 1" {
    task p1s1 "Task 1.1" {
      effort 1d
      allocate dev
    }
    task p1s2 "Task 1.2" {
      depends !p1s1
      effort 2d
      allocate dev
    }
  }

  task phase2 "Phase 2" {
    depends !phase1
    task p2s1 "Task 2.1" {
      effort 1d
      allocate dev
    }
  }
}

# Report that causes the issue (Chart column)
taskreport "tasks" {
  headline "Task Plan"
  formats html
  columns name, start, end, chart  # This column caused the error in 3.8.1
  hideresource 0
}

# Resource report that may also cause issues (Calendar view)
resourcereport "resources" {
  headline "Resource Allocation"
  formats html
  columns name, weekly  # Calendar view caused issues in 3.8.1
  loadunit days
  hidetask 0
}

```

---

## Arquivo: `docs/Learning/mwe003/tutorial.tjp`

```tjp
project prj "Hierarchical Project" "1.0" 2024-07-01 - 2024-07-31 {
  timeformat "%Y-%m-%d"
  now 2024-07-01
}

/* 1. Hierarchical Resources */
resource team "Development Team" {
  resource alice "Alice"
  resource bob "Bob"
}

/* 2. Hierarchical Tasks (WBS) */
task deliverable "Software Release 1.0" {

  /* Phase 1: Preparation */
  task phase1 "Preparation" {

    task t1 "Requirements" {
      effort 3d
      allocate alice
    }

    task t2 "Architecture" {
      effort 2d
      allocate bob
      depends !t1   # The '!' means "look for 't1' inside the current parent (phase1)"
    }
  }

  /* Key Event: Milestone */
  task m1 "Design Approved" {
    milestone       # Zero duration, just a marker
    depends !phase1 # Waits for the entire phase1 to finish
  }

  /* Phase 2: Execution */
  task phase2 "Implementation" {
    depends !m1     # Wait for approval

    task t3 "Coding" {
      effort 5d
      allocate alice, bob
    }
  }
}

/* 3. Hierarchical Report */
taskreport "WBS" {
  formats html
  headline "Work Breakdown Structure"

  # 'bsi' (Breakdown Structure Index) shows the hierarchy numbers (1.1, 1.2, etc.)
  columns bsi, name, start, end, effort, chart
}

```

---

## Arquivo: `docs/Learning/mwe004/tutorial.tjp`

```tjp
project prj "Cost & Resource Project" "1.0" 2024-08-01 - 2024-08-31 {
  timeformat "%Y-%m-%d"
  now 2024-08-01
  currency "USD"
}

/* 1. Accounts */
account cost "Project Expenses" {
  account salaries "Salaries"
}

account rev "Project Revenue"

/* 2. Resources with Rates */
resource dev "Developers" {
  resource alice "Alice" {
    rate 400.0
  }
  resource bob "Bob" {
    rate 300.0
  }
}

/* 3. The Project Tasks */
task project "Paid Project" {

  /* All tasks charge their calculated labor cost to 'salaries' */
  chargeset salaries

  task t1 "Specification" {
    effort 2d
    allocate alice
  }

  task t2 "Development" {
    effort 5d
    allocate bob
    depends !t1
  }

  /* Task 3: The actual work */
  task t3 "Delivery Work" {
    effort 1d
    allocate alice, bob
    depends !t2
  }

  /* Task 4: The Payment Event */
  task t4 "Payment Received" {
    milestone
    depends !t3

    /* Switch the account bucket for this specific task to 'rev' */
    chargeset rev

    /* Book a fixed amount upon completion */
    charge 5000.0 onend
  }
}

/* 4. Financial Report */
accountreport "PnL" {
  formats html
  headline "Profit and Loss Statement"

  /* FIX: 'total' is removed.
     'monthly' shows the data for each month.
     'balance cost rev' calculates Revenue - Cost for those cells. */
  columns name, monthly

  balance cost rev
}

/* 5. Resource Usage Report */
resourcereport "Resources" {
  formats html
  headline "Resource Costs"
  columns name, effort, cost, revenue

  /* FIX: Define the balance so TJ knows how to compute the cost/revenue columns */
  balance cost rev
}

```

---

## Arquivo: `docs/Learning/mwe005/tutorial.tjp`

```tjp
project prj "Scheduling Project" "1.0" 2024-09-01 - 2024-09-30 {
  timeformat "%Y-%m-%d"
  now 2024-09-01
  currency "USD"

  /* 1. Global Working Hours */
  # Define a standard 9-5 workday inside the project block
  workinghours mon - fri 9:00 - 12:00, 13:00 - 17:00
  workinghours sat, sun off
}

/* FIX: 'vacation' must be outside the project block */
# A project-wide holiday (no one works)
vacation "Labor Day" 2024-09-02

/* 3. Resources */
resource team "Team" {

  resource alice "Alice (Full Time)" {
    # Alice uses the global default (Mon-Fri 9-5)
  }

  resource bob "Bob (Part Time)" {
    # FIX: 'shift' is deprecated. Define specific workinghours directly.
    # This overrides the global default for Bob.
    workinghours mon, tue, wed 9:00 - 13:00
    workinghours thu, fri off
  }
}

/* 4. Tasks with Priorities */
task deliverable "Feature Release" {

  /* High Priority Task: Must happen first/fastest */
  task urgent "Urgent Core" {
    priority 1000        # Highest priority (1000)
    effort 3d
    allocate alice
  }

  /* Low Priority Task: Only happens when Alice is free */
  task filler "Documentation" {
    priority 100         # Low priority
    effort 2d
    allocate alice

    # Even though this task could technically start now,
    # Alice is busy with "Urgent Core". TJ will delay this
    # until the high-priority task is done.
  }

  /* Part-time Task: Will take longer in calendar days */
  task side "Side Project" {
    effort 12h           # 12 hours of work
    allocate bob

    # Since Bob only works 4 hours/day, Mon-Wed,
    # this 12h task will span 3 calendar working days
    # (or more if a weekend/holiday intervenes).
  }
}

/* 5. Calendar Report (Visualizing the Schedule) */
taskreport "Schedule" {
  formats html
  headline "Project Schedule"

  # 'daily' column shows a grid for every day
  columns bsi, name, start, end, daily
}

/* 6. Resource Schedule */
resourcereport "ResourceSchedule" {
  formats html
  headline "Who is working when?"

  # See exactly which hours are booked
  columns name, weekly, daily
}

```

---

## Arquivo: `docs/Learning/mwe006/tutorial.tjp`

```tjp
project prj "Tracking Progress" "1.0" 2024-10-01 - 2024-10-31 {
  timeformat "%Y-%m-%d"

  # IMPORTANT: 'now' simulates the current date.
  # We assume we are in the middle of the project (Oct 15th).
  now 2024-10-15
  currency "USD"
}

/* 1. Resources */
resource dev "Developer" {
  rate 400.0
}

/* 2. Tasks (The Plan) */
task project "Software Project" {

  task t1 "Requirements" {
    # This task was scheduled for the first week
    start 2024-10-01
    effort 5d
    allocate dev

    # Method A: Simple Completion
    # We simply state this task is 100% finished.
    complete 100
  }

  task t2 "Implementation" {
    # This task starts after t1
    depends !t1
    effort 10d
    allocate dev

    # Journal entries help document *why* things happened
    journalentry 2024-10-10 "Started implementation phase"
  }
}

/* 3. Tracking Actuals (The Reality) */
# We use 'supplement' to add bookings to the resource defined above.
# This simulates importing a timesheet.
supplement resource dev {

  # Syntax: booking <task_id> <start> - <end>
  # 'dev' worked 3 days on 't2' so far.
  booking project.t2 2024-10-08-09:00 - 2024-10-08-17:00
  booking project.t2 2024-10-09-09:00 - 2024-10-09-17:00
  booking project.t2 2024-10-10-09:00 - 2024-10-10-17:00
}

/* 4. Status Report */
taskreport "StatusReport" {
  formats html
  headline "Project Status Report (as of 2024-10-15)"

  # FIX: Flatten the column list. Do not nest columns inside 'chart'.
  columns bsi, name, start, end, effort, effortdone, effortleft, complete, status, chart
}

```

---

## Arquivo: `docs/Learning/mwe007/tutorial.tjp`

```tjp
project prj "Data Export" "1.0" 2024-11-01 - 2024-11-30 {
  timeformat "%Y-%m-%d"
  now 2024-11-01
  currency "USD"
}

resource dev "Developer"

task project "Export Demo" {
  task t1 "Design" {
    start 2024-11-01
    effort 3d
    allocate dev
  }

  task t2 "Implementation" {
    depends !t1
    effort 5d
    allocate dev
  }

  task t3 "Meeting" {
    depends !t2
    effort 4h
    allocate dev
  }
}

/* 1. CSV Report (For Excel/Spreadsheets) */
taskreport "ExportCSV" {
  formats csv
  columns id, name, start, end, effort
}

/* 2. iCalendar Report (For Outlook/Google Calendar) */
icalreport "ExportCalendar" {
  # We will export all tasks.
  # Note: The 'hidetask' filter is removed to ensure compatibility.
  hidetask 0
}

```

---

## Arquivo: `docs/Learning/mwe008/tutorial.tjp`

```tjp
project prj "Scenario Planning" "1.0" 2024-12-01 - 2024-12-31 {
  timeformat "%Y-%m-%d"
  now 2024-12-01
  currency "USD"

  /* 1. Define Scenarios (Hierarchical) */
  # FIX: Only ONE top-level scenario allowed.
  scenario baseline "Original Plan" {

    # 'delayed' is a sub-scenario. It inherits everything from 'baseline'.
    scenario delayed "Delayed Reality" {
    }
  }
}

resource dev "Developer"

/* 2. Tasks with Scenario-Specific Data */
task project "Scenario Demo" {

  task t1 "Design" {
    allocate dev
    start 2024-12-01

    # FIX: No prefix needed for the top-level scenario ('baseline')
    effort 5d

    # Specific override for the 'delayed' scenario
    delayed:effort 8d
  }

  task t2 "Implementation" {
    allocate dev
    depends !t1
    effort 10d
  }
}

/* 3. Comparison Reports */

# Report A: Showing the Baseline
taskreport "PlanView" {
  formats html
  headline "Original Plan (Baseline)"
  columns bsi, name, start, end, effort, chart

  # Show the top-level scenario
  scenarios baseline
}

# Report B: Showing the Delay
taskreport "DelayedView" {
  formats html
  headline "Delayed Reality"
  columns bsi, name, start, end, effort, chart

  # Show the sub-scenario
  scenarios delayed
}

# Report C: The Comparison
taskreport "Comparison" {
  formats html
  headline "Baseline vs. Delay Comparison"

  # FIX: Compare parent and child scenarios
  scenarios baseline, delayed

  columns bsi, name, start, end, effort, chart
}

```

---

## Arquivo: `docs/Learning/mwe009/tutorial.tjp`

```tjp
project prj "Macros Demo" "1.0" 2024-12-01 - 2024-12-31 {
  timeformat "%Y-%m-%d"
  now 2024-12-01
  currency "USD"
}

/* 1. Resources */
resource dev1 "Alice"
resource dev2 "Bob"
resource qa1 "Charlie"

/* 2. Define Macros (Templates) */

# Macro A: Simple Text Replacement
macro assign_team [
  allocate dev1
  allocate dev2
]

# Macro B: Parameterized Task Template
# ${1} = Task ID
# ${2} = Task Name
# ${3} = Effort
# ${4} = Extra attributes (Dependencies, etc.) - INSERTED FIRST
macro feature_task [
  task ${1} "${2}" {
    # FIX: Insert dependencies here, BEFORE defining sub-tasks
    ${4}

    # Sub-task 1: Implementation
    task impl "Implementation" {
      effort ${3}d
      ${assign_team}
    }

    # Sub-task 2: Testing
    task test "QA Testing" {
      depends !impl
      effort 1d
      allocate qa1
    }
  }
]

/* 3. Using Macros in the Project */
task project "Software Release" {

  # Feature A: No dependencies.
  # We pass an empty string "" as the 4th argument.
  ${feature_task "feat_a" "Login System" "5" ""}

  # Feature B: Depends on Feature A.
  # We pass the dependency string as the 4th argument.
  ${feature_task "feat_b" "User Profile" "3" "depends !feat_a"}
}

/* 4. Report */
taskreport "MacroResult" {
  formats html
  headline "Project Generated via Macros"
  columns bsi, name, start, end, effort, chart
}

```

---

