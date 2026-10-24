//!/usr/bin/env tsx
import { createTestProject, } from "./packages/core/tests/fixtures/create-test-project.ts";
import { PropertySet, } from "./packages/core/src/model/property-set.ts";
import { PropertyTreeNode, } from "./packages/core/src/model/property-tree-node.ts";
import { AttributeBase, } from "./packages/core/src/attributes/attribute-base.ts";
import { AttributeType, } from "./packages/core/src/attributes/attribute-type.ts";

function makeMockScenarioAttrClass(defaultValue: unknown,) {
  return class MockScenarioAttribute extends AttributeBase<unknown> {
    constructor(
      property: any,
      type: any,
      container: any,
    ) {
      super(property, type, container,);
    }
    override set(value: unknown,) {
      console.log(`    MockScenarioAttribute.set(${value}) called, attr.provided=${this.provided}, attr.inherited=${this.inherited}`);
      super.set(value as never,);
    }
    override inherit(value: unknown,) {
      console.log(`    MockScenarioAttribute.inherit(${value}) called, attr.provided=${this.provided}, attr.inherited=${this.inherited}`);
      super.inherit(value as never,);
    }
    override get() {
      return this._value;
    }
  };
}

console.log("=== Debugging inherited scenario attribute ===");

const project = createTestProject(2,);
const propertySet = new PropertySet(project, false,);
propertySet.addAttributeType({
  id: "effort",
  name: "Effort",
  objClass: makeMockScenarioAttrClass(0,),
  inheritedFromParent: false,
  inheritedFromProject: false,
  defaultValue: 0,
  type: AttributeType.Integer,
  userDefined: false,
  isList: false,
  isSingleton: false,
  isScenarioAttribute: true,
},);
const root = new PropertyTreeNode(propertySet, "root", "Root", null,);

console.log("\n1. After root.setForScenario('effort', 3600, 0):");
root.setForScenario("effort", 3600, 0,);
const attr0 = root.scenarioAttributes[0]?.get("effort",);
const attr1 = root.scenarioAttributes[1]?.get("effort",);
console.log("   scIdx=0: provided:", attr0?.provided, "inherited:", attr0?.inherited, "value:", attr0?._value);
console.log("   scIdx=1: provided:", attr1?.provided, "inherited:", attr1?.inherited, "value:", attr1?._value);
console.log("   root.inherited('effort', 0):", root.inherited("effort", 0,),);
console.log("   root.inherited('effort', 1):", root.inherited("effort", 1,),);

console.log("\n2. After root.setForScenario('effort', 7200, 1):");
root.setForScenario("effort", 7200, 1,);
const attr0b = root.scenarioAttributes[0]?.get("effort",);
const attr1b = root.scenarioAttributes[1]?.get("effort",);
console.log("   scIdx=0: provided:", attr0b?.provided, "inherited:", attr0b?.inherited, "value:", attr0b?._value);
console.log("   scIdx=1: provided:", attr1b?.provided, "inherited:", attr1b?.inherited, "value:", attr1b?._value);
console.log("   root.inherited('effort', 0):", root.inherited("effort", 0,),);
console.log("   root.inherited('effort', 1):", root.inherited("effort", 1,),);

console.log("\n3. AttributeBase.mode:", AttributeBase.mode,);

console.log("\n=== End debug ===");