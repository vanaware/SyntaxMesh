/**
 * OutputHost tests: preview every destination before the first real write.
 *
 * The injected I/O is an in-memory URI file system, so these tests exercise the
 * pure host without importing the VS Code runtime or touching disk.
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type {
  ExecutionOptionsEcho,
  ExecutionResult,
  ExecutionResults,
  ReportJsonEntry,
} from "@vanaware/syntaxmesh";
import { OutputHost, type Tj3HostIo, } from "../../src/cli/output-host.ts";

/** Builds a complete execution envelope with harmless defaults. */
function envelope(
  results: ExecutionResults = {},
  options: Partial<ExecutionOptionsEcho> = {},
): ExecutionResult {
  const echo: ExecutionOptionsEcho = {
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
    ...options,
  };
  return { ok: true, exitCode: 0, options: echo, messages: [], results, };
}

/** One report entry with deterministic content. */
function report(
  name: string,
  formats: string[],
  options: { stdout?: boolean; errors?: string[]; selfcontained?: boolean } =
    {},
): ReportJsonEntry {
  return {
    name,
    stdout: options.stdout ?? false,
    selfcontained: options.selfcontained ?? false,
    formats: formats.map((format,) => ({
      format,
      content: `${format}:${name}`,
    })),
    errors: options.errors ?? [],
  };
}

/** Resolves a path under a directory URI. */
function under(root: string, path: string,): string {
  return new URL(path, `${root.replace(/\/$/, "",)}/`,).toString();
}

interface FakeIoOptions {
  cwd?: string;
  existing?: string[];
  tree?: Record<string, string[]>;
  failWriteAt?: number;
}

/** In-memory URI I/O with a complete event trace. */
function fakeIo(options: FakeIoOptions = {},) {
  const events: string[] = [];
  const printed: string[] = [];
  const writes: Array<{ path: string; content: string }> = [];
  const copies: Array<{ from: string; to: string }> = [];
  const dirs: string[] = [];
  const existenceChecks: string[] = [];
  const files = new Map<string, string>();
  for (const path of options.existing ?? []) files.set(path, "old",);
  const tree = options.tree ?? {};

  const io: Tj3HostIo = {
    resolve(path: string, root?: string,): string {
      if (path === "") {
        const base = root ?? options.cwd;
        if (base === undefined) throw new Error("no URI root",);
        return base;
      }
      if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(path,)) {
        return new URL(path,).toString();
      }
      const base = root ?? options.cwd;
      if (base === undefined) throw new Error("no URI root",);
      return under(base, path,);
    },
    print(text: string,): void {
      events.push(`print:${text}`,);
      printed.push(text,);
    },
    write(path: string, content: string,): Promise<void> {
      events.push(`write:${path}`,);
      writes.push({ path, content, },);
      if (options.failWriteAt === writes.length) {
        throw new Error("write denied",);
      }
      files.set(path, content,);
      return Promise.resolve();
    },
    mkpath(dir: string,): Promise<void> {
      events.push(`mkpath:${dir}`,);
      dirs.push(dir,);
      return Promise.resolve();
    },
    copy(from: string, to: string,): Promise<void> {
      events.push(`copy:${from}>${to}`,);
      copies.push({ from, to, },);
      files.set(to, files.get(from,) ?? "copied",);
      return Promise.resolve();
    },
    listDir(path: string,): Promise<string[]> {
      return Promise.resolve(tree[path] ?? [],);
    },
    isDir(path: string,): Promise<boolean> {
      return Promise.resolve(
        Object.hasOwn(tree, path,) && (tree[path]?.length ?? 0) > 0,
      );
    },
    exists(path: string,): Promise<boolean> {
      existenceChecks.push(path,);
      return Promise.resolve(files.has(path,) || Object.hasOwn(tree, path,),);
    },
  };
  return { io, events, printed, writes, copies, dirs, files, existenceChecks, };
}

/** Reports section with one entry. */
function reports(entry: ReportJsonEntry, outputDir?: string,) {
  return {
    ok: entry.errors.length === 0,
    reports: [entry,],
    ...(outputDir === undefined ? {} : { outputDir, }),
  };
}

