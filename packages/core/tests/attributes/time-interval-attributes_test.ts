import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { MockContainer, } from "./mock-container.ts";
import { TimeIntervalListAttribute, } from "../../src/attributes/time-interval/time-interval-list-attribute.ts";
import { LeaveListAttribute, } from "../../src/attributes/time-interval/leave-list-attribute.ts";
import { LeaveAllowanceListAttribute, } from "../../src/attributes/time-interval/leave-allowance-list-attribute.ts";
import { LimitsAttribute, } from "../../src/attributes/time-interval/limits-attribute.ts";
import { ShiftAssignmentsAttribute, } from "../../src/attributes/time-interval/shift-assignments-attribute.ts";
import { WorkingHoursAttribute, } from "../../src/attributes/time-interval/working-hours-attribute.ts";
import { NotYetImplementedError, } from "../../src/attributes/errors.ts";

class TestTimeIntervalListAttribute extends TimeIntervalListAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<{ to_s(): string }[]>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestLeaveListAttribute extends LeaveListAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<string[]>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestLeaveAllowanceListAttribute extends LeaveAllowanceListAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<unknown[]>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestLimitsAttribute extends LimitsAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<unknown>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestShiftAssignmentsAttribute extends ShiftAssignmentsAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<unknown>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

class TestWorkingHoursAttribute extends WorkingHoursAttribute {
  constructor(
    property: { id: string; name: string },
    type: AttributeDefinition<unknown>,
    container: MockContainer,
  ) {
    super(property, type, container,);
  }
}

describe("TimeIntervalAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string };

  beforeEach(() => {
    AttributeBase.setMode(0,);
    container = new MockContainer();
    property = { id: "test.attr", name: "Test Attr", };
  },);

  describe("TimeIntervalListAttribute", () => {
    let type: AttributeDefinition<{ to_s(): string }[]>;
    let attr: TestTimeIntervalListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "intervallist",
        "Interval List",
        AttributeType.TimeIntervalList,
        [],
      );
      attr = new TestTimeIntervalListAttribute(property, type, container,);
    },);

    it("to_s com intervalos", () => {
      attr.set([
        {
          to_s() {
            return "1h-2h";
          },
        },
        {
          to_s() {
            return "3h-4h";
          },
        },
      ],);
      assertEquals(attr.to_s(), "1h-2h, 3h-4h",);
    });

    it("to_tjp com intervalos", () => {
      attr.set([
        {
          to_s() {
            return "1h-2h";
          },
        },
        {
          to_s() {
            return "3h-4h";
          },
        },
      ],);
      assertEquals(attr.to_tjp(), "intervallist 1h-2h, 3h-4h",);
    });

    it("tjpId é 'intervallist'", () => {
      assertEquals(TimeIntervalListAttribute.tjpId, "intervallist",);
    });
  });

  describe("LeaveListAttribute", () => {
    let type: AttributeDefinition<string[]>;
    let attr: TestLeaveListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "leave",
        "Leave",
        AttributeType.LeaveList,
        [],
      );
      attr = new TestLeaveListAttribute(property, type, container,);
    },);

    it("to_tjp com feriados", () => {
      attr.set(["2026-01-01", "2026-02-01",],);
      assertEquals(attr.to_tjp(), "leaves 2026-01-01,\n2026-02-01",);
    });

    it("tjpId é 'leave'", () => {
      assertEquals(LeaveListAttribute.tjpId, "leave",);
    });
  });

  describe("LeaveAllowanceListAttribute", () => {
    let type: AttributeDefinition<unknown[]>;
    let attr: TestLeaveAllowanceListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "leaveallowance",
        "Leave Allowance",
        AttributeType.LeaveAllowanceList,
        [],
      );
      attr = new TestLeaveAllowanceListAttribute(property, type, container,);
    },);

    it("tjpId é 'leaveallowance'", () => {
      assertEquals(LeaveAllowanceListAttribute.tjpId, "leaveallowance",);
    });
  });

  describe("LimitsAttribute", () => {
    let type: AttributeDefinition<unknown>;
    let attr: TestLimitsAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "limits",
        "Limits",
        AttributeType.Limits,
        null,
      );
      attr = new TestLimitsAttribute(property, type, container,);
    },);

    it("to_tjp lança Error", () => {
      assertThrows(() => attr.to_tjp(), Error,);
    });

    it("tjpId é 'limits'", () => {
      assertEquals(LimitsAttribute.tjpId, "limits",);
    });
  });

  describe("ShiftAssignmentsAttribute", () => {
    let type: AttributeDefinition<unknown>;
    let attr: TestShiftAssignmentsAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "shifts",
        "Shift Assignments",
        AttributeType.ShiftAssignments,
        null,
      );
      attr = new TestShiftAssignmentsAttribute(property, type, container,);
    },);

    it("to_tjp com atribuições", () => {
      attr.set({
        assignments: [
          {
            shiftScenario: { property: { fullId: "shift1", } },
            interval: "1h-2h",
          },
          {
            shiftScenario: { property: { fullId: "shift2", } },
            interval: "3h-4h",
          },
        ],
      },);
      assertEquals(
        attr.to_tjp(),
        "shifts shift1 1h-2h,\nshift2 3h-4h",
      );
    });

    it("to_tjp vazio", () => {
      attr.set(null,);
      assertEquals(attr.to_tjp(), "shifts ",);
    });

    it("tjpId é 'shifts'", () => {
      assertEquals(ShiftAssignmentsAttribute.tjpId, "shifts",);
    });
  });

  describe("WorkingHoursAttribute", () => {
    let type: AttributeDefinition<unknown>;
    let attr: TestWorkingHoursAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "workinghours",
        "Working Hours",
        AttributeType.WorkingHours,
        null,
      );
      attr = new TestWorkingHoursAttribute(property, type, container,);
    },);

    it("to_tjp com horários de trabalho", () => {
      attr.set({
        getWorkingHours: (day: number,) => {
          if (day === 0) {
            return [[0, 3600],]; // 1h
          }
          return [];
        },
      },);
      assertEquals(
        attr.to_tjp(),
        `workinghours sun 0:00 - 1:00
workinghours mon off
workinghours tue off
workinghours wed off
workinghours thu off
workinghours fri off
workinghours sat off`,
      );
    });

    it("to_tjp vazio", () => {
      attr.set(null,);
      assertEquals(
        attr.to_tjp(),
        `workinghours sun off
workinghours mon off
workinghours tue off
workinghours wed off
workinghours thu off
workinghours fri off
workinghours sat off`,
      );
    });

    it("tjpId é 'workinghours'", () => {
      assertEquals(WorkingHoursAttribute.tjpId, "workinghours",);
    });
  });
});