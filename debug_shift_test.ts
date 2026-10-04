import { MockProject } from "./packages/core/tests/model/mock-project.ts";
import { Shift } from "./packages/core/src/model/shift.ts";

const project = new MockProject(2);
const shift = new Shift(project, "shift1", "Shift 1", null);

console.log("shift.scenarioAttributes:", shift.scenarioAttributes);
console.log("shift.data:", shift.data);

const attr = shift.getScenarioAttribute(0, "replace");
console.log("attr:", attr);
console.log("attr.get:", attr.get);
console.log("typeof attr.get:", typeof attr.get);

shift.setForScenario("replace", true, 0);

const attrAfter = shift.getScenarioAttribute(0, "replace");
console.log("attrAfter:", attrAfter);
console.log("attrAfter.get:", attrAfter.get);
console.log("typeof attrAfter.get:", typeof attrAfter.get);

console.log("shift.getForScenario('replace', 0):", shift.getForScenario("replace", 0));