import { MockProject } from "./packages/core/tests/model/mock-project.ts";
import { Account } from "./packages/core/src/model/account.ts";

const project = new MockProject(2);
const account = new Account(project, "acc1", "Account 1", null);

console.log("account.data[0]:", account.data[0]);
console.log("account.data[0].attributes:", account.data[0].attributes);
console.log("account.scenarioAttributes[0]:", account.scenarioAttributes[0]);

const attr = account.getScenarioAttribute(0, "credits");
console.log("attr:", attr);
console.log("attr.id:", attr.id);
console.log("attr.get():", attr.get());

const scenario = account.scenarioData(0);
console.log("scenario.a('credits'):", scenario.a("credits"));