/**
 * Configuration hydration tests (22.12.5). The injected reader isolates file I/O
 * while assertions exercise the real YAML parsing and structured failures.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { loadConfig, } from "../../src/commands/config.ts";

describe("loadConfig", () => {
  it("returns the original YAML and its parsed object", async () => {
    const configContent = "global:\n  timezone: UTC\nreports: []\n";
    const readFile = (path: string,) => {
      assertEquals(path, "file:///project.smx.yaml",);
      return Promise.resolve(configContent,);
    };

    const result = await loadConfig("file:///project.smx.yaml", readFile,);

    assertEquals(result, {
      ok: true,
      value: {
        configContent,
        configObject: {
          global: { timezone: "UTC", },
          reports: [],
        },
      },
      messages: [],
    },);
  });

  it("returns invalid YAML as a structured failure", async () => {
    const result = await loadConfig(
      "file:///broken.smx.yaml",
      () => Promise.resolve("global: [\n",),
    );

    assert(!result.ok,);
    assertStringIncludes(result.error, "file:///broken.smx.yaml",);
    assertEquals(result.messages, [],);
  });

  it("returns unreadable files as a structured failure", async () => {
    const result = await loadConfig(
      "file:///missing.smx.yaml",
      () => Promise.reject(new Error("permission denied",),),
    );

    assertEquals(result, {
      ok: false,
      error: "permission denied",
      messages: [],
    },);
  });

  for (const configContent of ["[]\n", "plain text\n", "null\n", "42\n", "",]) {
    it(`rejects the non-object YAML root ${JSON.stringify(configContent,)}`, async () => {
      const result = await loadConfig(
        "file:///scalar.smx.yaml",
        () => Promise.resolve(configContent,),
      );

      assert(!result.ok,);
      assertStringIncludes(result.error, "object",);
      assertEquals(result.messages, [],);
    });
  }
});
