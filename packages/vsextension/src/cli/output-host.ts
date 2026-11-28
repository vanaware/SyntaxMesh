/**
 * Shared, preflighted output host for extension commands.
 *
 * The F24 output policy remains the sole owner of destination naming. This host
 * resolves those names to URIs, records a side-effect-free preview, confirms one
 * overwrite batch and only then runs the real dispatch. It contains no VS Code
 * or Node imports; host I/O arrives through {@link Tj3HostIo}.
 */
import type { ExecutionMessage, ExecutionResult, } from "@vanaware/syntaxmesh";
import {
  type AssetOptions,
  dispatchSections,
  type OutputPolicyIo,
  type OutputPolicyOptions,
  type OutputPolicyOutcome,
} from "@vanaware/syntaxmesh-cli/output-policy";
import type {
  ArtifactKind,
  ArtifactResult,
  CommandResult,
} from "../commands/contracts.ts";
import { type ArtifactCopy, classifyArtifacts, } from "./artifacts.ts";

export type { ArtifactCopy, } from "./artifacts.ts";

/** F24 policy I/O plus URI resolution supplied by the host adapter. */
export interface Tj3HostIo extends OutputPolicyIo {
  /** Resolves a policy path against `root`, or the adapter's configured root. */
  resolve(path: string, root?: string,): string;
}

/** Defaults for every dispatch and write batch handled by one output host. */
export interface ConfirmedOutputOptions {
  /** URI string; defaults to the adapter root or first workspace folder. */
  cwd?: string;
  /** Read-only URI root containing packaged HTML assets. */
  assetsRoot?: string;
  /** Default URI root for sheet application output. */
  sheetBaseDir?: string;
  /** Read-only URI root containing report images. */
  imageDir?: string;
  /** Confirms one deduplicated batch of existing destination URIs. */
  confirmOverwrite?: (paths: string[],) => Promise<boolean>;
}

/** One write submitted directly by an export, freeze, manual or sheet command. */
export interface ConfirmedWrite {
  /** Relative path under `approvedRoot`; absolute and escaping paths are rejected. */
  path: string;
  /** UTF-8 content to write. */
  content: string;
  /** Plain-data artifact classification. */
  kind: ArtifactKind;
}

/** Successful dispatch data plus captured stdout and plain artifact values. */
export interface ConfirmedDispatchResult extends OutputPolicyOutcome {
  /** Printed lines joined with `\n`, with one final newline when non-empty. */
  stdout: string;
  /** Every real destination, classified without host objects. */
  artifacts: ArtifactResult[];
}

/** Per-invocation overrides for the shared output policy. */
export interface ConfirmedDispatchOptions
  extends Omit<OutputPolicyOptions, "io"> {
  /** Per-invocation URI root; overrides the OutputHost default. */
  cwd?: string;
  /** Per-invocation callback; overrides the OutputHost default. */
  confirmOverwrite?: (paths: string[],) => Promise<boolean>;
}

/** Overrides for one direct write batch. */
export interface ConfirmedWriteOptions {
  /** Per-batch callback; overrides the OutputHost default. */
  confirmOverwrite?: (paths: string[],) => Promise<boolean>;
}

/** UI-free output operations shared by export, freeze, manual, sheets and run. */
export interface ConfirmedOutputHost {
  /** Resolves a command path against the shared host URI root. */
  resolve(path: string, root?: string,): string;
  /** Preflights and dispatches one complete F24 execution envelope. */
  dispatch(
    result: ExecutionResult,
    policy?: ConfirmedDispatchOptions,
  ): Promise<CommandResult<ConfirmedDispatchResult>>;
  /** Preflights and writes one ordered batch under a single approved URI root. */
  writeAll(
    files: readonly ConfirmedWrite[],
    approvedRoot: string,
    options?: ConfirmedWriteOptions,
  ): Promise<CommandResult<ArtifactResult[]>>;
}

