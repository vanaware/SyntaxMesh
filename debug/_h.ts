import { MessageHandlerInstance, } from "../packages/core/src/message-handler.ts";
import { ProjectFileParser, } from "../packages/core/src/parser/mod.ts";

const text = Deno.readTextFileSync(Deno.args[0],);
MessageHandlerInstance.instance.messages.length = 0;
const p = new ProjectFileParser();
p.open(text, true, true,);
try {
  p.parse("project",);
} catch (e) {
  console.log("THREW", (e as Error).message,);
}
for (const m of MessageHandlerInstance.instance.messages) {
  console.log(
    m.severity,
    m.id,
    JSON.stringify((m as unknown as { message?: string; }).message,),
  );
}
