/**
 * Fase 24 (24.2.33) — checagem de folhas sobre **conteúdo**.
 *
 * `app="check-ts"/"check-ss"` entra pelo `execute` com o texto da folha em
 * `appOptions.sheetContent`: nenhum `FileStore` e nenhum disco. O journal
 * compilado sai em `results.sheet.reportText` (no lugar do campo mutável
 * `lastSheetReport`) e o resto do envelope segue a matriz do plano §5.3.
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { execute, } from "../../src/execution/execute.ts";
import type { ExecutionRequest, } from "../../src/execution/types.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { TaskJuggler, } from "../../src/taskjuggler.ts";
import { buildFixture, TS_PROJECT, } from "../timesheet/fixture.ts";

/** Folha válida: 20 dias úteis na janela de 28 dias da fixture. */
const GOOD_SHEET = `timesheet dev 2026-01-01 - 2026-01-29 {
  task effortTask {
    work 20d
    remaining 0d
    status green "Progress normal"
  }
}
`;

/** Mesma folha com total muito abaixo do período trabalhável. */
const LOW_WORK_SHEET = `timesheet dev 2026-01-01 - 2026-01-29 {
  task effortTask {
    work 4d
    remaining 0d
    status green "Progress normal"
  }
}
`;

/** Status sheet válido para `dev` na mesma janela. */
const GOOD_STATUS_SHEET = `statussheet dev 2026-01-01 - 2026-01-29 {
  task effortTask {
    status green "All good"
  }
}
`;

function request(overrides: Partial<ExecutionRequest> = {},): ExecutionRequest {
  return {
    files: [{ path: "ts.tjp", content: TS_PROJECT, },],
    ...overrides,
  };
}

describe("execute — check-ts sobre conteúdo (24.2.33)", () => {
  it("folha válida devolve reportText e exit 0", async () => {
    MessageHandlerInstance.instance.reset();
    const result = await execute(request({
      app: "check-ts",
      appOptions: { sheetContent: GOOD_SHEET, sheetFile: "dev.tji", },
    },),);

    assertEquals(result.exitCode, 0,);
    assertEquals(result.ok, true,);
    const sheet = result.results.sheet;
    assert(sheet !== undefined,);
    assertEquals(sheet!.app, "check-ts",);
    assertEquals(sheet!.exitCode, 0,);
    assert(
      typeof sheet!.reportText === "string" && sheet!.reportText.length > 0,
      "journal compilado ausente",
    );
  });

  it("folha com total inconsistente falha sem reportText", async () => {
    MessageHandlerInstance.instance.reset();
    const result = await execute(request({
      app: "check-ts",
      appOptions: { sheetContent: LOW_WORK_SHEET, },
    },),);

    assertEquals(result.exitCode, 1,);
    assertEquals(result.ok, false,);
    assertEquals(result.results.sheet!.exitCode, 1,);
    assertEquals(result.results.sheet!.reportText, undefined,);
    assert(
      result.messages.some((message,) => message.severity === "error"),
      result.messages.map((message,) => `${message.id}: ${message.text}`)
        .join(" | ",),
    );
  });

  it("sem conteúdo o app falha com mensagem própria (nada de disco)", async () => {
    MessageHandlerInstance.instance.reset();
    const result = await execute(request({ app: "check-ts", },),);

    assertEquals(result.exitCode, 1,);
    const message = result.messages.find((item,) =>
      item.id === "sheet_app_input_missing"
    );
    assert(message !== undefined, JSON.stringify(result.messages,),);
    assertStringIncludes(message!.text, "sheetContent",);
    assertEquals(result.results.sheet!.exitCode, 1,);
  });
});

describe("execute — check-ss e âncoras (24.2.33)", () => {
  it("status sheet válida devolve o dashboard e exit 0", async () => {
    MessageHandlerInstance.instance.reset();
    const result = await execute(request({
      app: "check-ss",
      appOptions: { sheetContent: GOOD_STATUS_SHEET, },
    },),);

    assertEquals(result.exitCode, 0,);
    assertEquals(result.results.sheet!.app, "check-ss",);
    assertEquals(result.results.sheet!.exitCode, 0,);
    assert(
      typeof result.results.sheet!.reportText === "string" &&
        result.results.sheet!.reportText!.length > 0,
    );
  });

  it("apps de envio/recebimento seguem ancorados em 24.10", async () => {
    MessageHandlerInstance.instance.reset();
    const result = await execute(request({ app: "ts-send", },),);

    assertEquals(result.exitCode, 1,);
    assert(
      result.messages.some((message,) =>
        message.id === "sheet_app_not_available"
      ),
      JSON.stringify(result.messages.map((message,) => message.id),),
    );
    assertEquals(result.results.sheet!.exitCode, 1,);
  });
});

describe("checkTimeSheetContent — API de dados (24.2.33)", () => {
  it("funciona sem FileStore injetado", () => {
    MessageHandlerInstance.instance.reset();
    const result = buildChecker().checkTimeSheetContent(GOOD_SHEET, "dev.tji",);

    assert(result.valid,);
    assert(result.report !== null,);
    // O journal compilado é markup RichText (como o `puts` do Ruby).
    assertStringIncludes(result.report!, "Effort Task",);
  });

  it("a via por caminho continua exigindo FileStore (passo a passo)", async () => {
    MessageHandlerInstance.instance.reset();
    const tj = buildChecker();
    assertEquals(await tj.checkTimeSheet("dev.tji",), false,);
    assert(
      MessageHandlerInstance.instance.messages.some((message,) =>
        message.message.includes("no FileStore configured",)
      ),
      MessageHandlerInstance.instance.messages.map((message,) =>
        message.message
      )
        .join(" | ",),
    );
  });

  it("o resultado é dado puro (structuredClone) e determinístico", () => {
    MessageHandlerInstance.instance.reset();
    const first = buildChecker().checkTimeSheetContent(GOOD_SHEET,);
    const clone = structuredClone(first,);
    assertEquals(clone, first,);

    MessageHandlerInstance.instance.reset();
    const second = buildChecker().checkTimeSheetContent(GOOD_SHEET,);
    assertEquals(second.report, first.report,);
  });
});

/** `TaskJuggler` com o projeto da fixture agendado, sem qualquer store. */
function buildChecker(): TaskJuggler {
  const tj = new TaskJuggler();
  tj.project = buildFixture().project;
  return tj;
}
