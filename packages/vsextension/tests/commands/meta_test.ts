/**
 * Project-free help/version regressions (22.12.11). The formatter consumes only
 * structured option data; the command handlers must forward one exact metadata
 * request and return the execution envelope unchanged.
 */
import { describe, it, } from "@std/testing/bdd";
import {
  assert,
  assertEquals,
  assertStrictEquals,
  assertStringIncludes,
} from "@std/assert";
import type {
  ExecutionOptionsEcho,
  ExecutionRequest,
  ExecutionResult,
  ExecutionResults,
  OptionSpec,
} from "@vanaware/syntaxmesh";
import { DaemonCore, type ExecuteFn, } from "../../src/daemon/daemon-core.ts";
import { PUBLIC_COMMAND_IDS, } from "../../src/commands/contracts.ts";
import { formatHelp, } from "../../src/commands/help-text.ts";
import {
  helpCommand,
  type MetaExecutionPort,
  versionCommand,
} from "../../src/commands/meta.ts";

/** Complete options echo for project-free metadata envelopes. */
function metadataOptions(request: ExecutionRequest,): ExecutionOptionsEcho {
  return {
    entry: "",
    files: [],
    configContent: null,
    checkSyntax: false,
    listReports: null,
    listReportsIsRegex: true,
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
    help: request.help === true,
    version: request.version === true,
    man: null,
    app: null,
    appOptions: null,
  };
}

/** Successful metadata envelope with no project files. */
function metadataEnvelope(
  request: ExecutionRequest,
  results: ExecutionResults,
): ExecutionResult {
  return {
    ok: true,
    exitCode: 0,
    options: metadataOptions(request,),
    messages: [],
    results,
  };
}

/** Records exact requests and returns one predetermined envelope. */
function recordingPort(result: ExecutionResult,): {
  port: MetaExecutionPort;
  requests: ExecutionRequest[];
} {
  const requests: ExecutionRequest[] = [];
  const execute: ExecuteFn = (request,) => {
    requests.push(request,);
    return Promise.resolve(result,);
  };
  return { port: { execute, }, requests, };
}

/** Adapts the daemon's project-free method to the metadata port contract. */
function daemonPort(daemon: DaemonCore,): MetaExecutionPort {
  return { execute: (request,) => daemon.executeRequest(request,), };
}

const specs: OptionSpec[] = [
  {
    name: "report",
    short: "R",
    type: "string[]",
    argument: "<id>",
    description: "Generate the selected reports.",
  },
  {
    name: "limit",
    short: null,
    type: "number",
    argument: "<count>",
    description: "Limit the number of rendered items.",
  },
  {
    name: "debug",
    short: "d",
    type: "boolean",
    argument: null,
    description: "Reserved diagnostic mode.",
    deferred: "no equivalent in the port",
  },
];

describe("metadata help formatter (22.12.11)", () => {
  it("renders usage, aliases and every structured option detail", () => {
    const text = formatHelp(specs,);

    assertStringIncludes(text, "Usage:",);
    assertStringIncludes(text, "run",);
    assertStringIncludes(text, "smx",);
    assertStringIncludes(text, "tj3",);
    assertStringIncludes(text, "-R, --report <id>",);
    assertStringIncludes(text, "--limit <count>",);
    assertStringIncludes(text, "-d, --debug",);
    assertStringIncludes(text, "Generate the selected reports.",);
    assertStringIncludes(text, "Limit the number of rendered items.",);
    assertStringIncludes(text, "Reserved diagnostic mode.",);
    assertStringIncludes(text, "no equivalent in the port",);
    assert(!text.includes("\u001b",), "help must not contain ANSI sequences",);
  });

  it("keeps usage and aliases when the option table is empty", () => {
    const text = formatHelp([],);

    assertStringIncludes(text, "Usage:",);
    assertStringIncludes(text, "run",);
    assertStringIncludes(text, "smx",);
    assertStringIncludes(text, "tj3",);
    assert(!text.includes("\u001b",), "help must not contain ANSI sequences",);
  });
});

describe("project-free metadata commands (22.12.11)", () => {
  it("executes help once with only the help flag and returns its envelope", async () => {
    const request: ExecutionRequest = { help: true, };
    const envelope = metadataEnvelope(request, { help: specs, },);
    const { port, requests, } = recordingPort(envelope,);
    const daemon = new DaemonCore(port.execute,);

    const result = await helpCommand(daemonPort(daemon,),);

    assertStrictEquals(result, envelope,);
    assertEquals(requests, [request,],);
    assertEquals(daemon.listProjects(), [],);
  });

  it("executes version once with only the version flag and returns its envelope", async () => {
    const request: ExecutionRequest = { version: true, };
    const envelope = metadataEnvelope(request, {
      version: { name: "SyntaxMesh", version: "0.0.2", },
    },);
    const { port, requests, } = recordingPort(envelope,);
    const daemon = new DaemonCore(port.execute,);

    const result = await versionCommand(daemonPort(daemon,),);

    assertStrictEquals(result, envelope,);
    assertEquals(requests, [request,],);
    assertEquals(daemon.listProjects(), [],);
  });

  it("contributes help and version in the public command contract and manifest", () => {
    const manifest = JSON.parse(
      Deno.readTextFileSync(new URL("../../package.json", import.meta.url,),),
    ) as { contributes: { commands: { command: string }[] } };
    const declared = new Set(
      manifest.contributes.commands.map((command,) => command.command),
    );

    for (const id of ["syntaxmesh.help", "syntaxmesh.version",]) {
      assert((PUBLIC_COMMAND_IDS as readonly string[]).includes(id,),);
      assert(declared.has(id,), `${id} must be contributed`,);
    }
  });
});
