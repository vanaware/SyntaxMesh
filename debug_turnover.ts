// Debug script for turnover test failures
import { createTestProject } from "./packages/core/tests/fixtures/create-test-project.ts";
import { Project } from "./packages/core/src/model/project.ts";
import { Task } from "./packages/core/src/model/task.ts";
import { TaskScenario } from "./packages/core/src/model/task-scenario.ts";
import { Resource } from "./packages/core/src/model/resource.ts";
import { ResourceScenario } from "./packages/core/src/model/resource-scenario.ts";
import { Account } from "./packages/core/src/model/account.ts";
import { ChargeSet } from "./packages/core/src/finance/charge-set.ts";
import { Charge, ChargeMode } from "./packages/core/src/finance/charge.ts";
import { TjTime } from "./packages/core/src/time/tj-time.ts";

function injectCharge(
  task: Task,
  amount: number,
  mode: ChargeMode,
  scIdx: number,
): void {
  const charge = new Charge(amount, mode, task, scIdx,);
  const current = (task.getForScenario("charge", scIdx,) as { amount: number }[] | null) ?? [];
  current.push(charge as unknown as { amount: number });
  task.setForScenario("charge", current, scIdx,);
}

function injectChargeSet(
  task: Task,
  chargeSet: ChargeSet,
  scIdx: number,
): void {
  task.setForScenario("chargeset", [chargeSet], scIdx,);
}

function bookResource(
  resourceScenario: ResourceScenario,
  task: Task,
  scIdx: number,
  project: Project,
): void {
  const start = task.getForScenario("start", scIdx,) as TjTime;
  const end = task.getForScenario("end", scIdx,) as TjTime;
  const startIdx = project.dateToIdx(start,);
  const endIdx = project.dateToIdx(end,);
  console.log(`Booking resource for task ${task.fullId} from ${startIdx} to ${endIdx}`);
  for (let i = startIdx; i < endIdx; i++) {
    const booked = resourceScenario.book(i, task,);
    console.log(`  Booked slot ${i}: ${booked}`);
  }
}

async function main() {
  const project = createTestProject(1,);
  project.set("start", TjTime.fromString("2026-01-01",));
  project.set("end", TjTime.fromString("2026-12-31",));
  project.set("scheduleGranularity", 86400,);
  project.set("dailyWorkingHours", 1,);
  
  const task = new Task(project, "t1", "Task 1", null,);
  const taskScenario = task.scenarioData(0,);
  const resource = new Resource(project, "r1", "Resource 1", null,);
  const resourceScenario = resource.scenarioData(0,);
  const account = new Account(project, "acc1", "Account 1", null,);
  
  // Setup test case: "soma custo do recurso alocado (rate * tempo)"
  task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
  task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
  resource.setForScenario("rate", 100, 0,);
  const chargeSet = new ChargeSet();
  chargeSet.addAccount(account, 1.0,);
  resource.setForScenario("chargeset", [chargeSet], 0,);
  
  bookResource(resourceScenario, task, 0, project,);
  
  console.log("\n=== Debug Info ===");
  console.log(`Task start: ${task.getForScenario("start", 0,)}`);
  console.log(`Task end: ${task.getForScenario("end", 0,)}`);
  console.log(`Resource rate: ${resourceScenario.a("rate",)}`);
  console.log(`Resource chargeset: ${resourceScenario.a("chargeset",)}`);
  console.log(`Resource scoreboard: ${resourceScenario.scoreboard}`);
  console.log(`Resource firstBookedSlot: ${resourceScenario.firstBookedSlot}`);
  console.log(`Resource lastBookedSlot: ${resourceScenario.lastBookedSlot}`);
  console.log(`Resource duties: ${resourceScenario.duties.map(t => t.fullId)}`);
  
  // Check cost calculation
  const startIdx = project.dateToIdx(task.getForScenario("start", 0,) as TjTime);
  const endIdx = project.dateToIdx(task.getForScenario("end", 0,) as TjTime);
  console.log(`\nStartIdx: ${startIdx}, EndIdx: ${endIdx}`);
  
  const allocatedTime = resourceScenario.getAllocatedTime(startIdx, endIdx, task);
  console.log(`AllocatedTime: ${allocatedTime}`);
  
  const cost = resourceScenario.cost(startIdx, endIdx, task);
  console.log(`Cost: ${cost}`);
  
  // Check turnover
  const turnover = taskScenario.turnover(startIdx, endIdx, account, resource,);
  console.log(`Turnover: ${turnover}`);
  console.log(`Expected: 4800`);
}

main().catch(console.error);