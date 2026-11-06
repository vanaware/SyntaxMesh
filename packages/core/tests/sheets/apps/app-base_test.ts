/**
 * Testes de `SheetAppBase` (tarefas 18.18.1, 18.18.2 e 18.18.8).
 *
 * O Ruby montava o `RuntimeConfig` com YAML (`_global`, `_timesheets`, …) e
 * copiava as chaves para as variáveis de instância do handler; aqui a mesma
 * cópia acontece sobre os campos públicos do `SheetHandlerBase`. A leitura do
 * YAML em si é do chamador (F24) — estes testes passam o objeto já parseado.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18)
 */
import { assert, assertEquals, assertRejects, } from "@std/assert";
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../../src/message-handler.ts";
import { TjRuntimeError, } from "../../../src/model/errors.ts";
import type { Project, } from "../../../src/model/project.ts";
import { SheetHandlerBase, } from "../../../src/sheets/sheet-handler-base.ts";
import { SheetSender, } from "../../../src/sheets/sheet-sender.ts";
import {
  parseEndDate,
  SHEET_APP_EXIT_ERROR,
  SHEET_APP_EXIT_OK,
  SheetAppBase,
  type SheetAppConfig,
  type SheetAppContext,
  type SheetAppOptions,
} from "../../../src/sheets/apps/app-base.ts";

/** App mínimo: só conta execuções e permite falhar de propósito. */
class TestApp extends SheetAppBase {
  readonly handler = new SheetHandlerBase("test_app",);

  /** Quantas vezes `appMain` rodou. */
  calls = 0;

  /** Quando definido, `appMain` levanta este erro. */
  failWith: Error | null = null;

  /** Quando `true`, `appMain` registra um erro no `MessageHandler`. */
  reportError = false;

  /** Só o contexto do projeto importa aqui; o resto é do pipeline. */
  context: SheetAppContext | null = null;

  constructor(dayOfWeek = 1, options: SheetAppOptions = {},) {
    super("test_app", dayOfWeek, options,);
  }

  /** Expõe `prepare` (config → workingDir → dryRun) para os testes. */
  prepareWith(handler: SheetHandlerBase, section: string,): void {
    this.configureTarget(handler, section,);
  }

  protected appMain(context: SheetAppContext,): Promise<void> {
    this.calls++;
    this.context = context;
    if (this.reportError) {
      MessageHandlerInstance.instance.error("sheet_error", "boom",);
    }
    if (this.failWith) throw this.failWith;
    return Promise.resolve();
  }
}

/** Projeto vazio: nenhum app dos testes toca o pipeline de relatórios. */
const NO_PROJECT = null as unknown as Project;

/** `now` fixo numa quarta-feira (2026-05-06) para a data ser previsível. */
const FIXED_NOW = () => new Date(2026, 4, 6, 10, 0, 0,);

describe("SheetAppBase", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("configureTarget copia só os campos existentes no handler", () => {
    const config: SheetAppConfig = {
      _timesheets: {
        // Cada nível leva o prefixo `_`, como no YAML do Ruby.
        _sender: {
          senderEmail: "pm@example.com",
          workingDir: "/tmp/prj",
          // O YAML do Ruby lê `2026-05-18` como Date — vira `YYYY-MM-DD`.
          date: new Date(2026, 4, 18,),
          // Nome errado no config não cria campo: o Ruby ia pelas ivars.
          naoExiste: 42,
        },
      },
    };
    const app = new TestApp(1, { config, },);
    // `date` só existe no sender/receiver — é nele que o YAML a escreve.
    const handler = new SheetSender("tj3ts_sender", "time",);

    assertEquals(app.configureTarget(handler, "timesheets.sender",), true,);
    assertEquals(handler.senderEmail, "pm@example.com",);
    assertEquals(handler.workingDir, "/tmp/prj",);
    assertEquals(handler.date, "2026-05-18",);
    assertEquals("naoExiste" in handler, false,);
  });

  it("configureTarget devolve false quando a seção não existe", () => {
    const app = new TestApp(1, { config: { _global: {}, }, },);
    const handler = new SheetHandlerBase("tj3ts_sender",);

    assertEquals(app.configureTarget(handler, "timesheets.sender",), false,);
    assertEquals(app.configureTarget(handler, "global",), true,);
    assertEquals(handler.senderEmail, null,);
  });

  it("configureSheet aplica global → raiz → papel (último vence)", () => {
    // Seção por papel é `_sender` dentro de `_timesheets` (Ruby `p['_' + sec]`).
    const config: SheetAppConfig = {
      _global: {
        senderEmail: "global@example.com",
        outputLevel: 1,
        logLevel: 1,
      },
      _timesheets: {
        senderEmail: "root@example.com",
        _sender: { outputLevel: 3, },
      },
      _statussheets: { senderEmail: "status@example.com", },
    };
    const app = new TestApp(1, { config, },);
    const handler = new SheetHandlerBase("tj3ts_sender",);

    assertEquals(app.configureSheet(handler, "timesheets", "sender",), true,);
    assertEquals(handler.senderEmail, "root@example.com",);
    assertEquals(handler.outputLevel, 3,);
    assertEquals(handler.logLevel, 1,);
  });

  it("default date é a próxima segunda-feira (TsSender)", () => {
    const app = new TestApp(1, { now: FIXED_NOW, },);
    // 2026-05-06 é quarta; a próxima segunda é 2026-05-11.
    assertEquals(app.date, "2026-05-11",);
  });

  it("endDate aceita YYYY-MM-DD e dia da semana", () => {
    const app = new TestApp(1, { now: FIXED_NOW, },);
    assertEquals(app.setEndDate("2026-05-20",), "2026-05-20",);
    // 3 = quarta-feira.
    assertEquals(app.setEndDate(3,), "2026-05-13",);
    assertEquals(parseEndDate("3", FIXED_NOW(),), "2026-05-13",);
    // `arg.to_i` do Ruby: texto inválido vira 0 (domingo).
    assertEquals(parseEndDate("amanha", FIXED_NOW(),), "2026-05-10",);
  });

  it("run devolve 0 quando o app termina limpo", async () => {
    const app = new TestApp(1, { now: FIXED_NOW, },);
    assertEquals(await app.run({ project: NO_PROJECT, },), SHEET_APP_EXIT_OK,);
    assertEquals(app.calls, 1,);
  });

  it("run devolve 1 quando o pipeline levanta TjRuntimeError", async () => {
    const app = new TestApp(1, { now: FIXED_NOW, },);
    app.failWith = new TjRuntimeError("@date not set",);
    assertEquals(
      await app.run({ project: NO_PROJECT, },),
      SHEET_APP_EXIT_ERROR,
    );
  });

  it("run devolve 1 quando o MessageHandler registra erro", async () => {
    const app = new TestApp(1, { now: FIXED_NOW, },);
    app.reportError = true;
    assertEquals(
      await app.run({ project: NO_PROJECT, },),
      SHEET_APP_EXIT_ERROR,
    );
    assertEquals(MessageHandlerInstance.instance.errors, 1,);
  });

  it("run propaga erro de programação (não é TjRuntimeError)", async () => {
    const app = new TestApp(1, { now: FIXED_NOW, },);
    app.failWith = new TypeError("bug",);
    const rejected = await assertRejects(
      () => app.run({ project: NO_PROJECT, },),
    );
    assert(rejected instanceof TypeError,);
  });
});
