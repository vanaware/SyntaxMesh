/**
 * Build-only report asset packaging tests (Fase 22 P8, 22.12.8).
 *
 * The real repository tree is copied into temporary package roots; no process,
 * terminal or network runtime is involved.
 */
import { describe, it, } from "@std/testing/bdd";
import {
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { join, } from "node:path";
import { copyReportAssets, } from "../scripts/copy-assets.ts";

/** Repository report assets, resolved independently of the process cwd. */
const SOURCE = new URL("../../../assets/", import.meta.url,).pathname;

/** Exact deterministic inventory required by report HTML and the VSIX. */
const EXPECTED = [
  "css/tjmanual.css",
  "css/tjreport.css",
  "icons/details.png",
  "icons/flag-green.png",
  "icons/flag-red.png",
  "icons/flag-yellow.png",
  "icons/resource.png",
  "icons/resourcegroup.png",
  "icons/task.png",
  "icons/taskgroup.png",
  "icons/trend-down.png",
  "icons/trend-flat.png",
  "icons/trend-up.png",
  "scripts/wz_tooltip.js",
];

/** Whether a temporary path exists. */
async function exists(path: string,): Promise<boolean> {
  try {
    await Deno.stat(path,);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

describe("copyReportAssets", () => {
  it("keeps copied vendor assets outside lint and formatting", async () => {
    const config = await Deno.readTextFile(
      new URL("../../../deno.jsonc", import.meta.url,),
    );

    assertStringIncludes(config, '"packages/vsextension/assets/scripts/"',);
    assertStringIncludes(config, '"packages/vsextension/assets/"',);
  });

  it("refuses to replace the source tree itself", async () => {
    const temporary = await Deno.makeTempDir();
    try {
      const source = join(temporary, "assets",);
      const file = join(source, "keep.txt",);
      await Deno.mkdir(source, { recursive: true, },);
      await Deno.writeTextFile(file, "keep\n",);
      await assertRejects(
        () => copyReportAssets(source, temporary,),
        Error,
        "source and destination",
      );
      assertEquals(await Deno.readTextFile(file,), "keep\n",);
    } finally {
      await Deno.remove(temporary, { recursive: true, },);
    }
  });

  it("copies the exact 14-file tree with unchanged bytes", async () => {
    const temporary = await Deno.makeTempDir();
    try {
      const packageRoot = join(temporary, "extension",);
      const copied = await copyReportAssets(SOURCE, packageRoot,);
      assertEquals(copied, EXPECTED,);
      for (const path of EXPECTED) {
        assertEquals(
          await Deno.readFile(join(packageRoot, "assets", path,),),
          await Deno.readFile(join(SOURCE, path,),),
        );
      }
    } finally {
      await Deno.remove(temporary, { recursive: true, },);
    }
  });

  it("replaces stale package assets instead of merging them", async () => {
    const temporary = await Deno.makeTempDir();
    try {
      const packageRoot = join(temporary, "extension",);
      const stale = join(packageRoot, "assets", "css", "stale.css",);
      await Deno.mkdir(join(packageRoot, "assets", "css",), {
        recursive: true,
      },);
      await Deno.writeTextFile(stale, "stale\n",);

      assertEquals(await copyReportAssets(SOURCE, packageRoot,), EXPECTED,);
      assertEquals(await exists(stale,), false,);
      assertEquals(await copyReportAssets(SOURCE, packageRoot,), EXPECTED,);
    } finally {
      await Deno.remove(temporary, { recursive: true, },);
    }
  });
});
