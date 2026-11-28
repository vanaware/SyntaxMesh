/**
 * Artifact classification tests for the shared extension output host.
 *
 * Classification consumes only execution data, resolved destination URIs and
 * real copy operations. It never exposes VS Code host objects.
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type {
  ExecutionOptionsEcho,
  ExecutionResult,
  ExecutionResults,
} from "@vanaware/syntaxmesh";
import { classifyArtifacts, } from "../../src/cli/artifacts.ts";

/** Builds a complete execution envelope with harmless defaults. */
function envelope(results: ExecutionResults,): ExecutionResult {
  const options: ExecutionOptionsEcho = {
    entry: "master.smx",
    files: ["master.smx",],
    configContent: null,
    checkSyntax: false,
    listReports: null,
    listReportsIsRegex: false,
    report: null,
    reportsIsRegex: false,
    dynamicAttributes: null,
    outputDir: null,
    noReports: false,
    forceReports: false,
    abortOnWarnings: false,
    warnTsDeltas: false,
    addTrace: false,
    freeze: null,
    help: false,
    version: false,
    man: null,
    app: null,
    appOptions: null,
  };
  return { ok: true, exitCode: 0, options, messages: [], results, };
}

/** Resolves a path under a directory URI without changing the URI shape. */
function under(root: string, path: string,): string {
  return new URL(path, `${root.replace(/\/$/, "",)}/`,).toString();
}

describe("classifyArtifacts", () => {
  it("classifies every output kind from explicit destinations and copy sources", () => {
    const outputDir = "file:///workspace/out";
    const assetsRoot = "file:///workspace/assets";
    const imageDir = "file:///workspace/images";
    const sheetRoot = "file:///workspace/sheets";
    const report = under(outputDir, "Tasks.csv",);
    const header = "file:///workspace/freeze/master-header.tji";
    const bookings = "file:///workspace/freeze/master-bookings.tji";
    const manual = under(outputDir, "guide/index.html",);
    const sheet = under(sheetRoot, "TimeSheets/dev.tji",);
    const email = under(sheetRoot, "outbox/001-dev@example.com.eml",);
    const asset = under(outputDir, "css/tjreport.css",);
    const image = under(outputDir, "icons/logo.png",);
    const execution = envelope({
      freeze: {
        files: [
          { fileName: header, contents: "now\n", },
          { fileName: bookings, contents: "", },
        ],
      },
      man: {
        format: "html",
        keywords: [],
        content: "",
        files: [{ name: "guide/index.html", contents: "<h1>Manual</h1>", },],
      },
      sheet: {
        app: "ts-summary",
        files: [{ name: sheet, contents: "timesheet dev\n", },],
        emails: [{
          to: "dev@example.com",
          subject: "Summary",
          text: "Subject: Summary\n",
        },],
      },
    },);

    assertEquals(
      classifyArtifacts(
        execution,
        [report, header, bookings, manual, sheet, email, asset, image,],
        [
          { from: under(assetsRoot, "css/tjreport.css",), to: asset, },
          { from: under(imageDir, "icons/logo.png",), to: image, },
        ],
        { outputDir, assetsRoot, imageDir, },
      ),
      [
        { uri: report, fileName: "Tasks.csv", kind: "report", },
        { uri: header, fileName: "master-header.tji", kind: "freeze", },
        { uri: bookings, fileName: "master-bookings.tji", kind: "freeze", },
        { uri: manual, fileName: "index.html", kind: "manual", },
        { uri: sheet, fileName: "dev.tji", kind: "sheet", },
        { uri: email, fileName: "001-dev@example.com.eml", kind: "email", },
        { uri: asset, fileName: "tjreport.css", kind: "asset", },
        { uri: image, fileName: "logo.png", kind: "image", },
      ],
    );
  });

  it("prefers explicit sheet destinations over the outbox filename convention", () => {
    const sheet = "file:///workspace/sheets/outbox/001-dev@example.com.eml";
    const execution = envelope({
      sheet: {
        app: "ts-summary",
        files: [{ name: sheet, contents: "sheet data", },],
      },
    },);

    assertEquals(
      classifyArtifacts(execution, [sheet,], [], {},),
      [{ uri: sheet, fileName: "001-dev@example.com.eml", kind: "sheet", },],
    );
  });

  it("uses the image source root even when the destination is under icons", () => {
    const destination = "file:///workspace/out/icons/project-logo.png";
    assertEquals(
      classifyArtifacts(
        envelope({},),
        [destination,],
        [{
          from: "file:///workspace/project-images/icons/project-logo.png",
          to: destination,
        },],
        {
          assetsRoot: "file:///workspace/assets",
          imageDir: "file:///workspace/project-images",
        },
      ),
      [{ uri: destination, fileName: "project-logo.png", kind: "image", },],
    );
  });

  it("deduplicates destinations while preserving production order", () => {
    const first = "file:///workspace/out/R.csv";
    const second = "file:///workspace/out/R.html";
    assertEquals(
      classifyArtifacts(envelope({},), [first, second, first,], [], {},),
      [
        { uri: first, fileName: "R.csv", kind: "report", },
        { uri: second, fileName: "R.html", kind: "report", },
      ],
    );
  });
});
