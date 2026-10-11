import { MockProject, } from "./packages/core/tests/model/mock-project.ts";
import { Task, } from "./packages/core/src/model/task.ts";
import { Resource, } from "./packages/core/src/model/resource.ts";
import { Account, } from "./packages/core/src/model/account.ts";
import { ChargeSet, } from "./packages/core/src/finance/charge-set.ts";
import { TjTime, } from "./packages/core/src/time/tj-time.ts";

const project = new MockProject(1,);
project.set("start", TjTime.fromString("2026-01-01",));
project.set("end", TjTime.fromString("2026-12-31",));
project.set("scheduleGranularity", 86400,);
project.set("dailyWorkingHours", 1,);

const task = new Task(project, "t1", "Task 1", null,);
const taskScenario = task.scenarioData(0,);
const resource = new Resource(project, "r1", "Resource 1", null,);
const resourceScenario = resource.scenarioData(0,);
const account = new Account(project, "acc1", "Account 1", null,);

task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
resource.setForScenario("rate", 100, 0,);

const chargeSet = new ChargeSet();
chargeSet.addAccount(account, 1.0,);
task.setForScenario("chargeset", [chargeSet], 0,);

// Book slots
for (let i = 0; i < 2; i++) {
  resourceScenario.book(i, task,);
}

console.log("firstBookedSlot:", resourceScenario.firstBookedSlot,);
console.log("lastBookedSlot:", resourceScenario.lastBookedSlot,);
console.log("firstBookedSlots.size:", resourceScenario.firstBookedSlots.size,);
console.log("firstBookedSlots.get(task):", resourceScenario.firstBookedSlots.get(task),);
console.log("getAllocatedSlots(0,2):", resourceScenario.getAllocatedSlots(0, 2, task),);
console.log("getAllocatedTime(0,2):", resourceScenario.getAllocatedTime(0, 2, task),);
console.log("cost(0,2):", resourceScenario.cost(0, 2, task),);
console.log("turnover(0,365,account,resource):", taskScenario.turnover(0, 365, account, resource),);