const ABORT_ERROR = "SyntaxMesh: output policy aborted; no files were written.";
const CANCELLED_ERROR = "SyntaxMesh: output cancelled; no files were written.";
const CONFIRMATION_ERROR = "SyntaxMesh: overwrite confirmation is required.";
const ABSOLUTE_URI = /^[A-Za-z][A-Za-z\d+.-]*:/;
const OUTBOX_FILE = /^outbox\/[^/]+\.eml$/;

/** Converts an unknown failure into a stable command error. */
function errorText(error: unknown,): string {
  const text = error instanceof Error ? error.message : String(error,);
  return text.startsWith("SyntaxMesh:",) ? text : `SyntaxMesh: ${text}`;
}

/** Structured failure carrying the execution messages unchanged. */
function failure(
  error: unknown,
  messages: ExecutionMessage[],
): { ok: false; error: string; messages: ExecutionMessage[] } {
  return { ok: false, error: errorText(error,), messages, };
}

/** Parses an absolute URI string. */
function absoluteUri(uri: string, label: string,): URL {
  try {
    const parsed = new URL(uri,);
    if (parsed.protocol === "") throw new Error("relative URI",);
    return parsed;
  } catch {
    throw new Error(`SyntaxMesh: ${label} must be an absolute URI: ${uri}`,);
  }
}

/** Canonical identity for deduplication while preserving the first URI string. */
function uriKey(uri: string,): string {
  const parsed = absoluteUri(uri, "destination",);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Whether a destination is the root itself or one of its descendants. */
function inside(root: string, destination: string,): boolean {
  const rootUrl = absoluteUri(root, "approved root",);
  const destinationUrl = absoluteUri(destination, "destination",);
  if (
    rootUrl.protocol !== destinationUrl.protocol ||
    rootUrl.host !== destinationUrl.host
  ) return false;
  const rootPath = rootUrl.pathname.endsWith("/",)
    ? rootUrl.pathname
    : `${rootUrl.pathname}/`;
  return destinationUrl.pathname === rootUrl.pathname ||
    destinationUrl.pathname.startsWith(rootPath,);
}

/** Rejects absolute, encoded traversal and separator-bearing policy paths. */
function assertRelative(path: string, label: string,): void {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path,);
  } catch {
    throw new Error(`SyntaxMesh: invalid ${label}: ${path}`,);
  }
  if (
    path === "" || path === "." || ABSOLUTE_URI.test(path,) ||
    decoded.startsWith("/",) || ABSOLUTE_URI.test(decoded,) ||
    decoded.includes("\\",) || decoded.includes("\0",) ||
    decoded.split("/",).includes("..",)
  ) {
    throw new Error(
      `SyntaxMesh: ${label} must be a safe relative path: ${path}`,
    );
  }
}

/** Joins a path under a directory URI. */
function joinUri(root: string, path: string,): string {
  return new URL(path, `${root.replace(/\/$/, "",)}/`,).toString();
}

/** Parent URI of a file destination. */
function parentUri(uri: string,): string {
  const parsed = absoluteUri(uri, "destination",);
  const path = parsed.pathname.replace(/\/$/, "",);
  const index = path.lastIndexOf("/",);
  parsed.pathname = index <= 0 ? "/" : path.slice(0, index,);
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

/** Basename of a destination URI. */
function basename(uri: string,): string {
  const path = absoluteUri(uri, "destination",).pathname.replace(/\/$/, "",);
  return path.slice(path.lastIndexOf("/",) + 1,);
}

/** Deduplicates URI strings in first-production order. */
function unique(values: readonly string[],): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = uriKey(value,);
    if (seen.has(key,)) continue;
    seen.add(key,);
    result.push(value,);
  }
  return result;
}

/**
 * Pure output host shared by every extension surface.
 *
 * All destinations are validated and all existing files are confirmed before
 * the first real `mkpath`, `write` or `copy` call.
 */
