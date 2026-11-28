/** Canonical Desktop/Web command-wiring regressions for 22.12.19. */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";

const SRC = new URL("../../src/", import.meta.url,);

/** Reads one source module as text without importing the VS Code runtime. */
function source(path: string,): string {
  return Deno.readTextFileSync(new URL(path, SRC,),);
}

describe("canonical command wiring", () => {
  it("constructs the project service only in the shared registrar", () => {
    const registrar = source("commands/register.ts",);
    assert(registrar.includes("new ProjectService(",),);
    for (
      const path of [
        "commands/daemon.ts",
        "commands/execution.ts",
        "commands/reports.ts",
        "commands/misc.ts",
      ]
    ) {
      assert(
        !source(path,).includes("new ProjectService(",),
        `${path} must consume the shared service`,
      );
    }
  });

  it("keeps command groups on the shared registry", () => {
    for (
      const path of [
        "commands/daemon.ts",
        "commands/execution.ts",
        "commands/reports.ts",
        "commands/misc.ts",
      ]
    ) {
      const text = source(path,);
      assert(text.includes("registry: CommandRegistry",), path,);
      assert(!text.includes("commands.registerCommand(",), path,);
      assert(!text.includes("createConfirmedOutputHost(",), path,);
      assert(!text.includes("createTj3HostIo(",), path,);
    }
  });

  it("routes both extension entries through the same registrar", () => {
    for (const path of ["extension.node.ts", "extension.web.ts",]) {
      const text = source(path,);
      assert(text.includes("registerCanonicalCommands(",), path,);
      for (
        const retired of [
          "registerDaemonCommands",
          "registerExecutionCommands",
          "registerReportCommands",
          "registerMiscCommands",
          "registerConsoleCommands",
        ]
      ) {
        assert(!text.includes(retired,), `${path} still calls ${retired}`,);
      }
    }
  });

  it("registers the five canonical project commands without legacy ids", () => {
    const projects = source("commands/daemon.ts",);
    for (
      const id of [
        "syntaxmesh.project.add",
        "syntaxmesh.project.remove",
        "syntaxmesh.project.list",
        "syntaxmesh.project.setActive",
        "syntaxmesh.project.refresh",
      ]
    ) {
      assert(
        projects.includes(id,),
        `${id} must be registered by the project group`,
      );
    }
    for (
      const id of [
        "syntaxmesh.addProject",
        "syntaxmesh.reloadProject",
        "syntaxmesh.removeProject",
        "syntaxmesh.listProjects",
      ]
    ) {
      assert(!projects.includes(id,), `${id} must be a runtime alias`,);
    }
  });

  it("keeps legacy report routing out of the report group", () => {
    const reports = source("commands/reports.ts",);
    assert(!reports.includes('"syntaxmesh.generateReport"',),);
    assert(!reports.includes("host.core.listReports",),);
    assert(!reports.includes("report.defaultFormat",),);
  });

  it("creates one output host per activation and injects it into the presenter", () => {
    for (const path of ["extension.node.ts", "extension.web.ts",]) {
      const text = source(path,);
      assertEquals(
        text.match(/createConfirmedOutputHost\(/g,)?.length,
        1,
        path,
      );
      assert(text.includes("new ReportPresenter(context, output,)",), path,);
      assert(text.includes("registerCanonicalCommands(context, {",), path,);
    }
    const presenter = source("reports/host.ts",);
    assert(
      !presenter.includes("this.output = createConfirmedOutputHost(",),
      "the presenter must not construct a second output host",
    );
  });

  it("presents structured execution results instead of discarding them", () => {
    const execution = source("commands/execution.ts",);
    assert(execution.includes("presentExecutionResult(",),);
    assert(!execution.includes("function present(",),);
    assertEquals(execution.includes("Promise<void>",), false,);
  });

  it("routes sheet commands through the canonical project resolver", () => {
    const execution = source("commands/execution.ts",);
    assert(
      execution.includes("dependencies.resolveProject(explicit, false,)",),
      "sheet commands must resolve active editors and load uncached masters",
    );
    assert(
      !execution.includes(
        "resolveProject: (explicit,) => service.resolveProject",
      ),
      "sheet commands must not bypass the activation resolver",
    );
  });
});
