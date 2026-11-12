/**
 * Deterministic structural snapshot ("AST") of a parsed Project — shared by
 * `ast-equivalence_test.ts`, `ast-equivalence-complemento_test.ts` and
 * `smoke_after_phase_10_test.ts`.
 *
 * Lives outside `*_test.ts` on purpose: importing helpers from a test module
 * re-registers its whole suite in every importing file (Deno discovers tests
 * per module), running the same assertions three times.
 */
import type { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";
import type { Project, } from "../../src/model/project.ts";

// ---------------------------------------------------------------------------
// Serialização determinística de valores de atributo
// ---------------------------------------------------------------------------

const SKIP_KEYS = new Set(["lineNo", "columnNo",],);

function isAttributeLike(v: unknown,): v is { value: unknown } {
  const c = v as Record<string, unknown>;
  return typeof c.get === "function" && typeof c.isNil === "function";
}

function isPtnLike(v: Record<string, unknown>,): boolean {
  return typeof v.fullId === "string" && typeof v.name === "string" &&
    v.attributes instanceof Map;
}

/** Serializa qualquer valor do modelo em string canônica estável. */
export function serializeValue(v: unknown, seen = new WeakSet(),): string {
  if (v === null) return "null";
  if (v === undefined) return "undefined";
  if (typeof v === "number") return `n:${v}`;
  if (typeof v === "boolean") return `b:${v}`;
  if (typeof v === "string") return `s:${v}`;
  if (typeof v === "function") return "fn";
  if (typeof v === "bigint") return `i:${String(v,)}`;
  if (v instanceof Date) return `d:${v.getTime()}`;
  if (seen.has(v as object,)) return "cycle";
  seen.add(v as object,);

  const o = v as Record<string, unknown>;
  // TjTime: epoch local (idêntico entre idiomas).
  if (typeof o.toSeconds === "function" && typeof o.to_s === "function") {
    return `time:${(o as unknown as { toSeconds(): number }).toSeconds()}`;
  }
  // Referências a nós da árvore de propriedades: corta recursão.
  if (isPtnLike(o,)) {
    return `ref:${o.constructor?.name}:${o.fullId as string}`;
  }
  if (Array.isArray(v,)) {
    return `[${v.map((x,) => serializeValue(x, seen,)).join(",",)},]`;
  }
  if (v instanceof Map) {
    const entries = [...v.entries(),].map((
      [k, val,],
    ) => `${serializeValue(k, seen,)}=>${serializeValue(val, seen,)}`);
    entries.sort();
    return `map{${entries.join("|",)},}`;
  }
  if (v instanceof Set) {
    const items = [...v.values(),].map((x,) => serializeValue(x, seen,));
    items.sort();
    return `set{${items.join("|",)},}`;
  }
  const pairs = Object.entries(o,).filter(([key, val,],) =>
    !SKIP_KEYS.has(key,) && typeof val !== "symbol"
  )
    .map(([key, val,],) => `${key}=${serializeValue(val, seen,)}`);
  pairs.sort();
  return `${o.constructor?.name ?? "Object"}{${pairs.join(",",)},}`;
}

// ---------------------------------------------------------------------------
// Snapshot da AST (modelo parseado)
// ---------------------------------------------------------------------------

export interface NodeSnap {
  kind: string;
  fullId: string;
  name: string;
  attrs: Record<string, string>;
  scenarioAttrs: Record<string, string>[];
  children: NodeSnap[];
}

export interface AstSnap {
  project: {
    name: string;
    attrs: Record<string, string>;
    scenarioCount: number;
  };
  sets: Record<string, NodeSnap[]>;
}

function attrMapSnap(
  map: Map<string, unknown>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, attr,] of map.entries()) {
    out[key] = serializeValue(isAttributeLike(attr,) ? attr.value : attr,);
  }
  return out;
}

function snapNode(node: PropertyTreeNode,): NodeSnap {
  return {
    kind: node.constructor.name,
    fullId: node.fullId,
    name: node.name,
    attrs: attrMapSnap(node.attributes as Map<string, unknown>,),
    scenarioAttrs: node.scenarioAttributes.map(
      (m,) => attrMapSnap(m as Map<string, unknown>,),
    ),
    children: node.children.map((c,) => snapNode(c,)),
  };
}

const SET_NAMES = [
  "tasks",
  "resources",
  "accounts",
  "shifts",
  "scenarios",
  "reports",
  "materials",
] as const;

/** Extrai snapshot estrutural determinístico do Project parseado. */
export function snapshotAST(project: Project,): AstSnap {
  const sets: Record<string, NodeSnap[]> = {};
  for (const name of SET_NAMES) {
    const set = project[name] as {
      toArray(): PropertyTreeNode[];
    };
    sets[name] = set.toArray().filter((p,) => p.parent === null).map((
      p,
    ) => snapNode(p,));
  }
  return {
    project: {
      name: project.name,
      attrs: attrMapSnap(
        (project as unknown as { attributes: Map<string, unknown> }).attributes,
      ),
      scenarioCount: project.scenarioCount,
    },
    sets,
  };
}

/**
 * 10.18.4 — normaliza `name` de tasks/resources para placeholders (os nomes
 * legíveis podem divergir entre idiomas nos arquivos de exemplo).
 */
export function normalizeAST(snap: AstSnap,): AstSnap {
  const walk = (n: NodeSnap,): NodeSnap => ({
    ...n,
    name: n.kind === "Task" ?
      "__TASK__" :
      n.kind === "Resource"
      ? "__RESOURCE__"
      : n.name,
    children: n.children.map(walk,),
  });
  return {
    project: snap.project,
    sets: Object.fromEntries(
      Object.entries(snap.sets,).map(([k, list,],) => [
        k,
        list.map(walk,),
      ]),
    ),
  };
}
