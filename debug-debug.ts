import { MockProject, } from "./packages/core/tests/model/mock-project.ts";
import { Resource, } from "./packages/core/src/model/resource.ts";
import { Task, } from "./packages/core/src/model/task.ts";
import { Account, } from "./packages/core/src/model/account.ts";
import { ChargeSet, } from "./packages/core/src/finance/charge-set.ts";
import { TjTime, } from "./packages/core/src/time/tj-time.ts";

const project = new MockProject(1,);
project.set("start", TjTime.fromString("2026-01-01",));
project.set("end", TjTime.fromString("2026-12-31",));
project.set("scheduleGranularity", 86400,);
project.set("dailyWorkingHours", 1,);

const resource = new Resource(project, "r1", "Resource 1", null,);
const childResource = new Resource(project, "r2", "Child Resource", resource,);
const grandchildResource = new Resource(project, "r3", "Grandchild Resource", childResource,);
const account = new Account(project, "acc1", "Account 1", null,);

const childChargeSet = new ChargeSet();
childChargeSet.addAccount(account, 1.0,);
const grandchildChargeSet = new ChargeSet();
grandchildChargeSet.addAccount(account, 1.0,);

childResource.setForScenario("rate", 100, 0,);
grandchildResource.setForScenario("rate", 50, 0,);
childResource.setForScenario("chargeset", [childChargeSet], 0,);
grandchildResource.setForScenario("chargeset", [grandchildChargeSet], 0,);

const dummyTask = new Task(project, "t1", "Task 1", null,);

function bookResourceFull(rs: any, startIdx: number, endIdx: number): void {
  for (let i = startIdx; i < endIdx; i++) {
    rs.book(i, dummyTask,);
  }
}

bookResourceFull(childResource.scenarioData(0,), 0, 365,);
bookResourceFull(grandchildResource.scenarioData(0,), 0, 365,);

const childRs = childResource.scenarioData(0,);
console.log("child isChargesetEmpty:", childRs["isChargesetEmpty"]());
console.log("child chargeset:", childRs.a("chargeset",));
console.log("child rate():", childRs.rate());
console.log("child a('rate'):", childRs.a("rate",));
console.log("child cost(0,365):", childRs.cost(0, 365,));
console.log("child getAllocatedTime:", childRs.getAllocatedTime(0, 365,));
console.log("child getAllocatedSlots:", childRs.getAllocatedSlots(0, 365,));
console.log("child turnover:", childRs.turnover(0, 365, account, null, false,));

const rs = resource.scenarioData(0,);
console.log("grandchild turnover:", grandchildResource.scenarioData(0,).turnover(0, 365, account, null, false,));
console.log("resource turnover (container):", rs.turnover(0, 365, account, null, true,));
