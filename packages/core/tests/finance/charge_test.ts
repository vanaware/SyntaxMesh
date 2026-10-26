import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Task, } from "../../src/model/task.ts";
import { Charge, ChargeMode, } from "../../src/finance/charge.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TjArgumentError, } from "../../src/attributes/errors.ts";

describe("Charge", () => {
  let project: Project;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    task = new Task(project, "t1", "Task 1", null,);
  },);

  describe("constructor", () => {
    it("aceita modo válido 'onStart'", () => {
      const charge = new Charge(100, "onStart", task, 0,);
      assertEquals(charge.amount, 100,);
      assertEquals(charge.mode, "onStart",);
      assertEquals(charge.task, task,);
      assertEquals(charge.scenarioIdx, 0,);
    });

    it("aceita modo válido 'onEnd'", () => {
      const charge = new Charge(200, "onEnd", task, 1,);
      assertEquals(charge.mode, "onEnd",);
    });

    it("aceita modo válido 'perDiem'", () => {
      const charge = new Charge(300, "perDiem", task, 2,);
      assertEquals(charge.mode, "perDiem",);
    });

    it("rejeita modo inválido", () => {
      const invalidMode = "invalid" as ChargeMode;
      assertThrows(
        () => new Charge(100, invalidMode, task, 0,),
        TjArgumentError,
      );
    });
  });

  describe("turnover", () => {
    describe("modo 'onStart'", () => {
      it("retorna amount se start dentro do período", () => {
        task.setForScenario("start", TjTime.fromString("2026-03-15",), 0,);
        task.setForScenario("end", TjTime.fromString("2026-03-20",), 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-10",),
          TjTime.fromString("2026-03-25",),
        );
        const charge = new Charge(500, "onStart", task, 0,);
        assertEquals(charge.turnover(period,), 500,);
      });

      it("retorna 0 se start fora do período", () => {
        task.setForScenario("start", TjTime.fromString("2026-03-15",), 0,);
        task.setForScenario("end", TjTime.fromString("2026-03-20",), 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-25",),
          TjTime.fromString("2026-03-30",),
        );
        const charge = new Charge(500, "onStart", task, 0,);
        assertEquals(charge.turnover(period,), 0,);
      });

      it("retorna 0 se start é null", () => {
        task.setForScenario("start", null, 0,);
        task.setForScenario("end", TjTime.fromString("2026-03-20",), 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-10",),
          TjTime.fromString("2026-03-25",),
        );
        const charge = new Charge(500, "onStart", task, 0,);
        assertEquals(charge.turnover(period,), 0,);
      });
    });

    describe("modo 'onEnd'", () => {
      it("retorna amount se end dentro do período", () => {
        task.setForScenario("start", TjTime.fromString("2026-03-15",), 0,);
        task.setForScenario("end", TjTime.fromString("2026-03-20",), 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-10",),
          TjTime.fromString("2026-03-25",),
        );
        const charge = new Charge(500, "onEnd", task, 0,);
        assertEquals(charge.turnover(period,), 500,);
      });

      it("retorna 0 se end fora do período", () => {
        task.setForScenario("start", TjTime.fromString("2026-03-15",), 0,);
        task.setForScenario("end", TjTime.fromString("2026-03-20",), 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-25",),
          TjTime.fromString("2026-03-30",),
        );
        const charge = new Charge(500, "onEnd", task, 0,);
        assertEquals(charge.turnover(period,), 0,);
      });

      it("retorna 0 se end é null", () => {
        task.setForScenario("start", TjTime.fromString("2026-03-15",), 0,);
        task.setForScenario("end", null, 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-10",),
          TjTime.fromString("2026-03-25",),
        );
        const charge = new Charge(500, "onEnd", task, 0,);
        assertEquals(charge.turnover(period,), 0,);
      });
    });

    describe("modo 'perDiem'", () => {
      it("retorna amount * dias se start/end dentro do período", () => {
        task.setForScenario("start", TjTime.fromString("2026-03-15",), 0,);
        task.setForScenario("end", TjTime.fromString("2026-03-20",), 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-15",),
          TjTime.fromString("2026-03-18",),
        );
        const charge = new Charge(100, "perDiem", task, 0,);
        // 3 dias (15,16,17) * 100 = 300 (TimeInterval é [start, end), exclusivo do end)
        assertEquals(charge.turnover(period,), 300,);
      });

      it("retorna 0 se start/end fora do período", () => {
        task.setForScenario("start", TjTime.fromString("2026-03-15",), 0,);
        task.setForScenario("end", TjTime.fromString("2026-03-20",), 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-25",),
          TjTime.fromString("2026-03-30",),
        );
        const charge = new Charge(100, "perDiem", task, 0,);
        assertEquals(charge.turnover(period,), 0,);
      });

      it("retorna 0 se start é null", () => {
        task.setForScenario("start", null, 0,);
        task.setForScenario("end", TjTime.fromString("2026-03-20",), 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-15",),
          TjTime.fromString("2026-03-25",),
        );
        const charge = new Charge(100, "perDiem", task, 0,);
        assertEquals(charge.turnover(period,), 0,);
      });

      it("retorna 0 se end é null", () => {
        task.setForScenario("start", TjTime.fromString("2026-03-15",), 0,);
        task.setForScenario("end", null, 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-15",),
          TjTime.fromString("2026-03-25",),
        );
        const charge = new Charge(100, "perDiem", task, 0,);
        assertEquals(charge.turnover(period,), 0,);
      });

      it("retorna 0 se interseção parcial", () => {
        task.setForScenario("start", TjTime.fromString("2026-03-15",), 0,);
        task.setForScenario("end", TjTime.fromString("2026-03-20",), 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-18",),
          TjTime.fromString("2026-03-22",),
        );
        const charge = new Charge(100, "perDiem", task, 0,);
        // 2 dias (18,19) * 100 = 200 (exclusive do end)
        assertEquals(charge.turnover(period,), 200,);
      });

      it("retorna 0 se sem interseção", () => {
        task.setForScenario("start", TjTime.fromString("2026-03-15",), 0,);
        task.setForScenario("end", TjTime.fromString("2026-03-20",), 0,);
        const period = new TimeInterval(
          TjTime.fromString("2026-03-25",),
          TjTime.fromString("2026-03-30",),
        );
        const charge = new Charge(100, "perDiem", task, 0,);
        assertEquals(charge.turnover(period,), 0,);
      });
    });
  });

  describe("to_s", () => {
    it("retorna 'amount on start' para modo 'onStart'", () => {
      const charge = new Charge(100, "onStart", task, 0,);
      assertEquals(charge.to_s(), "100 on start",);
    });

    it("retorna 'amount on end' para modo 'onEnd'", () => {
      const charge = new Charge(200, "onEnd", task, 0,);
      assertEquals(charge.to_s(), "200 on end",);
    });

    it("retorna 'amount per day' para modo 'perDiem'", () => {
      const charge = new Charge(300, "perDiem", task, 0,);
      assertEquals(charge.to_s(), "300 per day",);
    });
  });
});

function assertThrows(
  fn: () => void,
  errorClass: typeof TjArgumentError,
): void {
  let error: unknown;
  try {
    fn();
  } catch (e) {
    error = e;
  }
  assert(
    error instanceof errorClass,
    `Esperado ${errorClass.name}, obtido ${error}`,
  );
}
