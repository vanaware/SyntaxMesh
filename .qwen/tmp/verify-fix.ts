import { TjTime } from "../../packages/core/src/time/tj-time.ts";
import { compat } from "../../packages/core/src/compat.ts";

function parts(t: TjTime) {
  const a = t.to_a();
  return { year: a[0], month: a[1], day: a[2], hour: a[3], minute: a[4], second: a[5] };
}

const cases = [
  { name: "sameTimeNextWeek fixed", input: { year: 2026, month: 1, day: 12, hour: 10, minute: 0, second: 0 }, method: "sameTimeNextWeek" },
  { name: "sameTimeNextMonth fixed", input: { year: 2026, month: 1, day: 31, hour: 12, minute: 0, second: 0 }, method: "sameTimeNextMonth" },
  { name: "sameTimeNextQuarter fixed", input: { year: 2026, month: 1, day: 15, hour: 14, minute: 30, second: 0 }, method: "sameTimeNextQuarter" },
  { name: "sameTimeNextYear fixed", input: { year: 2024, month: 2, day: 29, hour: 12, minute: 0, second: 0 }, method: "sameTimeNextYear" },
  { name: "sameTimeNextWeek month boundary", input: { year: 2026, month: 12, day: 28, hour: 14, minute: 30, second: 0 }, method: "sameTimeNextWeek" },
  { name: "sameTimeNextMonth year boundary", input: { year: 2026, month: 12, day: 15, hour: 10, minute: 0, second: 0 }, method: "sameTimeNextMonth" },
  { name: "sameTimeNextQuarter year boundary", input: { year: 2026, month: 10, day: 15, hour: 14, minute: 30, second: 0 }, method: "sameTimeNextQuarter" },
];

const orig = compat.keepRubyBugs;
compat.keepRubyBugs = false;
for (const c of cases) {
  const t = TjTime.fromParts(c.input.year, c.input.month, c.input.day, c.input.hour, c.input.minute, c.input.second);
  const result = t[c.method as keyof TjTime]();
  console.log(c.name, "=>", JSON.stringify(parts(result)));
}
compat.keepRubyBugs = orig;