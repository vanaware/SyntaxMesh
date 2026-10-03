import { PropertySet, } from "../src/model/property-set.ts";
import { MockProject, } from "./model/mock-project.ts";
import { registerReportAttributes, } from "../src/model/attributes/report-attributes.ts";

const project = new MockProject();
const ps = new PropertySet(project, false);
registerReportAttributes(ps,);

const ids: string[] = [];
ps.eachAttributeDefinition((attrDef,) => {
  ids.push(attrDef.id);
});

console.log("Total:", ids.length);
const expected = [
  "accountroot", "auxdir", "bsi", "caption", "columns", "comment", "definitions",
  "end", "epilog", "flags", "footer", "formats", "ganttBars", "header", "headline",
  "height", "id", "index", "journal", "left", "markdate", "name", "novevents",
  "now", "prolog", "right", "rollupAccount", "rollupResource", "rollupTask",
  "scenarios", "selfcontained", "seqno", "shortTimeFormat", "sortAccounts",
  "sortJournalEntries", "sortResources", "sortTasks", "start", "taskAttributes",
  "taskroot", "timeFormat", "timeOffId", "timeOffName", "timezone", "title",
  "tree", "weekStartsMonday", "width",
];
const missing = expected.filter(e => !ids.includes(e));
console.log("Missing:", missing);
