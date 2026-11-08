/**
 * Testes do reporter do terminal (24.4.1–24.4.4/24.4.7).
 *
 * Os writers são injetados (espiões locais), nunca `mock` global. O formato é o
 * de `Message#to_s` do Ruby: `arquivo:linha: Tipo: texto`.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.4)
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { ExecutionMessage, } from "@vanaware/syntaxmesh";
import { formatMessage, Reporter, summaryLine, } from "../src/reporter.ts";

/** Mensagem estruturada do envelope. */
function message(
  severity: ExecutionMessage["severity"],
  text: string,
  file: string | null = null,
  line: number | null = null,
): ExecutionMessage {
  return { severity, id: "probe", text, file, line, };
}

/** Reporter com writers de captura. */
function capture(options: { silent?: boolean; color?: boolean },) {
  const out: string[] = [];
  const err: string[] = [];
  const reporter = new Reporter({
    ...options,
    out: (text: string,) => out.push(text,),
    err: (text: string,) => err.push(text,),
  },);
  return { reporter, out, err, };
}

describe("formatMessage (24.4.1)", () => {
  it("usa arquivo:linha e o tipo capitalizado", () => {
    assertEquals(
      formatMessage(message("error", "Boom", "proj.smx", 12,),),
      "proj.smx:12: Error: Boom",
    );
  });

  it("sem linha mantém o arquivo; sem arquivo cai no tipo", () => {
    assertEquals(
      formatMessage(message("warning", "Careful", "proj.smx",),),
      "proj.smx: Warning: Careful",
    );
    assertEquals(formatMessage(message("info", "Hello",),), "Info: Hello",);
  });

  it("colorido usa a cor do nível e reseta no fim", () => {
    const text = formatMessage(message("warning", "Careful",), true,);
    assertEquals(text.includes("\u001b[35m",), true,);
    assertEquals(text.endsWith("\u001b[0m",), true,);
  });

  it("sem cor não emite ANSI", () => {
    assertEquals(
      formatMessage(message("error", "Boom",), false,).includes("\u001b",),
      false,
    );
  });
});

describe("Reporter.report (24.4.2/24.4.3/24.4.4)", () => {
  it("escreve em stderr e conta erros/avisos", () => {
    const { reporter, out, err, } = capture({},);
    const counts = reporter.report([
      message("warning", "w1",),
      message("error", "e1",),
      message("fatal", "f1",),
      message("info", "i1",),
    ],);
    assertEquals(counts, { errors: 2, warnings: 1, },);
    assertEquals(out, [],);
    assertEquals(err.length, 5,);
    assertEquals(err.at(-1,), "2 errors, 1 warning",);
  });

  it("execução limpa não imprime contagem", () => {
    const { reporter, err, } = capture({},);
    reporter.report([message("info", "ok",),],);
    assertEquals(err, ["Info: ok",],);
  });

  it("--silent suprime info/debug mas mantém erro e contagem", () => {
    const { reporter, err, } = capture({ silent: true, },);
    reporter.report([
      message("info", "hidden",),
      message("debug", "hidden",),
      message("error", "visible",),
    ],);
    assertEquals(err, ["Error: visible", "1 error, 0 warnings",],);
  });

  it("reporter com cor ligada colore; desligada não", () => {
    const on = capture({ color: true, },);
    on.reporter.report([message("error", "Boom",),],);
    assertEquals(on.err[0]!.includes("\u001b[31m",), true,);
    const off = capture({ color: false, },);
    off.reporter.report([message("error", "Boom",),],);
    assertEquals(off.err[0], "Error: Boom",);
  });
});

describe("Reporter.summary (24.4.5)", () => {
  it("imprime o resumo em stdout", () => {
    const { reporter, out, } = capture({},);
    reporter.summary(['Project prj "T" v1.0',],);
    assertEquals(out, ['Project prj "T" v1.0',],);
  });

  it("--silent esconde o resumo", () => {
    const { reporter, out, } = capture({ silent: true, },);
    reporter.summary(['Project prj "T" v1.0',],);
    assertEquals(out, [],);
  });
});

describe("summaryLine (24.4.4)", () => {
  it("concorda singular e plural", () => {
    assertEquals(
      summaryLine({ errors: 0, warnings: 1, },),
      "0 errors, 1 warning",
    );
    assertEquals(
      summaryLine({ errors: 2, warnings: 0, },),
      "2 errors, 0 warnings",
    );
  });
});
