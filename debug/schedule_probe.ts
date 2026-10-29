/**
 * schedule_probe — ferramenta de diagnóstico commitada (Fase 11-Gaps, 11.G.A.1).
 *
 * Recebe um `.tjp`, roda `parse → schedule` e dumpa um JSON com o estado por
 * task/recurso. Serve para localizar rapidamente onde o pipeline de scheduling
 * para (ou colocou datas erradas) — antes era um probe ad-hoc do
 * `fase-11-logical-complemento.md` §6.10; agora é ferramenta permanente.
 *
 * Uso:
 *   deno task probe docs/Learning/mwe001/tutorial.tjp
 *   deno run --allow-read --allow-env --allow-hrtime debug/schedule_probe.ts <tjp>
 *
 * O probe usa o `ProjectFileParser` da Fase 10 diretamente (não o
 * `TaskJuggler#parseContent`, que é stub ancorado na Fase 19). Ele **não**
 * polui o core: é uma ferramenta de diagnóstico, fora de `packages/core/src`.
 */
import { resolve, } from "@std/path";
import { MessageHandlerInstance, } from "../packages/core/src/message-handler.ts";
import { ProjectFileParser, } from "../packages/core/src/parser/mod.ts";
import { DataCache, } from "../packages/core/src/scheduling/data-cache.ts";
import { TjTime, } from "../packages/core/src/time/tj-time.ts";
import type { Project, } from "../packages/core/src/model/project.ts";
import type { PropertyTreeNode, } from "../packages/core/src/model/property-tree-node.ts";
import type { Task, } from "../packages/core/src/model/task.ts";
import type { TaskScenario, } from "../packages/core/src/model/task-scenario.ts";

interface TaskProbe {
  fullId: string;
  start: string | null;
  end: string | null;
  doneEffort: number;
  isRunAway: boolean;
  scheduled: boolean;
  durationType: string;
}

interface ResourceProbe {
  fullId: string;
  effort: number;
  duties: number;
}

interface ProbeReport {
  file: string;
  parseErrors: number;
  scheduleErrors: number;
  /** Preenchido quando `schedule()` lança (exceção não-Tj capturada). */
  scheduleException?: string;
  messages: Array<{ id: string; text: string }>;
  tasks: TaskProbe[];
  resources: ResourceProbe[];
  dataCache: { hits: number; misses: number; collisions: number };
}

/** Lista plana das entidades do set. `PropertySet#toArray()` já devolve o
 * índice flat (Ruby: `PropertySet.each`); não precisamos recursar em
 * `children` — isso duplicaria os filhos. */
function listAll(
  set: { toArray(): PropertyTreeNode[] },
): PropertyTreeNode[] {
  return set.toArray();
}

function dayOf(v: unknown,): string | null {
  return v instanceof TjTime ? v.toString() : null;
}

function probe(tjpPath: string,): ProbeReport {
  const text = Deno.readTextFileSync(resolve(tjpPath,),);
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;

  const parser = new ProjectFileParser();
  parser.open(text, true, true,);
  const result = parser.parse("project",) as Project;

  const parseErrors = MessageHandlerInstance.instance.errors;
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;

  let scheduleErrors = 0;
  let scheduleException: string | undefined;
  if (result && result instanceof Object) {
    try {
      result.schedule();
    } catch (e) {
      scheduleException = (e as Error).stack ?? (e as Error).message;
      scheduleErrors = -1;
    }
    if (scheduleErrors !== -1) {
      scheduleErrors = MessageHandlerInstance.instance.errors;
    }
  }

  const messages = MessageHandlerInstance.instance.messages.map((m,) => ({
    id: m.id,
    text: (m as unknown as { message?: string }).message ?? "",
  }));

  const tasks: TaskProbe[] = result ?
    listAll(result.tasks,).map((n,) => {
      const sc = (n as Task).scenarioData(0,) as TaskScenario;
      return {
        fullId: n.fullId,
        start: dayOf(n.getForScenario("start", 0,),),
        end: dayOf(n.getForScenario("end", 0,),),
        doneEffort: sc.doneEffort(),
        isRunAway: sc.isRunAway(),
        // `scheduled` é espelhado no bag por `markAsScheduled` (forceForScenario).
        scheduled: Boolean(n.getForScenario("scheduled", 0,),),
        durationType: sc.durationType(),
      };
    },) :
    [];

  const resources: ResourceProbe[] = result
    ? listAll(result.resources,).map((n,) => ({
      fullId: n.fullId,
      // Esforço total do recurso é um runtime attribute (não exposto como
      // método público no port); leitura defensiva do bag.
      effort: Number(n.getForScenario("effort", 0,) ?? 0,),
      duties: ((n.getForScenario("duties", 0,) as unknown[]) ?? []).length,
    }))
    : [];

  const cache = DataCache.instance;
  return {
    file: tjpPath,
    parseErrors,
    scheduleErrors,
    ...(scheduleException ? { scheduleException, } : {}),
    messages,
    tasks,
    resources,
    dataCache: {
      hits: cache.hitCount,
      misses: cache.missCount,
      collisions: cache.collisionCount,
    },
  };
}

/** API exportada para testes (11.G.A.1.10). */
export { probe, type ProbeReport, };

// CLI: só executa se chamado diretamente (não quando importado em teste).
if (import.meta.main) {
  const arg = Deno.args[0];
  if (!arg) {
    console.error("uso: deno task probe <arquivo.tjp>",);
    Deno.exit(2,);
  }
  try {
    const report = probe(arg,);
    console.log(JSON.stringify(report, null, 2,),);
  } catch (e) {
    console.error(`probe falhou em ${arg}: ${(e as Error).message}`,);
    Deno.exit(1,);
  }
}