export class OutputHost implements ConfirmedOutputHost {
  private readonly options: ConfirmedOutputOptions;

  /**
   * @param io injectable URI I/O; must remain side-effect free for read methods.
   * @param options default roots and overwrite confirmation callback.
   */
  constructor(io: Tj3HostIo, options: ConfirmedOutputOptions = {},) {
    this.io = io;
    this.options = options;
  }

  private readonly io: Tj3HostIo;

  /** Resolves a command path through the same I/O used for output dispatch. */
  resolve(path: string, root?: string,): string {
    return this.io.resolve(path, root,);
  }

  /** Previews, confirms and dispatches one execution envelope. */
  async dispatch(
    result: ExecutionResult,
    policy: ConfirmedDispatchOptions = {},
  ): Promise<CommandResult<ConfirmedDispatchResult>> {
    try {
      return await this.dispatchResolved(result, policy,);
    } catch (error) {
      return failure(error, result.messages,);
    }
  }

  /** Runs the two-pass dispatch after resolving all roots and file names. */
  private async dispatchResolved(
    result: ExecutionResult,
    policy: ConfirmedDispatchOptions,
  ): Promise<CommandResult<ConfirmedDispatchResult>> {
    const requestedCwd = policy.cwd ?? this.options.cwd;
    const cwd = requestedCwd === undefined
      ? this.configuredCwd()
      : this.absoluteRoot(requestedCwd, "working directory",);
    const requestedOutput = result.results.reports?.outputDir ??
      result.options.outputDir;
    const outputRoot = requestedOutput === null ||
        requestedOutput === undefined
      ? cwd
      : this.resolveRoot(requestedOutput, cwd, "output directory",);

    const sheet = result.results.sheet;
    const requestedSheetRoot = policy.sheetBaseDir ?? this.options.sheetBaseDir;
    const sheetRoot = sheet === undefined ? undefined : requestedSheetRoot ===
        undefined
      ? cwd
      : this.resolveRoot(requestedSheetRoot, cwd, "sheet directory",);

    const requestedAssets = policy.assets !== undefined
      ? policy.assets
      : this.options.assetsRoot === undefined
      ? undefined
      : { root: this.options.assetsRoot, };
    const assets = requestedAssets === null
      ? null
      : requestedAssets === undefined
      ? undefined
      : this.resolveAssets(requestedAssets, cwd,);
    const requestedImageRoot = policy.imageDir ?? this.options.imageDir;
    const imageRoot = requestedImageRoot === undefined
      ? cwd ?? outputRoot
      : this.resolveRoot(requestedImageRoot, cwd, "image directory",);

    const local = this.localEnvelope(
      result,
      cwd,
      outputRoot,
      sheetRoot,
    );
    const basePolicy: Omit<OutputPolicyOptions, "io"> = {
      assets,
      sheetBaseDir: "",
      imageDir: imageRoot,
      onError: null,
    };
    const destination = (path: string,): string =>
      sheetRoot !== undefined && OUTBOX_FILE.test(path,)
        ? joinUri(sheetRoot, path,)
        : path;

    const previewDestinations: string[] = [];
    const previewIo: Tj3HostIo = {
      ...this.io,
      print: () => {},
      write: (path: string, _content: string,) => {
        previewDestinations.push(destination(path,),);
        return Promise.resolve();
      },
      mkpath: () => Promise.resolve(),
      copy: (from: string, to: string,) => {
        const resolved = destination(to,);
        previewDestinations.push(resolved,);
        return Promise.resolve();
      },
    };
    const preview = await dispatchSections(local, {
      ...basePolicy,
      io: previewIo,
      onError: null,
    },);
    if (preview.aborted) {
      return { ok: false, error: ABORT_ERROR, messages: result.messages, };
    }

    const approvedRoots = unique(
      [outputRoot, cwd, sheetRoot,].filter((root,): root is string =>
        root !== undefined
      ),
    );
    for (const path of previewDestinations) {
      if (!approvedRoots.some((root,) => inside(root, path,))) {
        throw new Error(
          `SyntaxMesh: destination is outside the approved root: ${path}`,
        );
      }
    }
    const existing = await this.existingDestinations(
      unique(previewDestinations,),
    );
    const confirmed = await this.confirm(existing, policy.confirmOverwrite,);
    if (!confirmed) {
      return { ok: false, error: CANCELLED_ERROR, messages: result.messages, };
    }

    const stdout: string[] = [];
    const written: string[] = [];
    const copied: string[] = [];
    const destinations: string[] = [];
    const copies: ArtifactCopy[] = [];
    const realIo: Tj3HostIo = {
      ...this.io,
      print: (text: string,) => {
        stdout.push(text,);
        this.io.print(text,);
      },
      write: async (path: string, content: string,) => {
        const resolved = destination(path,);
        written.push(resolved,);
        destinations.push(resolved,);
        await this.io.write(resolved, content,);
      },
      mkpath: (dir: string,) =>
        this.io.mkpath(
          sheetRoot !== undefined && dir === "outbox"
            ? joinUri(sheetRoot, dir,)
            : dir,
        ),
      copy: async (from: string, to: string,) => {
        const resolved = destination(to,);
        copied.push(resolved,);
        destinations.push(resolved,);
        copies.push({ from, to: resolved, },);
        await this.io.copy(from, resolved,);
      },
    };
    const dispatched = await dispatchSections(local, {
      ...basePolicy,
      io: realIo,
      onError: policy.onError ?? null,
    },);
    if (dispatched.aborted) {
      return { ok: false, error: ABORT_ERROR, messages: result.messages, };
    }

    const artifacts = classifyArtifacts(
      local,
      unique(destinations,),
      copies,
      { outputDir: outputRoot, assetsRoot: assets?.root, imageDir: imageRoot, },
    );
    return {
      ok: true,
      value: {
        printed: dispatched.printed,
        written: unique(written,),
        assets: unique(copied,),
        aborted: false,
        stdout: stdout.length === 0 ? "" : `${stdout.join("\n",)}\n`,
        artifacts,
      },
      messages: result.messages,
    };
  }

