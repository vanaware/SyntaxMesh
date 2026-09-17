import { describe, it, beforeEach, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { AttributeBase } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition } from "../../src/attributes/attribute-definition.ts";
import { AttributeType } from "../../src/attributes/attribute-type.ts";
import { MockContainer } from "./mock-container.ts";
import { AllocationAttribute } from "../../src/attributes/allocation/allocation-attribute.ts";
import { BookingListAttribute } from "../../src/attributes/allocation/booking-list-attribute.ts";

class TestAllocationAttribute extends AllocationAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<{ candidates: { fullId: string }[]; selectionMode: number; mandatory: boolean; persistent: boolean; }[]>, container: MockContainer) {
    super(property, type, container);
  }
}

class TestBookingListAttribute extends BookingListAttribute {
  constructor(property: { id: string; name: string; }, type: AttributeDefinition<{ to_s(): string }[]>, container: MockContainer) {
    super(property, type, container);
  }
}

describe("AllocationBookingAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string; };

  beforeEach(() => {
    AttributeBase.setMode(0);
    container = new MockContainer();
    property = { id: "test.attr", name: "Test Attr" };
  });

  describe("AllocationAttribute", () => {
    let type: AttributeDefinition<{ candidates: { fullId: string }[]; selectionMode: number; mandatory: boolean; persistent: boolean; }[]>;
    let attr: TestAllocationAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "allocation",
        "Allocation",
        AttributeType.Allocation,
        [],
      );
      attr = new TestAllocationAttribute(property, type, container);
    });

    it("to_s com alocação única", () => {
      attr.set([
        {
          candidates: [{ fullId: "r1" }, { fullId: "r2" }],
          selectionMode: 0,
          mandatory: true,
          persistent: false,
        },
      ]);
      assertEquals(attr.to_s(), "[ r1, r2 ] select by order mandatory ");
    });

    it("to_s com múltiplas alocações", () => {
      attr.set([
        {
          candidates: [{ fullId: "r1" }],
          selectionMode: 1,
          mandatory: false,
          persistent: true,
        },
        {
          candidates: [{ fullId: "r2" }],
          selectionMode: 2,
          mandatory: true,
          persistent: false,
        },
      ]);
      assertEquals(attr.to_s(), "[ r1 ] select by lowprob persistent \n[ r2 ] select by lowload mandatory ");
    });

    it("tjpId é 'allocation'", () => {
      assertEquals(AllocationAttribute.tjpId, "allocation");
    });
  });

  describe("BookingListAttribute", () => {
    let type: AttributeDefinition<{ to_s(): string }[]>;
    let attr: TestBookingListAttribute;

    beforeEach(() => {
      type = new AttributeDefinition(
        "bookinglist",
        "Booking List",
        AttributeType.BookingList,
        [],
      );
      attr = new TestBookingListAttribute(property, type, container);
    });

    it("to_s", () => {
      attr.set([
        { to_s() { return "b1"; } },
        { to_s() { return "b2"; } },
      ]);
      assertEquals(attr.to_s(), "b1, b2");
    });

    it("to_tjp lança Error", () => {
      attr.set([{ to_s() { return "b1"; } }]);
      assertThrows(() => attr.to_tjp(), Error);
    });

    it("tjpId é 'bookinglist'", () => {
      assertEquals(BookingListAttribute.tjpId, "bookinglist");
    });
  });
});