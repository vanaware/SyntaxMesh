/**
 * `check-web-bundle.ts` — generated Web artifact purity gate (22.12.21).
 *
 * Scans both browser bundles after the deterministic build task. The script is
 * intentionally independent of the caller's working directory so the root and
 * package tasks report the same artifact paths.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.12.21
 */
import { scanBrowserBundle, } from "../src/web/bundle-purity.ts";

/** Browser artifacts that must remain free of unbound runtime-only globals. */
const BUNDLES = ["extension.web.js", "server.web.js",] as const;

/** Distribution directory resolved relative to this script. */
const DIST = new URL("../dist/", import.meta.url,);

let violationCount = 0;

for (const name of BUNDLES) {
  const file = `dist/${name}`;
  let text: string;
  try {
    text = await Deno.readTextFile(new URL(name, DIST,),);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error,);
    console.error(`${file}: unable to read generated bundle — ${message}`,);
    Deno.exit(1,);
  }

  const violations = scanBrowserBundle(file, text,);
  violationCount += violations.length;
  if (violations.length === 0) {
    console.log(`${file}: OK — 0 violations`,);
    continue;
  }
  console.error(`${file}: ${violations.length} violation(s)`,);
  for (const violation of violations) {
    console.error(
      `${violation.file}:${violation.line}: ${violation.reason}`,
    );
    console.error(`  ${violation.snippet}`,);
  }
}

if (violationCount > 0) {
  console.error(`Web bundle purity failed — ${violationCount} violation(s)`,);
  Deno.exit(1,);
}
console.log("Web bundle purity passed — 0 violations",);