  /** Preflights and writes one ordered batch under a single approved root. */
  async writeAll(
    files: readonly ConfirmedWrite[],
    approvedRoot: string,
    options: ConfirmedWriteOptions = {},
  ): Promise<CommandResult<ArtifactResult[]>> {
    try {
      const root = this.absoluteRoot(approvedRoot, "approved root",);
      const resolved = files.map((file,) => ({
        ...file,
        uri: this.resolveFile(file.path, root, "output path",),
      }));
      const existing = await this.existingDestinations(
        unique(resolved.map((file,) => file.uri),),
      );
      if (!(await this.confirm(existing, options.confirmOverwrite,))) {
        return { ok: false, error: CANCELLED_ERROR, messages: [], };
      }

      const created = new Set<string>();
      const artifacts: ArtifactResult[] = [];
      for (const file of resolved) {
        const parent = parentUri(file.uri,);
        if (!created.has(parent,)) {
          await this.io.mkpath(parent,);
          created.add(parent,);
        }
        await this.io.write(file.uri, file.content,);
        artifacts.push({
          uri: file.uri,
          fileName: basename(file.uri,),
          kind: file.kind,
        },);
      }
      return { ok: true, value: artifacts, messages: [], };
    } catch (error) {
      return failure(error, [],);
    }
  }

  /** Reads the adapter's configured root when no explicit cwd was supplied. */
  private configuredCwd(): string | undefined {
    try {
      return this.absoluteRoot(this.io.resolve("",), "working directory",);
    } catch {
      return undefined;
    }
  }

