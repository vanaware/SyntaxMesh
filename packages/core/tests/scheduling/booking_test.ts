import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MockProject, } from "../model/mock-project.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Task, } from "../../src/model/task.ts";
import { Booking, Overtime, Sloppy, } from "../../src/scheduling/booking.ts";
import { ScoreboardInterval, } from "../../src/time/scoreboard-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("Booking", () => {
  let project: MockProject;
  let r1: Resource;
  let t1: Task;

  beforeEach(() => {
    project = new MockProject(1,);
    r1 = new Resource(project, "r1", "Resource 1", null,);
    t1 = new Task(project, "t1", "Task 1", null,);
  },);

  describe("Overtime type", () => {
    it("é um número", () => {
      const val: Overtime = 0;
      assertEquals(typeof val, "number",);
    });
  });

  describe("Sloppy type", () => {
    it("é um número", () => {
      const val: Sloppy = 0;
      assertEquals(typeof val, "number",);
    });
  });

  describe("constructor", () => {
    it("cria Booking com resource, task e intervals", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const booking = new Booking(r1, t1, [iv,],);
      assertEquals(booking.resource, r1,);
      assertEquals(booking.task, t1,);
      assertEquals(booking.intervals.length, 1,);
      assertEquals(booking.sourceFileInfo, null,);
      assertEquals(booking.overtime, 0,);
      assertEquals(booking.sloppy, 0,);
    });

    it("aceita múltiplos intervals", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv1 = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const iv2 = new ScoreboardInterval(sbStart, 3600, 24, 48,);
      const booking = new Booking(r1, t1, [iv1, iv2,],);
      assertEquals(booking.intervals.length, 2,);
    });
  });

  describe("sourceFileInfo", () => {
    it("é null por padrão", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const booking = new Booking(r1, t1, [iv,],);
      assertEquals(booking.sourceFileInfo, null,);
    });

    it("pode ser definido", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const booking = new Booking(r1, t1, [iv,],);
      booking.sourceFileInfo = { file: "test.tjp", line: 1, };
      assertEquals(booking.sourceFileInfo, { file: "test.tjp", line: 1, },);
    });
  });

  describe("overtime", () => {
    it("é 0 por padrão", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const booking = new Booking(r1, t1, [iv,],);
      assertEquals(booking.overtime, 0,);
    });

    it("pode ser definido", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const booking = new Booking(r1, t1, [iv,],);
      booking.overtime = 2 as Overtime;
      assertEquals(booking.overtime, 2,);
    });
  });

  describe("sloppy", () => {
    it("é 0 por padrão", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const booking = new Booking(r1, t1, [iv,],);
      assertEquals(booking.sloppy, 0,);
    });

    it("pode ser definido", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const booking = new Booking(r1, t1, [iv,],);
      booking.sloppy = 1 as Sloppy;
      assertEquals(booking.sloppy, 1,);
    });
  });

  describe("to_s", () => {
    it("retorna resource.fullId seguido dos intervals", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const booking = new Booking(r1, t1, [iv,],);
      const result = booking.to_s();
      assert(
        result.startsWith("r1 ",),
        `expected to start with "r1 ", got "${result}"`,
      );
    });

    it("formata múltiplos intervals com vírgula", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv1 = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const iv2 = new ScoreboardInterval(sbStart, 3600, 24, 48,);
      const booking = new Booking(r1, t1, [iv1, iv2,],);
      const result = booking.to_s();
      assert(
        result.includes(", ",),
        `expected ", " in result, got "${result}"`,
      );
    });
  });

  describe("to_tjp", () => {
    it("usa task.fullId quando taskMode é true", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const booking = new Booking(r1, t1, [iv,],);
      const result = booking.to_tjp(true,);
      assert(
        result.startsWith("t1 ",),
        `expected to start with "t1 ", got "${result}"`,
      );
    });

    it("usa resource.fullId quando taskMode é false", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const booking = new Booking(r1, t1, [iv,],);
      const result = booking.to_tjp(false,);
      assert(
        result.startsWith("r1 ",),
        `expected to start with "r1 ", got "${result}"`,
      );
    });

    it("inclui overtime no final", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const booking = new Booking(r1, t1, [iv,],);
      const result = booking.to_tjp(false,);
      assert(
        result.includes("{ overtime 2 }",),
        `expected "{ overtime 2 }" in result, got "${result}"`,
      );
    });

    it("separa múltiplos intervals com vírgula e nova linha", () => {
      const sbStart = TjTime.fromDate(new Date("2024-01-01",),);
      const iv1 = new ScoreboardInterval(sbStart, 3600, 0, 24,);
      const iv2 = new ScoreboardInterval(sbStart, 3600, 24, 48,);
      const booking = new Booking(r1, t1, [iv1, iv2,],);
      const result = booking.to_tjp(false,);
      assert(
        result.includes(",\n",),
        `expected ",\\n" in result, got "${result}"`,
      );
    });
  });
});
