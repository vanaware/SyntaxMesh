/**
 * Manifest consistency regression (22.10.4) — the VS Code manifest
 * (`package.json`) and the bootstrap source must agree: every declared
 * command is registered exactly once, and every contributed asset path
 * exists in the package. BDD + `@std/assert`, no `vscode` runtime.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §10/§11
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.10.4
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";

/** Package root (the parent of `tests/`). */
const PKG_ROOT = `${import.meta.dirname}/..`;

/** Structural subset of the VS Code manifest consumed by this regression. */
interface Manifest {
  contributes: {
    commands: { command: string }[];
    languages: { id: string; extensions: string[]; configuration: string }[];
    grammars: { path: string }[];
    snippets: { path: string }[];
    viewsContainers: { activitybar: { icon: string }[] };
  };
}

/** Recursively yields `.ts` paths under `dir`. */
function* walkTs(dir: string,): Generator<string> {
  for (const entry of Deno.readDirSync(dir,)) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      yield* walkTs(full,);
    } else if (entry.isFile && entry.name.endsWith(".ts",)) {
      yield full;
    }
  }
}

/** Every `registerCommand("…")` id found in the extension source. */
function registeredCommandIds(): string[] {
  const ids: string[] = [];
  for (const path of walkTs(`${PKG_ROOT}/src`,)) {
    const text = Deno.readTextFileSync(path,);
    for (const match of text.matchAll(/registerCommand\(\s*"([^"]+)"/g,)) {
      ids.push(match[1]!,);
    }
  }
  return ids;
}

describe("VS Code manifest consistency (22.10.4)", () => {
  const manifest = JSON.parse(
    Deno.readTextFileSync(`${PKG_ROOT}/package.json`,),
  ) as Manifest;

  it("declares exactly the commands the source registers", () => {
    const declared = manifest.contributes.commands.map((c,) => c.command);
    assertEquals(declared.sort(), registeredCommandIds().sort(),);
  });

  it("points every contributed asset at an existing file", () => {
    const paths = [
      ...manifest.contributes.languages.map((l,) => l.configuration),
      ...manifest.contributes.grammars.map((g,) => g.path),
      ...manifest.contributes.snippets.map((s,) => s.path),
      ...manifest.contributes.viewsContainers.activitybar.map((v,) => v.icon),
    ];
    for (const rel of paths) {
      const stat = Deno.statSync(`${PKG_ROOT}/${rel.replace(/^\.\//, "",)}`,);
      assert(stat.isFile, `${rel} is not a file`,);
    }
  });

  it("keeps the v1 language contract (.smx native + .tjp/.tji compat)", () => {
    const language = manifest.contributes.languages[0]!;
    assertEquals(language.id, "syntaxmesh",);
    assertEquals(language.extensions, [".smx", ".tjp", ".tji",],);
  });
});
