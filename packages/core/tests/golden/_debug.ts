import { TjTime, } from "../../src/time/tj-time.ts";

function partsOf(t: TjTime,) {
  const parts = t.to_a();
  return {
    year: parts[0]!,
    month: parts[1]!,
    day: parts[2]!,
    hour: parts[3]!,
    minute: parts[4]!,
    second: parts[5]!,
  };
}

const t = TjTime.fromParts(2026, 1, 15, 14, 30, 45,);
console.log("strftime %H UTC:", JSON.stringify(t.strftime("%H", "UTC",)));
console.log("strftime %I UTC:", JSON.stringify(t.strftime("%I", "UTC",)));
console.log("strftime %X UTC:", JSON.stringify(t.strftime("%X", "UTC",)));
console.log("strftime %% UTC:", JSON.stringify(t.strftime("%%", "UTC",)));
console.log("to_s():", JSON.stringify(t.to_s()));
console.log("to_s UTC:", JSON.stringify(t.to_s(undefined, "UTC")));
console.log("secondsOfDay UTC:", JSON.stringify(t.secondsOfDay("UTC")));
console.log("utc parts:", JSON.stringify(partsOf(t.utc())));
console.log("localtime parts:", JSON.stringify(partsOf(t.localtime())));
console.log("gmtime parts:", JSON.stringify(partsOf(t.gmtime())));

const m = TjTime.fromParts(2026, 1, 31, 12, 0, 0,);
console.log("sameTimeNextMonth Jan31:", JSON.stringify(partsOf(m.sameTimeNextMonth())));

const y = TjTime.fromParts(2024, 2, 29, 12, 0, 0,);
console.log("sameTimeNextYear Feb29:", JSON.stringify(partsOf(y.sameTimeNextYear())));

const ci = TjTime.fromParts(2026, 1, 15, 14, 30, 45,);
console.log("collectIntervals empty:", JSON.stringify(ci.collectIntervals(ci.addSeconds(0), 3600).map((iv,) => ({start: iv.start.to_s(undefined, "UTC"), end: iv.end.to_s(undefined, "UTC")}))));
console.log("collectIntervals single:", JSON.stringify(ci.collectIntervals(ci.addSeconds(3600), 3600).map((iv,) => ({start: iv.start.to_s(undefined, "UTC"), end: iv.end.to_s(undefined, "UTC")}))));
console.log("collectIntervals multi:", JSON.stringify(ci.collectIntervals(ci.addSeconds(7200), 3600).map((iv,) => ({start: iv.start.to_s(undefined, "UTC"), end: iv.end.to_s(undefined, "UTC")}))));

const w = TjTime.fromParts(2026, 1, 18, 12, 0, 0,);
console.log("beginOfWeek Sunday start:", JSON.stringify(partsOf(w.beginOfWeek(false))));
console.log("beginOfWeek Monday start:", JSON.stringify(partsOf(w.beginOfWeek(true))));
console.log("wday:", JSON.stringify(w.wday()));