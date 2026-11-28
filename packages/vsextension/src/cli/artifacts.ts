/**
 * Pure artifact classification for extension output.
 *
 * The output host resolves every destination to a URI and records real copy
 * sources. This module turns that data into the plain artifact values exposed by
 * commands; it performs no I/O and exposes no host objects.
 */
import type { ExecutionResult, } from "@vanaware/syntaxmesh";
import type { ArtifactKind, ArtifactResult, } from "../commands/contracts.ts";

/** One real copy operation performed by the output policy. */
export interface ArtifactCopy {
  /** Source URI string captured from the real copy operation. */
  from: string;
  /** Destination URI string captured from the real copy operation. */
  to: string;
}

/** Canonical URI identity used for sets and source-root containment. */
function uriKey(uri: string,): string {
  const parsed = new URL(uri,);
  return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
}

/** Resolves a relative manual file under its approved output directory. */
function joinUri(root: string, path: string,): string {
  return new URL(path, `${root.replace(/\/$/, "",)}/`,).toString();
}

/** Basename of a destination URI. */
function basename(uri: string,): string {
  const path = new URL(uri,).pathname.replace(/\/$/, "",);
  return path.slice(path.lastIndexOf("/",) + 1,);
}

/** Whether a source is inside the supplied read-only root. */
function inside(source: string, root: string | undefined,): boolean {
  if (root === undefined) return false;
  const sourceUrl = new URL(source,);
  const rootUrl = new URL(root,);
  if (
    sourceUrl.protocol !== rootUrl.protocol || sourceUrl.host !== rootUrl.host
  ) return false;
  const rootPath = rootUrl.pathname.endsWith("/",)
    ? rootUrl.pathname
    : `${rootUrl.pathname}/`;
  return sourceUrl.pathname.startsWith(rootPath,);
}

/** Outbox messages are the only `.eml` artifacts; SMTP is never involved. */
function isEmail(uri: string,): boolean {
  return /(?:^|\/)outbox\/[^/]+\.eml$/.test(new URL(uri,).pathname,);
}

/**
 * Classifies resolved output destinations using execution data and copy sources.
 *
 * Explicit freeze, manual and sheet destinations take precedence. Outbox
 * messages are emails; copied files are assets or images according to their
 * source root, and every remaining destination is a report.
 */
export function classifyArtifacts(
  execution: ExecutionResult,
  written: string[],
  copies: ArtifactCopy[],
  options: { outputDir?: string; assetsRoot?: string; imageDir?: string },
): ArtifactResult[] {
  const outputDir = options.outputDir ?? execution.options.outputDir ??
    execution.results.reports?.outputDir;
  const freeze = new Set(
    (execution.results.freeze?.files ?? []).map((file,) =>
      uriKey(file.fileName,)
    ),
  );
  const manual = new Set<string>();
  for (const file of execution.results.man?.files ?? []) {
    if (outputDir === undefined) continue;
    manual.add(uriKey(joinUri(outputDir, file.name,),),);
  }
  const sheet = new Set(
    (execution.results.sheet?.files ?? []).map((file,) => uriKey(file.name,)),
  );
  const copySources = new Map<string, string>();
  for (const copy of copies) {
    const destination = uriKey(copy.to,);
    if (!copySources.has(destination,)) {
      copySources.set(destination, copy.from,);
    }
  }

  const seen = new Set<string>();
  const artifacts: ArtifactResult[] = [];
  for (const uri of written) {
    const key = uriKey(uri,);
    if (seen.has(key,)) continue;
    seen.add(key,);

    let kind: ArtifactKind = "report";
    if (freeze.has(key,)) {
      kind = "freeze";
    } else if (manual.has(key,)) {
      kind = "manual";
    } else if (sheet.has(key,)) {
      kind = "sheet";
    } else if (isEmail(uri,)) {
      kind = "email";
    } else {
      const source = copySources.get(key,);
      if (source !== undefined && inside(source, options.assetsRoot,)) {
        kind = "asset";
      } else if (source !== undefined && inside(source, options.imageDir,)) {
        kind = "image";
      }
    }
    artifacts.push({ uri, fileName: basename(uri,), kind, },);
  }
  return artifacts;
}
