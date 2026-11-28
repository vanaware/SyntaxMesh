/**
 * Manifest consistency regression (22.10.4/22.12.3) — contributed commands must
 * equal the public command contract, while legacy and runtime-only aliases stay
 * out of the palette. Every contributed asset path must exist in the package.
 * BDD + `@std/assert`, no `vscode` runtime.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §10/§11/P8.1
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.10.4/§22.12.3
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  LEGACY_COMMAND_IDS,
  PUBLIC_COMMAND_IDS,
  RUNTIME_ONLY_COMMAND_IDS,
} from "../src/commands/contracts.ts";

/** Package root (the parent of `tests/`). */
const PKG_ROOT = `${import.meta.dirname}/..`;

/** Structural subset of the VS Code manifest consumed by this regression. */
interface Manifest {
  capabilities?: {
    untrustedWorkspaces?: unknown;
  };
  contributes: {
    commands: { command: string }[];
    languages: { id: string; extensions: string[]; configuration: string }[];
    grammars: { path: string }[];
    snippets: { path: string }[];
    viewsContainers: { activitybar: { icon: string }[] };
    menus: {
      "view/title": { command: string; when: string; group: string }[];
      "view/item/context": { command: string; when: string; group: string }[];
    };
  };
}

describe("VS Code manifest consistency (22.10.4)", () => {
  const manifest = JSON.parse(
    Deno.readTextFileSync(`${PKG_ROOT}/package.json`,),
  ) as Manifest;

  it("contributes exactly the public command contract", () => {
    const declared = manifest.contributes.commands.map((c,) => c.command);
    assertEquals(declared.sort(), [...PUBLIC_COMMAND_IDS,].sort(),);
    assertEquals(new Set(declared,).size, declared.length,);
  });

  it("does not opt into untrusted-workspace activation", () => {
    assert(
      !Object.hasOwn(manifest.capabilities ?? {}, "untrustedWorkspaces",),
    );
  });

  it("contributes the project-tree toolbar and context menus", () => {
    assertEquals(manifest.contributes.menus, {
      "view/title": [
        {
          command: "syntaxmesh.project.add",
          when: "view == syntaxmesh.projectTree",
          group: "navigation",
        },
        {
          command: "syntaxmesh.project.refresh",
          when: "view == syntaxmesh.projectTree",
          group: "navigation",
        },
      ],
      "view/item/context": [
        {
          command: "syntaxmesh.project.remove",
          when: "view == syntaxmesh.projectTree && viewItem == project",
          group: "project",
        },
        {
          command: "syntaxmesh.compile",
          when: "view == syntaxmesh.projectTree && viewItem == project",
          group: "project",
        },
        {
          command: "syntaxmesh.report.export",
          when: "view == syntaxmesh.projectTree && viewItem == report",
          group: "report",
        },
      ],
    },);
  });

  it("uses only public commands in every contributed menu", () => {
    const publicIds = new Set<string>(PUBLIC_COMMAND_IDS,);
    const menuIds = Object.values(manifest.contributes.menus,)
      .flat()
      .map((item,) => item.command);
    assert(menuIds.length > 0, "the manifest must contribute menu commands",);
    for (const id of menuIds) {
      assert(publicIds.has(id,), `${id} must be public before use in a menu`,);
    }
  });

  it("does not contribute the retired syntaxmesh.tj3.run id", () => {
    const declared = manifest.contributes.commands.map((item,) => item.command);
    assert(!declared.includes("syntaxmesh.tj3.run",),);
    assert(
      !(PUBLIC_COMMAND_IDS as readonly string[]).includes(
        "syntaxmesh.tj3.run",
      ),
    );
  });

  it("contributes all six semantic execution commands", () => {
    const declared = new Set(
      manifest.contributes.commands.map((c,) => c.command),
    );
    const executionIds = [
      "syntaxmesh.compile",
      "syntaxmesh.checkSyntax",
      "syntaxmesh.scheduleOnly",
      "syntaxmesh.freeze",
      "syntaxmesh.checkTimeSheet",
      "syntaxmesh.checkStatusSheet",
    ];
    for (const id of executionIds) {
      assert((PUBLIC_COMMAND_IDS as readonly string[]).includes(id,),);
      assert(declared.has(id,), `${id} must be contributed`,);
    }
  });

  it("contributes only syntaxmesh.run for tj3-compatible execution", () => {
    const declared = manifest.contributes.commands.map((c,) => c.command);
    assertEquals(declared.filter((id,) => id === "syntaxmesh.run").length, 1,);
    assert(
      (PUBLIC_COMMAND_IDS as readonly string[]).includes("syntaxmesh.run",),
    );
    assert(!declared.includes("syntaxmesh.tj3",),);
  });

  it("contributes console.open once and keeps console.clear runtime-only", () => {
    const declared = manifest.contributes.commands.map((c,) => c.command);
    assertEquals(
      declared.filter((id,) => id === "syntaxmesh.console.open").length,
      1,
    );
    assert(
      (PUBLIC_COMMAND_IDS as readonly string[]).includes(
        "syntaxmesh.console.open",
      ),
    );
    assert(
      (RUNTIME_ONLY_COMMAND_IDS as readonly string[]).includes(
        "syntaxmesh.console.clear",
      ),
    );
    assert(!declared.includes("syntaxmesh.console.clear",),);
  });

  it("keeps legacy and runtime-only aliases out of the manifest", () => {
    const declared = new Set(
      manifest.contributes.commands.map((c,) => c.command),
    );
    for (const id of [...LEGACY_COMMAND_IDS, ...RUNTIME_ONLY_COMMAND_IDS,]) {
      assert(!declared.has(id,), `${id} must not be contributed`,);
    }
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
