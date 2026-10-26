import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertExists, assertThrows, } from "@std/assert";
import { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportType, } from "../../src/model/report-type.ts";

describe("Project.checkReports", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-project", "Test Project", "1.0.0",);
  },);

  it("warning sem reports", () => {
    // Should not throw, just warning
    project.checkReports();
  });

  it("warning sem balance", () => {
    // Add a report without costaccount/revenueaccount
    const report = new Report(project, "report1", "Report 1", null,);
    report.set("formats", ["html",],);
    // report.typeSpec is null by default; to be accountreport, need to set
    // For this test, just ensure no crash
    project.checkReports();
  });
});

describe("Project.generateReports", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-project", "Test Project", "1.0.0",);
    // Add a report with formats
    const report = new Report(project, "report1", "Report 1", null,);
    report.set("formats", ["html",],);
  },);

  it("itera reports com formats", () => {
    // Should not throw
    project.generateReports(1,);
  });
});

describe("Project.listReports", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-project", "Test Project", "1.0.0",);
    const report = new Report(project, "report1", "Report 1", null,);
    report.set("formats", ["html",],);
  },);

  it("lista reports com id exato", () => {
    // Should not throw
    project.listReports("report1", false,);
  });

  it("lista reports com regExpMode", () => {
    project.listReports("report.*", true,);
  });
});

describe("Project.generateReport", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-project", "Test Project", "1.0.0",);
    const report = new Report(project, "report1", "Report 1", null,);
    report.set("formats", ["html",],);
  },);

  it("gera report com id exato", () => {
    project.generateReport("report1", false,);
  });

  it("gera report com regExpMode", () => {
    project.generateReport("report.*", true,);
  });

  it("gera report com formats", () => {
    project.generateReport("report1", false, ["html",],);
  });

  it("gera report com dynamicAttributes", () => {
    project.generateReport("report1", false, null, "dynamic",);
  });
});

describe("Project.enableTraceReports", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-project", "Test Project", "1.0.0",);
    const report = new Report(project, "trace1", "Trace Report", null,);
    report.typeSpec = ReportType.TraceReport;
    report.set("formats", ["html",],);
  },);

  it("habilita CSV para tracereport", () => {
    project.enableTraceReports(true,);
    const report = project.reports.get("trace1",);
    assertExists(report,);
    const formats = report.get("formats",) as unknown[];
    assertExists(formats,);
    assertEquals(formats.includes("csv",), true,);
  });

  it("desabilita CSV para tracereport", () => {
    project.enableTraceReports(true,);
    project.enableTraceReports(false,);
    const report = project.reports.get("trace1",);
    assertExists(report,);
    const formats = report.get("formats",) as unknown[];
    assertExists(formats,);
    assertEquals(formats.includes("csv",), false,);
  });
});

describe("Project.matchingReports", () => {
  let project: Project;

  beforeEach(() => {
    project = new Project("test-project", "Test Project", "1.0.0",);
    const report1 = new Report(project, "report1", "Report 1", null,);
    report1.set("formats", ["html",],);
    const report2 = new Report(project, "report2", "Report 2", null,);
    report2.set("formats", ["html",],);
    const report3 = new Report(project, "report3", "Report 3", null,);
    report3.set("formats", ["html",],);
  },);

  it("matchingReports id exato", () => {
    const matches = project.matchingReports("report1",);
    assertEquals(matches.length, 1,);
    assertEquals(matches[0], "report1",);
  });

  it("matchingReports regExp", () => {
    const matches = project.matchingReports("report.*",);
    assertEquals(matches.length, 3,);
    assertEquals(matches.includes("report1",), true,);
    assertEquals(matches.includes("report2",), true,);
    assertEquals(matches.includes("report3",), true,);
  });
});