describe("OutputHost.dispatch", () => {
  it("exposes the injected URI resolver for shared command path handling", () => {
    const root = "file:///workspace";
    const fake = fakeIo({ cwd: root, },);
    const host = new OutputHost(fake.io,);

    assertEquals(
      host.resolve("reports/overview.html",),
      under(root, "reports/overview.html",),
    );
    assertEquals(host.resolve("", root,), root,);
  });

  it("previews silently, writes once and classifies real copies in order", async () => {
    const root = "file:///workspace";
    const assetsRoot = under(root, "assets",);
    const imageDir = under(root, "images",);
    const fake = fakeIo({
      cwd: root,
      tree: {
        [under(assetsRoot, "css",)]: ["tjreport.css",],
        [under(assetsRoot, "css/tjreport.css",)]: [],
        [under(imageDir, "icons/logo.png",)]: [],
      },
    },);
    const host = new OutputHost(fake.io, { assetsRoot, imageDir, },);
    const imageReport = report("R", ["csv", "html",],);
    imageReport.formats[1]!.content = '<img src="icons/logo.png">';
    const execution = envelope({ reports: reports(imageReport,), },);

    const result = await host.dispatch(execution,);

    assertEquals(result.ok, true,);
    if (!result.ok) return;
    assertEquals(result.value.stdout, "",);
    assertEquals(result.value.printed, 0,);
    assertEquals(result.value.written, [
      under(root, "R.csv",),
      under(root, "R.html",),
    ],);
    assertEquals(result.value.artifacts, [
      { uri: under(root, "R.csv",), fileName: "R.csv", kind: "report", },
      { uri: under(root, "R.html",), fileName: "R.html", kind: "report", },
      {
        uri: under(root, "icons/logo.png",),
        fileName: "logo.png",
        kind: "image",
      },
      {
        uri: under(root, "css/tjreport.css",),
        fileName: "tjreport.css",
        kind: "asset",
      },
    ],);
    assertEquals(fake.printed, [],);
    assertEquals(fake.writes.map((item,) => item.path), [
      under(root, "R.csv",),
      under(root, "R.html",),
    ],);
    assertEquals(fake.copies, [
      {
        from: under(imageDir, "icons/logo.png",),
        to: under(root, "icons/logo.png",),
      },
      {
        from: under(assetsRoot, "css/tjreport.css",),
        to: under(root, "css/tjreport.css",),
      },
    ],);
    assertEquals(execution.results.reports?.outputDir, undefined,);
    assertEquals(execution.options.outputDir, null,);
  });

  it("confirms deduplicated existing destinations once and denial is atomic", async () => {
    const root = "file:///workspace";
    const assetsRoot = under(root, "assets",);
    const imageDir = under(root, "images",);
    const shared = under(root, "shared.txt",);
    const fake = fakeIo({
      cwd: root,
      existing: [under(root, "R.csv",), shared,],
      tree: {
        [under(assetsRoot, "shared.txt",)]: [],
        [under(imageDir, "shared.txt",)]: [],
      },
    },);
    const host = new OutputHost(fake.io, { assetsRoot, imageDir, },);
    const entry = report("R", ["csv", "html",],);
    entry.formats[1]!.content = '<img src="shared.txt">';
    let confirmed: string[] = [];
    let callbackCount = 0;

    const result = await host.dispatch(
      envelope({ reports: reports(entry,), },),
      {
        assets: { root: assetsRoot, files: ["shared.txt",], dirs: [], },
        confirmOverwrite: (paths: string[],) => {
          callbackCount++;
          confirmed = [...paths,];
          assert(
            !fake.events.some((event,) =>
              event.startsWith("write:",) || event.startsWith("copy:",) ||
              event.startsWith("mkpath:",)
            ),
          );
          return Promise.resolve(false,);
        },
      },
    );

    assertEquals(result, {
      ok: false,
      error: "SyntaxMesh: output cancelled; no files were written.",
      messages: [],
    },);
    assertEquals(callbackCount, 1,);
    assertEquals(confirmed, [under(root, "R.csv",), shared,],);
    assertEquals(fake.writes, [],);
    assertEquals(fake.copies, [],);
    assertEquals(fake.dirs, [],);
    assertEquals(fake.files.get(under(root, "R.csv",),), "old",);
    assertEquals(fake.files.get(shared,), "old",);
  });

  it("requires a callback only when an existing destination needs confirmation", async () => {
    const root = "file:///workspace";
    const fresh = fakeIo({ cwd: root, },);
    const freshResult = await new OutputHost(fresh.io,).dispatch(
      envelope({ reports: reports(report("R", ["csv",],),), },),
    );
    assertEquals(freshResult.ok, true,);

    const existing = fakeIo({
      cwd: root,
      existing: [under(root, "R.csv",),],
    },);
    const existingResult = await new OutputHost(existing.io,).dispatch(
      envelope({ reports: reports(report("R", ["csv",],),), },),
    );
    assertEquals(existingResult, {
      ok: false,
      error: "SyntaxMesh: overwrite confirmation is required.",
      messages: [],
    },);
    assertEquals(existing.writes, [],);
  });

  it("returns the policy abort before confirmation or writes", async () => {
    const root = "file:///workspace";
    const fake = fakeIo({ cwd: root, },);
    let confirmations = 0;
    let errors = 0;
    const failedReport = report("R", ["csv",], { errors: ["failed",], },);
    const result = await new OutputHost(fake.io,).dispatch(
      envelope({ reports: reports(failedReport,), },),
      {
        confirmOverwrite: () => {
          confirmations++;
          return Promise.resolve(true,);
        },
        onError: () => {
          errors++;
        },
      },
    );

    assertEquals(result, {
      ok: false,
      error: "SyntaxMesh: output policy aborted; no files were written.",
      messages: [],
    },);
    assertEquals(confirmations, 0,);
    assertEquals(errors, 0,);
    assertEquals(fake.writes, [],);
    assertEquals(fake.events, [],);
  });

  it("rejects escaping and absolute file destinations before confirmation", async () => {
    const root = "file:///workspace";
    for (
      const fileName of [
        "../escape.tji",
        "file:///tmp/escape.tji",
        "/tmp/escape.tji",
      ]
    ) {
      const fake = fakeIo({ cwd: root, },);
      let confirmations = 0;
      const result = await new OutputHost(fake.io,).dispatch(
        envelope({
          freeze: { files: [{ fileName, contents: "freeze", },], },
        },),
        {
          confirmOverwrite: () => {
            confirmations++;
            return Promise.resolve(true,);
          },
        },
      );
      assert(!result.ok,);
      assertEquals(confirmations, 0,);
      assertEquals(fake.writes, [],);
      assertEquals(fake.existenceChecks, [],);
    }
  });

  it("uses an explicit absolute output directory as its own approved root", async () => {
    const root = "file:///workspace";
    const outputDir = "file:///elsewhere/reports";
    const fake = fakeIo({ cwd: root, },);
    const result = await new OutputHost(fake.io,).dispatch(
      envelope(
        { reports: reports(report("R", ["csv",],),), },
        { outputDir, },
      ),
    );

    assertEquals(result.ok, true,);
    assertEquals(fake.writes.map((item,) => item.path), [
      under(outputDir, "R.csv",),
    ],);
  });

  it("works without a default root when outputDir is an absolute URI", async () => {
    const outputDir = "file:///explicit/reports";
    const fake = fakeIo({},);
    const result = await new OutputHost(fake.io,).dispatch(
      envelope(
        { reports: reports(report("R", ["csv",],),), },
        { outputDir, },
      ),
    );
    assertEquals(result.ok, true,);
    assertEquals(fake.writes[0]?.path, under(outputDir, "R.csv",),);
  });

  it("lets call-level cwd, assets and confirmation override constructor defaults", async () => {
    const constructorRoot = "file:///workspace/default";
    const callRoot = "file:///workspace/call";
    const defaultAssets = under(constructorRoot, "assets",);
    const callAssets = "file:///shared/report-assets";
    let constructorConfirmations = 0;
    let callConfirmations = 0;
    const fake = fakeIo({
      cwd: constructorRoot,
      existing: [under(callRoot, "R.csv",),],
      tree: {
        [under(callAssets, "css",)]: ["tjreport.css",],
        [under(callAssets, "css/tjreport.css",)]: [],
        [under(defaultAssets, "css",)]: ["wrong.css",],
        [under(defaultAssets, "css/wrong.css",)]: [],
      },
    },);
    const host = new OutputHost(fake.io, {
      assetsRoot: defaultAssets,
      confirmOverwrite: () => {
        constructorConfirmations++;
        return Promise.resolve(false,);
      },
    },);
    const result = await host.dispatch(
      envelope({ reports: reports(report("R", ["csv", "html",],),), },),
      {
        cwd: callRoot,
        assets: { root: callAssets, },
        confirmOverwrite: (paths: string[],) => {
          callConfirmations++;
          assertEquals(paths, [under(callRoot, "R.csv",),],);
          return Promise.resolve(true,);
        },
      },
    );

    assertEquals(result.ok, true,);
    assertEquals(constructorConfirmations, 0,);
    assertEquals(callConfirmations, 1,);
    assertEquals(fake.copies[0]?.from, under(callAssets, "css/tjreport.css",),);
    assertEquals(fake.writes[0]?.path, under(callRoot, "R.csv",),);
  });

  it("captures stdout only from the real pass and preserves sheet roots", async () => {
    const root = "file:///workspace";
    const sheetRoot = under(root, "sheet-work",);
    const fake = fakeIo({ cwd: root, },);
    const result = await new OutputHost(fake.io, { sheetBaseDir: sheetRoot, },)
      .dispatch(
        envelope({
          sheet: {
            app: "ts-summary",
            summaryText: "Subject: summary\n\nbody\n",
            files: [{ name: "TimeSheets/dev.tji", contents: "timesheet\n", },],
            emails: [{
              to: "dev@example.com",
              subject: "summary",
              text: "Subject: summary\n",
            },],
          },
        },),
      );

    assertEquals(result.ok, true,);
    if (!result.ok) return;
    assertEquals(result.value.stdout, "Subject: summary\n\nbody\n",);
    assertEquals(fake.printed, ["Subject: summary\n\nbody",],);
    assertEquals(result.value.artifacts, [
      {
        uri: under(sheetRoot, "TimeSheets/dev.tji",),
        fileName: "dev.tji",
        kind: "sheet",
      },
      {
        uri: under(sheetRoot, "outbox/001-dev@example.com.eml",),
        fileName: "001-dev@example.com.eml",
        kind: "email",
      },
    ],);
  });

  it("returns no artifact claims when a real write fails", async () => {
    const root = "file:///workspace";
    const fake = fakeIo({ cwd: root, failWriteAt: 2, },);
    const result = await new OutputHost(fake.io,).dispatch(
      envelope({ reports: reports(report("R", ["csv", "html",],),), },),
    );
    assert(!result.ok,);
    assertStringIncludes(result.error, "write denied",);
    assertEquals(fake.writes.length, 2,);
  });
});

