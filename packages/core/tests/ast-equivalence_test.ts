/**
 * 10.18 — Equivalência de AST entre idiomas (ADR 023).
 *
 * Cada MWE de `docs/Learning/mweNNN/tutorial.tjp` tem traduções mecânicas
 * pt-BR/es em `tests/fixtures/i18n/` (apenas keywords traduzidos; strings
 * e IDs preservados). O teste parseia as três versões, extrai um snapshot
 * estrutural determinístico do modelo (a "AST") e compara após normalizar
 * `name` de tasks/resources (10.18.4).
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { type ParseOutcome, parseProject, } from "./parser/parse-helper.ts";
import type { PropertyTreeNode, } from "../src/model/property-tree-node.ts";
import type { Project, } from "../src/model/project.ts";

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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MWE_IDS = [
  "mwe001",
  "mwe002",
  "mwe003",
  "mwe004",
  "mwe005",
  "mwe006",
  "mwe007",
  "mwe008",
  "mwe009",
];

function readFixture(mwe: string, lang: string,): string {
  const path = lang === "en"
    ? `../../../docs/Learning/${mwe}/tutorial.tjp`
    : `./fixtures/i18n/${mwe}.${lang}.tjp`;
  return Deno.readTextFileSync(new URL(path, import.meta.url,),);
}

function parseText(text: string,): ParseOutcome & { snap: AstSnap } {
  const out = parseProject(text,);
  assert(
    out.threw === null,
    `parse lançou: ${out.threw?.message ?? ""} (${out.messageIds.join(",",)})`,
  );
  assert(
    out.result instanceof Object && out.result !== null,
    `resultado não-Project: ${String(out.result,)} msgs=${
      out.messageIds.join(",",)
    }`,
  );
  return { ...out, snap: snapshotAST(out.result as Project,), };
}

describe("normalizeAST (10.18.4)", () => {
  const base = (kind: string, name: string,): NodeSnap => ({
    kind,
    fullId: "x",
    name,
    attrs: {},
    scenarioAttrs: [],
    children: [],
  });
  const snap: AstSnap = {
    project: { name: "P", attrs: {}, scenarioCount: 1, },
    sets: {
      tasks: [base("Task", "Design",),],
      resources: [base("Resource", "Alice",),],
      reports: [base("Report", "Plan",),],
    },
  };

  it("substitui name de Task por __TASK__ preservando estrutura", () => {
    const n = normalizeAST(snap,);
    assertEquals(n.sets.tasks![0]!.name, "__TASK__",);
    assertEquals(n.sets.tasks![0]!.kind, "Task",);
    assertEquals(n.sets.tasks![0]!.fullId, "x",);
  });

  it("substitui name de Resource por __RESOURCE__", () => {
    const n = normalizeAST(snap,);
    assertEquals(n.sets.resources![0]!.name, "__RESOURCE__",);
  });

  it("preserva name de outras entidades (Report)", () => {
    const n = normalizeAST(snap,);
    assertEquals(n.sets.reports![0]!.name, "Plan",);
  });
});

describe("serializeValue", () => {
  it("valores primitivos e coleções são determinísticos", () => {
    assertEquals(serializeValue(3,), "n:3",);
    assertEquals(serializeValue("d",), "s:d",);
    assertEquals(serializeValue([1, "a",],), "[n:1,s:a,]",);
    const m = new Map([["b", 2,], ["a", 1,],],);
    assertEquals(serializeValue(m,), "map{s:a=>n:1|s:b=>n:2,}",);
  });

  it("ordem de chaves de objetos não importa (sort)", () => {
    const a = serializeValue({ x: 1, y: 2, },);
    const b = serializeValue({ y: 2, x: 1, },);
    assertEquals(a, b,);
  });

  it("lineNo/columnNo são ignorados (offsets de tradução)", () => {
    const a = serializeValue({ fileName: "", lineNo: 10, },);
    const b = serializeValue({ fileName: "", lineNo: 12, },);
    assertEquals(a, b,);
  });
});

for (const mwe of MWE_IDS) {
  describe(`${mwe}: AST equivalente entre en/pt-BR/es (10.18.5-8)`, () => {
    it("todas as três versões parseiam sem mensagens", () => {
      for (const lang of ["en", "pt-BR", "es",]) {
        const out = parseText(readFixture(mwe, lang,),);
        assertEquals(out.messageIds, [], `${mwe}.${lang} mensagens`,);
      }
    });

    it("pt-BR produz AST equivalente ao en", () => {
      const en = normalizeAST(parseText(readFixture(mwe, "en",),).snap,);
      const pt = normalizeAST(
        parseText(readFixture(mwe, "pt-BR",),).snap,
      );
      assertEquals(pt, en, `${mwe} pt-BR ≠ en`,);
    });

    it("es produz AST equivalente ao en", () => {
      const en = normalizeAST(parseText(readFixture(mwe, "en",),).snap,);
      const es = normalizeAST(parseText(readFixture(mwe, "es",),).snap,);
      assertEquals(es, en, `${mwe} es ≠ en`,);
    });
  });
}
