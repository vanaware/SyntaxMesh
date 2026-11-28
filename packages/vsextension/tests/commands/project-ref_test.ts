/**
 * Project-reference resolution tests (22.12.3). The resolver is pure: explicit
 * string URIs, registry state and editor metadata enter as data; no VS Code
 * runtime is imported.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { resolveProjectUri, } from "../../src/commands/project-ref.ts";

describe("resolveProjectUri", () => {
  it("prefers an explicit master over registry, editor and fallback", () => {
    const resolved = resolveProjectUri({
      explicit: "file:///explicit.smx",
      activeRegistry: "file:///registry.tjp",
      activeDocument: { uri: "file:///editor.tji", languageId: "syntaxmesh", },
      projects: ["file:///registry.tjp",],
    },);

    assertEquals(resolved, {
      ok: true,
      value: "file:///explicit.smx",
      messages: [],
    },);
  });

  it("prefers the active registry over a valid editor and fallback", () => {
    const resolved = resolveProjectUri({
      activeRegistry: "file:///registry.smx",
      activeDocument: { uri: "file:///editor.tjp", languageId: "syntaxmesh", },
      projects: ["file:///registry.smx", "file:///fallback.tjp",],
    },);

    assertEquals(resolved.ok, true,);
    if (resolved.ok) assertEquals(resolved.value, "file:///registry.smx",);
  });

  it("accepts a native master editor before the single-project fallback", () => {
    const resolved = resolveProjectUri({
      activeDocument: { uri: "file:///editor.smx", languageId: "syntaxmesh", },
      projects: ["file:///fallback.tjp",],
    },);

    assertEquals(resolved.ok, true,);
    if (resolved.ok) assertEquals(resolved.value, "file:///editor.smx",);
  });

  it("accepts a compatibility master editor", () => {
    const resolved = resolveProjectUri({
      activeDocument: { uri: "file:///editor.tjp", languageId: "syntaxmesh", },
      projects: [],
    },);

    assertEquals(resolved.ok, true,);
    if (resolved.ok) assertEquals(resolved.value, "file:///editor.tjp",);
  });

  it("uses one loaded project when no higher-priority source exists", () => {
    const resolved = resolveProjectUri({
      projects: ["file:///only.tjp", "file:///only.tjp",],
    },);

    assertEquals(resolved.ok, true,);
    if (resolved.ok) assertEquals(resolved.value, "file:///only.tjp",);
  });

  it("rejects an invalid explicit URI instead of falling back", () => {
    const resolved = resolveProjectUri({
      explicit: "file:///fragment.tji",
      activeRegistry: "file:///registry.smx",
      projects: ["file:///registry.smx",],
    },);

    assertEquals(resolved.ok, false,);
  });

  it("rejects .tji and .tjs documents as project roots", () => {
    for (const uri of ["file:///fragment.tji", "file:///fragment.tjs",]) {
      const resolved = resolveProjectUri({
        activeDocument: { uri, languageId: "syntaxmesh", },
        projects: [],
      },);
      assertEquals(resolved.ok, false, `${uri} must not be a master`,);
    }
  });

  it("rejects an active document with the wrong language id", () => {
    const resolved = resolveProjectUri({
      activeDocument: { uri: "file:///editor.smx", languageId: "typescript", },
      projects: [],
    },);

    assertEquals(resolved.ok, false,);
  });

  it("falls back to one loaded project when the active editor is not a master", () => {
    const resolved = resolveProjectUri({
      activeDocument: {
        uri: "file:///fragment.tji",
        languageId: "syntaxmesh",
      },
      projects: ["file:///only.smx",],
    },);

    assertEquals(resolved.ok, true,);
    if (resolved.ok) assertEquals(resolved.value, "file:///only.smx",);
  });

  it("returns a structured error when no project can be resolved", () => {
    const resolved = resolveProjectUri({ projects: [], },);

    assertEquals(resolved.ok, false,);
    assert(!resolved.ok,);
    assert(resolved.error.length > 0,);
    assertEquals(resolved.messages, [],);
  });

  it("returns a structured error when loaded projects are ambiguous", () => {
    const resolved = resolveProjectUri({
      projects: ["file:///one.smx", "file:///two.tjp",],
    },);

    assertEquals(resolved.ok, false,);
    assert(!resolved.ok,);
    assert(resolved.error.length > 0,);
    assertEquals(resolved.messages, [],);
  });
});
