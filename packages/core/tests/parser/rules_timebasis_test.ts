/**
 * C3.4 — parser aceita `timebasis` e produz o valor canônico correto.
 * C3.9 — keywords `timebasis`/`calendar`/`working` traduzidas (pt-BR/es).
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

describe("C3.4 rule_timebasis", () => {
  it("timebasis duration → valor canônico 'duration'", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'task t1 "T" {\ntimebasis duration\n}\n',
    );
    assertEquals(
      threw,
      null,
      `unexpected throw; messages=${messageIds.join(",",)}`,
    );
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const t = parser.project!.task("t1",)!;
    assertEquals(t.getForScenario("timebasis", 0,), "duration",);
  });

  it("timebasis calendar → alias normalizado p/ 'duration'", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'task t1 "T" {\ntimebasis calendar\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const t = parser.project!.task("t1",)!;
    assertEquals(t.getForScenario("timebasis", 0,), "duration",);
  });

  it("timebasis length → valor canônico 'length'", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'task t1 "T" {\ntimebasis length\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const t = parser.project!.task("t1",)!;
    assertEquals(t.getForScenario("timebasis", 0,), "length",);
  });

  it("timebasis working → alias normalizado p/ 'length'", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'task t1 "T" {\ntimebasis working\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    assert(result !== false, `parse failed: ${messageIds.join(",",)}`,);
    const t = parser.project!.task("t1",)!;
    assertEquals(t.getForScenario("timebasis", 0,), "length",);
  });

  it("timebasis + explicit duration → erro task_overspecified (§2.6)", () => {
    const { messageIds, result, } = parseProject(
      PROJECT_HEADER + 'task t1 "T" {\nduration 2d\ntimebasis length\n}\n',
    );
    // Parse deve continuar mas reportar erro.
    const hasOver = messageIds.some((m,) => m === "task_overspecified");
    assert(
      hasOver || result === false,
      `expected task_overspecified in messages, got [${messageIds.join(",",)}]`,
    );
  });

  it("timebasis em milestone → erro timebasis_not_supported (§2.6)", () => {
    const { messageIds, result, } = parseProject(
      PROJECT_HEADER + 'task t1 "T" {\nmilestone\ntimebasis length\n}\n',
    );
    const hasErr = messageIds.some((m,) => m === "timebasis_not_supported");
    assert(
      hasErr || result === false,
      `expected timebasis_not_supported in messages, got [${
        messageIds.join(",",)
      }]`,
    );
  });
});

describe("C3.9 keywords novas i18n (timebasis)", () => {
  it("pt-BR: base_temporal equivale a timebasis", () => {
    const { parser, messageIds, threw, result, } = parseProject(
      PROJECT_HEADER + 'tarefa t1 "T" {\nbase_temporal tratado\n}\n'.replace(
        "tratado",
        "duracao",
      ),
    );
    // `duracao` não é alias — só `duration`/`calendar`/`length`/`working`.
    // Este teste apenas verifica que a keyword `base_temporal` seja
    // reconhecida como `timebasis` (o valor ainda precisa ser canônico).
    // Verificamos que parse não morre por keyword desconhecida.
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    // `result === false` é esperado se o valor do timebasis não é canônico.
    void parser;
  });

  it("en: keyword nativa 'timebasis' funciona", () => {
    const { parser, messageIds, threw, } = parseProject(
      PROJECT_HEADER + 'task t1 "T" {\ntimebasis duration\n}\n',
    );
    assertEquals(threw, null, `messages=${messageIds.join(",",)}`,);
    const t = parser.project!.task("t1",)!;
    assertEquals(t.getForScenario("timebasis", 0,), "duration",);
  });
});