describe("OutputHost.writeAll", () => {
  it("resolves a batch, creates parents and returns matching plain artifacts", async () => {
    const root = "file:///workspace/out";
    const fake = fakeIo({},);
    const result = await new OutputHost(fake.io,).writeAll(
      [
        { path: "a.csv", content: "a\n", kind: "report", },
        { path: "nested/b.json", content: "{}\n", kind: "report", },
      ],
      root,
    );

    assertEquals(result, {
      ok: true,
      value: [
        { uri: under(root, "a.csv",), fileName: "a.csv", kind: "report", },
        {
          uri: under(root, "nested/b.json",),
          fileName: "b.json",
          kind: "report",
        },
      ],
      messages: [],
    },);
    assertEquals(fake.writes, [
      { path: under(root, "a.csv",), content: "a\n", },
      { path: under(root, "nested/b.json",), content: "{}\n", },
    ],);
    assertEquals(fake.dirs, [root, under(root, "nested",),],);
  });

  it("rejects absolute and escaping batch paths before confirmation", async () => {
    const root = "file:///workspace/out";
    for (
      const path of [
        "../escape.csv",
        "file:///tmp/escape.csv",
        "/tmp/escape.csv",
      ]
    ) {
      const fake = fakeIo({},);
      let confirmations = 0;
      const result = await new OutputHost(fake.io,).writeAll(
        [{ path, content: "x", kind: "report", },],
        root,
        {
          confirmOverwrite: () => {
            confirmations++;
            return Promise.resolve(true,);
          },
        },
      );
      assert(!result.ok,);
      assertEquals(confirmations, 0,);
      assertEquals(fake.writes, [],);
      assertEquals(fake.existenceChecks, [],);
    }
  });

  it("confirms existing destinations once and denial writes nothing", async () => {
    const root = "file:///workspace/out";
    const existing = under(root, "a.csv",);
    const fake = fakeIo({ existing: [existing,], },);
    let confirmed: string[] = [];
    const result = await new OutputHost(fake.io,).writeAll(
      [
        { path: "a.csv", content: "new", kind: "report", },
        { path: "nested/a.csv", content: "new", kind: "report", },
        { path: "a.csv", content: "last", kind: "report", },
      ],
      root,
      {
        confirmOverwrite: (paths: string[],) => {
          confirmed = [...paths,];
          return Promise.resolve(false,);
        },
      },
    );

    assert(!result.ok,);
    assertEquals(confirmed, [existing,],);
    assertEquals(fake.writes, [],);
    assertEquals(fake.dirs, [],);
    assertEquals(fake.files.get(existing,), "old",);
  });

  it("stops on the first failed write and returns no artifacts", async () => {
    const root = "file:///workspace/out";
    const fake = fakeIo({ failWriteAt: 2, },);
    const result = await new OutputHost(fake.io,).writeAll(
      [
        { path: "a.csv", content: "a", kind: "report", },
        { path: "b.csv", content: "b", kind: "freeze", },
        { path: "c.csv", content: "c", kind: "sheet", },
      ],
      root,
    );
    assert(!result.ok,);
    assertStringIncludes(result.error, "write denied",);
    assertEquals(fake.writes.map((item,) => item.path), [
      under(root, "a.csv",),
      under(root, "b.csv",),
    ],);
  });
});
