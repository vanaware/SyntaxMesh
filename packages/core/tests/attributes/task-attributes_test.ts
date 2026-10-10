import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { AttributeBase, } from "../../src/attributes/attribute-base.ts";
import { AttributeDefinition, } from "../../src/attributes/attribute-definition.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { MockContainer, } from "./mock-container.ts";
import { MockProject, } from "../model/mock-project.ts";
import { PropertySet, } from "../../src/model/property-set.ts";

describe("TaskAttributes", () => {
  let container: MockContainer;
  let property: { id: string; name: string };
  let project: MockProject;

  beforeEach(() => {
    AttributeBase.setMode(0,);
    container = new MockContainer();
    project = new MockProject();
    property = { id: "test.attr", name: "Test Attr", };
  },);

  describe("registerTaskAttributes", () => {
    let ps: PropertySet;

    beforeEach(() => {
      ps = new PropertySet(project, false,);
    },);

    it("registra 29 atributos específicos (excluindo base id, name, seqno, index)", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      let count = 0;
      ps.eachAttributeDefinition((attrDef,) => {
        if (!["id", "name", "seqno", "index",].includes(attrDef.id,)) {
          count++;
        }
      },);
      assertEquals(count, 43,);
    });

    it("registra allocate com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("allocate",);
      assert(attrDef !== undefined, "allocate deve estar registrado",);
      assertEquals(attrDef.id, "allocate",);
      assertEquals(attrDef.name, "Allocations",);
      assertEquals(attrDef.type, AttributeType.Allocation,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra assignedresources com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("assignedresources",);
      assert(attrDef !== undefined, "assignedresources deve estar registrado",);
      assertEquals(attrDef.id, "assignedresources",);
      assertEquals(attrDef.name, "Assigned Resources",);
      assertEquals(attrDef.type, AttributeType.ResourceList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra booking com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("booking",);
      assert(attrDef !== undefined, "booking deve estar registrado",);
      assertEquals(attrDef.id, "booking",);
      assertEquals(attrDef.name, "Bookings",);
      assertEquals(attrDef.type, AttributeType.BookingList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra charge com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("charge",);
      assert(attrDef !== undefined, "charge deve estar registrado",);
      assertEquals(attrDef.id, "charge",);
      assertEquals(attrDef.name, "Charges",);
      assertEquals(attrDef.type, AttributeType.ChargeList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra competitors com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("competitors",);
      assert(attrDef !== undefined, "competitors deve estar registrado",);
      assertEquals(attrDef.id, "competitors",);
      assertEquals(attrDef.name, "Competitors",);
      assertEquals(attrDef.type, AttributeType.TaskList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra criticalness com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("criticalness",);
      assert(attrDef !== undefined, "criticalness deve estar registrado",);
      assertEquals(attrDef.id, "criticalness",);
      assertEquals(attrDef.name, "Criticalness",);
      assertEquals(attrDef.type, AttributeType.Float,);
      assertEquals(attrDef.defaultValue, 0.0,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra depends com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("depends",);
      assert(attrDef !== undefined, "depends deve estar registrado",);
      assertEquals(attrDef.id, "depends",);
      assertEquals(attrDef.name, "Preceding tasks",);
      assertEquals(attrDef.type, AttributeType.DependencyList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra duration com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("duration",);
      assert(attrDef !== undefined, "duration deve estar registrado",);
      assertEquals(attrDef.id, "duration",);
      assertEquals(attrDef.name, "Duration",);
      assertEquals(attrDef.type, AttributeType.Duration,);
      assertEquals(attrDef.defaultValue, 0,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra effort com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("effort",);
      assert(attrDef !== undefined, "effort deve estar registrado",);
      assertEquals(attrDef.id, "effort",);
      assertEquals(attrDef.name, "Effort",);
      assertEquals(attrDef.type, AttributeType.Duration,);
      assertEquals(attrDef.defaultValue, 0,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra effortdone com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("effortdone",);
      assert(attrDef !== undefined, "effortdone deve estar registrado",);
      assertEquals(attrDef.id, "effortdone",);
      assertEquals(attrDef.name, "Completed Effort",);
      assertEquals(attrDef.type, AttributeType.Integer,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra effortleft com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("effortleft",);
      assert(attrDef !== undefined, "effortleft deve estar registrado",);
      assertEquals(attrDef.id, "effortleft",);
      assertEquals(attrDef.name, "Remaining Effort",);
      assertEquals(attrDef.type, AttributeType.Integer,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra end com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("end",);
      assert(attrDef !== undefined, "end deve estar registrado",);
      assertEquals(attrDef.id, "end",);
      assertEquals(attrDef.name, "End",);
      assertEquals(attrDef.type, AttributeType.Date,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra endpreds com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("endpreds",);
      assert(attrDef !== undefined, "endpreds deve estar registrado",);
      assertEquals(attrDef.id, "endpreds",);
      assertEquals(attrDef.name, "End Preds.",);
      assertEquals(attrDef.type, AttributeType.TaskDepList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra endsuccs com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("endsuccs",);
      assert(attrDef !== undefined, "endsuccs deve estar registrado",);
      assertEquals(attrDef.id, "endsuccs",);
      assertEquals(attrDef.name, "End Succs.",);
      assertEquals(attrDef.type, AttributeType.TaskDepList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra fail com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("fail",);
      assert(attrDef !== undefined, "fail deve estar registrado",);
      assertEquals(attrDef.id, "fail",);
      assertEquals(attrDef.name, "Failure Conditions",);
      assertEquals(attrDef.type, AttributeType.LogicalExpressionList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra flags com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("flags",);
      assert(attrDef !== undefined, "flags deve estar registrado",);
      assertEquals(attrDef.id, "flags",);
      assertEquals(attrDef.name, "Flags",);
      assertEquals(attrDef.type, AttributeType.FlagList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra forward com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("forward",);
      assert(attrDef !== undefined, "forward deve estar registrado",);
      assertEquals(attrDef.id, "forward",);
      assertEquals(attrDef.name, "Scheduling",);
      assertEquals(attrDef.type, AttributeType.Boolean,);
      assertEquals(attrDef.defaultValue, true,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra gauge com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("gauge",);
      assert(attrDef !== undefined, "gauge deve estar registrado",);
      assertEquals(attrDef.id, "gauge",);
      assertEquals(attrDef.name, "Schedule gauge",);
      assertEquals(attrDef.type, AttributeType.String,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra id com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("id",);
      assert(attrDef !== undefined, "id deve estar registrado",);
      assertEquals(attrDef.id, "id",);
      assertEquals(attrDef.name, "ID",);
      assertEquals(attrDef.type, AttributeType.String,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra index com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("index",);
      assert(attrDef !== undefined, "index deve estar registrado",);
      assertEquals(attrDef.id, "index",);
      assertEquals(attrDef.name, "Index",);
      assertEquals(attrDef.type, AttributeType.Integer,);
      assertEquals(attrDef.defaultValue, -1,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra length com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("length",);
      assert(attrDef !== undefined, "length deve estar registrado",);
      assertEquals(attrDef.id, "length",);
      assertEquals(attrDef.name, "Length",);
      assertEquals(attrDef.type, AttributeType.Duration,);
      assertEquals(attrDef.defaultValue, 0,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra limits com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("limits",);
      assert(attrDef !== undefined, "limits deve estar registrado",);
      assertEquals(attrDef.id, "limits",);
      assertEquals(attrDef.name, "Limits",);
      assertEquals(attrDef.type, AttributeType.Limits,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra maxend com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("maxend",);
      assert(attrDef !== undefined, "maxend deve estar registrado",);
      assertEquals(attrDef.id, "maxend",);
      assertEquals(attrDef.name, "Max. End",);
      assertEquals(attrDef.type, AttributeType.Date,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra maxstart com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("maxstart",);
      assert(attrDef !== undefined, "maxstart deve estar registrado",);
      assertEquals(attrDef.id, "maxstart",);
      assertEquals(attrDef.name, "Max. Start",);
      assertEquals(attrDef.type, AttributeType.Date,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra milestone com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("milestone",);
      assert(attrDef !== undefined, "milestone deve estar registrado",);
      assertEquals(attrDef.id, "milestone",);
      assertEquals(attrDef.name, "Milestone",);
      assertEquals(attrDef.type, AttributeType.Boolean,);
      assertEquals(attrDef.defaultValue, false,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra minend com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("minend",);
      assert(attrDef !== undefined, "minend deve estar registrado",);
      assertEquals(attrDef.id, "minend",);
      assertEquals(attrDef.name, "Min. End",);
      assertEquals(attrDef.type, AttributeType.Date,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra minstart com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("minstart",);
      assert(attrDef !== undefined, "minstart deve estar registrado",);
      assertEquals(attrDef.id, "minstart",);
      assertEquals(attrDef.name, "Min. Start",);
      assertEquals(attrDef.type, AttributeType.Date,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra name com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("name",);
      assert(attrDef !== undefined, "name deve estar registrado",);
      assertEquals(attrDef.id, "name",);
      assertEquals(attrDef.name, "Name",);
      assertEquals(attrDef.type, AttributeType.String,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra note com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("note",);
      assert(attrDef !== undefined, "note deve estar registrado",);
      assertEquals(attrDef.id, "note",);
      assertEquals(attrDef.name, "Note",);
      assertEquals(attrDef.type, AttributeType.RichText,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra pathcriticalness com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("pathcriticalness",);
      assert(attrDef !== undefined, "pathcriticalness deve estar registrado",);
      assertEquals(attrDef.id, "pathcriticalness",);
      assertEquals(attrDef.name, "Path Criticalness",);
      assertEquals(attrDef.type, AttributeType.Float,);
      assertEquals(attrDef.defaultValue, 0.0,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra precedes com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("precedes",);
      assert(attrDef !== undefined, "precedes deve estar registrado",);
      assertEquals(attrDef.id, "precedes",);
      assertEquals(attrDef.name, "Following tasks",);
      assertEquals(attrDef.type, AttributeType.DependencyList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra priority com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("priority",);
      assert(attrDef !== undefined, "priority deve estar registrado",);
      assertEquals(attrDef.id, "priority",);
      assertEquals(attrDef.name, "Priority",);
      assertEquals(attrDef.type, AttributeType.Integer,);
      assertEquals(attrDef.defaultValue, 500,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, true,);
    });

    it("registra projectid com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("projectid",);
      assert(attrDef !== undefined, "projectid deve estar registrado",);
      assertEquals(attrDef.id, "projectid",);
      assertEquals(attrDef.name, "Project ID",);
      assertEquals(attrDef.type, AttributeType.Symbol,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, true,);
    });

    it("registra responsible com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("responsible",);
      assert(attrDef !== undefined, "responsible deve estar registrado",);
      assertEquals(attrDef.id, "responsible",);
      assertEquals(attrDef.name, "Responsible",);
      assertEquals(attrDef.type, AttributeType.ResourceList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra scheduled com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("scheduled",);
      assert(attrDef !== undefined, "scheduled deve estar registrado",);
      assertEquals(attrDef.id, "scheduled",);
      assertEquals(attrDef.name, "Scheduled",);
      assertEquals(attrDef.type, AttributeType.Boolean,);
      assertEquals(attrDef.defaultValue, false,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra projectionmode com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("projectionmode",);
      assert(attrDef !== undefined, "projectionmode deve estar registrado",);
      assertEquals(attrDef.id, "projectionmode",);
      assertEquals(attrDef.name, "Projection Mode",);
      assertEquals(attrDef.type, AttributeType.Boolean,);
      assertEquals(attrDef.defaultValue, false,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra shifts com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("shifts",);
      assert(attrDef !== undefined, "shifts deve estar registrado",);
      assertEquals(attrDef.id, "shifts",);
      assertEquals(attrDef.name, "Shifts",);
      assertEquals(attrDef.type, AttributeType.ShiftAssignments,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, true,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra start com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("start",);
      assert(attrDef !== undefined, "start deve estar registrado",);
      assertEquals(attrDef.id, "start",);
      assertEquals(attrDef.name, "Start",);
      assertEquals(attrDef.type, AttributeType.Date,);
      assertEquals(attrDef.defaultValue, null,);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra startpreds com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("startpreds",);
      assert(attrDef !== undefined, "startpreds deve estar registrado",);
      assertEquals(attrDef.id, "startpreds",);
      assertEquals(attrDef.name, "Start Preds.",);
      assertEquals(attrDef.type, AttributeType.TaskDepList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra startsuccs com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("startsuccs",);
      assert(attrDef !== undefined, "startsuccs deve estar registrado",);
      assertEquals(attrDef.id, "startsuccs",);
      assertEquals(attrDef.name, "Start Succs.",);
      assertEquals(attrDef.type, AttributeType.TaskDepList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra status com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("status",);
      assert(attrDef !== undefined, "status deve estar registrado",);
      assertEquals(attrDef.id, "status",);
      assertEquals(attrDef.name, "Task Status",);
      assertEquals(attrDef.type, AttributeType.String,);
      assertEquals(attrDef.defaultValue, "",);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, true,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra tree com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("tree",);
      assert(attrDef !== undefined, "tree deve estar registrado",);
      assertEquals(attrDef.id, "tree",);
      assertEquals(attrDef.name, "Tree Index",);
      assertEquals(attrDef.type, AttributeType.String,);
      assertEquals(attrDef.defaultValue, "",);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });

    it("registra warn com atributos corretos", async () => {
      const { registerTaskAttributes, } = await import(
        "../../src/model/attributes/task-attributes.ts"
      );
      registerTaskAttributes(ps,);

      const attrDef = ps.attributeDefinition("warn",);
      assert(attrDef !== undefined, "warn deve estar registrado",);
      assertEquals(attrDef.id, "warn",);
      assertEquals(attrDef.name, "Warning Condition",);
      assertEquals(attrDef.type, AttributeType.LogicalExpressionList,);
      assertEquals(attrDef.defaultValue, [],);
      assertEquals(attrDef.userDefined, false,);
      assertEquals(attrDef.isList, false,);
      assertEquals(attrDef.isSingleton, false,);
      assertEquals(attrDef.isScenarioAttribute, false,);
      assertEquals(attrDef.inheritedFromParent, false,);
      assertEquals(attrDef.inheritedFromProject, false,);
    });
  });
});
