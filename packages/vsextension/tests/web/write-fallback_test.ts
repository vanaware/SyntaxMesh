/**
 * Unit tests of the pure user-triggered write policy (22.8.2). BDD +
 * `@std/assert`, no `vscode` runtime — a recording fake stands in for
 * `workspace.fs`, including a denied-write path (plan §9.2).
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  WRITE_ERROR_MESSAGE,
  writeUserFile,
} from "../../src/web/write-fallback.ts";
import type { WorkspaceFsLike, } from "../../src/web/write-fallback.ts";

/** One attempted write, with the bytes decoded back to text. */
interface Call {
  uri: string;
  text: string;
}

/** A fake fs that records every attempt and can reject the Nth call. */
function fakeFs(opts: { failOn?: number; message?: string } = {},): {
  fs: WorkspaceFsLike<string>;
  calls: Call[];
} {
  const calls: Call[] = [];
  let n = 0;
  const fs: WorkspaceFsLike<string> = {
    writeFile(uri: string, content: Uint8Array,): Promise<void> {
      n++;
      calls.push({ uri, text: new TextDecoder().decode(content,), },);
      if (opts.failOn === n) {
        return Promise.reject(new Error(opts.message ?? "denied",),);
      }
      return Promise.resolve();
    },
  };
  return { fs, calls, };
}

describe("user-triggered write fallback", () => {
  it("writes once with the content using the direct strategy", async () => {
    const { fs, calls, } = fakeFs();
    const result = await writeUserFile(fs, "out.csv", "a,b", "direct",);
    assertEquals(result, { ok: true, },);
    assertEquals(calls, [{ uri: "out.csv", text: "a,b", },],);
  });

  it("writes an empty stub then the content using stub-first", async () => {
    const { fs, calls, } = fakeFs();
    const result = await writeUserFile(fs, "out.html", "<h1>", "stub-first",);
    assertEquals(result, { ok: true, },);
    assertEquals(
      calls,
      [{ uri: "out.html", text: "", }, { uri: "out.html", text: "<h1>", },],
    );
  });

  it("defaults to the direct strategy", async () => {
    const { fs, calls, } = fakeFs();
    await writeUserFile(fs, "t", "x",);
    assertEquals(calls.length, 1,);
  });

  it("returns a friendly error when the write is denied", async () => {
    const { fs, } = fakeFs({ failOn: 1, message: "permission denied", },);
    const result = await writeUserFile(fs, "t", "x", "direct",);
    assert(!result.ok,);
    assertEquals(result.error, `${WRITE_ERROR_MESSAGE}: permission denied`,);
  });

  it("returns a friendly error when the stub-first overwrite is denied", async () => {
    const { fs, calls, } = fakeFs({ failOn: 2, message: "denied", },);
    const result = await writeUserFile(fs, "t", "x", "stub-first",);
    assert(!result.ok,);
    assertEquals(calls.length, 2,);
    assertEquals(result.error, `${WRITE_ERROR_MESSAGE}: denied`,);
  });

  it("writes empty content successfully", async () => {
    const { fs, calls, } = fakeFs();
    const result = await writeUserFile(fs, "t", "", "direct",);
    assertEquals(result, { ok: true, },);
    assertEquals(calls, [{ uri: "t", text: "", },],);
  });
});
