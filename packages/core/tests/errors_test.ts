import { beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows } from "@std/assert";
import {
  TjError,
  TjArgumentError,
  TjRuntimeError,
  TjInternalError,
  AttributeOverwrite,
  NotYetImplementedError,
} from "../src/model/errors.ts";

describe("TjError hierarchy", () => {
  it("TjArgumentError extends TjError", () => {
    const err = new TjArgumentError("invalid");
    assert(err instanceof TjError);
    assert(err instanceof TjArgumentError);
    assert(err instanceof Error);
  });

  it("TjRuntimeError extends TjError", () => {
    const err = new TjRuntimeError("runtime");
    assert(err instanceof TjError);
    assert(err instanceof TjRuntimeError);
    assert(err instanceof Error);
  });

  it("TjInternalError extends TjError", () => {
    const err = new TjInternalError("internal");
    assert(err instanceof TjError);
    assert(err instanceof TjInternalError);
    assert(err instanceof Error);
  });

  it("AttributeOverwrite extends TjArgumentError", () => {
    const err = new AttributeOverwrite("id");
    assert(err instanceof TjError);
    assert(err instanceof TjArgumentError);
    assert(err instanceof Error);
  });

  it("NotYetImplementedError extends TjRuntimeError", () => {
    const err = new NotYetImplementedError("16", "journal");
    assert(err instanceof TjError);
    assert(err instanceof TjRuntimeError);
    assert(err instanceof Error);
  });

  it("TjError nome corresponde ao const", () => {
    assertEquals(new TjError("x").name, "TjError");
    assertEquals(new TjArgumentError("x").name, "TjArgumentError");
    assertEquals(new TjRuntimeError("x").name, "TjRuntimeError");
    assertEquals(new TjInternalError("x").name, "TjInternalError");
    assertEquals(new AttributeOverwrite("x").name, "AttributeOverwrite");
    assertEquals(new NotYetImplementedError("16", "x").name, "NotYetImplementedError");
  });
});
