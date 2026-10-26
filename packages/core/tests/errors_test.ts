import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import {
  AttributeOverwrite,
  NotYetImplementedError,
  TjArgumentError,
  TjError,
  TjInternalError,
  TjRuntimeError,
} from "../src/model/errors.ts";

describe("TjError hierarchy", () => {
  // Espelho do Ruby: TjRuntimeError < RuntimeError (aborto que escapa do
  // catch de TextParser#parse) e TjError ≈ TjException < RuntimeError, com
  // TjArgumentError / TjInternalError como subclasses diretas de RuntimeError
  // (ArgumentError / TypeError do Ruby). Só TjError vira 'parse critical'.
  it("TjArgumentError extends Error (não TjError)", () => {
    const err = new TjArgumentError("invalid",);
    assert(err instanceof Error,);
    assert(err instanceof TjArgumentError,);
    assert(!(err instanceof TjError),);
  });

  it("TjRuntimeError extends Error e não é pego como TjError", () => {
    const err = new TjRuntimeError("runtime",);
    assert(err instanceof Error,);
    assert(err instanceof TjRuntimeError,);
    assert(!(err instanceof TjError),);
  });

  it("TjInternalError extends Error (não TjError)", () => {
    const err = new TjInternalError("internal",);
    assert(err instanceof Error,);
    assert(err instanceof TjInternalError,);
    assert(!(err instanceof TjError),);
  });

  it("AttributeOverwrite extends TjArgumentError", () => {
    const err = new AttributeOverwrite("id",);
    assert(err instanceof TjArgumentError,);
    assert(err instanceof Error,);
  });

  it("NotYetImplementedError extends TjRuntimeError", () => {
    const err = new NotYetImplementedError("16", "journal",);
    assert(err instanceof TjRuntimeError,);
    assert(err instanceof Error,);
    assert(!(err instanceof TjError),);
  });

  it("TjError extends TjRuntimeError (parse critical recuperável)", () => {
    const err = new TjError("x",);
    assert(err instanceof TjRuntimeError,);
    assert(err instanceof TjError,);
  });

  it("TjError nome corresponde ao const", () => {
    assertEquals(new TjError("x",).name, "TjError",);
    assertEquals(new TjArgumentError("x",).name, "TjArgumentError",);
    assertEquals(new TjRuntimeError("x",).name, "TjRuntimeError",);
    assertEquals(new TjInternalError("x",).name, "TjInternalError",);
    assertEquals(new AttributeOverwrite("x",).name, "AttributeOverwrite",);
    assertEquals(
      new NotYetImplementedError("16", "x",).name,
      "NotYetImplementedError",
    );
  });
});