  /** Normalizes an explicitly supplied absolute root URI. */
  private absoluteRoot(value: string, label: string,): string {
    if (!ABSOLUTE_URI.test(value,)) {
      throw new Error(
        `SyntaxMesh: ${label} must be an absolute URI: ${value}`,
      );
    }
    return this.io.resolve(value,);
  }

  /** Resolves an absolute root or a safe path below the supplied base root. */
  private resolveRoot(
    path: string,
    base: string | undefined,
    label: string,
  ): string {
    if (path === "" || path === ".") {
      if (base === undefined) {
        throw new Error(`SyntaxMesh: ${label} requires a URI root.`,);
      }
      return base;
    }
    if (ABSOLUTE_URI.test(path,)) return this.absoluteRoot(path, label,);
    assertRelative(path, label,);
    if (base === undefined) {
      throw new Error(`SyntaxMesh: ${label} requires a URI root.`,);
    }
    const resolved = this.io.resolve(path, base,);
    if (!inside(base, resolved,)) {
      throw new Error(
        `SyntaxMesh: ${label} is outside the approved root: ${path}`,
      );
    }
    return resolved;
  }

  /** Resolves one relative file below an approved root and verifies containment. */
  private resolveFile(
    path: string,
    root: string | undefined,
    label: string,
  ): string {
    assertRelative(path, label,);
    if (root === undefined) {
      throw new Error(`SyntaxMesh: ${label} requires a URI root.`,);
    }
    const resolved = this.io.resolve(path, root,);
    if (!inside(root, resolved,)) {
      throw new Error(
        `SyntaxMesh: ${label} is outside the approved root: ${path}`,
      );
    }
    return resolved;
  }

  /** Resolves the asset root and validates every declared relative subpath. */
  private resolveAssets(
    assets: AssetOptions,
    cwd: string | undefined,
  ): AssetOptions {
    const root = this.resolveRoot(assets.root, cwd, "asset directory",);
    for (const name of assets.dirs ?? []) assertRelative(name, "asset path",);
    for (const name of assets.files ?? []) assertRelative(name, "asset path",);
    return { ...assets, root, };
  }

  /** Builds the local URI-resolved envelope copy consumed by both passes. */
  private localEnvelope(
    result: ExecutionResult,
    cwd: string | undefined,
    outputRoot: string | undefined,
    sheetRoot: string | undefined,
  ): ExecutionResult {
    const results = { ...result.results, };
    if (results.reports !== undefined) {
      results.reports = {
        ...results.reports,
        ...(outputRoot === undefined ? {} : { outputDir: outputRoot, }),
      };
    }
    if (results.freeze !== undefined) {
      results.freeze = {
        files: results.freeze.files.map((file,) => ({
          ...file,
          fileName: this.resolveFile(file.fileName, cwd, "freeze path",),
        })),
      };
    }
    if (results.man !== undefined) {
      for (const file of results.man.files) {
        assertRelative(file.name, "manual path",);
      }
    }
    if (results.sheet !== undefined) {
      results.sheet = {
        ...results.sheet,
        files: (results.sheet.files ?? []).map((file,) => ({
          ...file,
          name: this.resolveFile(file.name, sheetRoot, "sheet path",),
        })),
      };
    }
    return {
      ...result,
      options: {
        ...result.options,
        outputDir: outputRoot ?? result.options.outputDir,
      },
      results,
    };
  }

  /** Returns existing destinations in production order. */
  private async existingDestinations(paths: string[],): Promise<string[]> {
    const existing: string[] = [];
    for (const path of paths) {
      if (await this.io.exists(path,)) existing.push(path,);
    }
    return existing;
  }

  /** Applies one confirmation callback to one deduplicated existing batch. */
  private async confirm(
    existing: string[],
    override: ((paths: string[],) => Promise<boolean>) | undefined,
  ): Promise<boolean> {
    if (existing.length === 0) return true;
    const callback = override ?? this.options.confirmOverwrite;
    if (callback === undefined) throw new Error(CONFIRMATION_ERROR,);
    return await callback(existing,);
  }
}
