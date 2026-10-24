import { createTestProject, } from "./packages/core/tests/fixtures/create-test-project.ts";
import { Scenario, } from "./packages/core/src/model/scenario.ts";

const project = createTestProject(2,);
const scenario = project.scenarios.get("plan",);
console.log("scenario:", scenario);
console.log("scenario.data:", scenario?.data);
console.log("scenario.data?.length:", scenario?.data?.length);
console.log("scenario.data?.[0]:", scenario?.data?.[0]);
console.log("scenario.scenarioAttributes:", scenario?.scenarioAttributes);
console.log("scenarioCount:", project.scenarioCount);
